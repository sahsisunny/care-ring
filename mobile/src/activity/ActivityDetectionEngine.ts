/**
 * Activity Detection Engine: Main Coordinator
 * Ties together Sensor Fusion, State Machine, Hardware Sensors, Battery Optimization,
 * and History.
 */

let Accelerometer: any = null;
let Gyroscope: any = null;
try {
  const Sensors = require('expo-sensors');
  Accelerometer = Sensors.Accelerometer;
  Gyroscope = Sensors.Gyroscope;
} catch (_) {}
import { ActivityConfig } from './ActivityConfig';
import { ActivityHistory } from './ActivityHistory';
import {
  ActivityRecognitionProvider,
  activityRecognitionProvider,
} from './ActivityRecognitionProvider';
import { SensorFusion } from './SensorFusion';
import {
  ActivityChangeListener,
  ActivityDebugInfo,
  ActivityState,
  ActivityType,
  DebugInfoListener,
  GpsReading,
  MotionReading,
} from './types';

export class ActivityDetectionEngine {
  private static instance: ActivityDetectionEngine;
  private sensorFusion: SensorFusion;
  private history = new ActivityHistory();
  private osProvider: ActivityRecognitionProvider;

  private accelerometerSubscription: any = null;
  private gyroscopeSubscription: any = null;
  private lastGyroReading: { x: number; y: number; z: number } | null = null;

  private activityChangeListeners = new Set<ActivityChangeListener>();
  private debugListeners = new Set<DebugInfoListener>();

  private isRunning = false;
  private currentSamplingHz = ActivityConfig.SENSOR_SAMPLING_RATE_STATIONARY_HZ;

  public constructor(osProvider: ActivityRecognitionProvider = activityRecognitionProvider) {
    this.osProvider = osProvider;
    this.sensorFusion = new SensorFusion(this.osProvider);
    this.history.load().catch(() => {});
  }

  public static getInstance(): ActivityDetectionEngine {
    if (!ActivityDetectionEngine.instance) {
      ActivityDetectionEngine.instance = new ActivityDetectionEngine();
    }
    return ActivityDetectionEngine.instance;
  }

  /**
   * Start hardware sensors and initialize engine.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.osProvider.initialize();
    this.startMotionSensors(ActivityConfig.SENSOR_SAMPLING_RATE_STATIONARY_HZ);
  }

  /**
   * Stop sensors and cleanup.
   */
  public stop(): void {
    this.isRunning = false;
    this.stopMotionSensors();
  }

  /**
   * Ingest a GPS position update from foreground or background tracker.
   */
  public feedGpsLocation(location: {
    latitude: number;
    longitude: number;
    speed?: number | null; // m/s or km/h
    accuracy?: number | null;
    heading?: number | null;
    altitude?: number | null;
    timestamp?: number;
    speedInKmh?: boolean;
  }): ActivityState {
    const rawSpeed = location.speed !== null && location.speed !== undefined && location.speed >= 0
      ? location.speed
      : 0;
    const speedKmh = location.speedInKmh ? rawSpeed : rawSpeed * 3.6;

    const reading: GpsReading = {
      latitude: location.latitude,
      longitude: location.longitude,
      speed: speedKmh,
      rawSpeedMs: location.speedInKmh ? rawSpeed / 3.6 : rawSpeed,
      accuracy: location.accuracy || undefined,
      heading: location.heading || undefined,
      altitude: location.altitude || undefined,
      timestamp: location.timestamp || Date.now(),
    };

    const prevState = this.sensorFusion.getCurrentState();
    const newState = this.sensorFusion.processGps(reading);

    this.history.updateCurrentMetrics(speedKmh);

    // Adaptive sampling adjustment based on state machine state (Battery Optimization, Section 21)
    if (newState.stateMachineState === 'ACTIVITY_CHANGE_CANDIDATE' || newState.stateMachineState === 'MOVEMENT_STARTED') {
      this.adjustSamplingRate(ActivityConfig.SENSOR_SAMPLING_RATE_TRANSITION_HZ);
    } else if (newState.isMoving) {
      this.adjustSamplingRate(ActivityConfig.SENSOR_SAMPLING_RATE_MOVING_HZ);
    } else {
      this.adjustSamplingRate(ActivityConfig.SENSOR_SAMPLING_RATE_STATIONARY_HZ);
    }

    // Check if confirmed activity changed
    if (prevState.confirmedActivity !== newState.confirmedActivity) {
      this.history.recordTransition(
        newState.confirmedActivity,
        newState.confidence,
        speedKmh,
        newState.evidence,
        reading.timestamp
      );
      this.notifyActivityChange(newState);
    }

    this.notifyDebugInfo();
    return newState;
  }

