import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { Accelerometer } from 'expo-sensors';
import { TelemetryPing } from '../models/Telemetry';

export type TrackingProfile = 'stationary' | 'walking' | 'moving';
export type OnTelemetryCallback = (ping: TelemetryPing) => void;

export class AdaptiveLocationEngine {
  private userId: string;
  private circleId: string;
  private userName?: string;

  private currentProfile: TrackingProfile = 'stationary';
  private batteryLevel = 100;
  private isCharging = false;
  private lastSpeed = 0;
  private lastMovementTime = Date.now();

  private locationSubscription: Location.LocationSubscription | null = null;
  private accelerometerSubscription: any = null;
  private batterySubscription: any = null;
  private heartbeatInterval: any = null;
  private lastLocation: Location.LocationObject | null = null;
  private isDisposed = false;

  public onTelemetry?: OnTelemetryCallback;

  constructor(options: {
    userId: string;
    circleId?: string;
    userName?: string;
    onTelemetry?: OnTelemetryCallback;
  }) {
    this.userId = options.userId;
    this.circleId = options.circleId || '';
    this.userName = options.userName;
    this.onTelemetry = options.onTelemetry;
  }

  public getProfile(): TrackingProfile {
    return this.currentProfile;
  }

  public getLastSpeed(): number {
    return this.lastSpeed;
  }

  public async start(): Promise<void> {
    if (this.isDisposed) return;

    // 1. Initialize Battery Monitoring
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (level >= 0) this.batteryLevel = Math.round(level * 100);

      const state = await Battery.getBatteryStateAsync();
      this.isCharging =
        state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

      this.batterySubscription = Battery.addBatteryStateListener(({ batteryState }) => {
        this.isCharging =
          batteryState === Battery.BatteryState.CHARGING ||
          batteryState === Battery.BatteryState.FULL;
        Battery.getBatteryLevelAsync().then((lvl) => {
          if (lvl >= 0) this.batteryLevel = Math.round(lvl * 100);
        }).catch(() => {});
      });
    } catch (e) {
      console.log('[LocationEngine] Battery API not available in current environment:', e);
    }

    // 2. Request Location Permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[LocationEngine] Location permission denied.');
      throw new Error('Location permission denied');
    }

    // 3. Motion Coprocessor Listener (Accelerometer for significant motion wake-up)
    this.listenToMotionSensors();

    // 4. Apply initial stationary profile
    await this.applyTrackingProfile('stationary');

    // 5. Fetch initial quick fix so peers see this member immediately
    try {
      const initialPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      this.handlePositionUpdate(initialPos);
    } catch (_) {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) this.handlePositionUpdate(last);
      } catch (_) {}
    }

    // 6. Periodic stationary presence heartbeat (every 10s, lightweight cached - avoids GPS thread contention)
    this.heartbeatInterval = setInterval(async () => {
      if (this.isDisposed) return;
      try {
        if (this.lastLocation) {
          this.handlePositionUpdate({
            ...this.lastLocation,
            timestamp: Date.now(),
          });
        } else {
          const pos = await Location.getLastKnownPositionAsync();
          if (pos) {
            this.handlePositionUpdate(pos);
          }
        }
      } catch (_) {}
    }, 10000);
  }

  private async applyTrackingProfile(profile: TrackingProfile): Promise<void> {
    if (this.isDisposed) return;
    this.currentProfile = profile;

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    let accuracy = Location.Accuracy.High;
    let distanceInterval = 5; // meters
    let timeInterval = 4000;  // ms

    switch (profile) {
      case 'stationary':
        accuracy = Location.Accuracy.High;
        distanceInterval = 5;
        timeInterval = 4000;
        break;
      case 'walking':
        accuracy = Location.Accuracy.High;
        distanceInterval = 3;
        timeInterval = 2500;
        break;
      case 'moving':
        accuracy = Location.Accuracy.Highest;
        distanceInterval = 2;
        timeInterval = 1500;
        break;
    }

    try {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy,
          distanceInterval,
          timeInterval,
        },
        (loc) => this.handlePositionUpdate(loc)
      );
      console.log(`[LocationEngine] Switched to profile: ${profile.toUpperCase()}`);
    } catch (err) {
      console.warn('[LocationEngine] watchPositionAsync error:', err);
    }
  }

  private listenToMotionSensors(): void {
    try {
      Accelerometer.setUpdateInterval(1000); // 1 Hz sampling
      this.accelerometerSubscription = Accelerometer.addListener((data) => {
        const totalMagnitude = Math.sqrt(
          data.x * data.x + data.y * data.y + data.z * data.z
        );

        // Standard gravity is ~1.0g. Significant deviation (> 1.4g or < 0.6g) indicates movement
        const delta = Math.abs(totalMagnitude - 1.0);
        if (delta > 0.35 && this.currentProfile === 'stationary') {
          console.log('[LocationEngine] Motion detected via coprocessor! Waking up GPS...');
          this.applyTrackingProfile('walking');
        }
      });
    } catch (err) {
      console.log('[LocationEngine] Accelerometer not available on this device:', err);
    }
  }

  private handlePositionUpdate(location: Location.LocationObject): void {
    this.lastLocation = location;
    const rawSpeed = location.coords.speed !== null && location.coords.speed >= 0 ? location.coords.speed : 0;
    const speedKmh = rawSpeed * 3.6; // convert m/s to km/h
    this.lastSpeed = speedKmh;

    const now = Date.now();

    // Adaptive profile switching logic
    if (speedKmh > 12.0 && this.currentProfile !== 'moving') {
      this.lastMovementTime = now;
      this.applyTrackingProfile('moving');
    } else if (speedKmh > 2.0 && this.currentProfile === 'stationary') {
      this.lastMovementTime = now;
      this.applyTrackingProfile('walking');
    } else if (speedKmh <= 1.5 && this.currentProfile !== 'stationary') {
      // Return to stationary if idle for 60 seconds
      if (now - this.lastMovementTime >= 60000) {
        this.applyTrackingProfile('stationary');
      }
    } else if (speedKmh > 1.5) {
      this.lastMovementTime = now;
    }

    const ping: TelemetryPing = {
      type: 'TELEMETRY_PING',
      userId: this.userId,
      circleId: this.circleId,
      userName: this.userName,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: Math.round(speedKmh * 10) / 10,
      heading: location.coords.heading !== null && location.coords.heading >= 0 ? location.coords.heading : 0,
      batteryLevel: this.batteryLevel,
      isCharging: this.isCharging,
      timestamp: location.timestamp || Date.now(),
      accuracy: location.coords.accuracy || undefined,
      altitude: location.coords.altitude || undefined,
    };

    this.onTelemetry?.(ping);
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }
    if (this.batterySubscription) {
      this.batterySubscription.remove();
      this.batterySubscription = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
