import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { serverConfigService } from './ServerConfigService';

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
   * Retrieves the active Google Client ID:
   * - Strictly reads from environment variables (EXPO_PUBLIC_GOOGLE_CLIENT_ID),
   *   custom server settings, or server /api/auth/config endpoint.
   */
  public async getClientId(backendUrl?: string): Promise<string> {
    const isCustom = serverConfigService.isCustomServer();

    // 1. For CareRing Cloud, strictly prioritize the environment variable
    if (!isCustom) {
      const envClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
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

    // 4. Fallback to env variable if present
    const envClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
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
   * Computes the OAuth redirect URI for this app:
   * - In Web: current window origin
   * - In Expo Go: Expo Auth proxy or local scheme
   * - In Standalone APK / Production: Server callback bridge (no auth.expo.io)
   */
  public getRedirectUri(backendUrl?: string): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }

    const isExpoGo =
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      (Constants as any).appOwnership === 'expo';

    if (isExpoGo) {
      if (
        process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI &&
        process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI.trim().length > 0
      ) {
        return process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI.trim();
      }
      return AuthSession.makeRedirectUri({
        scheme: 'carering',
      });
    }

    // Standalone Production Native App (APK / Release):
    // Prioritize explicit non-expo redirect URI if provided
    const envRedirect = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim();
    if (envRedirect && !envRedirect.includes('auth.expo.io')) {
      return envRedirect;
    }

    // Default to server callback bridge endpoint
    const targetUrl = backendUrl || serverConfigService.getActiveWsUrl() || 'https://care-ring.onrender.com';
    const httpBase = targetUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
    return `${httpBase}/api/auth/google/callback`;
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

    const redirectUri = this.getRedirectUri(backendUrl);
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

    const isExpoGo =
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      (Constants as any).appOwnership === 'expo';

    let code: string | null = null;
    let returnedState: string | null = null;

    if (Platform.OS === 'web' || isExpoGo) {
      const result = await request.promptAsync(discovery);

      if (result.type !== 'success' || !result.url) {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return null; // User cancelled
        }
        throw new Error(`Google sign-in was not completed (Status: ${result.type})`);
      }

      code = result.params?.code || this.extractParam(result.url, 'code');
      returnedState = result.params?.state || this.extractParam(result.url, 'state');
    } else {
      // Standalone Native (Release APK / Bare):
      // Build Google OAuth authorization URL containing PKCE challenge
      const authUrl = await request.makeAuthUrlAsync(discovery);

      // Open in Custom Tabs and listen for app's native carering:// scheme
      const browserResult = await WebBrowser.openAuthSessionAsync(authUrl, 'carering://');

      if (browserResult.type !== 'success' || !browserResult.url) {
        if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
          return null; // User cancelled
        }
        throw new Error(`Google sign-in was not completed (Status: ${browserResult.type})`);
      }

      code = this.extractParam(browserResult.url, 'code');
      returnedState = this.extractParam(browserResult.url, 'state');
    }

    if (!code) {
      throw new Error('Failed to obtain authorization code from Google');
    }

    if (returnedState && request.state && returnedState !== request.state) {
      throw new Error('Cross-Site request verification failed (state mismatch).');
    }

    // Exchange authorization code with PKCE code_verifier for tokens
    const clientSecret = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET?.trim() || undefined;

    let accessToken: string | undefined;
    let idToken: string | undefined;

    // 1. Try server exchange endpoint first (most reliable, supports server-managed client secret)
    const targetBackend = backendUrl || serverConfigService.getActiveWsUrl() || 'https://care-ring.onrender.com';
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
      } else {
        const errBody = await backendRes.text();
        console.warn('[GoogleAuthService] Server exchange returned non-OK status:', errBody);
      }
    } catch (backendErr) {
      console.warn('[GoogleAuthService] Backend exchange network error:', backendErr);
    }

    // 2. Direct client token exchange fallback
    if (!accessToken && !idToken) {
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
