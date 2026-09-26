import { Platform } from 'react-native';
import { AppThemeId, LiquidGlassCustomConfig, DEFAULT_GLASS_CONFIG } from './ThemeService';

/**
 * Authentic Apple Liquid Glass Style Generators (VisionOS & iOS 26 Control Center)
 * Features dual-layer specular highlights:
 * - Bright top-edge light refraction line
 * - Surrounding crystalline translucent bevel rim
 * - Soft ambient glass shadow
 */
export function getWebGlassCardStyle(isDark: boolean, isGlass: boolean = true) {
  if (Platform.OS !== 'web' || !isGlass) return {};
  return {
    backdropFilter: 'blur(32px) saturate(210%)',
    WebkitBackdropFilter: 'blur(32px) saturate(210%)',
    boxShadow: isDark
      ? 'inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 16px 40px 0 rgba(0, 0, 0, 0.45)'
      : 'inset 0 1.5px 1.2px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.50), 0 10px 32px 0 rgba(31, 38, 135, 0.12)',
  };
}

export function getWebGlassTileStyle(isDark: boolean, isGlass: boolean = true) {
  if (Platform.OS !== 'web' || !isGlass) return {};
  return {
    backdropFilter: 'blur(20px) saturate(190%)',
    WebkitBackdropFilter: 'blur(20px) saturate(190%)',
    boxShadow: isDark
      ? 'inset 0 1px 0.8px 0 rgba(255, 255, 255, 0.20), inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 2px 8px 0 rgba(0, 0, 0, 0.25)'
      : 'inset 0 1.2px 1px 0 rgba(255, 255, 255, 0.85), inset 0 0 0 1px rgba(255, 255, 255, 0.40), 0 2px 8px 0 rgba(0, 0, 0, 0.04)',
  };
}

export function getWebGlassPillStyle(isDark: boolean, isGlass: boolean = true) {
  if (Platform.OS !== 'web' || !isGlass) return {};
  return {
    backdropFilter: 'blur(28px) saturate(210%)',
    WebkitBackdropFilter: 'blur(28px) saturate(210%)',
    boxShadow: isDark
      ? 'inset 0 1px 0.8px 0 rgba(255, 255, 255, 0.28), 0 6px 20px 0 rgba(0, 0, 0, 0.40)'
      : 'inset 0 1.2px 1px 0 rgba(255, 255, 255, 0.95), 0 4px 16px 0 rgba(31, 38, 135, 0.10)',
  };
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

  // Neutrals, Surfaces, Glass
  background: string;
  canvas: string;
  card: string;
  cardBorder: string;
  cardInnerBorder: string;
  textMain: string;
  textSecondary: string;
  textMuted: string;
  divider: string;

  // Core Glass tokens
  glassSurface: string;       // main glass surface fill
  glassWhite: string;         // white tint layer
  glassDark: string;          // dark tint layer
  glassBorder: string;        // outer border
  glassGlow: string;          // ambient glow shadow color
  overlay: string;            // modal backdrop
  blurTint: 'light' | 'dark' | 'default' | 'prominent';
  blurIntensity: number;

  // Liquid Glass Physical Rendering tokens (iOS 26 accurate)
  glassSpecularTop: string;    // top-edge specular highlight (bright refraction line)
  glassSpecularBottom: string; // bottom-edge counter-highlight (depth shadow)
  glassRefractionTint: string; // subtle chromatic micro-tint (lens color)
  glassScrimBg: string;        // backed translucency scrim (ensures text legibility)
  glassShimmer: string;        // shimmer/gleam highlight on surface

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

function getTintAccent(tint: string, isDark: boolean): { accent: string; glow: string; soft: string; refractionTint: string } {
  switch (tint) {
    case 'cyan':
      return {
        accent: '#00D2FE',
        glow: isDark ? 'rgba(0, 210, 254, 0.4)' : 'rgba(0, 210, 254, 0.2)',
        soft: isDark ? 'rgba(0, 210, 254, 0.18)' : 'rgba(0, 210, 254, 0.1)',
        refractionTint: isDark ? 'rgba(0, 210, 254, 0.06)' : 'rgba(0, 210, 254, 0.04)',
      };
    case 'violet':
      return {
        accent: isDark ? '#A78BFA' : '#7C3AED',
        glow: isDark ? 'rgba(167, 139, 250, 0.4)' : 'rgba(139, 92, 246, 0.2)',
        soft: isDark ? 'rgba(139, 92, 246, 0.18)' : 'rgba(139, 92, 246, 0.1)',
        refractionTint: isDark ? 'rgba(139, 92, 246, 0.06)' : 'rgba(139, 92, 246, 0.03)',
      };
    case 'amber':
      return {
        accent: '#F59E0B',
        glow: isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.2)',
        soft: isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.1)',
        refractionTint: isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.03)',
      };
    case 'emerald':
      return {
        accent: '#10B981',
        glow: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.2)',
        soft: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.1)',
        refractionTint: isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.03)',
      };
    case 'default':
    default:
      return {
        accent: isDark ? '#818CF8' : '#4F46E5',
        glow: isDark ? 'rgba(99, 102, 241, 0.45)' : 'rgba(79, 70, 229, 0.15)',
        soft: isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(238, 242, 255, 0.8)',
        refractionTint: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(79, 70, 229, 0.03)',
      };
  }
}

