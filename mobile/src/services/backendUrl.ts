import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Live Production Render Cloud Endpoint
export const PRODUCTION_WS_URL = 'wss://care-ring.onrender.com';
export const PRODUCTION_HTTP_URL = 'https://care-ring.onrender.com';
export const LOCAL_DEV_LAN_IP = '192.168.0.109';
export const LOCAL_DEV_HTTP_URL = `http://${LOCAL_DEV_LAN_IP}:4000`;
export const LOCAL_DEV_WS_URL = `ws://${LOCAL_DEV_LAN_IP}:4000`;

// If you're running Expo in Tunnel mode and want the app to reach your LOCAL backend,
// set EXPO_PUBLIC_AI_BACKEND_URL to your ngrok/localtunnel URL (e.g. https://xxxx.ngrok-free.app)
// This is only used for AI routes (chat, tts), which aren't yet deployed on Render.
export const LOCAL_TUNNEL_HTTP_URL: string | null = process.env.EXPO_PUBLIC_AI_BACKEND_URL || null;

let cachedCustomWsUrl: string | null = null;

export function setCustomWsUrlCache(url: string | null): void {
  cachedCustomWsUrl = url;
}

export function getDefaultBackendWsUrl(): string {
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

    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;

    if (hostUri) {
      const host = hostUri.split(':')[0];

      // If Metro is running in Tunnel mode (exp.direct, ngrok, loca.lt), the phone
      // is connecting over the internet and CANNOT reach the Mac's private LAN IP.
      // Fall back to production backend in tunnel mode.
      // To use local API over tunnel: set EXPO_PUBLIC_BACKEND_URL to your ngrok/lt URL.
      const isTunnel =
        host.includes('exp.direct') ||
        host.includes('ngrok') ||
        host.includes('loca.lt');

      if (isTunnel) {
        return PRODUCTION_WS_URL;
      }

      // On same local network: use Metro's host IP as the backend IP too (LAN mode)
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `ws://${host}:4000`;
      }
    }

    // Android emulator special loopback alias to host machine
    if (Platform.OS === 'android') {
      return 'ws://10.0.2.2:4000';
    }

    // Local network machine IP fallback
    return LOCAL_DEV_WS_URL;
  }

  // Standalone production builds default to deployed cloud backend
  return PRODUCTION_WS_URL;
}

export function getBackendWsUrl(): string {
  if (cachedCustomWsUrl) {
    return cachedCustomWsUrl;
  }
  return getDefaultBackendWsUrl();
}

export function getBackendHttpUrl(): string {
  const wsUrl = getBackendWsUrl();
  return wsUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
}


