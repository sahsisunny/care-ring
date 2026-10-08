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
import { SpeedingModal } from '../components/modals/SpeedingModal';
import { DriverSafetyEventModal, DriverSafetyEventType } from '../components/modals/DriverSafetyEventModal';
import { authService } from '../services/AuthService';
import { DriveCardSkeleton } from '../components/common/Skeleton';
import { LoadingSpinner } from '../components/common/Loader';
import { navigationService } from '../services/NavigationService';
import { getMovementActivity } from '../models/MovementActivity';
import { AnimatedActivityEmoji } from '../components/common/AnimatedActivityEmoji';
import { formatTripDayLabel, formatTripTimeRange } from '../utils/dateUtils';
import { distancePreferencesService } from '../services/DistancePreferencesService';
import { formatSpeed } from '../utils/geoMath';

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
  const [showSpeedingModal, setShowSpeedingModal] = useState(false);
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
      if (showSpeedingModal) {
        setShowSpeedingModal(false);
        return true;
      }
      return false;
    };

    const unregister = navigationService.registerBackHandler('driving_tab', handleDrivingBack, 80);
    return () => unregister();
  }, [showWeeklyReport, showSpeedingModal, selectedSafetyEvent]);

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

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => {
              setModalMember({ id: currentUserId, name: selfMemberName });
              setModalMemberReport(selfDriverReport);
              setShowWeeklyReport(true);
            }}
            style={[styles.headerActionBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
            activeOpacity={0.75}
          >
            <Feather name="file-text" size={13} color={colors.primary} />
            <Text style={[styles.headerActionBtnText, { color: colors.primary }]}>Report</Text>
          </TouchableOpacity>
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

        {/* Section 1: Driving Safety Events */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>DRIVING SAFETY EVENTS</Text>

        <View style={styles.insightsGrid}>
          {/* 1. Speeding Events */}
          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setSelectedSafetyEvent('speeding')}
          >
            <View style={styles.insightCardHeaderRow}>
              <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                <Ionicons name="speedometer-outline" size={20} color={Colors.speeding} />
              </View>
              <View style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}>
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>Log</Text>
              </View>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{speedingCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Speeding Events</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{topSpeed > 0 ? `Top: ${formatSpeed(topSpeed, distancePrefs.unit)}` : 'Zero speeding'}</Text>
          </TouchableOpacity>

          {/* 2. Distracted Driving */}
          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setSelectedSafetyEvent('distracted')}
          >
            <View style={styles.insightCardHeaderRow}>
              <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE' }]}>
                <Feather name="smartphone" size={20} color={Colors.distracted} />
              </View>
              <View style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE' }]}>
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>Log</Text>
              </View>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{distractedCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Distracted Drive</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{distractedCount > 0 ? `${distractedCount} events` : '0 screen use'}</Text>
          </TouchableOpacity>

          {/* 3. Rapid Acceleration */}
          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setSelectedSafetyEvent('rapidAccel')}
          >
            <View style={styles.insightCardHeaderRow}>
              <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3' }]}>
                <Ionicons name="flash-outline" size={20} color={Colors.rapidAccel} />
              </View>
              <View style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3' }]}>
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>Log</Text>
              </View>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{rapidAccelCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Rapid Accel</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{rapidAccelCount > 0 ? `${rapidAccelCount} events` : 'Smooth accel'}</Text>
          </TouchableOpacity>

          {/* 4. Hard Braking */}
          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setSelectedSafetyEvent('hardBraking')}
          >
            <View style={styles.insightCardHeaderRow}>
              <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                <MaterialIcons name="car-crash" size={20} color={Colors.hardBraking} />
              </View>
              <View style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>Log</Text>
              </View>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{hardBrakingCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Hard Braking</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{hardBrakingCount > 0 ? `${hardBrakingCount} events` : 'Gentle stops'}</Text>
          </TouchableOpacity>

          {/* 5. Harsh Cornering */}
          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            activeOpacity={0.8}
            onPress={() => setSelectedSafetyEvent('harshCornering')}
          >
            <View style={styles.insightCardHeaderRow}>
              <View style={[styles.insightIcon, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF' }]}>
                <Ionicons name="refresh-outline" size={20} color="#9333EA" />
              </View>
              <View style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF' }]}>
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>Log</Text>
              </View>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{harshCorneringCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Harsh Cornering</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{harshCorneringCount > 0 ? `${harshCorneringCount} events` : 'Smooth turns'}</Text>
          </TouchableOpacity>
        </View>

        {/* Telemetry Log Strip Card */}
        <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, marginTop: 2 }, webGlassTile]}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => setSelectedSafetyEvent('speeding')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' }]}>
              <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: colors.textMain }]}>Driver Safety Events Telemetry Log</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Verified logs for speeding, phone distraction & braking
              </Text>
            </View>
            <View style={styles.badgeStatus}>
              <Text style={styles.badgeStatusText}>5 SENSORS</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
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

    <SpeedingModal
      visible={showSpeedingModal}
      speedingData={selfDriverReport?.speeding}
      onClose={() => setShowSpeedingModal(false)}
      onViewLog={() => onViewTimeline?.(resolveTargetDriver(), 'drives')}
    />

    <DriverSafetyEventModal
      visible={selectedSafetyEvent !== null}
      initialEventType={selectedSafetyEvent || 'speeding'}
      onClose={() => setSelectedSafetyEvent(null)}
      driverReport={selfDriverReport}
      harshCorneringData={selfDriverReport?.harshCornering}
      memberName={selfMemberName}
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
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 10,
    width: '100%',
  },
  insightCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  insightCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  insightIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventPillLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eventPillLogText: {
    fontSize: 10,
    fontWeight: '700',
  },
  insightCount: {
    fontSize: 22,
    fontWeight: '900',
  },
  insightLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  insightSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
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
});
