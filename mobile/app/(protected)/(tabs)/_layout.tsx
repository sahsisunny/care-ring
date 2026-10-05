import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useMapSession } from '../_layout';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { isTabBarHidden } = useMapSession();

  return (
    <NativeTabs
      hidden={isTabBarHidden}
      minimizeBehavior="onScrollDown"
      backgroundColor={colors.card}
      tintColor={colors.primary}
      iconColor={{
        default: colors.textSecondary,
        selected: colors.primary,
      }}
      indicatorColor={isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)'}
      rippleColor={isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)'}
      labelVisibilityMode="labeled"
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.primary },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Location</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="location.fill" md="location_on" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="driving">
        <NativeTabs.Trigger.Label>Driving</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="car.fill" md="directions_car" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="safety">
        <NativeTabs.Trigger.Label>Safety</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="shield.fill" md="security" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
