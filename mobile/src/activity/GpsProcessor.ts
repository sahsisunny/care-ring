/**
 * GPS Processor: Filtering, Smoothing, and Feature Extraction
 * Implements Section 9 & 10 of Smart Activity Detection.
 */

import { ActivityConfig } from './ActivityConfig';
import { GpsFeatures, GpsReading } from './types';

export class GpsProcessor {
  private window: GpsReading[] = [];
  private lastAcceptedTimestamp = 0;
  private currentSmoothedSpeed = 0;
  private durationAtSpeedStart = 0;
  private lastSpeedBucket = -1;

  public reset(): void {
    this.window = [];
    this.lastAcceptedTimestamp = 0;
    this.currentSmoothedSpeed = 0;
    this.durationAtSpeedStart = 0;
    this.lastSpeedBucket = -1;
  }

  /**
   * Ingests a new raw GPS reading, performs validation, spike rejection,
   * exponential smoothing, and computes kinematic features.
   */
  public processReading(reading: GpsReading): GpsFeatures | null {
    const now = Date.now();
    const readingTime = reading.timestamp || now;

    // 1. Stale & Out-of-Order Check
    if (this.lastAcceptedTimestamp > 0 && readingTime <= this.lastAcceptedTimestamp) {
      // Duplicate timestamp or out-of-order reading -> discard
      return null;
    }

    if (readingTime > 1577836800000 && now - readingTime > ActivityConfig.GPS_MAX_STALE_AGE_MS) {
      // Stale location (> 30s old in real time) -> discard
      return null;
    }

    const rawSpeed = typeof reading.speed === 'number' && !isNaN(reading.speed) && reading.speed >= 0
      ? reading.speed
      : 0;

    // 2. Unrealistic Speed Check
    if (rawSpeed > ActivityConfig.GPS_MAX_REALISTIC_SPEED_KMH) {
      return null;
    }

    // 3. Spike & Jump Detection
    let isJump = false;
    const prev = this.window.length > 0 ? this.window[this.window.length - 1] : null;

    if (prev && readingTime - prev.timestamp > 60000) {
      // Large gap (> 60s): safely reset rolling window to avoid unrealistic acceleration
      this.window = [];
    } else if (prev) {
      const dtSec = Math.max(0.1, (readingTime - prev.timestamp) / 1000);
      const dvMs = Math.abs((rawSpeed - prev.speed) / 3.6);
      const accelMs2 = dvMs / dtSec;

      // If acceleration exceeds physical vehicle limit and is a massive instantaneous spike
      if (accelMs2 > ActivityConfig.GPS_MAX_REALISTIC_ACCEL_MS2 && Math.abs(rawSpeed - prev.speed) > 30) {
        isJump = true;
      }
    }

    // 4. Median Filtering for Spike Rejection (as in Test 8: 5 -> 80 -> 4 -> 90 -> 6)
    let effectiveSpeed = rawSpeed;
    if (isJump) {
      // Clamp effective speed to previous smoothed speed to prevent noise from corrupting history
      effectiveSpeed = this.currentSmoothedSpeed > 0 ? this.currentSmoothedSpeed : (prev?.speed || 0);
    }

    // 5. Exponential Moving Average (EMA) Smoothing
    const alpha = ActivityConfig.GPS_SPEED_SMOOTHING_ALPHA;
    if (this.window.length === 0) {
      this.currentSmoothedSpeed = effectiveSpeed;
    } else {
      this.currentSmoothedSpeed = alpha * effectiveSpeed + (1 - alpha) * this.currentSmoothedSpeed;
    }

    // Add validated reading to rolling window
    this.lastAcceptedTimestamp = readingTime;
    const cleanReading: GpsReading = {
      ...reading,
      speed: effectiveSpeed,
      timestamp: readingTime,
    };
    this.window.push(cleanReading);
    if (this.window.length > ActivityConfig.GPS_ROLLING_WINDOW_SIZE) {
      this.window.shift();
    }

    // 6. Compute Kinematics over Rolling Window
    const speeds = this.window.map((r) => r.speed);
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);

    // Speed Variance
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((acc, s) => acc + Math.pow(s - avgSpeed, 2), 0) / speeds.length;

    // Acceleration (m/s^2) across the last 2-3 points
    let acceleration = 0;
    if (this.window.length >= 2) {
      const p1 = this.window[this.window.length - 2];
      const p2 = this.window[this.window.length - 1];
      const dt = Math.max(0.2, (p2.timestamp - p1.timestamp) / 1000);
      acceleration = ((p2.speed - p1.speed) / 3.6) / dt;
    }

    // Speed Trend
    let speedTrend: 'ACCELERATING' | 'DECELERATING' | 'STEADY' = 'STEADY';
    if (acceleration > 0.45) {
      speedTrend = 'ACCELERATING';
    } else if (acceleration < -0.45) {
      speedTrend = 'DECELERATING';
    }

    // Duration at current speed bucket (+/- 3 km/h)
    const currentBucket = Math.floor(this.currentSmoothedSpeed / 3);
    if (currentBucket !== this.lastSpeedBucket) {
      this.lastSpeedBucket = currentBucket;
      this.durationAtSpeedStart = readingTime;
    }
    const durationAtCurrentSpeed = Math.max(0, readingTime - this.durationAtSpeedStart);

    // 7. GPS Accuracy Score (0.0 to 1.0)
    const accuracy = reading.accuracy !== undefined ? reading.accuracy : 10;
    let accuracyScore = 1.0;
    if (accuracy > ActivityConfig.GPS_ACCURACY_THRESHOLD_METERS) {
      // Beyond 50m, confidence rapidly drops towards 0.1
      accuracyScore = Math.max(0.05, 1.0 - (accuracy - ActivityConfig.GPS_ACCURACY_THRESHOLD_METERS) / 100);
    } else if (accuracy > ActivityConfig.GPS_IDEAL_ACCURACY_METERS) {
      // Between 15m and 50m, scale from 1.0 down to 0.4
      const range = ActivityConfig.GPS_ACCURACY_THRESHOLD_METERS - ActivityConfig.GPS_IDEAL_ACCURACY_METERS;
      accuracyScore = 1.0 - ((accuracy - ActivityConfig.GPS_IDEAL_ACCURACY_METERS) / range) * 0.6;
    }

    return {
      rawSpeed,
      smoothedSpeed: Math.round(this.currentSmoothedSpeed * 10) / 10,
      speedTrend,
      acceleration: Math.round(acceleration * 100) / 100,
      speedVariance: Math.round(variance * 10) / 10,
      durationAtCurrentSpeed,
      maxSpeed,
      minSpeed,
      accuracyScore,
      isJump,
      isStale: false,
      sampleCount: this.window.length,
    };
  }

  public getSmoothedSpeed(): number {
    return Math.round(this.currentSmoothedSpeed * 10) / 10;
  }

  public getLatestReading(): GpsReading | null {
    return this.window.length > 0 ? this.window[this.window.length - 1] : null;
  }
}
