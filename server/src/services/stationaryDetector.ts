import { StationaryAnchor } from '../types';
import { reverseGeocode } from './geocodingService';

/**
 * Computes Haversine distance in meters between two lat/lng coordinates
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class StationaryDetector {
  private anchors: Map<string, StationaryAnchor> = new Map();

  // Configurable thresholds: 50 meters radius and 3 minutes (180,000 ms)
  private readonly radiusMeters: number;
  private readonly durationThresholdMs: number;

  public onAddressResolved?: (userId: string, address: string, lat: number, lng: number) => void;

  constructor(
    radiusMeters: number = parseInt(process.env.STATIONARY_RADIUS_METERS || '50', 10),
    durationThresholdMs: number = parseInt(process.env.STATIONARY_DURATION_THRESHOLD_MS || '180000', 10)
  ) {
    this.radiusMeters = radiusMeters;
    this.durationThresholdMs = durationThresholdMs;
  }

  /**
   * Processes a telemetry ping and applies stationary rate-limiting for reverse geocoding.
   * Only queries the geocoding provider when a user has been within a 50m radius for > 3 minutes.
   * NON-BLOCKING: Returns stationary state in 0ms so location broadcasts are never delayed.
   */
  public processLocation(
    userId: string,
    lat: number,
    lng: number,
    speed: number = 0,
    activity?: string,
    now: number = Date.now()
  ): {
    isStationary: boolean;
    stationaryDurationMs: number;
    resolvedAddress: string | null;
    justResolved: boolean;
    snappedLat: number;
    snappedLng: number;
  } {
    const normAct = activity ? activity.trim().toLowerCase() : undefined;
    const isExplicitlyStationary = normAct === 'stationary' || normAct === 'still';
    const isReportedMoving = Boolean(
      normAct && ['walking', 'running', 'cycling', 'driving', 'riding', 'high_speed'].includes(normAct)
    );
    const isSenderMoving = Boolean(isReportedMoving || speed >= 1.8);
    let anchor = this.anchors.get(userId);

    // If sender is moving, check if they moved away from the anchor or are traveling
    if (isSenderMoving) {
      if (anchor) {
        const distance = calculateHaversineDistance(anchor.lat, anchor.lng, lat, lng);
        if (distance > this.radiusMeters || speed >= 3.6 || isReportedMoving) {
          // User has left the 50m radius or is traveling -> clear anchor so it never stays stale
          this.anchors.delete(userId);
        } else {
          // In immediate vicinity of previous anchor but currently moving: reset anchorStartTime
          anchor.anchorStartTime = now;
          anchor.lastPingTime = now;
        }
      }
      return {
        isStationary: false,
        stationaryDurationMs: 0,
        resolvedAddress: null,
        justResolved: false,
        snappedLat: lat,
        snappedLng: lng,
      };
    }

    // Sender is stopped (activity === 'stationary' or speed < 1.8 km/h without active movement)
    if (!anchor) {
      anchor = {
        userId,
        lat,
        lng,
        anchorStartTime: now,
        lastPingTime: now,
        isResolved: false,
        isResolving: false,
      };
      this.anchors.set(userId, anchor);

      return {
        isStationary: true,
        stationaryDurationMs: 0,
        resolvedAddress: null,
        justResolved: false,
        snappedLat: lat,
        snappedLng: lng,
      };
    }

    const distance = calculateHaversineDistance(anchor.lat, anchor.lng, lat, lng);
    anchor.lastPingTime = now;

    if (distance > this.radiusMeters) {
      // User stopped at a NEW location > 50m away -> reset anchor to new stop position
      anchor = {
        userId,
        lat,
        lng,
        anchorStartTime: now,
        lastPingTime: now,
        isResolved: false,
        isResolving: false,
      };
      this.anchors.set(userId, anchor);

      return {
        isStationary: true,
        stationaryDurationMs: 0,
        resolvedAddress: null,
        justResolved: false,
        snappedLat: lat,
        snappedLng: lng,
      };
    }

    // User is within 50m stationary anchor
    const stationaryDurationMs = Math.max(0, now - anchor.anchorStartTime);

    // Trigger reverse geocoding if stopped for >= durationThresholdMs (3 min)
    if (stationaryDurationMs >= this.durationThresholdMs) {
      if (!anchor.isResolved && !anchor.isResolving) {
        anchor.isResolving = true;
        reverseGeocode(anchor.lat, anchor.lng)
          .then((address) => {
            if (anchor) {
              anchor.isResolved = true;
              anchor.isResolving = false;
              anchor.cachedAddress = address;
            }
            this.onAddressResolved?.(userId, address, anchor.lat, anchor.lng);
          })
          .catch(() => {
            if (anchor) anchor.isResolving = false;
          });
      }
    }

    // If speed is below walking threshold (< 1.8 km/h) and not actively moving, user is stationary!
    // Latch coordinates to the anchor to eliminate GPS jitter and false movement on the map.
    const isStationary = !isReportedMoving && (speed < 1.8 || isExplicitlyStationary);

    return {
      isStationary,
      stationaryDurationMs,
      resolvedAddress: anchor.cachedAddress || null,
      justResolved: false,
      snappedLat: isStationary ? anchor.lat : lat,
      snappedLng: isStationary ? anchor.lng : lng,
    };
  }

  public getAnchor(userId: string): StationaryAnchor | undefined {
    return this.anchors.get(userId);
  }

  public clear(userId: string): void {
    this.anchors.delete(userId);
  }
}

export const stationaryDetector = new StationaryDetector();
