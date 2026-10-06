import React, { useState } from 'react';
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
import { Skeleton, SkeletonCircle, DriveCardSkeleton } from '../common/Skeleton';
import { LoadingSpinner } from '../common/Loader';
import { formatEventDateTime, formatTripDayLabel, formatTripTimeRange } from '../../utils/dateUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WeeklyDriveReportModalProps {
  visible: boolean;
  onClose: () => void;
  memberName: string;
  reportData?: any;
  loading?: boolean;
  onReplayTrip?: (trip: any) => void;
}

export const WeeklyDriveReportModal: React.FC<WeeklyDriveReportModalProps> = ({
  visible,
  onClose,
  memberName,
  reportData,
  loading = false,
  onReplayTrip,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const toggleEvent = (key: string) => setExpandedEvent((prev) => (prev === key ? null : key));

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

          {loading ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <LoadingSpinner size="medium" message="Generating weekly drive analytics..." />
              </View>
              {/* Skeleton Score Card */}
              <View
                style={[
                  styles.scoreHero,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                ]}
              >
                <SkeletonCircle size={76} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Skeleton width={140} height={18} borderRadius={9} />
                  <Skeleton width={200} height={12} borderRadius={6} style={{ marginTop: 8 }} />
                  <Skeleton width={110} height={20} borderRadius={10} style={{ marginTop: 10 }} />
                </View>
              </View>
              {/* Skeleton Drive Cards */}
              <DriveCardSkeleton count={3} />
            </ScrollView>
          ) : (
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

            {/* Driver Safety Events with Actual Telemetry Logs */}
            <Text style={[styles.sectionHeader, { color: colors.textMain }]}>Driver Safety Events (Tap to View Log)</Text>

            {/* 1. SPEEDING */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => toggleEvent('speeding')}
              style={[styles.eventRow, { borderBottomColor: colors.divider }]}
            >
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                <Ionicons name="speedometer-outline" size={20} color={Colors.speeding} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Speeding</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.speeding?.count ?? 0} events recorded{reportData?.speeding?.topSpeed ? ` (Top: ${reportData.speeding.topSpeed} km/h)` : ''}
                </Text>
              </View>
              <View style={[styles.eventLogBadge, { backgroundColor: expandedEvent === 'speeding' ? colors.primary : colors.tileBg }]}>
                <Text style={[styles.eventLogBadgeText, { color: expandedEvent === 'speeding' ? '#FFFFFF' : colors.primary }]}>
                  {expandedEvent === 'speeding' ? 'Hide Log' : 'View Log'}
                </Text>
                <Feather name={expandedEvent === 'speeding' ? 'chevron-up' : 'chevron-down'} size={12} color={expandedEvent === 'speeding' ? '#FFFFFF' : colors.primary} />
              </View>
            </TouchableOpacity>

            {expandedEvent === 'speeding' && (
              <View style={[styles.eventDetailsBox, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                {(!reportData?.speeding?.events || reportData.speeding.events.length === 0) ? (
                  <View style={styles.eventEmptyMini}>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    <Text style={[styles.eventEmptyText, { color: colors.textMain }]}>Zero speeding incidents recorded this week!</Text>
                  </View>
                ) : (
                  reportData.speeding.events.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.incidentMiniCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.incidentTopRow}>
                        <View style={styles.incidentSpeedPill}>
                          <Text style={styles.incidentSpeedText}>{ev.speed} km/h</Text>
                        </View>
                        <Text style={[styles.incidentLimitText, { color: colors.textSecondary }]}>Limit: {ev.speedLimit || 50} km/h</Text>
                        <View style={styles.incidentExcessBadge}>
                          <Text style={styles.incidentExcessText}>+{ev.excessSpeed || Math.max(0, ev.speed - (ev.speedLimit || 50))} km/h</Text>
                        </View>
                      </View>
                      <View style={styles.incidentLocRow}>
                        <Feather name="map-pin" size={12} color={colors.textMuted} />
                        <Text style={[styles.incidentAddrText, { color: colors.textSecondary }]} numberOfLines={1}>{ev.address || 'Street / Highway'}</Text>
                      </View>
                      <Text style={[styles.incidentTimeText, { color: colors.textMuted }]}>
                        {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* 2. DISTRACTED DRIVING */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => toggleEvent('distracted')}
              style={[styles.eventRow, { borderBottomColor: colors.divider }]}
            >
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(6, 182, 212, 0.2)' : '#E0F2FE' }]}>
                <Feather name="smartphone" size={20} color={Colors.distracted} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Distracted Driving</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.distracted?.count ?? 0} screen interactions while moving
                </Text>
              </View>
              <View style={[styles.eventLogBadge, { backgroundColor: expandedEvent === 'distracted' ? colors.primary : colors.tileBg }]}>
                <Text style={[styles.eventLogBadgeText, { color: expandedEvent === 'distracted' ? '#FFFFFF' : colors.primary }]}>
                  {expandedEvent === 'distracted' ? 'Hide Log' : 'View Log'}
                </Text>
                <Feather name={expandedEvent === 'distracted' ? 'chevron-up' : 'chevron-down'} size={12} color={expandedEvent === 'distracted' ? '#FFFFFF' : colors.primary} />
              </View>
            </TouchableOpacity>

            {expandedEvent === 'distracted' && (
              <View style={[styles.eventDetailsBox, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                {(!reportData?.distracted?.events || reportData.distracted.events.length === 0) ? (
                  <View style={styles.eventEmptyMini}>
                    <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                    <Text style={[styles.eventEmptyText, { color: colors.textMain }]}>Zero distracted driving incidents!</Text>
                    <Text style={[styles.eventEmptySub, { color: colors.textMuted }]}>100% focused driving while vehicle in motion.</Text>
                  </View>
                ) : (
                  reportData.distracted.events.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.incidentMiniCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.incidentTopRow}>
                        <View style={[styles.incidentSpeedPill, { backgroundColor: '#E0F2FE' }]}>
                          <Text style={[styles.incidentSpeedText, { color: '#0284C7' }]}>{ev.durationSec ? `${ev.durationSec}s Screen Time` : 'Screen Use'}</Text>
                        </View>
                        {ev.speed && <Text style={[styles.incidentLimitText, { color: colors.textSecondary }]}>At {ev.speed} km/h</Text>}
                      </View>
                      <View style={styles.incidentLocRow}>
                        <Feather name="map-pin" size={12} color={colors.textMuted} />
                        <Text style={[styles.incidentAddrText, { color: colors.textSecondary }]} numberOfLines={1}>{ev.address || 'Road'}</Text>
                      </View>
                      <Text style={[styles.incidentTimeText, { color: colors.textMuted }]}>
                        {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* 3. RAPID ACCELERATION */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => toggleEvent('rapidAccel')}
              style={[styles.eventRow, { borderBottomColor: colors.divider }]}
            >
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3' }]}>
                <Ionicons name="flash-outline" size={20} color={Colors.rapidAccel} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Rapid Acceleration</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.rapidAccel?.count ?? 0} sudden accelerations recorded
                </Text>
              </View>
              <View style={[styles.eventLogBadge, { backgroundColor: expandedEvent === 'rapidAccel' ? colors.primary : colors.tileBg }]}>
                <Text style={[styles.eventLogBadgeText, { color: expandedEvent === 'rapidAccel' ? '#FFFFFF' : colors.primary }]}>
                  {expandedEvent === 'rapidAccel' ? 'Hide Log' : 'View Log'}
                </Text>
                <Feather name={expandedEvent === 'rapidAccel' ? 'chevron-up' : 'chevron-down'} size={12} color={expandedEvent === 'rapidAccel' ? '#FFFFFF' : colors.primary} />
              </View>
            </TouchableOpacity>

            {expandedEvent === 'rapidAccel' && (
              <View style={[styles.eventDetailsBox, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                {(!reportData?.rapidAccel?.events || reportData.rapidAccel.events.length === 0) ? (
                  <View style={styles.eventEmptyMini}>
                    <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                    <Text style={[styles.eventEmptyText, { color: colors.textMain }]}>Zero rapid accelerations recorded!</Text>
                    <Text style={[styles.eventEmptySub, { color: colors.textMuted }]}>Smooth acceleration habits maintained throughout.</Text>
                  </View>
                ) : (
                  reportData.rapidAccel.events.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.incidentMiniCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.incidentTopRow}>
                        <View style={[styles.incidentSpeedPill, { backgroundColor: '#FCE7F3' }]}>
                          <Text style={[styles.incidentSpeedText, { color: '#BE185D' }]}>{ev.gForce ? `${ev.gForce} G Force` : 'Surge'}</Text>
                        </View>
                        <View style={styles.incidentExcessBadge}>
                          <Text style={[styles.incidentExcessText, { color: '#9D174D' }]}>Rapid Accel</Text>
                        </View>
                      </View>
                      <View style={styles.incidentLocRow}>
                        <Feather name="map-pin" size={12} color={colors.textMuted} />
                        <Text style={[styles.incidentAddrText, { color: colors.textSecondary }]} numberOfLines={1}>{ev.address || 'Road'}</Text>
                      </View>
                      <Text style={[styles.incidentTimeText, { color: colors.textMuted }]}>
                        {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* 4. HARD BRAKING */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => toggleEvent('hardBraking')}
              style={[styles.eventRow, { borderBottomColor: colors.divider }]}
            >
              <View style={[styles.eventIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                <MaterialIcons name="car-crash" size={20} color={Colors.hardBraking} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.textMain }]}>Hard Braking</Text>
                <Text style={[styles.eventSub, { color: colors.textSecondary }]}>
                  {reportData?.hardBraking?.count ?? 0} hard brake events recorded
                </Text>
              </View>
              <View style={[styles.eventLogBadge, { backgroundColor: expandedEvent === 'hardBraking' ? colors.primary : colors.tileBg }]}>
                <Text style={[styles.eventLogBadgeText, { color: expandedEvent === 'hardBraking' ? '#FFFFFF' : colors.primary }]}>
                  {expandedEvent === 'hardBraking' ? 'Hide Log' : 'View Log'}
                </Text>
                <Feather name={expandedEvent === 'hardBraking' ? 'chevron-up' : 'chevron-down'} size={12} color={expandedEvent === 'hardBraking' ? '#FFFFFF' : colors.primary} />
              </View>
            </TouchableOpacity>

            {expandedEvent === 'hardBraking' && (
              <View style={[styles.eventDetailsBox, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                {(!reportData?.hardBraking?.events || reportData.hardBraking.events.length === 0) ? (
                  <View style={styles.eventEmptyMini}>
                    <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                    <Text style={[styles.eventEmptyText, { color: colors.textMain }]}>Zero hard brake events recorded!</Text>
                    <Text style={[styles.eventEmptySub, { color: colors.textMuted }]}>Gentle and safe braking habits maintained.</Text>
                  </View>
                ) : (
                  reportData.hardBraking.events.map((ev: any, idx: number) => (
                    <View key={ev.id || idx} style={[styles.incidentMiniCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.incidentTopRow}>
                        <View style={[styles.incidentSpeedPill, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.incidentSpeedText, { color: '#B45309' }]}>{ev.gForce ? `${ev.gForce} G Decel` : 'Hard Brake'}</Text>
                        </View>
                        {ev.speedBeforeBrake && ev.speedAfterBrake !== undefined && (
                          <Text style={[styles.incidentLimitText, { color: colors.textSecondary }]}>{ev.speedBeforeBrake} ➔ {ev.speedAfterBrake} km/h</Text>
                        )}
                      </View>
                      <View style={styles.incidentLocRow}>
                        <Feather name="map-pin" size={12} color={colors.textMuted} />
                        <Text style={[styles.incidentAddrText, { color: colors.textSecondary }]} numberOfLines={1}>{ev.address || 'Intersection / Road'}</Text>
                      </View>
                      <Text style={[styles.incidentTimeText, { color: colors.textMuted }]}>
                        {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

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
                      <Text style={[styles.tripDayText, { color: colors.textMain }]}>
                        {formatTripDayLabel(trip.startTimestamp || trip.startTimeRaw, trip.dayLabel)}
                      </Text>
                    </View>
                    <Text style={[styles.tripTimeText, { color: colors.textMuted }]}>
                      {formatTripTimeRange(trip.startTimestamp || trip.startTimeRaw, trip.endTimestamp || trip.endTimeRaw, trip.startTime, trip.endTime)}
                    </Text>
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
        )}
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
  eventLogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventLogBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventDetailsBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  eventEmptyMini: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  eventEmptyText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  eventEmptySub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  incidentMiniCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  incidentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  incidentSpeedPill: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  incidentSpeedText: {
    color: '#E11D48',
    fontSize: 12,
    fontWeight: '800',
  },
  incidentLimitText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  incidentExcessBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  incidentExcessText: {
    color: '#DC2626',
    fontSize: 10.5,
    fontWeight: '800',
  },
  incidentLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  incidentAddrText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  incidentTimeText: {
    fontSize: 10.5,
    fontWeight: '600',
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