export function getThemePalette(
  themeId: AppThemeId,
  glassConfig: LiquidGlassCustomConfig = DEFAULT_GLASS_CONFIG
): ThemePalette {
  // ─────────────────────────────────────────────────
  // STANDARD THEME — flat opaque, no glass, no blur
  // ─────────────────────────────────────────────────
  if (themeId === 'standard') {
    return {
      ...BASE_PALETTE,
      background: '#F4F5F7',
      canvas: '#F8FAFC',
      card: '#FFFFFF',
      cardBorder: '#E2E8F0',
      cardInnerBorder: '#CBD5E1',
      tileBg: '#F8FAFC',
      tileBorder: '#E2E8F0',
      tileBgElevated: '#FFFFFF',
      tileActiveBorder: '#4F46E5',
      modalCardBg: '#FFFFFF',
      textMain: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      divider: '#E2E8F0',

      glassSurface: '#FFFFFF',
      glassWhite: '#FFFFFF',
      glassDark: '#0F172A',
      glassBorder: '#E2E8F0',
      glassGlow: 'transparent',
      overlay: 'rgba(15, 23, 42, 0.5)',
      blurTint: 'default',
      blurIntensity: 0,

      // Standard has no liquid glass physics
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

  const isDark = themeId === 'dark-glass';

  // ──────────────────────────────────────────────────────────────────────
  // AUTHENTIC APPLE LIQUID GLASS PHYSICS
  // ──────────────────────────────────────────────────────────────────────

  const blurIntensity = glassConfig.blurIntensity || (isDark ? 70 : 60);
  const { accent, glow, soft, refractionTint } = getTintAccent(glassConfig.tintColor || 'default', isDark);

  const scrimAlpha = Math.max(0.08, Math.min(0.28, (glassConfig.opacityPercent || 78) / 100 * 0.28));

  let outerBorder: string;
  let specularTop: string;
  let specularBottom: string;

  if (isDark) {
    if (glassConfig.borderGlow === 'neon') {
      outerBorder = `${accent}88`;
      specularTop = `rgba(255, 255, 255, 0.32)`;
      specularBottom = `rgba(0, 0, 0, 0.45)`;
    } else if (glassConfig.borderGlow === 'subtle') {
      outerBorder = 'rgba(255, 255, 255, 0.12)';
      specularTop = 'rgba(255, 255, 255, 0.18)';
      specularBottom = 'rgba(0, 0, 0, 0.3)';
    } else {
      outerBorder = 'rgba(255, 255, 255, 0.22)';
      specularTop = 'rgba(255, 255, 255, 0.28)';
      specularBottom = 'rgba(0, 0, 0, 0.38)';
    }
  } else {
    if (glassConfig.borderGlow === 'neon') {
      outerBorder = 'rgba(255, 255, 255, 1)';
      specularTop = 'rgba(255, 255, 255, 1)';
      specularBottom = 'rgba(0, 0, 0, 0.08)';
    } else if (glassConfig.borderGlow === 'subtle') {
      outerBorder = 'rgba(255, 255, 255, 0.6)';
      specularTop = 'rgba(255, 255, 255, 0.7)';
      specularBottom = 'rgba(0, 0, 0, 0.04)';
    } else {
      outerBorder = 'rgba(255, 255, 255, 0.88)';
      specularTop = 'rgba(255, 255, 255, 0.95)';
      specularBottom = 'rgba(0, 0, 0, 0.06)';
    }
  }

  // ─── DARK MODE LIQUID GLASS ───
  if (isDark) {
    const glassBase = `rgba(20, 24, 36, 0.68)`;
    const glassSurf = `rgba(26, 32, 48, 0.55)`;

    return {
      ...BASE_PALETTE,
      primary: accent,
      primaryDark: '#4F46E5',
      primaryLight: soft,
      primarySoft: soft,
      primaryBorder: outerBorder,

      // Canvas
      background: '#070B14',
      canvas: '#050810',

      // Glass Card (matches macOS/iOS Control Center dark smoked glass)
      card: 'rgba(20, 24, 36, 0.68)',
      cardBorder: outerBorder,
      cardInnerBorder: specularTop,

      // Tiles within screens / cards (matches Apple inner glass tiles)
      tileBg: 'rgba(255, 255, 255, 0.08)',
      tileBorder: 'rgba(255, 255, 255, 0.12)',
      tileBgElevated: 'rgba(255, 255, 255, 0.14)',
      tileActiveBorder: accent,
      modalCardBg: 'rgba(20, 24, 36, 0.78)',

      textMain: '#FFFFFF',
      textSecondary: 'rgba(255, 255, 255, 0.72)',
      textMuted: 'rgba(255, 255, 255, 0.48)',
      divider: 'rgba(255, 255, 255, 0.10)',

      // Glass physics layers
      glassSurface: glassSurf,
      glassWhite: 'rgba(255, 255, 255, 0.10)',
      glassDark: 'rgba(5, 8, 20, 0.88)',
      glassBorder: outerBorder,
      glassGlow: glow,
      overlay: 'rgba(0, 0, 0, 0.45)',
      blurTint: 'dark',
      blurIntensity,

      // Authentic specular physics tokens
      glassSpecularTop: specularTop,
      glassSpecularBottom: specularBottom,
      glassRefractionTint: refractionTint,
      glassScrimBg: glassBase,
      glassShimmer: 'rgba(255, 255, 255, 0.05)',

      inputBg: 'rgba(255, 255, 255, 0.08)',
      inputBorder: 'rgba(255, 255, 255, 0.14)',
      iconBg: 'rgba(255, 255, 255, 0.12)',
      statusBar: 'light',
    };
  }

  // ─── LIGHT MODE LIQUID GLASS ───
  // Authentic Apple iOS 26 Liquid Glass: crystal clear frosted glass (45-52% white)
  // Reveals the map and lively background with rich saturation and specular bevel rim
  const glassBase = `rgba(255, 255, 255, 0.52)`;
  const glassSurf = `rgba(255, 255, 255, 0.35)`;

  return {
    ...BASE_PALETTE,
    primary: accent,
    primaryLight: soft,
    primaryBorder: outerBorder,

    // Canvas
    background: '#DCE4F0',
    canvas: '#D0DBEA',

    // Glass Card (translucent crystal frosted glass)
    card: 'rgba(255, 255, 255, 0.52)',
    cardBorder: outerBorder,
    cardInnerBorder: specularTop,

    // Tiles within screens / cards (translucent inner liquid glass tiles)
    tileBg: 'rgba(255, 255, 255, 0.42)',
    tileBorder: 'rgba(255, 255, 255, 0.65)',
    tileBgElevated: 'rgba(255, 255, 255, 0.65)',
    tileActiveBorder: accent,
    modalCardBg: 'rgba(255, 255, 255, 0.60)',

    textMain: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    divider: 'rgba(255, 255, 255, 0.35)',

    glassSurface: glassSurf,
    glassWhite: 'rgba(255, 255, 255, 0.88)',
    glassDark: 'rgba(10, 15, 30, 0.78)',
    glassBorder: outerBorder,
    glassGlow: glow,
    overlay: 'rgba(15, 23, 42, 0.25)',
    blurTint: 'light',
    blurIntensity,

    // Authentic specular physics tokens
    glassSpecularTop: specularTop,
    glassSpecularBottom: specularBottom,
    glassRefractionTint: refractionTint,
    glassScrimBg: glassBase,
    glassShimmer: 'rgba(255, 255, 255, 0.22)',

    inputBg: 'rgba(255, 255, 255, 0.50)',
    inputBorder: 'rgba(255, 255, 255, 0.70)',
    iconBg: 'rgba(255, 255, 255, 0.60)',
    statusBar: 'dark',
  };
}

// Mutable Colors object for backward compatibility
export const Colors: ThemePalette = {
  ...getThemePalette('light-glass', DEFAULT_GLASS_CONFIG),
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


