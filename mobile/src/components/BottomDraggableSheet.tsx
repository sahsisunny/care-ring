import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  Switch,
  Platform,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { MemberData, formatSinceTime, formatJoinedDate } from '../models/Member';
import { Avatar } from './Avatar';
import {
  calculateDistanceMeters,
  formatDistance,
  openNavigationDirections,
  getMemberDistanceDisplay,
  fetchMemberDistanceDisplay,
  DistanceDisplayResult,
  NEARBY_THRESHOLD_METERS,
} from '../utils/distance';
import {
  distancePreferencesService,
  DistancePreferences,
  TRANSPORT_MODES,
} from '../services/DistancePreferencesService';
import { routingService } from '../services/RoutingService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle, getWebGlassPillStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { SetNicknameModal } from './modals/SetNicknameModal';
import { NicknameService } from '../services/NicknameService';
import { MemberCardSkeleton } from './common/Skeleton';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_COLLAPSED_HEIGHT = 230;
const MAX_EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.70, SCREEN_HEIGHT - 170);

const COLLAPSED_HEIGHT = MIN_COLLAPSED_HEIGHT;
const EXPANDED_HEIGHT = MAX_EXPANDED_HEIGHT;
const MEMBER_DETAIL_HEIGHT = MAX_EXPANDED_HEIGHT;

