import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { serverConfigService } from './ServerConfigService';

// Ensure any existing auth sessions in web browser are completed
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_STORAGE_KEY = '@carering_google_client_id';
const DEFAULT_GOOGLE_CLIENT_ID = '893680039669-hevfe2iasspf77usp7it1je3gg7naer2.apps.googleusercontent.com';
const DEFAULT_GOOGLE_REDIRECT_URI = 'https://auth.expo.io/@sunnyfountane/carering';

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
   * Retrieves the active Google Client ID:
   * - In CareRing Cloud mode: obtains client ID directly from environment (EXPO_PUBLIC_GOOGLE_CLIENT_ID).
   * - In Custom Private Server mode: checks custom entered ID or server /api/auth/config.
   */
  public async getClientId(backendUrl?: string): Promise<string> {
    const isCustom = serverConfigService.isCustomServer();

    // 1. For CareRing Cloud, strictly prioritize the environment variable or cloud default
    if (!isCustom) {
      const envClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
      if (envClientId && envClientId.trim().length > 0) {
        return envClientId.trim();
      }
    }

    // 2. For custom private server, check user-entered Client ID saved locally
    try {
      const stored = await AsyncStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch {
      // ignore
    }

    // 3. Check if server provides it via /api/auth/config
    const targetUrl = backendUrl || serverConfigService.getActiveWsUrl();
    if (targetUrl) {
      try {
        const httpBase = targetUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
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

    // 4. Fallback to env variable or cloud default if present
    const envClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
    if (envClientId && envClientId.trim().length > 0) {
      return envClientId.trim();
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
   * Matches the URI registered in Google Cloud Console.
   */
  public getRedirectUri(): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    // If explicitly provided via environment
    if (process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI) {
      return process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI.trim();
    }
    // For CareRing Cloud or Expo Go
    if (!serverConfigService.isCustomServer()) {
      return DEFAULT_GOOGLE_REDIRECT_URI;
    }
    return AuthSession.makeRedirectUri({
      scheme: 'carering',
    });
  }

  /**
   * Starts the authentic Google OAuth 2.0 PKCE flow using system browser.
   * Complies with modern Google OAuth security policies.
   */
  public async promptAsync(backendUrl?: string): Promise<GoogleUserProfile | null> {
    const clientId = await this.getClientId(backendUrl);
    if (!clientId) {
      throw new Error(
        'GOOGLE_CLIENT_ID_REQUIRED: Please configure GOOGLE_CLIENT_ID on your server or client to connect with an actual Google account.'
      );
    }

    const redirectUri = this.getRedirectUri();
    console.log('[GoogleAuthService] Initiating Google PKCE sign-in with redirect URI:', redirectUri);

    const discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    };

    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      prompt: AuthSession.Prompt.SelectAccount,
    });

    const result = await request.promptAsync(discovery);

    if (result.type !== 'success' || !result.url) {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return null; // User cancelled
      }
      throw new Error(`Google sign-in was not completed (Status: ${result.type})`);
    }

    const code = result.params?.code || this.extractParam(result.url, 'code');
    if (!code) {
      const errorMsg =
        result.params?.error_description ||
        result.params?.error ||
        this.extractParam(result.url, 'error_description') ||
        this.extractParam(result.url, 'error');
      throw new Error(errorMsg || 'Failed to obtain authorization code from Google');
    }

    // Exchange authorization code with PKCE code_verifier for tokens
    const clientSecret = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET?.trim() || undefined;

    let accessToken: string | undefined;
    let idToken: string | undefined;

    try {
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          clientSecret,
          code,
          redirectUri,
          extraParams: {
            code_verifier: request.codeVerifier || '',
          },
        },
        discovery
      );

      accessToken = tokenResponse.accessToken;
      idToken = tokenResponse.idToken;
    } catch (exchangeErr: any) {
      console.warn('[GoogleAuthService] Direct token exchange error, checking fallback:', exchangeErr);

      // Attempt fallback via backend server
      const targetBackend = backendUrl || serverConfigService.getActiveWsUrl();
      const httpBase = targetBackend.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');

      try {
        const backendRes = await fetch(`${httpBase}/api/auth/google/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            codeVerifier: request.codeVerifier,
            redirectUri,
            clientId,
          }),
        });

        if (backendRes.ok) {
          const backendData = await backendRes.json();
          accessToken = backendData.accessToken;
          idToken = backendData.idToken;
        }
      } catch (backendErr) {
        console.warn('[GoogleAuthService] Backend exchange fallback error:', backendErr);
      }

      if (!accessToken && !idToken) {
        if (exchangeErr.message?.includes('client_secret') && !clientSecret) {
          throw new Error(
            'Google Web Application client ID requires client secret. Please set EXPO_PUBLIC_GOOGLE_CLIENT_SECRET in mobile/.env.'
          );
        }
        throw new Error(exchangeErr.message || 'Failed to exchange authorization code for Google tokens');
      }
    }

    // Retrieve user profile using accessToken
    if (accessToken) {
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (userinfoRes.ok) {
          const googleUser = await userinfoRes.json();
          if (googleUser.email) {
            return {
              email: String(googleUser.email).toLowerCase(),
              fullName: String(googleUser.name || googleUser.given_name || 'Google User'),
              avatarUrl: googleUser.picture ? String(googleUser.picture) : null,
              googleId: String(googleUser.sub || `g_${Date.now()}`),
            };
          }
        }
      } catch (infoErr) {
        console.warn('[GoogleAuthService] Userinfo fetch error, falling back to idToken:', infoErr);
      }
    }

    // Fallback: Parse ID token if available
    if (idToken) {
      try {
        const parts = idToken.split('.');
        if (parts.length >= 2) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const raw = typeof atob === 'function' ? atob(base64) : '';
          if (raw) {
            const jsonPayload = decodeURIComponent(
              raw
                .split('')
                .map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const payload = JSON.parse(jsonPayload);
            if (payload.email) {
              return {
                email: String(payload.email).toLowerCase(),
                fullName: String(payload.name || 'Google User'),
                avatarUrl: payload.picture ? String(payload.picture) : null,
                googleId: String(payload.sub || `g_${Date.now()}`),
              };
            }
          }
        }
      } catch (jwtErr) {
        console.warn('[GoogleAuthService] Failed to parse ID token JWT:', jwtErr);
      }
    }

    throw new Error('Failed to retrieve user profile from Google. Please try again.');
  }

  private extractParam(url: string, paramName: string): string | null {
    const raw = url.includes('#') ? url.split('#')[1] : (url.includes('?') ? url.split('?')[1] : '');
    const params = new URLSearchParams(raw);
    return params.get(paramName);
  }
}

export const googleAuthService = GoogleAuthService.getInstance();
