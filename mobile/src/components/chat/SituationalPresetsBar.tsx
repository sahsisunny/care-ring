import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import {
  QuickPreset,
  PresetCategory,
  PRESET_CATEGORY_TABS,
  UserSituationalContext,
  getSmartSituationalPresets,
} from '../../models/Chat';
import { useTheme } from '../../theme/ThemeContext';
import { Colors } from '../../theme/colors';

interface SituationalPresetsBarProps {
  onSelectPreset: (preset: QuickPreset) => void;
  speed?: number;
  movementState?: 'stationary' | 'walking' | 'driving';
}

export const SituationalPresetsBar: React.FC<SituationalPresetsBarProps> = ({
  onSelectPreset,
  speed = 0,
  movementState = 'stationary',
}) => {
  const { colors, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory>('all');
  const [batteryInfo, setBatteryInfo] = useState<{ level?: number; isCharging?: boolean }>({});

  // 1. Subscribe to real-time hardware battery updates
  useEffect(() => {
    let isMounted = true;
    const initBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const state = await Battery.getBatteryStateAsync();
        if (isMounted) {
          setBatteryInfo({
            level: level >= 0 ? Math.round(level * 100) : undefined,
            isCharging:
              state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
          });
        }
      } catch {
        // Fallback silently if sensor unavailable (e.g. web/simulator)
      }
    };

    initBattery();

    let subLevel: any;
    try {
      subLevel = Battery.addBatteryLevelListener((res) => {
        if (isMounted) {
          setBatteryInfo((prev) => ({
            ...prev,
            level: Math.round(res.batteryLevel * 100),
          }));
        }
      });
    } catch {}

    let subState: any;
    try {
      subState = Battery.addBatteryStateListener((res) => {
        if (isMounted) {
          setBatteryInfo((prev) => ({
            ...prev,
            isCharging:
              res.batteryState === Battery.BatteryState.CHARGING ||
              res.batteryState === Battery.BatteryState.FULL,
          }));
        }
      });
    } catch {}

    return () => {
      isMounted = false;
      subLevel?.remove?.();
      subState?.remove?.();
    };
  }, []);

  // 2. Build contextual telemetry snapshot
  const userContext: UserSituationalContext = useMemo(
    () => ({
      batteryLevel: batteryInfo.level,
      isCharging: batteryInfo.isCharging,
      speed,
      movementState,
      currentHour: new Date().getHours(),
    }),
    [batteryInfo, speed, movementState]
  );

  // 3. Derive smart situation recommendations
  const { presets, activeSituationTag, recommendedCategory } = useMemo(
    () => getSmartSituationalPresets(userContext, selectedCategory),
    [userContext, selectedCategory]
  );

  // Auto-switch category if user hasn't explicitly picked one and strong situation occurs
  useEffect(() => {
    if (selectedCategory === 'all' && recommendedCategory !== 'all') {
      // Keep 'all' as default view so user isn't constrained, but sorted to top!
    }
  }, [recommendedCategory]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
      {/* Top Filter Category & Situation Badge Bar */}
      <View style={styles.topBarRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {/* Active Detected Situation Chip (Highlighting Real-Time Condition) */}
          {activeSituationTag && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedCategory(recommendedCategory)}
              style={[
                styles.situationBadge,
                selectedCategory === recommendedCategory && styles.situationBadgeActive,
              ]}
            >
              <View style={styles.pulseDot} />
              <Text style={styles.situationBadgeText}>{activeSituationTag}</Text>
            </TouchableOpacity>
          )}

          {PRESET_CATEGORY_TABS.map((tab) => {
            const isSelected = selectedCategory === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(tab.id)}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor: isSelected
                      ? Colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9',
                    borderColor: isSelected ? Colors.primary : colors.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={12}
                  color={isSelected ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Preset Action Chips List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsList}
      >
        {presets.map((preset) => {
          const isSituationalMatch =
            activeSituationTag &&
            preset.situationTag &&
            activeSituationTag.toLowerCase().includes(preset.situationTag.toLowerCase());

          return (
            <TouchableOpacity
              key={preset.id}
              style={[
                styles.presetChip,
                {
                  backgroundColor: isSituationalMatch
                    ? isDark
                      ? 'rgba(13, 148, 136, 0.22)'
                      : '#F0FDFA'
                    : isDark
                    ? 'rgba(30, 41, 59, 0.7)'
                    : '#FFFFFF',
                  borderColor: isSituationalMatch ? '#0D9488' : colors.cardBorder,
                },
              ]}
              activeOpacity={0.75}
              onPress={() => onSelectPreset(preset)}
            >
              <Text style={[styles.presetChipText, { color: colors.textMain }]}>
                {preset.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: 7,
  },
  topBarRow: {
    marginBottom: 6,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  situationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  situationBadgeActive: {
    backgroundColor: '#FDE68A',
    borderColor: '#F59E0B',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  situationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.2,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 10,
    fontWeight: '700',
  },
  presetsList: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
