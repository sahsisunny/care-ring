/**
 * Hard Braking Detector
 * Implements Section 5 & Section 27 (Test 3, 4, 9) of Safety Detection Layer.md
 */

import { GpsReading, MotionReading } from '../activity/types';
import { SafetyConfig } from './SafetyConfig';
import { DetectorResult, SafetySignalSource } from './types';

export class BrakingDetector {
  private history: { speed: number; timestamp: number }[] = [];
  private consecutiveCount = 0;
  private candidateStartTime = 0;
  private speedAtCandidateStart = 0;
  private maxDecelRecorded = 0;

  public reset(): void {
    this.history = [];
    this.consecutiveCount = 0;
    this.candidateStartTime = 0;
    this.speedAtCandidateStart = 0;
    this.maxDecelRecorded = 0;
  }

  public evaluate(
    gps: GpsReading,
    motion?: MotionReading | null,
    isVehicleActivity = true
  ): DetectorResult {
    // 1. Vehicle Context Guard (Section 10)
    if (!isVehicleActivity) {
      this.reset();
      return {
        detected: false,
        status: 'NONE',
        type: 'HARD_BRAKING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Vehicle context inactive'],
        sourceSignals: ['GPS'],
      };
    }

    const currentSpeed = Math.max(0, gps.speed);
    const currentTime = gps.timestamp || Date.now();

    // 2. Reject noisy GPS with poor accuracy (> 35m)
    if (gps.accuracy !== undefined && gps.accuracy > SafetyConfig.HARD_BRAKING_MAX_GPS_ACCURACY_M) {
      return {
        detected: false,
        status: 'NONE',
        type: 'HARD_BRAKING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['GPS accuracy too poor to evaluate braking reliably'],
        sourceSignals: ['GPS'],
      };
    }

    this.history.push({ speed: currentSpeed, timestamp: currentTime });
    if (this.history.length > 6) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      return {
        detected: false,
        status: 'NONE',
        type: 'HARD_BRAKING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Insufficient speed history points'],
        sourceSignals: ['GPS'],
      };
    }

    const prev = this.history[this.history.length - 2];
    const dt = Math.max(0.2, (currentTime - prev.timestamp) / 1000);
    const dvMs = (currentSpeed - prev.speed) / 3.6;
    const accelMs2 = dvMs / dt; // negative value for deceleration

    // Check motion sensor confirmation if available
    let motionAgrees = false;
    const sourceSignals: SafetySignalSource[] = ['GPS'];
    if (motion) {
      // Dynamic braking deceleration surge
      const dynamicMag = Math.abs(motion.magnitude - 1.0);
      if (dynamicMag > 0.3 || Math.abs(motion.y) > 0.35) {
        motionAgrees = true;
        sourceSignals.push('ACCELEROMETER');
      }
    }

    const threshold = SafetyConfig.HARD_BRAKING_THRESHOLD_MS2; // -3.5 m/s²
    const initialSpeed = this.consecutiveCount > 0 ? this.speedAtCandidateStart : prev.speed;

    // Reject slow stops (Section 5: Do not trigger when 5 km/h -> 0 km/h normal stopping)
    const hasMeaningfulSpeed = initialSpeed >= SafetyConfig.HARD_BRAKING_MIN_SPEED_KMH;

    if (accelMs2 <= threshold && hasMeaningfulSpeed) {
      if (this.consecutiveCount === 0) {
        this.candidateStartTime = prev.timestamp;
        this.speedAtCandidateStart = prev.speed;
        this.maxDecelRecorded = Math.abs(accelMs2);
      } else {
        this.maxDecelRecorded = Math.max(this.maxDecelRecorded, Math.abs(accelMs2));
      }

      this.consecutiveCount++;
      const duration = Math.max(0.5, (currentTime - this.candidateStartTime) / 1000);

      // Require multiple samples over time (Section 3 & Section 11)
      if (this.consecutiveCount >= SafetyConfig.HARD_BRAKING_MIN_SAMPLES) {
        const severity = this.maxDecelRecorded >= Math.abs(SafetyConfig.HARD_BRAKING_CRITICAL_MS2) ? 'HIGH' : 'MEDIUM';
        const confidence = Math.min(
          0.98,
          0.78 +
            Math.min(0.12, (this.maxDecelRecorded - Math.abs(threshold)) * 0.05) +
            (motionAgrees ? 0.08 : 0.02) +
            Math.min(0.06, this.consecutiveCount * 0.02)
        );

        return {
          detected: true,
          status: 'CONFIRMED',
          type: 'HARD_BRAKING',
          confidence: Math.round(confidence * 100) / 100,
          severity,
          magnitude: Math.round(this.maxDecelRecorded * 100) / 100,
          duration: Math.round(duration * 10) / 10,
          evidence: [
            `Deceleration -${this.maxDecelRecorded.toFixed(1)} m/s² exceeds ${threshold} m/s² threshold`,
            `Speed dropped from ${this.speedAtCandidateStart.toFixed(0)} to ${currentSpeed.toFixed(0)} km/h across ${this.consecutiveCount} samples`,
            motionAgrees ? 'Accelerometer confirms sudden negative pitch deceleration' : 'Kinematic speed derivative confirmed',
          ],
          sourceSignals,
          extra: {
            speedBefore: Math.round(this.speedAtCandidateStart),
            speedAfter: Math.round(currentSpeed),
            acceleration: -Math.round(this.maxDecelRecorded * 100) / 100,
          },
        };
      }

      return {
        detected: false,
        status: 'POTENTIAL',
        type: 'HARD_BRAKING',
        confidence: 0.55,
        severity: 'MEDIUM',
        magnitude: Math.round(Math.abs(accelMs2) * 100) / 100,
        duration,
        evidence: [`Potential hard braking observed (${accelMs2.toFixed(1)} m/s²), validating sample continuity`],
        sourceSignals,
      };
    } else {
      this.consecutiveCount = 0;
      return {
        detected: false,
        status: 'NONE',
        type: 'HARD_BRAKING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Braking within normal deceleration envelope'],
        sourceSignals: ['GPS'],
      };
    }
  }
}
