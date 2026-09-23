import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getBackendWsUrl(): string {
  // If running on web in the browser
  if (Platform.OS === 'web') {
    return 'ws://127.0.0.1:4000';
  }

  // If running in Expo Go on a physical phone or simulator
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `ws://${host}:4000`;
    }
  }

  // Fallback to local machine IP
  return 'ws://192.168.0.8:4000';
}
