import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Ensure any existing auth sessions in web browser are completed
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_STORAGE_KEY = '@carering_google_client_id';

export interface GoogleUserProfile {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  googleId: string;
}

class GoogleAuthService {
  private static instance: GoogleAuthService;

  private constructor() {}

  public static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Retrieves the active Google Client ID from backend server config, environment, or AsyncStorage override.
   */
  public async getClientId(backendUrl?: string): Promise<string> {
    // 1. Try fetching from active server /api/auth/config (cloud or self-hosted)
    if (backendUrl) {
      try {
        const httpBase = backendUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
        const res = await fetch(`${httpBase}/api/auth/config`);
        if (res.ok) {
          const data = await res.json();
          if (data.googleClientId && data.googleClientId.trim().length > 0) {
            return data.googleClientId.trim();
          }
        }
      } catch {
        // ignore network error
      }
    }

    // 2. Check local environment variable
    const envClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (envClientId && envClientId.trim().length > 0) {
      return envClientId.trim();
    }

    // 3. Check locally stored override
    try {
      const stored = await AsyncStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch {
      // ignore
    }
    return '';
  }

  /**
   * Saves a custom Google Client ID (for dev or self-hosted configurations).
   */
  public async setClientId(clientId: string): Promise<void> {
    try {
      if (clientId && clientId.trim().length > 0) {
        await AsyncStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, clientId.trim());
      } else {
        await AsyncStorage.removeItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[GoogleAuthService] Failed to persist client id:', e);
    }
  }

  /**
   * Computes the OAuth redirect URI for this app.
   */
  public getRedirectUri(): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    return AuthSession.makeRedirectUri({
      scheme: 'carering',
    });
  }

  /**
   * Starts the authentic Google OAuth 2.0 flow using system browser.
   * Prompts the user to log into their real Google account.
   */
  public async promptAsync(backendUrl?: string): Promise<GoogleUserProfile | null> {
    const clientId = await this.getClientId(backendUrl);
    if (!clientId) {
      throw new Error(
        'GOOGLE_CLIENT_ID_REQUIRED: Please configure GOOGLE_CLIENT_ID on your server or client to connect with an actual Google account.'
      );
    }

    const redirectUri = this.getRedirectUri();
    const scopes = ['openid', 'profile', 'email'];

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&prompt=select_account`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success' || !result.url) {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return null; // User cancelled
      }
      throw new Error(`Google sign-in was not completed (Status: ${result.type})`);
    }

    // Extract access_token from return URL (fragment or query string)
    const accessToken = this.extractTokenFromUrl(result.url);
    if (!accessToken) {
      const errorMsg = this.extractParam(result.url, 'error_description') || this.extractParam(result.url, 'error');
      throw new Error(errorMsg || 'Failed to obtain access token from Google');
    }

    // Fetch user profile from official Google UserInfo endpoint
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userinfoRes.ok) {
      const errBody = await userinfoRes.text();
      throw new Error(`Failed to retrieve Google profile: ${errBody}`);
    }

    const googleUser = await userinfoRes.json();
    if (!googleUser.email) {
      throw new Error('Google account did not return a valid email address.');
    }

    return {
      email: String(googleUser.email).toLowerCase(),
      fullName: String(googleUser.name || googleUser.given_name || 'Google User'),
      avatarUrl: googleUser.picture ? String(googleUser.picture) : null,
      googleId: String(googleUser.sub || `g_${Date.now()}`),
    };
  }

  private extractTokenFromUrl(url: string): string | null {
    // Check fragment: #access_token=...
    const hashIdx = url.indexOf('#');
    if (hashIdx !== -1) {
      const fragment = url.substring(hashIdx + 1);
      const params = new URLSearchParams(fragment);
      const token = params.get('access_token');
      if (token) return token;
    }

    // Check query params: ?access_token=...
    const queryIdx = url.indexOf('?');
    if (queryIdx !== -1) {
      const query = url.substring(queryIdx + 1);
      const params = new URLSearchParams(query);
      const token = params.get('access_token');
      if (token) return token;
    }

    return null;
  }

  private extractParam(url: string, paramName: string): string | null {
    const raw = url.includes('#') ? url.split('#')[1] : (url.includes('?') ? url.split('?')[1] : '');
    const params = new URLSearchParams(raw);
    return params.get(paramName);
  }
}

export const googleAuthService = GoogleAuthService.getInstance();
