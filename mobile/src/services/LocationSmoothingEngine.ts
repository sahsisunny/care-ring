/**
 * LocationSmoothingEngine.ts
 *
 * Visual and Positional Smoothing Engine for Live User Locations.
 *
 * Implements a strict multi-stage visual pipeline:
 * REAL LOCATION (untouched by this engine)
 *     ↓
 * Location validation & filtering (accuracy check, noise deadband, outlier/spike rejection)
 *     ↓
 * Smoothed target location (speed & activity-aware, interval-aware duration calculation)
 *     ↓
 * Visual interpolation (continuous easing, mid-flight retargeting, 0°/360° heading wraparound)
 *     ↓
 * Map marker
 *
 * This engine operates strictly on the VISUAL representation of locations.
 * Real GPS coordinates for activity detection, safety detection, and backend telemetry
 * remain completely independent and unmodified.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type MovementActivity =
  | 'STATIONARY'
  | 'WALKING'
  | 'RUNNING'
  | 'CYCLING'
  | 'DRIVING'
  | 'RIDING'
  | 'UNKNOWN';

export interface LocationInput {
  memberId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number; // km/h
  accuracy?: number; // meters
  timestamp?: number; // epoch ms
  activity?: string;
  now?: number; // Animation reference clock (ms)
}

export interface SmoothedTargetResult {
  accepted: boolean;
  isOutlier: boolean;
  targetPosition: LatLng;
  targetHeading: number;
  durationMs: number;
  reason: string;
}

export interface ActiveVisualTrack {
  memberId: string;
  startPos: LatLng;
  targetPos: LatLng;
  currentPos: LatLng;
  startHeading: number;
  targetHeading: number;
  currentHeading: number;
  startTime: number;
  durationMs: number;
  lastUpdateTimestamp: number;
  lastConfirmedPos: LatLng;
  lastReportedSpeed: number;
  lastReportedAccuracy: number;
  activity: MovementActivity;
  consecutiveSpikes: number;
  lastSpikeCandidate?: LatLng;
  rafId?: number;
}

export type OnVisualStepCallback = (
  memberId: string,
  position: LatLng,
  heading: number,
  isComplete: boolean
) => void;

/**
 * Calculates great-circle distance between two coordinates in meters using the Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
}

/**
 * Calculates the shortest angular delta between two headings (-180° to +180°),
 * properly wrapping across the 0°/360° meridian.
 * Example:
 * 359° -> 1° returns +2° (not -358°)
 * 1° -> 359° returns -2° (not +358°)
 */
