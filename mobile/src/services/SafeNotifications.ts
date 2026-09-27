import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

/**
 * SafeNotifications wrapper:
 * In Expo SDK 53+, expo-notifications throws a fatal error on Android when running inside Expo Go:
 * "Error: expo-notifications: Android Push notifications functionality provided by expo-notifications
 * was removed from Expo Go with the release of SDK 53. Use a development build instead of Expo Go."
 * 
 * This module safely guards all notifications APIs so the app runs smoothly in:
 * 1. Expo Go (Android & iOS Emulators / Physical Devices)
 * 2. Standalone Development Builds (npx expo run:android / run:ios)
 * 3. Standalone Production APKs / AABs
 */
const getNativeNotifications = () => {
  if (Platform.OS === 'web' || isRunningInExpoGo()) {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch (err) {
    console.warn('[SafeNotifications] Could not load expo-notifications:', err);
    return null;
  }
};

export const SafeNotifications = {
  isExpoGo: isRunningInExpoGo(),

  setNotificationHandler: (handler: any) => {
    const mod = getNativeNotifications();
    if (mod?.setNotificationHandler) {
      try {
        mod.setNotificationHandler(handler);
      } catch (_) {}
    }
  },

  setNotificationChannelAsync: async (channelId: string, channelConfig: any): Promise<any> => {
    const mod = getNativeNotifications();
    if (mod?.setNotificationChannelAsync) {
      try {
        return await mod.setNotificationChannelAsync(channelId, channelConfig);
      } catch (_) {
        return null;
      }
    }
    return null;
  },

  getPermissionsAsync: async (): Promise<{ status: string; granted: boolean }> => {
    const mod = getNativeNotifications();
    if (mod?.getPermissionsAsync) {
      try {
        const res = await mod.getPermissionsAsync();
        return {
          status: res?.status || 'granted',
          granted: res?.status === 'granted',
        };
      } catch (_) {
        return { status: 'granted', granted: true };
      }
    }
    // In Expo Go or Web, gracefully return granted so permission flows don't crash
    return { status: 'granted', granted: true };
  },

  requestPermissionsAsync: async (permissionsConfig?: any): Promise<{ status: string; granted: boolean }> => {
    const mod = getNativeNotifications();
    if (mod?.requestPermissionsAsync) {
      try {
        const res = await mod.requestPermissionsAsync(permissionsConfig);
        return {
          status: res?.status || 'granted',
          granted: res?.status === 'granted',
        };
      } catch (_) {
        return { status: 'granted', granted: true };
      }
    }
    return { status: 'granted', granted: true };
  },

  scheduleNotificationAsync: async (request: any): Promise<string | null> => {
    const mod = getNativeNotifications();
    if (mod?.scheduleNotificationAsync) {
      try {
        return await mod.scheduleNotificationAsync(request);
      } catch (err) {
        console.warn('[SafeNotifications] scheduleNotificationAsync error:', err);
        return null;
      }
    }
    return null;
  },
};
