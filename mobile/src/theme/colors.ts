import { Platform } from 'react-native';
import { AppThemeId, LiquidGlassCustomConfig, DEFAULT_GLASS_CONFIG } from './ThemeService';

/**
 * Web helper functions - Flat UI has zero blur or glass filters
 */
export function getWebGlassCardStyle(_isDark: boolean, _isGlass: boolean = false) {
  return {};
}

export function getWebGlassTileStyle(_isDark: boolean, _isGlass: boolean = false) {
  return {};
}

export function getWebGlassPillStyle(_isDark: boolean, _isGlass: boolean = false) {
  return {};
}

export interface ThemePalette {
  // CareRing Signature Brand Palette
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primarySoft: string;
  primaryBorder: string;

  // CareRing Dual Ring Accents
  ringCyan: string;
  ringCoral: string;
  ringPeach: string;
  ringNavy: string;

  // Status & Dynamics
  moving: string;
  movingDark: string;
  movingLight: string;
  stationary: string;
  offline: string;

  // Emergency / SOS
  sos: string;
  sosDark: string;
  sosLight: string;
  sosBorder: string;

  // Driving Report Colors
  speeding: string;
  distracted: string;
  rapidAccel: string;
  hardBraking: string;

  // Battery Levels
  batteryHigh: string;
  batteryMed: string;
  batteryLow: string;
  batteryCharging: string;

  // Neutrals, Surfaces, Cards (Flat UI)
  background: string;
  canvas: string;
  card: string;
  cardBorder: string;
  cardInnerBorder: string;
  textMain: string;
  textSecondary: string;
  textMuted: string;
  divider: string;

  // Core Glass tokens (retained as solid Flat UI surfaces for compatibility)
  glassSurface: string;
  glassWhite: string;
  glassDark: string;
  glassBorder: string;
  glassGlow: string;
  overlay: string;
  blurTint: 'light' | 'dark' | 'default' | 'prominent';
  blurIntensity: number;

  // Physical Rendering tokens (solid flat fallbacks)
  glassSpecularTop: string;
  glassSpecularBottom: string;
  glassRefractionTint: string;
  glassScrimBg: string;
  glassShimmer: string;

  // Tile & Item tokens
  tileBg: string;
  tileBorder: string;
  tileBgElevated: string;
  tileActiveBorder: string;
  modalCardBg: string;

  // Badges & Accents
  amberBadgeBg: string;
  amberBadgeText: string;
  blueBadgeBg: string;
  blueBadgeText: string;
  inputBg: string;
  inputBorder: string;
  iconBg: string;
  statusBar: 'light' | 'dark';
}

const BASE_PALETTE = {
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#EEF2FF',
  primarySoft: '#E0E7FF',
  primaryBorder: '#C7D2FE',

  ringCyan: '#00D2FE',
  ringCoral: '#FF4B72',
  ringPeach: '#FD9843',
  ringNavy: '#0A0F1D',

  moving: '#10B981',
  movingDark: '#059669',
  movingLight: '#ECFDF5',
  stationary: '#4F46E5',
  offline: '#94A3B8',

  sos: '#EF4444',
  sosDark: '#DC2626',
  sosLight: '#FEF2F2',
  sosBorder: '#FCA5A5',

  speeding: '#FF6B6B',
  distracted: '#06B6D4',
  rapidAccel: '#EC4899',
  hardBraking: '#F59E0B',

  batteryHigh: '#22C55E',
  batteryMed: '#F59E0B',
  batteryLow: '#EF4444',
  batteryCharging: '#06B6D4',

  amberBadgeBg: '#FEF3C7',
  amberBadgeText: '#B45309',
  blueBadgeBg: '#DBEAFE',
  blueBadgeText: '#1E40AF',
};