interface BottomDraggableSheetProps {
  members: MemberData[];
  savedPlaces?: any[];
  isLoadingMembers?: boolean;
  selectedMember: MemberData | null;
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
  onExpandChange?: (isExpanded: boolean) => void;
  collapseTrigger?: number;
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

export interface ResolvedMemberPlace {
  title: string;
  subtitle?: string;
  emoji: string;
  isSavedPlace: boolean;
  placeName?: string;
  isAtHome?: boolean;
}

/**
 * Resolves whether a member is currently at a set/saved place (Home, Office, etc.)
 * by geofence coordinates or address keywords, returning contextual display info.
 */
export function resolveMemberPlace(
  member: MemberData,
  savedPlaces: any[] = []
): ResolvedMemberPlace {
  // 1. Privacy Bubble Active
  if (member.inBubble) {
    const bubbleKm = Math.round((member.bubbleRadius || 2000) / 1000);
    return {
      title: 'Privacy Bubble Active',
      subtitle: `Approximate area (~${bubbleKm}km)`,
      emoji: '🫧',
      isSavedPlace: false,
    };
  }

  // 2. In Transit / Driving
  if (member.isMoving) {
    const speed = Math.round(member.speed || 0);
    return {
      title: speed > 0 ? `Driving • ${speed} km/h` : 'In Transit / Moving',
      subtitle: member.resolvedAddress ? `Near ${member.resolvedAddress}` : 'Moving',
      emoji: '🚗',
      isSavedPlace: false,
    };
  }

  const mLat = Number(member.latitude);
  const mLng = Number(member.longitude);
  const hasValidCoords = !isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0;

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
        subtitle: isHome ? undefined : (closestPlace.address || member.resolvedAddress || ''),
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
      subtitle: addr || undefined,
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
      subtitle: addr || undefined,
      emoji: '🎓',
      isSavedPlace: true,
      placeName: 'School',
    };
  }

  if (addrLower.includes('gym') || addrLower.includes('fitness')) {
    return {
      title: 'At Gym',
      subtitle: addr || undefined,
      emoji: '💪',
      isSavedPlace: true,
      placeName: 'Gym',
    };
  }

  // 5. Stationary fallback if address is empty
  if (!addr) {
    return {
      title: 'At home',
      subtitle: undefined,
      emoji: '🏠',
      isSavedPlace: true,
      placeName: 'Home',
      isAtHome: true,
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
export function isAtSameSetPlace(
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
  onExpandChange,
  collapseTrigger,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [placeAlertActive, setPlaceAlertActive] = useState(true);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const [showFloatingActions, setShowFloatingActions] = useState(true);

  const topSafeOffset = Math.max(insets.top, 24);
  const effectiveExpandedHeight = Math.min(SCREEN_HEIGHT * 0.70, SCREEN_HEIGHT - 170);

  useEffect(() => {
    const listenerId = sheetHeight.addListener(({ value }) => {
      const shouldShow = value < COLLAPSED_HEIGHT + 60;
      setShowFloatingActions((prev) => (prev !== shouldShow ? shouldShow : prev));
      if (!selectedMember) {
        if (value > COLLAPSED_HEIGHT + 50) {
          onExpandChange?.(true);
        } else if (value <= COLLAPSED_HEIGHT + 20) {
          onExpandChange?.(false);
        }
      }
    });
    return () => {
      sheetHeight.removeListener(listenerId);
    };
  }, [selectedMember, onExpandChange]);

  const floatingActionsOpacity = sheetHeight.interpolate({
    inputRange: [COLLAPSED_HEIGHT, COLLAPSED_HEIGHT + 35, COLLAPSED_HEIGHT + 70],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const floatingActionsScale = sheetHeight.interpolate({
    inputRange: [COLLAPSED_HEIGHT, COLLAPSED_HEIGHT + 70],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });

  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassSheet = getWebGlassCardStyle(isDark, isGlass);
  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  // Self user ("You") always appears at the top of the family member list; deduplicated by ID
  const sortedMembers = useMemo(() => {
    const seen = new Set<string>();
    const unique: MemberData[] = [];
    for (const m of members) {
      if (m && m.id && !seen.has(m.id)) {
        seen.add(m.id);
        unique.push(m);
      }
    }
    return unique.sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return 0;
    });
  }, [members, currentUserId]);

  const selectedMemberRef = useRef(selectedMember);
  selectedMemberRef.current = selectedMember;
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;
  const onDeselectMemberRef = useRef(onDeselectMember);
  onDeselectMemberRef.current = onDeselectMember;
  const onExpandChangeRef = useRef(onExpandChange);
  onExpandChangeRef.current = onExpandChange;
  const detailScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (selectedMember) {
      setIsExpanded(false);
      onExpandChange?.(false);
      animateToHeight(MEMBER_DETAIL_HEIGHT, false);
      // Ensure scroll offset is immediately reset to 0 so no items are hidden at the top
      requestAnimationFrame(() => {
        detailScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    } else {
      setIsExpanded(false);
      onExpandChange?.(false);
      animateToHeight(COLLAPSED_HEIGHT, false);
    }
  }, [selectedMember?.id, selectedMember != null]);

  const startDragHeight = useRef(COLLAPSED_HEIGHT);

  const animateToHeight = (toValue: number, expandedState: boolean, velocity?: number) => {
    setIsExpanded(expandedState);
    if (!selectedMemberRef.current) {
      onExpandChangeRef.current?.(expandedState);
    }
    Animated.spring(sheetHeight, {
      toValue,
      velocity: velocity ? -velocity : undefined,
      friction: 9,
      tension: 45,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    if (collapseTrigger && collapseTrigger > 0) {
      animateToHeight(COLLAPSED_HEIGHT, false);
    }
  }, [collapseTrigger]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // When member profile is open, family pan responder is inactive
        if (selectedMemberRef.current) return false;
        return Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderGrant: () => {
        startDragHeight.current = isExpandedRef.current ? effectiveExpandedHeight : COLLAPSED_HEIGHT;
      },
      onPanResponderMove: (_, gesture) => {
        if (selectedMemberRef.current) return;

        const targetHeight = startDragHeight.current - gesture.dy;
        // Strictly clamp with fixed minimum bottom and maximum top boundaries so sheet never drags too low
        const clampedHeight = Math.max(
          MIN_COLLAPSED_HEIGHT - 6,
          Math.min(MAX_EXPANDED_HEIGHT + 6, targetHeight)
        );
        sheetHeight.setValue(clampedHeight);

        // Update expand state flags dynamically during drag
        if (targetHeight > MIN_COLLAPSED_HEIGHT + 50 && !isExpandedRef.current) {
          setIsExpanded(true);
          onExpandChangeRef.current?.(true);
        } else if (targetHeight <= MIN_COLLAPSED_HEIGHT + 25 && isExpandedRef.current) {
          setIsExpanded(false);
          onExpandChangeRef.current?.(false);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (selectedMemberRef.current) return;

        const midpoint = (MAX_EXPANDED_HEIGHT + MIN_COLLAPSED_HEIGHT) / 2;
        const currentHeight = startDragHeight.current - gesture.dy;

        // Snappy, momentum-based snap decision
        let shouldExpand = isExpandedRef.current;
        if (gesture.vy < -0.3 || gesture.dy < -30) {
          shouldExpand = true;
        } else if (gesture.vy > 0.3 || gesture.dy > 30) {
          shouldExpand = false;
        } else {
          shouldExpand = currentHeight > midpoint;
        }

        animateToHeight(shouldExpand ? MAX_EXPANDED_HEIGHT : MIN_COLLAPSED_HEIGHT, shouldExpand, gesture.vy);
      },
    })
  ).current;

  const toggleSheet = () => {
    if (selectedMember) return;
    if (isExpanded) {
      animateToHeight(COLLAPSED_HEIGHT, false);
    } else {
      animateToHeight(effectiveExpandedHeight, true);
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
    if (!selfLat || !selfLng || !member.latitude || !member.longitude) return null;

    const selfMember = members.find((m) => m.id === currentUserId) || ({
      id: currentUserId,
      fullName: 'You',
      latitude: selfLat,
      longitude: selfLng,
    } as any);

    const selfPlace = resolveMemberPlace(selfMember, savedPlaces);
    const memberPlace = resolveMemberPlace(member, savedPlaces);
    const rawMeters = calculateDistanceMeters(selfLat, selfLng, member.latitude, member.longitude);

    // 1. Both marked as being at Home
    if (selfPlace.isAtHome && memberPlace.isAtHome) {
      return {
        isSamePlaceOrNearby: true,
        isAtHomeTogether: true,
        isSameSetPlace: true,
        placeName: 'Home',
        badgeLabel: 'At Home',
        detailLabel: 'At Home',
        icon: 'home' as const,
      };
    }

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
        detailLabel: label,
        icon: (memberPlace.isAtHome ? 'home' : (memberPlace.isSavedPlace ? 'business' : 'location-sharp')) as any,
      };
    }

    // 3. Same physical location NOT at any set places (e.g. restaurant, cafe, park, street, same coordinates)
    const isNearbyMeters = rawMeters <= NEARBY_THRESHOLD_METERS;
    const isSameAddress = Boolean(
      selfPlace.title &&
      memberPlace.title &&
      selfPlace.title.trim().toLowerCase() === memberPlace.title.trim().toLowerCase() &&
      rawMeters <= 250
    );

    if (isNearbyMeters || isSameAddress) {
      return {
        isSamePlaceOrNearby: true,
        isAtHomeTogether: false,
        isSameSetPlace: false,
        badgeLabel: 'Nearby you',
        detailLabel: 'Nearby you',
        icon: 'sparkles' as const,
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

  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      {/* 1. Floating Map Action Buttons above sheet (Hidden when drawer expands to top) */}
      {!selectedMember && (
        <Animated.View
          style={[
            styles.floatingMapActionsRow,
            {
              bottom: Animated.add(sheetHeight, 14),
              opacity: floatingActionsOpacity,
              transform: [{ scale: floatingActionsScale }],
            },
          ]}
          pointerEvents={showFloatingActions ? 'box-none' : 'none'}
        >
          {/* Left/Center Action Pills: Check In & SOS */}
          <View style={styles.actionPillsGroup}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onCheckInTapped}
              style={[
                styles.mapActionPill,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                webGlassPill,
              ]}
            >
              <Ionicons name="checkmark" size={17} color={colors.primary} />
              <Text style={[styles.mapActionPillText, { color: colors.textMain }]}>Check in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onSOSTapped}
              style={[
                styles.mapActionPill,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                webGlassPill,
              ]}
            >
              <Ionicons name="medical" size={16} color={colors.sos} />
              <Text style={[styles.mapActionPillText, { color: colors.textMain }]}>SOS</Text>
            </TouchableOpacity>
          </View>

          {/* Right Floating Controls: Recenter GPS & Map Layers */}
          <View style={styles.rightMapControlsGroup}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onGoToMyLocation}
              style={[
                styles.circularMapCtrlBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                webGlassPill,
              ]}
            >
              <MaterialIcons name="my-location" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onToggleMapLayers}
              style={[
                styles.circularMapCtrlBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                webGlassPill,
              ]}
            >
              <Ionicons name="layers" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* 2. Draggable Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: sheetHeight,
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
          isGlass && (isDark ? styles.darkSheetShadow : styles.lightSheetShadow),
          webGlassSheet,
        ]}
      >
        {/* Grab Handle Header */}
        {!selectedMember && (
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <TouchableOpacity onPress={toggleSheet} style={styles.handleTouch}>
              <View
                style={[
                  styles.grabBar,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1' },
                ]}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* =========================================================================
            VIEW A: MEMBER DETAIL VIEW
        ========================================================================= */}
        {selectedMember ? (() => {
          const detailDisplay = NicknameService.getNameDisplay(
            selectedMember,
            nicknames,
            isSelectedSelf
          );
          const proximityInfo = getMemberProximity(selectedMember);
          const isSamePlaceOrNearby = Boolean(proximityInfo?.isSamePlaceOrNearby);
          const distInfo = !isSelectedSelf && !isSamePlaceOrNearby ? (selectedRouteInfo || getDistanceInfo(selectedMember)) : null;
          const isNearby = isSamePlaceOrNearby || (distInfo ? (distInfo.isNearby || distInfo.rawMeters <= NEARBY_THRESHOLD_METERS) : false);

          const placeInfo = resolveMemberPlace(selectedMember, savedPlaces);

          const placeSub = selectedMember.isMoving
            ? `${Math.round(selectedMember.speed || 0)} km/h • Moving`
            : formatSinceTime(selectedMember);

          const showNick = Boolean(
            detailDisplay.secondary &&
            detailDisplay.secondary.trim().toLowerCase() !== detailDisplay.primary.trim().toLowerCase() &&
            detailDisplay.secondary.trim().toLowerCase() !== 'you'
          );

          const batt = getBatteryVisual(selectedMember.batteryLevel, selectedMember.isCharging, isDark);

          return (
            <View style={styles.memberDetailContainer}>
              {/* FIXED TOP HEADER: Photo Avatar, Name with online dot, Since, Like button, Battery percentage */}
              <View
                style={[
                  styles.sketchFixedHeader,
                  {
                    backgroundColor: colors.card,
                    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(148, 163, 184, 0.15)',
                  },
                ]}
              >
                {/* Prominent Center Profile Avatar with Overflow over top sheet border */}
                <View style={styles.sketchOverflowAvatarWrap} pointerEvents="box-none">
                  <Avatar
                    name={selectedMember.fullName}
                    avatarUrl={selectedMember.avatarUrl}
                    size={78}
                    borderWidth={4}
                    borderColor={colors.card}
                    statusBorderColor={colors.card}
                    showBattery={false}
                    showOnlineDot={true}
                    isOnline={selectedMember.isOnline}
                    dotPosition="bottom-right"
                  />
                </View>

                {/* Fixed Top Bar */}
                <View style={styles.sketchFixedTopBar}>
                  {/* Left: Name & Since Duration */}
                  <View style={styles.sketchFixedNameWrap}>
                    <Text style={[styles.sketchNameText, { color: colors.textMain }]} numberOfLines={1} ellipsizeMode="tail">
                      {detailDisplay.primary}{showNick ? ` (${detailDisplay.secondary})` : ''}
                    </Text>
                    <View style={styles.sketchSinceRow}>
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={[styles.sketchSinceText, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                        {placeSub}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Like Button & Battery Pill */}
                  <View style={styles.sketchLikeAndBatteryRow}>
                    {!isSelectedSelf && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => onToggleFavorite?.(selectedMember)}
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
                          name={favoriteMemberIds?.includes(selectedMember.id) ? 'heart' : 'heart-outline'}
                          size={16}
                          color={favoriteMemberIds?.includes(selectedMember.id) ? '#EC4899' : colors.textMuted}
                        />
                      </TouchableOpacity>
                    )}

                    <View
                      style={[
                        styles.sketchBatteryPill,
                        {
                          backgroundColor: batt.bgColor,
                          borderColor: batt.borderColor,
                        },
                      ]}
                    >
                      <Ionicons name={batt.icon} size={12} color={batt.color} />
                      <Text style={[styles.sketchBatteryText, { color: batt.textColor }]}>
                        {batt.levelText}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* SCROLLABLE BODY: Content scrolls below fixed header (always resets to top) */}
              <ScrollView
                key={`profile-scroll-${selectedMember.id}`}
                ref={detailScrollRef}
                style={{ flex: 1 }}
                contentOffset={{ x: 0, y: 0 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.memberDetailScroll,
                  { paddingBottom: 24 },
                ]}
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
                          color={placeInfo.isAtHome ? '#10B981' : '#7C3AED'}
                          style={{ marginTop: 2 }}
                        />
                        <View style={styles.sketchLocationDetailsCol}>
                          <Text style={[styles.sketchLocationText, { color: colors.textMain }]} numberOfLines={1} ellipsizeMode="tail">
                            {placeInfo.title}
                          </Text>
                          {Boolean(!placeInfo.isAtHome && placeInfo.subtitle && placeInfo.subtitle !== placeInfo.title) && (
                            <Text style={[styles.sketchLocationSubText, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                              {placeInfo.subtitle}
                            </Text>
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
                              : (isDark ? 'rgba(124, 58, 237, 0.22)' : '#EDE9FE'),
                            borderColor: placeInfo.isAtHome
                              ? (isDark ? 'rgba(16, 185, 129, 0.40)' : '#A7F3D0')
                              : (isDark ? 'rgba(124, 58, 237, 0.40)' : '#C4B5FD'),
                          },
                        ]}
                      >
                        {placeInfo.isAtHome ? (
                          <Ionicons name="home" size={17} color="#10B981" />
                        ) : (
                          <Text style={styles.sketchLocationIconEmoji}>{placeInfo.emoji}</Text>
                        )}
                      </View>
                    </View>

                    {/* Distance / Nearby Row */}
                    {!isSelectedSelf && (
                      isSamePlaceOrNearby && proximityInfo ? (
                        // If users are on a non-set location together, show "Nearby you"
                        !proximityInfo.isSameSetPlace ? (
                          <View
                            style={[
                              styles.sketchDistanceFullRow,
                              {
                                backgroundColor: isDark ? 'rgba(124, 58, 237, 0.14)' : '#F5F3FF',
                                borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#DDD6FE',
                              },
                            ]}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: isDark ? 'rgba(124, 58, 237, 0.22)' : '#EDE9FE',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons
                                name="sparkles"
                                size={13}
                                color={colors.primary}
                              />
                            </View>
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
                              Nearby you
                            </Text>
                          </View>
                        ) : null
                      ) : (
                        distInfo && !isNearby && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                              if (selectedMember.latitude && selectedMember.longitude) {
                                openNavigationDirections(
                                  selectedMember.latitude,
                                  selectedMember.longitude,
                                  selectedMember.fullName,
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
                              {distInfo.formattedDistance} away {distInfo.etaText ? `• ~${distInfo.etaText}` : ''}
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
                    onPress={() => onViewTimeline?.(selectedMember)}
                    style={[styles.timelineHeroRow, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
                  >
                    <View style={[styles.timelineHeroIcon, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EDE9FE' }]}>
                      <Feather name="rotate-ccw" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.timelineHeroTitle, { color: colors.textMain }]}>30-Day Movement Timeline</Text>
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
                    onPress={() => onViewSpeeding?.(selectedMember)}
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
                    onPress={() => onViewWeeklyReport?.(selectedMember)}
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

                {/* PRIVACY BUBBLE SECTION */}
                {selectedMember.inBubble ? (
                  isSelectedSelf ? (
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
                          <Text style={styles.activeBubbleEmoji}>🫧</Text>
                          <Text style={[styles.activeBubbleTitle, { color: colors.textMain }]}>Privacy Bubble Active</Text>
                        </View>
                        <View style={[styles.liveStatusPill, { backgroundColor: isDark ? 'rgba(167, 139, 250, 0.25)' : '#EDE9FE' }]}>
                          <Text style={[styles.liveStatusText, { color: isDark ? '#C4B5FD' : '#7C3AED' }]}>ACTIVE</Text>
                        </View>
                      </View>

                      <Text style={[styles.activeBubbleDesc, { color: colors.textSecondary }]}>
                        Family sees an approximate ~{Math.round((selectedMember.bubbleRadius || 2000) / 1000)} km radius. Exact address and raw speed are hidden.
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onPopBubble?.(selectedMember)}
                        style={[
                          styles.popBubbleBtn,
                          {
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                            borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
                          },
                        ]}
                      >
                        <Ionicons name="radio-button-off" size={16} color="#EF4444" />
                        <Text style={styles.popBubbleBtnText}>Burst Bubble (Restore Exact Location)</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.memberBubbleBanner,
                        {
                          backgroundColor: isDark ? 'rgba(139, 92, 246, 0.12)' : '#F5F3FF',
                          borderColor: isDark ? 'rgba(139, 92, 246, 0.3)' : '#DDD6FE',
                        },
                        webGlassTile,
                      ]}
                    >
                      <Ionicons name="shield-checkmark" size={18} color="#8B5CF6" />
                      <Text style={[styles.memberBubbleBannerText, { color: colors.textSecondary }]}>
                        {selectedMember.fullName.split(' ')[0]} is in a Privacy Bubble (~{Math.round((selectedMember.bubbleRadius || 2000) / 1000)}km zone).
                      </Text>
                    </View>
                  )
                ) : isSelectedSelf ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => onCreateBubbleTapped?.(selectedMember)}
                    style={[
                      styles.createBubbleBtn,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: colors.tileBorder,
                      },
                      webGlassTile,
                    ]}
                  >
                    <Ionicons name="radio-button-on" size={18} color={colors.primary} />
                    <Text style={[styles.createBubbleText, { color: colors.textMain }]}>Create Bubble</Text>
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
                  keyboardShouldPersistTaps="always"
                  nestedScrollEnabled={true}
                  canCancelContentTouches={false}
                  bounces={false}
                  contentContainerStyle={styles.fixedButtonsScrollContainer}
                >
                  {!isSelectedSelf && !isSamePlaceOrNearby && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        if (selectedMember.latitude && selectedMember.longitude) {
                          openNavigationDirections(
                            selectedMember.latitude,
                            selectedMember.longitude,
                            selectedMember.fullName,
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

                  {!isSelectedSelf && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleCallMember(selectedMember)}
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

                  {!isSelectedSelf && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        if (onOpenDirectChat) onOpenDirectChat(selectedMember);
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
                      if (isSelectedSelf) {
                        onCheckInTapped?.();
                      } else {
                        setPlaceAlertActive(!placeAlertActive);
                        Alert.alert(
                          placeAlertActive ? 'Place Alerts Paused' : 'Place Alerts Active',
                          placeAlertActive
                            ? `You won't receive arrival/departure alerts for ${selectedMember.fullName}`
                            : `You'll be notified when ${selectedMember.fullName} arrives or leaves saved places.`
                        );
                      }
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    style={[
                      styles.fixedActionPill,
                      {
                        backgroundColor: placeAlertActive && !isSelectedSelf ? (isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF') : (isDark ? 'rgba(255, 255, 255, 0.08)' : colors.card),
                        borderColor: placeAlertActive && !isSelectedSelf ? colors.primary : colors.cardBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isSelectedSelf ? 'checkmark-circle-outline' : (placeAlertActive ? 'notifications' : 'notifications-off-outline')}
                      size={16}
                      color={placeAlertActive && !isSelectedSelf ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.fixedActionText, { color: placeAlertActive && !isSelectedSelf ? colors.primary : colors.textMain }]}>
                      {isSelectedSelf ? 'Check In' : (placeAlertActive ? 'Alerts On' : 'Alerts')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onViewTimeline?.(selectedMember)}
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
        })() : (
          /* =========================================================================
              VIEW B: FAMILY MEMBERS LIST (Direct Family Tracking)
          ========================================================================= */
          <View style={styles.listContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.memberListScroll,
                { paddingBottom: 110 + insets.bottom },
              ]}
              onScrollEndDrag={(e) => {
                if (e.nativeEvent.contentOffset.y < -35 && isExpandedRef.current) {
                  animateToHeight(COLLAPSED_HEIGHT, false);
                }
              }}
            >
              {isLoadingMembers && members.length === 0 ? (
                <MemberCardSkeleton count={3} />
              ) : (
                sortedMembers.map((member) => {
                  const isSelf = member.id === currentUserId;
                  const sinceText = formatSinceTime(member);
                  const distanceText = getDistanceText(member);

                  return (
                    <TouchableOpacity
                      key={member.id}
                      activeOpacity={0.8}
                      onPress={() => onSelectMember(member)}
                      style={[
                        styles.memberRow,
                        {
                          backgroundColor: colors.tileBg,
                          borderColor: colors.tileBorder,
                          borderWidth: 1,
                          borderRadius: 20,
                          marginBottom: 10,
                          paddingHorizontal: 16,
                          paddingVertical: 13,
                        },
                        webGlassTile,
                      ]}
                    >
                      <Avatar
                        name={member.fullName}
                        avatarUrl={member.avatarUrl}
                        size={52}
                        borderWidth={2}
                        borderColor={colors.card}
                        statusBorderColor={colors.card}
                        showBattery={false}
                        showOnlineDot={true}
                        isOnline={member.isOnline}
                      />

                      <View style={styles.memberMainInfo}>
                        {(() => {
                          const itemDisplay = NicknameService.getNameDisplay(member, nicknames, isSelf);
                          const showSecondary = Boolean(
                            itemDisplay.secondary &&
                            itemDisplay.secondary.trim().toLowerCase() !== itemDisplay.primary.trim().toLowerCase() &&
                            itemDisplay.secondary.trim().toLowerCase() !== 'you'
                          );
                          const prox = getMemberProximity(member);
                          const isProxNearby = Boolean(prox?.isSamePlaceOrNearby);
                          const distInfo = !isSelf && !isProxNearby ? getDistanceInfo(member) : null;
                          const hasDistance = Boolean(
                            distInfo &&
                            !distInfo.isNearby &&
                            distInfo.rawMeters > NEARBY_THRESHOLD_METERS
                          );

                          return (
                            <>
                              {/* 1. Full-width Member Name Row: primary name + secondary nickname seamlessly formatted */}
                              <View style={styles.memberNameRow}>
                                <Text style={[styles.memberNameBold, { color: colors.textMain }]} numberOfLines={1}>
                                  {itemDisplay.primary}
                                  {showSecondary ? (
                                    <Text style={[styles.memberNameSecondary, { color: colors.textMuted }]}>
                                      {' '}({itemDisplay.secondary})
                                    </Text>
                                  ) : null}
                                </Text>
                              </View>

                              {/* 2. Distance Badge: on its own dedicated row below the name, never squeezing the name */}
                              {(() => {
                                if (isSelf) return null;
                                // Show "Nearby you" chip only when at a location NOT set (e.g. co-located on street/cafe)
                                if (isProxNearby && prox && !prox.isSameSetPlace) {
                                  return (
                                    <View style={styles.memberDistanceRow}>
                                      <View
                                        style={[
                                          styles.memberDistanceChip,
                                          {
                                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.10)',
                                            borderColor: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.22)',
                                          },
                                        ]}
                                      >
                                        <Ionicons
                                          name="sparkles"
                                          size={10.5}
                                          color="#10B981"
                                        />
                                        <Text style={[styles.memberDistanceChipText, { color: isDark ? '#34D399' : '#059669', fontWeight: '700' }]}>
                                          Nearby you
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                }

                                if (hasDistance && distInfo) {
                                  return (
                                    <View style={styles.memberDistanceRow}>
                                      <View
                                        style={[
                                          styles.memberDistanceChip,
                                          {
                                            backgroundColor: isDark
                                              ? 'rgba(56, 189, 248, 0.15)'
                                              : 'rgba(14, 165, 233, 0.10)',
                                            borderColor: isDark
                                              ? 'rgba(56, 189, 248, 0.25)'
                                              : 'rgba(14, 165, 233, 0.20)',
                                          },
                                        ]}
                                      >
                                        <Ionicons
                                          name={(distInfo.icon as any) || 'navigate'}
                                          size={10.5}
                                          color={colors.primary}
                                        />
                                        <Text style={[styles.memberDistanceChipText, { color: colors.primary }]}>
                                          {distInfo.compactDistance}
                                          {distInfo.etaText ? ` • ${distInfo.etaText}` : ''}
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                }

                                return null;
                              })()}
                            </>
                          );
                        })()}
                        {(() => {
                          const memberPlace = resolveMemberPlace(member, savedPlaces);
                          let locSubtitle = sinceText;
                          if (member.isMoving && memberPlace.subtitle) {
                            locSubtitle = memberPlace.subtitle;
                          }

                          return (
                            <>
                              <View style={styles.memberLocationRow}>
                                <Ionicons
                                  name={memberPlace.isAtHome ? 'home' : (memberPlace.isSavedPlace ? 'business' : 'location-sharp')}
                                  size={12.5}
                                  color={memberPlace.isAtHome ? '#10B981' : (member.inBubble ? '#A78BFA' : colors.primary)}
                                  style={{ marginRight: 4 }}
                                />
                                <Text
                                  style={[
                                    styles.memberLocationSub,
                                    {
                                      color: memberPlace.isAtHome ? (isDark ? '#34D399' : '#059669') : (member.inBubble ? '#A78BFA' : colors.textSecondary),
                                      fontWeight: memberPlace.isAtHome || member.inBubble ? '700' : '600',
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {memberPlace.title}
                                </Text>
                              </View>
                              <Text style={[styles.memberSinceSub, { color: colors.textMuted }]} numberOfLines={1}>
                                {locSubtitle}
                              </Text>
                            </>
                          );
                        })()}
                      </View>

                      <View style={styles.memberRowRightWrap}>
                        {(() => {
                          const batt = getBatteryVisual(member.batteryLevel, member.isCharging, isDark);
                          return (
                            <View
                              style={[
                                styles.rowBatteryPill,
                                {
                                  backgroundColor: batt.bgColor,
                                  borderColor: batt.borderColor,
                                },
                              ]}
                            >
                              <Ionicons
                                name={batt.icon}
                                size={12}
                                color={batt.color}
                              />
                              <Text style={[styles.rowBatteryText, { color: batt.textColor, fontWeight: '700' }]}>
                                {batt.levelText}
                              </Text>
                            </View>
                          );
                        })()}

                        {isSelf ? (
                          member.inBubble ? (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => onPopBubble?.(member)}
                              style={[
                                styles.rowBubbleActionBtn,
                                {
                                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                                  borderColor: isDark ? '#EF4444' : '#FCA5A5',
                                },
                              ]}
                            >
                              <Ionicons name="radio-button-off" size={13} color="#EF4444" />
                              <Text style={[styles.rowBubbleActionText, { color: '#EF4444' }]}>Burst</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => onCreateBubbleTapped?.(member)}
                              style={[
                                styles.rowBubbleActionBtn,
                                {
                                  backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE',
                                  borderColor: isDark ? '#8B5CF6' : '#C4B5FD',
                                },
                              ]}
                            >
                              <Text style={{ fontSize: 13 }}>🫧</Text>
                              <Text style={[styles.rowBubbleActionText, { color: isDark ? '#C4B5FD' : '#7C3AED' }]}>Bubble</Text>
                            </TouchableOpacity>
                          )
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => onToggleFavorite?.(member)}
                            style={styles.heartBtn}
                            accessibilityLabel={favoriteMemberIds?.includes(member.id) ? 'Unpin from map radar' : 'Pin to map radar'}
                          >
                            <Ionicons
                              name={favoriteMemberIds?.includes(member.id) ? 'heart' : 'heart-outline'}
                              size={20}
                              color={favoriteMemberIds?.includes(member.id) ? '#EC4899' : colors.textMuted}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }))}

              {/* + Add a Person */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onAddPersonTapped}
                style={[
                  styles.addPersonRow,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                    borderWidth: 1,
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                  },
                  webGlassTile,
                ]}
              >
                <View
                  style={[
                    styles.addPersonCircle,
                    { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#F5F3FF' },
                  ]}
                >
                  <Ionicons name="people" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.addPersonText, { color: colors.primary }]}>Add a person</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 120,
  },
  floatingMapActionsRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 125,
  },
  actionPillsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  mapActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mapActionPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  rightMapControlsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  circularMapCtrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
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
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomWidth: 1,
    zIndex: 100,
    elevation: 20,
    overflow: 'visible',
  },
  sketchFixedTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
  },
  sketchFixedNameWrap: {
    flex: 1,
    marginRight: 44,
    justifyContent: 'center',
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
  sketchOverflowAvatarWrap: {
    position: 'absolute',
    top: -41,
    alignSelf: 'center',
    zIndex: 50,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
    fontSize: 22,
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
    marginLeft: 44,
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
    elevation: 20,
  },
  fixedButtonsScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
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
