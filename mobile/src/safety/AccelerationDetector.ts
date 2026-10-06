/**
 * Rapid Acceleration Detector
 * Implements Section 4 & Section 27 (Test 1, 2) of Safety Detection Layer.md
 */

import { GpsReading, MotionReading } from '../activity/types';
import { SafetyConfig } from './SafetyConfig';
import { DetectorResult, SafetySignalSource } from './types';

export class AccelerationDetector {
  private history: { speed: number; timestamp: number }[] = [];
  private consecutiveCount = 0;
  private candidateStartTime = 0;
  private speedAtCandidateStart = 0;
  private maxAccelRecorded = 0;

  public reset(): void {
    this.history = [];
    this.consecutiveCount = 0;
    this.candidateStartTime = 0;
    this.speedAtCandidateStart = 0;
    this.maxAccelRecorded = 0;
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
        type: 'RAPID_ACCELERATION',
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

    // 2. Reject noisy GPS with poor accuracy (> 45m)
    if (gps.accuracy !== undefined && gps.accuracy > 45) {
      return {
        detected: false,
        status: 'NONE',
        type: 'RAPID_ACCELERATION',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['GPS accuracy too poor to evaluate acceleration reliably'],
        sourceSignals: ['GPS'],
      };
    }

    // Keep rolling history of last 6 points
    this.history.push({ speed: currentSpeed, timestamp: currentTime });
    if (this.history.length > 6) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      return {
        detected: false,
        status: 'NONE',
        type: 'RAPID_ACCELERATION',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Insufficient speed history points'],
        sourceSignals: ['GPS'],
      };
    }

    // Calculate kinematic acceleration across recent points
    const prev = this.history[this.history.length - 2];
    const dt = Math.max(0.2, (currentTime - prev.timestamp) / 1000);
    const dvMs = (currentSpeed - prev.speed) / 3.6;
    const accelMs2 = dvMs / dt;

    // Check motion sensor confirmation if available
    let motionAgrees = false;
    const sourceSignals: SafetySignalSource[] = ['GPS'];
    if (motion) {
      // Dynamic acceleration forward component
      const dynamicMag = Math.abs(motion.magnitude - 1.0);
      if (dynamicMag > 0.25 || Math.abs(motion.y) > 0.3) {
        motionAgrees = true;
        sourceSignals.push('ACCELEROMETER');
      }
    }

    const threshold = SafetyConfig.RAPID_ACCEL_THRESHOLD_MS2;

    if (accelMs2 >= threshold && currentSpeed >= SafetyConfig.RAPID_ACCEL_MIN_SPEED_KMH) {
      if (this.consecutiveCount === 0) {
        this.candidateStartTime = prev.timestamp;
        this.speedAtCandidateStart = prev.speed;
        this.maxAccelRecorded = accelMs2;
      } else {
        this.maxAccelRecorded = Math.max(this.maxAccelRecorded, accelMs2);
      }

      this.consecutiveCount++;
      const duration = Math.max(0.5, (currentTime - this.candidateStartTime) / 1000);

      // Require multiple samples over time (Section 3 critical rule: DO NOT detect using single GPS reading)
      if (this.consecutiveCount >= SafetyConfig.RAPID_ACCEL_MIN_SAMPLES) {
        const severity = this.maxAccelRecorded >= SafetyConfig.RAPID_ACCEL_CRITICAL_MS2 ? 'MEDIUM' : 'LOW';
        const confidence = Math.min(
          0.96,
          0.75 +
            Math.min(0.12, (this.maxAccelRecorded - threshold) * 0.05) +
            (motionAgrees ? 0.08 : 0.03) +
            Math.min(0.05, this.consecutiveCount * 0.015)
        );

        const result: DetectorResult = {
          detected: true,
          status: 'CONFIRMED',
          type: 'RAPID_ACCELERATION',
          confidence: Math.round(confidence * 100) / 100,
          severity,
          magnitude: Math.round(this.maxAccelRecorded * 100) / 100,
          duration: Math.round(duration * 10) / 10,
          evidence: [
            `Acceleration ${accelMs2.toFixed(1)} m/s² exceeds ${threshold} m/s² threshold`,
            `Speed increased from ${this.speedAtCandidateStart.toFixed(0)} to ${currentSpeed.toFixed(0)} km/h across ${this.consecutiveCount} samples`,
            motionAgrees ? 'Accelerometer dynamic energy confirms forward surge' : 'Kinematic speed derivative confirmed',
          ],
          sourceSignals,
          extra: {
            speedBefore: Math.round(this.speedAtCandidateStart),
            speedAfter: Math.round(currentSpeed),
            acceleration: Math.round(this.maxAccelRecorded * 100) / 100,
          },
        };

        return result;
      }

      return {
        detected: false,
        status: 'POTENTIAL',
        type: 'RAPID_ACCELERATION',
        confidence: 0.5,
        severity: 'LOW',
        magnitude: Math.round(accelMs2 * 100) / 100,
        duration,
        evidence: [`Potential rapid acceleration observed (${accelMs2.toFixed(1)} m/s²), validating sample consistency`],
        sourceSignals,
      };
    } else {
      // Decay or reset candidate when acceleration returns to normal
      this.consecutiveCount = 0;
      return {
        detected: false,
        status: 'NONE',
        type: 'RAPID_ACCELERATION',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Normal acceleration within safe driving limits'],
        sourceSignals: ['GPS'],
      };
    }
  }
}
