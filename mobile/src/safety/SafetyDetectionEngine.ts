/**
 * Driving Safety Detection Engine
 * Coordinates Detectors, State Machine, Scorer, Event Manager, and Debug States.
 * Implements Section 2, 3, 10, 15, 16, 18, 24, 25 of Safety Detection Layer.md
 */

import { ActivityType, GpsReading, MotionFeatures, MotionReading } from '../activity/types';
import { AccelerationDetector } from './AccelerationDetector';
import { BrakingDetector } from './BrakingDetector';
import { CorneringDetector } from './CorneringDetector';
import { DistractionDetector } from './DistractionDetector';
import { OverspeedDetector } from './OverspeedDetector';
import { SafetyConfig } from './SafetyConfig';
import { SafetyEventManager } from './SafetyEventManager';
import { SafetyEventScorer } from './SafetyEventScorer';
import { SafetyEventStateMachine } from './SafetyEventStateMachine';
import { SafetyLogger } from './SafetyLogger';
import {
  DetectorResult,
  SafetyDebugListener,
  SafetyDebugState,
  SafetyEvent,
  SafetyEventListener,
  SafetySummary,
} from './types';

export class SafetyDetectionEngine {
  private static instance: SafetyDetectionEngine;

  private accelerationDetector = new AccelerationDetector();
  private brakingDetector = new BrakingDetector();
  private corneringDetector = new CorneringDetector();
  private overspeedDetector = new OverspeedDetector();
  private distractionDetector = new DistractionDetector();

  private stateMachine = new SafetyEventStateMachine();
  private eventManager = new SafetyEventManager();

  private isEnabled = true;
  private notificationsEnabled = true;
  private contextualSpeedLimit?: number;

  private latestMotion: MotionReading | null = null;
  private latestMotionFeatures: MotionFeatures | null = null;
  private lastHeading = 0;
  private lastHeadingChange = 0;
  private lastGpsReading: GpsReading | null = null;

  private currentActivity: ActivityType = 'STATIONARY';
  private currentActivityConfidence = 0.9;

  private debugListeners = new Set<SafetyDebugListener>();
  private lastConfirmedEvent?: SafetyEvent;

  // Session stats for safety summary
  private sessionDistanceKm = 0;
  private sessionDrivingStartTime = 0;
  private sessionDrivingTimeSec = 0;
  private lastPosForDistance: { lat: number; lng: number } | null = null;

  public static getInstance(): SafetyDetectionEngine {
    if (!SafetyDetectionEngine.instance) {
      SafetyDetectionEngine.instance = new SafetyDetectionEngine();
    }
    return SafetyDetectionEngine.instance;
  }

