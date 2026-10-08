/**
 * Activity State Machine & Hysteresis Controller
 * Implements Section 6, 7, 8, 17, 18, 19 of Smart Activity Detection.
 */

import { ActivityConfig } from './ActivityConfig';
import { ActivityLogger } from './ActivityLogger';
import {
  ActivityPrediction,
  ActivityState,
  ActivityType,
  StateMachineState,
} from './types';

export class ActivityStateMachine {
  private confirmedActivity: ActivityType = 'STATIONARY';
  private previousActivity: ActivityType = 'UNKNOWN';
  private stateMachineState: StateMachineState = 'CONFIRMED_ACTIVITY';
  private candidateActivity: ActivityType | null = null;
  private candidateSince = 0;
  private candidateConfidence = 0;
  private confirmedAt = Date.now();
  private lastUpdatedAt = Date.now();
  private currentEvidence: string[] = [];
  private isMoving = false;

  public reset(initialActivity: ActivityType = 'STATIONARY'): void {
    this.confirmedActivity = initialActivity;
    this.previousActivity = 'UNKNOWN';
    this.stateMachineState = 'CONFIRMED_ACTIVITY';
    this.candidateActivity = null;
    this.candidateSince = 0;
    this.candidateConfidence = 0;
    this.confirmedAt = Date.now();
    this.lastUpdatedAt = Date.now();
    this.currentEvidence = [];
    this.isMoving = initialActivity !== 'STATIONARY' && initialActivity !== 'UNKNOWN';
  }

