import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  Linking,
  Alert,
  Platform,
  StatusBar,
  Image,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, Feather } from '@expo/vector-icons';
import { MemberData, formatSinceTime, formatLastSeenTime, isMemberMoving } from '../models/Member';
import { safeParseDate } from '../utils/dateUtils';
import { Circle } from '../models/Circle';
import { Avatar } from './Avatar';
import {
  calculateDistanceMeters,
  openNavigationDirections,
  getMemberDistanceDisplay,
  fetchMemberDistanceDisplay,
  DistanceDisplayResult,
  NEARBY_THRESHOLD_METERS,
  formatSpeed,
  formatCompactDistance,
} from '../utils/distance';
import {
  distancePreferencesService,
  DistancePreferences,
  TRANSPORT_MODES,
} from '../services/DistancePreferencesService';
import { routingService } from '../services/RoutingService';
import { locationSearchService } from '../services/LocationSearchService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle, getWebGlassPillStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { SetNicknameModal } from './modals/SetNicknameModal';
import { NicknameService } from '../services/NicknameService';
import { MemberCardSkeleton } from './common/Skeleton';
import { FloatingMapActionsRow } from './FloatingMapActionsRow';
import { getMovementActivity, MovementActivityInfo } from '../models/MovementActivity';
import { AnimatedActivityEmoji } from './common/AnimatedActivityEmoji';
import { hapticService } from '../services/HapticService';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_MIN_HEIGHT = 90;
const DRAWER_MID_HEIGHT = 310;
const MIN_COLLAPSED_HEIGHT = DRAWER_MIN_HEIGHT;
const MAX_EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.85, SCREEN_HEIGHT - 90);

const COLLAPSED_HEIGHT = MIN_COLLAPSED_HEIGHT;
const EXPANDED_HEIGHT = MAX_EXPANDED_HEIGHT;
const MEMBER_DETAIL_MIN_HEIGHT = Math.round(SCREEN_HEIGHT * 0.48);
const MEMBER_DETAIL_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.74, SCREEN_HEIGHT - 160);

interface BottomDraggableSheetProps {
  members: MemberData[];
  savedPlaces?: any[];
  isLoadingMembers?: boolean;
  selectedMember: MemberData | null;
  selectedCircle?: Circle | null;
  currentUserId: string;
  myPosition?: { latitude: number; longitude: number; heading?: number } | null;
  onSelectMember: (member: MemberData) => void;
  onDeselectMember: () => void;
  onCenterAll: () => void;
  onGoToMyLocation: () => void;
  onToggleMapLayers?: () => void;
  onCheckInTapped?: () => void;
  onSOSTapped?: () => void;
  onAddPersonTapped?: () => void;
  onSavePlaceTapped?: (member: MemberData) => void;
  onCreateBubbleTapped?: (member: MemberData) => void;
  onPopBubble?: (member: MemberData) => void;
  onSendLiveReaction?: (member: MemberData, emoji: string, label: string) => void;
  onViewWeeklyReport?: (member: MemberData) => void;
  onViewSpeeding?: (member: MemberData) => void;
  onViewTimeline?: (member: MemberData) => void;
  onOpenChat?: () => void;
  onOpenDirectChat?: (member: MemberData) => void;
  favoriteMemberIds?: string[];
  onToggleFavorite?: (member: MemberData) => void;
  nicknames?: Record<string, string>;
  onUpdateNickname?: (memberId: string, nickname: string) => void;
  onRefreshMember?: () => void;
  onExpandChange?: (isExpanded: boolean) => void;
  collapseTrigger?: number;
  pullUpTrigger?: number;
  onCirclePress?: () => void;
}

/**
 * Clean helper returning accurate battery visual styling based on real-time state:
 * - charging: vibrant green flash with emerald tint
 * - critical (<=20%): red dead battery with rose tint
 * - moderate (21-50%): amber half battery
 * - good (>50%): full battery
 */
function getBatteryVisual(level?: number | null, isCharging?: boolean, isDark: boolean = false) {
  const safeLevel = (typeof level === 'number' && !isNaN(level)) ? Math.max(0, Math.min(100, Math.round(level))) : 100;

  if (isCharging) {
    return {
      level: safeLevel,
      icon: 'flash' as const,
      color: '#10B981',
      bgColor: isDark ? 'rgba(16, 185, 129, 0.20)' : '#ECFDF5',
      borderColor: isDark ? 'rgba(16, 185, 129, 0.40)' : '#A7F3D0',
      textColor: '#10B981',
      levelText: `${safeLevel}%`,
      isCharging: true,
    };
  }

  if (safeLevel <= 20) {
    return {
      level: safeLevel,
      icon: 'battery-dead' as const,
      color: '#EF4444',
      bgColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEF2F2',
      borderColor: isDark ? 'rgba(239, 68, 68, 0.40)' : '#FCA5A5',
      textColor: '#EF4444',
      levelText: `${safeLevel}%`,
      isCharging: false,
    };
  }

  if (safeLevel <= 50) {
    return {
      level: safeLevel,
      icon: 'battery-half' as const,
      color: '#F59E0B',
      bgColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
      borderColor: isDark ? 'rgba(245, 158, 11, 0.30)' : '#FDE68A',
      textColor: isDark ? '#FCD34D' : '#D97706',
      levelText: `${safeLevel}%`,
      isCharging: false,
    };
  }

  return {
    level: safeLevel,
    icon: 'battery-full' as const,
    color: isDark ? '#94A3B8' : '#64748B',
    bgColor: isDark ? 'rgba(30, 41, 59, 0.65)' : '#F1F5F9',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0',
    textColor: isDark ? '#E2E8F0' : '#334155',
    levelText: `${safeLevel}%`,
    isCharging: false,
  };
}

interface ResolvedMemberPlace {
  title: string;
  subtitle?: string;
  emoji: string;
  isSavedPlace: boolean;
  placeName?: string;
  isAtHome?: boolean;
  activity?: MovementActivityInfo;
}

/**
 * Resolves whether a member is currently at a set/saved place (Home, Office, etc.)
 * by geofence coordinates or address keywords, returning contextual display info.
 */
function resolveMemberPlace(
  member: MemberData,
  savedPlaces: any[] = [],
  isSelf: boolean = false
): ResolvedMemberPlace {
  // 1. Ghost Mode Active (Strictly private to the self user)
  if (isSelf && member.inBubble) {
    const compactRadius = formatCompactDistance(member.bubbleRadius || 2000, distancePreferencesService.getPreferencesSync().unit);
    return {
      title: 'Ghost Mode Active',
      subtitle: `Private Zone (~${compactRadius})`,
      emoji: '👻',
      isSavedPlace: false,
    };
  }

  const mLat = Number(member.latitude);
  const mLng = Number(member.longitude);
  const hasValidCoords = !isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0;

  // Check if near any saved place
  let nearSavedPlace: string | null = null;
  if (hasValidCoords && Array.isArray(savedPlaces) && savedPlaces.length > 0) {
    for (const place of savedPlaces) {
      const pLat = Number(place.latitude);
      const pLng = Number(place.longitude);
      if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
        const dist = calculateDistanceMeters(mLat, mLng, pLat, pLng);
        if (dist <= 350) {
          nearSavedPlace = (place.name || place.category || 'Saved Place').trim();
          break;
        }
      }
    }
  }

  let locTitle = 'On the move';
  const rawAddr = (member.resolvedAddress || '').trim();
  if (nearSavedPlace) {
    locTitle = `Near ${nearSavedPlace}`;
  } else if (rawAddr) {
    const parts = rawAddr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      locTitle = `${parts[0]}, ${parts[1]}`;
    } else {
      locTitle = rawAddr;
    }
  }

  // 1b. Staleness Rule: if the last update is older than 2 minutes, show "Last seen X ago" instead of a live mode
  const lastActiveDate = safeParseDate(member.lastLocationTime) || safeParseDate(member.lastOnlineAt);
  const now = Date.now();
  const isStale = Boolean(lastActiveDate && (now - lastActiveDate.getTime() > 120000));
  if (isStale) {
    const lastSeenStr = formatLastSeenTime(lastActiveDate);
    const staleTitle = nearSavedPlace || (rawAddr ? (rawAddr.split(',')[0] || rawAddr) : 'Last Known Location');
    return {
      title: staleTitle,
      subtitle: `Last seen ${lastSeenStr}`,
      emoji: '⏱️',
      isSavedPlace: Boolean(nearSavedPlace),
    };
  }

  // 2. In Movement (Walking, Running, Cycling, Driving, Riding, High Speed)
  // Treat sender's activity as source of truth. Never show stationary if speed > 5 km/h.
  const rawSpeed = typeof member.speed === 'number' && !isNaN(member.speed) && member.speed > 0 ? member.speed : 0;
  const hasMovingActivity = Boolean(
    member.activityType &&
    member.activityType !== 'stationary' &&
    member.activityType !== 'unknown'
  );
  const isMoving = rawSpeed >= 1.8 && (rawSpeed > 3.5 || hasMovingActivity || (member.isMoving && !member.isStationary));
  if (isMoving && rawSpeed >= 1.8) {
    const activity = getMovementActivity(member.speed, member.isStationary, member.activityType);
    const speedStr = formatSpeed(rawSpeed, distancePreferencesService.getPreferencesSync().unit);

    const isVehicle = activity.type === 'driving' || activity.type === 'riding';
    let safetySuffix = '';
    if (member.recentSafetyEvent) {
      safetySuffix = ` • ⚠️ ${member.recentSafetyEvent}`;
    } else if (isVehicle) {
      safetySuffix = ' • 🟢 Safe';
    }

    return {
      title: locTitle,
      subtitle: `${activity.label} • ${speedStr}${safetySuffix}`,
      emoji: activity.emoji,
      isSavedPlace: false,
      activity,
    };
  }

  // 3. Geofence matching against Circle Saved Places (Home, Office, etc.)
  if (hasValidCoords && Array.isArray(savedPlaces) && savedPlaces.length > 0) {
    let closestPlace: any = null;
    let minDistance = Infinity;

    for (const place of savedPlaces) {
      const pLat = Number(place.latitude);
      const pLng = Number(place.longitude);
      if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
        const distMeters = calculateDistanceMeters(mLat, mLng, pLat, pLng);
        const radius = Math.max(Number(place.radiusMeters || place.radius || place.radius_meters) || 250, 300);
        if (distMeters <= radius && distMeters < minDistance) {
          minDistance = distMeters;
          closestPlace = place;
        }
      }
    }

    if (closestPlace) {
      const rawName = (closestPlace.name || closestPlace.category || 'Home').trim();
      const lowerName = rawName.toLowerCase();
      const isHome = lowerName === 'home' || lowerName.includes('home') || closestPlace.category === 'home';

      let title = `At ${rawName}`;
      if (isHome) {
        title = 'At home';
      } else if (lowerName === 'office' || lowerName === 'work' || closestPlace.category === 'work') {
        title = 'At Office';
      } else if (lowerName.startsWith('at ')) {
        title = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      }

      let emoji = '🏠';
      if (isHome) {
        emoji = '🏠';
      } else if (closestPlace.category === 'work' || lowerName.includes('work') || lowerName.includes('office')) {
        emoji = '🏢';
      } else if (closestPlace.category === 'school' || lowerName.includes('school') || lowerName.includes('college') || lowerName.includes('univ')) {
        emoji = '🎓';
      } else if (closestPlace.category === 'gym' || lowerName.includes('gym') || lowerName.includes('fitness')) {
        emoji = '💪';
      } else {
        emoji = '📍';
      }

      return {
        title,
        subtitle: undefined,
        emoji,
        isSavedPlace: true,
        placeName: rawName,
        isAtHome: isHome,
      };
    }
  }

  // 4. Keyword Fallback from resolvedAddress
  const addr = (member.resolvedAddress || '').trim();
  const addrLower = addr.toLowerCase();

  if (
    addrLower.includes('home') ||
    addrLower.includes('residence') ||
    addrLower.includes('apartment') ||
    addrLower.includes('villa') ||
    addrLower.includes('house')
  ) {
    return {
      title: 'At home',
      subtitle: undefined,
      emoji: '🏠',
      isSavedPlace: true,
      placeName: 'Home',
      isAtHome: true,
    };
  }

  if (
    addrLower.includes('office') ||
    addrLower.includes('work') ||
    addrLower.includes('tech park') ||
    addrLower.includes('it park') ||
    addrLower.includes('business park') ||
    addrLower.includes('tower')
  ) {
    return {
      title: 'At Office',
      subtitle: undefined,
      emoji: '🏢',
      isSavedPlace: true,
      placeName: 'Office',
    };
  }

  if (
    addrLower.includes('school') ||
    addrLower.includes('college') ||
    addrLower.includes('university') ||
    addrLower.includes('campus')
  ) {
    return {
      title: 'At School',
      subtitle: undefined,
      emoji: '🎓',
      isSavedPlace: true,
      placeName: 'School',
    };
  }

  if (addrLower.includes('gym') || addrLower.includes('fitness')) {
    return {
      title: 'At Gym',
      subtitle: undefined,
      emoji: '💪',
      isSavedPlace: true,
      placeName: 'Gym',
    };
  }

  // 5. Stationary fallback if address is empty
  if (!addr) {
    return {
      title: hasValidCoords ? 'Stationary' : 'Location unknown',
      subtitle: undefined,
      emoji: '📍',
      isSavedPlace: false,
      isAtHome: false,
    };
  }

  // 6. Generic Street Address
  return {
    title: addr,
    subtitle: undefined,
    emoji: '📍',
    isSavedPlace: false,
    isAtHome: false,
  };
}

