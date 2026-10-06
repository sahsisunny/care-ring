/**
 * Possible Distracted Driving Detector
 * Implements Section 8, 9 & Section 27 (Test 10) of Safety Detection Layer.md
 *
 * PRIVACY NOTICE:
 * Does NOT access camera, microphone, keystrokes, or message contents.
 * Evaluates only non-invasive interaction timestamps and physical device motion while travelling.
 */

import { GpsReading, MotionFeatures, MotionReading } from '../activity/types';
import { SafetyConfig } from './SafetyConfig';
import { DetectorResult, SafetySignalSource } from './types';

export class DistractionDetector {
  private touchTimestamps: number[] = [];
  private interactionBurstStart = 0;
  private continuousMovementStart = 0;

  public reset(): void {
    this.touchTimestamps = [];
    this.interactionBurstStart = 0;
    this.continuousMovementStart = 0;
  }

  /**
   * Register a user touch or navigation interaction event in the app.
   */
  public registerInteraction(timestamp?: number): void {
    const t = timestamp || Date.now();
    this.touchTimestamps.push(t);
    // Keep interaction timestamps from the last 60 seconds
    const cutoff = t - 60000;
    this.touchTimestamps = this.touchTimestamps.filter((ts) => ts >= cutoff);

    if (this.interactionBurstStart === 0) {
      this.interactionBurstStart = t;
    }
  }

  public evaluate(
    gps: GpsReading,
    motion?: MotionReading | null,
    motionFeatures?: MotionFeatures | null,
    isVehicleActivity = true,
    activityConfidence = 0.9
  ): DetectorResult {
    // 1. Vehicle Context Guard (Section 8, 9 & 10)
    if (!isVehicleActivity) {
      this.reset();
      return {
        detected: false,
        status: 'NONE',
        type: 'POSSIBLE_DISTRACTED_DRIVING',
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

    // 2. Minimum Vehicle Speed Requirement
    if (currentSpeed < SafetyConfig.DISTRACTION_MIN_SPEED_KMH) {
      return {
        detected: false,
        status: 'NONE',
        type: 'POSSIBLE_DISTRACTED_DRIVING',
        confidence: 0,
        severity: 'LOW',
        magnitude: 0,
        duration: 0,
        evidence: ['Vehicle speed below distraction monitoring floor (e.g. stationary or parking)'],
        sourceSignals: ['GPS'],
      };
    }

    // Track continuous driving movement
    if (this.continuousMovementStart === 0) {
      this.continuousMovementStart = currentTime;
    }

    // Prune stale touch interactions older than 30s
    this.touchTimestamps = this.touchTimestamps.filter((ts) => currentTime - ts <= 30000);
    const recentTouchCount = this.touchTimestamps.length;

    // Check motion characteristics (phone handling vs dashboard mount)
    let isHandlingPhone = false;
    const sourceSignals: SafetySignalSource[] = ['GPS'];

    if (recentTouchCount > 0) {
      sourceSignals.push('APP_INTERACTION');
    }

    if (motionFeatures && motionFeatures.hasMotionData) {
      // Unmounted phone in hand shows higher dynamic variance/energy compared to stable car mount
      if (motionFeatures.energy >= SafetyConfig.DISTRACTION_MOTION_ENERGY_THRESHOLD) {
        isHandlingPhone = true;
        sourceSignals.push('ACCELEROMETER');
      }
    } else if (motion) {
      const dynamicMag = Math.abs(motion.magnitude - 1.0);
      if (dynamicMag >= 0.08) {
        isHandlingPhone = true;
        sourceSignals.push('ACCELEROMETER');
      }
    }

    // Section 9 Confidence Model:
    // Requires high driving confidence (>= 0.80) + multiple interactions while travelling
    const hasSufficientDrivingConfidence = activityConfidence >= SafetyConfig.DISTRACTION_MIN_DRIVING_CONFIDENCE;
    const hasRepeatedInteraction = recentTouchCount >= SafetyConfig.DISTRACTION_MIN_TOUCH_EVENTS;

    if (hasRepeatedInteraction && hasSufficientDrivingConfidence) {
      const firstTouch = this.touchTimestamps[0];
      const interactionDurationMs = currentTime - firstTouch;
      const durationSec = Math.max(1, Math.round(interactionDurationMs / 1000));

      if (interactionDurationMs >= SafetyConfig.DISTRACTION_CONFIRMATION_MS) {
        // High confidence event (Section 9: ~0.88 - 0.92)
        const confidence = Math.min(
          0.93,
          0.78 +
            Math.min(0.08, recentTouchCount * 0.02) +
            (isHandlingPhone ? 0.07 : 0.02)
        );

        return {
          detected: true,
          status: 'CONFIRMED',
          type: 'POSSIBLE_DISTRACTED_DRIVING',
          confidence: Math.round(confidence * 100) / 100,
          severity: 'HIGH',
          magnitude: recentTouchCount,
          duration: durationSec,
          evidence: [
            `Repeated device interaction (${recentTouchCount} taps) sustained over ${durationSec}s`,
            `Vehicle moving at ${Math.round(currentSpeed)} km/h with ${(activityConfidence * 100).toFixed(0)}% driving confidence`,
            isHandlingPhone ? 'Motion sensors indicate handheld device movement' : 'Sustained active UI interaction detected while moving',
          ],
          sourceSignals,
          extra: {
            touchCount: recentTouchCount,
            duration: durationSec,
            speed: Math.round(currentSpeed),
          },
        };
      }

      return {
        detected: false,
        status: 'POTENTIAL',
        type: 'POSSIBLE_DISTRACTED_DRIVING',
        confidence: 0.5,
        severity: 'HIGH',
        magnitude: recentTouchCount,
        duration: Math.round(interactionDurationMs / 1000),
        evidence: [
          `Potential distracted driving observed (${recentTouchCount} touches over ${(interactionDurationMs / 1000).toFixed(1)}s), validating temporal duration`,
        ],
        sourceSignals,
      };
    }

    return {
      detected: false,
      status: 'NONE',
      type: 'POSSIBLE_DISTRACTED_DRIVING',
      confidence: 0,
      severity: 'LOW',
      magnitude: 0,
      duration: 0,
      evidence: ['No significant phone interaction observed while driving'],
      sourceSignals,
    };
  }
}
