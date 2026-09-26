import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@carering_app_theme_v1';
const GLASS_CONFIG_STORAGE_KEY = '@carering_liquid_glass_config_v1';

export type AppThemeId = 'light-glass' | 'dark-glass' | 'standard';

export type GlassGlowStyle = 'subtle' | 'crisp' | 'neon';
export type GlassAccentTint = 'default' | 'cyan' | 'violet' | 'amber' | 'emerald';

export interface LiquidGlassCustomConfig {
  blurIntensity: number; // 25, 50, 75, 95
  opacityPercent: number; // 60, 75, 85, 95
  borderGlow: GlassGlowStyle;
  tintColor: GlassAccentTint;
}

export const DEFAULT_GLASS_CONFIG: LiquidGlassCustomConfig = {
  blurIntensity: 65,
  opacityPercent: 60,
  borderGlow: 'crisp',
  tintColor: 'default',
};

export interface AppThemeConfig {
  id: AppThemeId;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  icon: 'sunny' | 'moon' | 'contrast';
  preview: {
    canvasBg: string;
    cardBg: string;
    borderColor: string;
    borderWidth: number;
    accentColor: string;
    textColor: string;
    subtextColor: string;
    hasBlur: boolean;
    hasGlow: boolean;
    pillBg: string;
  };
}

export const ALL_APP_THEMES: AppThemeConfig[] = [
  {
    id: 'light-glass',
    name: 'Light Mode (Liquid Glass)',
    badge: 'Apple Liquid Glass',
    tagline: 'Bright pastel canvas with genuine frosted refraction',
    description:
      'Authentic Apple iOS 26 Liquid Glass: ultra-low opacity frosted glass (18% white) with multi-layer specular bevel, chromatic refraction micro-tint, and saturation-boosted backdrop blur. Controls float as genuine glass layers above a rich pastel canvas.',
    icon: 'sunny',
    preview: {
      canvasBg: '#DDE6F5',
      cardBg: 'rgba(255, 255, 255, 0.18)',
      borderColor: 'rgba(255, 255, 255, 0.88)',
      borderWidth: 1.5,
      accentColor: '#4F46E5',
      textColor: '#0A0F1E',
      subtextColor: '#3D4A6B',
      hasBlur: true,
      hasGlow: false,
      pillBg: 'rgba(255, 255, 255, 0.28)',
    },
  },
  {
    id: 'dark-glass',
    name: 'Dark Mode (Liquid Glass)',
    badge: 'Apple Liquid Glass',
    tagline: 'Deep midnight canvas with ambient luminous glass',
    description:
      'Authentic Apple iOS 26 Dark Liquid Glass: ultra-low opacity (9% white on deep dark) with ambient neon glow, top-edge specular refraction, chromatic micro-tint, and saturation-boosted blur. Glass surfaces absorb and amplify ambient accent lights.',
    icon: 'moon',
    preview: {
      canvasBg: '#050810',
      cardBg: 'rgba(255, 255, 255, 0.09)',
      borderColor: 'rgba(255, 255, 255, 0.22)',
      borderWidth: 1.5,
      accentColor: '#818CF8',
      textColor: '#F0F4FF',
      subtextColor: '#94A3B8',
      hasBlur: true,
      hasGlow: true,
      pillBg: 'rgba(255, 255, 255, 0.09)',
    },
  },
  {
    id: 'standard',
    name: 'Standard Normal Theme',
    badge: 'Accessible Flat UI',
    tagline: 'Solid opaque containers with soft drop shadows',
    description:
      'Standard flat UI style for accessibility. Uses solid, opaque neutral gray containers with zero transparency or glass refraction, separating elements cleanly using soft drop shadows.',
    icon: 'contrast',
    preview: {
      canvasBg: '#F8FAFC',
      cardBg: '#FFFFFF',
      borderColor: '#E2E8F0',
      borderWidth: 1,
      accentColor: '#4F46E5',
      textColor: '#0F172A',
      subtextColor: '#475569',
      hasBlur: false,
      hasGlow: false,
      pillBg: '#F1F5F9',
    },
  },
];

type ThemeChangeListener = (themeId: AppThemeId, glassConfig: LiquidGlassCustomConfig) => void;

class ThemeService {
  private activeThemeId: AppThemeId = 'light-glass';
  private glassConfig: LiquidGlassCustomConfig = { ...DEFAULT_GLASS_CONFIG };
  private listeners: Set<ThemeChangeListener> = new Set();
  private initialized: boolean = false;

  async init(): Promise<{ themeId: AppThemeId; glassConfig: LiquidGlassCustomConfig }> {
    if (this.initialized) {
      return { themeId: this.activeThemeId, glassConfig: this.glassConfig };
    }
    try {
      const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme && (storedTheme === 'light-glass' || storedTheme === 'dark-glass' || storedTheme === 'standard')) {
        this.activeThemeId = storedTheme as AppThemeId;
      }

      const storedGlass = await AsyncStorage.getItem(GLASS_CONFIG_STORAGE_KEY);
      if (storedGlass) {
        try {
          const parsed = JSON.parse(storedGlass);
          this.glassConfig = { ...DEFAULT_GLASS_CONFIG, ...parsed };
        } catch (_) {}
      }
    } catch (e) {
      console.warn('[ThemeService] Failed to load theme or glass config from storage', e);
    }
    this.initialized = true;
    return { themeId: this.activeThemeId, glassConfig: this.glassConfig };
  }

  getActiveThemeId(): AppThemeId {
    return this.activeThemeId;
  }

  getActiveTheme(): AppThemeConfig {
    const found = ALL_APP_THEMES.find((t) => t.id === this.activeThemeId);
    return found || ALL_APP_THEMES[0];
  }

  getGlassConfig(): LiquidGlassCustomConfig {
    return { ...this.glassConfig };
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

  async updateGlassConfig(partial: Partial<LiquidGlassCustomConfig>): Promise<LiquidGlassCustomConfig> {
    this.glassConfig = {
      ...this.glassConfig,
      ...partial,
    };
    try {
      await AsyncStorage.setItem(GLASS_CONFIG_STORAGE_KEY, JSON.stringify(this.glassConfig));
    } catch (e) {
      console.warn('[ThemeService] Failed to persist glass config', e);
    }
    this.notifyListeners();
    return { ...this.glassConfig };
  }

  async resetGlassConfig(): Promise<LiquidGlassCustomConfig> {
    this.glassConfig = { ...DEFAULT_GLASS_CONFIG };
    try {
      await AsyncStorage.removeItem(GLASS_CONFIG_STORAGE_KEY);
    } catch (e) {
      console.warn('[ThemeService] Failed to reset glass config', e);
    }
    this.notifyListeners();
    return { ...this.glassConfig };
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
        listener(this.activeThemeId, this.glassConfig);
      } catch (err) {
        console.error('[ThemeService] Error in theme listener', err);
      }
    });
  }
}

export const themeService = new ThemeService();
