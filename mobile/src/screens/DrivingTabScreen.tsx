import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { MemberData } from '../models/Member';
import { Avatar } from '../components/Avatar';
import { WeeklyDriveReportModal } from '../components/modals/WeeklyDriveReportModal';
import { SpeedingModal } from '../components/modals/SpeedingModal';
import { authService } from '../services/AuthService';

interface DrivingTabScreenProps {
  members: MemberData[];
  currentUserId: string;
  selectedCircleId?: string;
  backendUrl?: string;
  onReplayTripOnMap: (trip: any) => void;
}

export const DrivingTabScreen: React.FC<DrivingTabScreenProps> = ({
  members,
  currentUserId,
  selectedCircleId,
  backendUrl,
  onReplayTripOnMap,
}) => {
  const { colors, isDark, isGlass } = useTheme();

  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);

  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showSpeedingModal, setShowSpeedingModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(currentUserId);
  const [selectedDriverName, setSelectedDriverName] = useState<string>('You');
  const [driverReport, setDriverReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

  useEffect(() => {
    const currentMember = members.find((m) => m.id === selectedDriverId) || members[0];
    if (currentMember) {
      setSelectedDriverName(currentMember.fullName);
    }
  }, [members, selectedDriverId]);

  useEffect(() => {
    if (!selectedCircleId || !backendUrl || !selectedDriverId) return;
    let isMounted = true;
    setLoadingReport(true);
    authService
      .fetchDriverReport(backendUrl, selectedCircleId, selectedDriverId)
      .then((data) => {
        if (isMounted && data) {
          setDriverReport(data);
        }
      })
      .catch((err) => console.warn('[DrivingTabScreen] report fetch error:', err))
      .finally(() => {
        if (isMounted) setLoadingReport(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCircleId, backendUrl, selectedDriverId]);

  const familyScore = driverReport?.weeklyScore ?? 100;
  const speedingCount = driverReport?.speeding?.count ?? 0;
  const topSpeed = driverReport?.speeding?.topSpeed ?? 0;
  const distractedCount = driverReport?.distracted?.count ?? 0;
  const rapidAccelCount = driverReport?.rapidAccel?.count ?? 0;
  const hardBrakingCount = driverReport?.hardBraking?.count ?? 0;
  const trips = driverReport?.trips || [];
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Math.max(insets.top + 8, 48);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop, backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
        <View>
          <View style={[styles.unlockedPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
            <Ionicons name="lock-open" size={12} color={isDark ? '#34D399' : '#10B981'} />
            <Text style={[styles.unlockedPillText, { color: isDark ? '#34D399' : '#059669' }]}>DRIVER PROTECT UNLOCKED</Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.textMain }]}>Driving Safety</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowWeeklyReport(true)}
          style={[styles.weeklyReportBtn, { backgroundColor: colors.tileBg }]}
        >
          <Feather name="file-text" size={16} color={colors.primary} />
          <Text style={[styles.weeklyReportBtnText, { color: colors.primary }]}>Report</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Family Driving Score Hero */}
        <View
          style={[
            styles.scoreHero,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassCard,
          ]}
        >
          <View style={[styles.scoreCircle, { backgroundColor: colors.tileBg, borderColor: colors.primary }]}>
            <Text style={[styles.scoreNumber, { color: colors.primary }]}>{familyScore}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scoreTitle, { color: colors.textMain }]}>{selectedDriverName}'s Safety Score</Text>
            <Text style={[styles.scoreDesc, { color: colors.textSecondary }]}>
              {familyScore >= 90
                ? 'Safe driving performance. No collision detected, clean driving habits.'
                : 'Good performance with minor speed or acceleration events.'}
            </Text>
            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                <Ionicons name="shield-checkmark" size={12} color={isDark ? '#34D399' : '#059669'} />
                <Text style={[styles.heroBadgeText, { color: isDark ? '#34D399' : '#059669' }]}>Crash Protection Active</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Driving Safety Insights */}
        <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Driving Safety Insights</Text>
        <View style={styles.insightsGrid}>
          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setShowSpeedingModal(true)}
          >
            <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
              <Ionicons name="speedometer-outline" size={20} color={Colors.speeding} />
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{speedingCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Speeding Events</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{topSpeed > 0 ? `Top: ${topSpeed} km/h` : 'Zero speeding'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setShowWeeklyReport(true)}
          >
            <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE' }]}>
              <Feather name="smartphone" size={20} color={Colors.distracted} />
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{distractedCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Distracted Drive</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{distractedCount > 0 ? `${distractedCount} events` : '0 screen use'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setShowWeeklyReport(true)}
          >
            <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3' }]}>
              <Ionicons name="flash-outline" size={20} color={Colors.rapidAccel} />
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{rapidAccelCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Rapid Accel</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{rapidAccelCount > 0 ? `${rapidAccelCount} events` : 'Smooth acceleration'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setShowWeeklyReport(true)}
          >
            <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
              <MaterialIcons name="car-crash" size={20} color={Colors.hardBraking} />
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{hardBrakingCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Hard Braking</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{hardBrakingCount > 0 ? `${hardBrakingCount} events` : 'Gentle stops'}</Text>
          </TouchableOpacity>
        </View>

        {/* Family Driver Leaderboard */}
        <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Circle Drivers Leaderboard</Text>
        <View style={[styles.leaderboardCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, webGlassCard]}>
          {members.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={28} color="#94A3B8" />
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>No circle members</Text>
            </View>
          ) : (
            members.map((driver, idx) => (
              <TouchableOpacity
                key={driver.id}
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedDriverId(driver.id);
                  setSelectedDriverName(driver.fullName);
                  setShowWeeklyReport(true);
                }}
                style={[
                  styles.driverRow,
                  { borderBottomColor: colors.divider },
                  idx === members.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.rankText}>#{idx + 1}</Text>
                <Avatar name={driver.fullName} avatarUrl={driver.avatarUrl} size={40} />
                <View style={styles.driverInfo}>
                  <Text style={[styles.driverName, { color: colors.textMain }]}>
                    {driver.fullName.replace(/\s*\(You\)/gi, '').trim()} {driver.id === currentUserId ? '(You)' : ''}
                  </Text>
                  <Text style={[styles.driverMetrics, { color: colors.textMuted }]}>
                    {driver.batteryLevel !== undefined ? `🔋 ${driver.batteryLevel}%` : 'Safe Driver'} • {driver.isMoving ? '🚗 Moving' : 'Active'}
                  </Text>
                </View>
                <View style={[styles.driverScoreBadge, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                  <Text style={[styles.driverScoreNumber, { color: colors.primary }]}>
                    {driver.id === selectedDriverId && driverReport ? driverReport.weeklyScore : 100}
                  </Text>
                  <Text style={styles.driverScoreLabel}>Score</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Drives Replay */}
        <View style={styles.recentDrivesHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Recent Drives Replay</Text>
          {trips.length > 0 && (
            <TouchableOpacity onPress={() => setShowWeeklyReport(true)}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingReport ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Loading trips...</Text>
          </View>
        ) : trips.length === 0 ? (
          <View style={[styles.emptyTripsCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
            <Ionicons name="car-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTripsTitle, { color: colors.textMain }]}>No Recorded Drives This Week</Text>
            <Text style={[styles.emptyTripsSub, { color: colors.textMuted }]}>
              Trips and drive paths will automatically be captured when circle members travel above 15 km/h.
            </Text>
          </View>
        ) : (
          trips.slice(0, 3).map((trip: any, idx: number) => (
            <View key={trip.id || idx} style={[styles.tripCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.tripTopRow}>
                <View style={styles.tripDriver}>
                  <Avatar name={selectedDriverName} size={28} />
                  <Text style={[styles.tripDriverName, { color: colors.textMain }]}>{selectedDriverName} • {trip.dayLabel || 'Drive'}</Text>
                </View>
                <Text style={[styles.tripDuration, { color: colors.textMuted }]}>{trip.startTime} - {trip.endTime}</Text>
              </View>

              <View style={styles.tripStatsRow}>
                <Text style={[styles.tripStats, { color: colors.textSecondary }]}>
                  {trip.distanceKm} km • {trip.durationMins} mins • Top: {trip.topSpeedKm} km/h
                </Text>
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillText}>Score: {trip.score}</Text>
                </View>
              </View>

              {trip.routeCoordinates && trip.routeCoordinates.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onReplayTripOnMap(trip)}
                  style={[styles.replayButton, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="map-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.replayButtonText}>Replay Trip Route on Map</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Modals */}
      <WeeklyDriveReportModal
        visible={showWeeklyReport}
        memberName={selectedDriverName}
        reportData={driverReport}
        onClose={() => setShowWeeklyReport(false)}
        onReplayTrip={onReplayTripOnMap}
      />

      <SpeedingModal
        visible={showSpeedingModal}
        speedingData={driverReport?.speeding}
        onClose={() => setShowSpeedingModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  unlockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  unlockedPillText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  weeklyReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  weeklyReportBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  scoreHero: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1.5,
    marginBottom: 20,
    elevation: 3,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  scoreCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#F5F3FF',
    borderWidth: 4,
    borderColor: Colors.primary,
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
  scoreTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  scoreDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  heroBadges: {
    flexDirection: 'row',
    marginTop: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  insightCard: {
    width: (Dimensions.get('window').width - 42) / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  insightIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  insightCount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  insightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  insightSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  leaderboardCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 22,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
    width: 22,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverMetrics: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  driverScoreBadge: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  driverScoreNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
  },
  driverScoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  recentDrivesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
  },
  tripTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripDriver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripDriverName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tripDuration: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  tripStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tripStats: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  scorePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  replayButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  replayButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTripsCard: {
    backgroundColor: '#FFFFFF',
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
