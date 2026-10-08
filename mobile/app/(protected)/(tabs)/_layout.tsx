import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useMapSession } from '../_layout';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { isTabBarHidden, triggerTabPress } = useMapSession();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? 'rgba(255, 255, 255, 0.45)' : colors.textMuted,
        tabBarStyle: {
          display: isTabBarHidden ? 'none' : 'flex',
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          borderTopWidth: 1,
          height: isTabBarHidden ? 0 : 60 + insets.bottom,
          paddingBottom: isTabBarHidden ? 0 : Math.max(insets.bottom, 8),
          paddingTop: 6,
          elevation: isTabBarHidden ? 0 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={{
          tabPress: () => {
            triggerTabPress('location');
          },
        }}
        options={{
          title: 'Location',
          tabBarIcon: ({ color, size }) => <Ionicons name="location-sharp" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="driving"
        listeners={{
          tabPress: () => {
            triggerTabPress('driving');
          },
        }}
        options={{
          title: 'Driving',
          tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="safety"
        listeners={{
          tabPress: () => {
            triggerTabPress('safety');
          },
        }}
        options={{
          title: 'Safety',
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        listeners={{
          tabPress: () => {
            triggerTabPress('settings');
          },
        }}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