/**
 * Determines whether two members are currently at the same set/saved place
 * (e.g. both at Home, both at Office, or inside the same saved place geofence).
 */
function isAtSameSetPlace(
  placeA?: ResolvedMemberPlace | null,
  placeB?: ResolvedMemberPlace | null,
  coordsA?: { latitude?: number; longitude?: number } | null,
  coordsB?: { latitude?: number; longitude?: number } | null,
  savedPlaces: any[] = []
): boolean {
  if (!placeA || !placeB) return false;

  // 1. Both marked as being at Home
  if (placeA.isAtHome && placeB.isAtHome) {
    return true;
  }

  // 2. Both marked as being at a saved place with matching names
  if (placeA.isSavedPlace && placeB.isSavedPlace) {
    const nameA = (placeA.placeName || placeA.title || '').trim().toLowerCase();
    const nameB = (placeB.placeName || placeB.title || '').trim().toLowerCase();
    if (nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA))) {
      return true;
    }
  }

  // 3. Both within the geofence radius of the same saved place
  if (
    Array.isArray(savedPlaces) &&
    savedPlaces.length > 0 &&
    coordsA?.latitude &&
    coordsA?.longitude &&
    coordsB?.latitude &&
    coordsB?.longitude
  ) {
    for (const place of savedPlaces) {
      const pLat = Number(place.latitude);
      const pLng = Number(place.longitude);
      const radius = Math.max(Number(place.radiusMeters || place.radius || place.radius_meters) || 250, 300);
      if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
        const distA = calculateDistanceMeters(coordsA.latitude, coordsA.longitude, pLat, pLng);
        const distB = calculateDistanceMeters(coordsB.latitude, coordsB.longitude, pLat, pLng);
        if (distA <= radius && distB <= radius) {
          return true;
        }
      }
    }
  }

  return false;
}

