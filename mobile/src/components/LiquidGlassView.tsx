import React, { ReactNode, useRef } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassView as NativeCallstackGlassView,
  LiquidGlassContainerView as NativeCallstackGlassContainerView,
  isLiquidGlassSupported as callstackNativeSupported,
} from '@callstack/liquid-glass';
import { useTheme } from '../theme/ThemeContext';

export const isLiquidGlassSupported =
  Platform.OS === 'ios' ? callstackNativeSupported : true;

export interface LiquidGlassViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  intensity?: number;
  elevated?: boolean;
  /**
   * Visual effect mode matching Callstack @callstack/liquid-glass:
   * 'clear'   — high-transparency glass (media overlays, photos, map callouts)
   * 'regular' — standard rich frosted liquid glass (Control Center cards, sheets)
   * 'none'    — flat opaque view with no glass effect (Normal theme)
   */
  effect?: 'clear' | 'regular' | 'none';
  /**
   * Backward-compatible alias for effect:
   */
  variant?: 'regular' | 'clear' | 'thick';
  /**
   * Touch interaction feedback (spring scale on press down, matching Apple Control Center)
   */
  interactive?: boolean;
  /**
   * Color scheme override: 'light' | 'dark' | 'system'
   */
  colorScheme?: 'light' | 'dark' | 'system';
  /**
   * Optional custom overlay tint color
   */
  tintColor?: string;
  /**
   * Press handler when interactive is enabled
   */
  onPress?: () => void;
}

