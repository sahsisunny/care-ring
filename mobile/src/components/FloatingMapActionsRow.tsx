import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getWebGlassPillStyle } from '../theme/colors';

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
          bottom: COLLAPSED_HEIGHT + 14,
          opacity: floatingActionsOpacity,
          transform: [
            { translateY: floatingActionsTranslateY },
            { scale: floatingActionsScale },
          ],
        },
      ]}
      pointerEvents={isExpanded ? 'none' : 'box-none'}
    >
      {/* Left Group: Primary Action Pills */}
      <View style={styles.leftActionPillsGroup}>
        {/* 1. "I'm Here" (Check in) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCheckInTapped}
          style={[
            styles.mapActionPill,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
        >
          <Ionicons name="location-sharp" size={15} color={colors.primary} />
          <Text style={[styles.mapActionPillText, { color: colors.textMain }]}>I'm Here</Text>
        </TouchableOpacity>

        {/* 2. "Ghost Mode" (Privacy Bubble) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onGhostModeTapped}
          style={[
            styles.mapActionPill,
            isSelfInBubble
              ? {
                  backgroundColor: isDark ? 'rgba(139, 92, 246, 0.25)' : '#EDE9FE',
                  borderColor: isDark ? '#A78BFA' : '#8B5CF6',
                }
              : { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
        >
          <Ionicons
            name={isSelfInBubble ? 'eye-off' : 'eye-off-outline'}
            size={15}
            color={isDark ? '#C4B5FD' : '#7C3AED'}
          />
          <Text
            style={[
              styles.mapActionPillText,
              { color: isSelfInBubble ? (isDark ? '#C4B5FD' : '#6D28D9') : colors.textMain },
            ]}
          >
            {isSelfInBubble ? 'Ghosting' : 'Ghost Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Right Group: Map Tools & Help Icon */}
      <View style={styles.rightActionToolsGroup}>
        {/* Map Layers */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onToggleMapLayers}
          style={[
            styles.circularMapCtrlBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
          accessibilityLabel="Change map layers"
        >
          <Ionicons name="layers" size={17} color={colors.primary} />
        </TouchableOpacity>

        {/* Recenter GPS */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onGoToMyLocation}
          style={[
            styles.circularMapCtrlBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
          accessibilityLabel="Locate my position on map"
        >
          <MaterialIcons name="my-location" size={18} color={colors.primary} />
        </TouchableOpacity>

        {/* Help (Icon-Only Emergency Button) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSOSTapped}
          style={[
            styles.circularMapCtrlBtn,
            styles.helpCircleBtn,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.55)' : '#FCA5A5',
            },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
          accessibilityLabel="Emergency Help"
        >
          <Ionicons name="alert-circle" size={21} color={colors.sos} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  floatingMapActionsRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 125,
  },
  leftActionPillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  mapActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mapActionPillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  rightActionToolsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circularMapCtrlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    borderWidth: 1.5,
  },
  helpCircleBtn: {
    borderWidth: 1.5,
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
