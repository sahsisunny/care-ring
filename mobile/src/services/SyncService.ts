import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { Circle, parseCircle } from '../models/Circle';
import { MemberData, parseMember } from '../models/Member';
import { authService } from './AuthService';
import { circleCustomizationService } from './CircleCustomizationService';
import { NicknameService } from './NicknameService';

export interface SyncPayload {
  circles?: Circle[];
  members?: MemberData[];
  places?: any[];
  nicknames?: Record<string, string>;
  favorites?: string[];
  preferences?: any;
  serverTime?: string;
}

export type SyncListener = (payload: SyncPayload) => void;

class SyncService {
  private static instance: SyncService;
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private lastSyncTime = 0;
  private currentUserId: string | null = null;
  private activeCircleId: string | null = null;
  private currentBackendUrl: string | null = null;
  private appStateSubscription: any = null;

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  constructor() {
    this.setupAppStateListener();
  }

  // Storage key helpers
  private getCirclesKey(userId: string): string {
    return `@carering_circles_cache_${userId}`;
  }

  private getMembersKey(circleId: string): string {
    return `@carering_members_cache_${circleId}`;
  }

  private getPlacesKey(circleId: string): string {
    return `@carering_places_cache_${circleId}`;
  }

  private getFavoritesKey(userId: string, circleId: string): string {
    return `@carering_favorites_cache_${userId}_${circleId}`;
  }

