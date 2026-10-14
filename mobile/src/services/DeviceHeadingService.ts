/**
 * Device Heading Service
 * High-performance real-time sensor fusion for mobile device orientation.
 * Fuses Magnetometer and Accelerometer with tilt compensation and circular
 * smoothing filter to deliver smooth, accurate, jitter-free compass heading.
 */

import { Platform, AppState, AppStateStatus } from 'react-native';

export type HeadingListener = (heading: number) => void;

interface SensorSubscription {
  remove: () => void;
}

export class DeviceHeadingService {
  private static instance: DeviceHeadingService | null = null;

  // Sensor modules
  private Magnetometer: any = null;
  private Accelerometer: any = null;

  // Subscriptions
  private magSub: SensorSubscription | null = null;
  private accelSub: SensorSubscription | null = null;
  private appStateSub: any = null;

  // State
  private isRunning = false;
  private isAvailable = false;
  private listeners = new Set<HeadingListener>();

  // Cached sensor vectors
  private lastAccel = { x: 0, y: 0, z: 1 };
  private currentHeading = -1;
  private lastDispatchedHeading = -1;
  private lastDispatchTime = 0;

  // Calibration bounds (only applied when adequate magnetic span > 25μT is confirmed)
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
    return Math.max(0, this.currentHeading);
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    if (nextState === 'active') {
      if (this.isRunning && this.listeners.size > 0) {
        this.startNativeSensors().catch(() => {});
      }
    } else {
      this.stopSubscriptions();
    }
  };

  private async startNativeSensors(): Promise<void> {
    this.stopSubscriptions();

    if (!this.Magnetometer) return;

    try {
      const isAvailable = await this.checkAvailability();
      if (!isAvailable) return;

      const UPDATE_INTERVAL_MS = 40; // 25 Hz update rate for silky smooth motion

      // 1. Accelerometer (for Tilt Compensation)
      if (this.Accelerometer) {
        try {
          this.Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
          this.accelSub = this.Accelerometer.addListener((data: { x: number; y: number; z: number }) => {
            // Smooth accelerometer readings with low-pass filter
            const alpha = 0.15;
            this.lastAccel = {
              x: this.lastAccel.x * (1 - alpha) + data.x * alpha,
              y: this.lastAccel.y * (1 - alpha) + data.y * alpha,
              z: this.lastAccel.z * (1 - alpha) + data.z * alpha,
            };
          });
        } catch (_) {}
      }

      // 2. Magnetometer (Compass heading)
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

    // Track min/max bounds
    this.minMag.x = Math.min(this.minMag.x, data.x);
    this.maxMag.x = Math.max(this.maxMag.x, data.x);
    this.minMag.y = Math.min(this.minMag.y, data.y);
    this.maxMag.y = Math.max(this.maxMag.y, data.y);
    this.minMag.z = Math.min(this.minMag.z, data.z);
    this.maxMag.z = Math.max(this.maxMag.z, data.z);

    // Only apply hard-iron offset if a legitimate 360-degree span (> 25μT) has been observed
    const spanX = this.maxMag.x - this.minMag.x;
    const spanY = this.maxMag.y - this.minMag.y;
    const spanZ = this.maxMag.z - this.minMag.z;

    const offsetX = spanX > 25 ? (this.minMag.x + this.maxMag.x) / 2 : 0;
    const offsetY = spanY > 25 ? (this.minMag.y + this.maxMag.y) / 2 : 0;
    const offsetZ = spanZ > 25 ? (this.minMag.z + this.maxMag.z) / 2 : 0;

    const mx = data.x - offsetX;
    const my = data.y - offsetY;
    const mz = data.z - offsetZ;

    // Accelerometer tilt values
    const ax = this.lastAccel.x;
    const ay = this.lastAccel.y;
    const az = this.lastAccel.z;

    const normA = Math.sqrt(ax * ax + ay * ay + az * az);
    let pitch = 0;
    let roll = 0;

    if (normA > 0.1) {
      const nAx = ax / normA;
      const nAy = ay / normA;
      const nAz = az / normA;
      // Pitch (rotation around X axis, phone tilted up/down)
      pitch = Math.asin(-Math.max(-1, Math.min(1, nAy)));
      // Roll (rotation around Y axis, phone tilted left/right)
      roll = Math.atan2(nAx, nAz);
    }

    // Tilt Compensation (Horizontal projection of magnetic vector)
    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    const Xh = mx * cosRoll + mz * sinRoll;
    const Yh = mx * sinPitch * sinRoll + my * cosPitch - mz * sinPitch * cosRoll;

    // Calculate heading (0° = North, 90° = East, 180° = South, 270° = West)
    let targetHeading = Math.atan2(-Xh, Yh) * (180 / Math.PI);
    if (targetHeading < 0) {
      targetHeading += 360;
    }

    // Smooth heading using circular low-pass filter
    if (this.currentHeading < 0) {
      this.currentHeading = targetHeading;
    } else {
      // Shortest angular difference (-180° to +180°)
      const delta = ((targetHeading - this.currentHeading + 540) % 360) - 180;
      // Smooth factor: 0.20 gives instant, natural human tracking without jitter or spinning
      this.currentHeading = (this.currentHeading + 0.20 * delta + 360) % 360;
    }

    this.dispatchHeading(this.currentHeading);
  }

  private dispatchHeading(heading: number): void {
    const now = Date.now();
    const rounded = Math.round(heading * 10) / 10;

    // Threshold filter: dispatch if changed by >= 0.8° or after 100ms
    const delta = Math.abs(this.shortestAngleDelta(this.lastDispatchedHeading, rounded));
    if (delta >= 0.8 || now - this.lastDispatchTime >= 100) {
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
        heading = event.webkitCompassHeading;
      } else if (event.alpha != null) {
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
  }
}

export const deviceHeadingService = DeviceHeadingService.getInstance();
