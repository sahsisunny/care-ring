import AsyncStorage from '@react-native-async-storage/async-storage';
import { distancePreferencesService } from './DistancePreferencesService';

export type CircleType = 'family' | 'friends' | 'trip' | 'work' | 'custom';

export interface CircleTypeMeta {
  id: CircleType;
  label: string;
  emoji: string;
  description: string;
  defaultPlaces: Array<{ name: string; category: string; emoji: string }>;
}

export const CIRCLE_TYPES: Record<CircleType, CircleTypeMeta> = {
  family: {
    id: 'family',
    label: 'Family Circle',
    emoji: '👨‍👩‍👧‍👦',
    description: 'Track family members, home, work, and school arrivals',
    defaultPlaces: [
      { name: 'Home', category: 'home', emoji: '🏠' },
      { name: 'School', category: 'school', emoji: '🏫' },
      { name: 'Office', category: 'office', emoji: '🏢' },
    ],
  },
  friends: {
    id: 'friends',
    label: 'Friends Circle',
    emoji: '👥',
    description: 'Keep tabs with friends, college campus, cafes, and hangouts',
    defaultPlaces: [
      { name: 'College', category: 'college', emoji: '🎓' },
      { name: 'Hangout Hub', category: 'cafe', emoji: '☕' },
      { name: 'Gym', category: 'gym', emoji: '🏋️' },
    ],
  },
  trip: {
    id: 'trip',
    label: 'Bike / Road Trip',
    emoji: '🏍️',
    description: 'Coordinate bike rides, convoys, pit stops, and basecamps',
    defaultPlaces: [
      { name: 'Basecamp', category: 'trip', emoji: '⛺' },
      { name: 'Pit Stop', category: 'trip', emoji: '⛽' },
      { name: 'Destination', category: 'trip', emoji: '🏔️' },
    ],
  },
  work: {
    id: 'work',
    label: 'Work & Team',
    emoji: '💼',
    description: 'Field workers, office teams, and site check-ins',
    defaultPlaces: [
      { name: 'Main Office', category: 'office', emoji: '🏢' },
      { name: 'Branch Site', category: 'office', emoji: '🏗️' },
    ],
  },
  custom: {
    id: 'custom',
    label: 'Custom Circle',
    emoji: '✨',
    description: 'Custom community with tailored places and preferences',
    defaultPlaces: [
      { name: 'HQ', category: 'other', emoji: '📍' },
    ],
  },
};

export const PRESET_CIRCLE_BADGES = [
  '👨‍👩‍👧‍👦', '👥', '🏍️', '🚗', '🏕️', '🎓', '💼', '🏖️', '🚴', '⚽', '🏠', '✈️'
];

export interface CircleCustomMeta {
  circleType: CircleType;
  badgeEmoji: string;
  imageUri?: string;
  distanceUnit: 'km' | 'miles';
  bubblesAllowed?: boolean;
  invitePolicyAdminsOnly?: boolean;
}

const STORAGE_PREFIX = '@carering_circle_meta_';

type CircleMetaListener = (circleId: string, meta: CircleCustomMeta) => void;

class CircleCustomizationService {
  private cache: Record<string, CircleCustomMeta> = {};
  private listeners: Set<CircleMetaListener> = new Set();

  public addListener(listener: CircleMetaListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(circleId: string, meta: CircleCustomMeta): void {
    this.listeners.forEach((fn) => {
      try {
        fn(circleId, meta);
      } catch (_) {}
    });
  }

  public async getCircleMeta(circleId: string): Promise<CircleCustomMeta> {
    if (this.cache[circleId]) {
      return this.cache[circleId];
    }

    try {
      const stored = await AsyncStorage.getItem(STORAGE_PREFIX + circleId);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.cache[circleId] = {
          circleType: parsed.circleType || 'family',
          badgeEmoji: parsed.badgeEmoji || '👨‍👩‍👧‍👦',
          imageUri: parsed.imageUri,
          distanceUnit: parsed.distanceUnit || 'km',
          bubblesAllowed: parsed.bubblesAllowed !== undefined ? parsed.bubblesAllowed : true,
          invitePolicyAdminsOnly: parsed.invitePolicyAdminsOnly !== undefined ? parsed.invitePolicyAdminsOnly : false,
        };
        return this.cache[circleId];
      }
    } catch (e) {
      console.warn('[CircleCustomizationService] Error reading meta:', e);
    }

    const defaultMeta: CircleCustomMeta = {
      circleType: 'family',
      badgeEmoji: '👨‍👩‍👧‍👦',
      distanceUnit: 'km',
      bubblesAllowed: true,
      invitePolicyAdminsOnly: false,
    };
    this.cache[circleId] = defaultMeta;
    return defaultMeta;
  }