  public reset(): void {
    this.accelerationDetector.reset();
    this.brakingDetector.reset();
    this.corneringDetector.reset();
    this.overspeedDetector.reset();
    this.distractionDetector.reset();
    this.stateMachine.reset();
    this.eventManager.reset();
    this.lastConfirmedEvent = undefined;
    this.sessionDistanceKm = 0;
    this.sessionDrivingTimeSec = 0;
    this.sessionDrivingStartTime = 0;
    this.lastPosForDistance = null;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public isSafetyDetectionEnabled(): boolean {
    return this.isEnabled;
  }

  public setNotificationsEnabled(enabled: boolean): void {
    this.notificationsEnabled = enabled;
  }

  public areNotificationsEnabled(): boolean {
    return this.notificationsEnabled;
  }

  public setContextualSpeedLimit(limitKmh?: number): void {
    this.contextualSpeedLimit = limitKmh;
  }

  public registerUserInteraction(timestamp?: number): void {
    if (!this.isEnabled) return;
    this.distractionDetector.registerInteraction(timestamp);
  }

  public feedMotion(reading: MotionReading, features?: MotionFeatures | null): void {
    this.latestMotion = reading;
    if (features) {
      this.latestMotionFeatures = features;
    }
  }

  /**
   * Main entrypoint: feed validated GPS fix + current activity from Smart Activity Detection.
   * Section 10: Runs safety detectors ONLY when activity is DRIVING or RIDING.
   */
  public feedGpsLocation(
    gps: GpsReading,
    activity: ActivityType,
    activityConfidence: number = 0.9,
    userId?: string,
    circleId?: string
  ): SafetyEvent | null {
    if (!this.isEnabled) return null;

    this.lastGpsReading = gps;
    this.currentActivity = activity;
    this.currentActivityConfidence = activityConfidence;

    const isVehicle =
      SafetyConfig.VALID_VEHICLE_ACTIVITIES.includes(activity) &&
      gps.speed >= SafetyConfig.MIN_VEHICLE_SPEED_KMH;

    // Track driving session time & distance
    this.updateDrivingMetrics(gps, isVehicle);

    if (gps.heading !== undefined && this.lastGpsReading) {
      this.lastHeadingChange = Math.abs(
        CorneringDetector.angularDelta(this.lastHeading, gps.heading)
      );
      this.lastHeading = gps.heading;
    }

    // Evaluate all 5 detectors
    const accelRes = this.accelerationDetector.evaluate(gps, this.latestMotion, isVehicle);
    const brakeRes = this.brakingDetector.evaluate(gps, this.latestMotion, isVehicle);
    const cornerRes = this.corneringDetector.evaluate(gps, this.latestMotion, isVehicle);
    const overspeedRes = this.overspeedDetector.evaluate(
      gps,
      this.contextualSpeedLimit,
      isVehicle
    );
    const distractRes = this.distractionDetector.evaluate(
      gps,
      this.latestMotion,
      this.latestMotionFeatures,
      isVehicle,
      activityConfidence
    );

    const detectorResults: DetectorResult[] = [
      accelRes,
      brakeRes,
      cornerRes,
      overspeedRes,
      distractRes,
    ];

    // Check for confirmed events
    let confirmedEventToEmit: SafetyEvent | null = null;
    let hasPotential = false;

    for (const res of detectorResults) {
      if (res.status === 'CONFIRMED' && res.detected) {
        // Section 14: Deduplication & Cooldown check
        const isSuppressed = this.eventManager.shouldSuppressDueToCooldown(
          res.type,
          res.severity,
          gps.timestamp
        );

        if (!isSuppressed) {
          const event: SafetyEvent = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId,
            circleId,
            type: res.type,
            severity: res.severity,
            confidence: res.confidence,
            timestamp: gps.timestamp || Date.now(),
            latitude: gps.latitude,
            longitude: gps.longitude,
            speed: Math.round(gps.speed * 10) / 10,
            duration: res.duration,
            evidence: res.evidence,
            sourceSignals: res.sourceSignals,
            speedBefore: res.extra?.speedBefore,
            speedAfter: res.extra?.speedAfter,
            acceleration: res.extra?.acceleration,
            heading: gps.heading,
            headingChange: res.extra?.headingChange,
            speedLimit: res.extra?.speedLimit,
            excessSpeed: res.extra?.excessSpeed,
            metadata: res.extra,
            createdAt: new Date(gps.timestamp || Date.now()).toISOString(),
          };

          this.stateMachine.transitionToConfirmed(res.type, gps.timestamp);
          this.eventManager.recordConfirmedEvent(event);
          this.lastConfirmedEvent = event;
          confirmedEventToEmit = event;

          // Transition to cooldown
          const cooldownDuration = this.getCooldownForType(res.type);
          this.stateMachine.transitionToCooldown(cooldownDuration, gps.timestamp);

          SafetyLogger.log({
            activity,
            speed: gps.speed,
            gpsAccuracy: gps.accuracy,
            acceleration: res.extra?.acceleration,
            candidate: res.type,
            confidence: res.confidence,
            action: 'CONFIRMED_EVENT',
            reason: res.evidence.join('; '),
          });
          break; // First confirmed event takes priority for this tick
        }
      } else if (res.status === 'POTENTIAL') {
        hasPotential = true;
        SafetyLogger.log({
          activity,
          speed: gps.speed,
          gpsAccuracy: gps.accuracy,
          candidate: res.type,
          confidence: res.confidence,
          action: 'POTENTIAL_EVENT',
          reason: res.evidence.join('; '),
        });
      }
    }

    if (!confirmedEventToEmit) {
      if (hasPotential) {
        this.stateMachine.transitionToPotential('HARD_BRAKING', gps.timestamp);
      } else if (this.stateMachine.getState() !== 'COOLDOWN') {
        this.stateMachine.transitionToNormal(gps.timestamp);
      }
    }

    this.notifyDebugState(accelRes, brakeRes, cornerRes, overspeedRes, distractRes);
    return confirmedEventToEmit;
  }

  public getSummary(): SafetySummary {
    const recent = this.eventManager.getRecentEvents();
    return SafetyEventScorer.buildSummary(
      recent,
      this.sessionDistanceKm,
      this.sessionDrivingTimeSec
    );
  }

  public getRecentEvents(): SafetyEvent[] {
    return this.eventManager.getRecentEvents();
  }

  public subscribeEvents(listener: SafetyEventListener): () => void {
    return this.eventManager.subscribe(listener);
  }

  public subscribeDebugState(listener: SafetyDebugListener): () => void {
    this.debugListeners.add(listener);
    return () => {
      this.debugListeners.delete(listener);
    };
  }

