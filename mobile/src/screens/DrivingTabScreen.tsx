import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { MemberData } from '../models/Member';
import { Avatar } from '../components/Avatar';
import { WeeklyDriveReportModal } from '../components/modals/WeeklyDriveReportModal';
import { authService } from '../services/AuthService';
import { DriveCardSkeleton } from '../components/common/Skeleton';
import { LoadingSpinner } from '../components/common/Loader';
import { navigationService } from '../services/NavigationService';
import { getMovementActivity } from '../models/MovementActivity';
import { AnimatedActivityEmoji } from '../components/common/AnimatedActivityEmoji';
import { formatTripDayLabel, formatTripTimeRange, formatEventDateTime } from '../utils/dateUtils';
import { distancePreferencesService } from '../services/DistancePreferencesService';
import { formatSpeed } from '../utils/geoMath';

export type DriverSafetyEventType = 'speeding' | 'distracted' | 'rapidAccel' | 'hardBraking' | 'harshCornering';

interface DrivingTabScreenProps {
  members: MemberData[];
  currentUserId: string;
  selectedCircleId?: string;
  backendUrl?: string;
  onReplayTripOnMap: (trip: any) => void;
  onViewTimeline?: (member?: MemberData, filter?: 'all' | 'places' | 'drives') => void;
  pullUpTrigger?: number;
  onCheckInTapped?: () => void;
  onGhostModeTapped?: () => void;
  isSelfInBubble?: boolean;
  onToggleMapLayers?: () => void;
  onGoToMyLocation?: () => void;
  onSOSTapped?: () => void;
  onExpandChange?: (isExpanded: boolean) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_MIN_HEIGHT = 90;
const DRAWER_MID_HEIGHT = 310;

const DRIVING_CACHE_TTL = 180000; // 3 minutes cache TTL
let globalDrivingCache: {
  circleId: string;
  leaderboard: any[];
  selfReport: any;
  timestamp: number;
} | null = null;

export const DrivingTabScreen: React.FC<DrivingTabScreenProps> = React.memo(({
  members,
  currentUserId,
  selectedCircleId,
  backendUrl,
  onReplayTripOnMap,
  onViewTimeline,
  pullUpTrigger,
  onCheckInTapped,
  onGhostModeTapped,
  isSelfInBubble = false,
  onToggleMapLayers,
  onGoToMyLocation,
  onSOSTapped,
  onExpandChange,
}) => {
  const onExpandChangeRef = useRef(onExpandChange);
  onExpandChangeRef.current = onExpandChange;
  const { colors, isDark, isGlass } = useTheme();

  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);

  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [selectedSafetyEvent, setSelectedSafetyEvent] = useState<DriverSafetyEventType | null>(null);
  const [distancePrefs, setDistancePrefs] = useState(() => distancePreferencesService.getPreferencesSync());

  useEffect(() => {
    return distancePreferencesService.subscribe(setDistancePrefs);
  }, []);

  // Self User Driving Report (ALWAYS stays for the self user, pre-populated from memory cache)
  const [selfDriverReport, setSelfDriverReport] = useState<any | null>(() => {
    return (globalDrivingCache && globalDrivingCache.circleId === selectedCircleId)
      ? globalDrivingCache.selfReport
      : null;
  });
  const [loadingSelfReport, setLoadingSelfReport] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<any[]>(() => {
    return (globalDrivingCache && globalDrivingCache.circleId === selectedCircleId)
      ? globalDrivingCache.leaderboard
      : [];
  });
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modal driver report (specifically for the clicked member in leaderboard)
  const [modalMember, setModalMember] = useState<{ id: string; name: string } | null>(null);
  const [modalMemberReport, setModalMemberReport] = useState<any | null>(null);
  const [loadingModalReport, setLoadingModalReport] = useState<boolean>(false);

  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);
  const headerPaddingTop = statusBarHeight + 12;

  const selfMember = useMemo(() => {
    return (
      members.find((m) => m.id === currentUserId) ||
      members[0] || {
        id: currentUserId,
        fullName: 'You',
        batteryLevel: 100,
        isMoving: false,
      }
    );
  }, [members, currentUserId]);

  const selfMemberName = selfMember.fullName || 'You';

  useEffect(() => {
    const handleDrivingBack = (): boolean => {
      if (selectedSafetyEvent) {
        setSelectedSafetyEvent(null);
        return true;
      }
      if (showWeeklyReport) {
        setShowWeeklyReport(false);
        setModalMember(null);
        setModalMemberReport(null);
        return true;
      }
      return false;
    };

    const unregister = navigationService.registerBackHandler('driving_tab', handleDrivingBack, 80);
    return () => unregister();
  }, [showWeeklyReport, selectedSafetyEvent]);