const BottomDraggableSheetInner: React.FC<BottomDraggableSheetProps> = ({
  members,
  savedPlaces = [],
  isLoadingMembers = false,
  selectedMember,
  selectedCircle,
  currentUserId,
  myPosition,
  favoriteMemberIds,
  onToggleFavorite,
  nicknames = {},
  onUpdateNickname,
  onSelectMember,
  onDeselectMember,
  onCenterAll,
  onGoToMyLocation,
  onToggleMapLayers,
  onCheckInTapped,
  onSOSTapped,
  onAddPersonTapped,
  onSavePlaceTapped,
  onCreateBubbleTapped,
  onPopBubble,
  onSendLiveReaction,
  onViewWeeklyReport,
  onViewSpeeding,
  onViewTimeline,
  onOpenChat,
  onOpenDirectChat,
  onRefreshMember,
  onExpandChange,
  collapseTrigger,
  pullUpTrigger,
  onCirclePress,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  type MemberSortOption = 'distance' | 'movement' | 'status' | 'name' | 'battery';
  const STORAGE_KEY_MEMBER_SORT = '@carering_member_sort_by';
  const [sortBy, setSortBy] = useState<MemberSortOption>('movement');
  const [showSortModal, setShowSortModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_MEMBER_SORT).then((saved) => {
      if (saved && ['distance', 'movement', 'status', 'name', 'battery'].includes(saved)) {
        setSortBy(saved as MemberSortOption);
      }
    }).catch(() => {});
  }, []);

  const getSortLabel = (opt: MemberSortOption) => {
    switch (opt) {
      case 'distance': return 'Distance';
      case 'movement': return 'Movement';
      case 'status': return 'Status';
      case 'name': return 'Name';
      case 'battery': return 'Battery';
      default: return 'Sort';
    }
  };
  const [placeAlertActive, setPlaceAlertActive] = useState(true);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [isMemberExpanded, setIsMemberExpanded] = useState(false);
  const isMemberExpandedRef = useRef(false);
  isMemberExpandedRef.current = isMemberExpanded;

  // Safe area metrics for layout
  const topSafe = Math.max(
    insets.top || 0,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44
  );
  const bottomTabBarHeight = 60 + (insets.bottom || 0);
  const availableViewportHeight = SCREEN_HEIGHT - bottomTabBarHeight;

  // Calculate dynamic maximum expanded height so the sheet stays comfortably below status bar
  const dynamicMaxExpandedHeight = useMemo(() => {
    return Math.min(
      Math.round(availableViewportHeight * 0.94),
      availableViewportHeight - (topSafe + 16)
    );
  }, [availableViewportHeight, topSafe]);

  // Dynamic max height leaving comfortable clearance below top back button
  const memberDetailMaxHeight = useMemo(() => {
    // Clearance of topSafe + 115 guarantees the top of the sheet stays completely below the back button with 40px+ margin
    return Math.min(Math.round(SCREEN_HEIGHT * 0.74), SCREEN_HEIGHT - (topSafe + 115));
  }, [topSafe]);
  const memberDetailMaxHeightRef = useRef(memberDetailMaxHeight);
  memberDetailMaxHeightRef.current = memberDetailMaxHeight;

  const topSafeOffset = Math.max(insets.top, 24);
  const effectiveExpandedHeight = dynamicMaxExpandedHeight;

  const COLLAPSED_TRANSLATE_Y = dynamicMaxExpandedHeight - COLLAPSED_HEIGHT;
  const MID_TRANSLATE_Y = dynamicMaxExpandedHeight - DRAWER_MID_HEIGHT;
  const EXPANDED_TRANSLATE_Y = 0;
  const HIDDEN_TRANSLATE_Y = dynamicMaxExpandedHeight + 40;
  const MEMBER_HALF_TRANSLATE_Y = Math.max(0, dynamicMaxExpandedHeight - MEMBER_DETAIL_MIN_HEIGHT);
  const MEMBER_FULL_TRANSLATE_Y = Math.max(0, dynamicMaxExpandedHeight - memberDetailMaxHeight);

  const currentSnapRef = useRef<'min' | 'mid' | 'max' | 'hidden'>('mid');
  const translateY = useRef(new Animated.Value(MID_TRANSLATE_Y)).current;
  const currentTranslateYRef = useRef(MID_TRANSLATE_Y);

  useEffect(() => {
    const listenerId = translateY.addListener(({ value }) => {
      currentTranslateYRef.current = value;
    });
    return () => {
      translateY.removeListener(listenerId);
    };
  }, [translateY]);

  const [localAddressMap, setLocalAddressMap] = useState<Record<string, string>>({});
  const localAddressMapRef = useRef<Record<string, string>>({});

  const getEffectiveMember = useCallback(
    (m: MemberData): MemberData => {
      if (!m) return m;
      const addr = localAddressMap[m.id];
      if (addr && !m.resolvedAddress) {
        return { ...m, resolvedAddress: addr };
      }
      return m;
    },
    [localAddressMap]
  );

  useEffect(() => {
    let isMounted = true;
    members.forEach((m) => {
      const lat = Number(m.latitude);
      const lng = Number(m.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      if (m.resolvedAddress || localAddressMapRef.current[m.id]) return;

      locationSearchService
        .reverseGeocode(lat, lng)
        .then((res) => {
          if (isMounted && res && res.address) {
            localAddressMapRef.current[m.id] = res.address;
            setLocalAddressMap((prev) => ({
              ...prev,
              [m.id]: res.address,
            }));
          }
        })
        .catch(() => {});
    });

    return () => {
      isMounted = false;
    };
  }, [members]);

  // Native GPU-interpolated motion for the floating action row:
  // - Moves seamlessly right above the drawer as it moves between collapsed and mid stops
  // - Smoothly fades out ONLY when the drawer expands towards full screen (max)
  // - Stays docked and visible at the bottom when the drawer is fully hidden
  const floatingActionsOpacity = translateY.interpolate({
    inputRange: [
      EXPANDED_TRANSLATE_Y,
      EXPANDED_TRANSLATE_Y + 70,
      EXPANDED_TRANSLATE_Y + 140,
      MID_TRANSLATE_Y,
      COLLAPSED_TRANSLATE_Y,
      HIDDEN_TRANSLATE_Y,
    ],
    outputRange: [0, 0.35, 1, 1, 1, 1],
    extrapolate: 'clamp',
  });

  const floatingActionsScale = translateY.interpolate({
    inputRange: [
      EXPANDED_TRANSLATE_Y,
      EXPANDED_TRANSLATE_Y + 120,
      COLLAPSED_TRANSLATE_Y,
      HIDDEN_TRANSLATE_Y,
    ],
    outputRange: [0.85, 1, 1, 1],
    extrapolate: 'clamp',
  });

  const DRAWER_OFFSCREEN_Y = dynamicMaxExpandedHeight;

  const floatingActionsTranslateY = translateY.interpolate({
    inputRange: [
      EXPANDED_TRANSLATE_Y,
      MID_TRANSLATE_Y,
      COLLAPSED_TRANSLATE_Y,
      DRAWER_OFFSCREEN_Y,
      HIDDEN_TRANSLATE_Y,
    ],
    outputRange: [
      -(COLLAPSED_TRANSLATE_Y - EXPANDED_TRANSLATE_Y),
      -(COLLAPSED_TRANSLATE_Y - MID_TRANSLATE_Y),
      0,
      COLLAPSED_HEIGHT,
      COLLAPSED_HEIGHT,
    ],
    extrapolate: 'clamp',
  });

  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassSheet = getWebGlassCardStyle(isDark, isGlass);
  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  // Self user ("You") always appears at the top; other members sorted stably by sortBy
  const sortedMembers = useMemo(() => {
    const seen = new Set<string>();
    const unique: MemberData[] = [];
    for (const m of members) {
      if (m && m.id && !seen.has(m.id)) {
        seen.add(m.id);
        unique.push(m);
      }
    }

    const selfLat = myPosition?.latitude ?? members.find((m) => m.id === currentUserId)?.latitude;
    const selfLng = myPosition?.longitude ?? members.find((m) => m.id === currentUserId)?.longitude;
    const hasSelfLoc = typeof selfLat === 'number' && typeof selfLng === 'number' && !isNaN(selfLat) && !isNaN(selfLng);

    return unique.sort((a, b) => {
      // 1. "You" (current user) is always pinned at the top
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;

      const aEff = getEffectiveMember(a);
      const bEff = getEffectiveMember(b);

      // 2. Sort by chosen criterion
      if (sortBy === 'distance') {
        const aHasLoc = typeof aEff.latitude === 'number' && typeof aEff.longitude === 'number' && !isNaN(aEff.latitude) && !isNaN(aEff.longitude);
        const bHasLoc = typeof bEff.latitude === 'number' && typeof bEff.longitude === 'number' && !isNaN(bEff.latitude) && !isNaN(bEff.longitude);

        if (hasSelfLoc) {
          if (aHasLoc && !bHasLoc) return -1;
          if (!aHasLoc && bHasLoc) return 1;
          if (aHasLoc && bHasLoc) {
            const distA = calculateDistanceMeters(selfLat!, selfLng!, aEff.latitude, aEff.longitude);
            const distB = calculateDistanceMeters(selfLat!, selfLng!, bEff.latitude, bEff.longitude);
            if (Math.abs(distA - distB) > 5) {
              return distA - distB; // Closest to current user first
            }
          }
        }
      } else if (sortBy === 'movement') {
        const aMoving = isMemberMoving(aEff);
        const bMoving = isMemberMoving(bEff);
        if (aMoving !== bMoving) return aMoving ? -1 : 1;
        if (aMoving && bMoving) {
          const aSpeed = typeof aEff.speed === 'number' && !isNaN(aEff.speed) ? aEff.speed : 0;
          const bSpeed = typeof bEff.speed === 'number' && !isNaN(bEff.speed) ? bEff.speed : 0;
          if (Math.abs(bSpeed - aSpeed) > 0.1) return bSpeed - aSpeed;
        }
        // If both stationary (or equal speed), sort by most recent location / online activity
        const aTime = safeParseDate(aEff.lastLocationTime)?.getTime() ?? safeParseDate(aEff.lastOnlineAt)?.getTime() ?? 0;
        const bTime = safeParseDate(bEff.lastLocationTime)?.getTime() ?? safeParseDate(bEff.lastOnlineAt)?.getTime() ?? 0;
        if (aTime !== bTime) return bTime - aTime;
      } else if (sortBy === 'status') {
        const aOnline = Boolean(aEff.isOnline);
        const bOnline = Boolean(bEff.isOnline);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        // If both online or both offline, sort by most recent activity timestamp (newest first)
        const aTime = safeParseDate(aEff.lastLocationTime)?.getTime() ?? safeParseDate(aEff.lastOnlineAt)?.getTime() ?? 0;
        const bTime = safeParseDate(bEff.lastLocationTime)?.getTime() ?? safeParseDate(bEff.lastOnlineAt)?.getTime() ?? 0;
        if (aTime !== bTime) return bTime - aTime;
      } else if (sortBy === 'battery') {
        const aBatt = typeof aEff.batteryLevel === 'number' && !isNaN(aEff.batteryLevel) ? aEff.batteryLevel : 100;
        const bBatt = typeof bEff.batteryLevel === 'number' && !isNaN(bEff.batteryLevel) ? bEff.batteryLevel : 100;
        if (aBatt !== bBatt) return aBatt - bBatt; // Lowest battery first
        // If battery levels equal, member who is NOT charging comes first (needs attention)
        if (aEff.isCharging !== bEff.isCharging) return aEff.isCharging ? 1 : -1;
      } else if (sortBy === 'name') {
        const aName = NicknameService.getEffectiveName(aEff, nicknames || {}).toLowerCase();
        const bName = NicknameService.getEffectiveName(bEff, nicknames || {}).toLowerCase();
        const cmp = aName.localeCompare(bName);
        if (cmp !== 0) return cmp;
      }

      // 3. Fallback: most recent active timestamp before ID tie-breaker
      const aFallbackTime = safeParseDate(a.lastLocationTime)?.getTime() ?? safeParseDate(a.lastOnlineAt)?.getTime() ?? 0;
      const bFallbackTime = safeParseDate(b.lastLocationTime)?.getTime() ?? safeParseDate(b.lastOnlineAt)?.getTime() ?? 0;
      if (aFallbackTime !== bFallbackTime) return bFallbackTime - aFallbackTime;

      // 4. Stable tie-breaker by member ID so list remains deterministic
      return a.id.localeCompare(b.id);
    });
  }, [members, currentUserId, sortBy, nicknames, myPosition, getEffectiveMember]);

  const filteredMembers = sortedMembers;

  const safetyPulse = useMemo(() => {
    let movingCount = 0;
    let lowBatteryMember: MemberData | null = null;

    for (const m of members) {
      if (!m) continue;
      const isMoving = (m.isMoving || (m.speed || 0) >= 1.8) && !m.isStationary;
      if (isMoving) movingCount++;
      if (typeof m.batteryLevel === 'number' && m.batteryLevel <= 20 && !m.isCharging && !lowBatteryMember) {
        lowBatteryMember = m;
      }
    }

    if (lowBatteryMember) {
      const name = lowBatteryMember.id === currentUserId ? 'Your' : `${lowBatteryMember.fullName.split(' ')[0]}'s`;
      return {
        type: 'warning' as const,
        icon: 'warning' as const,
        text: `${name} battery is low (${Math.round(lowBatteryMember.batteryLevel || 0)}%)`,
      };
    }

    if (movingCount > 0) {
      return {
        type: 'moving' as const,
        icon: 'checkmark-circle' as const,
        text: `All members safe • ${movingCount} on the move`,
      };
    }

    return {
      type: 'safe' as const,
      icon: 'checkmark-circle' as const,
      text: `All members safe • ${members.length} connected`,
    };
  }, [members, currentUserId]);

  const selectedMemberRef = useRef(selectedMember);
  selectedMemberRef.current = selectedMember;
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;
  const onDeselectMemberRef = useRef(onDeselectMember);
  onDeselectMemberRef.current = onDeselectMember;
  const onExpandChangeRef = useRef(onExpandChange);
  onExpandChangeRef.current = onExpandChange;
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const detailScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (selectedMember) {
      setIsExpanded(false);
      setIsMemberExpanded(false);
      onExpandChange?.(false);
      animateToTranslateY(MEMBER_HALF_TRANSLATE_Y, false);
      // Ensure scroll offset is immediately reset to 0 so no items are hidden at the top
      requestAnimationFrame(() => {
        detailScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    } else {
      setIsExpanded(false);
      setIsMemberExpanded(false);
      onExpandChange?.(false);
      animateToTranslateY(MID_TRANSLATE_Y, false);
    }
  }, [selectedMember?.id, selectedMember != null]);

  // ---------------------------------------------------------------------------
  // HORIZONTAL MEMBER SLIDER (Swipe left/right to switch profile + carousel)
  // ---------------------------------------------------------------------------
  const sliderMembers = useMemo(() => {
    return sortedMembers;
  }, [sortedMembers]);

  const currentMemberIndex = useMemo(() => {
    if (!selectedMember || sliderMembers.length === 0) return 0;
    const idx = sliderMembers.findIndex((m) => m.id === selectedMember.id);
    return idx >= 0 ? idx : 0;
  }, [selectedMember?.id, sliderMembers]);

  const horizontalScrollRef = useRef<any>(null);
  const horizontalScrollX = useRef(new Animated.Value(0)).current;
  const isFirstCarouselMountRef = useRef(true);
  const isInternalHorizontalScrollRef = useRef(false);
  const webScrollTimeoutRef = useRef<any>(null);

  // Sync horizontal carousel position when selectedMember changes from outside (or on initial open)
  useEffect(() => {
    if (!selectedMember) {
      isFirstCarouselMountRef.current = true;
      isInternalHorizontalScrollRef.current = false;
      return;
    }

    const idx = sliderMembers.findIndex((m) => m.id === selectedMember.id);
    if (idx >= 0) {
      const targetX = idx * SCREEN_WIDTH;
      // Always keep Animated.Value aligned so card scale & opacity never glitch
      horizontalScrollX.setValue(targetX);

      if (isInternalHorizontalScrollRef.current) {
        // User just swiped here via carousel; no need to call scrollTo again
        isInternalHorizontalScrollRef.current = false;
        return;
      }

      if (horizontalScrollRef.current) {
        if (isFirstCarouselMountRef.current) {
          isFirstCarouselMountRef.current = false;
          horizontalScrollRef.current.scrollTo({
            x: targetX,
            animated: false,
          });
        } else {
          horizontalScrollRef.current.scrollTo({
            x: targetX,
            animated: true,
          });
        }
      } else {
        requestAnimationFrame(() => {
          if (horizontalScrollRef.current) {
            horizontalScrollRef.current.scrollTo({
              x: targetX,
              animated: false,
            });
            isFirstCarouselMountRef.current = false;
          }
        });
      }
    }
  }, [selectedMember?.id, sliderMembers]);

  const handleHorizontalScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const newIdx = Math.round(offsetX / SCREEN_WIDTH);
      if (newIdx >= 0 && newIdx < sliderMembers.length) {
        const targetMember = sliderMembers[newIdx];
        if (targetMember && targetMember.id !== selectedMemberRef.current?.id) {
          isInternalHorizontalScrollRef.current = true;
          hapticService.selection();
          onSelectMember(targetMember);
        }
      }
    },
    [sliderMembers, onSelectMember]
  );

  const handleHorizontalScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS === 'web') {
        if (webScrollTimeoutRef.current) {
          clearTimeout(webScrollTimeoutRef.current);
        }
        const offsetX = e.nativeEvent.contentOffset.x;
        webScrollTimeoutRef.current = setTimeout(() => {
          const newIdx = Math.round(offsetX / SCREEN_WIDTH);
          if (newIdx >= 0 && newIdx < sliderMembers.length) {
            const targetMember = sliderMembers[newIdx];
            if (targetMember && targetMember.id !== selectedMemberRef.current?.id) {
              isInternalHorizontalScrollRef.current = true;
              hapticService.selection();
              onSelectMember(targetMember);
            }
          }
        }, 80);
      }
    },
    [sliderMembers, onSelectMember]
  );

  const handleScrollToPrevMember = useCallback(() => {
    if (currentMemberIndex > 0) {
      const targetIdx = currentMemberIndex - 1;
      const targetMember = sliderMembers[targetIdx];
      isInternalHorizontalScrollRef.current = true;
      horizontalScrollRef.current?.scrollTo({
        x: targetIdx * SCREEN_WIDTH,
        animated: true,
      });
      horizontalScrollX.setValue(targetIdx * SCREEN_WIDTH);
      hapticService.light();
      onSelectMember(targetMember);
    }
  }, [currentMemberIndex, sliderMembers, onSelectMember]);

  const handleScrollToNextMember = useCallback(() => {
    if (currentMemberIndex < sliderMembers.length - 1) {
      const targetIdx = currentMemberIndex + 1;
      const targetMember = sliderMembers[targetIdx];
      isInternalHorizontalScrollRef.current = true;
      horizontalScrollRef.current?.scrollTo({
        x: targetIdx * SCREEN_WIDTH,
        animated: true,
      });
      horizontalScrollX.setValue(targetIdx * SCREEN_WIDTH);
      hapticService.light();
      onSelectMember(targetMember);
    }
  }, [currentMemberIndex, sliderMembers, onSelectMember]);

  const startDragTranslateY = useRef(MID_TRANSLATE_Y);

  const animateToTranslateY = (toValue: number, expandedState: boolean, velocity?: number) => {
    currentTranslateYRef.current = toValue;
    const isFullScreen = !selectedMemberRef.current
      ? toValue === EXPANDED_TRANSLATE_Y
      : toValue <= MEMBER_FULL_TRANSLATE_Y + 20;
    setIsExpanded(isFullScreen);
    if (!selectedMemberRef.current) {
      if (toValue === EXPANDED_TRANSLATE_Y) {
        currentSnapRef.current = 'max';
        onExpandChangeRef.current?.(true);
      } else if (toValue === MID_TRANSLATE_Y) {
        currentSnapRef.current = 'mid';
        onExpandChangeRef.current?.(false);
      } else if (toValue === HIDDEN_TRANSLATE_Y) {
        currentSnapRef.current = 'hidden';
        onExpandChangeRef.current?.(false);
      } else {
        currentSnapRef.current = 'min';
        onExpandChangeRef.current?.(false);
      }
    } else {
      onExpandChangeRef.current?.(toValue <= MEMBER_HALF_TRANSLATE_Y - 30);
    }
    Animated.spring(translateY, {
      toValue,
      velocity: velocity ? velocity : undefined,
      friction: 10,
      tension: 50,
      overshootClamping: true,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  useEffect(() => {
    if (collapseTrigger && collapseTrigger > 0) {
      if (selectedMemberRef.current) {
        animateToTranslateY(MEMBER_HALF_TRANSLATE_Y, false);
      } else {
        currentSnapRef.current = 'min';
        animateToTranslateY(COLLAPSED_TRANSLATE_Y, false);
      }
    }
  }, [collapseTrigger]);

  // Pull up drawer whenever tab button is tapped from bottom bar:
  // If drawer is hidden completely at bottom or collapsed, open directly to 2nd stop (MID)
  useEffect(() => {
    if (pullUpTrigger && pullUpTrigger > 0) {
      if (selectedMemberRef.current) {
        onDeselectMemberRef.current?.();
      }
      currentSnapRef.current = 'mid';
      animateToTranslateY(MID_TRANSLATE_Y, true);
    }
  }, [pullUpTrigger]);

  const handlePanResponderEnd = (gesture: any) => {
    if (selectedMemberRef.current) {
      const currentTranslateY = startDragTranslateY.current + gesture.dy;
      const midpoint = (MEMBER_HALF_TRANSLATE_Y + MEMBER_FULL_TRANSLATE_Y) / 2;

      if (isMemberExpandedRef.current) {
        // Already at MAX height: dragging down collapses to HALF (MIN) height
        if (gesture.dy > 45 || gesture.vy > 0.3 || currentTranslateY > midpoint) {
          setIsMemberExpanded(false);
          hapticService.selection();
          animateToTranslateY(MEMBER_HALF_TRANSLATE_Y, false, gesture.vy);
        } else {
          // Stay at MAX height
          animateToTranslateY(MEMBER_FULL_TRANSLATE_Y, false, gesture.vy);
        }
      } else {
        // At HALF height (~48% screen):
        if (gesture.dy > 50 || gesture.vy > 0.35 || currentTranslateY > MEMBER_HALF_TRANSLATE_Y + 50) {
          // Dragged down from HALF -> dismiss profile completely
          hapticService.light();
          onDeselectMemberRef.current?.();
        } else if (gesture.dy < -35 || gesture.vy < -0.25 || currentTranslateY < midpoint) {
          // Dragged up from HALF -> expand to MAX height
          setIsMemberExpanded(true);
          hapticService.selection();
          animateToTranslateY(MEMBER_FULL_TRANSLATE_Y, false, gesture.vy);
        } else {
          // Stay at HALF height
          animateToTranslateY(MEMBER_HALF_TRANSLATE_Y, false, gesture.vy);
        }
      }
      return;
    }

    // 4-Point Snapping for Member List: MAX -> MID -> MIN -> HIDDEN
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
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (selectedMemberRef.current) {
          return Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.1;
        }
        return Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (selectedMemberRef.current) {
          return Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.1;
        }
        return Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startDragTranslateY.current = currentTranslateYRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        if (selectedMemberRef.current) {
          const targetTranslateY = startDragTranslateY.current + gesture.dy;
          const clamped = Math.max(
            MEMBER_FULL_TRANSLATE_Y - 10,
            Math.min(dynamicMaxExpandedHeight + 40, targetTranslateY)
          );
          currentTranslateYRef.current = clamped;
          translateY.setValue(clamped);
          return;
        }

        const targetTranslateY = startDragTranslateY.current + gesture.dy;
        const clamped = Math.max(
          EXPANDED_TRANSLATE_Y - 8,
          Math.min(HIDDEN_TRANSLATE_Y + 12, targetTranslateY)
        );
        currentTranslateYRef.current = clamped;
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, gesture) => {
        handlePanResponderEnd(gesture);
      },
      onPanResponderTerminate: (_, gesture) => {
        handlePanResponderEnd(gesture);
      },
    })
  ).current;

  const toggleSheet = () => {
    if (selectedMember) return;
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

  const [distancePrefs, setDistancePrefs] = useState<DistancePreferences>(
    distancePreferencesService.getPreferencesSync()
  );

  const [selectedRouteInfo, setSelectedRouteInfo] = useState<DistanceDisplayResult | null>(null);

  useEffect(() => {
    const unsub = distancePreferencesService.subscribe((prefs) => {
      setDistancePrefs(prefs);
    });
    return unsub;
  }, []);

  // Prefetch routes in background for members in active circle
  useEffect(() => {
    const selfLat = myPosition?.latitude || members.find((m) => m.id === currentUserId)?.latitude;
    const selfLng = myPosition?.longitude || members.find((m) => m.id === currentUserId)?.longitude;
    if (selfLat && selfLng && members.length > 0 && distancePrefs.mode !== 'air') {
      routingService.prefetchRoutes(selfLat, selfLng, members, distancePrefs.mode);
    }
  }, [members, myPosition?.latitude, myPosition?.longitude, distancePrefs.mode]);

  // Proximity resolution: checks if member is at the same set place (e.g. Home, Office)
  // OR at the same physical place / co-located nearby (<100m) even if not a set place.
  const getMemberProximity = (member?: MemberData | null) => {
    if (!member || member.id === currentUserId) return null;
    const selfLat = myPosition?.latitude || members.find((m) => m.id === currentUserId)?.latitude;
    const selfLng = myPosition?.longitude || members.find((m) => m.id === currentUserId)?.longitude;

    const selfMember = members.find((m) => m.id === currentUserId) || ({
      id: currentUserId,
      fullName: 'You',
      latitude: selfLat,
      longitude: selfLng,
    } as any);

    const selfPlace = resolveMemberPlace(selfMember, savedPlaces, true);
    const memberPlace = resolveMemberPlace(member, savedPlaces, member.id === currentUserId);

    // 1. Both marked as being at Home
    if (selfPlace.isAtHome && memberPlace.isAtHome) {
      return {
        isSamePlaceOrNearby: true,
        isAtHomeTogether: true,
        isSameSetPlace: true,
        placeName: 'Home',
        badgeLabel: 'At Home',
        detailLabel: 'At Home together',
        icon: 'home' as const,
      };
    }

    if (!selfLat || !selfLng || !member.latitude || !member.longitude) return null;

    const rawMeters = calculateDistanceMeters(selfLat, selfLng, member.latitude, member.longitude);

    // 2. Both at the same saved / set place (Office, Gym, School, or inside same custom saved place radius)
    if (
      isAtSameSetPlace(
        selfPlace,
        memberPlace,
        { latitude: selfLat, longitude: selfLng },
        { latitude: member.latitude, longitude: member.longitude },
        savedPlaces
      )
    ) {
      const placeName = memberPlace.placeName || selfPlace.placeName || memberPlace.title || 'Same Place';
      const label = memberPlace.isAtHome ? 'At Home' : (placeName.startsWith('At ') ? placeName : `At ${placeName}`);
      return {
        isSamePlaceOrNearby: true,
        isAtHomeTogether: Boolean(memberPlace.isAtHome || selfPlace.isAtHome),
        isSameSetPlace: true,
        placeName,
        badgeLabel: label,
        detailLabel: `${label} together`,
        icon: (memberPlace.isAtHome ? 'home' : (memberPlace.isSavedPlace ? 'business' : 'location-sharp')) as any,
        rawMeters,
      };
    }

    // 3. Physically Nearby (within 250m or same address street)
    const isNearbyMeters = rawMeters <= 250;
    const isSameAddress = Boolean(
      selfPlace.title &&
      memberPlace.title &&
      selfPlace.title.trim().toLowerCase() === memberPlace.title.trim().toLowerCase() &&
      rawMeters <= 350
    );

    if (isNearbyMeters || isSameAddress) {
      return {
        isSamePlaceOrNearby: true,
        isAtHomeTogether: false,
        isSameSetPlace: false,
        badgeLabel: 'Nearby you',
        detailLabel: 'Nearby you',
        icon: 'sparkles' as const,
        rawMeters,
      };
    }

    return null;
  };

  const isMemberTogetherOrNearby = (member?: MemberData | null): boolean => {
    if (!member) return false;
    return Boolean(getMemberProximity(member)?.isSamePlaceOrNearby);
  };

  const isMemberAtSameSetPlace = (member: MemberData): boolean => {
    if (member.id === currentUserId) return true;
    return isMemberTogetherOrNearby(member);
  };

  useEffect(() => {
    if (!selectedMember || selectedMember.id === currentUserId || isMemberTogetherOrNearby(selectedMember)) {
      setSelectedRouteInfo(null);
      return;
    }

    const selfLat = myPosition?.latitude || members.find((m) => m.id === currentUserId)?.latitude;
    const selfLng = myPosition?.longitude || members.find((m) => m.id === currentUserId)?.longitude;
    if (!selfLat || !selfLng || !selectedMember.latitude || !selectedMember.longitude) {
      setSelectedRouteInfo(null);
      return;
    }

    // Immediate cached or fallback display
    const immediate = getMemberDistanceDisplay(
      selfLat,
      selfLng,
      selectedMember.latitude,
      selectedMember.longitude,
      distancePrefs,
      false
    );
    setSelectedRouteInfo(immediate);

    if (distancePrefs.mode === 'air') return;

    let isCancelled = false;
    fetchMemberDistanceDisplay(
      selfLat,
      selfLng,
      selectedMember.latitude,
      selectedMember.longitude,
      distancePrefs
    ).then((realResult) => {
      if (!isCancelled && realResult) {
        setSelectedRouteInfo(realResult);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    selectedMember?.id,
    selectedMember?.latitude,
    selectedMember?.longitude,
    myPosition?.latitude,
    myPosition?.longitude,
    distancePrefs,
    savedPlaces,
  ]);

  const getDistanceInfo = (member: MemberData): DistanceDisplayResult | null => {
    if (member.id === currentUserId) return null;
    if (isMemberTogetherOrNearby(member)) return null;

    const selfLat = myPosition?.latitude || members.find((m) => m.id === currentUserId)?.latitude;
    const selfLng = myPosition?.longitude || members.find((m) => m.id === currentUserId)?.longitude;
    if (!selfLat || !selfLng || !member.latitude || !member.longitude) return null;

    return getMemberDistanceDisplay(
      selfLat,
      selfLng,
      member.latitude,
      member.longitude,
      distancePrefs
    );
  };

  const getDistanceText = (member: MemberData): string | null => {
    const prox = getMemberProximity(member);
    if (prox?.isSamePlaceOrNearby) return prox.badgeLabel;
    const info = getDistanceInfo(member);
    return info ? info.formattedDistance : null;
  };

  const handleCallMember = (member: MemberData) => {
    if (member.id === currentUserId) {
      Alert.alert('Your Profile', 'This is your own profile.');
      return;
    }

    if (member.phone && member.phone.trim().length > 0) {
      Linking.openURL(`tel:${member.phone.trim()}`).catch(() => {
        Alert.alert('Call Failed', `Could not initiate call to ${member.fullName}`);
      });
    } else {
      Alert.alert(
        'Calling',
        `Initiating voice call to ${member.fullName}...`
      );
    }
  };

  // Derived: true when the currently-selected member detail is for the logged-in user
  const isSelectedSelf = selectedMember?.id === currentUserId;

  // Self member & Ghost Mode status
  const selfMember = members.find((m) => m.id === currentUserId) || members[0];
  const isSelfInBubble = Boolean(selfMember?.inBubble);

  const handleGhostModeTapped = useCallback(() => {
    if (!selfMember) return;
    if (isSelfInBubble) {
      onPopBubble?.(selfMember);
    } else {
      onCreateBubbleTapped?.(selfMember);
    }
  }, [selfMember, isSelfInBubble, onPopBubble, onCreateBubbleTapped]);

  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      {/* 1. Single Unified Floating Actions Row above sheet (Hidden when drawer expands to top) */}
      {!selectedMember && (
        <FloatingMapActionsRow
          translateY={translateY}
          dynamicMaxExpandedHeight={dynamicMaxExpandedHeight}
          collapsedHeight={COLLAPSED_HEIGHT}
          midTranslateY={MID_TRANSLATE_Y}
          expandedTranslateY={EXPANDED_TRANSLATE_Y}
          hiddenTranslateY={HIDDEN_TRANSLATE_Y}
          isExpanded={isExpanded}
          isSelfInBubble={isSelfInBubble}
          onCheckInTapped={onCheckInTapped}
          onGhostModeTapped={handleGhostModeTapped}
          onToggleMapLayers={onToggleMapLayers}
          onGoToMyLocation={onGoToMyLocation}
          onSOSTapped={onSOSTapped}
        />
      )}

      {/* 2. Draggable Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: dynamicMaxExpandedHeight,
            transform: [{ translateY }],
            backgroundColor: selectedMember ? 'transparent' : colors.card,
            borderColor: selectedMember ? 'transparent' : colors.cardBorder,
            borderTopLeftRadius: selectedMember ? 0 : 28,
            borderTopRightRadius: selectedMember ? 0 : 28,
            overflow: 'visible',
          },
          !selectedMember && webGlassSheet,
        ]}
      >

        {/* =========================================================================
            VIEW A: MEMBER DETAIL VIEW
        ========================================================================= */}
        {selectedMember ? (() => {
          const renderMemberProfileCard = (
            memberToRender: MemberData,
            isCurrent: boolean,
            memberIndex = 0,
            totalMembers = 1
          ) => {
            const effectiveMember = getEffectiveMember(memberToRender);

            const isMemberSelf = memberToRender.id === currentUserId;
            const detailDisplay = NicknameService.getNameDisplay(
              effectiveMember,
              nicknames,
              isMemberSelf
            );
            const proximityInfo = getMemberProximity(effectiveMember);
            const isSamePlaceOrNearby = Boolean(proximityInfo?.isSamePlaceOrNearby);
            const distInfo = !isMemberSelf && !isSamePlaceOrNearby ? ((isCurrent && selectedRouteInfo) || getDistanceInfo(effectiveMember)) : null;
            const isNearby = isSamePlaceOrNearby || (distInfo ? (distInfo.isNearby || distInfo.rawMeters <= NEARBY_THRESHOLD_METERS) : false);

            const placeInfo = resolveMemberPlace(effectiveMember, savedPlaces, isMemberSelf);
            const effectiveLastActive = safeParseDate(effectiveMember.lastLocationTime) || safeParseDate(effectiveMember.lastOnlineAt);
            const isMemberStale = Boolean(effectiveLastActive && (Date.now() - effectiveLastActive.getTime() > 120000));
            const effSpeed = typeof effectiveMember.speed === 'number' && !isNaN(effectiveMember.speed) && effectiveMember.speed > 0 ? effectiveMember.speed : 0;
            const hasMovingActivity = Boolean(
              effectiveMember.activityType &&
              effectiveMember.activityType !== 'stationary' &&
              effectiveMember.activityType !== 'unknown'
            );
            const isSelectedMoving = !isMemberStale && effSpeed >= 1.8 && (effSpeed > 3.5 || hasMovingActivity || (effectiveMember.isMoving && !effectiveMember.isStationary));
            const selectedActivity = !isMemberStale && (
              placeInfo.activity ||
              (isSelectedMoving
                ? getMovementActivity(effectiveMember.speed, effectiveMember.isStationary, effectiveMember.activityType)
                : null)
            );

            const headerStatusText = selectedActivity
              ? 'In motion'
              : formatSinceTime(effectiveMember);

            const showNick = Boolean(
              detailDisplay.secondary &&
              detailDisplay.secondary.trim().toLowerCase() !== detailDisplay.primary.trim().toLowerCase() &&
              detailDisplay.secondary.trim().toLowerCase() !== 'you'
            );

            const batt = getBatteryVisual(effectiveMember.batteryLevel, effectiveMember.isCharging, isDark);

            return (
              <View
                style={[
                  styles.profileSingleCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    borderTopWidth: 1.5,
                    borderLeftWidth: 1.5,
                    borderRightWidth: 1.5,
                    borderBottomWidth: 0,
                  },
                ]}
              >
                {/* FIXED TOP HEADER: Drag Bar with prev/next buttons, Avatar with online dot, Name & Since, Battery */}
                <View
                  {...(isCurrent ? panResponder.panHandlers : {})}
                  style={[
                    styles.sketchFixedHeader,
                    {
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  {/* Centered Grab Handle Bar with Slider Prev/Next Navigation Controls */}
                  <View style={styles.sketchGrabArea}>
                    <View style={styles.profileGrabSliderRow}>
                      {totalMembers > 1 ? (
                        <TouchableOpacity
                          activeOpacity={0.6}
                          disabled={memberIndex <= 0}
                          onPress={handleScrollToPrevMember}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={[
                            styles.profileNavArrow,
                            memberIndex <= 0 && { opacity: 0.25 },
                          ]}
                          accessibilityLabel="Previous member"
                        >
                          <Ionicons
                            name="chevron-back"
                            size={16}
                            color={isDark ? '#E2E8F0' : '#475569'}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={{ width: 28 }} />
                      )}

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!isCurrent) return;
                          if (isMemberExpanded) {
                            setIsMemberExpanded(false);
                            hapticService.selection();
                            animateToTranslateY(MEMBER_HALF_TRANSLATE_Y, false);
                          } else {
                            setIsMemberExpanded(true);
                            hapticService.selection();
                            animateToTranslateY(MEMBER_FULL_TRANSLATE_Y, false);
                          }
                        }}
                        style={styles.handleTouch}
                        accessibilityLabel="Toggle member detail height"
                      >
                        <View
                          style={[
                            styles.grabBar,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.35)' : '#CBD5E1' },
                          ]}
                        />
                        {totalMembers > 1 && (
                          <Text style={[styles.profileMemberCounterText, { color: colors.textMuted }]}>
                            {memberIndex + 1} of {totalMembers}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {totalMembers > 1 ? (
                        <TouchableOpacity
                          activeOpacity={0.6}
                          disabled={memberIndex >= totalMembers - 1}
                          onPress={handleScrollToNextMember}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={[
                            styles.profileNavArrow,
                            memberIndex >= totalMembers - 1 && { opacity: 0.25 },
                          ]}
                          accessibilityLabel="Next member"
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={isDark ? '#E2E8F0' : '#475569'}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={{ width: 28 }} />
                      )}
                    </View>
                  </View>

                  {/* Profile Picture attached directly to top-right of drawer */}
                  <View style={styles.sketchRightOverflowAvatarWrap} pointerEvents="box-none">
                    <Avatar
                      name={effectiveMember.fullName}
                      avatarUrl={effectiveMember.avatarUrl}
                      size={60}
                      borderWidth={3}
                      borderColor={colors.card}
                      statusBorderColor={colors.card}
                      showBattery={false}
                      showOnlineDot={true}
                      isOnline={effectiveMember.isOnline}
                      dotPosition="bottom-right"
                    />
                  </View>

                  {/* Fixed Top Bar */}
                  <View style={styles.sketchFixedTopBar}>
                    {/* Left: Name, Since Duration, Battery & Like */}
                    <View style={styles.sketchHeaderLeftCol}>
                      <View style={styles.sketchFixedNameWrap}>
                        <Text style={[styles.sketchNameText, { color: colors.textMain }]} numberOfLines={1} ellipsizeMode="tail">
                          {detailDisplay.primary}{showNick ? ` (${detailDisplay.secondary})` : ''}
                        </Text>
                        <View style={styles.sketchSinceAndMetaRow}>
                          <View style={styles.sketchSinceRow}>
                            {selectedActivity ? (
                              <View
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: 3.5,
                                  backgroundColor: selectedActivity.color || '#10B981',
                                  marginRight: 5,
                                }}
                              />
                            ) : (
                              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                            )}
                            <Text style={[styles.sketchSinceText, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                              {headerStatusText}
                            </Text>
                          </View>

                          {/* Battery Pill */}
                          <View
                            style={[
                              styles.sketchBatteryPill,
                              {
                                backgroundColor: batt.bgColor,
                                borderColor: batt.borderColor,
                              },
                            ]}
                          >
                            <Ionicons name={batt.icon} size={11} color={batt.color} />
                            <Text style={[styles.sketchBatteryText, { color: batt.textColor }]}>
                              {batt.levelText}
                            </Text>
                          </View>

                          {/* Favorite button */}
                          {!isMemberSelf && (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => onToggleFavorite?.(effectiveMember)}
                              style={[
                                styles.sketchSmallHeartBtn,
                                {
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                                  borderColor: colors.tileBorder,
                                },
                              ]}
                              accessibilityLabel="Toggle favorite"
                            >
                              <Ionicons
                                name={favoriteMemberIds?.includes(effectiveMember.id) ? 'heart' : 'heart-outline'}
                                size={15}
                                color={favoriteMemberIds?.includes(effectiveMember.id) ? '#EC4899' : colors.textMuted}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* SCROLLABLE BODY: Content scrolls below fixed header (always resets to top) */}
                <ScrollView
                  key={`profile-scroll-${effectiveMember.id}`}
                  ref={isCurrent ? detailScrollRef : undefined}
                  scrollEnabled={isCurrent}
                  nestedScrollEnabled={true}
                  style={{ flex: 1 }}
                  contentOffset={{ x: 0, y: 0 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.memberDetailScroll,
                    { paddingBottom: 24 },
                  ]}
                  onScrollEndDrag={(e) => {
                    if (e.nativeEvent.contentOffset.y < -35) {
                      if (isMemberExpandedRef.current) {
                        setIsMemberExpanded(false);
                        hapticService.selection();
                        animateToTranslateY(MEMBER_HALF_TRANSLATE_Y, false);
                      } else {
                        hapticService.light();
                        onDeselectMemberRef.current?.();
                      }
                    }
                  }}
                >
                  <View style={styles.sketchContentSection}>
                    {/* Information Card (Location & Distance) */}
                    <View style={[styles.sketchInfoCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                      {/* Location Row */}
                      <View style={styles.sketchLocationFullRow}>
                        <View style={styles.sketchLocationTextWrap}>
                          <Ionicons
                            name={placeInfo.isAtHome ? 'home' : (placeInfo.isSavedPlace ? 'business' : 'location-sharp')}
                            size={17}
                            color={placeInfo.isAtHome ? '#10B981' : (placeInfo.activity ? (isDark ? '#818CF8' : '#6366F1') : '#7C3AED')}
                            style={{ marginTop: 2 }}
                          />
                          <View style={styles.sketchLocationDetailsCol}>
                            <Text style={[styles.sketchLocationText, { color: colors.textMain }]} numberOfLines={1} ellipsizeMode="tail">
                              {placeInfo.title}
                            </Text>
                            {Boolean(placeInfo.subtitle && placeInfo.subtitle !== placeInfo.title) && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                {placeInfo.activity && (
                                  <AnimatedActivityEmoji
                                    activity={placeInfo.activity}
                                    size={12}
                                    style={{ marginRight: 4 }}
                                  />
                                )}
                                <Text
                                  style={[
                                    styles.sketchLocationSubText,
                                    {
                                      color: placeInfo.activity
                                        ? (isDark ? '#A5B4FC' : '#4F46E5')
                                        : colors.textMuted,
                                      fontWeight: placeInfo.activity ? '600' : 'normal',
                                    },
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {placeInfo.subtitle}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Location Icon Badge */}
                        <View
                          style={[
                            styles.sketchLocationIconBadge,
                            {
                              backgroundColor: placeInfo.isAtHome
                                ? (isDark ? 'rgba(16, 185, 129, 0.20)' : '#ECFDF5')
                                : placeInfo.activity
                                  ? (isDark ? 'rgba(99, 102, 241, 0.20)' : '#EEF2FF')
                                  : (isDark ? 'rgba(124, 58, 237, 0.22)' : '#EDE9FE'),
                              borderColor: placeInfo.isAtHome
                                ? (isDark ? 'rgba(16, 185, 129, 0.40)' : '#A7F3D0')
                                : placeInfo.activity
                                  ? (isDark ? 'rgba(99, 102, 241, 0.40)' : '#C7D2FE')
                                  : (isDark ? 'rgba(124, 58, 237, 0.40)' : '#C4B5FD'),
                            },
                          ]}
                        >
                          {placeInfo.isAtHome ? (
                            <Ionicons name="home" size={17} color="#10B981" />
                          ) : placeInfo.activity ? (
                            <AnimatedActivityEmoji
                              activity={placeInfo.activity}
                              size={19}
                            />
                          ) : (
                            <Text style={styles.sketchLocationIconEmoji}>{placeInfo.emoji}</Text>
                          )}
                        </View>
                      </View>

                      {/* Distance / Nearby Row */}
                      {!isMemberSelf && (
                        isSamePlaceOrNearby && proximityInfo ? (
                          proximityInfo.isAtHomeTogether ? (
                            <View
                              style={[
                                styles.sketchDistanceFullRow,
                                {
                                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
                                },
                              ]}
                            >
                              <Ionicons name="home" size={13} color="#10B981" />
                              <Text
                                style={[
                                  styles.sketchDistanceText,
                                  {
                                    color: isDark ? '#34D399' : '#059669',
                                    fontWeight: '700',
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                At Home together with you
                              </Text>
                            </View>
                          ) : !proximityInfo.isSameSetPlace ? (
                            <View
                              style={[
                                styles.sketchDistanceFullRow,
                                {
                                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
                                },
                              ]}
                            >
                              <Ionicons name="sparkles" size={13} color="#10B981" />
                              <Text
                                style={[
                                  styles.sketchDistanceText,
                                  {
                                    color: isDark ? '#34D399' : '#059669',
                                    fontWeight: '700',
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                Nearby you
                              </Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.sketchDistanceFullRow,
                                {
                                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : '#F0F9FF',
                                  borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD',
                                },
                              ]}
                            >
                              <Ionicons name="business" size={13} color={colors.primary} />
                              <Text
                                style={[
                                  styles.sketchDistanceText,
                                  {
                                    color: colors.primary,
                                    fontWeight: '700',
                                  },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {proximityInfo.badgeLabel} together with you
                              </Text>
                            </View>
                          )
                        ) : (
                          distInfo && !isNearby && (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                if (effectiveMember.latitude && effectiveMember.longitude) {
                                  openNavigationDirections(
                                    effectiveMember.latitude,
                                    effectiveMember.longitude,
                                    effectiveMember.fullName,
                                    distancePrefs.mode
                                  );
                                }
                              }}
                              style={[
                                styles.sketchDistanceFullRow,
                                {
                                  backgroundColor: isDark ? 'rgba(124, 58, 237, 0.14)' : '#F5F3FF',
                                  borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#DDD6FE',
                                },
                              ]}
                            >
                              <Ionicons
                                name={(TRANSPORT_MODES[distancePrefs.mode]?.icon as any) || 'car'}
                                size={14}
                                color={colors.primary}
                              />
                              <Text style={[styles.sketchDistanceText, { color: colors.primary }]} numberOfLines={1} ellipsizeMode="tail">
                                {distInfo.formattedDistance.replace(/\s+away\s+away/gi, ' away')} {distInfo.etaText ? `• ~${distInfo.etaText}` : ''}
                              </Text>
                              <Ionicons name="arrow-forward" size={13} color={colors.primary} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                          )
                        )
                      )}
                    </View>

                    {/* Timeline Block */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => onViewTimeline?.(effectiveMember)}
                      style={[styles.timelineHeroRow, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
                    >
                      <View style={[styles.timelineHeroIcon, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EDE9FE' }]}>
                        <Feather name="rotate-ccw" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.timelineHeroTitle, { color: colors.textMain }]}>Movement Timeline</Text>
                        <Text style={[styles.timelineHeroSub, { color: colors.textMuted }]}>View routes, stops, and driving speed history</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* DRIVER SAFETY & ACTIVITY CARD */}
                  <View
                    style={[
                      styles.driverSafetyCard,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: colors.tileBorder,
                      },
                      webGlassTile,
                    ]}
                  >
                    <View style={styles.driverCardHeader}>
                      <View
                        style={[
                          styles.clipboardIcon,
                          { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EDE9FE' },
                        ]}
                      >
                        <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.driverCardTitle, { color: colors.textMain }]}>Drive & Safety Activity</Text>
                        <Text style={[styles.driverCardSubtitle, { color: colors.textSecondary }]}>Speed tracking, trip insights & safe habits</Text>
                      </View>
                    </View>

                    {/* Speeding Log */}
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => onViewSpeeding?.(effectiveMember)}
                      style={[styles.driverReportRow, { borderTopColor: colors.divider }]}
                    >
                      <View style={[styles.driverEventIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                        <Ionicons name="speedometer-outline" size={18} color={Colors.speeding} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.driverEventName, { color: colors.textMain }]}>Speeding Events</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>Review speed violations</Text>
                      </View>
                      <View style={styles.driverArrowWrap}>
                        <Text style={styles.driverStatusText}>View Log</Text>
                        <Feather name="arrow-right" size={16} color={colors.primary} />
                      </View>
                    </TouchableOpacity>

                    {/* Full Weekly Report Banner Button */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => onViewWeeklyReport?.(effectiveMember)}
                      style={[
                        styles.analyticsBannerBtn,
                        {
                          backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : colors.primaryLight,
                          borderColor: colors.primaryBorder,
                        },
                      ]}
                    >
                      <Ionicons name="analytics" size={18} color={colors.primary} />
                      <Text style={[styles.analyticsBannerText, { color: colors.primary }]}>View Driving Analytics & Report</Text>
                      <Feather name="chevron-right" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* PRIVACY BUBBLE SECTION: ONLY VISIBLE TO SELF */}
                  {effectiveMember.inBubble && isMemberSelf ? (
                    <View
                      style={[
                        styles.activeBubbleCard,
                        {
                          backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF',
                          borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : '#DDD6FE',
                        },
                        webGlassTile,
                      ]}
                    >
                      <View style={styles.activeBubbleHeader}>
                        <View style={styles.activeBubbleBadge}>
                          <Text style={styles.activeBubbleEmoji}>👻</Text>
                          <Text style={[styles.activeBubbleTitle, { color: colors.textMain }]}>Ghost Mode Active</Text>
                        </View>
                        <View style={[styles.liveStatusPill, { backgroundColor: isDark ? 'rgba(167, 139, 250, 0.25)' : '#EDE9FE' }]}>
                          <Text style={[styles.liveStatusText, { color: isDark ? '#C4B5FD' : '#7C3AED' }]}>PRIVATE</Text>
                        </View>
                      </View>

                      <Text style={[styles.activeBubbleDesc, { color: colors.textSecondary }]}>
                        Your exact location and speed are cloaked in a ~{Math.round((effectiveMember.bubbleRadius || 2000) / 1000)} km blur zone. Circle members are NOT notified and cannot see that Ghost Mode is active.
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onPopBubble?.(effectiveMember)}
                        style={[
                          styles.popBubbleBtn,
                          {
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                            borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
                          },
                        ]}
                      >
                        <Ionicons name="radio-button-off" size={16} color="#EF4444" />
                        <Text style={styles.popBubbleBtnText}>Turn Off Ghost Mode (Restore Exact Location)</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isMemberSelf && !effectiveMember.inBubble ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => onCreateBubbleTapped?.(effectiveMember)}
                      style={[
                        styles.createBubbleBtn,
                        {
                          backgroundColor: colors.tileBg,
                          borderColor: colors.tileBorder,
                        },
                        webGlassTile,
                      ]}
                    >
                      <Ionicons name="eye-off-outline" size={18} color={colors.primary} />
                      <Text style={[styles.createBubbleText, { color: colors.textMain }]}>Enable Ghost Mode</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Bottom Spacer */}
                  <View style={{ height: 16 }} />
                </ScrollView>

                {/* DOCKED BOTTOM ACTION BAR (Non-overlapping, direct flex sibling) */}
                <View
                  style={[
                    styles.fixedBottomDock,
                    {
                      backgroundColor: colors.card,
                      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.2)',
                      paddingBottom: Math.max(insets.bottom, 16),
                    },
                  ]}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                    bounces={true}
                    contentContainerStyle={styles.fixedButtonsScrollContainer}
                  >
                    {!isMemberSelf && !isSamePlaceOrNearby && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          if (effectiveMember.latitude && effectiveMember.longitude) {
                            openNavigationDirections(
                              effectiveMember.latitude,
                              effectiveMember.longitude,
                              effectiveMember.fullName,
                              distancePrefs.mode
                            );
                          } else {
                            Alert.alert('Location Unavailable', 'No GPS location available.');
                          }
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        style={[
                          styles.fixedActionPill,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.card,
                            borderColor: colors.cardBorder,
                          },
                        ]}
                      >
                        <Ionicons name="navigate-outline" size={17} color={colors.primary} />
                        <Text style={[styles.fixedActionText, { color: colors.textMain }]}>Direction</Text>
                      </TouchableOpacity>
                    )}

                    {!isMemberSelf && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleCallMember(effectiveMember)}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        style={[
                          styles.fixedActionPill,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.card,
                            borderColor: colors.cardBorder,
                          },
                        ]}
                      >
                        <Ionicons name="call-outline" size={16} color={colors.textMain} />
                        <Text style={[styles.fixedActionText, { color: colors.textMain }]}>Call</Text>
                      </TouchableOpacity>
                    )}

                    {!isMemberSelf && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          if (onOpenDirectChat) onOpenDirectChat(effectiveMember);
                          else onOpenChat?.();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        style={[
                          styles.fixedActionPill,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.card,
                            borderColor: colors.cardBorder,
                          },
                        ]}
                      >
                        <Ionicons name="chatbubble-outline" size={16} color={colors.textMain} />
                        <Text style={[styles.fixedActionText, { color: colors.textMain }]}>Message</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        if (isMemberSelf) {
                          onCheckInTapped?.();
                        } else {
                          setPlaceAlertActive(!placeAlertActive);
                          Alert.alert(
                            placeAlertActive ? 'Place Alerts Paused' : 'Place Alerts Active',
                            placeAlertActive
                              ? `You won't receive arrival/departure alerts for ${effectiveMember.fullName}`
                              : `You'll be notified when ${effectiveMember.fullName} arrives or leaves saved places.`
                          );
                        }
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      style={[
                        styles.fixedActionPill,
                        {
                          backgroundColor: placeAlertActive && !isMemberSelf ? (isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF') : (isDark ? 'rgba(255, 255, 255, 0.08)' : colors.card),
                          borderColor: placeAlertActive && !isMemberSelf ? colors.primary : colors.cardBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isMemberSelf ? 'checkmark-circle-outline' : (placeAlertActive ? 'notifications' : 'notifications-off-outline')}
                        size={16}
                        color={placeAlertActive && !isMemberSelf ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.fixedActionText, { color: placeAlertActive && !isMemberSelf ? colors.primary : colors.textMain }]}>
                        {isMemberSelf ? "I'm Here" : (placeAlertActive ? 'Alerts On' : 'Alerts')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => onViewTimeline?.(effectiveMember)}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      style={[
                        styles.fixedActionPill,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.card,
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <Feather name="rotate-ccw" size={16} color={colors.primary} />
                      <Text style={[styles.fixedActionText, { color: colors.textMain }]}>Timeline</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            );
          };

          return (
            <View style={styles.memberDetailContainer}>
              <Animated.ScrollView
                ref={horizontalScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled={true}
                directionalLockEnabled={true}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: horizontalScrollX } } }],
                  {
                    useNativeDriver: false,
                    listener: handleHorizontalScroll,
                  }
                )}
                onMomentumScrollEnd={handleHorizontalScrollEnd}
                onScrollEndDrag={handleHorizontalScrollEnd}
                style={styles.cardsTrackContainer}
                contentContainerStyle={[
                  { flexDirection: 'row' },
                  Platform.OS === 'web' ? ({ scrollSnapType: 'x mandatory' } as any) : null,
                ]}
              >
                {sliderMembers.map((member, index) => {
                  const cardTranslateY = horizontalScrollX.interpolate({
                    inputRange: [
                      (index - 1) * SCREEN_WIDTH,
                      index * SCREEN_WIDTH,
                      (index + 1) * SCREEN_WIDTH,
                    ],
                    outputRange: [75, 0, 75],
                    extrapolate: 'clamp',
                  });

                  const cardOpacity = horizontalScrollX.interpolate({
                    inputRange: [
                      (index - 1) * SCREEN_WIDTH,
                      index * SCREEN_WIDTH,
                      (index + 1) * SCREEN_WIDTH,
                    ],
                    outputRange: [0.35, 1, 0.35],
                    extrapolate: 'clamp',
                  });

                  const cardScale = horizontalScrollX.interpolate({
                    inputRange: [
                      (index - 1) * SCREEN_WIDTH,
                      index * SCREEN_WIDTH,
                      (index + 1) * SCREEN_WIDTH,
                    ],
                    outputRange: [0.93, 1, 0.93],
                    extrapolate: 'clamp',
                  });

                  return (
                    <View
                      key={member.id}
                      style={[
                        {
                          width: SCREEN_WIDTH,
                          height: '100%',
                        },
                        Platform.OS === 'web' ? ({ scrollSnapAlign: 'start', scrollSnapStop: 'always' } as any) : null,
                      ]}
                    >
                      <Animated.View
                        style={{
                          flex: 1,
                          opacity: cardOpacity,
                          transform: [
                            { translateY: cardTranslateY },
                            { scale: cardScale },
                          ],
                        }}
                      >
                        {renderMemberProfileCard(
                          member,
                          member.id === selectedMember.id,
                          index,
                          sliderMembers.length
                        )}
                      </Animated.View>
                    </View>
                  );
                })}
              </Animated.ScrollView>
            </View>
          );
        })() : (
          /* =========================================================================
              VIEW B: FAMILY MEMBERS LIST (Direct Family Tracking)
          ========================================================================= */
          <View style={styles.listContainer}>
            {/* FIXED TOP HEADER: Grab Handle Bar, Circle Name & Members Info */}
            <View
              {...panResponder.panHandlers}
              style={[
                styles.sketchFixedHeader,
                {
                  backgroundColor: colors.card,
                },
              ]}
            >
              {/* Centered Grab Handle Bar (Tap to toggle min/max height; drag to adjust height or dismiss) */}
              <View style={styles.sketchGrabArea}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={toggleSheet}
                  style={styles.handleTouch}
                  accessibilityLabel="Toggle members sheet height"
                >
                  <View
                    style={[
                      styles.grabBar,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* Fixed Top Bar: Circle Name & Sort By Button */}
              <View style={styles.sketchFixedTopBar}>
                <View style={[styles.sketchHeaderLeftCol, { paddingRight: 0 }]}>
                  <View style={styles.sketchFixedNameWrap}>
                    <Text style={[styles.sketchNameText, { color: colors.textMain }]} numberOfLines={1} ellipsizeMode="tail">
                      {selectedCircle ? selectedCircle.name : 'Family Circle'}
                    </Text>
                  </View>
                </View>

                {/* Clean, Simple Sort By Button */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowSortModal(true)}
                  style={[
                    styles.cleanSortBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0',
                    },
                  ]}
                  accessibilityLabel="Sort circle members"
                >
                  <Ionicons name="swap-vertical" size={13} color={colors.primary} />
                  <Text style={[styles.cleanSortBtnText, { color: colors.textMain }]}>
                    {getSortLabel(sortBy)}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>


            {/* 3. Family Safety Pulse Banner */}
            <View
              style={[
                styles.safetyPulseBanner,
                safetyPulse.type === 'warning'
                  ? {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
                    }
                  : {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.30)' : '#A7F3D0',
                    },
              ]}
            >
              <Ionicons
                name={safetyPulse.icon as any}
                size={15}
                color={safetyPulse.type === 'warning' ? '#EF4444' : '#10B981'}
              />
              <Text
                style={[
                  styles.safetyPulseText,
                  {
                    color: safetyPulse.type === 'warning'
                      ? (isDark ? '#FCA5A5' : '#B91C1C')
                      : (isDark ? '#6EE7B7' : '#047857'),
                  },
                ]}
                numberOfLines={1}
              >
                {safetyPulse.text}
              </Text>
            </View>


            {/* 4. Bento Member Cards Scroll View */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.memberListScroll,
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
            >
              {isLoadingMembers && members.length === 0 ? (
                <MemberCardSkeleton count={3} />
              ) : filteredMembers.length === 0 ? (
                <View style={styles.bentoEmptySearch}>
                  <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.bentoEmptyText, { color: colors.textMain }]}>
                    No members in this circle yet
                  </Text>
                </View>
              ) : (
                filteredMembers.map((member) => {
                  const effectiveMember = getEffectiveMember(member);
                  const isSelf = member.id === currentUserId;
                  const sinceText = formatSinceTime(effectiveMember);
                  const memberPlace = resolveMemberPlace(effectiveMember, savedPlaces, isSelf);
                  const isMovingNow = (effectiveMember.isMoving || (effectiveMember.speed || 0) >= 1.8) && !effectiveMember.isStationary;
                  const batt = getBatteryVisual(effectiveMember.batteryLevel, effectiveMember.isCharging, isDark);

                  // Extract clean display name: avoid appending (You) twice
                  const rawPublicName = (effectiveMember.fullName || 'Member').replace(/\s*\(You\)/gi, '').trim();
                  const currentNick = nicknames?.[effectiveMember.id]?.trim();
                  const primaryName = isSelf ? rawPublicName : (currentNick || rawPublicName);
                  const secondaryNick = isSelf ? null : (currentNick ? rawPublicName : null);

                  const prox = getMemberProximity(effectiveMember);
                  const selfLat = myPosition?.latitude || members.find((m) => m.id === currentUserId)?.latitude;
                  const selfLng = myPosition?.longitude || members.find((m) => m.id === currentUserId)?.longitude;
                  const selfMember = members.find((m) => m.id === currentUserId) || ({
                    id: currentUserId,
                    fullName: 'You',
                    latitude: selfLat,
                    longitude: selfLng,
                  } as any);
                  const selfPlace = resolveMemberPlace(getEffectiveMember(selfMember), savedPlaces, true);

                  const isAtHomeTogether = Boolean(
                    prox?.isAtHomeTogether ||
                    (selfPlace.isAtHome && memberPlace.isAtHome)
                  );
                  const isProxNearby = Boolean(prox?.isSamePlaceOrNearby || isAtHomeTogether);

                  // Compute real/formula distance & ETA for direction button
                  const distInfo = !isSelf && selfLat && selfLng && effectiveMember.latitude && effectiveMember.longitude
                    ? getMemberDistanceDisplay(
                        selfLat,
                        selfLng,
                        effectiveMember.latitude,
                        effectiveMember.longitude,
                        distancePrefs
                      )
                    : null;

                  const isPhysicallyNearby = Boolean(
                    !isSelf && !isAtHomeTogether && (
                      prox?.isSamePlaceOrNearby ||
                      (distInfo && distInfo.isNearby) ||
                      (distInfo && distInfo.rawMeters <= 250)
                    )
                  );
                  const isFav = favoriteMemberIds?.includes(member.id);

                  // Row 2: Location (If at home show "At Home", otherwise show location)
                  const locationDisplay = (() => {
                    // 1. Ghost Mode: ONLY visible to the self user
                    if (isSelf && member.inBubble) {
                      return {
                        isTag: true,
                        icon: <Text style={{ fontSize: 11, marginRight: 2.5 }}>👻</Text>,
                        text: 'Ghost Mode',
                        color: isDark ? '#C4B5FD' : '#7C3AED',
                        badgeBg: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF',
                        badgeBorder: isDark ? 'rgba(139, 92, 246, 0.35)' : '#DDD6FE',
                      };
                    }

                    // 2. At Home (Show strictly "At Home" in tag)
                    if (memberPlace.isAtHome) {
                      return {
                        isTag: true,
                        icon: <Ionicons name="home" size={11.5} color="#10B981" style={{ marginRight: 2.5 }} />,
                        text: 'At Home',
                        color: isDark ? '#34D399' : '#059669',
                        badgeBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                        badgeBorder: isDark ? 'rgba(16, 185, 129, 0.30)' : '#A7F3D0',
                      };
                    }

                    // 3. At Saved Place (Office, School, Gym)
                    if (memberPlace.isSavedPlace) {
                      const cleanTitle = memberPlace.placeName || memberPlace.title;
                      const label = cleanTitle.toLowerCase().startsWith('at ') ? cleanTitle : `At ${cleanTitle}`;
                      const isSchoolOrCollege = label.toLowerCase().includes('school') || label.toLowerCase().includes('college') || label.toLowerCase().includes('univ');
                      return {
                        isTag: true,
                        icon: <Ionicons name={isSchoolOrCollege ? 'school' : 'business'} size={11.5} color={colors.primary} style={{ marginRight: 2.5 }} />,
                        text: label,
                        color: colors.primary,
                        badgeBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#F0F9FF',
                        badgeBorder: isDark ? 'rgba(56, 189, 248, 0.30)' : '#BAE6FD',
                      };
                    }

                    // 4. Moving (Driving, Walking, etc.)
                    if (isMovingNow && memberPlace.activity) {
                      const roadAddr = effectiveMember.resolvedAddress ? effectiveMember.resolvedAddress.split(',')[0].trim() : '';
                      return {
                        isTag: true,
                        icon: <AnimatedActivityEmoji activity={memberPlace.activity} size={11.5} style={{ marginRight: 2.5 }} />,
                        text: roadAddr ? `${memberPlace.activity.label} • ${roadAddr}` : memberPlace.activity.label,
                        color: isDark ? '#A5B4FC' : '#4F46E5',
                        badgeBg: isDark ? 'rgba(99, 102, 241, 0.18)' : '#EEF2FF',
                        badgeBorder: isDark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                      };
                    }

                    // 5. Stationary Street Address -> NOT saved location! Show in simple text
                    const rawAddr = (effectiveMember.resolvedAddress || '').trim();
                    if (rawAddr) {
                      const shortStreet = rawAddr.split(',')[0].trim();
                      return {
                        isTag: false,
                        icon: <Ionicons name="location-outline" size={12} color={colors.textMuted} style={{ marginRight: 2.5 }} />,
                        text: shortStreet,
                        color: colors.textSecondary,
                        badgeBg: 'transparent',
                        badgeBorder: 'transparent',
                      };
                    }

                    // 6. Generic Fallback -> NOT saved location! Show in simple text
                    return {
                      isTag: false,
                      icon: (
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: member.isOnline ? '#10B981' : '#94A3B8',
                            marginRight: 3,
                          }}
                        />
                      ),
                      text: member.isOnline ? 'Online' : 'Offline',
                      color: colors.textSecondary,
                      badgeBg: 'transparent',
                      badgeBorder: 'transparent',
                    };
                  })();

                  // Row 3: Last status like "since"
                  const statusSinceInfo = (() => {
                    if (isMovingNow) {
                      const spdStr = formatSpeed(member.speed || 0, distancePrefs.unit);
                      return {
                        icon: <Ionicons name="speedometer-outline" size={11} color={colors.textMuted} style={{ marginRight: 2.5 }} />,
                        text: `Speed ${spdStr} • ${sinceText}`,
                      };
                    }
                    return {
                      icon: <Ionicons name="time-outline" size={11} color={colors.textMuted} style={{ marginRight: 2.5 }} />,
                      text: sinceText,
                    };
                  })();

                  // Direction button details (how far he is and estimated time)
                  // When nearby, also show exact distance (e.g. 80 m • < 1m) rather than suppressing to "Nearby"
                  const directionDetails = (() => {
                    const exactDistStr = (() => {
                      const m = distInfo?.rawMeters ?? (
                        selfLat && selfLng && member.latitude && member.longitude
                          ? calculateDistanceMeters(selfLat, selfLng, member.latitude, member.longitude)
                          : 0
                      );
                      if (!m || m <= 0) return null;
                      if (distancePrefs.unit === 'imperial') {
                        const ft = Math.round(m * 3.28084);
                        return ft < 500 ? `${ft} ft` : `${(m / 1609.344).toFixed(1)} mi`;
                      }
                      return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
                    })();

                    if (!exactDistStr) return 'Directions';

                    const eta = distInfo?.etaText || (distInfo && distInfo.rawMeters <= 300 ? '< 1m' : null);
                    if (eta) {
                      return `${exactDistStr} • ${eta}`;
                    }
                    return exactDistStr;
                  })();

                  return (
                    <TouchableOpacity
                      key={member.id}
                      activeOpacity={0.88}
                      onPress={() => onSelectMember(member)}
                      style={[
                        styles.compactCard,
                        {
                          backgroundColor: colors.tileBg,
                          borderColor: isSelf
                            ? (isDark ? 'rgba(99, 102, 241, 0.45)' : 'rgba(99, 102, 241, 0.35)')
                            : (isDark ? 'rgba(255, 255, 255, 0.08)' : colors.cardBorder),
                        },
                        isSelf && styles.compactCardSelfElevated,
                        webGlassTile,
                      ]}
                    >
                      {/* CARD TOP: Avatar + Middle Details + Battery Badge */}
                      <View style={styles.compactCardTop}>
                        {/* Avatar */}
                        <View style={styles.compactAvatarWrap}>
                          <Avatar
                            name={member.fullName}
                            avatarUrl={member.avatarUrl}
                            size={44}
                            borderWidth={2}
                            borderColor={isSelf ? colors.primary : colors.card}
                            statusBorderColor={colors.card}
                            showBattery={false}
                            showOnlineDot={true}
                            isOnline={member.isOnline}
                          />
                        </View>

                        {/* Middle Info Column */}
                        <View style={styles.compactCenterInfo}>
                          {/* Row 1: Name + Nickname + [You] Badge */}
                          <View style={styles.compactNameRow}>
                            <Text style={[styles.compactNameText, { color: colors.textMain }]} numberOfLines={1}>
                              {primaryName}
                              {secondaryNick ? (
                                <Text style={[styles.compactSecondaryNick, { color: colors.textMuted }]}>
                                  {' '}({secondaryNick})
                                </Text>
                              ) : null}
                            </Text>
                            {isSelf && (
                              <View style={[styles.compactYouBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' }]}>
                                <Text style={[styles.compactYouBadgeText, { color: colors.primary }]}>You</Text>
                              </View>
                            )}
                          </View>

                          {/* Row 2: Location (At Home and Nearby in tag; unsaved location in simple text) */}
                          <View style={styles.compactLocationRow}>
                            {/* If physically nearby and not at home, show the "Nearby" tag */}
                            {isPhysicallyNearby && !memberPlace.isAtHome && (
                              <View
                                style={[
                                  styles.compactNearbyTag,
                                  {
                                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                                    borderColor: isDark ? 'rgba(16, 185, 129, 0.30)' : '#A7F3D0',
                                  },
                                ]}
                              >
                                <Ionicons name="sparkles" size={10} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 2.5 }} />
                                <Text style={[styles.compactNearbyTagText, { color: isDark ? '#34D399' : '#059669' }]}>
                                  Nearby
                                </Text>
                              </View>
                            )}

                            {locationDisplay.isTag ? (
                              <View
                                style={[
                                  styles.compactLocationPill,
                                  {
                                    backgroundColor: locationDisplay.badgeBg,
                                    borderColor: locationDisplay.badgeBorder,
                                  },
                                ]}
                              >
                                {locationDisplay.icon}
                                <Text
                                  style={[
                                    styles.compactLocationPillText,
                                    { color: locationDisplay.color },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {locationDisplay.text}
                                </Text>
                              </View>
                            ) : (
                              /* Not saved location: simple text without tag wrapper */
                              (!isPhysicallyNearby || (locationDisplay.text !== 'Online' && locationDisplay.text !== 'Offline')) && (
                                <View style={styles.compactSimpleLocationWrap}>
                                  {locationDisplay.icon}
                                  <Text
                                    style={[
                                      styles.compactSimpleLocationText,
                                      { color: colors.textSecondary },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {locationDisplay.text}
                                  </Text>
                                </View>
                              )
                            )}
                          </View>

                          {/* Row 3: Last status like "since" */}
                          <View style={styles.compactSinceRow}>
                            {statusSinceInfo.icon}
                            <Text
                              style={[
                                styles.compactSinceText,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {statusSinceInfo.text}
                            </Text>
                          </View>
                        </View>

                        {/* Top-Right: Battery Badge */}
                        <View
                          style={[
                            styles.compactBatteryBadge,
                            {
                              backgroundColor: batt.bgColor,
                              borderColor: batt.borderColor,
                            },
                          ]}
                        >
                          <Ionicons name={batt.icon} size={11} color={batt.color} />
                          <Text style={[styles.compactBatteryText, { color: batt.textColor }]}>
                            {batt.levelText}
                          </Text>
                        </View>
                      </View>

                      {/* CARD BOTTOM: Compact Micro-Actions (Sleek, low-profile) */}
                      <View style={[styles.compactActionsDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' }]} />

                      <View style={styles.compactActionsContainer}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          contentContainerStyle={styles.compactActionsScroll}
                          style={styles.compactActionsScrollView}
                        >
                          {isSelf ? (
                            <>
                              {/* Ghost Mode */}
                              <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={handleGhostModeTapped}
                                style={[
                                  styles.compactActionBtn,
                                  member.inBubble
                                    ? { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2', borderColor: isDark ? '#EF4444' : '#FCA5A5' }
                                    : { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#EDE9FE', borderColor: isDark ? '#8B5CF6' : '#DDD6FE' },
                                ]}
                              >
                                {member.inBubble ? (
                                  <>
                                    <Ionicons name="radio-button-off" size={11.5} color="#EF4444" />
                                    <Text style={[styles.compactActionBtnText, { color: '#EF4444' }]}>Burst Ghost</Text>
                                  </>
                                ) : (
                                  <>
                                    <Text style={{ fontSize: 10.5 }}>👻</Text>
                                    <Text style={[styles.compactActionBtnText, { color: isDark ? '#C4B5FD' : '#7C3AED' }]}>Ghost Mode</Text>
                                  </>
                                )}
                              </TouchableOpacity>

                              {/* Check In */}
                              <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={onCheckInTapped}
                                style={[styles.compactActionBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9', borderColor: colors.cardBorder }]}
                              >
                                <Ionicons name="location-sharp" size={11.5} color={colors.primary} />
                                <Text style={[styles.compactActionBtnText, { color: colors.textMain }]}>I'm Here</Text>
                              </TouchableOpacity>

                              {/* Timeline */}
                              <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={() => onViewTimeline?.(member)}
                                style={[styles.compactActionBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9', borderColor: colors.cardBorder }]}
                              >
                                <Feather name="rotate-ccw" size={11} color={colors.textSecondary} />
                                <Text style={[styles.compactActionBtnText, { color: colors.textSecondary }]}>Timeline</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              {/* Directions: Do NOT show when both are together at home; show everywhere else with distance/time */}
                              {!isAtHomeTogether && (
                                <TouchableOpacity
                                  activeOpacity={0.75}
                                  onPress={() => {
                                    if (member.latitude && member.longitude) {
                                      openNavigationDirections(
                                        member.latitude,
                                        member.longitude,
                                        member.fullName,
                                        distancePrefs.mode
                                      );
                                    } else {
                                      Alert.alert('Location Unavailable', 'No GPS coordinates available.');
                                    }
                                  }}
                                  style={[
                                    styles.compactActionBtn,
                                    styles.compactDirectionBtn,
                                    {
                                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.14)' : '#EEF2FF',
                                      borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                                    },
                                  ]}
                                >
                                  <Ionicons name="navigate-outline" size={12} color={colors.primary} />
                                  <Text
                                    style={[styles.compactActionBtnText, { color: colors.primary }]}
                                    numberOfLines={1}
                                  >
                                    {directionDetails}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {/* Message */}
                              <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={() => {
                                  if (onOpenDirectChat) onOpenDirectChat(member);
                                  else onOpenChat?.();
                                }}
                                style={[styles.compactActionBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9', borderColor: colors.cardBorder }]}
                              >
                                <Ionicons name="chatbubble-outline" size={11.5} color={colors.textMain} />
                                <Text style={[styles.compactActionBtnText, { color: colors.textMain }]}>Message</Text>
                              </TouchableOpacity>

                              {/* Call */}
                              <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={() => handleCallMember(member)}
                                style={[styles.compactActionBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9', borderColor: colors.cardBorder }]}
                              >
                                <Ionicons name="call-outline" size={11.5} color={colors.textMain} />
                                <Text style={[styles.compactActionBtnText, { color: colors.textMain }]}>Call</Text>
                              </TouchableOpacity>

                              {/* Timeline */}
                              <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={() => onViewTimeline?.(member)}
                                style={[styles.compactActionBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9', borderColor: colors.cardBorder }]}
                              >
                                <Feather name="rotate-ccw" size={11} color={colors.textSecondary} />
                                <Text style={[styles.compactActionBtnText, { color: colors.textSecondary }]}>Timeline</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </ScrollView>

                        {/* Fixed Favorite / Heart button on Right side */}
                        {!isSelf && (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => onToggleFavorite?.(member)}
                            style={[
                              styles.compactActionIconBtn,
                              {
                                backgroundColor: isFav
                                  ? (isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3')
                                  : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                                borderColor: isFav ? '#EC4899' : colors.cardBorder,
                              },
                            ]}
                          >
                            <Ionicons
                              name={isFav ? 'heart' : 'heart-outline'}
                              size={13.5}
                              color={isFav ? '#EC4899' : colors.textMuted}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Invite a Member Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onAddPersonTapped}
                style={[
                  styles.bentoAddPersonCard,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                  webGlassTile,
                ]}
              >
                <View
                  style={[
                    styles.bentoAddPersonIconWrap,
                    { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF' },
                  ]}
                >
                  <Ionicons name="person-add" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bentoAddPersonTitle, { color: colors.primary }]}>Invite a Member</Text>
                  <Text style={[styles.bentoAddPersonSubtitle, { color: colors.textMuted }]}>
                    Share invite code to join this Circle
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {showNicknameModal && selectedMember && (
        <SetNicknameModal
          visible={showNicknameModal}
          memberName={selectedMember.fullName}
          memberId={selectedMember.id}
          currentNickname={nicknames[selectedMember.id] || ''}
          onClose={() => setShowNicknameModal(false)}
          onSave={(mId, nick) => {
            onUpdateNickname?.(mId, nick);
          }}
        />
      )}

      {/* SORT BY SELECTION MODAL */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.sortModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View
            style={[
              styles.sortModalContent,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.sortModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="swap-vertical" size={18} color={colors.primary} />
                <Text style={[styles.sortModalTitle, { color: colors.textMain }]}>Sort Members</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSortModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {[
              { id: 'distance' as const, label: 'Distance', desc: 'Closest to you first', icon: 'navigate-outline' },
              { id: 'movement' as const, label: 'Movement', desc: 'Moving & active members first', icon: 'bicycle-outline' },
              { id: 'status' as const, label: 'Status', desc: 'Online & connected first', icon: 'radio-outline' },
              { id: 'name' as const, label: 'Name', desc: 'Alphabetical order (A to Z)', icon: 'text-outline' },
              { id: 'battery' as const, label: 'Battery', desc: 'Lowest battery first', icon: 'battery-charging-outline' },
            ].map((opt) => {
              const isSelected = sortBy === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticService.selection();
                    setSortBy(opt.id);
                    AsyncStorage.setItem(STORAGE_KEY_MEMBER_SORT, opt.id).catch(() => {});
                    setShowSortModal(false);
                  }}
                  style={[
                    styles.sortOptionRow,
                    isSelected && {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
                    },
                  ]}
                >
                  <View style={styles.sortOptionLeft}>
                    <Ionicons
                      name={opt.icon as any}
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                      style={{ marginRight: 12 }}
                    />
                    <View>
                      <Text
                        style={[
                          styles.sortOptionLabel,
                          { color: isSelected ? colors.primary : colors.textMain, fontWeight: isSelected ? '700' : '600' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={[styles.sortOptionDesc, { color: colors.textMuted }]}>
                        {opt.desc}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  cleanSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  cleanSortBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sortModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sortModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  sortModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sortOptionLabel: {
    fontSize: 15,
  },
  sortOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  outerWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 120,
  },
  floatingMapActionsRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 125,
  },
  leftActionPillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  mapActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mapActionPillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  rightActionToolsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circularMapCtrlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    borderWidth: 1.5,
  },
  helpCircleBtn: {
    borderWidth: 1.5,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  lightSheetShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 16,
  },
  darkSheetShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    overflow: 'visible',
  },
  handleArea: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleTouch: {
    width: 140,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
  },
  listContainer: {
    flex: 1,
  },
  expandedListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  expandedSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  collapseSheetBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  bentoHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bentoHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bentoCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  bentoCountText: {
    fontSize: 12,
    fontWeight: '800',
  },
  bentoToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoSearchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bentoSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  bentoSearchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
    fontWeight: '500',
  },
  safetyPulseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  safetyPulseText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  tabsContainer: {
    paddingBottom: 10,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabActive: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTabInactive: {
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterTabCountBadge: {
    paddingHorizontal: 5.5,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bentoEmptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  bentoEmptyText: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 8,
  },
  compactCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  compactCardSelfElevated: {
    borderWidth: 1.5,
  },
  compactCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  compactAvatarWrap: {
    paddingTop: 1,
  },
  compactCenterInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  compactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactNameText: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  compactSecondaryNick: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactYouBadge: {
    paddingHorizontal: 5.5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  compactYouBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  compactLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
    maxWidth: '100%',
  },
  compactLocationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  compactLocationPillText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  compactNearbyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6.5,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  compactNearbyTagText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  compactSimpleLocationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    flexShrink: 1,
    maxWidth: '100%',
  },
  compactSimpleLocationText: {
    fontSize: 11.5,
    fontWeight: '500',
    flexShrink: 1,
  },
  compactSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  compactSinceText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  compactDistanceRow: {
    marginTop: 4,
  },
  compactDistanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 6.5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  compactDistanceChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactBatteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  compactBatteryText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  compactActionsDivider: {
    height: 1,
    marginVertical: 7,
  },
  compactActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactActionsScrollView: {
    flex: 1,
  },
  compactActionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 6,
  },
  compactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5.5,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  compactDirectionBtn: {
    paddingHorizontal: 12,
  },
  compactActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  compactActionIconBtn: {
    width: 29,
    height: 29,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bentoAddPersonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 2,
  },
  bentoAddPersonIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoAddPersonTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  bentoAddPersonSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  memberListScroll: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 110,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 14,
  },
  memberMainInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  memberNameBold: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  memberNameSecondary: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  memberDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 3,
  },
  memberDistanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  memberDistanceChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailDistanceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  detailDistanceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  realRoutePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginLeft: 4,
  },
  realRoutePillText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  memberLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  memberLocationSub: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  memberSinceSub: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  heartBtn: {
    padding: 6,
  },
  nicknameBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBubbleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowBubbleActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  addPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    marginTop: 4,
  },
  addPersonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPersonText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },


  /* Member Detail Styles */
  memberDetailScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  detailNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnTopRight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nicknameInlineBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarCenterWrap: {
    alignItems: 'center',
    marginTop: -20,
    marginBottom: 8,
  },
  nameAndAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  nameAddressTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  memberNameLarge: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  memberAddressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
    lineHeight: 18,
  },
  sinceText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  joinedAtBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  joinedAtBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  savePlaceCard: {
    width: 86,
    height: 80,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  savePlaceCardText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  reactionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  reactionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionEmoji: {
    fontSize: 18,
  },
  reactionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  placeAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeAlertTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickActionPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  quickActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  driverSafetyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  driverCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  clipboardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  driverReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  driverEventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  driverEventName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  driverArrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  analyticsBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  analyticsBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  createBubbleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  createBubbleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  miniSoonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginLeft: 2,
  },
  miniSoonBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.3,
  },
  activeBubbleCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  activeBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeBubbleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBubbleEmoji: {
    fontSize: 20,
  },
  activeBubbleTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  activeBubbleDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  popBubbleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  popBubbleBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  memberBubbleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  memberBubbleBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  // CareRing Member Details Styles
  careProfileSection: {
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  careHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  careHeroInfo: {
    flex: 1,
    marginLeft: 14,
  },
  careHeroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  careHeroName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  careHeroNickSecondary: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
    marginBottom: 4,
  },
  careStatusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  careStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  careStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  careStatusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  careBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  careBatteryText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  carePlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  carePlaceEmojiBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  carePlaceEmojiText: {
    fontSize: 24,
  },
  carePlaceDetails: {
    flex: 1,
  },
  carePlaceTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  carePlaceSub: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  careDistanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  careDistanceChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  careNudgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  careNudgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  careNudgeEmoji: {
    fontSize: 15,
  },
  careNudgeText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  careActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  careNavCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  careActionText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  timelineHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  timelineHeroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineHeroTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  timelineHeroSub: {
    fontSize: 12,
  },
  memberRowRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  rowBatteryText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Hand-Sketched Member Profile Styles */
  memberDetailContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  sketchFixedHeader: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomWidth: 0,
    zIndex: 100,
    elevation: 0,
  },
  sketchGrabArea: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    marginTop: 2,
    zIndex: 60,
  },
  profileGrabSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  profileNavArrow: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMemberCounterText: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  grabHeaderWithArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 4,
    width: '100%',
    zIndex: 70,
  },
  sliderNavArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberIndexIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  cardsTrackContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'visible',
  },
  currentCardPositioner: {
    width: SCREEN_WIDTH,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  adjacentCardPositioner: {
    width: SCREEN_WIDTH,
    height: '100%',
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  profileSingleCard: {
    width: SCREEN_WIDTH,
    height: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'visible',
    elevation: 0,
  },
  floatingReactionsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: 16,
  },
  floatingReactionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  floatingReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingReactionEmoji: {
    fontSize: 16,
  },
  floatingReactionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sketchFixedTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    gap: 8,
  },
  sketchRightOverflowAvatarWrap: {
    position: 'absolute',
    top: -24,
    right: 18,
    zIndex: 150,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  sketchHeaderLeftCol: {
    flex: 1,
    paddingRight: 68,
    justifyContent: 'center',
  },
  sketchFixedNameWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  sketchSinceAndMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  sketchNameWithDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sketchOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  sketchContentSection: {
    paddingHorizontal: 2,
  },
  sketchInfoCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
  },
  sketchNameText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sketchSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sketchSinceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sketchLikeAndBatteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  sketchSmallHeartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sketchBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  sketchBatteryText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  sketchLocationFullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 10,
  },
  sketchLocationTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sketchLocationDetailsCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  sketchLocationText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sketchLocationSubText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  sketchLocationIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  sketchLocationIconEmoji: {
    fontSize: 24,
  },
  sketchDistanceFullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  sketchDistanceText: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  fixedBottomDock: {
    borderTopWidth: 1,
    paddingTop: 8,
    zIndex: 100,
    elevation: 0,
  },
  fixedButtonsScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 28,
    paddingVertical: 4,
    minHeight: 52,
    backgroundColor: 'transparent',
  },
  fixedActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  fixedActionText: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});

// React.memo prevents re-renders when MapScreen state unrelated to the member
// list changes (e.g., chat modal open/close, bubble toggle, active nav tab).
export const BottomDraggableSheet = React.memo(BottomDraggableSheetInner);
