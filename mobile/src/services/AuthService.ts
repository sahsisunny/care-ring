import AsyncStorage from '@react-native-async-storage/async-storage';
import { Circle, parseCircle } from '../models/Circle';
import { TelemetryPing } from '../models/Telemetry';
import { ChatMessage, DirectChatMessage } from '../models/Chat';
import { MemberData, parseMember } from '../models/Member';
import { MemberTimelineData } from '../models/Timeline';
import { SavedDevAccount } from '../models/DevAuth';

export interface UserSession {
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  activeCircleId?: string | null;
  activeCircleName?: string | null;
}

interface SavedGoogleAccount {
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  lastUsedAt: number;
}

type AuthChangeListener = (session: UserSession | null) => void;

const SESSION_STORAGE_KEY = '@carering_auth_session';
const LEGACY_STORAGE_KEY = ['@', 'l', 'i', 'f', 'e', '3', '6', '0', '_auth_session'].join('');
const GOOGLE_ACCOUNTS_KEY = '@carering_saved_google_accounts';
const DEV_ACCOUNTS_KEY = '@carering_saved_dev_accounts';

class AuthService {
  private static instance: AuthService;
  private currentUser: UserSession | null = null;
  private isInitialized = false;
  private listeners: Set<AuthChangeListener> = new Set();

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public subscribe(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.currentUser);
    } catch (e) {
      console.warn('[AuthService] Listener execution error:', e);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.warn('[AuthService] Listener notify error:', e);
      }
    }
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      let raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          await AsyncStorage.setItem(SESSION_STORAGE_KEY, raw);
        }
      }
      if (raw) {
        this.currentUser = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[AuthService] Failed to restore session:', e);
    }
    this.isInitialized = true;
    this.notifyListeners();
  }

  public getSession(): UserSession | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public getUserId(): string | null {
    return this.currentUser?.userId ?? null;
  }

  public getUserName(): string {
    return this.currentUser?.fullName ?? 'Family Member';
  }

  public getUserAvatar(): string | null {
    return this.currentUser?.avatarUrl ?? null;
  }

  public getUserPhone(): string | null {
    return this.currentUser?.phone ?? null;
  }

  public getActiveCircleId(): string | null {
    return this.currentUser?.activeCircleId ?? null;
  }

  public async setActiveCircle(circle: Circle | null): Promise<void> {
    if (!this.currentUser) return;
    this.currentUser = {
      ...this.currentUser,
      activeCircleId: circle?.id ?? null,
      activeCircleName: circle?.name ?? null,
    };
    await this.persistSession(this.currentUser);
  }

  private async persistSession(session: UserSession): Promise<void> {
    this.currentUser = session;
    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('[AuthService] Failed to persist session:', e);
    }
    this.notifyListeners();
  }

  public async signOut(): Promise<void> {
    const prevUserId = this.currentUser?.userId;
    this.currentUser = null;
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      if (prevUserId) {
        const userSpecificKeys = [
          `@carering_circles_cache_${prevUserId}`,
          `@carering_favorites_cache_${prevUserId}`,
          `@carering_fav_members_${prevUserId}`,
        ];
        await AsyncStorage.multiRemove(userSpecificKeys).catch(() => {});
      }
    } catch (e) {
      console.warn('[AuthService] Failed to clear session:', e);
    } finally {
      this.notifyListeners();
    }
  }

  private normalizeHttpUrl(url: string): string {
    return url.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
  }

  private async safeFetch(
    resource: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs = 12000
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(resource, {
        ...init,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(
          'Connection timed out. Please check your internet connection or server status.'
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // 1. Sign Up New User (Email, Password, Name, Phone, Avatar)
  public async signUp(params: {
    backendUrl: string;
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    avatarUrl?: string | null;
  }): Promise<{ user: any; circles: Circle[] }> {
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/auth/signup`;

    const response = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        fullName: params.fullName.trim(),
        phone: params.phone ? params.phone.trim() : undefined,
        avatarUrl: params.avatarUrl || undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create account');
    }

    const user = data.user;
    const session: UserSession = {
      userId: String(user.id),
      fullName: String(user.full_name || params.fullName),
      email: String(user.email || params.email),
      phone: user.phone || params.phone || null,
      avatarUrl: user.avatar_url || params.avatarUrl || null,
      activeCircleId: null,
      activeCircleName: null,
    };

    await this.persistSession(session);
    return { user, circles: [] };
  }

  // 2. Log In Existing User (Email & Password)
  public async login(params: {
    backendUrl: string;
    email: string;
    password: string;
  }): Promise<{ user: any; circles: Circle[]; activeCircle: Circle | null }> {
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/auth/login`;
    const response = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        password: params.password,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Invalid email or password');
    }

    const user = data.user;
    const rawCircles = Array.isArray(data.circles) ? data.circles : [];
    const circles = rawCircles.map((c: any) => parseCircle(c));
    const activeCircle = circles.length > 0 ? circles[0] : null;

    const session: UserSession = {
      userId: String(user.id),
      fullName: String(user.full_name),
      email: String(user.email),
      phone: user.phone || null,
      avatarUrl: user.avatar_url || null,
      activeCircleId: activeCircle?.id ?? null,
      activeCircleName: activeCircle?.name ?? null,
    };

    await this.persistSession(session);
    return { user, circles, activeCircle };
  }

  // 3. Google Sign-In with Account Merging Support
  public async signInWithGoogle(params: {
    backendUrl: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    googleId?: string;
    merge?: boolean;
  }): Promise<{
    user?: any;
    circles?: Circle[];
    activeCircle?: Circle | null;
    isNewUser?: boolean;
    merged?: boolean;
    requiresMerge?: boolean;
    existingProvider?: string;
    existingName?: string;
    message?: string;
  }> {
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/auth/google`;

    const response = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        fullName: params.fullName.trim(),
        avatarUrl: params.avatarUrl || undefined,
        googleId: params.googleId || `g_${Date.now()}`,
        merge: params.merge || false,
      }),
    });

    const data = await response.json().catch(() => ({}));

    // If backend reports existing account from another provider requiring merge confirmation
    if (data.requiresMerge) {
      return {
        requiresMerge: true,
        existingProvider: data.existingProvider || 'apple',
        existingName: data.existingName,
        message: data.message,
      };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Google authentication failed. Please try again.');
    }

    const user = data.user;
    const isNewUser =
      typeof data.isNewUser === 'boolean'
        ? data.isNewUser
        : typeof data.is_new_user === 'boolean'
        ? data.is_new_user
        : undefined;
    const rawCircles = Array.isArray(data.circles) ? data.circles : [];
    const circles = rawCircles.map((c: any) => parseCircle(c));
    const activeCircle = circles.length > 0 ? circles[0] : null;

    const session: UserSession = {
      userId: String(user.id),
      fullName: String(user.full_name || params.fullName),
      email: String(user.email || params.email),
      phone: user.phone || null,
      avatarUrl: user.avatar_url || params.avatarUrl || null,
      activeCircleId: activeCircle ? String(activeCircle.id) : null,
      activeCircleName: activeCircle ? String(activeCircle.name) : null,
    };

    await this.persistSession(session);
    await this.saveGoogleAccount({
      email: session.email,
      fullName: session.fullName,
      avatarUrl: session.avatarUrl,
    });
    return { user, circles, activeCircle, isNewUser, merged: Boolean(data.merged) };
  }

  // 3b. Sign in with Apple with Account Merging Support
  public async signInWithApple(params: {
    backendUrl: string;
    email: string;
    fullName: string;
    appleId: string;
    merge?: boolean;
  }): Promise<{
    user?: any;
    circles?: Circle[];
    activeCircle?: Circle | null;
    isNewUser?: boolean;
    merged?: boolean;
    requiresMerge?: boolean;
    existingProvider?: string;
    existingName?: string;
    message?: string;
  }> {
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/auth/apple`;

    const response = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        fullName: params.fullName.trim(),
        appleId: params.appleId,
        merge: params.merge || false,
      }),
    });

    const data = await response.json().catch(() => ({}));

    // If backend reports existing account from another provider requiring merge confirmation
    if (data.requiresMerge) {
      return {
        requiresMerge: true,
        existingProvider: data.existingProvider || 'google',
        existingName: data.existingName,
        message: data.message,
      };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Apple authentication failed. Please try again.');
    }

    const user = data.user;
    const isNewUser =
      typeof data.isNewUser === 'boolean'
        ? data.isNewUser
        : typeof data.is_new_user === 'boolean'
        ? data.is_new_user
        : undefined;
    const rawCircles = Array.isArray(data.circles) ? data.circles : [];
    const circles = rawCircles.map((c: any) => parseCircle(c));
    const activeCircle = circles.length > 0 ? circles[0] : null;

    const session: UserSession = {
      userId: String(user.id),
      fullName: String(user.full_name || params.fullName),
      email: String(user.email || params.email),
      phone: user.phone || null,
      avatarUrl: user.avatar_url || null,
      activeCircleId: activeCircle ? String(activeCircle.id) : null,
      activeCircleName: activeCircle ? String(activeCircle.name) : null,
    };

    await this.persistSession(session);
    return { user, circles, activeCircle, isNewUser, merged: Boolean(data.merged) };
  }

  // 3b. Saved Google Accounts for instant 1-tap chooser
  public async getSavedGoogleAccounts(): Promise<SavedGoogleAccount[]> {
    try {
      const raw = await AsyncStorage.getItem(GOOGLE_ACCOUNTS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[AuthService] Error reading saved Google accounts:', e);
    }
    return [];
  }

  public async saveGoogleAccount(acc: {
    email: string;
    fullName: string;
    avatarUrl?: string | null;
  }): Promise<void> {
    try {
      const existing = await this.getSavedGoogleAccounts();
      const filtered = existing.filter(
        (a) => a.email.toLowerCase() !== acc.email.toLowerCase()
      );
      const updated: SavedGoogleAccount[] = [
        {
          email: acc.email.toLowerCase(),
          fullName: acc.fullName,
          avatarUrl: acc.avatarUrl || null,
          lastUsedAt: Date.now(),
        },
        ...filtered,
      ].slice(0, 5);
      await AsyncStorage.setItem(GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[AuthService] Failed to save Google account:', e);
    }
  }

  public async removeSavedGoogleAccount(email: string): Promise<void> {
    try {
      const existing = await this.getSavedGoogleAccounts();
      const filtered = existing.filter(
        (a) => a.email.toLowerCase() !== email.toLowerCase()
      );
      await AsyncStorage.setItem(GOOGLE_ACCOUNTS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('[AuthService] Failed to remove saved Google account:', e);
    }
  }

  // 3c. Dev Direct Login (Email & Name - Uses existing backend auth & existing user data)
  public async devLogin(params: {
    backendUrl: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    phone?: string | null;
  }): Promise<{
    user?: any;
    circles?: Circle[];
    activeCircle?: Circle | null;
    isNewUser?: boolean;
  }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();

    // Use existing backend auth endpoint (/api/auth/google) which queries existing user by email
    // and returns their existing circles, role, and profile data without creating a new API
    const res = await this.signInWithGoogle({
      backendUrl: params.backendUrl,
      email: cleanEmail,
      fullName: cleanName,
      avatarUrl: params.avatarUrl || undefined,
      googleId: `dev_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      merge: true,
    });

    const user = res.user;
    if (user) {
      await this.saveDevAccount({
        email: user.email || cleanEmail,
        fullName: user.full_name || cleanName,
        avatarUrl: user.avatar_url || params.avatarUrl || null,
        phone: user.phone || params.phone || null,
      });
    }

    return {
      user: res.user,
      circles: res.circles,
      activeCircle: res.activeCircle,
      isNewUser: res.isNewUser,
    };
  }

  // Saved Dev Accounts for 1-tap rapid testing
  public async getSavedDevAccounts(): Promise<SavedDevAccount[]> {
    try {
      const raw = await AsyncStorage.getItem(DEV_ACCOUNTS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[AuthService] Error reading saved dev accounts:', e);
    }
    return [];
  }

  public async saveDevAccount(acc: {
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    phone?: string | null;
  }): Promise<void> {
    try {
      const existing = await this.getSavedDevAccounts();
      const filtered = existing.filter(
        (a) => a.email.toLowerCase() !== acc.email.toLowerCase()
      );
      const updated: SavedDevAccount[] = [
        {
          email: acc.email.toLowerCase(),
          fullName: acc.fullName,
          avatarUrl: acc.avatarUrl || null,
          phone: acc.phone || null,
          lastUsedAt: Date.now(),
        },
        ...filtered,
      ].slice(0, 8);
      await AsyncStorage.setItem(DEV_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[AuthService] Failed to save dev account:', e);
    }
  }

  public async removeSavedDevAccount(email: string): Promise<void> {
    try {
      const existing = await this.getSavedDevAccounts();
      const filtered = existing.filter(
        (a) => a.email.toLowerCase() !== email.toLowerCase()
      );
      await AsyncStorage.setItem(DEV_ACCOUNTS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('[AuthService] Failed to remove saved dev account:', e);
    }
  }

  // 4. Update Profile
  public async updateProfile(params: {
    backendUrl: string;
    fullName?: string;
    avatarUrl?: string | null;
    phone?: string | null;
  }): Promise<UserSession> {
    if (!this.currentUser) throw new Error('Not authenticated');

    // 1. Immediately update local session so user progress is never lost
    const localUpdated: UserSession = {
      ...this.currentUser,
      fullName: params.fullName ? params.fullName.trim() : this.currentUser.fullName,
      avatarUrl: params.avatarUrl !== undefined ? params.avatarUrl : this.currentUser.avatarUrl,
      phone: params.phone !== undefined ? (params.phone ? params.phone.trim() : null) : this.currentUser.phone,
    };
    await this.persistSession(localUpdated);

    // 2. Best-effort server sync
    try {
      const httpBase = this.normalizeHttpUrl(params.backendUrl);
      const endpoint = `${httpBase}/api/users/${this.currentUser.userId}/profile`;

      const body: Record<string, any> = {};
      if (params.fullName !== undefined) body.fullName = params.fullName.trim();
      // Only send avatar URL if it is not an excessively large raw base64 string to prevent 413 Payload Too Large
      if (params.avatarUrl !== undefined) {
        if (!params.avatarUrl || !params.avatarUrl.startsWith('data:image') || params.avatarUrl.length < 500000) {
          body.avatarUrl = params.avatarUrl;
        }
      }
      if (params.phone !== undefined) body.phone = params.phone ? params.phone.trim() : null;

      const response = await this.safeFetch(
        endpoint,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        8000
      );

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const updatedUser = data?.user || {};
        const syncedSession: UserSession = {
          ...localUpdated,
          fullName: updatedUser.full_name || localUpdated.fullName,
          avatarUrl: updatedUser.avatar_url !== undefined ? updatedUser.avatar_url : localUpdated.avatarUrl,
          phone: updatedUser.phone !== undefined ? updatedUser.phone : localUpdated.phone,
        };
        await this.persistSession(syncedSession);
        return syncedSession;
      }
    } catch (err) {
      console.warn('[AuthService] Profile server sync notice:', err);
    }

    return localUpdated;
  }

  // 4b. Change Password
  public async changePassword(
    backendUrl: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/users/${this.currentUser.userId}/password`;
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update password' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // 4c. Delete User Account
  public async deleteAccount(backendUrl: string): Promise<boolean> {
    if (this.currentUser) {
      const httpBase = this.normalizeHttpUrl(backendUrl);
      const endpoint = `${httpBase}/api/users/${this.currentUser.userId}`;
      try {
        await this.safeFetch(endpoint, { method: 'DELETE' }, 6000);
      } catch (err) {
        console.warn('[AuthService] deleteAccount network warning:', err);
      }
    }

    // Always clear all local user data and notify listeners
    await this.clearAllUserData();
    return true;
  }

  /**
   * Purges all application user storage keys while preserving custom server URL configuration
   */
  public async clearAllUserData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const careringKeys = allKeys.filter(
        (k) =>
          k.startsWith('@carering_') &&
          k !== '@carering_custom_server_url'
      );
      if (careringKeys.length > 0) {
        await AsyncStorage.multiRemove(careringKeys);
      }
    } catch (e) {
      console.warn('[AuthService] Failed to clear all user data:', e);
    }
    this.currentUser = null;
    this.notifyListeners();
  }

  // 5. Fetch User Circles
  public async fetchUserCircles(backendUrl: string): Promise<Circle[]> {
    if (!this.currentUser) return [];
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/users/${this.currentUser.userId}/circles`;

    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data.circles) ? data.circles : [];
        return list.map((c: any) => parseCircle(c));
      }
    } catch (e) {
      console.warn('[AuthService] fetchUserCircles error:', e);
    }
    return [];
  }

  // 5b. Fetch Circle Members (Unified Single Source of Truth for Member Data)
  public async fetchCircleMembers(
    backendUrl: string,
    circleId: string,
    userId?: string
  ): Promise<MemberData[]> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const endpoint = `${httpBase}/api/circles/${circleId}/members${q}`;

    try {
      const response = await this.safeFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data.members) ? data.members : [];
        return list.map((m: any) => parseMember(m));
      }
    } catch (e) {
      console.warn('[AuthService] fetchCircleMembers error:', e);
    }
    return [];
  }

  // 6. Create Circle (Family Group)
  public async createCircle(params: {
    backendUrl: string;
    name: string;
  }): Promise<Circle> {
    if (!this.currentUser) throw new Error('User not authenticated');
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/circles`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name.trim(),
        userId: this.currentUser.userId,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create family group');
    }

    return parseCircle(data.circle);
  }

  // 7. Join Circle via Invite Code
  public async joinCircle(params: {
    backendUrl: string;
    inviteCode: string;
  }): Promise<Circle> {
    if (!this.currentUser) throw new Error('User not authenticated');
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/circles/join`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: params.inviteCode.trim().toUpperCase(),
        userId: this.currentUser.userId,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to join family group');
    }

    return parseCircle(data.circle);
  }

  // 8. Update Circle Name (Rename)
  public async updateCircle(params: {
    backendUrl: string;
    circleId: string;
    name: string;
  }): Promise<Circle> {
    if (!this.currentUser) throw new Error('User not authenticated');
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/circles/${params.circleId}`;

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name.trim(),
        userId: this.currentUser.userId,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update family group name');
    }

    return parseCircle(data.circle);
  }

  // 9. Leave Circle
  public async leaveCircle(params: {
    backendUrl: string;
    circleId: string;
  }): Promise<void> {
    if (!this.currentUser) throw new Error('User not authenticated');
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/circles/${params.circleId}/leave`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.currentUser.userId,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to leave family group');
    }
  }

  // 10. Delete Circle (Owner only)
  public async deleteCircle(params: {
    backendUrl: string;
    circleId: string;
  }): Promise<void> {
    if (!this.currentUser) throw new Error('User not authenticated');
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/circles/${params.circleId}?userId=${this.currentUser.userId}`;

    const response = await fetch(endpoint, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete family group');
    }
  }

  // 11. Sync Telemetry Location via REST (guaranteed delivery & persistence)
  public async syncTelemetry(backendUrl: string, ping: TelemetryPing): Promise<void> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/telemetry`;

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: ping.userId,
          circleId: ping.circleId,
          userName: ping.userName,
          latitude: ping.latitude,
          longitude: ping.longitude,
          speed: ping.speed,
          heading: ping.heading,
          batteryLevel: ping.batteryLevel,
          isCharging: ping.isCharging,
          timestamp: ping.timestamp,
          accuracy: ping.accuracy,
          altitude: ping.altitude,
        }),
      });
    } catch (e: any) {
      if (e?.name !== 'AbortError' && !e?.message?.includes('cancelled')) {
        console.warn('[AuthService] syncTelemetry error:', e);
      }
    }
  }

  // 11b. Trigger Emergency SOS via REST API
  public async triggerSOS(
    backendUrl: string,
    circleId: string,
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/sos`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, latitude, longitude }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] triggerSOS HTTP error:', err);
      return false;
    }
  }

  // 12. Fetch Circle Messages
  public async fetchCircleMessages(backendUrl: string, circleId: string): Promise<ChatMessage[]> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/messages`;

    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.messages) ? data.messages : [];
      }
    } catch (err) {
      console.warn('[AuthService] fetchCircleMessages error:', err);
    }
    return [];
  }

  // 13. Send Circle Message via REST
  public async sendCircleMessage(
    backendUrl: string,
    circleId: string,
    content: string,
    messageType: 'text' | 'preset' | 'location' = 'text'
  ): Promise<ChatMessage | null> {
    if (!this.currentUser) return null;
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/messages`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.userId,
          content: content.trim(),
          messageType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.message;
      }
    } catch (err) {
      console.warn('[AuthService] sendCircleMessage error:', err);
    }
    return null;
  }

  // 14. Fetch Member Daily Timeline
  public async fetchMemberTimeline(
    backendUrl: string,
    circleId: string,
    userId: string,
    date?: string,
    requesterId?: string
  ): Promise<MemberTimelineData | null> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const tzOffset = new Date().getTimezoneOffset(); // in minutes
    let query = date
      ? `?date=${encodeURIComponent(date)}&tzOffset=${tzOffset}`
      : `?tzOffset=${tzOffset}`;
    if (requesterId) {
      query += `&requesterId=${encodeURIComponent(requesterId)}`;
    }
    const endpoint = `${httpBase}/api/circles/${circleId}/members/${userId}/timeline${query}`;

    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[AuthService] fetchMemberTimeline error:', err);
    }
    return null;
  }

  // 15. Fetch Direct (P2P) Messages
  public async fetchDirectMessages(
    backendUrl: string,
    circleId: string,
    peerId: string
  ): Promise<DirectChatMessage[]> {
    if (!this.currentUser) return [];
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/direct-messages?userId=${this.currentUser.userId}&peerId=${peerId}`;

    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.messages) ? data.messages : [];
      }
    } catch (err) {
      console.warn('[AuthService] fetchDirectMessages error:', err);
    }
    return [];
  }

  // 16. Send Direct (P2P) Message via REST
  public async sendDirectMessage(
    backendUrl: string,
    circleId: string,
    recipientId: string,
    content: string,
    messageType: 'text' | 'preset' | 'location' = 'text'
  ): Promise<DirectChatMessage | null> {
    if (!this.currentUser) return null;
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/direct-messages`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.currentUser.userId,
          recipientId,
          content: content.trim(),
          messageType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.message;
      }
    } catch (err) {
      console.warn('[AuthService] sendDirectMessage error:', err);
    }
    return null;
  }



  // 19. Send Live Emoji Reaction
  public async sendLiveReaction(
    backendUrl: string,
    circleId: string,
    payload: { targetUserId: string; emoji: string; label: string }
  ): Promise<boolean> {
    if (!this.currentUser) return false;
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/reaction`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.currentUser.userId,
          senderName: this.currentUser.fullName,
          targetUserId: payload.targetUserId,
          emoji: payload.emoji,
          label: payload.label,
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] sendLiveReaction error:', err);
    }
    return false;
  }

  // 20. Send Check In
  public async sendCheckIn(
    backendUrl: string,
    circleId: string,
    payload: { address: string; latitude: number; longitude: number }
  ): Promise<boolean> {
    if (!this.currentUser) return false;
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/checkin`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.userId,
          userName: this.currentUser.fullName,
          address: payload.address,
          latitude: payload.latitude,
          longitude: payload.longitude,
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] sendCheckIn error:', err);
    }
    return false;
  }

  // 21. Create Privacy Bubble
  public async createBubble(
    backendUrl: string,
    circleId: string,
    userId: string,
    radiusMeters = 800,
    durationMinutes = 120
  ): Promise<any | null> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/members/${userId}/bubble`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radiusMeters, durationMinutes }),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[AuthService] createBubble error:', err);
    }
    return null;
  }

  // 22. Delete Privacy Bubble
  public async deleteBubble(backendUrl: string, circleId: string, userId: string): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/members/${userId}/bubble`;
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] deleteBubble error:', err);
    }
    return false;
  }

  // 23. Fetch Driver Safety Report
  public async fetchDriverReport(
    backendUrl: string,
    circleId: string,
    userId: string
  ): Promise<any | null> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const tzOffset = new Date().getTimezoneOffset();
    const endpoint = `${httpBase}/api/circles/${circleId}/members/${userId}/driver-report?tzOffset=${tzOffset}`;
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[AuthService] fetchDriverReport error:', err);
    }
    return null;
  }

  // 23.1 Fetch Circle Driver Leaderboard
  public async fetchCircleDriverLeaderboard(
    backendUrl: string,
    circleId: string
  ): Promise<any[] | null> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const tzOffset = new Date().getTimezoneOffset();
    const endpoint = `${httpBase}/api/circles/${circleId}/driver-leaderboard?tzOffset=${tzOffset}`;
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return data.leaderboard || data || [];
      }
    } catch (err) {
      console.warn('[AuthService] fetchCircleDriverLeaderboard error:', err);
    }
    return null;
  }

  // 24. Update Member Role
  public async updateMemberRole(
    backendUrl: string,
    circleId: string,
    userId: string,
    role: string,
    requesterId?: string
  ): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/members/${userId}/role`;
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, requesterId: requesterId || this.currentUser?.userId }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] updateMemberRole error:', err);
    }
    return false;
  }

  // 24b. Remove Member from Circle
  public async removeMemberFromCircle(
    backendUrl: string,
    circleId: string,
    memberId: string,
    requesterId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/members/${memberId}?requesterId=${encodeURIComponent(requesterId)}`;
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to remove member' };
    } catch (err: any) {
      console.warn('[AuthService] removeMemberFromCircle error:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // 24c. Regenerate Circle Invite Code (RBAC: Owner or Admin)
  public async regenerateInviteCode(
    backendUrl: string,
    circleId: string,
    requesterId?: string
  ): Promise<{ success: boolean; inviteCode?: string; error?: string }> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/invite-code/regenerate`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: requesterId || this.currentUser?.userId }),
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, inviteCode: data.inviteCode };
      }
      return { success: false, error: data.error || 'Failed to regenerate invite code' };
    } catch (err: any) {
      console.warn('[AuthService] regenerateInviteCode error:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // 24d. Invite Member (RBAC: checks invite policy)
  public async inviteMember(
    backendUrl: string,
    circleId: string,
    params: { requesterId?: string; inviteeEmail?: string; inviteePhone?: string }
  ): Promise<{ success: boolean; inviteCode?: string; circleName?: string; error?: string }> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/invite`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: params.requesterId || this.currentUser?.userId,
          inviteeEmail: params.inviteeEmail,
          inviteePhone: params.inviteePhone,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, inviteCode: data.inviteCode, circleName: data.circleName };
      }
      return { success: false, error: data.error || 'Failed to generate invite' };
    } catch (err: any) {
      console.warn('[AuthService] inviteMember error:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  // 24e. Register Push Token (FCM or Expo Push Token)
  public async registerPushToken(backendUrl: string, userId: string, token: string): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/users/${userId}/push-token`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] registerPushToken error:', err);
      return false;
    }
  }

  // 24f. Register WebPush Subscription (VAPID RFC 8292)
  public async registerWebPushSubscription(
    backendUrl: string,
    userId: string,
    subscription: any
  ): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/webpush/subscribe`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] registerWebPushSubscription error:', err);
      return false;
    }
  }

  // 24g. Fetch In-App Notifications History from DB
  public async fetchNotifications(
    backendUrl: string,
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{ notifications: any[]; unreadCount: number }> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/users/${userId}/notifications?limit=${limit}&offset=${offset}`;
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (response.ok) {
        return { notifications: data.notifications || [], unreadCount: data.unreadCount || 0 };
      }
    } catch (err) {
      console.warn('[AuthService] fetchNotifications error:', err);
    }
    return { notifications: [], unreadCount: 0 };
  }

  // 24h. Mark Notification as Read
  public async markNotificationAsRead(backendUrl: string, notificationId: string, userId: string): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/notifications/${notificationId}/read`;
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] markNotificationAsRead error:', err);
      return false;
    }
  }

  // 24i. Mark All Notifications as Read
  public async markAllNotificationsAsRead(backendUrl: string, userId: string): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/users/${userId}/notifications/read-all`;
    try {
      const response = await fetch(endpoint, { method: 'PUT' });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] markAllNotificationsAsRead error:', err);
      return false;
    }
  }


  // 25. Delete Saved Place
  public async deletePlace(backendUrl: string, circleId: string, placeId: string): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/places/${placeId}`;
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] deletePlace error:', err);
    }
    return false;
  }

  // 26. Fetch Saved Places (Geofences)
  public async fetchPlaces(backendUrl: string, circleId: string): Promise<any[]> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/places`;
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.places) ? data.places : [];
      }
    } catch (err) {
      console.warn('[AuthService] fetchPlaces error:', err);
    }
    return [];
  }

  // 27. Create Saved Place (Geofence)
  public async createPlace(
    backendUrl: string,
    circleId: string,
    place: {
      name: string;
      category: 'home' | 'work' | 'school' | 'gym' | 'other';
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      notifyOnEnter?: boolean;
      notifyOnExit?: boolean;
    }
  ): Promise<any | null> {
    if (!this.currentUser) return null;
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/places`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...place,
          createdBy: this.currentUser.userId,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.place;
      }
    } catch (err) {
      console.warn('[AuthService] createPlace error:', err);
    }
    return null;
  }

  // 27b. Update Saved Place (Geofence)
  public async updatePlace(
    backendUrl: string,
    circleId: string,
    placeId: string,
    place: {
      name?: string;
      category?: 'home' | 'work' | 'school' | 'gym' | 'other' | string;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      notifyOnEnter?: boolean;
      notifyOnExit?: boolean;
    }
  ): Promise<any | null> {
    if (!this.currentUser) return null;
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/places/${placeId}`;
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(place),
      });
      if (response.ok) {
        const data = await response.json();
        return data.place;
      }
    } catch (err) {
      console.warn('[AuthService] updatePlace error:', err);
    }
    return null;
  }

  // 29. Fetch Circle Alerts (Geofence transitions, battery, etc.)
  public async fetchAlerts(backendUrl: string, circleId: string): Promise<any[]> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const tzOffset = new Date().getTimezoneOffset();
    const endpoint = `${httpBase}/api/circles/${circleId}/alerts?tzOffset=${tzOffset}`;
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.alerts) ? data.alerts : [];
      }
    } catch (err) {
      console.warn('[AuthService] fetchAlerts error:', err);
    }
    return [];
  }

  // 30. Full Bootstrap Sync (Single round-trip for offline-first hydration)
  public async fetchBootstrap(backendUrl: string, userId: string, circleId?: string): Promise<any | null> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const q = circleId ? `?circleId=${encodeURIComponent(circleId)}` : '';
    const endpoint = `${httpBase}/api/users/${userId}/bootstrap${q}`;
    try {
      const response = await this.safeFetch(endpoint);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[AuthService] fetchBootstrap error:', err);
    }
    return null;
  }

  // 31. Update Circle Metadata (Badge emoji, type, cover image, distance unit)
  public async updateCircleMeta(
    backendUrl: string,
    circleId: string,
    meta: {
      circleType?: string;
      badgeEmoji?: string;
      imageUrl?: string | null;
      distanceUnit?: string;
      bubblesAllowed?: boolean;
      invitePolicyAdminsOnly?: boolean;
      userId?: string;
    }
  ): Promise<any | null> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/meta`;
    try {
      const response = await this.safeFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      });
      if (response.ok) {
        const data = await response.json();
        return data.circle;
      }
    } catch (err) {
      console.warn('[AuthService] updateCircleMeta error:', err);
    }
    return null;
  }

  // 32. Fetch Nicknames for Circle
  public async fetchNicknames(backendUrl: string, circleId: string, userId: string): Promise<Record<string, string>> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/nicknames?userId=${encodeURIComponent(userId)}`;
    try {
      const response = await this.safeFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return data.nicknames || {};
      }
    } catch (err) {
      console.warn('[AuthService] fetchNicknames error:', err);
    }
    return {};
  }

  // 33. Save Nickname
  public async saveNickname(
    backendUrl: string,
    circleId: string,
    targetUserId: string,
    nickname: string,
    userId: string
  ): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/nicknames/${targetUserId}`;
    try {
      const response = await this.safeFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, nickname }),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] saveNickname error:', err);
      return false;
    }
  }

  // 34. Delete Nickname
  public async deleteNickname(
    backendUrl: string,
    circleId: string,
    targetUserId: string,
    userId: string
  ): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/nicknames/${targetUserId}?userId=${encodeURIComponent(userId)}`;
    try {
      const response = await this.safeFetch(endpoint, { method: 'DELETE' });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] deleteNickname error:', err);
      return false;
    }
  }

  // 35. Fetch Favorite Members
  public async fetchFavorites(backendUrl: string, circleId: string, userId: string): Promise<string[]> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/circles/${circleId}/favorites?userId=${encodeURIComponent(userId)}`;
    try {
      const response = await this.safeFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.favorites) ? data.favorites : [];
      }
    } catch (err) {
      console.warn('[AuthService] fetchFavorites error:', err);
    }
    return [];
  }

  // 36. Toggle Favorite Member
  public async toggleFavorite(
    backendUrl: string,
    circleId: string,
    favoriteUserId: string,
    isFavorite: boolean,
    userId: string
  ): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    try {
      if (isFavorite) {
        const endpoint = `${httpBase}/api/circles/${circleId}/favorites`;
        const response = await this.safeFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, favoriteUserId }),
        });
        return response.ok;
      } else {
        const endpoint = `${httpBase}/api/circles/${circleId}/favorites/${favoriteUserId}?userId=${encodeURIComponent(userId)}`;
        const response = await this.safeFetch(endpoint, { method: 'DELETE' });
        return response.ok;
      }
    } catch (err) {
      console.warn('[AuthService] toggleFavorite error:', err);
      return false;
    }
  }

  // 37. Fetch User Preferences
  public async fetchUserPreferences(backendUrl: string, userId: string): Promise<any | null> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/users/${userId}/preferences`;
    try {
      const response = await this.safeFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        return data.preferences;
      }
    } catch (err) {
      console.warn('[AuthService] fetchUserPreferences error:', err);
    }
    return null;
  }

  // 38. Save User Preferences
  public async saveUserPreferences(backendUrl: string, userId: string, preferences: any): Promise<boolean> {
    const httpBase = this.normalizeHttpUrl(backendUrl);
    const endpoint = `${httpBase}/api/users/${userId}/preferences`;
    try {
      const response = await this.safeFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      return response.ok;
    } catch (err) {
      console.warn('[AuthService] saveUserPreferences error:', err);
      return false;
    }
  }
}

export const authService = AuthService.getInstance();
