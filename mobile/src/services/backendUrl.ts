import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Live Production Render Cloud Endpoint
const PRODUCTION_WS_URL = 'wss://care-ring.onrender.com';

export function getBackendWsUrl(): string {
  // If explicitly overridden via environment variable
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  // Default to live production server so anyone anywhere can test the app
  return PRODUCTION_WS_URL;
}
