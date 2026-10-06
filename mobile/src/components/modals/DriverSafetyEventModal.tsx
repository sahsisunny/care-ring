import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { formatEventDateTime } from '../../utils/dateUtils';

export type DriverSafetyEventType = 'speeding' | 'distracted' | 'rapidAccel' | 'hardBraking';

export interface DriverSafetyEventModalProps {
  visible: boolean;
  onClose: () => void;
  initialEventType?: DriverSafetyEventType;
  driverReport?: any;
  speedingData?: any;
  distractedData?: any;
  rapidAccelData?: any;
  hardBrakingData?: any;
  memberName?: string;
  onViewLog?: () => void;
}

export const DriverSafetyEventModal: React.FC<DriverSafetyEventModalProps> = ({
  visible,
  onClose,
  initialEventType = 'speeding',
  driverReport,
  speedingData,
  distractedData,
  rapidAccelData,
  hardBrakingData,
  memberName = 'Driver',
  onViewLog,
}) => {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<DriverSafetyEventType>(initialEventType);

  useEffect(() => {
    if (visible && initialEventType) {
      setActiveTab(initialEventType);
    }
  }, [visible, initialEventType]);

  // Extract real data from driverReport or direct props
  const speeding = speedingData || driverReport?.speeding;
  const distracted = distractedData || driverReport?.distracted;
  const rapidAccel = rapidAccelData || driverReport?.rapidAccel;
  const hardBraking = hardBrakingData || driverReport?.hardBraking;

  const speedingEvents = speeding?.events || [];
  const distractedEvents = distracted?.events || [];
  const rapidAccelEvents = rapidAccel?.events || [];
  const hardBrakingEvents = hardBraking?.events || [];

  const speedingCount = speeding?.count ?? speedingEvents.length;
  const distractedCount = distracted?.count ?? distractedEvents.length;
  const rapidAccelCount = rapidAccel?.count ?? rapidAccelEvents.length;
  const hardBrakingCount = hardBraking?.count ?? hardBrakingEvents.length;
  const topSpeed = speeding?.topSpeed ?? driverReport?.topSpeedKm ?? 0;

  const tabs: { key: DriverSafetyEventType; label: string; count: number; icon: any; iconType: 'ion' | 'feather' | 'material' }[] = [
    { key: 'speeding', label: 'Speeding', count: speedingCount, icon: 'speedometer-outline', iconType: 'ion' },
    { key: 'distracted', label: 'Distracted', count: distractedCount, icon: 'smartphone', iconType: 'feather' },
    { key: 'rapidAccel', label: 'Rapid Accel', count: rapidAccelCount, icon: 'flash-outline', iconType: 'ion' },
    { key: 'hardBraking', label: 'Hard Braking', count: hardBrakingCount, icon: 'car-crash', iconType: 'material' },
  ];

  const renderIcon = (tab: typeof tabs[0], size: number, color: string) => {
    if (tab.iconType === 'feather') return <Feather name={tab.icon} size={size} color={color} />;
    if (tab.iconType === 'material') return <MaterialIcons name={tab.icon} size={size} color={color} />;
    return <Ionicons name={tab.icon} size={size} color={color} />;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.textMain }]}>Driver Safety Event Log</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {memberName} • Verified GPS Event Telemetry
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* 4 Events Segmented Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.8}
                  style={[
                    styles.tabItem,
                    isActive && [
                      styles.tabItemActive,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      },
                    ],
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {renderIcon(tab, 14, isActive ? colors.primary : colors.textMuted)}
                    <Text
                      style={[
                        styles.tabText,
                        { color: isActive ? colors.textMain : colors.textMuted },
                        isActive && { fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: isActive
                          ? tab.count > 0 ? (tab.key === 'speeding' ? '#FEE2E2' : '#FEF3C7') : '#ECFDF5'
                          : isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        {
                          color: isActive
                            ? tab.count > 0 ? (tab.key === 'speeding' ? '#DC2626' : '#D97706') : '#059669'
                            : colors.textMuted,
                        },
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* SPEEDING TAB */}
            {activeTab === 'speeding' && (
              <>
                <View style={[styles.summaryCard, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FFF1F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECDD3' }]}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="speedometer" size={28} color="#FF6B6B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryTitle, { color: isDark ? '#FDA4AF' : '#9F1239' }]}>
                      Speeding Log • {speedingCount} Incidents
                    </Text>
                    <Text style={[styles.summaryDesc, { color: isDark ? '#F43F5E' : '#881337' }]}>
                      {topSpeed > 0 ? `Max recorded speed: ${topSpeed} km/h. ` : ''}
                      Monitored against road speed limit regulations in real time.
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Recorded Speeding Incidents ({speedingEvents.length})</Text>

                {speedingEvents.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                    <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                    <Text style={[styles.emptyTitle, { color: colors.textMain }]}>Zero Speeding Incidents</Text>
                    <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                      Speed limit respected consistently across all trips this week.
                    </Text>
                  </View>
                ) : (
                  speedingEvents.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.eventCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                      <View style={styles.eventTop}>
                        <View style={styles.speedPill}>
                          <Text style={styles.speedPillText}>{ev.speed} km/h</Text>
                        </View>
                        <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                          Limit: {ev.speedLimit || 50} km/h
                        </Text>
                        <View style={styles.excessBadge}>
                          <Text style={styles.excessBadgeText}>+{ev.excessSpeed || Math.max(0, ev.speed - (ev.speedLimit || 50))} km/h</Text>
                        </View>
                      </View>

                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={13} color={colors.textMuted} />
                        <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {ev.address || 'Street / Highway'}
                        </Text>
                      </View>

                      <View style={styles.eventFooter}>
                        <Text style={[styles.timeText, { color: colors.textMuted }]}>
                          {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {/* DISTRACTED DRIVING TAB */}
            {activeTab === 'distracted' && (
              <>
                <View style={[styles.summaryCard, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#F0F9FF', borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD' }]}>
                  <View style={styles.iconCircle}>
                    <Feather name="smartphone" size={26} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryTitle, { color: isDark ? '#7DD3FC' : '#0369A1' }]}>
                      Distracted Driving Log • {distractedCount} Incidents
                    </Text>
                    <Text style={[styles.summaryDesc, { color: isDark ? '#38BDF8' : '#0284C7' }]}>
                      Monitors phone unlocks, calls, and screen interaction events while vehicle is in motion (&gt; 15 km/h).
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Recorded Distractions ({distractedEvents.length})</Text>

                {distractedEvents.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                    <Ionicons name="shield-checkmark" size={44} color="#10B981" />
                    <Text style={[styles.emptyTitle, { color: colors.textMain }]}>100% Focused Driving</Text>
                    <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                      Zero screen touches or handheld phone usage detected while driving this week.
                    </Text>
                  </View>
                ) : (
                  distractedEvents.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.eventCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                      <View style={styles.eventTop}>
                        <View style={[styles.speedPill, { backgroundColor: '#E0F2FE' }]}>
                          <Text style={[styles.speedPillText, { color: '#0284C7' }]}>
                            {ev.durationSec ? `${ev.durationSec}s Screen Time` : 'Screen Interaction'}
                          </Text>
                        </View>
                        {ev.speed && (
                          <Text style={[styles.limitText, { color: colors.textSecondary }]}>At {ev.speed} km/h</Text>
                        )}
                      </View>

                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={13} color={colors.textMuted} />
                        <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                          {ev.address || 'Road'}
                        </Text>
                      </View>

                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}

            {/* RAPID ACCELERATION TAB */}
            {activeTab === 'rapidAccel' && (
              <>
                <View style={[styles.summaryCard, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.12)' : '#FDF2F8', borderColor: isDark ? 'rgba(236, 72, 153, 0.3)' : '#FBCFE8' }]}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="flash-outline" size={28} color="#DB2777" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryTitle, { color: isDark ? '#F472B6' : '#9D174D' }]}>
                      Rapid Acceleration Log • {rapidAccelCount} Incidents
                    </Text>
                    <Text style={[styles.summaryDesc, { color: isDark ? '#EC4899' : '#831843' }]}>
                      Detected sudden acceleration surges exceeding +18 km/h speed increase within seconds.
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Recorded Rapid Accelerations ({rapidAccelEvents.length})</Text>

                {rapidAccelEvents.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                    <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                    <Text style={[styles.emptyTitle, { color: colors.textMain }]}>Smooth Acceleration</Text>
                    <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                      Zero sudden gas pedal surges recorded. Smooth throttle control maintained.
                    </Text>
                  </View>
                ) : (
                  rapidAccelEvents.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.eventCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                      <View style={styles.eventTop}>
                        <View style={[styles.speedPill, { backgroundColor: '#FCE7F3' }]}>
                          <Text style={[styles.speedPillText, { color: '#BE185D' }]}>
                            {ev.gForce ? `${ev.gForce} G Force` : 'Sudden Surge'}
                          </Text>
                        </View>
                        <View style={[styles.excessBadge, { backgroundColor: '#FDF2F8' }]}>
                          <Text style={[styles.excessBadgeText, { color: '#9D174D' }]}>Rapid Accel</Text>
                        </View>
                      </View>

                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={13} color={colors.textMuted} />
                        <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                          {ev.address || 'Road'}
                        </Text>
                      </View>

                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}

            {/* HARD BRAKING TAB */}
            {activeTab === 'hardBraking' && (
              <>
                <View style={[styles.summaryCard, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7', borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A' }]}>
                  <View style={styles.iconCircle}>
                    <MaterialIcons name="car-crash" size={28} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryTitle, { color: isDark ? '#FBBF24' : '#92400E' }]}>
                      Hard Braking Log • {hardBrakingCount} Incidents
                    </Text>
                    <Text style={[styles.summaryDesc, { color: isDark ? '#F59E0B' : '#78350F' }]}>
                      Detected abrupt decelerations exceeding 18 km/h reduction in seconds.
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Recorded Hard Brakes ({hardBrakingEvents.length})</Text>

                {hardBrakingEvents.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                    <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                    <Text style={[styles.emptyTitle, { color: colors.textMain }]}>Gentle Braking Habits</Text>
                    <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                      Zero abrupt decelerations detected. Safe following distance maintained consistently.
                    </Text>
                  </View>
                ) : (
                  hardBrakingEvents.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.eventCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                      <View style={styles.eventTop}>
                        <View style={[styles.speedPill, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.speedPillText, { color: '#B45309' }]}>
                            {ev.gForce ? `${ev.gForce} G Decel` : 'Hard Brake'}
                          </Text>
                        </View>
                        {ev.speedBeforeBrake && ev.speedAfterBrake !== undefined && (
                          <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                            {ev.speedBeforeBrake} ➔ {ev.speedAfterBrake} km/h
                          </Text>
                        )}
                      </View>

                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={13} color={colors.textMuted} />
                        <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                          {ev.address || 'Intersection / Road'}
                        </Text>
                      </View>

                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabItemActive: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  summaryDesc: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  speedPill: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  speedPillText: {
    color: '#E11D48',
    fontWeight: '800',
    fontSize: 13,
  },
  limitText: {
    fontSize: 12,
    fontWeight: '600',
  },
  excessBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  excessBadgeText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 11,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  addressText: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
});