export function getThemePalette(
  themeId: AppThemeId,
  _glassConfig: LiquidGlassCustomConfig = DEFAULT_GLASS_CONFIG
): ThemePalette {
  const isDark = themeId === 'dark' || themeId === 'dark-glass';

  // ──────────────────────────────────────────────────────────────────────
  // DARK MODE FLAT UI (Solid midnight/slate surfaces, crisp borders)
  // ──────────────────────────────────────────────────────────────────────
  if (isDark) {
    return {
      ...BASE_PALETTE,
      primary: '#6366F1',
      primaryDark: '#4F46E5',
      primaryLight: '#312E81',
      primarySoft: '#1E1B4B',
      primaryBorder: '#4338CA',

      // Canvas & Surfaces
      background: '#0B0F19',
      canvas: '#0F172A',
      card: '#1E293B',
      cardBorder: '#334155',
      cardInnerBorder: '#475569',

      // Tiles & Lists
      tileBg: '#1E293B',
      tileBorder: '#334155',
      tileBgElevated: '#334155',
      tileActiveBorder: '#6366F1',
      modalCardBg: '#1E293B',

      // Typography
      textMain: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      divider: '#334155',

      // Flat surfaces (no glass)
      glassSurface: '#1E293B',
      glassWhite: '#334155',
      glassDark: '#0F172A',
      glassBorder: '#334155',
      glassGlow: 'transparent',
      overlay: 'rgba(0, 0, 0, 0.75)',
      blurTint: 'dark',
      blurIntensity: 0,

      glassSpecularTop: 'transparent',
      glassSpecularBottom: 'transparent',
      glassRefractionTint: 'transparent',
      glassScrimBg: '#1E293B',
      glassShimmer: 'transparent',

      inputBg: '#0F172A',
      inputBorder: '#334155',
      iconBg: '#334155',
      statusBar: 'light',
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIGHT MODE FLAT UI (Solid crisp slate surfaces, clean structure)
  // ──────────────────────────────────────────────────────────────────────
  return {
    ...BASE_PALETTE,
    primary: '#4F46E5',
    primaryDark: '#4338CA',
    primaryLight: '#EEF2FF',
    primarySoft: '#E0E7FF',
    primaryBorder: '#C7D2FE',

    // Canvas & Surfaces
    background: '#F1F5F9',
    canvas: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardInnerBorder: '#CBD5E1',

    // Tiles & Lists
    tileBg: '#F8FAFC',
    tileBorder: '#E2E8F0',
    tileBgElevated: '#FFFFFF',
    tileActiveBorder: '#4F46E5',
    modalCardBg: '#FFFFFF',

    // Typography
    textMain: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    divider: '#E2E8F0',

    // Flat surfaces (no glass)
    glassSurface: '#FFFFFF',
    glassWhite: '#FFFFFF',
    glassDark: '#0F172A',
    glassBorder: '#E2E8F0',
    glassGlow: 'transparent',
    overlay: 'rgba(15, 23, 42, 0.5)',
    blurTint: 'default',
    blurIntensity: 0,

    glassSpecularTop: 'transparent',
    glassSpecularBottom: 'transparent',
    glassRefractionTint: 'transparent',
    glassScrimBg: '#FFFFFF',
    glassShimmer: 'transparent',

    inputBg: '#F8FAFC',
    inputBorder: '#CBD5E1',
    iconBg: '#EEF2FF',
    statusBar: 'dark',
  };
}

// Mutable Colors object for backward compatibility
export const Colors: ThemePalette = {
  ...getThemePalette('light', DEFAULT_GLASS_CONFIG),
};

export function applyThemeToColors(
  themeId: AppThemeId,
  glassConfig: LiquidGlassCustomConfig = DEFAULT_GLASS_CONFIG
): void {
  const newPalette = getThemePalette(themeId, glassConfig);
  Object.assign(Colors, newPalette);
}

// Initial Avatar Deterministic Vibrant Colors
export const AVATAR_COLORS = [
  '#7C3AED',
  '#2563EB',
  '#0D9488',
  '#D97706',
  '#E11D48',
  '#059669',
  '#4F46E5',
  '#DB2777',
];

export function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}


