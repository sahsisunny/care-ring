import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getWebGlassCardStyle } from '../theme/colors';

export type BottomNavTab = 'location' | 'driving' | 'safety' | 'membership';

interface BottomNavBarProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);
  const { colors, isDark, isGlass } = useTheme();

  const tabs: Array<{
    id: BottomNavTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      id: 'location',
      label: 'Location',
      icon: 'location-outline',
      activeIcon: 'location',
    },
    {
      id: 'driving',
      label: 'Driving',
      icon: 'car-outline',
      activeIcon: 'car',
    },
    {
      id: 'safety',
      label: 'Safety',
      icon: 'shield-checkmark-outline',
      activeIcon: 'shield-checkmark',
    },
    {
      id: 'membership',
      label: 'Membership',
      icon: 'star-outline',
      activeIcon: 'star',
    },
  ];

  const webGlassBar = getWebGlassCardStyle(isDark, isGlass);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          height: 56 + bottomPadding,
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
        },
        isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
        webGlassBar,
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const iconName = isActive ? tab.activeIcon : tab.icon;
        const color = isActive ? colors.primary : colors.textMuted;

        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.75}
            onPress={() => onSelectTab(tab.id)}
            style={styles.tabButton}
          >
            <Ionicons name={iconName} size={22} color={color} />
            <Text style={[styles.tabLabel, { color, fontWeight: isActive ? '800' : '600' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1.5,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
  },
});