  /**
   * Evaluates the current prediction and updates state machine transitions with hysteresis.
   */
  public update(
    prediction: ActivityPrediction,
    currentSpeed: number,
    timestamp: number = Date.now()
  ): ActivityState {
    this.lastUpdatedAt = timestamp;
    const predicted = prediction.activity;
    const confidence = prediction.confidence;
    const isMovingNow = currentSpeed >= 1.5 || (predicted !== 'STATIONARY' && predicted !== 'UNKNOWN');
    this.isMoving = isMovingNow;

    // =========================================================================
    // Case 1: Initial Movement from Still / Unknown (Section 7)
    // =========================================================================
    if (
      (this.confirmedActivity === 'STATIONARY' || this.confirmedActivity === 'UNKNOWN') &&
      isMovingNow
    ) {
      if (this.stateMachineState === 'CONFIRMED_ACTIVITY') {
        this.stateMachineState = 'MOVEMENT_STARTED';
        this.candidateActivity = (predicted !== 'STATIONARY' && predicted !== 'UNKNOWN') ? predicted : null;
        this.candidateSince = timestamp;
        this.candidateConfidence = confidence;
        this.currentEvidence = prediction.evidence;

        ActivityLogger.logStructured({
          speed: currentSpeed,
          accuracy: 10,
          osActivity: 'UNKNOWN',
          candidate: predicted,
          confidence,
          previousActivity: this.confirmedActivity,
          action: 'START_CANDIDATE',
          reason: 'INITIAL_START',
          evidence: prediction.evidence,
        });

        return this.buildState(predicted);
      }
    }

    // =========================================================================
    // Case 2: Collecting Evidence for Startup Confirmation (10-20s window)
    // =========================================================================
    if (
      this.stateMachineState === 'MOVEMENT_STARTED' ||
      this.stateMachineState === 'COLLECTING_DATA'
    ) {
      this.stateMachineState = 'COLLECTING_DATA';
      const duration = timestamp - this.candidateSince;

      // In vehicle ramp-up (Test 1: 0 -> 3 -> 7 -> 12 -> 25 -> 50 km/h),
      // driving or riding evidence quickly dominates without pedestrian footfalls.
      if (predicted === 'DRIVING' || predicted === 'RIDING') {
        this.candidateActivity = predicted;
        this.candidateConfidence = Math.max(this.candidateConfidence, confidence);
      } else if (!this.candidateActivity || this.candidateActivity === 'UNKNOWN') {
        if (predicted !== 'UNKNOWN' && predicted !== 'STATIONARY') {
          this.candidateActivity = predicted;
          this.candidateConfidence = confidence;
        }
      } else if (this.candidateActivity !== predicted && duration < 5000 && confidence > this.candidateConfidence) {
        this.candidateActivity = predicted;
        this.candidateConfidence = confidence;
      }

      this.currentEvidence = prediction.evidence;

      // Has evidence been sustained for the required duration?
      if (
        duration >= ActivityConfig.ACTIVITY_START_CONFIRMATION_MS &&
        this.candidateActivity &&
        this.candidateActivity !== 'UNKNOWN' &&
        this.candidateActivity !== 'STATIONARY' &&
        this.candidateConfidence >= ActivityConfig.MIN_ACTIVITY_CONFIDENCE
      ) {
        // CONFIRM INITIAL ACTIVITY
        this.previousActivity = this.confirmedActivity;
        this.confirmedActivity = this.candidateActivity;
        this.confirmedAt = timestamp;
        this.stateMachineState = 'CONFIRMED_ACTIVITY';
        this.candidateActivity = null;

        ActivityLogger.logStructured(
          {
            speed: currentSpeed,
            accuracy: 10,
            osActivity: 'UNKNOWN',
            candidate: this.confirmedActivity,
            confidence: this.candidateConfidence,
            previousActivity: this.previousActivity,
            action: 'CONFIRM_NEW',
            reason: 'CONFIRMATION_TIMEOUT_MET',
            evidence: this.currentEvidence,
          },
          true
        );

        return this.buildState(this.confirmedActivity);
      }

      // Still collecting data: hold current confirmed activity!
      return this.buildState(this.candidateActivity || predicted);
    }

    // =========================================================================
    // Case 3: Confirmed Activity Maintenance vs Candidate Switching (Section 8)
    // =========================================================================
    if (predicted === this.confirmedActivity) {
      // Activity matches confirmed state: reset any pending candidate
      this.candidateActivity = null;
      this.candidateSince = 0;
      this.stateMachineState = 'CONFIRMED_ACTIVITY';
      this.currentEvidence = prediction.evidence;
      return this.buildState(this.confirmedActivity);
    }

    // =========================================================================
    // Case 4: Traffic Jam & Temporary Stop Protection (Section 17 & 18)
    // =========================================================================
    const isVehicle = this.confirmedActivity === 'DRIVING' || this.confirmedActivity === 'RIDING';
    if (isVehicle) {
      if (predicted === 'STATIONARY') {
        // Vehicle stopped at red light / stop sign: requires SUSTAINED duration (25s) before STATIONARY
        if (!this.candidateActivity || this.candidateActivity !== 'STATIONARY') {
          this.candidateActivity = 'STATIONARY';
          this.candidateSince = timestamp;
          this.candidateConfidence = confidence;
          this.stateMachineState = 'ACTIVITY_CHANGE_CANDIDATE';
        }

        const stopDuration = timestamp - this.candidateSince;
        if (stopDuration < ActivityConfig.STATIONARY_CONFIRMATION_MS) {
          // Hold DRIVING!
          ActivityLogger.logStructured({
            speed: currentSpeed,
            accuracy: 10,
            osActivity: 'UNKNOWN',
            candidate: 'STATIONARY',
            confidence,
            previousActivity: this.confirmedActivity,
            action: 'KEEP_CURRENT',
            reason: 'HYSTERESIS',
            evidence: ['Vehicle stop under stationary confirmation threshold'],
          });
          return this.buildState('STATIONARY');
        }
      } else if (predicted === 'WALKING' || predicted === 'CYCLING') {
        // Traffic crawl: strictly protect vehicle activity unless sustained strong pedestrian steps
        if (confidence < ActivityConfig.HIGH_ACTIVITY_CONFIDENCE) {
          ActivityLogger.logStructured({
            speed: currentSpeed,
            accuracy: 10,
            osActivity: 'UNKNOWN',
            candidate: predicted,
            confidence,
            previousActivity: this.confirmedActivity,
            action: 'KEEP_CURRENT',
            reason: 'HYSTERESIS',
            evidence: ['Traffic slowdown protected by hysteresis'],
          });
          return this.buildState(predicted);
        }
      }
    }

    // =========================================================================
    // Case 5: Sustained Activity Switching (Hysteresis Evaluation)
    // =========================================================================
    if (this.candidateActivity !== predicted) {
      // New candidate activity identified
      this.candidateActivity = predicted;
      this.candidateSince = timestamp;
      this.candidateConfidence = confidence;
      this.stateMachineState = 'ACTIVITY_CHANGE_CANDIDATE';
      this.currentEvidence = prediction.evidence;

      ActivityLogger.logStructured({
        speed: currentSpeed,
        accuracy: 10,
        osActivity: 'UNKNOWN',
        candidate: predicted,
        confidence,
        previousActivity: this.confirmedActivity,
        action: 'START_CANDIDATE',
        reason: 'INITIAL_START',
        evidence: prediction.evidence,
      });

      return this.buildState(predicted);
    }

    // Candidate has been sustained for candidateDuration
    const candidateDuration = timestamp - this.candidateSince;
    const requiredDuration =
      predicted === 'STATIONARY' && isVehicle
        ? ActivityConfig.STATIONARY_CONFIRMATION_MS
        : ActivityConfig.ACTIVITY_SWITCH_CONFIRMATION_MS;

    if (
      candidateDuration >= requiredDuration &&
      confidence >= ActivityConfig.MIN_ACTIVITY_CONFIDENCE
    ) {
      // CONFIRM NEW ACTIVITY!
      this.previousActivity = this.confirmedActivity;
      this.confirmedActivity = predicted;
      this.confirmedAt = timestamp;
      this.stateMachineState = 'CONFIRMED_NEW_ACTIVITY';
      this.candidateActivity = null;
      this.currentEvidence = prediction.evidence;

      ActivityLogger.logStructured(
        {
          speed: currentSpeed,
          accuracy: 10,
          osActivity: 'UNKNOWN',
          candidate: predicted,
          confidence,
          previousActivity: this.previousActivity,
          action: 'CONFIRM_NEW',
          reason: 'CONFIRMATION_TIMEOUT_MET',
          evidence: prediction.evidence,
        },
        true
      );

      // Settle into confirmed state
      this.stateMachineState = 'CONFIRMED_ACTIVITY';
      return this.buildState(this.confirmedActivity);
    }

    // Evidence not sustained long enough -> Keep current confirmed activity (Hysteresis)
    ActivityLogger.logStructured({
      speed: currentSpeed,
      accuracy: 10,
      osActivity: 'UNKNOWN',
      candidate: predicted,
      confidence,
      previousActivity: this.confirmedActivity,
      action: 'KEEP_CURRENT',
      reason: 'HYSTERESIS',
      evidence: prediction.evidence,
    });

    return this.buildState(predicted);
  }

