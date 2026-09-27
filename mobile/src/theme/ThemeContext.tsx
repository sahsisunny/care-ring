import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  theme: AppThemeConfig;
  colors: ThemePalette;
  isDark: boolean;
  isGlass: boolean;
  glassConfig: LiquidGlassCustomConfig;
  setTheme: (themeId: AppThemeId) => Promise<void>;
  updateGlassConfig: (config: Partial<LiquidGlassCustomConfig>) => Promise<void>;
  resetGlassConfig: () => Promise<void>;
}

const defaultTheme = ALL_APP_THEMES[0];
const defaultPalette = getThemePalette(defaultTheme.id);

const ThemeContext = createContext<ThemeContextType>({
  themeId: defaultTheme.id,
  theme: defaultTheme,
  colors: defaultPalette,
  isDark: false,
  isGlass: false,
  glassConfig: DEFAULT_GLASS_CONFIG,
  setTheme: async () => {},
  updateGlassConfig: async () => {},
  resetGlassConfig: async () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<AppThemeId>(themeService.getActiveThemeId());
  const [glassConfig] = useState<LiquidGlassCustomConfig>(DEFAULT_GLASS_CONFIG);

  useEffect(() => {
    themeService.init().then(({ themeId: id }) => {
      setThemeId(id);
      applyThemeToColors(id);
    });

    const unsubscribe = themeService.subscribe((id) => {
      setThemeId(id);
      applyThemeToColors(id);
    });

    return () => unsubscribe();
  }, []);

  const handleSetTheme = async (newThemeId: AppThemeId) => {
    const canonical: AppThemeId = (newThemeId === 'dark' || newThemeId === 'dark-glass') ? 'dark' : 'light';
    setThemeId(canonical);
    applyThemeToColors(canonical);
    await themeService.setTheme(canonical);
  };

  const handleUpdateGlassConfig = async (_partial: Partial<LiquidGlassCustomConfig>) => {};

  const handleResetGlassConfig = async () => {};

  const canonicalThemeId = (themeId === 'dark' || themeId === 'dark-glass') ? 'dark' : 'light';
  const currentTheme = ALL_APP_THEMES.find((t) => t.id === canonicalThemeId) || ALL_APP_THEMES[0];
  const palette = getThemePalette(canonicalThemeId);
  const isDark = canonicalThemeId === 'dark';
  const isGlass = false;

  return (
    <ThemeContext.Provider
      value={{
        themeId: canonicalThemeId,
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
