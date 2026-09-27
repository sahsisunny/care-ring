import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheStats {
  count: number;
  sizeBytes: number;
  formattedSize: string;
  styleId?: string;
  styleName?: string;
}

export interface CacheProgress {
  current: number;
  total: number;
  locationName: string;
  isDone: boolean;
}

export interface FrequentLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  isCached?: boolean;
}

export interface SmartCacheConfig {
  enabled: boolean;
  maxLimitMB: number;
  autoCacheFrequent: boolean;
}

export type CacheStatsListener = (stats: CacheStats) => void;
export type CacheProgressListener = (progress: CacheProgress) => void;
export type SmartConfigListener = (config: SmartCacheConfig) => void;

const CACHE_STATS_PREFIX = '@carering_tile_cache_meta_';
const SMART_CONFIG_KEY = '@carering_smart_cache_config';

export class TileCacheService {
  private static styleStats: Record<string, CacheStats> = {};
  private static activeStyleId: string = 'detailedOsm';
  private static cachedConfig: SmartCacheConfig | null = null;
  private static statsListeners: Set<CacheStatsListener> = new Set();
  private static progressListeners: Set<CacheProgressListener> = new Set();
  private static configListeners: Set<SmartConfigListener> = new Set();

  public static setActiveStyleId(styleId: string): void {
    if (styleId) {
      this.activeStyleId = styleId;
    }
  }

  public static getActiveStyleId(): string {
    return this.activeStyleId;
  }

  public static formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  public static async getCacheStats(styleId?: string): Promise<CacheStats> {
    const targetStyle = styleId || this.activeStyleId || 'detailedOsm';
    if (this.styleStats[targetStyle]) {
      return this.styleStats[targetStyle];
    }
    try {
      const meta = await AsyncStorage.getItem(CACHE_STATS_PREFIX + targetStyle);
      if (meta) {
        const parsed = JSON.parse(meta);
        const stats: CacheStats = {
          count: parsed.count || 0,
          sizeBytes: parsed.sizeBytes || 0,
          formattedSize: parsed.formattedSize || this.formatBytes(parsed.sizeBytes || 0),
          styleId: targetStyle,
          styleName: parsed.styleName,
        };
        this.styleStats[targetStyle] = stats;
        return stats;
      }
    } catch (_) {}

    const initial: CacheStats = {
      count: 0,
      sizeBytes: 0,
      formattedSize: '0 B',
      styleId: targetStyle,
    };
    this.styleStats[targetStyle] = initial;
    return initial;
  }

  public static async updateCacheStats(stats: CacheStats): Promise<void> {
    const targetStyle = stats.styleId || this.activeStyleId || 'detailedOsm';
    const updated: CacheStats = {
      ...stats,
      styleId: targetStyle,
      formattedSize: stats.formattedSize || this.formatBytes(stats.sizeBytes),
    };
    this.styleStats[targetStyle] = updated;

    try {
      await AsyncStorage.setItem(CACHE_STATS_PREFIX + targetStyle, JSON.stringify(updated));
    } catch (_) {}

    this.statsListeners.forEach((listener) => {
      try {
        listener(updated);
      } catch (_) {}
    });
  }

  public static async clearCache(styleId?: string): Promise<void> {
    const targetStyle = styleId || this.activeStyleId || 'detailedOsm';
    const cleared: CacheStats = {
      count: 0,
      sizeBytes: 0,
      formattedSize: '0 B',
      styleId: targetStyle,
    };
    this.styleStats[targetStyle] = cleared;

    try {
      await AsyncStorage.removeItem(CACHE_STATS_PREFIX + targetStyle);
    } catch (_) {}

    this.statsListeners.forEach((listener) => {
      try {
        listener(cleared);
      } catch (_) {}
    });
  }

  public static async getSmartConfig(): Promise<SmartCacheConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }
    try {
      const raw = await AsyncStorage.getItem(SMART_CONFIG_KEY);
      if (raw) {
        this.cachedConfig = JSON.parse(raw);
        return this.cachedConfig!;
      }
    } catch (_) {}

    const def: SmartCacheConfig = {
      enabled: true,
      maxLimitMB: 60,
      autoCacheFrequent: true,
    };
    this.cachedConfig = def;
    return def;
  }

  public static async updateSmartConfig(partial: Partial<SmartCacheConfig>): Promise<SmartCacheConfig> {
    const current = await this.getSmartConfig();
    const updated: SmartCacheConfig = { ...current, ...partial };
    this.cachedConfig = updated;
    try {
      await AsyncStorage.setItem(SMART_CONFIG_KEY, JSON.stringify(updated));
    } catch (_) {}

    this.configListeners.forEach((l) => {
      try {
        l(updated);
      } catch (_) {}
    });
    return updated;
  }

  public static subscribeStats(listener: CacheStatsListener): () => void {
    this.statsListeners.add(listener);
    const current = this.styleStats[this.activeStyleId];
    if (current) {
      listener(current);
    }
    return () => {
      this.statsListeners.delete(listener);
    };
  }

  public static subscribeProgress(listener: CacheProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  public static subscribeConfig(listener: SmartConfigListener): () => void {
    this.configListeners.add(listener);
    if (this.cachedConfig) {
      listener(this.cachedConfig);
    }
    return () => {
      this.configListeners.delete(listener);
    };
  }

  public static notifyProgress(progress: CacheProgress): void {
    this.progressListeners.forEach((listener) => {
      try {
        listener(progress);
      } catch (_) {}
    });
  }
}
