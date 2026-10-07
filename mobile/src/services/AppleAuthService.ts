import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { serverConfigService } from './ServerConfigService';

const APPLE_CLIENT_ID_STORAGE_KEY = '@carering_apple_client_id';

export interface AppleUserProfile {
  email: string;
  fullName: string;
  appleId: string;
}

class AppleAuthService {
  private static instance: AppleAuthService;

  private constructor() {}

  public static getInstance(): AppleAuthService {
    if (!AppleAuthService.instance) {
      AppleAuthService.instance = new AppleAuthService();
    }
    return AppleAuthService.instance;
  }

  /**
   * Retrieves the active Apple Client ID:
   * - In CareRing Cloud mode: checks environment (EXPO_PUBLIC_APPLE_CLIENT_ID).
   * - In Custom Private Server mode: checks custom entered ID or server /api/auth/config.
   */
  public async getClientId(backendUrl?: string): Promise<string> {
    const isCustom = serverConfigService.isCustomServer();

    if (!isCustom) {
      const envId = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
      if (envId && envId.trim().length > 0) {
        return envId.trim();
      }
    }

    try {
      const stored = await AsyncStorage.getItem(APPLE_CLIENT_ID_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch {}

    if (backendUrl) {
      try {
        const httpBase = backendUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
        const res = await fetch(`${httpBase}/api/auth/config`);
        if (res.ok) {
          const data = await res.json();
          if (data.appleClientId && data.appleClientId.trim().length > 0) {
            return data.appleClientId.trim();
          }
        }
      } catch {}
    }

    const fallbackEnv = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;
    if (fallbackEnv && fallbackEnv.trim().length > 0) {
      return fallbackEnv.trim();
    }

    return '';
  }

  /**
   * Stores custom Apple Client ID / Service ID for private server
   */
  public async setClientId(clientId: string): Promise<void> {
    try {
      if (clientId && clientId.trim().length > 0) {
        await AsyncStorage.setItem(APPLE_CLIENT_ID_STORAGE_KEY, clientId.trim());
      } else {
        await AsyncStorage.removeItem(APPLE_CLIENT_ID_STORAGE_KEY);
      }
    } catch {}
  }

  /**
   * Check if native Apple Authentication is available on this platform/device.
   */
  public async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }
    try {
      return await AppleAuthentication.isAvailableAsync();
    } catch {
      return false;
    }
  }

  /**
   * Triggers native Sign in with Apple sheet on iOS.
   */
  public async promptAsync(): Promise<AppleUserProfile | null> {
    const isAvail = await this.isAvailable();
    if (!isAvail) {
      throw new Error('NATIVE_APPLE_AUTH_UNAVAILABLE');
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Apple only returns email & fullName on the FIRST sign-in
      // If returning user, email might be inside identityToken
      let email = credential.email;
      let fullName = '';

      if (credential.fullName) {
        const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
        fullName = parts.join(' ');
      }

      // If email was null (subsequent logins), decode identityToken payload
      if (!email && credential.identityToken) {
        email = this.decodeEmailFromJwt(credential.identityToken);
      }

      if (!email) {
        throw new Error('Could not retrieve an email address from Apple Sign-In.');
      }

      return {
        email: email.trim().toLowerCase(),
        fullName: fullName || email.split('@')[0],
        appleId: credential.user,
      };
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return null; // User cancelled Apple modal
      }
      throw err;
    }
  }

  /**
   * Decodes email from Apple's JWT identity token
   */
  private decodeEmailFromJwt(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        // Base64URL decode
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonStr);
        return payload.email || null;
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export const appleAuthService = AppleAuthService.getInstance();
