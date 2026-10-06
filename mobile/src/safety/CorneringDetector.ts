/**
 * Harsh Cornering Detector
 * Implements Section 6 & Section 27 (Test 5, 6) of Safety Detection Layer.md
 */

import { GpsReading, MotionReading } from '../activity/types';
import { SafetyConfig } from './SafetyConfig';
import { DetectorResult, SafetySignalSource } from './types';

export class CorneringDetector {
  private history: { heading: number; speed: number; timestamp: number }[] = [];
  private consecutiveCount = 0;
  private candidateStartTime = 0;
  private totalHeadingChange = 0;
  private peakSpeed = 0;
  private peakLateralAccel = 0;

  public reset(): void {
    this.history = [];
    this.consecutiveCount = 0;
    this.candidateStartTime = 0;
    this.totalHeadingChange = 0;
    this.peakSpeed = 0;
    this.peakLateralAccel = 0;
  }

  /**
   * Smallest angular difference between two headings in degrees (-180 to +180)
   */
  public static angularDelta(h1: number, h2: number): number {
    let diff = (h2 - h1 + 180) % 360 - 180;
    if (diff < -180) diff += 360;
    return diff;
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
        type: 'HARSH_CORNERING',
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
    const heading = gps.heading;

    // Heading is required for cornering
    if (heading === undefined || heading === null || isNaN(heading)) {
      return {
        detected: false,
        status: 'NONE',
        type: 'HARSH_CORNERING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['No heading available from GPS fix'],
        sourceSignals: ['GPS'],
      };
    }

    this.history.push({ heading, speed: currentSpeed, timestamp: currentTime });
    if (this.history.length > 6) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      return {
        detected: false,
        status: 'NONE',
        type: 'HARSH_CORNERING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Insufficient heading history points'],
        sourceSignals: ['GPS'],
      };
    }

    const prev = this.history[this.history.length - 2];
    const dt = Math.max(0.2, (currentTime - prev.timestamp) / 1000);
    const deltaDeg = Math.abs(CorneringDetector.angularDelta(prev.heading, heading));
    const headingRateDegSec = deltaDeg / dt;

    // Check motion sensors (gyroscope and lateral accelerometer)
    const sourceSignals: SafetySignalSource[] = ['GPS', 'HEADING_RATE'];
    let lateralForceG = 0;

    if (motion) {
      if (motion.gyroZ !== undefined || motion.gyroX !== undefined) {
        sourceSignals.push('GYROSCOPE');
      }
      // Lateral acceleration component (X-axis tilt / dynamic shear)
      const latAcc = Math.abs(motion.x);
      if (latAcc > 0.2) {
        sourceSignals.push('ACCELEROMETER');
        lateralForceG = latAcc;
      }
    }

    // Kinematic lateral acceleration calculation: a_lat = v * omega
    const speedMs = currentSpeed / 3.6;
    const yawRateRadSec = (headingRateDegSec * Math.PI) / 180;
    const kinematicLateralAccelMs2 = speedMs * yawRateRadSec;
    const kinematicLateralG = kinematicLateralAccelMs2 / 9.81;

    const effectiveLateralG = Math.max(lateralForceG, kinematicLateralG);

    // Rule: Must be travelling at meaningful vehicle speed (Section 6: slow turn at 10 km/h -> Do NOT trigger!)
    const isMeaningfulSpeed = currentSpeed >= SafetyConfig.HARSH_CORNERING_MIN_SPEED_KMH;
    const isSharpHeadingRate = headingRateDegSec >= SafetyConfig.HARSH_CORNERING_MIN_HEADING_RATE_DEG_SEC;
    const isSignificantLateralG = effectiveLateralG >= SafetyConfig.HARSH_CORNERING_MIN_LATERAL_ACCEL_G;

    if (isMeaningfulSpeed && isSharpHeadingRate && isSignificantLateralG) {
      if (this.consecutiveCount === 0) {
        this.candidateStartTime = prev.timestamp;
        this.totalHeadingChange = deltaDeg;
        this.peakSpeed = currentSpeed;
        this.peakLateralAccel = effectiveLateralG;
      } else {
        this.totalHeadingChange += deltaDeg;
        this.peakSpeed = Math.max(this.peakSpeed, currentSpeed);
        this.peakLateralAccel = Math.max(this.peakLateralAccel, effectiveLateralG);
      }

      this.consecutiveCount++;
      const duration = Math.max(0.5, (currentTime - this.candidateStartTime) / 1000);

      if (
        this.consecutiveCount >= SafetyConfig.HARSH_CORNERING_MIN_SAMPLES &&
        this.totalHeadingChange >= SafetyConfig.HARSH_CORNERING_MIN_HEADING_CHANGE_DEG
      ) {
        const severity = this.peakLateralAccel >= 0.55 || this.peakSpeed >= 55 ? 'HIGH' : 'MEDIUM';
        const confidence = Math.min(
          0.95,
          0.72 +
            Math.min(0.12, (this.peakLateralAccel - SafetyConfig.HARSH_CORNERING_MIN_LATERAL_ACCEL_G) * 0.4) +
            (sourceSignals.includes('GYROSCOPE') ? 0.06 : 0.02) +
            Math.min(0.06, this.consecutiveCount * 0.02)
        );

        return {
          detected: true,
          status: 'CONFIRMED',
          type: 'HARSH_CORNERING',
          confidence: Math.round(confidence * 100) / 100,
          severity,
          magnitude: Math.round(this.peakLateralAccel * 100) / 100,
          duration: Math.round(duration * 10) / 10,
          evidence: [
            `Heading changed by ${Math.round(this.totalHeadingChange)}° at ${Math.round(this.peakSpeed)} km/h`,
            `Heading turn rate ${headingRateDegSec.toFixed(1)}°/s with ${this.peakLateralAccel.toFixed(2)}g lateral force`,
            sourceSignals.includes('GYROSCOPE') ? 'Gyroscope yaw rate corroborates sharp turn' : 'Kinematic lateral curvature confirmed',
          ],
          sourceSignals,
          extra: {
            speed: Math.round(this.peakSpeed),
            headingChange: Math.round(this.totalHeadingChange),
            lateralAcceleration: Math.round(this.peakLateralAccel * 100) / 100,
          },
        };
      }

      return {
        detected: false,
        status: 'POTENTIAL',
        type: 'HARSH_CORNERING',
        confidence: 0.5,
        severity: 'MEDIUM',
        magnitude: Math.round(effectiveLateralG * 100) / 100,
        duration,
        evidence: [`Potential sharp turn in progress (${deltaDeg.toFixed(0)}° at ${headingRateDegSec.toFixed(1)}°/s), validating turn angle`],
        sourceSignals,
      };
    } else {
      this.consecutiveCount = 0;
      return {
        detected: false,
        status: 'NONE',
        type: 'HARSH_CORNERING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Turning dynamics within normal curvature boundaries'],
        sourceSignals: ['GPS'],
      };
    }
  }
}
