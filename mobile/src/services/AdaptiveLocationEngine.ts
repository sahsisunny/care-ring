import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { TelemetryPing } from '../models/Telemetry';
import { activityDetectionEngine } from '../activity';
import { safetyDetectionEngine } from '../safety';
import { safetyService } from './SafetyService';

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

  private locationSubscription: Location.LocationSubscription | null = null;
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

    // 1. Initialize Activity Detection Engine
    try {
      await activityDetectionEngine.start();
    } catch (e) {
      console.warn('[LocationEngine] ActivityDetectionEngine start error:', e);
    }

    // 2. Initialize Battery Monitoring
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

    // 3. Request Location Permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[LocationEngine] Location permission denied.');
      throw new Error('Location permission denied');
    }

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

  private handlePositionUpdate(location: Location.LocationObject): void {
    this.lastLocation = location;
    const rawSpeed = location.coords.speed !== null && location.coords.speed >= 0 ? location.coords.speed : 0;
    const speedKmh = rawSpeed * 3.6; // convert m/s to km/h
    this.lastSpeed = speedKmh;

    // Feed location to Smart Activity Detection Engine
    const activityState = activityDetectionEngine.feedGpsLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: rawSpeed,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      altitude: location.coords.altitude,
      timestamp: location.timestamp || Date.now(),
      speedInKmh: false,
    });

    // Feed location and vehicle context to Driving Safety Detection Engine
    const confirmed = activityState.confirmedActivity;
    const safetyEvent = safetyDetectionEngine.feedGpsLocation(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: speedKmh,
        accuracy: location.coords.accuracy || undefined,
        heading: location.coords.heading || undefined,
        altitude: location.coords.altitude || undefined,
        timestamp: location.timestamp || Date.now(),
      },
      confirmed,
      activityState.confidence,
      this.userId,
      this.circleId
    );

    if (safetyEvent) {
      safetyService.syncSafetyEvent(safetyEvent).catch(() => {});
    }
    let targetProfile: TrackingProfile = 'stationary';

    if (
      activityState.stateMachineState === 'ACTIVITY_CHANGE_CANDIDATE' ||
      activityState.stateMachineState === 'MOVEMENT_STARTED' ||
      confirmed === 'DRIVING' ||
      confirmed === 'RIDING' ||
      speedKmh > 15.0
    ) {
      targetProfile = 'moving';
    } else if (confirmed === 'WALKING' || confirmed === 'RUNNING' || confirmed === 'CYCLING' || speedKmh > 2.0) {
      targetProfile = 'walking';
    } else {
      targetProfile = 'stationary';
    }

    if (targetProfile !== this.currentProfile) {
      this.applyTrackingProfile(targetProfile);
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
      activity: confirmed.toLowerCase(),
      activityConfidence: activityState.confidence,
      activityStartedAt: activityState.startedAt,
    };

    this.onTelemetry?.(ping);
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    if (this.batterySubscription) {
      this.batterySubscription.remove();
      this.batterySubscription = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    activityDetectionEngine.stop();
  }
}