  /**
   * Feed motion reading directly (used by sensors or test suites).
   */
  public feedMotion(reading: MotionReading): void {
    this.sensorFusion.processMotion(reading);
  }

  public getConfirmedActivity(): ActivityType {
    return this.sensorFusion.getCurrentState().confirmedActivity;
  }

  public getCurrentState(): ActivityState {
    return this.sensorFusion.getCurrentState();
  }

  public getDebugInfo(): ActivityDebugInfo {
    return this.sensorFusion.getDebugInfo();
  }

  public getHistory(): ActivityHistory {
    return this.history;
  }

  public subscribeActivityChange(listener: ActivityChangeListener): () => void {
    this.activityChangeListeners.add(listener);
    return () => {
      this.activityChangeListeners.delete(listener);
    };
  }

  public subscribeDebugInfo(listener: DebugInfoListener): () => void {
    this.debugListeners.add(listener);
    return () => {
      this.debugListeners.delete(listener);
    };
  }

  private notifyActivityChange(state: ActivityState): void {
    this.activityChangeListeners.forEach((fn) => {
      try {
        fn(state);
      } catch (_) {}
    });
  }

  private notifyDebugInfo(): void {
    if (this.debugListeners.size === 0) return;
    const info = this.sensorFusion.getDebugInfo();
    this.debugListeners.forEach((fn) => {
      try {
        fn(info);
      } catch (_) {}
    });
  }

  private adjustSamplingRate(targetHz: number): void {
    if (this.currentSamplingHz === targetHz) return;
    this.currentSamplingHz = targetHz;
    this.startMotionSensors(targetHz);
  }

  private startMotionSensors(hz: number): void {
    this.stopMotionSensors();

    const intervalMs = Math.round(1000 / Math.max(1, hz));

    try {
      Accelerometer.setUpdateInterval(intervalMs);
      this.accelerometerSubscription = Accelerometer.addListener((data: { x: number; y: number; z: number }) => {
        const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
        this.sensorFusion.processMotion({
          x: data.x,
          y: data.y,
          z: data.z,
          magnitude: mag,
          gyroX: this.lastGyroReading?.x,
          gyroY: this.lastGyroReading?.y,
          gyroZ: this.lastGyroReading?.z,
          timestamp: Date.now(),
        });
      });
    } catch (_) {}

    // Only activate Gyroscope during movement or transition candidate (Battery strategy, Section 21)
    if (hz > ActivityConfig.SENSOR_SAMPLING_RATE_STATIONARY_HZ) {
      try {
        Gyroscope.setUpdateInterval(intervalMs);
        this.gyroscopeSubscription = Gyroscope.addListener((gData: { x: number; y: number; z: number }) => {
          this.lastGyroReading = { x: gData.x, y: gData.y, z: gData.z };
        });
      } catch (_) {}
    }
  }

  private stopMotionSensors(): void {
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }
    if (this.gyroscopeSubscription) {
      this.gyroscopeSubscription.remove();
      this.gyroscopeSubscription = null;
    }
    this.lastGyroReading = null;
  }
}

export const activityDetectionEngine = ActivityDetectionEngine.getInstance();
