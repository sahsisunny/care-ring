import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheStats {
  count: number;
  sizeBytes: number;
  formattedSize: string;
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

export type CacheStatsListener = (stats: CacheStats) => void;
export type CacheProgressListener = (progress: CacheProgress) => void;

const CACHE_STATS_KEY = '@carering_tile_cache_meta';

export class TileCacheService {
  private static cachedStats: CacheStats | null = null;
  private static statsListeners: Set<CacheStatsListener> = new Set();
  private static progressListeners: Set<CacheProgressListener> = new Set();

  public static formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  public static async getCacheStats(): Promise<CacheStats> {
    if (this.cachedStats) {
      return this.cachedStats;
    }
    try {
      const meta = await AsyncStorage.getItem(CACHE_STATS_KEY);
      if (meta) {
        const parsed = JSON.parse(meta);
        this.cachedStats = {
          count: parsed.count || 0,
          sizeBytes: parsed.sizeBytes || 0,
          formattedSize: parsed.formattedSize || this.formatBytes(parsed.sizeBytes || 0),
        };
        return this.cachedStats;
      }
    } catch (_) {}

    const initial: CacheStats = {
      count: 0,
      sizeBytes: 0,
      formattedSize: '0 B',
    };
    this.cachedStats = initial;
    return initial;
  }

  public static async updateCacheStats(stats: CacheStats): Promise<void> {
    this.cachedStats = {
      ...stats,
      formattedSize: stats.formattedSize || this.formatBytes(stats.sizeBytes),
    };
    try {
      await AsyncStorage.setItem(CACHE_STATS_KEY, JSON.stringify(this.cachedStats));
    } catch (_) {}

    // Notify listeners
    this.statsListeners.forEach((listener) => {
      try {
        listener(this.cachedStats!);
      } catch (_) {}
    });
  }

  public static async clearCache(): Promise<void> {
    this.cachedStats = {
      count: 0,
      sizeBytes: 0,
      formattedSize: '0 B',
    };
    try {
      await AsyncStorage.removeItem(CACHE_STATS_KEY);
    } catch (_) {}

    this.statsListeners.forEach((listener) => {
      try {
        listener(this.cachedStats!);
      } catch (_) {}
    });
  }

  public static subscribeStats(listener: CacheStatsListener): () => void {
    this.statsListeners.add(listener);
    if (this.cachedStats) {
      listener(this.cachedStats);
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

  public static notifyProgress(progress: CacheProgress): void {
    this.progressListeners.forEach((listener) => {
      try {
        listener(progress);
      } catch (_) {}
    });
  }
}
