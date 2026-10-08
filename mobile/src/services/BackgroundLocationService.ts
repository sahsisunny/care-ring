import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { SafeNotifications } from './SafeNotifications';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { getBackendWsUrl } from './backendUrl';
import { activityDetectionEngine } from '../activity';
import { safetyDetectionEngine } from '../safety';
import { safetyService } from './SafetyService';

const BACKGROUND_LOCATION_TASK = 'CARERING_BACKGROUND_LOCATION_TASK';
const SESSION_STORAGE_KEY = '@carering_auth_session';
const TRACKING_PREF_KEY = '@carering_background_tracking_enabled';

export interface PermissionsStatus {
  foregroundLocation: boolean;
  backgroundLocation: boolean;
  notifications: boolean;
  activityRecognition: boolean;
  allGranted: boolean;
  isExpoGo?: boolean;
}

let PedometerModule: any = null;
try {
  PedometerModule = require('expo-sensors').Pedometer;
} catch (_) {}

// 1. Define the Background Task at top-level module scope (only in standalone native builds)
if (!isRunningInExpoGo() && Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
      if (error) {
        console.warn('[BackgroundLocationService] Task error:', error.message);
        return;
      }

  if (!data) return;

  const { locations } = data as { locations?: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  // Process the most recent location point
  const latest = locations[locations.length - 1];

  try {
    const rawSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) return;

    const session = JSON.parse(rawSession);
    const userId = session.userId;
    const circleId = session.activeCircleId;
    const userName = session.fullName;

    if (!userId || !circleId) return;

    // Convert raw speed (m/s) to km/h
    const rawSpeed = latest.coords.speed !== null && latest.coords.speed >= 0 ? latest.coords.speed : 0;
    const speedKmh = rawSpeed * 3.6;

    // Get current battery level
    let batteryLevel = 100;
    try {
      const lvl = await Battery.getBatteryLevelAsync();
      if (lvl >= 0) batteryLevel = Math.round(lvl * 100);
    } catch (_) {}

    // Resolve backend HTTP endpoint
    const backendWs = getBackendWsUrl();
    const httpBase = backendWs.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');

    // Process through Smart Activity Detection Engine
    const actState = activityDetectionEngine.feedGpsLocation({
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      speed: rawSpeed,
      accuracy: latest.coords.accuracy,
      heading: latest.coords.heading,
      altitude: latest.coords.altitude,
      timestamp: latest.timestamp,
      speedInKmh: false,
    });

    // Process through Driving Safety Detection Engine
    const safetyEvent = safetyDetectionEngine.feedGpsLocation(
      {
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        speed: speedKmh,
        accuracy: latest.coords.accuracy || undefined,
        heading: latest.coords.heading || undefined,
        altitude: latest.coords.altitude || undefined,
        timestamp: latest.timestamp,
      },
      actState.confirmedActivity,
      actState.confidence,
      userId,
      circleId
    );
    if (safetyEvent) {
      safetyService.syncSafetyEvent(safetyEvent, httpBase).catch(() => {});
    }

        const isConfirming =
          actState.stateMachineState === 'MOVEMENT_STARTED' ||
          actState.stateMachineState === 'COLLECTING_DATA' ||
          actState.stateMachineState === 'ACTIVITY_CHANGE_CANDIDATE' ||
          actState.stateMachineState === 'CANDIDATE_ACTIVITY';

        let bgActivity = actState.currentActivity.toLowerCase();
        if (isConfirming) {
          if (bgActivity === 'stationary' || actState.isMoving || speedKmh >= 1.8) {
            bgActivity = 'unknown';
          }
        } else if (speedKmh > 5.0 && bgActivity === 'stationary') {
          bgActivity = 'unknown';
        }

        await fetch(`${httpBase}/api/telemetry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            circleId,
            userName,
            latitude: latest.coords.latitude,
            longitude: latest.coords.longitude,
            speed: Math.round(speedKmh * 10) / 10,
            heading: latest.coords.heading !== null && latest.coords.heading >= 0 ? latest.coords.heading : 0,
            batteryLevel,
            isCharging: false,
            timestamp: latest.timestamp || Date.now(),
            accuracy: latest.coords.accuracy || undefined,
            altitude: latest.coords.altitude || undefined,
            activity: bgActivity,
            activityConfidence: actState.confidence,
            activityStartedAt: actState.startedAt,
          }),
        });
    } catch (err) {
      console.warn('[BackgroundLocationService] Failed to post telemetry:', err);
    }
  });
} catch (e) {
  console.warn('[BackgroundLocationService] Failed to define background task:', e);
}
}

class BackgroundLocationService {
  private static instance: BackgroundLocationService;
  private hasDismissedPermissionsThisSession = false;
  private hasAutoPromptedThisSession = false;

  public static getInstance(): BackgroundLocationService {
    if (!BackgroundLocationService.instance) {
      BackgroundLocationService.instance = new BackgroundLocationService();
    }
    return BackgroundLocationService.instance;
  }

  /**
   * Determine if the permissions modal should be auto-prompted on app startup.
   * Suppressed if user already dismissed ("Maybe Later") or was already prompted during this app session.
   */
  public shouldAutoPromptPermissions(): boolean {
    return !this.hasDismissedPermissionsThisSession && !this.hasAutoPromptedThisSession;
  }

  /**
   * Mark that the permissions modal was auto-prompted once this session.
   */
  public markPermissionsAutoPrompted(): void {
    this.hasAutoPromptedThisSession = true;
  }

  /**
   * Called when user taps "Maybe Later" or dismisses the prompt.
   * Ensures the prompt will not re-appear when navigating or changing pages.
   */
  public dismissPermissionsPromptForSession(): void {
    this.hasDismissedPermissionsThisSession = true;
    this.hasAutoPromptedThisSession = true;
  }

  /**
   * Reset session dismissal flag (e.g. if explicitly needed).
   */
  public resetSessionPermissionsPrompt(): void {
    this.hasDismissedPermissionsThisSession = false;
    this.hasAutoPromptedThisSession = false;
  }

  /**
   * Check the current state of all permissions needed for 24/7 background timeline tracking.
   */
  public async checkPermissions(): Promise<PermissionsStatus> {
    try {
      const inExpoGo = isRunningInExpoGo();
      const fg = await Location.getForegroundPermissionsAsync();
      const notif = await SafeNotifications.getPermissionsAsync();

      const foregroundLocation = fg.status === 'granted';
      // In Expo Go on iOS, Apple strictly blocks background location ("Always").
      // Foreground location is the maximum available permission in Expo Go.
      let backgroundLocation = false;
      if (inExpoGo && Platform.OS === 'ios') {
        backgroundLocation = foregroundLocation;
      } else {
        const bg = await Location.getBackgroundPermissionsAsync();
        backgroundLocation = bg.status === 'granted';
      }

      const notifications = notif.granted || notif.status === 'granted';

      let activityRecognition = false;
      try {
        if (PedometerModule?.getPermissionsAsync) {
          const act = await PedometerModule.getPermissionsAsync();
          activityRecognition = act.status === 'granted' || act.granted;
        } else {
          activityRecognition = true;
        }
      } catch (_) {
        activityRecognition = true;
      }

      return {
        foregroundLocation,
        backgroundLocation,
        notifications,
        activityRecognition,
        allGranted: foregroundLocation && backgroundLocation && notifications && activityRecognition,
        isExpoGo: inExpoGo,
      };
    } catch (err) {
      console.warn('[BackgroundLocationService] checkPermissions error:', err);
      return {
        foregroundLocation: false,
        backgroundLocation: false,
        notifications: false,
        activityRecognition: false,
        allGranted: false,
        isExpoGo: isRunningInExpoGo(),
      };
    }
  }

  /**
   * Step-by-step permission sequence required by Android 10+ and iOS:
   * 1. Notifications permission
   * 2. Foreground Location ("While Using the App")
   * 3. Background Location ("Allow all the time")
   * 4. Physical Activity & Motion Sensors (CoreMotion / Activity Recognition)
   */
  public async requestAllPermissions(): Promise<PermissionsStatus> {
    try {
      const inExpoGo = isRunningInExpoGo();

      // 1. Request Notification Permissions (essential on Android 13+ for Foreground Service)
      let notifGranted = false;
      try {
        const notifRes = await SafeNotifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        notifGranted = notifRes.granted || notifRes.status === 'granted';
      } catch (_) {}

      // 2. Request Foreground Location Permission
      const fgRes = await Location.requestForegroundPermissionsAsync();
      const fgGranted = fgRes.status === 'granted';

      if (!fgGranted) {
        return {
          foregroundLocation: false,
          backgroundLocation: false,
          notifications: notifGranted,
          activityRecognition: false,
          allGranted: false,
          isExpoGo: inExpoGo,
        };
      }

      // 3. Request Background Location Permission ("Allow all the time")
      let bgGranted = false;
      if (Platform.OS !== 'web') {
        if (inExpoGo && Platform.OS === 'ios') {
          // Expo Go on iOS does not support "Always", so foreground satisfies it
          bgGranted = fgGranted;
        } else {
          const bgRes = await Location.requestBackgroundPermissionsAsync();
          bgGranted = bgRes.status === 'granted';
        }
      } else {
        bgGranted = true;
      }

      // 4. Request Motion & Activity Recognition Permission (CoreMotion on iOS / Activity Recognition on Android)
      let actGranted = false;
      try {
        if (PedometerModule?.requestPermissionsAsync) {
          const actRes = await PedometerModule.requestPermissionsAsync();
          actGranted = actRes.status === 'granted' || actRes.granted;
        } else {
          actGranted = true;
        }
      } catch (actErr) {
        console.warn('[BackgroundLocationService] Activity permission request notice:', actErr);
        actGranted = true;
      }

      // If background permission is granted, automatically start background location tracking
      if (bgGranted && !inExpoGo) {
        await this.startTracking();
      }

      return {
        foregroundLocation: fgGranted,
        backgroundLocation: bgGranted,
        notifications: notifGranted,
        activityRecognition: actGranted,
        allGranted: fgGranted && bgGranted && notifGranted && actGranted,
        isExpoGo: inExpoGo,
      };
    } catch (err) {
      console.warn('[BackgroundLocationService] requestAllPermissions error:', err);
      return {
        foregroundLocation: false,
        backgroundLocation: false,
        notifications: false,
        activityRecognition: false,
        allGranted: false,
        isExpoGo: isRunningInExpoGo(),
      };
    }
  }

  /**
   * Start 24/7 background location updates with foreground service notification.
   */
  public async startTracking(): Promise<boolean> {
    if (Platform.OS === 'web' || isRunningInExpoGo()) return false;

    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        console.log('[BackgroundLocationService] Task is already running.');
        await AsyncStorage.setItem(TRACKING_PREF_KEY, 'true');
        return true;
      }

      const bgPerm = await Location.getBackgroundPermissionsAsync();
      if (bgPerm.status !== 'granted') {
        console.warn('[BackgroundLocationService] Cannot start tracking: Background permission not granted.');
        return false;
      }

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 15000, // 15 seconds
        distanceInterval: 15, // 15 meters
        deferredUpdatesInterval: 30000,
        deferredUpdatesDistance: 25,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'CareRing 24/7 Protection Active',
          notificationBody: 'Recording daily timeline and sharing safety location with family',
          notificationColor: '#4F46E5',
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });

      await AsyncStorage.setItem(TRACKING_PREF_KEY, 'true');
      console.log('[BackgroundLocationService] Background location task successfully started.');
      return true;
    } catch (err) {
      console.warn('[BackgroundLocationService] Failed to start background location updates:', err);
      return false;
    }
  }

  /**
   * Stop background location tracking.
   */
  public async stopTracking(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('[BackgroundLocationService] Background location task stopped.');
      }
      await AsyncStorage.setItem(TRACKING_PREF_KEY, 'false');
    } catch (err) {
      console.warn('[BackgroundLocationService] Failed to stop background location updates:', err);
    }
  }

  /**
   * Check if the background location task is currently running.
   */
  public async isTracking(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {
      return false;
    }
  }

  /**
   * Open Android / iOS app settings so the user can change permission to "Allow all the time".
   */
  public openSystemSettings(): void {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => {
        Linking.openSettings();
      });
    } else {
      Linking.openSettings();
    }
  }
}

export const backgroundLocationService = BackgroundLocationService.getInstance();
