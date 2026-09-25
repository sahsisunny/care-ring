import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Live Production Render Cloud Endpoint
const PRODUCTION_WS_URL = 'wss://care-ring.onrender.com';

export function getBackendWsUrl(): string {
  // If explicitly overridden via environment variable
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

  // For local development runs, point to the local backend API
  if (isDev) {
    // Web browser runs directly on localhost
    if (Platform.OS === 'web') {
      return 'ws://127.0.0.1:4000';
    }

    // When running in Expo Go or dev client on a physical phone or simulator,
    // hostUri provides the machine's local LAN IP (e.g., 192.168.1.3:8081).
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `ws://${host}:4000`;
      }
    }

    // Android emulator special loopback alias to host machine
    if (Platform.OS === 'android') {
      return 'ws://10.0.2.2:4000';
    }

    // Local network machine IP fallback (or localhost for iOS simulator)
    return 'ws://192.168.1.3:4000';
  }

  // Standalone production builds default to deployed cloud backend
  return PRODUCTION_WS_URL;
}