export function getShortestAngleDelta(fromAngle: number, toAngle: number): number {
  let delta = (toAngle - fromAngle) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/**
 * Normalizes an angle into the [0, 360) range.
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * Normalizes raw activity string to standard MovementActivity
 */
export function normalizeActivity(act?: string): MovementActivity {
  if (!act) return 'UNKNOWN';
  const upper = act.toUpperCase();
  if (upper === 'STATIONARY' || upper === 'STILL') return 'STATIONARY';
  if (upper === 'WALKING' || upper === 'ON_FOOT') return 'WALKING';
  if (upper === 'RUNNING') return 'RUNNING';
  if (upper === 'CYCLING' || upper === 'ON_BICYCLE') return 'CYCLING';
  if (upper === 'DRIVING' || upper === 'IN_VEHICLE' || upper === 'HIGH_SPEED') return 'DRIVING';
  if (upper === 'RIDING') return 'RIDING';
  return 'UNKNOWN';
}

export class LocationSmoothingEngine {
  private tracks = new Map<string, ActiveVisualTrack>();
  private onStep?: OnVisualStepCallback;

  constructor(onStep?: OnVisualStepCallback) {
    this.onStep = onStep;
  }

  /**
   * Evaluates an incoming raw GPS update, validates accuracy, checks for GPS drift/noise
   * and outlier spikes, computes the smoothed target coordinate and optimal animation duration,
   * and retargets visual interpolation without animation queue buildup or snapping.
   */
  public processUpdate(input: LocationInput): SmoothedTargetResult {
    const {
      memberId,
      latitude,
      longitude,
      heading = 0,
      speed = 0,
      accuracy = 10,
      timestamp = Date.now(),
      activity: rawAct,
    } = input;

    // Sanitize numerical inputs
    if (
      isNaN(latitude) ||
      isNaN(longitude) ||
      !isFinite(latitude) ||
      !isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return {
        accepted: false,
        isOutlier: true,
        targetPosition: { latitude: 0, longitude: 0 },
        targetHeading: 0,
        durationMs: 0,
        reason: 'MALFORMED_COORDINATES',
      };
    }

    const safeSpeed = isNaN(speed) || !isFinite(speed) || speed < 0 ? 0 : speed;
    const safeAccuracy = isNaN(accuracy) || !isFinite(accuracy) || accuracy < 0 ? 15 : accuracy;
    const safeHeading = isNaN(heading) || !isFinite(heading) ? 0 : normalizeAngle(heading);
    const activity = normalizeActivity(rawAct);

    const now = input.now !== undefined ? input.now : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const candidatePos: LatLng = { latitude, longitude };

    let track = this.tracks.get(memberId);

    // Initial fix for this member: register position directly without animation delay
    if (!track) {
      const initialTrack: ActiveVisualTrack = {
        memberId,
        startPos: candidatePos,
        targetPos: candidatePos,
        currentPos: candidatePos,
        startHeading: safeHeading,
        targetHeading: safeHeading,
        currentHeading: safeHeading,
        startTime: now,
        durationMs: 0,
        lastUpdateTimestamp: timestamp,
        lastConfirmedPos: candidatePos,
        lastReportedSpeed: safeSpeed,
        lastReportedAccuracy: safeAccuracy,
        activity,
        consecutiveSpikes: 0,
      };
      this.tracks.set(memberId, initialTrack);
      this.onStep?.(memberId, candidatePos, safeHeading, true);
      return {
        accepted: true,
        isOutlier: false,
        targetPosition: candidatePos,
        targetHeading: safeHeading,
        durationMs: 0,
        reason: 'INITIAL_FIX',
      };
    }

    // 1. Compute current interpolated state (retargeting origin)
    const currentSample = this.sample(memberId, now);
    const retargetStartPos = currentSample ? currentSample.position : track.currentPos;
    const retargetStartHeading = currentSample ? currentSample.heading : track.currentHeading;

    // 2. Compute physical displacement and elapsed time
    const distanceMeters = haversineDistanceMeters(
      track.lastConfirmedPos.latitude,
      track.lastConfirmedPos.longitude,
      candidatePos.latitude,
      candidatePos.longitude
    );

    const rawDtSeconds = (timestamp - track.lastUpdateTimestamp) / 1000;
    // Guard against negative, zero, or missing time deltas
    const dtSeconds = rawDtSeconds > 0 ? Math.min(rawDtSeconds, 60) : 1.0;

    // 3. Outlier / GPS Spike Protection (Requirement 9)
    // Physical maximum speeds (m/s) per activity
    let maxPlausibleMps: number;
    switch (activity) {
      case 'STATIONARY':
        maxPlausibleMps = 9.0; // ~32.4 km/h max plausible sudden displacement if just started
        break;
      case 'WALKING':
        maxPlausibleMps = 8.5; // ~30.6 km/h max human sprint burst
        break;
      case 'RUNNING':
        maxPlausibleMps = 14.0; // ~50.4 km/h
        break;
      case 'CYCLING':
        maxPlausibleMps = 25.0; // ~90 km/h
        break;
      case 'DRIVING':
      case 'RIDING':
        maxPlausibleMps = 65.0; // ~234 km/h
        break;
      default:
        maxPlausibleMps = 45.0;
        break;
    }

    const impliedMps = dtSeconds > 0 ? distanceMeters / dtSeconds : 0;
    const isImplausibleJump =
      impliedMps > maxPlausibleMps &&
      distanceMeters > 35 &&
      (activity === 'STATIONARY' || activity === 'WALKING' || impliedMps > 80);

    if (isImplausibleJump) {
      track.consecutiveSpikes++;
      track.lastSpikeCandidate = candidatePos;

      // If this is an isolated spike, reject immediately to avoid large visual teleportation
      if (track.consecutiveSpikes === 1) {
        return {
          accepted: false,
          isOutlier: true,
          targetPosition: track.currentPos,
          targetHeading: track.currentHeading,
          durationMs: 0,
          reason: `OUTLIER_SPIKE_REJECTED (${Math.round(distanceMeters)}m in ${dtSeconds.toFixed(1)}s, ${Math.round(impliedMps * 3.6)}km/h for ${activity})`,
        };
      }
      // If two consecutive updates occur at the new location, accept as true teleportation / location recovery
    } else {
      track.consecutiveSpikes = 0;
      track.lastSpikeCandidate = undefined;
    }

    // 4. GPS Accuracy Filtering & Noise Deadband (Requirements 4, 5, 8)
    // Determine noise deadband radius based on activity state
    let deadbandMeters = 1.5;
    if (activity === 'STATIONARY') {
      // Prevent GPS drift while stationary from causing the marker to shake or jitter
      deadbandMeters = Math.max(5.0, Math.min(16.0, safeAccuracy * 0.55));
    } else if (activity === 'WALKING') {
      deadbandMeters = Math.max(1.5, Math.min(4.5, safeAccuracy * 0.25));
    } else if (activity === 'RUNNING') {
      deadbandMeters = 2.0;
    } else if (activity === 'CYCLING') {
      deadbandMeters = 2.5;
    } else if (activity === 'DRIVING' || activity === 'RIDING') {
      deadbandMeters = safeSpeed > 15 ? 0.8 : 2.0;
    }

    // If movement is within noise deadband, suppress positional jump
    if (distanceMeters < deadbandMeters) {
      // Only smooth heading if heading changed significantly (e.g. > 4°)
      const deltaH = Math.abs(getShortestAngleDelta(retargetStartHeading, safeHeading));
      if (deltaH > 4) {
        this.retarget(track, retargetStartPos, retargetStartPos, retargetStartHeading, safeHeading, 600, now);
      }
      return {
        accepted: true,
        isOutlier: false,
        targetPosition: track.currentPos,
        targetHeading: safeHeading,
        durationMs: 0,
        reason: `NOISE_DEADBAND_SUPPRESSED (${distanceMeters.toFixed(1)}m < ${deadbandMeters.toFixed(1)}m)`,
      };
    }

    // 5. Accuracy-Weighted Position Correction (Requirement 5)
    // When accuracy degrades (e.g. 40m - 90m), do not perform huge visual jumps.
    // Instead, blend smoothly towards the new coordinate.
    let targetPos = candidatePos;
    if (safeAccuracy > 30) {
      const confidenceWeight = Math.max(0.25, Math.min(0.85, 25 / safeAccuracy));
      targetPos = {
        latitude:
          retargetStartPos.latitude +
          (candidatePos.latitude - retargetStartPos.latitude) * confidenceWeight,
        longitude:
          retargetStartPos.longitude +
          (candidatePos.longitude - retargetStartPos.longitude) * confidenceWeight,
      };
    }

    // 6. Dynamic Duration Calculation (Requirements 2, 3, 6, 8)
    // Scale animation duration based on update interval dt and speed
    let durationMs: number;
    const intervalMs = rawDtSeconds > 0 ? rawDtSeconds * 1000 : 1200;

    if (activity === 'DRIVING' || activity === 'RIDING') {
      // Driving requires responsive movement that does not lag far behind the vehicle
      if (safeSpeed > 50) {
        durationMs = Math.min(intervalMs * 0.95, 1100);
      } else {
        durationMs = Math.min(intervalMs * 1.05, 1400);
      }
      durationMs = Math.max(durationMs, 500);
    } else if (activity === 'WALKING' || activity === 'RUNNING') {
      // Avoid excessive floaty interpolation for walking
      durationMs = Math.min(intervalMs * 1.05, 2000);
      durationMs = Math.max(durationMs, 800);
    } else if (activity === 'STATIONARY') {
      // Gentle, subtle drift when stationary position actually shifts
      durationMs = Math.min(intervalMs * 0.8, 1200);
      durationMs = Math.max(durationMs, 600);
    } else {
      durationMs = Math.min(intervalMs * 1.0, 2200);
      durationMs = Math.max(durationMs, 700);
    }

    // 7. Bearing / Heading Wraparound (Requirement 7)
    // Calculate shortest angular delta to prevent 358° reverse rotations
    const shortestDelta = getShortestAngleDelta(retargetStartHeading, safeHeading);
    const targetAdjustedHeading = retargetStartHeading + shortestDelta;

    // Update track metadata
    track.lastConfirmedPos = candidatePos;
    track.lastUpdateTimestamp = timestamp;
    track.lastReportedSpeed = safeSpeed;
    track.lastReportedAccuracy = safeAccuracy;
    track.activity = activity;

    // 8. Execute Smooth Retargeting (Requirement 3)
    this.retarget(
      track,
      retargetStartPos,
      targetPos,
      retargetStartHeading,
      targetAdjustedHeading,
      durationMs,
      now
    );

    return {
      accepted: true,
      isOutlier: false,
      targetPosition: targetPos,
      targetHeading: normalizeAngle(targetAdjustedHeading),
      durationMs,
      reason: 'RETARGETED_SMOOTHLY',
    };
  }

  /**
   * Smoothly retargets an active animation without interrupting progress or snapping.
   */
  private retarget(
    track: ActiveVisualTrack,
    startPos: LatLng,
    targetPos: LatLng,
    startHeading: number,
    targetHeading: number,
    durationMs: number,
    now: number
  ): void {
    if (track.rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(track.rafId);
      track.rafId = undefined;
    }

    track.startPos = startPos;
    track.targetPos = targetPos;
    track.currentPos = startPos;
    track.startHeading = startHeading;
    track.targetHeading = targetHeading;
    track.currentHeading = startHeading;
    track.startTime = now;
    track.durationMs = durationMs;

    // If RAF is available (in browser/WebView or React Native JS), run smooth loop
    if (typeof requestAnimationFrame !== 'undefined') {
      const step = () => {
        const currentTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const sample = this.sample(track.memberId, currentTime);
        if (!sample) return;

        this.onStep?.(track.memberId, sample.position, sample.heading, sample.isComplete);

        if (!sample.isComplete) {
          track.rafId = requestAnimationFrame(step);
        } else {
          track.rafId = undefined;
        }
      };
      track.rafId = requestAnimationFrame(step);
    }
  }

  /**
   * Samples the current interpolated position and heading at a specific timestamp.
   * Useful for unit testing, RAF loop stepping, and mid-flight retargeting.
   */
  public sample(
    memberId: string,
    sampleTime: number
  ): { position: LatLng; heading: number; isComplete: boolean; progress: number } | null {
    const track = this.tracks.get(memberId);
    if (!track) return null;

    if (track.durationMs <= 0) {
      track.currentPos = track.targetPos;
      track.currentHeading = normalizeAngle(track.targetHeading);
      return {
        position: track.currentPos,
        heading: track.currentHeading,
        isComplete: true,
        progress: 1.0,
      };
    }

    const elapsed = Math.max(0, sampleTime - track.startTime);
    const rawProgress = Math.min(1.0, elapsed / track.durationMs);

    // Easing selection:
    // Continuous movement with high speed benefits from subtle quadratic ease (maintains momentum)
    // Stopping or low speed uses smooth cubic ease-out
    let easedT: number;
    if (track.lastReportedSpeed > 15) {
      // Quadratic ease: t * (2 - t)
      easedT = rawProgress * (2 - rawProgress);
    } else {
      // Cubic ease-out: 1 - (1 - t)^3
      easedT = 1 - Math.pow(1 - rawProgress, 3);
    }

    const lat =
      track.startPos.latitude + (track.targetPos.latitude - track.startPos.latitude) * easedT;
    const lng =
      track.startPos.longitude + (track.targetPos.longitude - track.startPos.longitude) * easedT;

    const interpolatedHeading = normalizeAngle(
      track.startHeading + (track.targetHeading - track.startHeading) * easedT
    );

    track.currentPos = { latitude: lat, longitude: lng };
    track.currentHeading = interpolatedHeading;

    return {
      position: track.currentPos,
      heading: interpolatedHeading,
      isComplete: rawProgress >= 1.0,
      progress: rawProgress,
    };
  }

  public getCurrentPosition(memberId: string): LatLng | undefined {
    return this.tracks.get(memberId)?.currentPos;
  }

  public getCurrentHeading(memberId: string): number | undefined {
    return this.tracks.get(memberId)?.currentHeading;
  }

  public getTrack(memberId: string): ActiveVisualTrack | undefined {
    return this.tracks.get(memberId);
  }

  public reset(memberId?: string): void {
    if (memberId) {
      const track = this.tracks.get(memberId);
      if (track && track.rafId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(track.rafId);
      }
      this.tracks.delete(memberId);
    } else {
      for (const track of this.tracks.values()) {
        if (track.rafId && typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(track.rafId);
        }
      }
      this.tracks.clear();
    }
  }

  public dispose(): void {
    this.reset();
  }
}
