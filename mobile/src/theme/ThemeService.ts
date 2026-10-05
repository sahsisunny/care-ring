import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@carering_app_theme_v1';

export type AppThemeId = 'system' | 'light' | 'dark' | 'standard' | 'light-glass' | 'dark-glass';

export interface AppThemeConfig {
  id: AppThemeId;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  icon: 'sunny' | 'moon' | 'phone-portrait';
  preview: {
    canvasBg: string;
    cardBg: string;
    borderColor: string;
    borderWidth: number;
    accentColor: string;
    textColor: string;
    subtextColor: string;
    pillBg: string;
  };
}

export const ALL_APP_THEMES: AppThemeConfig[] = [
  {
    id: 'system',
    name: 'System Default',
    badge: 'Auto Sync',
    tagline: 'Matches device system appearance',
    description:
      'Automatically synchronizes with your device operating system appearance in real-time.',
    icon: 'phone-portrait',
    preview: {
      canvasBg: '#F1F5F9',
      cardBg: '#FFFFFF',
      borderColor: '#CBD5E1',
      borderWidth: 1.5,
      accentColor: '#3B82F6',
      textColor: '#0F172A',
      subtextColor: '#64748B',
      pillBg: '#E2E8F0',
    },
  },
  {
    id: 'light',
    name: 'Light Mode',
    badge: 'Flat UI',
    tagline: 'Clean, high-contrast light flat interface',
    description:
      'Crisp and accessible Flat UI design with solid surfaces, clear borders, and optimal contrast for bright environments. Zero transparency or glass refraction.',
    icon: 'sunny',
    preview: {
      canvasBg: '#F8FAFC',
      cardBg: '#FFFFFF',
      borderColor: '#E2E8F0',
      borderWidth: 1.5,
      accentColor: '#4F46E5',
      textColor: '#0F172A',
      subtextColor: '#475569',
      pillBg: '#F1F5F9',
    },
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    badge: 'Flat UI',
    tagline: 'Deep slate flat interface with high readability',
    description:
      'Modern and eye-friendly dark Flat UI design with solid dark surfaces, crisp structural borders, and reduced screen glare. Zero transparency or glass refraction.',
    icon: 'moon',
    preview: {
      canvasBg: '#0F172A',
      cardBg: '#1E293B',
      borderColor: '#334155',
      borderWidth: 1.5,
      accentColor: '#6366F1',
      textColor: '#F8FAFC',
      subtextColor: '#94A3B8',
      pillBg: '#0F172A',
    },
  },
];

// Compatibility type for any residual references
export interface LiquidGlassCustomConfig {
  blurIntensity?: number;
  opacityPercent?: number;
  borderGlow?: string;
  tintColor?: string;
}

export const DEFAULT_GLASS_CONFIG: LiquidGlassCustomConfig = {};

type ThemeChangeListener = (themeId: AppThemeId, glassConfig?: LiquidGlassCustomConfig) => void;

class ThemeService {
  private activeThemeId: AppThemeId = 'system';
  private listeners: Set<ThemeChangeListener> = new Set();
  private initialized: boolean = false;

  async init(): Promise<{ themeId: AppThemeId; glassConfig: LiquidGlassCustomConfig }> {
    if (this.initialized) {
      return { themeId: this.activeThemeId, glassConfig: DEFAULT_GLASS_CONFIG };
    }
    try {
      const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme) {
        if (storedTheme === 'system') {
          this.activeThemeId = 'system';
        } else if (storedTheme === 'dark' || storedTheme === 'dark-glass') {
          this.activeThemeId = 'dark';
        } else if (storedTheme === 'light' || storedTheme === 'standard' || storedTheme === 'light-glass') {
          this.activeThemeId = 'light';
        }
      } else {
        this.activeThemeId = 'system';
      }
    } catch (e) {
      console.warn('[ThemeService] Failed to load theme from storage', e);
    }
    this.initialized = true;
    return { themeId: this.activeThemeId, glassConfig: DEFAULT_GLASS_CONFIG };
  }

  getActiveThemeId(): AppThemeId {
    return this.activeThemeId;
  }

  getActiveTheme(): AppThemeConfig {
    const found = ALL_APP_THEMES.find((t) => t.id === this.activeThemeId);
    return found || ALL_APP_THEMES[0];
  }

  getGlassConfig(): LiquidGlassCustomConfig {
    return DEFAULT_GLASS_CONFIG;
  }

  async setTheme(themeId: AppThemeId): Promise<void> {
    if (this.activeThemeId === themeId) return;
    this.activeThemeId = themeId;
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch (e) {
      console.warn('[ThemeService] Failed to persist theme', e);
    }
    this.notifyListeners();
  }

  async updateGlassConfig(_partial: Partial<LiquidGlassCustomConfig>): Promise<LiquidGlassCustomConfig> {
    return DEFAULT_GLASS_CONFIG;
  }

  async resetGlassConfig(): Promise<LiquidGlassCustomConfig> {
    return DEFAULT_GLASS_CONFIG;
  }

  subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeThemeId, DEFAULT_GLASS_CONFIG);
      } catch (err) {
        console.error('[ThemeService] Error in theme listener', err);
      }
    });
  }
}

export const themeService = new ThemeService();
