/**
 * Device Heading Service
 * High-performance real-time sensor fusion for mobile device orientation.
 * Fuses Magnetometer, Accelerometer (tilt compensation), and Gyroscope
 * via a complementary filter to deliver accurate, jitter-free heading.
 */

import { Platform, AppState, AppStateStatus } from 'react-native';

export type HeadingListener = (heading: number, accuracy?: number) => void;

interface SensorSubscription {
  remove: () => void;
}

export class DeviceHeadingService {
  private static instance: DeviceHeadingService | null = null;

  // Sensor modules (loaded safely to avoid crashing in web or mock environments)
  private Magnetometer: any = null;
  private Accelerometer: any = null;
  private Gyroscope: any = null;

  // Subscriptions
  private magSub: SensorSubscription | null = null;
  private accelSub: SensorSubscription | null = null;
  private gyroSub: SensorSubscription | null = null;
  private appStateSub: any = null;

  // State
  private isRunning = false;
  private isAvailable = false;
  private listeners = new Set<HeadingListener>();

  // Cached sensor vectors
  private lastAccel = { x: 0, y: 0, z: 1 };
  private lastMag = { x: 0, y: 0, z: 0 };
  private lastGyroTime = 0;
  private currentHeading = 0;
  private lastDispatchedHeading = -1;
  private lastDispatchTime = 0;

  // Auto-calibration (Hard-iron offset tracking)
  private minMag = { x: Infinity, y: Infinity, z: Infinity };
  private maxMag = { x: -Infinity, y: -Infinity, z: -Infinity };

  private constructor() {
    this.loadModules();
  }

  public static getInstance(): DeviceHeadingService {
    if (!DeviceHeadingService.instance) {
      DeviceHeadingService.instance = new DeviceHeadingService();
    }
    return DeviceHeadingService.instance;
  }

  private loadModules(): void {
    if (Platform.OS === 'web') return;
    try {
      const Sensors = require('expo-sensors');
      this.Magnetometer = Sensors.Magnetometer;
      this.Accelerometer = Sensors.Accelerometer;
      this.Gyroscope = Sensors.Gyroscope;
    } catch (e) {
      console.warn('[DeviceHeadingService] expo-sensors not available:', e);
    }
  }

