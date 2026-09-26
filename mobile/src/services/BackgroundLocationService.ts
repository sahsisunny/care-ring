import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import { getBackendWsUrl } from './backendUrl';

export const BACKGROUND_LOCATION_TASK = 'CARERING_BACKGROUND_LOCATION_TASK';
const SESSION_STORAGE_KEY = '@carering_auth_session';
const TRACKING_PREF_KEY = '@carering_background_tracking_enabled';

export interface PermissionsStatus {
  foregroundLocation: boolean;
  backgroundLocation: boolean;
  notifications: boolean;
  allGranted: boolean;
}

// 1. Define the Background Task at top-level module scope (required by Expo TaskManager)
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

    // Transmit telemetry ping to backend REST API
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
      }),
    });
  } catch (err) {
    console.warn('[BackgroundLocationService] Failed to post telemetry:', err);
  }
});

class BackgroundLocationService {
  private static instance: BackgroundLocationService;

  public static getInstance(): BackgroundLocationService {
    if (!BackgroundLocationService.instance) {
      BackgroundLocationService.instance = new BackgroundLocationService();
    }
    return BackgroundLocationService.instance;
  }

  /**
   * Check the current state of all permissions needed for 24/7 background timeline tracking.
   */
  public async checkPermissions(): Promise<PermissionsStatus> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      const notif = await Notifications.getPermissionsAsync();

      const foregroundLocation = fg.status === 'granted';
      const backgroundLocation = bg.status === 'granted';
      const notifications = notif.status === 'granted';

      return {
        foregroundLocation,
        backgroundLocation,
        notifications,
        allGranted: foregroundLocation && backgroundLocation,
      };
    } catch (err) {
      console.warn('[BackgroundLocationService] checkPermissions error:', err);
      return {
        foregroundLocation: false,
        backgroundLocation: false,
        notifications: false,
        allGranted: false,
      };
    }
  }

  /**
   * Step-by-step permission sequence required by Android 10+ and iOS:
   * 1. Notifications permission
   * 2. Foreground Location ("While Using the App")
   * 3. Background Location ("Allow all the time")
   */
  public async requestAllPermissions(): Promise<PermissionsStatus> {
    try {
      // 1. Request Notification Permissions (essential on Android 13+ for Foreground Service)
      let notifGranted = false;
      try {
        const notifRes = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        notifGranted = notifRes.status === 'granted';
      } catch (_) {}

      // 2. Request Foreground Location Permission
      const fgRes = await Location.requestForegroundPermissionsAsync();
      const fgGranted = fgRes.status === 'granted';

      if (!fgGranted) {
        return {
          foregroundLocation: false,
          backgroundLocation: false,
          notifications: notifGranted,
          allGranted: false,
        };
      }

      // 3. Request Background Location Permission ("Allow all the time")
      let bgGranted = false;
      if (Platform.OS !== 'web') {
        const bgRes = await Location.requestBackgroundPermissionsAsync();
        bgGranted = bgRes.status === 'granted';
      } else {
        bgGranted = true;
      }

      // If background permission is granted, automatically start background location tracking
      if (bgGranted) {
        await this.startTracking();
      }

      return {
        foregroundLocation: fgGranted,
        backgroundLocation: bgGranted,
        notifications: notifGranted,
        allGranted: fgGranted && bgGranted,
      };
    } catch (err) {
      console.warn('[BackgroundLocationService] requestAllPermissions error:', err);
      return {
        foregroundLocation: false,
        backgroundLocation: false,
        notifications: false,
        allGranted: false,
      };
    }
  }

  /**
   * Start 24/7 background location updates with foreground service notification.
   */
  public async startTracking(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

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
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }
}

export const backgroundLocationService = BackgroundLocationService.getInstance();
