import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Appearance, AppState, Platform, useColorScheme } from 'react-native';
import {
  AppThemeId,
  AppThemeConfig,
  ALL_APP_THEMES,
  themeService,
  LiquidGlassCustomConfig,
  DEFAULT_GLASS_CONFIG,
} from './ThemeService';
import { ThemePalette, getThemePalette, applyThemeToColors } from './colors';

interface ThemeContextType {
  themeId: AppThemeId;
  resolvedThemeId: 'dark' | 'light';
  theme: AppThemeConfig;
  colors: ThemePalette;
  isDark: boolean;
  isGlass: boolean;
  glassConfig: LiquidGlassCustomConfig;
  setTheme: (themeId: AppThemeId) => Promise<void>;
  updateGlassConfig: (config: Partial<LiquidGlassCustomConfig>) => Promise<void>;
  resetGlassConfig: () => Promise<void>;
}

// Helper to determine the OS system appearance with fallback mechanisms
const getSystemTheme = (rnScheme?: string | null): 'dark' | 'light' => {
  if (rnScheme === 'dark' || rnScheme === 'light') {
    return rnScheme;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const appScheme = Appearance.getColorScheme();
  if (appScheme === 'dark' || appScheme === 'light') {
    return appScheme;
  }
  return 'light';
};

const initialOs = getSystemTheme();
const defaultTheme = ALL_APP_THEMES[0];
const defaultPalette = getThemePalette(defaultTheme.id);

const ThemeContext = createContext<ThemeContextType>({
  themeId: defaultTheme.id,
  resolvedThemeId: initialOs,
  theme: defaultTheme,
  colors: defaultPalette,
  isDark: initialOs === 'dark',
  isGlass: false,
  glassConfig: DEFAULT_GLASS_CONFIG,
  setTheme: async () => {},
  updateGlassConfig: async () => {},
  resetGlassConfig: async () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // React Native reactive color scheme hook
  const rnColorScheme = useColorScheme();

  const [themeId, setThemeId] = useState<AppThemeId>(themeService.getActiveThemeId());
  const [glassConfig] = useState<LiquidGlassCustomConfig>(DEFAULT_GLASS_CONFIG);

  // Dynamic system appearance that faithfully reflects the device OS theme
  const [systemScheme, setSystemScheme] = useState<'dark' | 'light'>(() =>
    getSystemTheme(rnColorScheme)
  );

  const resolveCanonical = useCallback(
    (id: AppThemeId, osScheme: 'dark' | 'light'): 'dark' | 'light' => {
      if (id === 'system') return osScheme;
      return id === 'dark' || id === 'dark-glass' ? 'dark' : 'light';
    },
    []
  );

  // Keep systemScheme in sync whenever rnColorScheme hook updates
  useEffect(() => {
    const detected = getSystemTheme(rnColorScheme);
    setSystemScheme(detected);
  }, [rnColorScheme]);

  // Init persisted theme from AsyncStorage on mount
  useEffect(() => {
    themeService.init().then(({ themeId: id }) => {
      setThemeId(id);
      const os = getSystemTheme(rnColorScheme);
      applyThemeToColors(resolveCanonical(id, os));
    });

    const unsubscribe = themeService.subscribe((id) => {
      setThemeId(id);
      const os = getSystemTheme(rnColorScheme);
      applyThemeToColors(resolveCanonical(id, os));
    });

    return () => unsubscribe();
  }, [rnColorScheme, resolveCanonical]);

  // Listen to OS appearance changes and AppState resume events
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const scheme: 'dark' | 'light' = colorScheme === 'dark' ? 'dark' : 'light';
      setSystemScheme(scheme);
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const currentOs = getSystemTheme(Appearance.getColorScheme());
        setSystemScheme(currentOs);
      }
    });

    return () => {
      subscription.remove();
      appStateSub.remove();
    };
  }, []);

  // Update global Colors object whenever canonical theme changes
  const canonicalThemeId = resolveCanonical(themeId, systemScheme);
  useEffect(() => {
    applyThemeToColors(canonicalThemeId);
  }, [canonicalThemeId]);

  const handleSetTheme = async (newThemeId: AppThemeId) => {
    setThemeId(newThemeId);
    const os = getSystemTheme(rnColorScheme);
    const canonical = resolveCanonical(newThemeId, os);
    applyThemeToColors(canonical);
    await themeService.setTheme(newThemeId);
  };

  const handleUpdateGlassConfig = async (_partial: Partial<LiquidGlassCustomConfig>) => {};
  const handleResetGlassConfig = async () => {};

  const currentTheme = ALL_APP_THEMES.find((t) => t.id === themeId) || ALL_APP_THEMES[0];
  const palette = getThemePalette(canonicalThemeId);
  const isDark = canonicalThemeId === 'dark';
  const isGlass = false;

  return (
    <ThemeContext.Provider
      value={{
        themeId, // User's chosen setting ('system', 'light', 'dark')
        resolvedThemeId: canonicalThemeId,
        theme: currentTheme,
        colors: palette,
        isDark,
        isGlass,
        glassConfig,
        setTheme: handleSetTheme,
        updateGlassConfig: handleUpdateGlassConfig,
        resetGlassConfig: handleResetGlassConfig,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