  // Unified fetch for circle leaderboard and self driver safety report with silent caching
  const fetchDrivingData = useCallback(async (isPullToRefresh = false) => {
    if (!selectedCircleId || !backendUrl) return;

    const now = Date.now();
    const isCacheFresh =
      globalDrivingCache &&
      globalDrivingCache.circleId === selectedCircleId &&
      now - globalDrivingCache.timestamp < DRIVING_CACHE_TTL;

    // If cache is fresh and not a manual pull-to-refresh, do not re-fetch
    if (!isPullToRefresh && isCacheFresh) {
      return;
    }

    if (isPullToRefresh) {
      setRefreshing(true);
    } else if (!globalDrivingCache || globalDrivingCache.circleId !== selectedCircleId) {
      setLoadingLeaderboard(true);
      setLoadingSelfReport(true);
    }

    try {
      const [board, rep] = await Promise.all([
        authService.fetchCircleDriverLeaderboard(backendUrl, selectedCircleId),
        currentUserId ? authService.fetchDriverReport(backendUrl, selectedCircleId, currentUserId) : Promise.resolve(null),
      ]);

      const validBoard = board && Array.isArray(board) ? board : (globalDrivingCache?.leaderboard || []);
      const validRep = rep || globalDrivingCache?.selfReport || null;

      if (board && Array.isArray(board)) {
        setLeaderboard(board);
      }
      if (rep) {
        setSelfDriverReport(rep);
      }

      globalDrivingCache = {
        circleId: selectedCircleId,
        leaderboard: validBoard,
        selfReport: validRep,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn('[DrivingTabScreen] fetchDrivingData error:', err);
    } finally {
      setRefreshing(false);
      setLoadingLeaderboard(false);
      setLoadingSelfReport(false);
    }
  }, [selectedCircleId, backendUrl, currentUserId]);

  // Re-fetch whenever active circle changes
  useEffect(() => {
    fetchDrivingData(false);
  }, [fetchDrivingData]);

  // Handler to open weekly report modal for any clicked leaderboard member
  const handleOpenMemberReport = useCallback((driver: any) => {
    const driverId = driver.userId || driver.id;
    const driverName = driver.fullName || 'Member';
    setModalMember({ id: driverId, name: driverName });
    setShowWeeklyReport(true);

    if (driverId === currentUserId) {
      setModalMemberReport(selfDriverReport);
    } else {
      setLoadingModalReport(true);
      setModalMemberReport(null);
      authService
        .fetchDriverReport(backendUrl || '', selectedCircleId || '', driverId)
        .then((data) => {
          if (data) {
            setModalMemberReport(data);
          }
        })
        .catch((err) => console.warn('[DrivingTabScreen] member report error:', err))
        .finally(() => setLoadingModalReport(false));
    }
  }, [currentUserId, selfDriverReport, backendUrl, selectedCircleId]);

  const selfLeaderboardEntry = leaderboard.find((item) => item.userId === currentUserId);
  const familyScore = selfLeaderboardEntry?.weeklyScore ?? selfDriverReport?.weeklyScore ?? 100;
  const speedingCount = selfDriverReport?.speeding?.count ?? 0;
  const topSpeed = selfDriverReport?.speeding?.topSpeed ?? 0;
  const distractedCount = selfDriverReport?.distracted?.count ?? 0;
  const rapidAccelCount = selfDriverReport?.rapidAccel?.count ?? 0;
  const hardBrakingCount = selfDriverReport?.hardBraking?.count ?? 0;
  const harshCorneringCount = selfDriverReport?.harshCornering?.count ?? 0;
  const trips = selfDriverReport?.trips || [];

  const speedingEvents = selfDriverReport?.speeding?.events || [];
  const distractedEvents = selfDriverReport?.distracted?.events || [];
  const rapidAccelEvents = selfDriverReport?.rapidAccel?.events || [];
  const hardBrakingEvents = selfDriverReport?.hardBraking?.events || [];
  const harshCorneringEvents = selfDriverReport?.harshCornering?.events || [];

  const safetyEventItems: {
    key: DriverSafetyEventType;
    label: string;
    count: number;
    subLabel: string;
    icon: any;
    iconType: 'ion' | 'feather' | 'material';
    iconColor: string;
    iconBgColor: string;
    countBgColor: string;
    countTextColor: string;
  }[] = useMemo(() => [
    {
      key: 'speeding',
      label: 'Speeding Events',
      count: speedingCount,
      subLabel: topSpeed > 0 ? `Top: ${formatSpeed(topSpeed, distancePrefs.unit)}` : 'Zero speeding',
      icon: 'speedometer-outline',
      iconType: 'ion',
      iconColor: Colors.speeding,
      iconBgColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
      countBgColor: speedingCount > 0 ? '#FEE2E2' : '#ECFDF5',
      countTextColor: speedingCount > 0 ? '#DC2626' : '#059669',
    },
    {
      key: 'distracted',
      label: 'Distracted Driving',
      count: distractedCount,
      subLabel: distractedCount > 0 ? `${distractedCount} screen events` : '0 screen use',
      icon: 'smartphone',
      iconType: 'feather',
      iconColor: Colors.distracted,
      iconBgColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE',
      countBgColor: distractedCount > 0 ? '#FEF3C7' : '#ECFDF5',
      countTextColor: distractedCount > 0 ? '#D97706' : '#059669',
    },
    {
      key: 'rapidAccel',
      label: 'Rapid Acceleration',
      count: rapidAccelCount,
      subLabel: rapidAccelCount > 0 ? `${rapidAccelCount} events` : 'Smooth accel',
      icon: 'flash-outline',
      iconType: 'ion',
      iconColor: Colors.rapidAccel,
      iconBgColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3',
      countBgColor: rapidAccelCount > 0 ? '#FCE7F3' : '#ECFDF5',
      countTextColor: rapidAccelCount > 0 ? '#BE185D' : '#059669',
    },
    {
      key: 'hardBraking',
      label: 'Hard Braking',
      count: hardBrakingCount,
      subLabel: hardBrakingCount > 0 ? `${hardBrakingCount} events` : 'Gentle stops',
      icon: 'car-crash',
      iconType: 'material',
      iconColor: Colors.hardBraking,
      iconBgColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
      countBgColor: hardBrakingCount > 0 ? '#FEF3C7' : '#ECFDF5',
      countTextColor: hardBrakingCount > 0 ? '#B45309' : '#059669',
    },
    {
      key: 'harshCornering',
      label: 'Harsh Cornering',
      count: harshCorneringCount,
      subLabel: harshCorneringCount > 0 ? `${harshCorneringCount} events` : 'Smooth turns',
      icon: 'refresh-outline',
      iconType: 'ion',
      iconColor: '#9333EA',
      iconBgColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF',
      countBgColor: harshCorneringCount > 0 ? '#F3E8FF' : '#ECFDF5',
      countTextColor: harshCorneringCount > 0 ? '#7E22CE' : '#059669',
    },
  ], [speedingCount, topSpeed, distractedCount, rapidAccelCount, hardBrakingCount, harshCorneringCount, isDark, distancePrefs.unit]);

  const renderEventDetails = (type: DriverSafetyEventType) => {
    switch (type) {
      case 'speeding':
        return (
          <>
            <View style={[styles.accordionSummaryCard, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FFF1F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECDD3' }]}>
              <View style={styles.accordionIconCircle}>
                <Ionicons name="speedometer" size={24} color="#FF6B6B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accordionSummaryTitle, { color: isDark ? '#FDA4AF' : '#9F1239' }]}>
                  Speeding Log • {speedingCount} Incidents
                </Text>
                <Text style={[styles.accordionSummaryDesc, { color: isDark ? '#F43F5E' : '#881337' }]}>
                  {topSpeed > 0 ? `Max recorded speed: ${formatSpeed(topSpeed, distancePrefs.unit)}. ` : ''}
                  Monitored against road speed limit regulations in real time.
                </Text>
              </View>
            </View>

            <Text style={[styles.accordionSectionTitle, { color: colors.textMain }]}>
              Recorded Speeding Incidents ({speedingEvents.length})
            </Text>

            {speedingEvents.length === 0 ? (
              <View style={[styles.accordionEmptyState, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.tileBorder }]}>
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
                <Text style={[styles.accordionEmptyTitle, { color: colors.textMain }]}>Zero Speeding Incidents</Text>
                <Text style={[styles.accordionEmptySub, { color: colors.textMuted }]}>
                  Speed limit respected consistently across all trips this week.
                </Text>
              </View>
            ) : (
              speedingEvents.map((ev: any, idx: number) => (
                <View key={ev.id || idx} style={[styles.accordionEventCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.tileBorder }]}>
                  <View style={styles.accordionEventTop}>
                    <View style={styles.accordionSpeedPill}>
                      <Text style={styles.accordionSpeedPillText}>{formatSpeed(ev.speed, distancePrefs.unit)}</Text>
                    </View>
                    <Text style={[styles.accordionLimitText, { color: colors.textSecondary }]}>
                      Limit: {formatSpeed(ev.speedLimit || 50, distancePrefs.unit)}
                    </Text>
                    <View style={styles.accordionExcessBadge}>
                      <Text style={styles.accordionExcessBadgeText}>
                        +{ev.excessSpeed || Math.max(0, ev.speed - (ev.speedLimit || 50))} {distancePrefs.unit === 'imperial' ? 'mph' : 'km/h'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accordionLocationRow}>
                    <Feather name="map-pin" size={12} color={colors.textMuted} />
                    <Text style={[styles.accordionAddressText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {ev.address || 'Street / Highway'}
                    </Text>
                  </View>

                  <View style={styles.accordionEventFooter}>
                    <Text style={[styles.accordionTimeText, { color: colors.textMuted }]}>
                      {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        );

      case 'distracted':
        return (
          <>
            <View style={[styles.accordionSummaryCard, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#F0F9FF', borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD' }]}>
              <View style={styles.accordionIconCircle}>
                <Feather name="smartphone" size={24} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accordionSummaryTitle, { color: isDark ? '#7DD3FC' : '#0369A1' }]}>
                  Distracted Driving Log • {distractedCount} Incidents
                </Text>
                <Text style={[styles.accordionSummaryDesc, { color: isDark ? '#38BDF8' : '#0284C7' }]}>
                  Monitors phone unlocks, calls, and screen interaction events while vehicle is in motion (&gt; 15 km/h).
                </Text>
              </View>
            </View>

            <Text style={[styles.accordionSectionTitle, { color: colors.textMain }]}>
              Recorded Distractions ({distractedEvents.length})
            </Text>

            {distractedEvents.length === 0 ? (
              <View style={[styles.accordionEmptyState, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.tileBorder }]}>
                <Ionicons name="shield-checkmark" size={36} color="#10B981" />
                <Text style={[styles.accordionEmptyTitle, { color: colors.textMain }]}>100% Focused Driving</Text>
                <Text style={[styles.accordionEmptySub, { color: colors.textMuted }]}>
                  Zero screen touches or handheld phone usage detected while driving this week.
                </Text>
              </View>
            ) : (
              distractedEvents.map((ev: any, idx: number) => (
                <View key={ev.id || idx} style={[styles.accordionEventCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.tileBorder }]}>
                  <View style={styles.accordionEventTop}>
                    <View style={[styles.accordionSpeedPill, { backgroundColor: '#E0F2FE' }]}>
                      <Text style={[styles.accordionSpeedPillText, { color: '#0284C7' }]}>
                        {ev.durationSec ? `${ev.durationSec}s Screen Time` : 'Screen Interaction'}
                      </Text>
                    </View>
                    {ev.speed && (
                      <Text style={[styles.accordionLimitText, { color: colors.textSecondary }]}>
                        At {formatSpeed(ev.speed, distancePrefs.unit)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.accordionLocationRow}>
                    <Feather name="map-pin" size={12} color={colors.textMuted} />
                    <Text style={[styles.accordionAddressText, { color: colors.textSecondary }]}>
                      {ev.address || 'Road'}
                    </Text>
                  </View>

                  <Text style={[styles.accordionTimeText, { color: colors.textMuted }]}>
                    {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                  </Text>
                </View>
              ))
            )}
          </>
        );

      case 'rapidAccel':
        return (
          <>
            <View style={[styles.accordionSummaryCard, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.12)' : '#FDF2F8', borderColor: isDark ? 'rgba(236, 72, 153, 0.3)' : '#FBCFE8' }]}>
              <View style={styles.accordionIconCircle}>
                <Ionicons name="flash-outline" size={24} color="#DB2777" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accordionSummaryTitle, { color: isDark ? '#F472B6' : '#9D174D' }]}>
                  Rapid Acceleration Log • {rapidAccelCount} Incidents
                </Text>
                <Text style={[styles.accordionSummaryDesc, { color: isDark ? '#EC4899' : '#831843' }]}>
                  Detected sudden acceleration surges exceeding +18 km/h speed increase within seconds.
                </Text>
              </View>
            </View>

            <Text style={[styles.accordionSectionTitle, { color: colors.textMain }]}>
              Recorded Rapid Accelerations ({rapidAccelEvents.length})
            </Text>

            {rapidAccelEvents.length === 0 ? (
              <View style={[styles.accordionEmptyState, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.tileBorder }]}>
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
                <Text style={[styles.accordionEmptyTitle, { color: colors.textMain }]}>Smooth Acceleration</Text>
                <Text style={[styles.accordionEmptySub, { color: colors.textMuted }]}>
                  Zero sudden gas pedal surges recorded. Smooth throttle control maintained.
                </Text>
              </View>
            ) : (
              rapidAccelEvents.map((ev: any, idx: number) => (
                <View key={ev.id || idx} style={[styles.accordionEventCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.tileBorder }]}>
                  <View style={styles.accordionEventTop}>
                    <View style={[styles.accordionSpeedPill, { backgroundColor: '#FCE7F3' }]}>
                      <Text style={[styles.accordionSpeedPillText, { color: '#BE185D' }]}>
                        {ev.gForce ? `${ev.gForce} G Force` : 'Sudden Surge'}
                      </Text>
                    </View>
                    <View style={[styles.accordionExcessBadge, { backgroundColor: '#FDF2F8' }]}>
                      <Text style={[styles.accordionExcessBadgeText, { color: '#9D174D' }]}>Rapid Accel</Text>
                    </View>
                  </View>

                  <View style={styles.accordionLocationRow}>
                    <Feather name="map-pin" size={12} color={colors.textMuted} />
                    <Text style={[styles.accordionAddressText, { color: colors.textSecondary }]}>
                      {ev.address || 'Road'}
                    </Text>
                  </View>

                  <Text style={[styles.accordionTimeText, { color: colors.textMuted }]}>
                    {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                  </Text>
                </View>
              ))
            )}
          </>
        );

      case 'hardBraking':
        return (
          <>
            <View style={[styles.accordionSummaryCard, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7', borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A' }]}>
              <View style={styles.accordionIconCircle}>
                <MaterialIcons name="car-crash" size={24} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accordionSummaryTitle, { color: isDark ? '#FBBF24' : '#92400E' }]}>
                  Hard Braking Log • {hardBrakingCount} Incidents
                </Text>
                <Text style={[styles.accordionSummaryDesc, { color: isDark ? '#F59E0B' : '#78350F' }]}>
                  Detected abrupt decelerations exceeding 18 km/h reduction in seconds.
                </Text>
              </View>
            </View>

            <Text style={[styles.accordionSectionTitle, { color: colors.textMain }]}>
              Recorded Hard Brakes ({hardBrakingEvents.length})
            </Text>

            {hardBrakingEvents.length === 0 ? (
              <View style={[styles.accordionEmptyState, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.tileBorder }]}>
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
                <Text style={[styles.accordionEmptyTitle, { color: colors.textMain }]}>Gentle Braking Habits</Text>
                <Text style={[styles.accordionEmptySub, { color: colors.textMuted }]}>
                  Zero abrupt decelerations detected. Safe following distance maintained consistently.
                </Text>
              </View>
            ) : (
              hardBrakingEvents.map((ev: any, idx: number) => (
                <View key={ev.id || idx} style={[styles.accordionEventCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.tileBorder }]}>
                  <View style={styles.accordionEventTop}>
                    <View style={[styles.accordionSpeedPill, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.accordionSpeedPillText, { color: '#B45309' }]}>
                        {ev.gForce ? `${ev.gForce} G Decel` : 'Hard Brake'}
                      </Text>
                    </View>
                    {ev.speedBeforeBrake && ev.speedAfterBrake !== undefined && (
                      <Text style={[styles.accordionLimitText, { color: colors.textSecondary }]}>
                        {formatSpeed(ev.speedBeforeBrake, distancePrefs.unit)} ➔ {formatSpeed(ev.speedAfterBrake, distancePrefs.unit)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.accordionLocationRow}>
                    <Feather name="map-pin" size={12} color={colors.textMuted} />
                    <Text style={[styles.accordionAddressText, { color: colors.textSecondary }]}>
                      {ev.address || 'Intersection / Road'}
                    </Text>
                  </View>

                  <Text style={[styles.accordionTimeText, { color: colors.textMuted }]}>
                    {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                  </Text>
                </View>
              ))
            )}
          </>
        );

      case 'harshCornering':
        return (
          <>
            <View style={[styles.accordionSummaryCard, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : '#F3E8FF', borderColor: isDark ? 'rgba(168, 85, 247, 0.3)' : '#E9D5FF' }]}>
              <View style={styles.accordionIconCircle}>
                <Ionicons name="refresh-outline" size={24} color="#9333EA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accordionSummaryTitle, { color: isDark ? '#C084FC' : '#6B21A8' }]}>
                  Harsh Cornering Log • {harshCorneringCount} Incidents
                </Text>
                <Text style={[styles.accordionSummaryDesc, { color: isDark ? '#A855F7' : '#581C87' }]}>
                  Detected aggressive turns and sharp lateral curvature forces while travelling at speed.
                </Text>
              </View>
            </View>

            <Text style={[styles.accordionSectionTitle, { color: colors.textMain }]}>
              Recorded Harsh Corners ({harshCorneringEvents.length})
            </Text>

            {harshCorneringEvents.length === 0 ? (
              <View style={[styles.accordionEmptyState, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.tileBorder }]}>
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
                <Text style={[styles.accordionEmptyTitle, { color: colors.textMain }]}>Smooth Turning Habits</Text>
                <Text style={[styles.accordionEmptySub, { color: colors.textMuted }]}>
                  Zero aggressive turns recorded. Safe cornering speeds and turn radii maintained.
                </Text>
              </View>
            ) : (
              harshCorneringEvents.map((ev: any, idx: number) => (
                <View key={ev.id || idx} style={[styles.accordionEventCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.tileBorder }]}>
                  <View style={styles.accordionEventTop}>
                    <View style={[styles.accordionSpeedPill, { backgroundColor: '#F3E8FF' }]}>
                      <Text style={[styles.accordionSpeedPillText, { color: '#9333EA' }]}>
                        {ev.lateralG ? `${ev.lateralG.toFixed(2)} G Lateral` : 'Sharp Corner'}
                      </Text>
                    </View>
                    {ev.headingChange && (
                      <Text style={[styles.accordionLimitText, { color: colors.textSecondary }]}>
                        {Math.round(ev.headingChange)}° Turn {ev.speed ? `@ ${formatSpeed(ev.speed, distancePrefs.unit)}` : ''}
                      </Text>
                    )}
                  </View>

                  <View style={styles.accordionLocationRow}>
                    <Feather name="map-pin" size={12} color={colors.textMuted} />
                    <Text style={[styles.accordionAddressText, { color: colors.textSecondary }]}>
                      {ev.address || 'Turn / Curve'}
                    </Text>
                  </View>

                  <Text style={[styles.accordionTimeText, { color: colors.textMuted }]}>
                    {formatEventDateTime(ev.timestamp, ev.timeFormatted)}
                  </Text>
                </View>
              ))
            )}
          </>
        );

      default:
        return null;
    }
  };

  // Real ranked drivers list for the leaderboard
  const displayDrivers = useMemo(() => {
    if (leaderboard && leaderboard.length > 0) {
      return leaderboard.map((item) => {
        const liveMember = members.find((m) => m.id === item.userId);
        return {
          id: item.userId,
          userId: item.userId,
          fullName: item.fullName || liveMember?.fullName || 'Driver',
          avatarUrl: item.avatarUrl || liveMember?.avatarUrl,
          rank: item.rank,
          weeklyScore: item.weeklyScore,
          speed: liveMember?.speed,
          isMoving: liveMember?.isMoving,
          isStationary: liveMember?.isStationary,
          activityType: liveMember?.activityType,
        };
      });
    }
    return members.map((m, idx) => ({
      id: m.id,
      userId: m.id,
      fullName: m.fullName,
      avatarUrl: m.avatarUrl,
      rank: idx + 1,
      weeklyScore: 100,
      speed: m.speed,
      isMoving: m.isMoving,
      isStationary: m.isStationary,
      activityType: m.activityType,
    }));
  }, [leaderboard, members]);

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return '#EAB308'; // Gold #1
    if (rank === 2) return '#94A3B8'; // Silver #2
    if (rank === 3) return '#F97316'; // Bronze #3
    return colors.textMuted;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 75) return colors.primary;
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const resolveTargetDriver = (): MemberData => {
    return selfMember;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: headerPaddingTop,
            backgroundColor: colors.card,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.textMain }]}>Driving Safety</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Driving scores, weekly safety reports & route history
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 120) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDrivingData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Driving Score Hero Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setModalMember({ id: currentUserId, name: selfMemberName });
            setModalMemberReport(selfDriverReport);
            setShowWeeklyReport(true);
          }}
          style={[styles.heroCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
        >
          <View style={[styles.heroScoreCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF', borderColor: getScoreColor(familyScore) }]}>
            <Text style={[styles.heroScoreNumber, { color: getScoreColor(familyScore) }]}>{familyScore}</Text>
            <Text style={[styles.heroScoreMax, { color: colors.textMuted }]}>/100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroCardTitle, { color: colors.textMain }]} numberOfLines={1}>
              {selfMemberName}'s Driving Score
            </Text>
            <Text style={[styles.heroCardSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {familyScore >= 90
                ? 'Safe driving performance • Clean habits'
                : 'Good driving • Minor speed or accel events'}
            </Text>
            <View style={styles.statusTag}>
              <Ionicons name="shield-checkmark" size={11} color="#10B981" />
              <Text style={styles.statusTagText}>CRASH PROTECTION ACTIVE</Text>
            </View>
          </View>
          <View style={[styles.heroActionPill, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#F5F3FF' }]}>
            <Text style={[styles.heroActionPillText, { color: colors.primary }]}>Report</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Section 1: Driving Safety Events Accordion */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>DRIVING SAFETY EVENTS</Text>

        <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
          {safetyEventItems.map((item, idx) => {
            const isExpanded = selectedSafetyEvent === item.key;
            const isLast = idx === safetyEventItems.length - 1;

            return (
              <View key={item.key}>
                {/* Accordion Row Header */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedSafetyEvent((prev) => (prev === item.key ? null : item.key))}
                  style={[
                    styles.menuRow,
                    {
                      borderBottomColor: colors.divider,
                      borderBottomWidth: (!isExpanded && !isLast) ? 1 : 0,
                      backgroundColor: isExpanded ? (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)') : 'transparent',
                    },
                  ]}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: item.iconBgColor }]}>
                    {item.iconType === 'feather' ? (
                      <Feather name={item.icon} size={18} color={item.iconColor} />
                    ) : item.iconType === 'material' ? (
                      <MaterialIcons name={item.icon} size={18} color={item.iconColor} />
                    ) : (
                      <Ionicons name={item.icon} size={18} color={item.iconColor} />
                    )}
                  </View>
                  <View style={styles.menuTextWrap}>
                    <Text style={[styles.menuTitle, { color: colors.textMain }]}>{item.label}</Text>
                    <Text style={[styles.menuSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.subLabel}
                    </Text>
                  </View>
                  <View style={[styles.badgeStatus, { backgroundColor: item.countBgColor }]}>
                    <Text style={[styles.badgeStatusText, { color: item.countTextColor }]}>
                      {item.count > 0 ? `${item.count} LOGS` : '0 LOGS'}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={isExpanded ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>

                {/* Inline Expanded Content */}
                {isExpanded && (
                  <View
                    style={[
                      styles.accordionItemContent,
                      !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                    ]}
                  >
                    {renderEventDetails(item.key)}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Section 2: Circle Drivers Leaderboard */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: colors.textMuted, marginTop: 0, marginBottom: 0 }]}>
            CIRCLE DRIVERS LEADERBOARD
          </Text>
          {loadingLeaderboard && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>Syncing...</Text>
            </View>
          )}
        </View>

        <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
          {displayDrivers.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={28} color="#94A3B8" />
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>No circle members</Text>
            </View>
          ) : (
            displayDrivers.map((driver, idx) => (
              <TouchableOpacity
                key={driver.userId || driver.id}
                activeOpacity={0.75}
                onPress={() => handleOpenMemberReport(driver)}
                style={[
                  styles.menuRow,
                  { borderBottomColor: colors.divider },
                  idx === displayDrivers.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.rankBadgeContainer, { backgroundColor: idx < 3 ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent' }]}>
                  <Text style={[styles.rankText, { color: getRankBadgeColor(driver.rank), fontWeight: idx < 3 ? '900' : '700' }]}>
                    #{driver.rank}
                  </Text>
                </View>
                <Avatar name={driver.fullName} avatarUrl={driver.avatarUrl} size={36} />
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>
                    {driver.fullName.replace(/\s*\(You\)/gi, '').trim()} {driver.userId === currentUserId ? '(You)' : ''}
                  </Text>
                  {(() => {
                    const isMoving = driver.isMoving || ((driver.speed || 0) >= 1.8 && !driver.isStationary);
                    const activity = (isMoving || (driver.activityType && driver.activityType !== 'stationary'))
                      ? getMovementActivity(driver.speed, driver.isStationary, driver.activityType)
                      : null;
                    if (activity) {
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <AnimatedActivityEmoji activity={activity} size={11} />
                          <Text style={[styles.menuSub, { color: activity.color, fontWeight: '700' }]}>
                            {activity.label} {formatSpeed(driver.speed || 0, distancePrefs.unit)}
                          </Text>
                        </View>
                      );
                    }
                    return (
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                        Safe Driver
                      </Text>
                    );
                  })()}
                </View>
                <View style={[styles.driverScoreBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: colors.divider }]}>
                  <Text style={[styles.driverScoreNumber, { color: getScoreColor(driver.weeklyScore) }]}>
                    {driver.weeklyScore}
                  </Text>
                  <Text style={styles.driverScoreLabel}>Score</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Section 3: Recent Drives & Routes */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: colors.textMuted, marginTop: 0, marginBottom: 0 }]}>
            RECENT DRIVES & ROUTES
          </Text>
          {trips.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setModalMember({ id: currentUserId, name: selfMemberName });
                setModalMemberReport(selfDriverReport);
                setShowWeeklyReport(true);
              }}
            >
              <Text style={[styles.sectionActionText, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingSelfReport ? (
          <View style={{ paddingVertical: 10 }}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <LoadingSpinner size="small" message="Loading recorded trips..." />
            </View>
            <DriveCardSkeleton count={2} />
          </View>
        ) : trips.length === 0 ? (
          <View style={[styles.emptyTripsCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
            <Ionicons name="car-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTripsTitle, { color: colors.textMain }]}>No Recorded Drives This Week</Text>
            <Text style={[styles.emptyTripsSub, { color: colors.textMuted }]}>
              Trips and drive paths will automatically be captured when circle members travel above {distancePrefs.unit === 'imperial' ? '10 mph' : '15 km/h'}.
            </Text>
          </View>
        ) : (
          trips.slice(0, 3).map((trip: any, idx: number) => {
            const distStr = distancePrefs.unit === 'imperial'
              ? `${(trip.distanceKm * 0.621371).toFixed(1)} mi`
              : `${trip.distanceKm} km`;
            const topSpeedStr = formatSpeed(trip.topSpeedKm, distancePrefs.unit);

            return (
              <View key={trip.id || idx} style={[styles.tripCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                <View style={styles.tripTopRow}>
                  <View style={styles.tripDriver}>
                    <Avatar name={selfMemberName} size={28} />
                    <Text style={[styles.tripDriverName, { color: colors.textMain }]}>
                      {selfMemberName} • {formatTripDayLabel(trip.startTimestamp || trip.startTimeRaw, trip.dayLabel)}
                    </Text>
                  </View>
                  <Text style={[styles.tripDuration, { color: colors.textMuted }]}>
                    {formatTripTimeRange(trip.startTimestamp || trip.startTimeRaw, trip.endTimestamp || trip.endTimeRaw, trip.startTime, trip.endTime)}
                  </Text>
                </View>

                <View style={styles.tripStatsRow}>
                  <Text style={[styles.tripStats, { color: colors.textSecondary }]}>
                    {distStr} • {trip.durationMins} mins • Top: {topSpeedStr}
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
            );
          })
        )}
      </ScrollView>

    {/* Modals */}
    <WeeklyDriveReportModal
      visible={showWeeklyReport}
      memberName={modalMember?.name || selfMemberName}
      reportData={modalMember?.id === currentUserId ? selfDriverReport : modalMemberReport}
      loading={loadingModalReport}
      onClose={() => {
        setShowWeeklyReport(false);
        setModalMember(null);
        setModalMemberReport(null);
      }}
      onReplayTrip={onReplayTripOnMap}
    />
  </View>
);
}); // end React.memo

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 18,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroScoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScoreNumber: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  heroScoreMax: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
  },
  heroCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  heroCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  heroActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  heroActionPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 14,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSub: {
    fontSize: 11,
    marginTop: 2,
  },
  badgeStatus: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  badgeStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  accordionItemContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
  },
  rankBadgeContainer: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  driverScoreBadge: {
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 44,
  },
  driverScoreNumber: {
    fontSize: 14,
    fontWeight: '900',
  },
  driverScoreLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tripCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
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
  },
  tripDuration: {
    fontSize: 11,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  replayButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  emptyTripsCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyTripsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyTripsSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  accordionSummaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  accordionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  accordionSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 2,
  },
  accordionSummaryDesc: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  accordionSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  accordionEmptyState: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  accordionEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  accordionEmptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  accordionEventCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  accordionEventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  accordionSpeedPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  accordionSpeedPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  accordionLimitText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accordionExcessBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  accordionExcessBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  accordionLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  accordionAddressText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  accordionEventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accordionTimeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
