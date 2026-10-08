import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useMapSession } from '../_layout';

function WebUnifiedTabBar() {
  const { colors, isDark } = useTheme();
  const { isTabBarHidden, activeNavTab, triggerTabPress } = useMapSession();

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
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeNavTab === tab.id;
        const color = isActive ? colors.primary : colors.textMuted;

        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => triggerTabPress(tab.id)}
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

export default function WebTabsLayout() {
  return (
    <Tabs
      tabBar={() => <WebUnifiedTabBar />}
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
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
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
