/**
 * Activity Scorer: Multi-Signal Evidence Accumulator
 * Implements Section 11 - 16 of Smart Activity Detection.
 */

import {
  ActivityPrediction,
  ActivityType,
  GpsFeatures,
  MotionFeatures,
  OsActivityType,
} from './types';

export class ActivityScorer {
  /**
   * Scores each candidate activity based on GPS, motion sensors, OS hints, and previous context.
   * Produces an ActivityPrediction containing activity, confidence, evidence strings, and breakdown.
   */
  public score(
    gps: GpsFeatures | null,
    motion: MotionFeatures | null,
    osActivity: OsActivityType,
    previousActivity: ActivityType
  ): ActivityPrediction {
    const scores: Record<ActivityType, number> = {
      STATIONARY: 0,
      WALKING: 0,
      RUNNING: 0,
      CYCLING: 0,
      DRIVING: 0,
      RIDING: 0,
      UNKNOWN: 0.1,
    };

    const evidenceMap: Record<ActivityType, string[]> = {
      STATIONARY: [],
      WALKING: [],
      RUNNING: [],
      CYCLING: [],
      DRIVING: [],
      RIDING: [],
      UNKNOWN: [],
    };

    const speed = gps?.smoothedSpeed ?? 0;
    const rawSpeed = gps?.rawSpeed ?? 0;
    const accel = gps?.acceleration ?? 0;
    const accuracyScore = gps?.accuracyScore ?? 0.5;
    const hasMotion = motion?.hasMotionData ?? false;
    const cadence = motion?.estimatedCadence ?? 0;
    const energy = motion?.energy ?? 0;
    const isStepLike = motion?.isStepLike ?? false;
    const leanVar = motion?.leanVariance ?? 0;
    const gyroEnergy = motion?.gyroEnergy ?? 0;

    // =========================================================================
    // 1. STATIONARY SCORING
    // =========================================================================
    if (speed < 1.8 || rawSpeed < 1.0) {
      let stationaryScore = 0.85;
      evidenceMap.STATIONARY.push(
        speed < 1.8
          ? 'GPS speed below movement threshold (< 1.8 km/h)'
          : 'Instantaneous GPS reports stop/stillness (0 km/h)'
      );

      if (hasMotion && energy < 0.02 && cadence === 0) {
        stationaryScore += 0.15;
        evidenceMap.STATIONARY.push('Motion sensors indicate device stillness');
      }

      if (osActivity === 'STILL') {
        stationaryScore += 0.15;
        evidenceMap.STATIONARY.push('OS activity reports STILL');
      }

      scores.STATIONARY = Math.min(0.99, stationaryScore * accuracyScore);
    }

    // =========================================================================
    // 2. WALKING SCORING
    // =========================================================================
    if (speed >= 1.5 && speed <= 8.5) {
      let walkScore = 0.25;

      if (speed >= 2.0 && speed <= 6.5) {
        walkScore += 0.35;
        evidenceMap.WALKING.push(`Human walking speed window (${speed.toFixed(1)} km/h)`);
      }

      if (hasMotion) {
        if (isStepLike && cadence >= 75 && cadence <= 135) {
          walkScore += 0.45;
          evidenceMap.WALKING.push(`Pedestrian cadence detected (~${cadence} steps/min)`);
        } else if (cadence === 0 || !isStepLike) {
          // In a vehicle or rolling, no steps -> penalize walking
          walkScore -= 0.45;
        }
      }

      if (osActivity === 'WALKING' || osActivity === 'ON_FOOT') {
        walkScore += 0.40;
        evidenceMap.WALKING.push('OS activity indicates pedestrian/walking');
      }

      // Accelerating vehicle ramp must NOT be classified as walking
      if (accel > 0.6 && (speed > 5.0 || rawSpeed > 6.0)) {
        walkScore = 0.05;
      }

      // If previously driving, traffic slow-downs must NOT switch to walking without clear steps!
      if (previousActivity === 'DRIVING' || previousActivity === 'RIDING') {
        if (!isStepLike || cadence < 80) {
          walkScore = 0.05; // strongly suppress false walking in traffic jams
        }
      }

      scores.WALKING = Math.max(0, Math.min(0.95, walkScore * (hasMotion ? 1.0 : accuracyScore * 0.8)));
    }

    // =========================================================================
    // 3. RUNNING SCORING
    // =========================================================================
    if (speed >= 6.5 && speed <= 22.0) {
      let runScore = 0.15;

      if (speed >= 8.0 && speed <= 16.0) {
        runScore += 0.3;
        evidenceMap.RUNNING.push(`Running pace speed window (${speed.toFixed(1)} km/h)`);
      }

      if (hasMotion && isStepLike && cadence > 135) {
        runScore += 0.55;
        evidenceMap.RUNNING.push(`High running cadence detected (~${cadence} steps/min)`);
      }

      if (osActivity === 'RUNNING') {
        runScore += 0.45;
        evidenceMap.RUNNING.push('OS activity indicates RUNNING');
      }

      if (hasMotion && !isStepLike) {
        runScore -= 0.5;
      }

      scores.RUNNING = Math.max(0, Math.min(0.95, runScore));
    }

    // =========================================================================
    // 4. CYCLING SCORING
    // =========================================================================
    if (speed >= 8.0 && speed <= 35.0) {
      let cycleScore = 0.2;

      if (speed >= 12.0 && speed <= 26.0) {
        cycleScore += 0.35;
        evidenceMap.CYCLING.push(`Bicycle speed window (${speed.toFixed(1)} km/h)`);
      }

      if (hasMotion && !isStepLike && energy > 0.02 && energy < 0.15) {
        cycleScore += 0.25;
        evidenceMap.CYCLING.push('Smooth pedaling acceleration profile');
      }

      if (osActivity === 'ON_BICYCLE') {
        cycleScore += 0.55;
        evidenceMap.CYCLING.push('OS activity confirms ON_BICYCLE');
      }

      // If acceleration is rapid vehicle ramp without bicycle OS hint, penalize cycling
      if (accel > 0.7 && speed > 15.0 && osActivity !== 'ON_BICYCLE') {
        cycleScore *= 0.4;
      }

      scores.CYCLING = Math.max(0, Math.min(0.92, cycleScore * accuracyScore));
    }

    // =========================================================================
    // 5. MOTORCYCLE / RIDING SCORING
    // =========================================================================
    let rideScore = 0.0;
    if (speed >= 10.0 || rawSpeed >= 12.0) {
      // Motorcycle characteristics: lean dynamic tilt and gyro rotational energy
      if (hasMotion && (leanVar > 0.035 || gyroEnergy > 0.035)) {
        rideScore += 0.85;
        evidenceMap.RIDING.push('Significant lateral lean and rotational dynamics');
        if (leanVar > 0.06 || gyroEnergy > 0.08) {
          rideScore += 0.12;
        }
      }

      if (accel > 1.8) {
        rideScore += 0.25;
        evidenceMap.RIDING.push(`Motorcycle-characteristic acceleration burst (${accel.toFixed(1)} m/s²)`);
      }

      if (previousActivity === 'RIDING' && (speed >= 10.0 || rawSpeed >= 10.0)) {
        rideScore += 0.40;
        evidenceMap.RIDING.push('Continuity with previous confirmed RIDING session');
      }

      scores.RIDING = Math.max(0, Math.min(0.98, rideScore));
    }

    // =========================================================================
    // 6. DRIVING SCORING
    // =========================================================================
    let driveScore = 0.0;

    // Speeds and acceleration ramps
    if (rawSpeed >= 1.0) {
      if (speed >= 35.0 || rawSpeed >= 40.0) {
        driveScore += 0.75;
        evidenceMap.DRIVING.push(`Sustained vehicle speed (${speed.toFixed(1)} km/h)`);
        if (speed >= 50.0 || rawSpeed >= 50.0) {
          driveScore += 0.20;
          evidenceMap.DRIVING.push('Expressway/arterial vehicle speed');
        }
      } else if (speed >= 18.0 || rawSpeed >= 20.0) {
        driveScore += 0.55;
        evidenceMap.DRIVING.push(`City driving speed (${speed.toFixed(1)} km/h)`);
      } else if (speed >= 2.0 && (gps?.speedTrend === 'ACCELERATING' || accel > 0.4)) {
        // Car starting phase (Test 1: 0 -> 3 -> 7 -> 12 -> 25 -> 50 km/h)
        driveScore += 0.60;
        evidenceMap.DRIVING.push(`Vehicle-like smooth acceleration ramp (${accel.toFixed(1)} m/s²)`);
      }
    }

    if (osActivity === 'IN_VEHICLE') {
      driveScore += 0.45;
      evidenceMap.DRIVING.push('OS activity confirms automotive IN_VEHICLE');
    }

    if (hasMotion && !isStepLike) {
      driveScore += 0.20;
      evidenceMap.DRIVING.push('Automotive vibration signature');
    }

    // Traffic jam crawl hysteresis: if previously DRIVING, speed 1.5 - 25 km/h keeps driving high
    if (previousActivity === 'DRIVING') {
      if (rawSpeed >= 1.5 && speed < 25.0 && (!hasMotion || !isStepLike)) {
        driveScore = Math.max(driveScore, 0.90);
        evidenceMap.DRIVING.push('Previous confirmed DRIVING in traffic context');
      }
    }

    // If motorcycle lean dynamics are clearly detected, penalize four-wheeled driving
    if (rideScore >= 0.80) {
      driveScore *= 0.4;
    }

    scores.DRIVING = Math.max(0, Math.min(0.98, driveScore * Math.max(0.6, accuracyScore)));

    // =========================================================================
    // 7. PICK WINNING PREDICTION
    // =========================================================================
    let winningActivity: ActivityType = 'UNKNOWN';
    let highestScore = 0;

    const activities: ActivityType[] = [
      'STATIONARY',
      'WALKING',
      'RUNNING',
      'CYCLING',
      'DRIVING',
      'RIDING',
    ];

    for (const act of activities) {
      if (scores[act] > highestScore) {
        highestScore = scores[act];
        winningActivity = act;
      }
    }

    if (highestScore < 0.4) {
      winningActivity = 'UNKNOWN';
      highestScore = 0.3;
      evidenceMap.UNKNOWN.push('Insufficient signals for reliable classification');
    }

    return {
      activity: winningActivity,
      confidence: Math.round(highestScore * 100) / 100,
      evidence: evidenceMap[winningActivity] || [],
      scores,
    };
  }
}
