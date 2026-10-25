// Live Production Render Cloud Endpoint
export const PRODUCTION_WS_URL = 'wss://care-ring.onrender.com';
export const PRODUCTION_HTTP_URL = 'https://care-ring.onrender.com';

let cachedCustomWsUrl: string | null = null;

export function setCustomWsUrlCache(url: string | null): void {
  cachedCustomWsUrl = url;
}

export function getDefaultBackendWsUrl(): string {
  // If explicitly overridden via environment variable (e.g. EXPO_PUBLIC_BACKEND_URL)
  if (process.env.EXPO_PUBLIC_BACKEND_URL && process.env.EXPO_PUBLIC_BACKEND_URL.trim().length > 0) {
    return process.env.EXPO_PUBLIC_BACKEND_URL.trim();
  }

  // Always use the live production cloud endpoint for Expo Go, development, and builds
  return PRODUCTION_WS_URL;
}

export function getBackendWsUrl(): string {
  if (cachedCustomWsUrl) {
    return cachedCustomWsUrl;
  }
  return getDefaultBackendWsUrl();
}
