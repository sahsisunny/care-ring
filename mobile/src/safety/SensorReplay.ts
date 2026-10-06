/**
 * Sensor Dataset Replay and Simulation Tool
 * Implements Section 29 of Safety Detection Layer.md
 *
 * Allows developers and automated tests to replay recorded telemetry without
 * dangerous maneuvers on public roads.
 */

import { ActivityType, GpsReading, MotionReading } from '../activity/types';
import { SafetyDetectionEngine } from './SafetyDetectionEngine';
import { SafetyEvent } from './types';

export interface ReplayDataPoint {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading?: number;
  accuracy?: number;
  timestamp: number;
  activity?: ActivityType;
  activityConfidence?: number;
  motion?: MotionReading;
  touchInteraction?: boolean;
}

export class SensorReplay {
  private engine: SafetyDetectionEngine;

  constructor(engine: SafetyDetectionEngine) {
    this.engine = engine;
  }

  /**
   * Replays an entire time-ordered sequence of sensor readings through the engine
   * and collects any confirmed SafetyEvents emitted.
   */
  public replaySequence(
    points: ReplayDataPoint[],
    defaultActivity: ActivityType = 'DRIVING'
  ): SafetyEvent[] {
    const emittedEvents: SafetyEvent[] = [];

    const unsubscribe = this.engine.subscribeEvents((event) => {
      emittedEvents.push(event);
    });

    for (const pt of points) {
      if (pt.motion) {
        this.engine.feedMotion(pt.motion);
      }
      if (pt.touchInteraction) {
        this.engine.registerUserInteraction(pt.timestamp);
      }

      const gps: GpsReading = {
        latitude: pt.latitude,
        longitude: pt.longitude,
        speed: pt.speed,
        heading: pt.heading,
        accuracy: pt.accuracy || 8,
        timestamp: pt.timestamp,
      };

      const activity = pt.activity || defaultActivity;
      const confidence = pt.activityConfidence ?? 0.95;

      this.engine.feedGpsLocation(gps, activity, confidence);
    }

    unsubscribe();
    return emittedEvents;
  }
}
