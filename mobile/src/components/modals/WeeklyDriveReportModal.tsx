import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WeeklyDriveReportModalProps {
  visible: boolean;
  onClose: () => void;
  memberName: string;
  reportData?: any;
  onReplayTrip?: (trip: any) => void;
}

export const WeeklyDriveReportModal: React.FC<WeeklyDriveReportModalProps> = ({
  visible,
  onClose,
  memberName,
  reportData,
  onReplayTrip,
}) => {
  const { colors, isDark, isGlass } = useTheme();

  const webGlassCard =
    Platform.OS === 'web' && isGlass
      ? {
          backdropFilter: 'blur(30px) saturate(210%)',
          WebkitBackdropFilter: 'blur(30px) saturate(210%)',
          boxShadow: isDark
            ? 'inset 0 1px 0.8px rgba(255, 255, 255, 0.22), 0 8px 32px rgba(0, 0, 0, 0.4)'
            : 'inset 0 1px 1.2px rgba(255, 255, 255, 0.95), 0 8px 28px rgba(0, 0, 0, 0.08)',
        }
      : {};

  const webGlassTile =
    Platform.OS === 'web' && isGlass
      ? {
          backdropFilter: 'blur(20px) saturate(190%)',
          WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          boxShadow: isDark
            ? 'inset 0 1px 0.5px rgba(255, 255, 255, 0.16)'
            : 'inset 0 1px 0.8px rgba(255, 255, 255, 0.9)',
        }
      : {};

  const score = reportData?.weeklyScore ?? 100;
  const distance = reportData?.totalDistanceKm ?? 0;
  const tripsCount = reportData?.totalTrips ?? 0;
  const topSpeed = reportData?.topSpeedKm ?? 0;
  const safeMiles = reportData?.safeMilesPct ?? 100;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderTopWidth: 1.5,
              borderLeftWidth: 1.5,
              borderRightWidth: 1.5,
            },
            webGlassCard,
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <View style={[styles.unlockedBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                <Ionicons name="lock-open" size={12} color="#10B981" />
                <Text style={styles.unlockedBadgeText}>UNLOCKED PREMIUM FEATURE</Text>
              </View>
              <Text style={[styles.title, { color: colors.textMain }]}>Weekly Driver Report</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{memberName} • {reportData?.weekLabel || 'Past 7 Days'}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Score Card Hero */}
            <View
              style={[
                styles.scoreHero,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.tileBorder,
                },
                webGlassTile,
              ]}
            >
              <View style={[styles.scoreRingWrap, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#FFFFFF', borderColor: colors.primary }]}>
                <View style={styles.scoreCircle}>
                  <Text style={[styles.scoreNumber, { color: colors.primary }]}>{score}</Text>
                  <Text style={[styles.scoreMax, { color: colors.textMuted }]}>/100</Text>
                </View>
              </View>
              <View style={styles.scoreHeroInfo}>
                <Text style={[styles.scoreTitle, { color: colors.textMain }]}>Safe Driver Rating</Text>
                <Text style={[styles.scoreDesc, { color: colors.textSecondary }]}>
                  {score >= 90
                    ? 'Excellent driving habits this week! Consistently smooth and attentive.'
                    : 'Good driving performance with minor rapid accelerations or speed events.'}
                </Text>
                <View style={[styles.safeMilesPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                  <Feather name="shield" size={13} color="#059669" />
                  <Text style={styles.safeMilesText}>{safeMiles}% Safe Miles</Text>
                </View>
              </View>
            </View>

            {/* Metrics Overview Grid */}
            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                  webGlassTile,
                ]}
              >
                <Feather name="navigation" size={18} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.textMain }]}>{distance} km</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Distance</Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                  webGlassTile,
                ]}
              >
                <Ionicons name="car" size={18} color="#059669" />
                <Text style={[styles.statValue, { color: colors.textMain }]}>{tripsCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Trips</Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                  webGlassTile,
                ]}
              >
                <Ionicons name="speedometer" size={18} color="#EA580C" />
                <Text style={[styles.statValue, { color: colors.textMain }]}>{topSpeed} km/h</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Top Speed</Text>
              </View>
            </View>

            {/* Unlocked Insights Section */}
            <Text style={[styles.sectionHeader, { color: colors.textMain }]}>Driver Safety Events</Text>

            <View style={[styles.eventRow, { borderBottomColor: colors.divider }]}>
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                <Ionicons name="speedometer-outline" size={20} color={Colors.speeding} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Speeding</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.speeding?.count ?? 0} events recorded{reportData?.speeding?.topSpeed ? ` (Top: ${reportData.speeding.topSpeed} km/h)` : ''}
                </Text>
              </View>
              <View style={[styles.unlockedTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                <Text style={styles.unlockedTagText}>Unlocked</Text>
              </View>
            </View>

            <View style={[styles.eventRow, { borderBottomColor: colors.divider }]}>
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(6, 182, 212, 0.2)' : '#E0F2FE' }]}>
                <Feather name="smartphone" size={20} color={Colors.distracted} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Distracted Driving</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.distracted?.count ?? 0} screen interactions while moving
                </Text>
              </View>
              <View style={[styles.unlockedTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                <Text style={styles.unlockedTagText}>Unlocked</Text>
              </View>
            </View>

            <View style={[styles.eventRow, { borderBottomColor: colors.divider }]}>
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3' }]}>
                <Ionicons name="flash-outline" size={20} color={Colors.rapidAccel} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Rapid Acceleration</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.rapidAccel?.count ?? 0} sudden accelerations recorded
                </Text>
              </View>
              <View style={[styles.unlockedTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                <Text style={styles.unlockedTagText}>Unlocked</Text>
              </View>
            </View>

            <View style={[styles.eventRow, { borderBottomColor: colors.divider }]}>
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                <MaterialIcons name="car-crash" size={20} color={Colors.hardBraking} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Hard Braking</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.hardBraking?.count ?? 0} hard brake events recorded
                </Text>
              </View>
              <View style={[styles.unlockedTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                <Text style={styles.unlockedTagText}>Unlocked</Text>
              </View>
            </View>

            {/* Interactive Trips List & Replays */}
            <Text style={[styles.sectionHeader, { color: colors.textMain }]}>Recent Trips Replay</Text>

            {(!reportData?.trips || reportData.trips.length === 0) ? (
              <View style={[styles.emptyTripsCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                <Ionicons name="car-outline" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyTripsTitle, { color: colors.textMain }]}>No Recorded Drives This Week</Text>
                <Text style={[styles.emptyTripsSub, { color: colors.textSecondary }]}>
                  Drives and route paths will appear here once trips are recorded for {memberName}.
                </Text>
              </View>
            ) : (
              reportData.trips.map((trip: any, idx: number) => (
                <View
                  key={trip.id || idx}
                  style={[
                    styles.tripCard,
                    {
                      backgroundColor: colors.tileBg,
                      borderColor: colors.tileBorder,
                    },
                  ]}
                >
                  <View style={styles.tripCardHeader}>
                    <View style={[styles.tripDayTag, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}>
                      <Text style={[styles.tripDayText, { color: colors.textMain }]}>{trip.dayLabel}</Text>
                    </View>
                    <Text style={[styles.tripTimeText, { color: colors.textMuted }]}>{trip.startTime} - {trip.endTime}</Text>
                  </View>

                  <View style={styles.tripStatsRow}>
                    <Text style={[styles.tripMetricText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: '800', color: colors.textMain }}>{trip.distanceKm} km</Text> • {trip.durationMins} mins
                    </Text>
                    <Text style={[styles.tripTopSpeedText, { color: colors.primary }]}>Top: {trip.topSpeedKm} km/h</Text>
                  </View>

                  <View style={styles.tripRouteRow}>
                    <View style={styles.routeDotGreen} />
                    <Text style={[styles.routeAddressText, { color: colors.textSecondary }]} numberOfLines={1}>{trip.startAddress}</Text>
                  </View>
                  <View style={styles.tripRouteRow}>
                    <View style={styles.routeDotPurple} />
                    <Text style={[styles.routeAddressText, { color: colors.textSecondary }]} numberOfLines={1}>{trip.endAddress}</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      onClose();
                      onReplayTrip?.(trip);
                    }}
                    style={[styles.replayBtn, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="map-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.replayBtnText}>Replay Drive Route on Map</Text>
                  </TouchableOpacity>
                </View>
              ))
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
    maxHeight: '90%',
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  unlockedBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  scoreRingWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  scoreCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 28,
  },
  scoreMax: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  scoreHeroInfo: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  scoreDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  safeMilesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  safeMilesText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    marginTop: 8,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  unlockedTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  unlockedTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tripDayTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tripDayText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  tripTimeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  tripStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tripMetricText: {
    fontSize: 13,
    color: '#0F172A',
  },
  tripTopSpeedText: {
    fontSize: 12,
    color: '#EA580C',
    fontWeight: '700',
  },
  tripRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  routeDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  routeDotPurple: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  routeAddressText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  replayBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  replayBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTripsCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyTripsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyTripsSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