  public async checkAvailability(): Promise<boolean> {
    if (Platform.OS === 'web') {
      this.isAvailable = typeof window !== 'undefined' && ('DeviceOrientationEvent' in window);
      return this.isAvailable;
    }

    if (!this.Magnetometer) {
      this.isAvailable = false;
      return false;
    }

    try {
      const magAvailable = await this.Magnetometer.isAvailableAsync?.();
      this.isAvailable = Boolean(magAvailable);
      return this.isAvailable;
    } catch (_) {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Start streaming real-time heading
   */
  public async start(listener?: HeadingListener): Promise<void> {
    if (listener) {
      this.listeners.add(listener);
    }

    if (this.isRunning) {
      if (listener && this.currentHeading >= 0) {
        listener(this.currentHeading);
      }
      return;
    }

    this.isRunning = true;

    // Handle AppState to automatically stop sensors when backgrounded (battery saver)
    if (!this.appStateSub) {
      this.appStateSub = AppState.addEventListener('change', this.handleAppStateChange);
    }

    if (Platform.OS === 'web') {
      this.startWebOrientation();
      return;
    }

    await this.startNativeSensors();
  }

  /**
   * Stop heading streaming
   */
  public stop(listener?: HeadingListener): void {
    if (listener) {
      this.listeners.delete(listener);
    }

    if (this.listeners.size === 0) {
      this.stopSubscriptions();
      this.isRunning = false;

      if (this.appStateSub) {
        this.appStateSub.remove();
        this.appStateSub = null;
      }
    }
  }

  public getCurrentHeading(): number {
    return this.currentHeading;
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    if (nextState === 'active') {
      if (this.isRunning && this.listeners.size > 0) {
        this.startNativeSensors().catch(() => {});
      }
    } else {
      // Pause hardware sensors when app is in background to preserve battery
      this.stopSubscriptions();
    }
  };

  private async startNativeSensors(): Promise<void> {
    this.stopSubscriptions();

    if (!this.Magnetometer) return;

    try {
      const isAvailable = await this.checkAvailability();
      if (!isAvailable) return;

      const UPDATE_INTERVAL_MS = 50; // 20 Hz update rate (smooth and battery efficient)

      // 1. Accelerometer (for Tilt Compensation)
      if (this.Accelerometer) {
        try {
          this.Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
          this.accelSub = this.Accelerometer.addListener((data: { x: number; y: number; z: number }) => {
            // Low-pass filter accelerometer to isolate gravity from hand shaking
            const alpha = 0.2;
            this.lastAccel = {
              x: this.lastAccel.x * (1 - alpha) + data.x * alpha,
              y: this.lastAccel.y * (1 - alpha) + data.y * alpha,
              z: this.lastAccel.z * (1 - alpha) + data.z * alpha,
            };
          });
        } catch (_) {}
      }

      // 2. Gyroscope (for zero-latency responsiveness and jitter reduction)
      if (this.Gyroscope) {
        try {
          this.Gyroscope.setUpdateInterval(UPDATE_INTERVAL_MS);
          this.lastGyroTime = Date.now();
          this.gyroSub = this.Gyroscope.addListener((data: { x: number; y: number; z: number }) => {
            const now = Date.now();
            if (this.lastGyroTime > 0) {
              const dtSec = Math.min(0.1, (now - this.lastGyroTime) / 1000);
              if (dtSec > 0.005) {
                // Gyroscope rotation around Z axis (radians/sec) -> degrees
                // In device frame, turning right gives negative Z rate
                const gyroDeltaDeg = -data.z * dtSec * (180 / Math.PI);

                // Integrate into heading prediction
                let predicted = (this.currentHeading + gyroDeltaDeg) % 360;
                if (predicted < 0) predicted += 360;
                this.currentHeading = predicted;
              }
            }
            this.lastGyroTime = now;
          });
        } catch (_) {}
      }

      // 3. Magnetometer (True direction reference)
      this.Magnetometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      this.magSub = this.Magnetometer.addListener((data: { x: number; y: number; z: number }) => {
        this.processMagnetometerData(data);
      });
    } catch (err) {
      console.warn('[DeviceHeadingService] startNativeSensors error:', err);
    }
  }

  private processMagnetometerData(data: { x: number; y: number; z: number }): void {
    if (isNaN(data.x) || isNaN(data.y)) return;

    // Rolling min/max for hard-iron auto calibration
    this.minMag.x = Math.min(this.minMag.x, data.x);
    this.maxMag.x = Math.max(this.maxMag.x, data.x);
    this.minMag.y = Math.min(this.minMag.y, data.y);
    this.maxMag.y = Math.max(this.maxMag.y, data.y);
    this.minMag.z = Math.min(this.minMag.z, data.z);
    this.maxMag.z = Math.max(this.maxMag.z, data.z);

    const offsetX = (this.minMag.x + this.maxMag.x) / 2;
    const offsetY = (this.minMag.y + this.maxMag.y) / 2;
    const offsetZ = (this.minMag.z + this.maxMag.z) / 2;

    const mx = data.x - (isFinite(offsetX) ? offsetX : 0);
    const my = data.y - (isFinite(offsetY) ? offsetY : 0);
    const mz = data.z - (isFinite(offsetZ) ? offsetZ : 0);

    // Accelerometer tilt values
    const ax = this.lastAccel.x;
    const ay = this.lastAccel.y;
    const az = this.lastAccel.z;

    // Pitch & Roll in radians
    const normA = Math.sqrt(ax * ax + ay * ay + az * az);
    let pitch = 0;
    let roll = 0;

    if (normA > 0.1) {
      pitch = Math.atan2(ay, Math.sqrt(ax * ax + az * az));
      roll = Math.atan2(-ax, az);
    }

    // Tilt Compensation (Horizontal projection of magnetic vector)
    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    const Xh = mx * cosRoll + mz * sinRoll;
    const Yh = mx * sinPitch * sinRoll + my * cosPitch - mz * sinPitch * cosRoll;

    // Calculate heading (0° = North, 90° = East, 180° = South, 270° = West)
    let magHeadingRad = Math.atan2(-Xh, Yh);
    let magHeadingDeg = (magHeadingRad * 180) / Math.PI;
    if (magHeadingDeg < 0) {
      magHeadingDeg += 360;
    }

    // Complementary Sensor Fusion with Gyroscope
    if (this.gyroSub && this.lastGyroTime > 0) {
      // Calculate shortest angular difference (-180° to +180°)
      const diff = ((magHeadingDeg - this.currentHeading + 540) % 360) - 180;
      // High weight to gyro for instantaneous rotation, steady pull towards mag
      const alpha = 0.88;
      this.currentHeading = (this.currentHeading + (1 - alpha) * diff) % 360;
    } else {
      // Low-pass filter if gyroscope is absent
      const diff = ((magHeadingDeg - this.currentHeading + 540) % 360) - 180;
      this.currentHeading = (this.currentHeading + 0.3 * diff) % 360;
    }

    if (this.currentHeading < 0) {
      this.currentHeading += 360;
    }

    this.dispatchHeading(this.currentHeading);
  }

  private dispatchHeading(heading: number): void {
    const now = Date.now();
    const rounded = Math.round(heading * 10) / 10;

    // Threshold filter: dispatch if changed by >= 0.6° or after 120ms heartbeat
    const delta = Math.abs(this.shortestAngleDelta(this.lastDispatchedHeading, rounded));
    if (delta >= 0.6 || now - this.lastDispatchTime >= 120) {
      this.lastDispatchedHeading = rounded;
      this.lastDispatchTime = now;
      this.listeners.forEach((listener) => {
        try {
          listener(rounded);
        } catch (_) {}
      });
    }
  }

  private shortestAngleDelta(from: number, to: number): number {
    return ((to - from + 540) % 360) - 180;
  }

  private startWebOrientation(): void {
    if (typeof window === 'undefined') return;

    const onDeviceOrientation = (event: any) => {
      let heading = 0;
      if (typeof event.webkitCompassHeading === 'number') {
        // iOS Safari gives direct true compass heading
        heading = event.webkitCompassHeading;
      } else if (event.alpha != null) {
        // Android / standard Web
        heading = (360 - event.alpha) % 360;
      }
      this.currentHeading = heading;
      this.dispatchHeading(heading);
    };

    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    this.magSub = {
      remove: () => {
        window.removeEventListener('deviceorientation', onDeviceOrientation, true);
      },
    };
  }

  private stopSubscriptions(): void {
    if (this.magSub) {
      this.magSub.remove();
      this.magSub = null;
    }
    if (this.accelSub) {
      this.accelSub.remove();
      this.accelSub = null;
    }
    if (this.gyroSub) {
      this.gyroSub.remove();
      this.gyroSub = null;
    }
    this.lastGyroTime = 0;
  }
}

export const deviceHeadingService = DeviceHeadingService.getInstance();
