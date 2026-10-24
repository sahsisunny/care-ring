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
  mapBearing?: number;
  onCheckInTapped?: () => void;
  onGhostModeTapped?: () => void;
  onToggleMapLayers?: () => void;
  onOpenMapStylePicker?: () => void;
  onGoToMyLocation?: () => void;
  onSOSTapped?: () => void;
  onRotateMap?: (bearing: number) => void;
  onResetBearing?: () => void;
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
  mapBearing = 0,
  onCheckInTapped,
  onGhostModeTapped,
  onToggleMapLayers,
  onOpenMapStylePicker,
  onGoToMyLocation,
  onSOSTapped,
  onRotateMap,
  onResetBearing,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  const COLLAPSED_HEIGHT = collapsedHeight;
  const COLLAPSED_TRANSLATE_Y = dynamicMaxExpandedHeight - COLLAPSED_HEIGHT;
  const MID_Y = midTranslateY ?? (dynamicMaxExpandedHeight - 310);
  const EXPANDED_Y = expandedTranslateY;
  const DRAWER_OFFSCREEN_Y = dynamicMaxExpandedHeight;
  const HIDDEN_Y = hiddenTranslateY ?? (dynamicMaxExpandedHeight + 40);

  const span = Math.max(2, MID_Y - EXPANDED_Y);
  const fadeStart = EXPANDED_Y + Math.min(70, span * 0.3);
  const fadeEnd = EXPANDED_Y + Math.min(140, span * 0.65);
  const scaleStart = EXPANDED_Y + Math.min(120, span * 0.55);

  const floatingActionsOpacity = translateY.interpolate({
    inputRange: [
      EXPANDED_Y,
      fadeStart,
      fadeEnd,
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
      scaleStart,
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

      {/* Right: Vertical Google Maps Style Stack */}
      <View style={styles.rightVerticalToolsGroup} pointerEvents="box-none">
        {/* 1. Map Layers / Style Picker (On top) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticService.light();
            onOpenMapStylePicker?.();
          }}
          style={[
            styles.circularMapCtrlBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
          accessibilityLabel="Change map style"
        >
          <Ionicons name="layers" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* 2. Compass / Rotate Map — shows bearing indicator, tap to reset north */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticService.light();
            if (Math.abs(mapBearing % 360) > 2) {
              onResetBearing?.();
            } else {
              onRotateMap?.(45);
            }
          }}
          onLongPress={() => {
            hapticService.medium();
            onRotateMap?.((mapBearing + 45) % 360);
          }}
          style={[
            styles.circularMapCtrlBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassPill,
          ]}
          accessibilityLabel="Rotate map / Reset to north"
        >
          <Ionicons
            name="navigate"
            size={20}
            color={Math.abs(mapBearing % 360) > 2 ? '#EF4444' : colors.primary}
          />
        </TouchableOpacity>

        {/* 3. Recenter GPS / Locate Me */}
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
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    borderRadius: 12,
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
    borderRadius: 12,
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
