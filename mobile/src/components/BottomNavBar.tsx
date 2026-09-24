import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export type BottomNavTab = 'location' | 'driving' | 'safety' | 'membership';

interface BottomNavBarProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
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

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const iconName = isActive ? tab.activeIcon : tab.icon;
        const color = isActive ? Colors.primary : '#94A3B8';

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
    height: Platform.OS === 'ios' ? 76 : 64,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
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