  private buildState(candidatePrediction?: ActivityType): ActivityState {
    const isConfirming =
      this.stateMachineState === 'MOVEMENT_STARTED' ||
      this.stateMachineState === 'COLLECTING_DATA' ||
      this.stateMachineState === 'ACTIVITY_CHANGE_CANDIDATE' ||
      this.stateMachineState === 'CANDIDATE_ACTIVITY';

    // While the state machine is confirming a new activity, send "unknown"/"moving", never "stationary"
    let reportingActivity = this.confirmedActivity;
    if (isConfirming) {
      if (this.isMoving || this.confirmedActivity === 'STATIONARY') {
        reportingActivity = 'UNKNOWN';
      }
    }

    return {
      currentActivity: reportingActivity,
      confirmedActivity: this.confirmedActivity,
      stateMachineState: this.stateMachineState,
      confidence: this.candidateConfidence || 0.85,
      startedAt: this.confirmedAt,
      lastUpdatedAt: this.lastUpdatedAt,
      candidateActivity: this.candidateActivity || candidatePrediction,
      candidateSince: this.candidateSince,
      candidateConfidence: this.candidateConfidence,
      previousActivity: this.previousActivity,
      evidence: this.currentEvidence,
      isMoving: this.isMoving,
    };
  }

  public getConfirmedActivity(): ActivityType {
    return this.confirmedActivity;
  }

  public getStateMachineState(): StateMachineState {
    return this.stateMachineState;
  }

  public getConfirmedAt(): number {
    return this.confirmedAt;
  }

  public getCandidateInfo(): {
    candidateActivity?: ActivityType;
    candidateConfidence?: number;
    candidateSince?: number;
  } {
    return {
      candidateActivity: this.candidateActivity || undefined,
      candidateConfidence: this.candidateConfidence,
      candidateSince: this.candidateSince,
    };
  }
}
