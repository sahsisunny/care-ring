import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Circle } from '../models/Circle';
import { useTheme } from '../theme/ThemeContext';
import { getWebGlassPillStyle } from '../theme/colors';

interface TopFloatingHeaderProps {
  selectedCircle: Circle | null;
  unreadAlertCount?: number;
  onCirclePress: () => void;
  onChatTapped: () => void;
  onAlertsTapped: () => void;
  onSettingsTapped: () => void;
}

export const TopFloatingHeader: React.FC<TopFloatingHeaderProps> = ({
  selectedCircle,
  unreadAlertCount = 0,
  onCirclePress,
  onChatTapped,
  onAlertsTapped,
  onSettingsTapped,
}) => {
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 28) + 8;
  const { colors, isDark, isGlass } = useTheme();

  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  const dynamicCardStyle = [
    {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
    },
    webGlassPill,
  ];

  const dynamicElevation = isGlass
    ? isDark
      ? styles.darkGlassShadow
      : styles.lightGlassShadow
    : styles.standardShadow;

  return (
    <View style={[styles.topContainer, { top: topOffset }]} pointerEvents="box-none">
      {/* 1. Left: Circular Settings Gear Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onSettingsTapped}
        style={[styles.circleIconButton, dynamicCardStyle, dynamicElevation]}
      >
        <Ionicons name="settings-sharp" size={20} color={colors.primary} />
      </TouchableOpacity>

      {/* 2. Center: Circle Selector Dropdown Pill (e.g. "Family ▾") */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onCirclePress}
        style={[styles.circleSelectorPill, dynamicCardStyle, dynamicElevation]}
      >
        <Text style={[styles.circleNameText, { color: colors.textMain }]} numberOfLines={1}>
          {selectedCircle ? selectedCircle.name : 'Select Circle'}
        </Text>
        <Ionicons name="chevron-down" size={17} color={colors.primary} />
      </TouchableOpacity>

      {/* 3. Right: Action Buttons (Inbox Mail with Badge + Chat Bubble) */}
      <View style={styles.rightActionsRow} pointerEvents="box-none">
        {/* Inbox / Alert Center Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onAlertsTapped}
          style={[styles.circleIconButton, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="mail" size={20} color={colors.primary} />
          {unreadAlertCount > 0 && (
            <View style={[styles.badgePill, { borderColor: colors.card }]}>
              <Text style={styles.badgeText}>{unreadAlertCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Group Chat Bubble Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onChatTapped}
          style={[styles.circleIconButton, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 38,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  circleSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    maxWidth: '52%',
  },
  circleNameText: {
    fontSize: 15,
    fontWeight: '800',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF4B4B',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  standardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
});
