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
  Animated,
  PanResponder,
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
import { SafetyDebugModal } from '../components/modals/SafetyDebugModal';
import { authService } from '../services/AuthService';
import { syncService } from '../services/SyncService';
import { DriveCardSkeleton } from '../components/common/Skeleton';
import { LoadingSpinner } from '../components/common/Loader';
import { navigationService } from '../services/NavigationService';
import { getMovementActivity } from '../models/MovementActivity';
import { AnimatedActivityEmoji } from '../components/common/AnimatedActivityEmoji';
import { formatTripDayLabel, formatTripTimeRange } from '../utils/dateUtils';
import { FloatingMapActionsRow } from '../components/FloatingMapActionsRow';

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
  const [showSafetyDebug, setShowSafetyDebug] = useState(false);
  const [selectedSafetyEvent, setSelectedSafetyEvent] = useState<DriverSafetyEventType | null>(null);

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

  // Safe area metrics for 3-stop-point drawer layout
  const insets = useSafeAreaInsets();
  const topSafe = Math.max(
    insets.top || 0,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44
  );
  const bottomTabBarHeight = 60 + (insets.bottom || 0);
  const availableViewportHeight = SCREEN_HEIGHT - bottomTabBarHeight;

  const dynamicMaxExpandedHeight = useMemo(() => {
    return Math.min(
      Math.round(availableViewportHeight * 0.94),
      availableViewportHeight - (topSafe + 16)
    );
  }, [availableViewportHeight, topSafe]);

  const COLLAPSED_TRANSLATE_Y = dynamicMaxExpandedHeight - DRAWER_MIN_HEIGHT;
  const MID_TRANSLATE_Y = dynamicMaxExpandedHeight - DRAWER_MID_HEIGHT;
  const EXPANDED_TRANSLATE_Y = 0;
  const HIDDEN_TRANSLATE_Y = dynamicMaxExpandedHeight + 40;

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentSnapRef = useRef<'min' | 'mid' | 'max' | 'hidden'>('min');
  const translateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const startDragTranslateY = useRef<number>(COLLAPSED_TRANSLATE_Y);

  const animateToTranslateY = (targetY: number, withFlick = false, velocity = 0) => {
    const isAtTop = targetY === EXPANDED_TRANSLATE_Y;
    setIsExpanded(isAtTop);
    onExpandChangeRef.current?.(isAtTop);
    if (targetY === EXPANDED_TRANSLATE_Y) {
      currentSnapRef.current = 'max';
    } else if (targetY === MID_TRANSLATE_Y) {
      currentSnapRef.current = 'mid';
    } else if (targetY === HIDDEN_TRANSLATE_Y) {
      currentSnapRef.current = 'hidden';
    } else {
      currentSnapRef.current = 'min';
    }
    Animated.spring(translateY, {
      toValue: targetY,
      tension: 65,
      friction: 11,
      velocity: velocity ? -velocity : 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  // Sync expand state on mount and cleanup
  useEffect(() => {
    onExpandChangeRef.current?.(false);
    return () => {
      onExpandChangeRef.current?.(false);
    };
  }, []);

  // Pull up drawer whenever tab button is tapped from bottom bar:
  // If drawer is hidden completely at bottom or collapsed, open directly to 2nd stop (MID)
  useEffect(() => {
    if (pullUpTrigger && pullUpTrigger > 0) {
      currentSnapRef.current = 'mid';
      animateToTranslateY(MID_TRANSLATE_Y, true);
    }
  }, [pullUpTrigger]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderGrant: () => {
        startDragTranslateY.current = (translateY as any)._value ?? (
          currentSnapRef.current === 'max'
            ? EXPANDED_TRANSLATE_Y
            : currentSnapRef.current === 'mid'
            ? MID_TRANSLATE_Y
            : currentSnapRef.current === 'min'
            ? COLLAPSED_TRANSLATE_Y
            : HIDDEN_TRANSLATE_Y
        );
      },
      onPanResponderMove: (_, gesture) => {
        const targetTranslateY = startDragTranslateY.current + gesture.dy;
        const clamped = Math.max(
          EXPANDED_TRANSLATE_Y - 8,
          Math.min(HIDDEN_TRANSLATE_Y + 12, targetTranslateY)
        );
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, gesture) => {
        const midpointMaxMid = (EXPANDED_TRANSLATE_Y + MID_TRANSLATE_Y) / 2;
        const midpointMidMin = (MID_TRANSLATE_Y + COLLAPSED_TRANSLATE_Y) / 2;
        const midpointMinHidden = (COLLAPSED_TRANSLATE_Y + HIDDEN_TRANSLATE_Y) / 2;
        const currentTranslateY = startDragTranslateY.current + gesture.dy;

        let targetSnap: 'min' | 'mid' | 'max' | 'hidden' = 'min';

        if (gesture.vy < -0.35) {
          // Flick / Swipe UP
          if (gesture.vy < -1.0 || gesture.dy < -220) {
            targetSnap = 'max';
          } else if (currentSnapRef.current === 'hidden') {
            targetSnap = 'min';
          } else if (currentSnapRef.current === 'min') {
            targetSnap = 'mid';
          } else {
            targetSnap = 'max';
          }
        } else if (gesture.vy > 0.35) {
          // Flick / Swipe DOWN
          if (gesture.vy > 1.2 || gesture.dy > 280) {
            targetSnap = 'hidden';
          } else if (currentSnapRef.current === 'max') {
            targetSnap = 'mid';
          } else if (currentSnapRef.current === 'mid') {
            targetSnap = 'min';
          } else {
            targetSnap = 'hidden';
          }
        } else {
          // Position-based snap to nearest stop point
          if (currentTranslateY <= midpointMaxMid) {
            targetSnap = 'max';
          } else if (currentTranslateY <= midpointMidMin) {
            targetSnap = 'mid';
          } else if (currentTranslateY <= midpointMinHidden) {
            targetSnap = 'min';
          } else {
            targetSnap = 'hidden';
          }
        }

        currentSnapRef.current = targetSnap;
        const targetY =
          targetSnap === 'max'
            ? EXPANDED_TRANSLATE_Y
            : targetSnap === 'mid'
            ? MID_TRANSLATE_Y
            : targetSnap === 'min'
            ? COLLAPSED_TRANSLATE_Y
            : HIDDEN_TRANSLATE_Y;

        animateToTranslateY(targetY, targetSnap !== 'min', gesture.vy);
      },
    })
  ).current;

  const toggleSheet = () => {
    if (currentSnapRef.current === 'hidden') {
      currentSnapRef.current = 'mid';
      animateToTranslateY(MID_TRANSLATE_Y, true);
    } else if (currentSnapRef.current === 'min') {
      currentSnapRef.current = 'mid';
      animateToTranslateY(MID_TRANSLATE_Y, true);
    } else if (currentSnapRef.current === 'mid') {
      currentSnapRef.current = 'max';
      animateToTranslateY(EXPANDED_TRANSLATE_Y, true);
    } else {
      currentSnapRef.current = 'min';
      animateToTranslateY(COLLAPSED_TRANSLATE_Y, false);
    }
  };

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
      if (showSafetyDebug) {
        setShowSafetyDebug(false);
        return true;
      }
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
  }, [showWeeklyReport, showSpeedingModal, selectedSafetyEvent, showSafetyDebug]);

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
  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);

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
    <View style={styles.outerWrapper} pointerEvents="box-none">
      <FloatingMapActionsRow
        translateY={translateY}
        dynamicMaxExpandedHeight={dynamicMaxExpandedHeight}
        collapsedHeight={DRAWER_MIN_HEIGHT}
        midTranslateY={MID_TRANSLATE_Y}
        expandedTranslateY={EXPANDED_TRANSLATE_Y}
        hiddenTranslateY={HIDDEN_TRANSLATE_Y}
        isExpanded={isExpanded}
        isSelfInBubble={isSelfInBubble}
        onCheckInTapped={onCheckInTapped}
        onGhostModeTapped={onGhostModeTapped}
        onToggleMapLayers={onToggleMapLayers}
        onGoToMyLocation={onGoToMyLocation}
        onSOSTapped={onSOSTapped}
      />
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: dynamicMaxExpandedHeight,
            transform: [{ translateY }],
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
          webGlassCard,
        ]}
      >
        {/* FIXED TOP HEADER: Grab Handle Bar, Title, Status & Actions */}
        <View
          {...panResponder.panHandlers}
          style={[
            styles.sketchFixedHeader,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.divider,
            },
          ]}
        >
          {/* Centered Grab Handle Bar (Tap to toggle min/mid/max; drag to move) */}
          <View style={styles.sketchGrabArea}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleSheet}
              style={styles.handleTouch}
              accessibilityLabel="Toggle driving sheet height"
            >
              <View
                style={[
                  styles.grabBar,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1' },
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Fixed Top Bar */}
          <View style={styles.sketchFixedTopBar}>
            <View style={styles.sketchHeaderLeftCol}>
              <Text style={[styles.sketchNameText, { color: colors.textMain }]} numberOfLines={1}>
                Driving Safety
              </Text>
              <View style={styles.sketchSinceAndMetaRow}>
                <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                  <Ionicons name="shield-checkmark" size={10} color={isDark ? '#34D399' : '#10B981'} />
                  <Text style={[styles.statusPillText, { color: isDark ? '#34D399' : '#059669' }]}>
                    ACTIVE
                  </Text>
                </View>
                <View
                  style={[
                    styles.bentoScoreBadge,
                    {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF',
                      borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                    },
                  ]}
                >
                  <Text style={[styles.bentoScoreText, { color: colors.primary }]}>
                    Score: {familyScore}/100
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                onPress={() => setShowSafetyDebug(true)}
                style={[styles.headerActionBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
                activeOpacity={0.75}
              >
                <Ionicons name="construct-outline" size={13} color={colors.primary} />
                <Text style={[styles.headerActionBtnText, { color: colors.primary }]}>Debug</Text>
              </TouchableOpacity>

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
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + insets.bottom },
          ]}
          onScrollEndDrag={(e) => {
            if (e.nativeEvent.contentOffset.y < -35) {
              if (currentSnapRef.current === 'max') {
                currentSnapRef.current = 'mid';
                animateToTranslateY(MID_TRANSLATE_Y, true);
              } else if (currentSnapRef.current === 'mid') {
                currentSnapRef.current = 'min';
                animateToTranslateY(COLLAPSED_TRANSLATE_Y, false);
              } else if (currentSnapRef.current === 'min') {
                currentSnapRef.current = 'hidden';
                animateToTranslateY(HIDDEN_TRANSLATE_Y, false);
              }
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDrivingData(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
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
            <Text style={[styles.scoreTitle, { color: colors.textMain }]}>{selfMemberName}'s Safety Score</Text>
            <Text style={[styles.scoreDesc, { color: colors.textSecondary }]}>
              {familyScore >= 90
                ? 'Safe driving performance. No collision detected, clean driving habits.'
                : 'Good performance with minor speed or acceleration events.'}
            </Text>
            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                <Ionicons name="shield-checkmark" size={12} color="#D97706" />
                <Text style={[styles.heroBadgeText, { color: '#D97706' }]}>Crash Protection (Beta - v1.1)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Driving Safety Events */}
        <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Driving Safety Events</Text>

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
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedSafetyEvent('speeding');
                }}
                style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}
                activeOpacity={0.7}
              >
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>View Log</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{speedingCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Speeding Events</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{topSpeed > 0 ? `Top: ${topSpeed} km/h` : 'Zero speeding'}</Text>
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
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedSafetyEvent('distracted');
                }}
                style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE' }]}
                activeOpacity={0.7}
              >
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>View Log</Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedSafetyEvent('rapidAccel');
                }}
                style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3' }]}
                activeOpacity={0.7}
              >
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>View Log</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{rapidAccelCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Rapid Accel</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{rapidAccelCount > 0 ? `${rapidAccelCount} events` : 'Smooth acceleration'}</Text>
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
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedSafetyEvent('hardBraking');
                }}
                style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}
                activeOpacity={0.7}
              >
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>View Log</Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedSafetyEvent('harshCornering');
                }}
                style={[styles.eventPillLogBtn, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF' }]}
                activeOpacity={0.7}
              >
                <Feather name="list" size={10} color={colors.primary} />
                <Text style={[styles.eventPillLogText, { color: colors.primary }]}>View Log</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.insightCount, { color: colors.textMain }]}>{harshCorneringCount}</Text>
            <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Harsh Cornering</Text>
            <Text style={[styles.insightSub, { color: colors.textMuted }]}>{harshCorneringCount > 0 ? `${harshCorneringCount} events` : 'Smooth turns'}</Text>
          </TouchableOpacity>
        </View>

        {/* Driving Safety Events Telemetry Log Strip */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setSelectedSafetyEvent('speeding')}
          style={[styles.underEventsLogStrip, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
        >
          <View style={[styles.stripIconWrap, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}>
            <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stripTitle, { color: colors.textMain }]}>Driver Safety Events Telemetry Log</Text>
            <Text style={[styles.stripSub, { color: colors.textMuted }]}>
              View verified telemetry logs for Speeding, Distracted, Rapid Accel & Braking
            </Text>
          </View>
          <View style={[styles.stripActionPill, { backgroundColor: colors.primary }]}>
            <Text style={styles.stripActionText}>View Log</Text>
            <Feather name="chevron-right" size={13} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Family Driver Leaderboard */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
          <Text style={[styles.sectionTitle, { color: colors.textMain, marginTop: 0, marginBottom: 0 }]}>
            Circle Drivers Leaderboard
          </Text>
          {loadingLeaderboard && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>Syncing...</Text>
            </View>
          )}
        </View>

        <View style={[styles.leaderboardCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, webGlassCard]}>
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
                  styles.driverRow,
                  { borderBottomColor: colors.divider },
                  idx === displayDrivers.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.rankBadgeContainer, { backgroundColor: idx < 3 ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent' }]}>
                  <Text style={[styles.rankText, { color: getRankBadgeColor(driver.rank), fontWeight: idx < 3 ? '900' : '700' }]}>
                    #{driver.rank}
                  </Text>
                </View>
                <Avatar name={driver.fullName} avatarUrl={driver.avatarUrl} size={40} />
                <View style={styles.driverInfo}>
                  <Text style={[styles.driverName, { color: colors.textMain }]}>
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
                          <Text style={[styles.driverMetrics, { color: activity.color, fontWeight: '700' }]}>
                            {activity.label} {Math.round(driver.speed || 0)} km/h
                          </Text>
                        </View>
                      );
                    }
                    return (
                      <Text style={[styles.driverMetrics, { color: colors.textMuted }]}>
                        Safe Driver
                      </Text>
                    );
                  })()}
                </View>
                <View style={[styles.driverScoreBadge, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                  <Text style={[styles.driverScoreNumber, { color: getScoreColor(driver.weeklyScore) }]}>
                    {driver.weeklyScore}
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
            <TouchableOpacity
              onPress={() => {
                setModalMember({ id: currentUserId, name: selfMemberName });
                setModalMemberReport(selfDriverReport);
                setShowWeeklyReport(true);
              }}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
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
              Trips and drive paths will automatically be captured when circle members travel above 15 km/h.
            </Text>
          </View>
        ) : (
          trips.slice(0, 3).map((trip: any, idx: number) => (
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
    </Animated.View>

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

    <SafetyDebugModal
      visible={showSafetyDebug}
      onClose={() => setShowSafetyDebug(false)}
    />
  </View>
);
}); // end React.memo

const styles = StyleSheet.create({
  outerWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 120,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    overflow: 'visible',
  },
  sketchFixedHeader: {
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomWidth: 1,
  },
  sketchGrabArea: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleTouch: {
    width: 140,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
  },
  sketchFixedTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sketchHeaderLeftCol: {
    flex: 1,
    justifyContent: 'center',
  },
  sketchNameText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  sketchSinceAndMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bentoScoreBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  bentoScoreText: {
    fontSize: 11,
    fontWeight: '700',
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
  statusPill: {
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
  statusPillText: {
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerLogBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
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
  insightsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  activityLogBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  insightCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventPillLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eventPillLogText: {
    fontSize: 10,
    fontWeight: '700',
  },
  underEventsLogStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 22,
  },
  stripIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stripSub: {
    fontSize: 11,
    marginTop: 1,
  },
  stripActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stripActionText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
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
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 22,
    width: '100%',
  },
  insightCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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
  rankBadgeContainer: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
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
