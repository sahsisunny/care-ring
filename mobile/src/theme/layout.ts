import { StyleSheet, Platform, StatusBar } from 'react-native';
import { ThemePalette } from './colors';

/**
 * CareRing Universal Design Architecture & Tokens
 * Single source of truth for spacing, paddings, margins, border radii, and typography metrics
 * ensuring visual consistency across all screens, subviews, cards, and modal components.
 */

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  card: 14,
  base: 16,
  screen: 18, // Standard page horizontal gutter
  headerHorizontal: 20,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const BorderRadius = {
  none: 0,
  xs: 6,
  sm: 8,
  pill: 10,
  badge: 12,
  tile: 14,
  button: 14,
  input: 14,
  card: 18,
  cardLarge: 20,
  modal: 24,
  sheet: 28,
  full: 9999,
} as const;

export const Layout = {
  // Screen and Container Margins & Paddings
  screenPadding: Spacing.screen, // 18px
  headerPaddingHorizontal: Spacing.headerHorizontal, // 20px
  headerPaddingBottom: 14,
  subViewPaddingVertical: Spacing.xs, // 4px
  scrollBottomPadding: 120, // Accommodates floating BottomNavBar

  // Card & Surface Metrics
  cardPadding: Spacing.card, // 14px
  cardGap: Spacing.md, // 12px
  cardBorderRadius: BorderRadius.card, // 18px
  cardLargeBorderRadius: BorderRadius.cardLarge, // 20px
  cardBorderWidth: 1,
  sheetBorderRadius: BorderRadius.sheet, // 28px

  // Component & Control Dimensions
  iconCircleSize: 36,
  iconCircleBorderRadius: 18,
  heroIconCircleSize: 56,
  heroIconCircleBorderRadius: 28,
  buttonHeight: 48,
  buttonBorderRadius: BorderRadius.button, // 14px
  buttonPaddingVertical: 13,
  inputHeight: 48,
  inputBorderRadius: BorderRadius.input, // 14px
  pillPaddingHorizontal: Spacing.md, // 12px
  pillPaddingVertical: 6,
  pillBorderRadius: BorderRadius.pill, // 10px
  badgeBorderRadius: BorderRadius.xs, // 6px
} as const;

export const Typography = {
  screenTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  subViewTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  subViewDesc: {
    fontSize: 13,
    marginTop: 3,
    marginBottom: 16,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
} as const;

/**
 * Calculates a uniform top header padding that accounts for native status bar & insets
 */
export function getHeaderPaddingTop(insetTop: number = 0): number {
  const statusBarHeight =
    Platform.OS === 'android'
      ? Math.max(insetTop, StatusBar.currentHeight || 36)
      : Math.max(insetTop, 44);
  return statusBarHeight + 12;
}

/**
 * Shared layout style helper across screens
 */
export function createSharedLayoutStyles(colors: ThemePalette, isDark: boolean) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: Layout.screenPadding,
    },
    subViewContainer: {
      paddingVertical: Layout.subViewPaddingVertical,
    },
    subViewTitle: {
      ...Typography.subViewTitle,
      color: colors.textMain,
    },
    subViewDesc: {
      ...Typography.subViewDesc,
      color: colors.textSecondary,
    },
    sectionHeader: {
      ...Typography.sectionHeader,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.tileBg,
      borderColor: colors.tileBorder,
      borderWidth: Layout.cardBorderWidth,
      borderRadius: Layout.cardBorderRadius,
      padding: Layout.cardPadding,
      marginBottom: Spacing.base,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: Layout.buttonBorderRadius,
      paddingVertical: Layout.buttonPaddingVertical,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      ...Typography.buttonText,
      color: '#FFFFFF',
    },
  });
}