  public getDebugState(): SafetyDebugState {
    const gps = this.lastGpsReading;
    return {
      currentActivity: this.currentActivity,
      activityConfidence: this.currentActivityConfidence,
      speed: gps ? Math.round(gps.speed * 10) / 10 : 0,
      gpsAccuracy: gps?.accuracy ? Math.round(gps.accuracy) : 0,
      acceleration: 0,
      heading: gps?.heading ? Math.round(gps.heading) : 0,
      headingChange: Math.round(this.lastHeadingChange),
      roadSpeedLimit: this.contextualSpeedLimit || SafetyConfig.DEFAULT_ROAD_SPEED_LIMIT_KMH,
      overspeedConfidence: 0,
      hardBraking: 'No',
      rapidAcceleration: 'No',
      harshCornering: 'No',
      possibleDistraction: 'No',
      currentSafetyState: this.stateMachine.getState(),
      lastConfirmedEvent: this.lastConfirmedEvent,
      activeCooldowns: this.eventManager.getActiveCooldowns(),
    };
  }

  private notifyDebugState(
    accel: DetectorResult,
    brake: DetectorResult,
    corner: DetectorResult,
    overspeed: DetectorResult,
    distract: DetectorResult
  ): void {
    if (this.debugListeners.size === 0) return;

    const toLabel = (res: DetectorResult): 'No' | 'Potential' | 'Yes' => {
      if (res.status === 'CONFIRMED') return 'Yes';
      if (res.status === 'POTENTIAL') return 'Potential';
      return 'No';
    };

    const state: SafetyDebugState = {
      currentActivity: this.currentActivity,
      activityConfidence: this.currentActivityConfidence,
      speed: this.lastGpsReading ? Math.round(this.lastGpsReading.speed * 10) / 10 : 0,
      gpsAccuracy: this.lastGpsReading?.accuracy ? Math.round(this.lastGpsReading.accuracy) : 0,
      acceleration: accel.extra?.acceleration || brake.extra?.acceleration || 0,
      heading: this.lastGpsReading?.heading ? Math.round(this.lastGpsReading.heading) : 0,
      headingChange: Math.round(this.lastHeadingChange),
      roadSpeedLimit: this.contextualSpeedLimit || SafetyConfig.DEFAULT_ROAD_SPEED_LIMIT_KMH,
      overspeedConfidence: overspeed.confidence,
      hardBraking: toLabel(brake),
      rapidAcceleration: toLabel(accel),
      harshCornering: toLabel(corner),
      possibleDistraction: toLabel(distract),
      currentSafetyState: this.stateMachine.getState(),
      lastConfirmedEvent: this.lastConfirmedEvent,
      activeCooldowns: this.eventManager.getActiveCooldowns(),
    };

    this.debugListeners.forEach((fn) => {
      try {
        fn(state);
      } catch (_) {}
    });
  }

  private updateDrivingMetrics(gps: GpsReading, isVehicle: boolean): void {
    const now = gps.timestamp || Date.now();
    if (isVehicle) {
      if (this.sessionDrivingStartTime === 0) {
        this.sessionDrivingStartTime = now;
      } else {
        this.sessionDrivingTimeSec += Math.round((now - this.sessionDrivingStartTime) / 1000);
        this.sessionDrivingStartTime = now;
      }

      if (this.lastPosForDistance) {
        const d = this.calculateDistanceKm(
          this.lastPosForDistance.lat,
          this.lastPosForDistance.lng,
          gps.latitude,
          gps.longitude
        );
        if (d > 0.005 && d < 10) {
          this.sessionDistanceKm += d;
        }
      }
      this.lastPosForDistance = { lat: gps.latitude, lng: gps.longitude };
    } else {
      this.sessionDrivingStartTime = 0;
      this.lastPosForDistance = null;
    }
  }

  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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

  private getCooldownForType(type: string): number {
    switch (type) {
      case 'RAPID_ACCELERATION':
        return SafetyConfig.COOLDOWN_RAPID_ACCEL_MS;
      case 'HARD_BRAKING':
        return SafetyConfig.COOLDOWN_HARD_BRAKING_MS;
      case 'HARSH_CORNERING':
        return SafetyConfig.COOLDOWN_HARSH_CORNERING_MS;
      case 'OVERSPEEDING':
        return SafetyConfig.COOLDOWN_OVERSPEEDING_MS;
      case 'POSSIBLE_DISTRACTED_DRIVING':
        return SafetyConfig.COOLDOWN_DISTRACTION_MS;
      default:
        return 15000;
    }
  }
}

export const safetyDetectionEngine = SafetyDetectionEngine.getInstance();
