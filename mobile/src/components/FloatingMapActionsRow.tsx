import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getWebGlassPillStyle } from '../theme/colors';
import { hapticService } from '../services/HapticService';

export interface FloatingMapActionsRowProps {
  translateY: Animated.Value;
  dynamicMaxExpandedHeight: number;
  collapsedHeight?: number;
  midTranslateY?: number;
  expandedTranslateY?: number;
  hiddenTranslateY?: number;
  isExpanded?: boolean;
  isSelfInBubble?: boolean;
  onCheckInTapped?: () => void;
  onGhostModeTapped?: () => void;
  onToggleMapLayers?: () => void;
  onGoToMyLocation?: () => void;
  onSOSTapped?: () => void;
}

export const FloatingMapActionsRow: React.FC<FloatingMapActionsRowProps> = React.memo(({
  translateY,
  dynamicMaxExpandedHeight,
  collapsedHeight = 90,
  midTranslateY,
  expandedTranslateY = 0,
  hiddenTranslateY,
  isExpanded = false,
  isSelfInBubble = false,
  onCheckInTapped,
  onGhostModeTapped,
  onToggleMapLayers,
  onGoToMyLocation,
  onSOSTapped,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  const COLLAPSED_HEIGHT = collapsedHeight;
  const COLLAPSED_TRANSLATE_Y = dynamicMaxExpandedHeight - COLLAPSED_HEIGHT;
  const MID_Y = midTranslateY ?? (dynamicMaxExpandedHeight - 310);
  const EXPANDED_Y = expandedTranslateY;
  const DRAWER_OFFSCREEN_Y = dynamicMaxExpandedHeight;
  const HIDDEN_Y = hiddenTranslateY ?? (dynamicMaxExpandedHeight + 40);

  const floatingActionsOpacity = translateY.interpolate({
    inputRange: [
      EXPANDED_Y,
      EXPANDED_Y + 70,
      EXPANDED_Y + 140,
      MID_Y,
      COLLAPSED_TRANSLATE_Y,
      HIDDEN_Y,
    ],
    outputRange: [0, 0.35, 1, 1, 1, 1],
    extrapolate: 'clamp',
  });

  const floatingActionsScale = translateY.interpolate({
    inputRange: [
      EXPANDED_Y,
      EXPANDED_Y + 120,
      COLLAPSED_TRANSLATE_Y,
      HIDDEN_Y,
    ],
    outputRange: [0.85, 1, 1, 1],
    extrapolate: 'clamp',
  });

  const floatingActionsTranslateY = translateY.interpolate({
    inputRange: [
      EXPANDED_Y,
      MID_Y,
      COLLAPSED_TRANSLATE_Y,
      DRAWER_OFFSCREEN_Y,
      HIDDEN_Y,
    ],
    outputRange: [
      -(COLLAPSED_TRANSLATE_Y - EXPANDED_Y),
      -(COLLAPSED_TRANSLATE_Y - MID_Y),
      0,
      COLLAPSED_HEIGHT,
      COLLAPSED_HEIGHT,
    ],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.floatingMapActionsRow,
        {
          bottom: COLLAPSED_HEIGHT + 16,
          opacity: floatingActionsOpacity,
          transform: [
            { translateY: floatingActionsTranslateY },
            { scale: floatingActionsScale },
          ],
        },
      ]}
      pointerEvents={isExpanded ? 'none' : 'box-none'}
    >
      {/* Left: SOS Emergency Button with "Help" text */}
      <View style={styles.leftActionGroup} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticService.heavy();
            onSOSTapped?.();
          }}
          style={[
            styles.helpPillBtn,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.95)' : '#EF4444',
              borderColor: isDark ? '#F87171' : '#DC2626',
            },
            styles.helpPillShadow,
          ]}
          accessibilityLabel="Emergency Help"
        >
          <Ionicons name="alert-circle" size={19} color="#FFFFFF" />
          <Text style={styles.helpPillText}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* Right: Vertical Google Maps Style Stack (Layers on top, Locate Me below) */}
      <View style={styles.rightVerticalToolsGroup} pointerEvents="box-none">
        {/* 1. Map Layers */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticService.light();
            onToggleMapLayers?.();
          }}
          style={[
            styles.circularMapCtrlBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
          accessibilityLabel="Change map layers"
        >
          <Ionicons name="layers" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* 2. Recenter GPS / Locate Me */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticService.light();
            onGoToMyLocation?.();
          }}
          style={[
            styles.circularMapCtrlBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
          accessibilityLabel="Locate my position on map"
        >
          <MaterialIcons name="my-location" size={21} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  floatingMapActionsRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 125,
  },
  leftActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  helpPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  helpPillShadow: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 7,
  },
  rightVerticalToolsGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  circularMapCtrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
