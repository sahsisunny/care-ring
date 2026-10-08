import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useMapSession } from '../_layout';
import { hapticService } from '../../../src/services/HapticService';

function UnifiedTabBar() {
  const { colors, isDark } = useTheme();
  const { isTabBarHidden, activeNavTab, triggerTabPress } = useMapSession();
  const insets = useSafeAreaInsets();

  if (isTabBarHidden) {
    return null;
  }

  const tabs: Array<{
    id: 'location' | 'driving' | 'safety' | 'settings';
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { id: 'location', label: 'Location', icon: 'location-sharp' },
    { id: 'driving', label: 'Driving', icon: 'car' },
    { id: 'safety', label: 'Safety', icon: 'shield-checkmark' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeNavTab === tab.id;
        const color = isActive
          ? colors.primary
          : isDark
          ? 'rgba(255, 255, 255, 0.45)'
          : colors.textMuted;

        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              hapticService.light();
              triggerTabPress(tab.id);
            }}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <Ionicons name={tab.icon} size={24} color={color} />
            <Text
              style={[
                styles.tabLabel,
                {
                  color,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <UnifiedTabBar />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Location',
        }}
      />
      <Tabs.Screen
        name="driving"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