export const LiquidGlassView: React.FC<LiquidGlassViewProps> = ({
  children,
  style,
  borderRadius = 22,
  intensity,
  elevated = true,
  effect = 'regular',
  variant,
  interactive = false,
  colorScheme = 'system',
  tintColor,
  onPress,
}) => {
  const { isGlass, isDark: themeIsDark, colors } = useTheme();

  // Determine effective theme mode
  const isDark =
    colorScheme === 'dark' ? true : colorScheme === 'light' ? false : themeIsDark;

  // Determine effective effect mode
  const effectiveEffect = effect === 'none' || !isGlass ? 'none' : variant || effect;

  // Touch spring animation for interactive glass
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!interactive) return;
    Animated.spring(scaleAnim, {
      toValue: 0.965,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  };

  const handlePressOut = () => {
    if (!interactive) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  };

  // ─── STANDARD FLAT / NONE MODE ───
  if (effectiveEffect === 'none') {
    const flatContent = (
      <View
        style={[
          styles.solidStandardCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderRadius,
          },
          elevated && styles.standardElevation,
          style,
        ]}
      >
        {children}
      </View>
    );

    if (interactive && onPress) {
      return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            {flatContent}
          </Pressable>
        </Animated.View>
      );
    }
    return flatContent;
  }

  // ─── NATIVE iOS 26 LIQUID GLASS BRIDGE (when running native binary) ───
  if (Platform.OS === 'ios' && callstackNativeSupported && isGlass) {
    return (
      <NativeCallstackGlassView
        effect={effectiveEffect === 'thick' ? 'regular' : effectiveEffect}
        interactive={interactive}
        colorScheme={colorScheme}
        tintColor={tintColor}
        style={[{ borderRadius }, style]}
      >
        {children}
      </NativeCallstackGlassView>
    );
  }

  // ─── APPLE LIQUID GLASS PHYSICS (macOS / iOS Control Center Spec for Web & Cross-Platform) ───
  const blurIntensity = intensity !== undefined ? intensity : colors.blurIntensity || 70;
  const isClear = effectiveEffect === 'clear';
  const isThick = effectiveEffect === 'thick';

  // Base smoked glass color and specular reflection
  const webSmokedGlassBg = isDark
    ? isClear
      ? 'rgba(20, 24, 36, 0.45)'
      : isThick
      ? 'rgba(20, 24, 36, 0.82)'
      : 'rgba(20, 24, 36, 0.68)'
    : isClear
    ? 'rgba(255, 255, 255, 0.35)'
    : isThick
    ? 'rgba(255, 255, 255, 0.65)'
    : 'rgba(255, 255, 255, 0.52)';

  const webBoxShadow = isDark
    ? `inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 16px 40px 0 rgba(0, 0, 0, 0.45)`
    : `inset 0 1.5px 1.2px 0 rgba(255, 255, 255, 0.95), inset 0 0 0 1px rgba(255, 255, 255, 0.50), 0 10px 32px 0 rgba(31, 38, 135, 0.12)`;

  const webBorderColor = isDark
    ? 'rgba(255, 255, 255, 0.18)'
    : 'rgba(255, 255, 255, 0.75)';

  const webGlassStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${blurIntensity * 0.38}px) saturate(210%)`,
          WebkitBackdropFilter: `blur(${blurIntensity * 0.38}px) saturate(210%)`,
          backgroundColor: webSmokedGlassBg,
          boxShadow: elevated ? webBoxShadow : 'none',
          borderColor: webBorderColor,
        } as any)
      : {};

  const glassContent = (
    <View
      style={[
        styles.glassContainer,
        {
          borderRadius,
          borderColor: colors.cardBorder,
          backgroundColor: Platform.OS === 'web' ? 'transparent' : colors.card,
        },
        elevated && (isDark ? styles.darkGlassElevation : styles.lightGlassElevation),
        isDark &&
          elevated && {
            shadowColor:
              colors.glassGlow !== 'transparent' ? colors.glassGlow : colors.primary,
          },
        webGlassStyle,
        style,
      ]}
    >
      {/* ── Native Blur Layer (iOS / Android) ── */}
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      )}

      {/* ── Scrim Translucency Layer (legibility backing) ── */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor: isDark
              ? `rgba(255, 255, 255, ${isClear ? 0.03 : isThick ? 0.12 : 0.06})`
              : `rgba(255, 255, 255, ${isClear ? 0.12 : isThick ? 0.35 : 0.22})`,
          },
        ]}
        pointerEvents="none"
      />

      {/* ── Custom Tint Overlay (if provided) ── */}
      {tintColor && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              backgroundColor: tintColor,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* ── Top Specular Reflection Highlight (iOS light reflection edge) ── */}
      <View
        style={[
          styles.specularTopEdge,
          {
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.25)'
              : 'rgba(255, 255, 255, 0.95)',
          },
        ]}
        pointerEvents="none"
      />

      {/* ── Bottom Depth Line ── */}
      <View
        style={[
          styles.specularBottomEdge,
          {
            borderBottomLeftRadius: borderRadius,
            borderBottomRightRadius: borderRadius,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.05)',
          },
        ]}
        pointerEvents="none"
      />

      {/* ── Crisp 1px Glass Edge Rim ── */}
      <View
        style={[
          styles.glassBorderLayer,
          {
            borderRadius,
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.16)'
              : 'rgba(255, 255, 255, 0.80)',
          },
        ]}
        pointerEvents="none"
      />

      {/* ── Content Viewport ── */}
      <View style={styles.contentLayer}>{children}</View>
    </View>
  );

  if (interactive) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
        >
          {glassContent}
        </Pressable>
      </Animated.View>
    );
  }

  return glassContent;
};

/**
 * LiquidGlassContainerView:
 * Groups and spaces multiple liquid glass cards/modules together
 * (matches Callstack @callstack/liquid-glass API)
 */
export const LiquidGlassContainerView: React.FC<{
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  spacing?: number;
}> = ({ children, style, spacing = 12 }) => {
  if (Platform.OS === 'ios' && callstackNativeSupported) {
    return (
      <NativeCallstackGlassContainerView spacing={spacing} style={style}>
        {children}
      </NativeCallstackGlassContainerView>
    );
  }
  return <View style={[{ gap: spacing }, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  solidStandardCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  standardElevation: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  glassContainer: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  specularTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    opacity: 1,
  },
  specularBottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
  glassBorderLayer: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
  },
  contentLayer: {
    flex: 1,
    position: 'relative',
  },
  lightGlassElevation: {
    shadowColor: '#0A0F2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  darkGlassElevation: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
});
