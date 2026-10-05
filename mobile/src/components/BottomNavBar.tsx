import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';

export type BottomNavTab = 'location' | 'driving' | 'safety' | 'settings';

interface BottomNavBarProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPosition = Math.max(insets.bottom, 12);
  const { colors, isDark } = useTheme();

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
      id: 'settings',
      label: 'Settings',
      icon: 'settings-outline',
      activeIcon: 'settings',
    },
  ];

  const catchLightBorder = isDark
    ? 'rgba(255, 255, 255, 0.18)'
    : 'rgba(255, 255, 255, 0.80)';

  const tintOverlay = isDark
    ? 'rgba(15, 23, 42, 0.58)'
    : 'rgba(255, 255, 255, 0.65)';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        {
          bottom: bottomPosition,
        },
      ]}
    >
      <View style={[styles.outerShadow, isDark ? styles.darkShadow : styles.lightShadow]}>
        <View style={[styles.glassDock, { borderColor: catchLightBorder }]}>
          {/* Native Hardware-Accelerated Blur */}
          <BlurView
            intensity={85}
            tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            {...(Platform.OS === 'ios' ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const } : {})}
            style={StyleSheet.absoluteFill}
          />

          {/* Translucent warmth tint layer */}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: tintOverlay }]}
            pointerEvents="none"
          />

          {/* Tab buttons */}
          <View style={styles.tabsRow}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const iconName = isActive ? tab.activeIcon : tab.icon;
              const color = isActive ? colors.primary : colors.textMuted;

              return (
                <TouchableOpacity
                  key={tab.id}
                  activeOpacity={0.78}
                  onPress={() => onSelectTab(tab.id)}
                  style={styles.tabButton}
                >
                  <View
                    style={[
                      styles.tabPill,
                      isActive && {
                        backgroundColor: isDark
                          ? 'rgba(99, 102, 241, 0.22)'
                          : 'rgba(99, 102, 241, 0.12)',
                        borderColor: isDark
                          ? 'rgba(99, 102, 241, 0.35)'
                          : 'rgba(99, 102, 241, 0.22)',
                      },
                    ]}
                  >
                    <Ionicons name={iconName} size={21} color={color} />
                    <Text
                      style={[
                        styles.tabLabel,
                        {
                          color,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  outerShadow: {
    borderRadius: 32,
    backgroundColor: 'transparent',
  },
  lightShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  darkShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  glassDock: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        } as any)
      : null),
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 3,
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: -0.1,
  },
});
