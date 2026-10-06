/**
 * Sensor Fusion Layer: Connects GPS, Motion, OS signals, and State Machine
 * Implements Section 4 & 5 of Smart Activity Detection.
 */

import { ActivityRecognitionProvider } from './ActivityRecognitionProvider';
import { ActivityScorer } from './ActivityScorer';
import { ActivityStateMachine } from './ActivityStateMachine';
import { GpsProcessor } from './GpsProcessor';
import { MotionProcessor } from './MotionProcessor';
import {
  ActivityDebugInfo,
  ActivityPrediction,
  ActivityState,
  GpsReading,
  MotionReading,
} from './types';

export class SensorFusion {
  private gpsProcessor = new GpsProcessor();
  private motionProcessor = new MotionProcessor();
  private scorer = new ActivityScorer();
  private stateMachine = new ActivityStateMachine();
  private osProvider: ActivityRecognitionProvider;

  private lastPrediction: ActivityPrediction = {
    activity: 'STATIONARY',
    confidence: 0.9,
    evidence: ['Initial state'],
    scores: {
      STATIONARY: 0.9,
      WALKING: 0,
      RUNNING: 0,
      CYCLING: 0,
      DRIVING: 0,
      RIDING: 0,
      UNKNOWN: 0.1,
    },
  };

  private lastState: ActivityState = {
    currentActivity: 'STATIONARY',
    confirmedActivity: 'STATIONARY',
    stateMachineState: 'CONFIRMED_ACTIVITY',
    confidence: 0.9,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    previousActivity: 'UNKNOWN',
    evidence: ['System initialized'],
    isMoving: false,
  };

  constructor(osProvider: ActivityRecognitionProvider) {
    this.osProvider = osProvider;
  }

  public reset(): void {
    this.gpsProcessor.reset();
    this.motionProcessor.reset();
    this.stateMachine.reset('STATIONARY');
    this.lastState = {
      currentActivity: 'STATIONARY',
      confirmedActivity: 'STATIONARY',
      stateMachineState: 'CONFIRMED_ACTIVITY',
      confidence: 0.9,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      previousActivity: 'UNKNOWN',
      evidence: ['System reset'],
      isMoving: false,
    };
  }

  /**
   * Feed raw GPS reading into fusion engine.
   */
  public processGps(reading: GpsReading): ActivityState {
    const gpsFeatures = this.gpsProcessor.processReading(reading);
    if (!gpsFeatures) {
      return this.lastState;
    }

    const motionFeatures = this.motionProcessor.extractFeatures();
    const osHint = this.osProvider.getOsActivityHint();

    const prediction = this.scorer.score(
      gpsFeatures,
      motionFeatures,
      osHint,
      this.stateMachine.getConfirmedActivity()
    );
    this.lastPrediction = prediction;

    const currentSpeed = gpsFeatures?.smoothedSpeed ?? reading.speed;
    const newState = this.stateMachine.update(
      prediction,
      currentSpeed,
      reading.timestamp || Date.now()
    );
    this.lastState = newState;

    return newState;
  }

  /**
   * Feed raw motion sensor reading (accelerometer / gyroscope) into fusion engine.
   */
  public processMotion(reading: MotionReading): void {
    this.motionProcessor.addReading(reading);
  }

  public getCurrentState(): ActivityState {
    return this.lastState;
  }

  public getDebugInfo(): ActivityDebugInfo {
    const gps = this.gpsProcessor.getLatestReading();
    const motion = this.motionProcessor.extractFeatures();
    const candidateInfo = this.stateMachine.getCandidateInfo();
    const now = Date.now();
    const candidateDurationSec = candidateInfo.candidateSince
      ? Math.round((now - candidateInfo.candidateSince) / 1000)
      : 0;
    const timeSinceConfirmationSec = Math.round(
      (now - this.stateMachine.getConfirmedAt()) / 1000
    );

    return {
      currentActivity: this.stateMachine.getConfirmedActivity(),
      confidence: this.lastState.confidence,
      gpsSpeed: gps?.speed ?? 0,
      gpsSmoothedSpeed: this.gpsProcessor.getSmoothedSpeed(),
      gpsAccuracy: gps?.accuracy ?? 0,
      osActivity: this.osProvider.getOsActivityHint(),
      accelerometerAvailable: motion.hasMotionData,
      gyroscopeAvailable: motion.gyroEnergy > 0,
      motionCadence: motion.estimatedCadence,
      motionEnergy: motion.energy,
      scores: this.lastPrediction.scores,
      stateMachineState: this.stateMachine.getStateMachineState(),
      candidateActivity: candidateInfo.candidateActivity,
      candidateConfidence: candidateInfo.candidateConfidence,
      candidateDurationSec,
      previousActivity: this.lastState.previousActivity,
      timeSinceConfirmationSec,
      evidence: this.lastPrediction.evidence,
    };
  }
}
