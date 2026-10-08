/**
 * Overspeed Detector
 * Implements Section 7 & Section 27 (Test 7, 8) of Safety Detection Layer.md
 */

import { GpsReading } from '../activity/types';
import { SafetyConfig } from './SafetyConfig';
import { DetectorResult, SafetySignalSource } from './types';

export class OverspeedDetector {
  private continuousOverStart = 0;
  private sampleCount = 0;
  private peakSpeed = 0;
  private sumSpeed = 0;

  public reset(): void {
    this.continuousOverStart = 0;
    this.sampleCount = 0;
    this.peakSpeed = 0;
    this.sumSpeed = 0;
  }

  public evaluate(
    gps: GpsReading,
    contextualSpeedLimit?: number,
    isVehicleActivity = true
  ): DetectorResult {
    // 1. Vehicle Context Guard (Section 10)
    if (!isVehicleActivity) {
      this.reset();
      return {
        detected: false,
        status: 'NONE',
        type: 'OVERSPEEDING',
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
    const speedLimit = contextualSpeedLimit || SafetyConfig.DEFAULT_ROAD_SPEED_LIMIT_KMH;
    const effectiveThreshold = speedLimit + SafetyConfig.OVERSPEED_TOLERANCE_KMH;

    // Reject noisy GPS with poor accuracy (> 40m)
    if (gps.accuracy !== undefined && gps.accuracy > SafetyConfig.OVERSPEED_MAX_GPS_ACCURACY_M) {
      return {
        detected: false,
        status: 'NONE',
        type: 'OVERSPEEDING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['GPS accuracy too poor to evaluate overspeeding reliably'],
        sourceSignals: ['GPS'],
      };
    }

    const sourceSignals: SafetySignalSource[] = ['GPS'];
    if (contextualSpeedLimit) {
      sourceSignals.push('ROAD_SPEED_LIMIT');
    }

    // Check if current speed exceeds limit + tolerance
    if (currentSpeed > effectiveThreshold) {
      if (this.continuousOverStart === 0) {
        this.continuousOverStart = currentTime;
        this.sampleCount = 1;
        this.peakSpeed = currentSpeed;
        this.sumSpeed = currentSpeed;
      } else {
        this.sampleCount++;
        this.peakSpeed = Math.max(this.peakSpeed, currentSpeed);
        this.sumSpeed += currentSpeed;
      }

      const durationMs = currentTime - this.continuousOverStart;
      const durationSec = Math.max(1, Math.round(durationMs / 1000));
      const excessSpeed = Math.round(this.peakSpeed - speedLimit);

      // Section 11 & Test 8: Must be sustained for configured duration (e.g. >= 5000ms and >= 2 samples)
      // Single GPS speed spike (50 -> 150 -> 48) has durationMs == 0 or 400ms -> NOT CONFIRMED!
      if (
        durationMs >= SafetyConfig.OVERSPEED_CONFIRMATION_MS &&
        this.sampleCount >= 2
      ) {
        const severity = excessSpeed >= SafetyConfig.OVERSPEED_HIGH_EXCESS_KMH ? 'HIGH' : 'MEDIUM';
        const confidence = Math.min(
          0.97,
          0.82 +
            Math.min(0.08, (excessSpeed / 20) * 0.05) +
            Math.min(0.07, (durationSec / 15) * 0.05)
        );

        return {
          detected: true,
          status: 'CONFIRMED',
          type: 'OVERSPEEDING',
          confidence: Math.round(confidence * 100) / 100,
          severity,
          magnitude: excessSpeed,
          duration: durationSec,
          evidence: [
            `Speed sustained at ${Math.round(currentSpeed)} km/h exceeding ${speedLimit} km/h limit (+${SafetyConfig.OVERSPEED_TOLERANCE_KMH} km/h tolerance)`,
            `Excess speed: +${excessSpeed} km/h over limit for ${durationSec}s continuous across ${this.sampleCount} points`,
            contextualSpeedLimit ? 'Road speed limit corroborated from context' : 'Default regional speed limit benchmark applied',
          ],
          sourceSignals,
          extra: {
            currentSpeed: Math.round(currentSpeed),
            speedLimit: Math.round(speedLimit),
            excessSpeed,
            duration: durationSec,
          },
        };
      }

      return {
        detected: false,
        status: 'POTENTIAL',
        type: 'OVERSPEEDING',
        confidence: 0.5,
        severity: 'MEDIUM',
        magnitude: excessSpeed,
        duration: durationSec,
        evidence: [
          `Potential overspeeding (+${excessSpeed} km/h), validating sustained duration (${(durationMs / 1000).toFixed(1)}s / ${(SafetyConfig.OVERSPEED_CONFIRMATION_MS / 1000).toFixed(0)}s required)`,
        ],
        sourceSignals,
      };
    } else {
      // Speed dropped below threshold -> safely reset overspeed window
      this.reset();
      return {
        detected: false,
        status: 'NONE',
        type: 'OVERSPEEDING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: [`Speed (${Math.round(currentSpeed)} km/h) is within legal/configured tolerance limit (${effectiveThreshold} km/h)`],
        sourceSignals,
      };
    }
  }
}
