import AsyncStorage from '@react-native-async-storage/async-storage';
import { Circle, parseCircle } from '../models/Circle';

export interface UserSession {
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  activeCircleId?: string | null;
  activeCircleName?: string | null;
}

const SESSION_STORAGE_KEY = '@life360_auth_session';

class AuthService {
  private static instance: AuthService;
  private currentUser: UserSession | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        this.currentUser = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[AuthService] Failed to restore session:', e);
    }
    this.isInitialized = true;
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
  }

  public async signOut(): Promise<void> {
    this.currentUser = null;
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn('[AuthService] Failed to clear session:', e);
    }
  }

  private normalizeHttpUrl(url: string): string {
    return url.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
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

    const response = await fetch(endpoint, {
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

    const response = await fetch(endpoint, {
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

  // 3. Fast Google Sign-in / Guest Sign-in
  public async signInWithGoogle(params: {
    backendUrl: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
    googleId?: string;
  }): Promise<{ user: any; circles: Circle[]; activeCircle?: Circle | null }> {
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/auth/google`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        fullName: params.fullName.trim(),
        avatarUrl: params.avatarUrl,
        googleId: params.googleId || `g_${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sign in failed: ${errText}`);
    }

    const data = await response.json();
    const user = data.user;
    const rawCircles = Array.isArray(data.circles) ? data.circles : [];
    const circles = rawCircles.map((c: any) => parseCircle(c));
    const activeCircle = circles.length > 0 ? circles[0] : null;

    const session: UserSession = {
      userId: String(user.id),
      fullName: String(user.full_name || params.fullName),
      email: String(user.email || params.email),
      avatarUrl: user.avatar_url || params.avatarUrl || null,
      activeCircleId: activeCircle ? String(activeCircle.id) : null,
      activeCircleName: activeCircle ? String(activeCircle.name) : null,
    };

    await this.persistSession(session);
    return { user, circles, activeCircle };
  }

  // 4. Update Profile
  public async updateProfile(params: {
    backendUrl: string;
    fullName?: string;
    avatarUrl?: string;
    phone?: string;
  }): Promise<void> {
    if (!this.currentUser) return;
    const httpBase = this.normalizeHttpUrl(params.backendUrl);
    const endpoint = `${httpBase}/api/users/${this.currentUser.userId}/profile`;

    const body: Record<string, any> = {};
    if (params.fullName) body.fullName = params.fullName;
    if (params.avatarUrl) body.avatarUrl = params.avatarUrl;
    if (params.phone) body.phone = params.phone;

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      const updatedUser = data.user;
      const updated: UserSession = {
        ...this.currentUser,
        fullName: updatedUser.full_name || this.currentUser.fullName,
        avatarUrl: updatedUser.avatar_url !== undefined ? updatedUser.avatar_url : this.currentUser.avatarUrl,
        phone: updatedUser.phone !== undefined ? updatedUser.phone : this.currentUser.phone,
      };
      await this.persistSession(updated);
    }
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
}

export const authService = AuthService.getInstance();