  public async applyRemoteMeta(
    circleId: string,
    meta: Partial<CircleCustomMeta>
  ): Promise<CircleCustomMeta> {
    const current = await this.getCircleMeta(circleId);
    const updated: CircleCustomMeta = {
      ...current,
      ...meta,
    };
    this.cache[circleId] = updated;
    await AsyncStorage.setItem(STORAGE_PREFIX + circleId, JSON.stringify(updated)).catch(() => {});
    if (meta.distanceUnit) {
      distancePreferencesService.setPreferences({
        unit: meta.distanceUnit === 'miles' ? 'imperial' : 'metric',
      }).catch(() => {});
    }
    this.notifyListeners(circleId, updated);
    return updated;
  }

  public async saveCircleMeta(
    circleId: string,
    meta: Partial<CircleCustomMeta>,
    backendUrl?: string,
    wsClient?: any,
    userId?: string
  ): Promise<CircleCustomMeta> {
    const current = await this.getCircleMeta(circleId);
    const updated: CircleCustomMeta = {
      ...current,
      ...meta,
    };
    this.cache[circleId] = updated;

    // 1. Immediately cache locally for 0ms response
    try {
      await AsyncStorage.setItem(STORAGE_PREFIX + circleId, JSON.stringify(updated));
    } catch (e) {
      console.warn('[CircleCustomizationService] Error saving meta:', e);
    }
    this.notifyListeners(circleId, updated);

    if (meta.distanceUnit) {
      distancePreferencesService.setPreferences({
        unit: meta.distanceUnit === 'miles' ? 'imperial' : 'metric',
      }).catch(() => {});
    }

    // 2. Real-time WebSocket delivery to circle members
    if (wsClient && typeof wsClient.updateCircleMeta === 'function') {
      wsClient.updateCircleMeta({
        circleType: updated.circleType,
        badgeEmoji: updated.badgeEmoji,
        imageUrl: updated.imageUri,
        distanceUnit: updated.distanceUnit,
      });
    }

    // 3. Asynchronously persist to PostgreSQL database
    if (backendUrl) {
      try {
        const { authService } = require('./AuthService');
        authService.updateCircleMeta(backendUrl, circleId, {
          circleType: updated.circleType,
          badgeEmoji: updated.badgeEmoji,
          imageUrl: updated.imageUri,
          distanceUnit: updated.distanceUnit,
          bubblesAllowed: updated.bubblesAllowed,
          invitePolicyAdminsOnly: updated.invitePolicyAdminsOnly,
          userId,
        }).catch((err: any) => console.warn('[CircleCustomizationService] Cloud sync error:', err));
      } catch (_) {}
    }

    return updated;
  }
}

export const circleCustomizationService = new CircleCustomizationService();

export function getCategoryEmoji(category?: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('home')) return '🏠';
  if (cat.includes('office') || cat.includes('work')) return '🏢';
  if (cat.includes('college') || cat.includes('univ')) return '🎓';
  if (cat.includes('school')) return '🏫';
  if (cat.includes('gym') || cat.includes('fitness')) return '🏋️';
  if (cat.includes('trip') || cat.includes('camp') || cat.includes('bike')) return '⛺';
  if (cat.includes('cafe') || cat.includes('coffee') || cat.includes('restaurant')) return '☕';
  return '📍';
}

export function formatDistance(meters: number, unit: 'km' | 'miles' = 'km'): string {
  if (unit === 'miles') {
    const mi = meters / 1609.344;
    return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
  }
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}
