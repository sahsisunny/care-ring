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
const defaultPalette = getThemePalette(defaultTheme.id, DEFAULT_GLASS_CONFIG);

const ThemeContext = createContext<ThemeContextType>({
  themeId: defaultTheme.id,
  theme: defaultTheme,
  colors: defaultPalette,
  isDark: false,
  isGlass: true,
  glassConfig: DEFAULT_GLASS_CONFIG,
  setTheme: async () => {},
  updateGlassConfig: async () => {},
  resetGlassConfig: async () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<AppThemeId>(themeService.getActiveThemeId());
  const [glassConfig, setGlassConfig] = useState<LiquidGlassCustomConfig>(themeService.getGlassConfig());

  useEffect(() => {
    themeService.init().then(({ themeId: id, glassConfig: gc }) => {
      setThemeId(id);
      setGlassConfig(gc);
      applyThemeToColors(id, gc);
    });

    const unsubscribe = themeService.subscribe((id, gc) => {
      setThemeId(id);
      setGlassConfig(gc);
      applyThemeToColors(id, gc);
    });

    return () => unsubscribe();
  }, []);

  const handleSetTheme = async (newThemeId: AppThemeId) => {
    setThemeId(newThemeId);
    applyThemeToColors(newThemeId, glassConfig);
    await themeService.setTheme(newThemeId);
  };

  const handleUpdateGlassConfig = async (partial: Partial<LiquidGlassCustomConfig>) => {
    const updated = await themeService.updateGlassConfig(partial);
    setGlassConfig(updated);
    applyThemeToColors(themeId, updated);
  };

  const handleResetGlassConfig = async () => {
    const reset = await themeService.resetGlassConfig();
    setGlassConfig(reset);
    applyThemeToColors(themeId, reset);
  };

  const currentTheme = ALL_APP_THEMES.find((t) => t.id === themeId) || ALL_APP_THEMES[0];
  const palette = getThemePalette(themeId, glassConfig);
  const isDark = themeId === 'dark-glass';
  const isGlass = themeId !== 'standard';

  return (
    <ThemeContext.Provider
      value={{
        themeId,
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
