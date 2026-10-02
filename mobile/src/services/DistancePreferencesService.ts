import AsyncStorage from '@react-native-async-storage/async-storage';

export type TransportMode = 'car' | 'bike' | 'bicycle' | 'walk' | 'air' | 'transit';
export type DistanceUnit = 'metric' | 'imperial';

export interface DistancePreferences {
  mode: TransportMode;
  unit: DistanceUnit;
  showEta: boolean;
}

export interface TransportModeMeta {
  id: TransportMode;
  name: string;
  shortName: string;
  icon: string; // Ionicons icon name
  featherIcon?: string;
  emoji: string;
  factor: number; // Road / path winding coefficient relative to straight line (Haversine)
  speedKmh: number; // Average speed in km/h for ETA
  description: string;
}

export const TRANSPORT_MODES: Record<TransportMode, TransportModeMeta> = {
  car: {
    id: 'car',
    name: 'Car / Driving',
    shortName: 'Car',
    icon: 'car-sport',
    emoji: '🚗',
    factor: 1.28,
    speedKmh: 42,
    description: 'Road network distance with driving travel duration',
  },
  bike: {
    id: 'bike',
    name: 'Bike / Motorcycle',
    shortName: 'Bike',
    icon: 'speedometer-outline',
    emoji: '🏍️',
    factor: 1.25,
    speedKmh: 38,
    description: 'Motorcycle, scooter & two-wheeler route with agile duration',
  },
  bicycle: {
    id: 'bicycle',
    name: 'Bicycle / Cycling',
    shortName: 'Cycle',
    icon: 'bicycle',
    emoji: '🚲',
    factor: 1.18,
    speedKmh: 16,
    description: 'Cycleways and street routes with pedal cycling duration',
  },
  walk: {
    id: 'walk',
    name: 'Walking / Foot',
    shortName: 'Walk',
    icon: 'walk',
    emoji: '🚶',
    factor: 1.10,
    speedKmh: 4.8,
    description: 'Pedestrian paths and footpaths with walking travel duration',
  },
  air: {
    id: 'air',
    name: 'Air / Straight Line',
    shortName: 'Air',
    icon: 'airplane',
    emoji: '✈️',
    factor: 1.0,
    speedKmh: 0, // Direct distance has no terrestrial transit speed
    description: 'Direct straight-line geodesic distance (as the crow flies)',
  },
  transit: {
    id: 'transit',
    name: 'Public Transit / Bus',
    shortName: 'Transit',
    icon: 'bus',
    emoji: '🚆',
    factor: 1.35,
    speedKmh: 24,
    description: 'Public transportation networks, subways & buses',
  },
};

const STORAGE_KEY = '@carering_distance_preferences';

export const DEFAULT_DISTANCE_PREFERENCES: DistancePreferences = {
  mode: 'car',
  unit: 'metric',
  showEta: true,
};

type DistancePrefsListener = (prefs: DistancePreferences) => void;

class DistancePreferencesService {
  private currentPrefs: DistancePreferences = { ...DEFAULT_DISTANCE_PREFERENCES };
  private listeners: Set<DistancePrefsListener> = new Set();
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<DistancePreferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.currentPrefs = {
          mode: parsed.mode || DEFAULT_DISTANCE_PREFERENCES.mode,
          unit: parsed.unit || DEFAULT_DISTANCE_PREFERENCES.unit,
          showEta: parsed.showEta !== undefined ? parsed.showEta : DEFAULT_DISTANCE_PREFERENCES.showEta,
        };
      }
    } catch (err) {
      console.warn('[DistancePreferencesService] Failed to load preferences:', err);
    } finally {
      this.isLoaded = true;
    }
    return this.currentPrefs;
  }

  public async getPreferences(): Promise<DistancePreferences> {
    if (!this.isLoaded) {
      await this.loadFromStorage();
    }
    return { ...this.currentPrefs };
  }

  public getPreferencesSync(): DistancePreferences {
    return { ...this.currentPrefs };
  }

  public async setPreferences(newPrefs: Partial<DistancePreferences>): Promise<DistancePreferences> {
    this.currentPrefs = {
      ...this.currentPrefs,
      ...newPrefs,
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentPrefs));
    } catch (err) {
      console.warn('[DistancePreferencesService] Failed to save preferences:', err);
    }
    this.notifyListeners();
    return { ...this.currentPrefs };
  }

  public subscribe(listener: DistancePrefsListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.currentPrefs });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const copy = { ...this.currentPrefs };
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch (e) {
        console.error('[DistancePreferencesService] Listener error:', e);
      }
    }
  }

  public getModeMeta(mode: TransportMode): TransportModeMeta {
    return TRANSPORT_MODES[mode] || TRANSPORT_MODES.car;
  }
}

export const distancePreferencesService = new DistancePreferencesService();