  public addListener(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(payload: SyncPayload): void {
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (_) {}
    });
  }

  /**
   * Set active context for background synchronization
   */
  public setContext(userId: string, circleId: string | null, backendUrl: string): void {
    this.currentUserId = userId;
    this.activeCircleId = circleId;
    this.currentBackendUrl = backendUrl;
  }

  /**
   * Automatically sync whenever app returns to foreground (WhatsApp/Google style)
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const now = Date.now();
        // Debounce: sync at most once every 15 seconds on foreground resume
        if (now - this.lastSyncTime > 15000 && this.currentUserId && this.currentBackendUrl) {
          this.syncNow(this.currentUserId, this.activeCircleId, this.currentBackendUrl).catch(() => {});
        }
      }
    });
  }

  // -------------------------------------------------------------
  // INSTANT LOCAL CACHE ACCESS (0ms cold start)
  // -------------------------------------------------------------

  public async getCachedCircles(userId: string): Promise<Circle[]> {
    if (!userId) return [];
    try {
      const raw = await AsyncStorage.getItem(this.getCirclesKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => parseCircle(c));
        }
      }
    } catch (_) {}
    return [];
  }

  public async setCachedCircles(userId: string, circles: Circle[]): Promise<void> {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(this.getCirclesKey(userId), JSON.stringify(circles));
    } catch (_) {}
  }

  public async getCachedMembers(circleId: string): Promise<MemberData[]> {
    if (!circleId) return [];
    try {
      const raw = await AsyncStorage.getItem(this.getMembersKey(circleId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((m) => parseMember(m));
        }
      }
    } catch (_) {}
    return [];
  }

  public async setCachedMembers(circleId: string, members: MemberData[]): Promise<void> {
    if (!circleId) return;
    try {
      await AsyncStorage.setItem(this.getMembersKey(circleId), JSON.stringify(members));
    } catch (_) {}
  }

  public async getCachedPlaces(circleId: string): Promise<any[]> {
    if (!circleId) return [];
    try {
      const raw = await AsyncStorage.getItem(this.getPlacesKey(circleId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (_) {}
    return [];
  }

  public async setCachedPlaces(circleId: string, places: any[]): Promise<void> {
    if (!circleId) return;
    try {
      await AsyncStorage.setItem(this.getPlacesKey(circleId), JSON.stringify(places));
    } catch (_) {}
  }

  public async getCachedFavorites(userId: string, circleId: string): Promise<string[]> {
    if (!userId || !circleId) return [];
    try {
      const raw = await AsyncStorage.getItem(this.getFavoritesKey(userId, circleId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  public async setCachedFavorites(userId: string, circleId: string, favorites: string[]): Promise<void> {
    if (!userId || !circleId) return;
    try {
      await AsyncStorage.setItem(this.getFavoritesKey(userId, circleId), JSON.stringify(favorites));
    } catch (_) {}
  }

  // -------------------------------------------------------------
  // FULL BACKGROUND RECONCILIATION ENGINE
  // -------------------------------------------------------------

  public async syncNow(
    userId: string,
    circleId: string | null,
    backendUrl: string
  ): Promise<SyncPayload | null> {
    if (!userId || !backendUrl || this.isSyncing) return null;
    this.isSyncing = true;
    this.lastSyncTime = Date.now();

    try {
      const data = await authService.fetchBootstrap(backendUrl, userId, circleId || undefined);
      if (!data || !data.success) {
        this.isSyncing = false;
        return null;
      }

      const circles: Circle[] = Array.isArray(data.circles)
        ? data.circles.map((c: any) => parseCircle(c))
        : [];

      // 1. Persist circles to local cache
      await this.setCachedCircles(userId, circles);

      // Reconcile circle custom metadata
      for (const c of circles) {
        if (c.circleType || c.badgeEmoji || c.imageUrl || c.distanceUnit) {
          circleCustomizationService.applyRemoteMeta(c.id, {
            circleType: c.circleType as any,
            badgeEmoji: c.badgeEmoji,
            imageUri: c.imageUrl || undefined,
            distanceUnit: c.distanceUnit as any,
          }).catch(() => {});
        }
      }

      let members: MemberData[] = [];
      let places: any[] = [];
      let nicknames: Record<string, string> = {};
      let favorites: string[] = [];

      if (data.activeCircle && circleId) {
        // 2. Members
        if (Array.isArray(data.activeCircle.members)) {
          members = data.activeCircle.members.map((m: any) => parseMember(m));
          await this.setCachedMembers(circleId, members);
        }

        // 3. Saved Places
        if (Array.isArray(data.activeCircle.places)) {
          places = data.activeCircle.places;
          await this.setCachedPlaces(circleId, places);
        }

        // 4. Nicknames
        if (data.activeCircle.nicknames) {
          nicknames = data.activeCircle.nicknames;
          const storageKey = `@carering_nicknames_${userId}_${circleId}`;
          await AsyncStorage.setItem(storageKey, JSON.stringify(nicknames)).catch(() => {});
        }

        // 5. Favorites
        if (Array.isArray(data.activeCircle.favorites)) {
          favorites = data.activeCircle.favorites;
          await this.setCachedFavorites(userId, circleId, favorites);
        }
      }

      const payload: SyncPayload = {
        circles,
        members,
        places,
        nicknames,
        favorites,
        preferences: data.preferences,
        serverTime: data.serverTime,
      };

      this.notify(payload);
      this.isSyncing = false;
      return payload;
    } catch (err) {
      console.warn('[SyncService] Background sync error:', err);
      this.isSyncing = false;
      return null;
    }
  }

  // -------------------------------------------------------------
  // REAL-TIME CACHE UPDATERS (Called by WebSocket Client)
  // -------------------------------------------------------------

  public async onRemotePlaceCreated(circleId: string, place: any): Promise<void> {
    const current = await this.getCachedPlaces(circleId);
    const updated = [place, ...current.filter((p) => p.id !== place.id)];
    await this.setCachedPlaces(circleId, updated);
    this.notify({ places: updated });
  }

  public async onRemotePlaceDeleted(circleId: string, placeId: string): Promise<void> {
    const current = await this.getCachedPlaces(circleId);
    const updated = current.filter((p) => p.id !== placeId);
    await this.setCachedPlaces(circleId, updated);
    this.notify({ places: updated });
  }

  public async onRemoteCircleUpdated(circleId: string, data: any): Promise<void> {
    if (!this.currentUserId) return;
    const current = await this.getCachedCircles(this.currentUserId);
    const updated = current.map((c) => {
      if (c.id === circleId) {
        return {
          ...c,
          name: data.name || c.name,
          circleType: data.circleType || c.circleType,
          badgeEmoji: data.badgeEmoji || c.badgeEmoji,
          imageUrl: data.imageUrl !== undefined ? data.imageUrl : c.imageUrl,
          distanceUnit: data.distanceUnit || c.distanceUnit,
        };
      }
      return c;
    });
    await this.setCachedCircles(this.currentUserId, updated);
    this.notify({ circles: updated });
  }

  public async onRemoteFavoritesUpdated(circleId: string, favoriteUserId: string, isFavorite: boolean): Promise<void> {
    if (!this.currentUserId) return;
    const current = await this.getCachedFavorites(this.currentUserId, circleId);
    const next = isFavorite
      ? Array.from(new Set([...current, favoriteUserId]))
      : current.filter((id) => id !== favoriteUserId);
    await this.setCachedFavorites(this.currentUserId, circleId, next);
    this.notify({ favorites: next });
  }
}

export const syncService = SyncService.getInstance();
