import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { MemberData, getMemberInitials, formatJoinedDate } from '../../models/Member';
import { MemberTimelineData, TimelineItem } from '../../models/Timeline';
import { authService } from '../../services/AuthService';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { MapView, MapViewRef } from '../MapView';
import { TimelineItemSkeleton } from '../common/Skeleton';
import { LoadingSpinner } from '../common/Loader';
import { getMovementActivity, MovementActivityInfo } from '../../models/MovementActivity';
import { AnimatedActivityEmoji } from '../common/AnimatedActivityEmoji';

export interface TimelineRouteData {
  coords: [number, number][];
  stops: Array<{
    latitude: number;
    longitude: number;
    stopNumber: number;
    title: string;
    duration?: string;
    address?: string;
  }>;
}

// Detects if a string contains raw latitude/longitude coordinates
const isCoordinateString = (val?: string | null): boolean => {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    /^-?\d{1,3}\.\d+[\s,]+-?\d{1,3}\.\d+$/.test(trimmed) ||
    /^(?:Near|Location|Coordinates?|Stop \d+:)\s*\(?-?\d{1,3}\.\d+[\s,]+-?\d{1,3}\.\d+\)?$/i.test(trimmed)
  );
};

// Formats a stop's title into a clean, human-readable place name
const getCleanStopTitle = (title?: string, address?: string, stopNumber?: number): string => {
  if (title && !isCoordinateString(title)) {
    const cleaned = title.replace(/^Stop \d+:\s*/i, '').trim();
    if (cleaned && !isCoordinateString(cleaned)) return cleaned;
  }
  if (address && !isCoordinateString(address)) {
    const firstPart = address.split(',')[0].trim();
    if (firstPart && !isCoordinateString(firstPart)) return firstPart;
  }
  return `Stop #${stopNumber || 1}`;
};

// Formats a stop's address into a human-readable street/area address, falling back to coordinates for old data
const getCleanStopAddress = (address?: string, title?: string, latitude?: number, longitude?: number): string => {
  if (address && !isCoordinateString(address)) {
    return address;
  }
  if (address && isCoordinateString(address)) {
    return address.replace(/^(?:Near|Location|Coordinates?|Stop \d+:)\s*\(?/i, '').replace(/\)?$/i, '').trim();
  }
  if (latitude !== undefined && longitude !== undefined) {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
  if (title && isCoordinateString(title)) {
    return title.replace(/^(?:Near|Location|Coordinates?|Stop \d+:)\s*\(?/i, '').replace(/\)?$/i, '').trim();
  }
  return 'Visited Location';
};

// Formats a trip's title
const getCleanTripTitle = (title?: string, address?: string): string => {
  if (title) {
    return title;
  }
  if (address) {
    return `Trip • ${address}`;
  }
  return 'Trip';
};

// Formats a trip's route display ("Origin → Destination") - preserves coordinates on fallback
const getCleanTripRoute = (address?: string): string => {
  if (!address) {
    return 'Route Traveled';
  }
  return address;
};

interface MemberTimelineModalProps {
  visible: boolean;
  member: MemberData | null;
  circleId: string | null;
  currentUserId?: string;
  backendUrl: string;
  initialFilter?: 'all' | 'places' | 'drives';
  onClose: () => void;
  onShowOnMap: (latitude: number, longitude: number) => void;
  onShowFullTimelineOnMap?: (data: TimelineRouteData) => void;
}

export const MemberTimelineModal: React.FC<MemberTimelineModalProps> = ({
  visible,
  member,
  circleId,
  currentUserId,
  backendUrl,
  initialFilter = 'all',
  onClose,
  onShowOnMap,
  onShowFullTimelineOnMap,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [filterMode, setFilterMode] = useState<'all' | 'places' | 'drives'>(initialFilter);
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = Today, offset = days ago
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [pickerMonthDate, setPickerMonthDate] = useState<Date>(new Date());
  const [timelineData, setTimelineData] = useState<MemberTimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const timelineMapRef = useRef<MapViewRef>(null);
  const daysScrollRef = useRef<ScrollView>(null);

  // Compute the earliest date the user joined CareRing / circle
  const effectiveJoinDate = useMemo(() => {
    const dates: Date[] = [];
    const check = (d: any) => {
      if (!d) return;
      const parsed = d instanceof Date ? d : new Date(d);
      if (!isNaN(parsed.getTime())) dates.push(parsed);
    };
    check(member?.createdAt);
    check(member?.joinedAt);
    check(timelineData?.createdAt);
    check(timelineData?.joinedAt);

    if (dates.length === 0) return null;
    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates[0];
  }, [member?.joinedAt, member?.createdAt, timelineData?.joinedAt, timelineData?.createdAt]);

  const { startOfToday, startOfJoinDay } = useMemo(() => {
    const now = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const joinMs = effectiveJoinDate && !isNaN(effectiveJoinDate.getTime())
      ? new Date(effectiveJoinDate.getFullYear(), effectiveJoinDate.getMonth(), effectiveJoinDate.getDate()).getTime()
      : null;
    return { startOfToday: todayMs, startOfJoinDay: joinMs };
  }, [effectiveJoinDate]);

  // Compute maximum available days: unbounded history up to the day member joined CareRing
  const maxAvailableDays = useMemo(() => {
    if (!startOfJoinDay) {
      return 365; // Fallback to 1 year if join date is not available
    }
    const diffDays = Math.max(0, Math.floor((startOfToday - startOfJoinDay) / (1000 * 60 * 60 * 24)));
    // +1 because today is Day 0 (offset 0). Offset (maxAvailableDays - 1) is the minimum selectable date (joined CareRing)
    return Math.max(1, diffDays + 1);
  }, [startOfToday, startOfJoinDay]);

  const getDayInfo = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayOfMonth = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const isThisYear = d.getFullYear() === new Date().getFullYear();
    const yearStr = isThisYear ? '' : `, ${d.getFullYear()}`;
    const isMinDate = offset === maxAvailableDays - 1;
    const fullDateLabel =
      offset === 0
        ? `Today, ${month} ${dayOfMonth}${yearStr}`
        : offset === 1
        ? `Yesterday, ${month} ${dayOfMonth}${yearStr}`
        : isMinDate
        ? `Joined CareRing, ${month} ${dayOfMonth}${yearStr}`
        : `${dayOfWeek}, ${month} ${dayOfMonth}${yearStr}`;
    const daysAgoText =
      offset === 0
        ? 'Today'
        : offset === 1
        ? 'Yesterday'
        : isMinDate
        ? `Joined CareRing (${offset}d ago)`
        : `${offset} days ago`;
    return { offset, dateStr, dayOfWeek, dayOfMonth, month, fullDateLabel, daysAgoText, isMinDate };
  };

  const availableDays = useMemo(() => {
    if (maxAvailableDays <= 120) {
      return Array.from({ length: maxAvailableDays }, (_, i) => getDayInfo(i));
    }
    const offsetsSet = new Set<number>();
    // First 45 days
    for (let i = 0; i < Math.min(45, maxAvailableDays); i++) offsetsSet.add(i);
    // Window around selectedDayOffset
    for (let i = Math.max(0, selectedDayOffset - 7); i <= Math.min(maxAvailableDays - 1, selectedDayOffset + 7); i++) {
      offsetsSet.add(i);
    }
    // Always include join date (min date)
    offsetsSet.add(maxAvailableDays - 1);
    const sortedOffsets = Array.from(offsetsSet).sort((a, b) => a - b);
    return sortedOffsets.map((i) => getDayInfo(i));
  }, [maxAvailableDays, selectedDayOffset]);

  const currentDayInfo = useMemo(() => {
    return getDayInfo(selectedDayOffset);
  }, [selectedDayOffset, maxAvailableDays]);

  const getTargetDate = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Sync calendar month when picker modal opens
  useEffect(() => {
    if (showDatePickerModal) {
      const curDate = new Date();
      curDate.setDate(curDate.getDate() - selectedDayOffset);
      setPickerMonthDate(new Date(curDate.getFullYear(), curDate.getMonth(), 1));
    }
  }, [showDatePickerModal, selectedDayOffset]);

  // Calendar month boundary navigation checks
  const canGoPrevMonth = useMemo(() => {
    if (!startOfJoinDay) return true;
    const prevMonthEnd = new Date(pickerMonthDate.getFullYear(), pickerMonthDate.getMonth(), 0).getTime();
    return prevMonthEnd >= startOfJoinDay;
  }, [pickerMonthDate, startOfJoinDay]);

  const canGoNextMonth = useMemo(() => {
    const nextMonthStart = new Date(pickerMonthDate.getFullYear(), pickerMonthDate.getMonth() + 1, 1).getTime();
    return nextMonthStart <= startOfToday;
  }, [pickerMonthDate, startOfToday]);

  // Days matrix for the calendar month picker
  const calendarDays = useMemo(() => {
    const year = pickerMonthDate.getFullYear();
    const month = pickerMonthDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNumber: number | null;
      dateKey: string;
      offset?: number;
      isDisabled: boolean;
      isSelected: boolean;
      isToday: boolean;
      isMinDate: boolean;
    }> = [];

    // Empty cells before 1st of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        dayNumber: null,
        dateKey: `empty-${i}`,
        isDisabled: true,
        isSelected: false,
        isToday: false,
        isMinDate: false,
      });
    }

    // Days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellTime = new Date(year, month, day).getTime();
      const isBeforeJoin = startOfJoinDay !== null && cellTime < startOfJoinDay;
      const isAfterToday = cellTime > startOfToday;
      const isDisabled = isBeforeJoin || isAfterToday;
      const isTodayCell = cellTime === startOfToday;
      const isMinCell = startOfJoinDay !== null && cellTime === startOfJoinDay;

      const offset = Math.max(0, Math.round((startOfToday - cellTime) / (1000 * 60 * 60 * 24)));
      const isSelected = !isDisabled && offset === selectedDayOffset;

      days.push({
        dayNumber: day,
        dateKey: `day-${year}-${month}-${day}`,
        offset,
        isDisabled,
        isSelected,
        isToday: isTodayCell,
        isMinDate: isMinCell,
      });
    }

    return days;
  }, [pickerMonthDate, startOfToday, startOfJoinDay, selectedDayOffset]);

  // Clamp selectedDayOffset if join date boundary changes
  useEffect(() => {
    if (selectedDayOffset >= maxAvailableDays) {
      setSelectedDayOffset(maxAvailableDays - 1);
    }
  }, [maxAvailableDays, selectedDayOffset]);

  useEffect(() => {
    if (daysScrollRef.current) {
      const indexInList = availableDays.findIndex((d) => d.offset === selectedDayOffset);
      if (indexInList >= 0) {
        const targetX = Math.max(0, indexInList * 68 - 100);
        daysScrollRef.current.scrollTo({ x: targetX, animated: true });
      }
    }
  }, [selectedDayOffset, availableDays]);

  useEffect(() => {
    if (!visible || !member || !circleId) return;

    const loadTimeline = async () => {
      setLoading(true);
      const targetDate = getTargetDate(selectedDayOffset);
      const data = await authService.fetchMemberTimeline(
        backendUrl,
        circleId,
        member.id,
        targetDate,
        currentUserId
      );

      setTimelineData(data);
      setLoading(false);
    };

    loadTimeline();
  }, [visible, member?.id, circleId, selectedDayOffset, backendUrl, currentUserId]);

  // Invalidate map layout when modal opens to prevent grey tiles
  useEffect(() => {
    if (visible) {
      const t1 = setTimeout(() => timelineMapRef.current?.invalidateSize(), 150);
      const t2 = setTimeout(() => timelineMapRef.current?.invalidateSize(), 500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [visible]);

  // Sync timeline polyline and stop dots to the embedded mini-map
  useEffect(() => {
    if (!visible || !timelineData) return;

    const timer = setTimeout(() => {
      syncRouteToMap();
    }, 450);

    return () => clearTimeout(timer);
  }, [visible, timelineData]);

  const syncRouteToMap = () => {
    if (!timelineData || !timelineMapRef.current) return;
    timelineMapRef.current.invalidateSize();
    const rawCoords = timelineData.rawCoordinates || [];
    const stops = timelineData.timeline
      .filter((t) => t.type === 'stay' && t.latitude && t.longitude)
      .map((t, idx) => ({
        latitude: t.latitude,
        longitude: t.longitude,
        stopNumber: t.stopNumber || idx + 1,
        title: getCleanStopTitle(t.title, t.address, t.stopNumber || idx + 1),
        duration: t.durationMinutes ? `${t.durationMinutes}m` : undefined,
        address: getCleanStopAddress(t.address, t.title, t.latitude, t.longitude),
      }));

    timelineMapRef.current.showTimelineRoute({
      coords: rawCoords,
      stops,
      color: '#4F46E5',
    });
  };

  const handleFocusStop = (item: TimelineItem) => {
    setSelectedItemId(item.id);
    if (item.latitude && item.longitude && timelineMapRef.current) {
      timelineMapRef.current.animateToPosition(item.latitude, item.longitude, 16);
    }
  };

  const handleFocusTrip = (item: TimelineItem) => {
    setSelectedItemId(item.id);
    if (item.coordinates && item.coordinates.length > 0 && timelineMapRef.current) {
      const midIdx = Math.floor(item.coordinates.length / 2);
      const midCoord = item.coordinates[midIdx];
      timelineMapRef.current.animateToPosition(midCoord[0], midCoord[1], 15);
    }
  };

  const handleOpenFullMap = () => {
    if (!timelineData) return;
    const rawCoords = timelineData.rawCoordinates || [];
    const stops = timelineData.timeline
      .filter((t) => t.type === 'stay' && t.latitude && t.longitude)
      .map((t, idx) => ({
        latitude: t.latitude,
        longitude: t.longitude,
        stopNumber: t.stopNumber || idx + 1,
        title: getCleanStopTitle(t.title, t.address, t.stopNumber || idx + 1),
        duration: t.durationMinutes ? `${t.durationMinutes}m` : undefined,
        address: getCleanStopAddress(t.address, t.title, t.latitude, t.longitude),
      }));

    if (onShowFullTimelineOnMap && (rawCoords.length > 0 || stops.length > 0)) {
      onShowFullTimelineOnMap({ coords: rawCoords, stops });
    } else if (stops.length > 0) {
      onClose();
      onShowOnMap(stops[0].latitude, stops[0].longitude);
    } else {
      onClose();
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  };

  // Sync initialFilter when modal opens
  useEffect(() => {
    if (visible) {
      setFilterMode(initialFilter || 'all');
    }
  }, [visible, initialFilter]);

  const items = timelineData?.timeline || [];
  const totalDistance = timelineData?.totalDistanceKm || 0;
  const totalMoving = timelineData?.totalMovingMinutes || 0;
  const stopCount = timelineData?.stopCount ?? items.filter((i) => i.type === 'stay').length;
  const driveCount = items.filter((i) => i.type === 'trip').length;

  const displayedItems = useMemo(() => {
    if (filterMode === 'places') {
      return items.filter((i) => i.type === 'stay');
    }
    if (filterMode === 'drives') {
      return items.filter((i) => i.type === 'trip');
    }
    return items;
  }, [items, filterMode]);

  if (!member) return null;

  const initials = getMemberInitials(member.fullName);
  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: statusBarHeight + 8, backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>

          <View style={styles.memberCardHeader}>
            <View style={styles.avatarWrap}>
              {member.avatarUrl ? (
                <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </View>

            {(() => {
              const isMoving = member.isMoving || ((member.speed || 0) >= 1.8 && !member.isStationary);
              const activeMovement = isMoving ? getMovementActivity(member.speed, member.isStationary) : null;

              return (
                <View style={styles.memberInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.memberName, { color: colors.textMain }]} numberOfLines={1}>
                      {member.fullName}
                    </Text>
                    {activeMovement && (
                      <AnimatedActivityEmoji
                        activity={activeMovement}
                        size={13}
                        showBadge={true}
                        badgeContainerStyle={{ paddingVertical: 1.5, paddingHorizontal: 6 }}
                      />
                    )}
                  </View>
                  <Text style={[styles.memberSubtitle, { color: colors.textMuted }]}>
                    {activeMovement
                      ? `${activeMovement.label} • ${Math.round(member.speed)} km/h`
                      : (effectiveJoinDate ? `Joined ${formatJoinedDate(effectiveJoinDate)}` : 'Member Daily Timeline')} • {member.batteryLevel ?? 100}% Battery
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Action to view full screen map */}
          <TouchableOpacity
            style={[styles.fullMapActionBtn, { backgroundColor: colors.tileBg }]}
            activeOpacity={0.7}
            onPress={handleOpenFullMap}
          >
            <Feather name="maximize-2" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Movement Timeline Date Navigation Bar */}
        <View style={[styles.dateNavSection, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
          {/* Top Date Header Row with Arrows & Calendar button */}
          <View style={styles.dateNavHeader}>
            <TouchableOpacity
              style={[
                styles.arrowBtn,
                { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                selectedDayOffset >= maxAvailableDays - 1 && styles.arrowBtnDisabled,
              ]}
              disabled={selectedDayOffset >= maxAvailableDays - 1}
              onPress={() => setSelectedDayOffset((prev) => Math.min(maxAvailableDays - 1, prev + 1))}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name="chevron-left"
                size={18}
                color={selectedDayOffset >= maxAvailableDays - 1 ? colors.textMuted : colors.textMain}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.datePickerTrigger, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
              activeOpacity={0.8}
              onPress={() => setShowDatePickerModal(true)}
            >
              <Feather name="calendar" size={15} color={colors.primary} />
              <Text style={[styles.datePickerTriggerText, { color: colors.textMain }]} numberOfLines={1}>
                {currentDayInfo.fullDateLabel}
              </Text>
              {selectedDayOffset === maxAvailableDays - 1 ? (
                <View style={[styles.historyBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5' }]}>
                  <Text style={[styles.historyBadgeText, { color: '#10B981' }]}>
                    Joined CareRing
                  </Text>
                </View>
              ) : selectedDayOffset === 0 ? (
                <View style={[styles.historyBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)' }]}>
                  <Text style={[styles.historyBadgeText, { color: colors.primary }]}>
                    Today
                  </Text>
                </View>
              ) : (
                <View style={[styles.historyBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)' }]}>
                  <Text style={[styles.historyBadgeText, { color: colors.primary }]}>
                    {selectedDayOffset}d ago
                  </Text>
                </View>
              )}
              <Feather name="chevron-down" size={13} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.arrowBtn,
                { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                selectedDayOffset <= 0 && styles.arrowBtnDisabled,
              ]}
              disabled={selectedDayOffset <= 0}
              onPress={() => setSelectedDayOffset((prev) => Math.max(0, prev - 1))}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name="chevron-right"
                size={18}
                color={selectedDayOffset <= 0 ? colors.textMuted : colors.textMain}
              />
            </TouchableOpacity>
          </View>

          {/* Horizontal Scrollable Pill Strip */}
          <ScrollView
            ref={daysScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysScrollList}
          >
            {availableDays.map((item) => {
              const isSelected = selectedDayOffset === item.offset;
              const isMinJoinDay = item.offset === maxAvailableDays - 1;
              return (
                <TouchableOpacity
                  key={item.offset}
                  style={[
                    styles.dayStripPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.tileBg,
                      borderColor: isSelected ? colors.primary : isMinJoinDay ? '#10B981' : colors.tileBorder,
                    },
                    isSelected && styles.dayStripPillSelected,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setSelectedDayOffset(item.offset)}
                >
                  <Text
                    style={[
                      styles.dayStripWeekday,
                      { color: isSelected ? '#FFFFFF' : isMinJoinDay ? '#10B981' : colors.textMuted },
                    ]}
                  >
                    {item.offset === 0
                      ? 'Today'
                      : item.offset === 1
                      ? 'Yest'
                      : isMinJoinDay
                      ? 'Joined'
                      : item.dayOfWeek}
                  </Text>
                  <Text
                    style={[
                      styles.dayStripDate,
                      { color: isSelected ? '#FFFFFF' : colors.textMain },
                    ]}
                  >
                    {item.dayOfMonth}
                  </Text>
                  <Text
                    style={[
                      styles.dayStripMonth,
                      { color: isSelected ? 'rgba(255, 255, 255, 0.85)' : colors.textMuted },
                    ]}
                  >
                    {item.month}
                  </Text>
                  {isMinJoinDay && (
                    <View
                      style={[
                        styles.minJoinBadgeDot,
                        { backgroundColor: isSelected ? '#FFFFFF' : '#10B981' },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Embedded Interactive Map Preview */}
        <View style={[styles.mapSectionWrapper, { borderColor: colors.cardBorder }]}>
          <View style={styles.mapContainer}>
            <MapView
              ref={timelineMapRef}
              currentUserId={member.id}
              members={[member]}
              myPosition={
                member.latitude && member.longitude
                  ? { latitude: member.latitude, longitude: member.longitude, heading: member.heading || 0 }
                  : null
              }
            />

            {/* Floating Map Re-center & Fit Controls */}
            <View style={styles.mapOverlayControls}>
              <TouchableOpacity
                style={[styles.mapOverlayBtn, { backgroundColor: colors.card }]}
                activeOpacity={0.8}
                onPress={syncRouteToMap}
              >
                <Feather name="crosshair" size={16} color={colors.primary} />
                <Text style={[styles.mapOverlayBtnText, { color: colors.textMain }]}>Fit Route</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mapOverlayBtn, { backgroundColor: colors.card }]}
                activeOpacity={0.8}
                onPress={handleOpenFullMap}
              >
                <Feather name="map" size={16} color={colors.primary} />
                <Text style={[styles.mapOverlayBtnText, { color: colors.textMain }]}>Full Screen</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Floating Stats Pill */}
            <View style={[styles.mapFloatingInfo, { backgroundColor: colors.card }]}>
              <View style={styles.mapInfoItem}>
                <Ionicons name="location" size={13} color="#4F46E5" />
                <Text style={[styles.mapInfoText, { color: colors.textMain }]}>
                  {stopCount} {stopCount === 1 ? 'Stop' : 'Stops'}
                </Text>
              </View>
              <View style={[styles.mapInfoDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.mapInfoItem}>
                <MaterialIcons name="directions-car" size={14} color="#059669" />
                <Text style={[styles.mapInfoText, { color: colors.textMain }]}>
                  {totalDistance.toFixed(1)} km
                </Text>
              </View>
              {totalMoving > 0 && (
                <>
                  <View style={[styles.mapInfoDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.mapInfoItem}>
                    <Feather name="clock" size={12} color="#D97706" />
                    <Text style={[styles.mapInfoText, { color: colors.textMain }]}>
                      {formatDuration(totalMoving)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {loading ? (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <LoadingSpinner size="medium" message="Fetching timeline route & stops..." />
            </View>
            <TimelineItemSkeleton count={4} />
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Filter Toggle: All Activity / Places & Stops / Driving Sections */}
            <View style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFilterMode('all')}
                style={[
                  styles.filterTab,
                  filterMode === 'all' && [styles.filterTabActive, { backgroundColor: colors.primary }],
                ]}
              >
                <Feather
                  name="layers"
                  size={12}
                  color={filterMode === 'all' ? '#FFFFFF' : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterTabText,
                    { color: filterMode === 'all' ? '#FFFFFF' : colors.textMain },
                  ]}
                >
                  All ({items.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFilterMode('places')}
                style={[
                  styles.filterTab,
                  filterMode === 'places' && [styles.filterTabActive, { backgroundColor: colors.primary }],
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={filterMode === 'places' ? '#FFFFFF' : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterTabText,
                    { color: filterMode === 'places' ? '#FFFFFF' : colors.textMain },
                  ]}
                >
                  Places ({stopCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFilterMode('drives')}
                style={[
                  styles.filterTab,
                  filterMode === 'drives' && [styles.filterTabActive, { backgroundColor: colors.primary }],
                ]}
              >
                <MaterialIcons
                  name="directions-car"
                  size={13}
                  color={filterMode === 'drives' ? '#FFFFFF' : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterTabText,
                    { color: filterMode === 'drives' ? '#FFFFFF' : colors.textMain },
                  ]}
                >
                  Drives ({driveCount})
                </Text>
              </TouchableOpacity>
            </View>

            {displayedItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name={filterMode === 'drives' ? 'car-outline' : filterMode === 'places' ? 'location-outline' : 'calendar-outline'}
                  size={48}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyTitle, { color: colors.textMain }]}>
                  {filterMode === 'drives'
                    ? 'No driving sections on this day'
                    : filterMode === 'places'
                    ? 'No places or stops on this day'
                    : 'No movements recorded for this day'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {filterMode === 'drives'
                    ? 'Driving segments and vehicle speeds are recorded automatically when moving above 15 km/h.'
                    : filterMode === 'places'
                    ? 'Places and stops are automatically recorded every 5 minutes when stationary.'
                    : `Stops and travel routes will automatically record as ${member.fullName} moves.`}
                </Text>
                {filterMode !== 'all' && items.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setFilterMode('all')}
                    style={[styles.resetFilterBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
                  >
                    <Text style={[styles.resetFilterBtnText, { color: colors.primary }]}>
                      View All Activity ({items.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.timelineList}>
                {displayedItems.map((item: TimelineItem, index: number) => {
                  const isLast = index === displayedItems.length - 1;
                  const isStay = item.type === 'stay';
                  const isSelected = selectedItemId === item.id;

                  if (isStay) {
                    const stopNumber = item.stopNumber || 1;
                    return (
                      <View key={item.id || `stop-${index}`} style={styles.timelineRow}>
                        {/* Left Track & Numbered Stop Dot Node */}
                        <View style={styles.nodeColumn}>
                          <View
                            style={[
                              styles.numberedStopNode,
                              isLast
                                ? styles.nodeCurrentStop
                                : stopNumber === 1
                                ? styles.nodeFirstStop
                                : styles.nodeRegularStop,
                            ]}
                          >
                            <Text style={styles.stopNodeText}>{stopNumber}</Text>
                          </View>
                          {!isLast && (
                            <View style={[styles.trackLine, { backgroundColor: colors.divider }]} />
                          )}
                        </View>

                        {/* Right Card Content */}
                        <TouchableOpacity
                          style={[
                            styles.cardContent,
                            {
                              backgroundColor: colors.card,
                              borderColor: isSelected ? colors.primary : colors.cardBorder,
                              borderWidth: isSelected ? 2 : 1,
                            },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => handleFocusStop(item)}
                        >
                          <View style={styles.cardTopRow}>
                            <View style={styles.stopTitleWrap}>
                              <View style={[styles.stopNumberBadge, { backgroundColor: colors.tileBg }]}>
                                <Text style={[styles.stopNumberBadgeText, { color: colors.primary }]}>
                                  Stop #{stopNumber}
                                </Text>
                              </View>
                              <Text
                                style={[styles.itemTitle, { color: colors.textMain }]}
                                numberOfLines={1}
                              >
                                {getCleanStopTitle(item.title, item.address, stopNumber)}
                              </Text>
                            </View>

                            <View style={[styles.durationBadge, { backgroundColor: colors.tileBg }]}>
                              <Feather name="clock" size={11} color={colors.primary} />
                              <Text style={[styles.durationText, { color: colors.primary }]}>
                                {formatDuration(item.durationMinutes)}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={[styles.itemAddress, { color: colors.textSecondary }]}
                            numberOfLines={2}
                          >
                            {getCleanStopAddress(item.address, item.title, item.latitude, item.longitude)}
                          </Text>

                          <View style={styles.itemBottomRow}>
                            <Text style={[styles.itemTime, { color: colors.textMuted }]}>
                              {formatTime(item.startTime)}
                              {item.endTime && item.endTime !== item.startTime
                                ? ` - ${formatTime(item.endTime)}`
                                : ''}
                            </Text>

                            <View style={styles.cardActions}>
                              {item.batteryLevel !== undefined && item.batteryLevel !== null && (
                                <View style={[styles.batteryPill, { backgroundColor: colors.tileBg }]}>
                                  <Ionicons
                                    name={item.batteryLevel < 20 ? 'battery-dead' : 'battery-charging'}
                                    size={12}
                                    color={item.batteryLevel < 20 ? '#EF4444' : '#10B981'}
                                  />
                                  <Text style={[styles.batteryPillText, { color: colors.textSecondary }]}>
                                    {item.batteryLevel}%
                                  </Text>
                                </View>
                              )}

                              <TouchableOpacity
                                style={[styles.focusOnMapBtn, { backgroundColor: colors.tileBg }]}
                                activeOpacity={0.7}
                                onPress={() => handleFocusStop(item)}
                              >
                                <Feather name="crosshair" size={12} color={colors.primary} />
                                <Text style={[styles.focusOnMapText, { color: colors.primary }]}>
                                  Locate
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  // Trip Item (driving or moving segment)
                  const distanceStr =
                    item.distanceKm !== undefined ? `${item.distanceKm.toFixed(1)} km` : '';
                  const topSpeedStr = item.topSpeed ? `Max ${Math.round(item.topSpeed)} km/h` : '';
                  const tripSpeed = item.topSpeed || (item.distanceKm && item.durationMinutes ? (item.distanceKm / (item.durationMinutes / 60)) : 35);
                  const tripActivity = getMovementActivity(tripSpeed, false);

                  return (
                    <View key={item.id || `trip-${index}`} style={styles.timelineRow}>
                      {/* Left Track & Trip Node */}
                      <View style={styles.nodeColumn}>
                        <View style={[styles.tripNodeCircle, { backgroundColor: tripActivity.bgColor, borderColor: tripActivity.color + '40', borderWidth: 1 }]}>
                          <AnimatedActivityEmoji activity={tripActivity} size={15} />
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.tripTrackLine,
                              { borderColor: tripActivity.color, opacity: 0.5 },
                            ]}
                          />
                        )}
                      </View>

                      {/* Right Trip Card */}
                      <TouchableOpacity
                        style={[
                          styles.tripCardContent,
                          {
                            backgroundColor: colors.card,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => handleFocusTrip(item)}
                      >
                        <View style={styles.tripHeaderRow}>
                          <View style={styles.tripBadgeWrap}>
                            <Text style={[styles.tripTitle, { color: colors.textMain }]}>
                              {getCleanTripTitle(item.title, item.address)}
                            </Text>
                            {distanceStr ? (
                              <View style={[styles.tripStatBadge, { backgroundColor: tripActivity.bgColor }]}>
                                <Text style={[styles.tripStatText, { color: tripActivity.color }]}>{distanceStr}</Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={[styles.durationBadge, { backgroundColor: colors.tileBg }]}>
                            <Feather name="clock" size={11} color="#6366F1" />
                            <Text style={[styles.durationText, { color: '#6366F1' }]}>
                              {formatDuration(item.durationMinutes)}
                            </Text>
                          </View>
                        </View>

                        {item.address ? (
                          <Text
                            style={[styles.tripRouteText, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {getCleanTripRoute(item.address)}
                          </Text>
                        ) : null}

                        <View style={styles.tripBottomRow}>
                          <Text style={[styles.itemTime, { color: colors.textMuted }]}>
                            {formatTime(item.startTime)} - {formatTime(item.endTime)}
                          </Text>

                          {topSpeedStr ? (
                            <View style={styles.speedWrap}>
                              <Ionicons name="speedometer-outline" size={12} color={colors.textMuted} />
                              <Text style={[styles.speedText, { color: colors.textMuted }]}>
                                {topSpeedStr}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* Unlimited Calendar Quick Picker Sheet Modal */}
        <Modal
          visible={showDatePickerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePickerModal(false)}
        >
          <TouchableOpacity
            style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
            activeOpacity={1}
            onPress={() => setShowDatePickerModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.datePickerSheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Grab Bar & Header */}
              <View style={styles.sheetGrabHandle}>
                <View style={[styles.grabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }]} />
              </View>

              <View style={styles.datePickerHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.datePickerTitle, { color: colors.textMain }]}>
                    Movement History ({maxAvailableDays} {maxAvailableDays === 1 ? 'Day' : 'Days'} Total)
                  </Text>
                  <Text style={[styles.datePickerSubtitle, { color: colors.textSecondary }]}>
                    {effectiveJoinDate
                      ? `Select any date down to CareRing join date (${formatJoinedDate(effectiveJoinDate)})`
                      : 'Select any date from unlimited movement history'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.datePickerCloseBtn, { backgroundColor: colors.tileBg }]}
                  onPress={() => setShowDatePickerModal(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* CareRing Join Date (Min Selectable Date) Quick Banner */}
              <TouchableOpacity
                style={[
                  styles.minDateBanner,
                  {
                    backgroundColor: selectedDayOffset === maxAvailableDays - 1
                      ? (isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.12)')
                      : colors.tileBg,
                    borderColor: selectedDayOffset === maxAvailableDays - 1 ? '#10B981' : colors.tileBorder,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedDayOffset(maxAvailableDays - 1);
                  setShowDatePickerModal(false);
                }}
              >
                <View style={styles.minDateBannerLeft}>
                  <View style={[styles.minDateIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5' }]}>
                    <Ionicons name="sparkles" size={17} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.minDateTitle, { color: colors.textMain }]}>
                        Joined CareRing
                      </Text>
                      <View style={styles.minDateBadge}>
                        <Text style={styles.minDateBadgeText}>MIN DATE</Text>
                      </View>
                    </View>
                    <Text style={[styles.minDateSubtitle, { color: colors.textSecondary }]}>
                      {effectiveJoinDate ? formatJoinedDate(effectiveJoinDate) : 'Initial Join Day'} ({maxAvailableDays - 1 === 0 ? 'Today' : `${maxAvailableDays - 1} days ago`})
                    </Text>
                  </View>
                </View>
                <View style={[styles.jumpMinPill, { backgroundColor: selectedDayOffset === maxAvailableDays - 1 ? '#10B981' : colors.primary }]}>
                  <Text style={styles.jumpMinPillText}>
                    {selectedDayOffset === maxAvailableDays - 1 ? 'Selected' : 'Select Min'}
                  </Text>
                  <Feather name="arrow-right" size={13} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* Quick Jump Shortcut Chips */}
              <View style={styles.quickShortcutsRow}>
                {[
                  { label: 'Today', offset: 0 },
                  { label: 'Yesterday', offset: 1 },
                  { label: '7D Ago', offset: 7 },
                  { label: '30D Ago', offset: 30 },
                  { label: '90D Ago', offset: 90 },
                  { label: `Min Date (${maxAvailableDays - 1}d)`, offset: maxAvailableDays - 1, isMin: true },
                ]
                  .filter((sc) => sc.offset < maxAvailableDays)
                  .map((sc) => {
                    const isCur = selectedDayOffset === sc.offset;
                    return (
                      <TouchableOpacity
                        key={sc.label}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: isCur ? colors.primary : colors.tileBg,
                            borderColor: isCur ? colors.primary : sc.isMin ? '#10B981' : colors.tileBorder,
                          },
                        ]}
                        onPress={() => {
                          setSelectedDayOffset(sc.offset);
                          setShowDatePickerModal(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: isCur ? '#FFFFFF' : sc.isMin ? '#10B981' : colors.textSecondary },
                          ]}
                        >
                          {sc.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              {/* Interactive Calendar Month Picker */}
              <View style={[styles.calendarContainer, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                {/* Month navigation row */}
                <View style={styles.calendarNavRow}>
                  <TouchableOpacity
                    style={[
                      styles.monthNavBtn,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      !canGoPrevMonth && styles.monthNavBtnDisabled,
                    ]}
                    disabled={!canGoPrevMonth}
                    onPress={() => setPickerMonthDate(new Date(pickerMonthDate.getFullYear(), pickerMonthDate.getMonth() - 1, 1))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="chevron-left" size={18} color={canGoPrevMonth ? colors.textMain : colors.textMuted} />
                  </TouchableOpacity>

                  <Text style={[styles.calendarMonthTitle, { color: colors.textMain }]}>
                    {pickerMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.monthNavBtn,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      !canGoNextMonth && styles.monthNavBtnDisabled,
                    ]}
                    disabled={!canGoNextMonth}
                    onPress={() => setPickerMonthDate(new Date(pickerMonthDate.getFullYear(), pickerMonthDate.getMonth() + 1, 1))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="chevron-right" size={18} color={canGoNextMonth ? colors.textMain : colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Days of week header */}
                <View style={styles.calendarWeekdaysRow}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <Text key={idx} style={[styles.calendarWeekdayText, { color: colors.textMuted }]}>
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Days grid */}
                <View style={styles.calendarGrid}>
                  {calendarDays.map((cell) => {
                    if (cell.dayNumber === null) {
                      return <View key={cell.dateKey} style={styles.calendarDayCellEmpty} />;
                    }

                    return (
                      <TouchableOpacity
                        key={cell.dateKey}
                        style={styles.calendarDayCell}
                        disabled={cell.isDisabled}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (cell.offset !== undefined) {
                            setSelectedDayOffset(cell.offset);
                            setShowDatePickerModal(false);
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.calendarDayCellInner,
                            cell.isSelected && { backgroundColor: colors.primary },
                            cell.isToday && !cell.isSelected && { borderColor: colors.primary, borderWidth: 1.5 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              { color: colors.textMain },
                              cell.isSelected && styles.calendarDayTextSelected,
                              cell.isDisabled && styles.calendarDayTextDisabled,
                            ]}
                          >
                            {cell.dayNumber}
                          </Text>
                          {cell.isMinDate && (
                            <View
                              style={[
                                styles.calendarMinBadge,
                                cell.isSelected && { backgroundColor: '#FFFFFF' },
                              ]}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Available Days Scroll List */}
              <ScrollView
                style={styles.datePickerGridScroll}
                contentContainerStyle={styles.datePickerGridContent}
                showsVerticalScrollIndicator={true}
              >
                {availableDays.map((item) => {
                  const isSelected = selectedDayOffset === item.offset;
                  const isMinDay = item.offset === maxAvailableDays - 1;
                  return (
                    <TouchableOpacity
                      key={item.offset}
                      style={[
                        styles.datePickerRow,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(99, 102, 241, 0.25)'
                              : 'rgba(99, 102, 241, 0.1)'
                            : colors.tileBg,
                          borderColor: isSelected ? colors.primary : isMinDay ? '#10B981' : colors.tileBorder,
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedDayOffset(item.offset);
                        setShowDatePickerModal(false);
                      }}
                    >
                      <View style={styles.dateRowLeft}>
                        <View
                          style={[
                            styles.dateRowBadge,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : isMinDay
                                ? '#10B981'
                                : isDark
                                ? '#334155'
                                : '#E2E8F0',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dateRowBadgeText,
                              { color: isSelected || isMinDay ? '#FFFFFF' : colors.textMain },
                            ]}
                          >
                            {item.dayOfMonth}
                          </Text>
                        </View>
                        <View>
                          <Text
                            style={[
                              styles.dateRowTitle,
                              {
                                color: isSelected ? colors.primary : isMinDay ? '#10B981' : colors.textMain,
                                fontWeight: isSelected || isMinDay ? '800' : '600',
                              },
                            ]}
                          >
                            {item.fullDateLabel}
                          </Text>
                          <Text style={[styles.dateRowSubtitle, { color: colors.textMuted }]}>
                            {item.dateStr} • {item.daysAgoText}
                          </Text>
                        </View>
                      </View>

                      {isSelected ? (
                        <View style={[styles.selectedCheckCircle, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={16} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  memberCardHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800',
  },
  memberSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  fullMapActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  dateNavSection: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  dateNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.35,
  },
  datePickerTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  datePickerTriggerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  historyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  daysScrollList: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 2,
  },
  dayStripPill: {
    width: 58,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
  },
  dayStripPillSelected: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  dayStripWeekday: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  dayStripDate: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 1,
  },
  dayStripMonth: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetGrabHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabBar: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 3,
  },
  datePickerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  datePickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  minDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  minDateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  minDateIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minDateTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  minDateBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  minDateBadgeText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  minDateSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '500',
  },
  jumpMinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  jumpMinPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  minJoinBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  calendarContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: {
    opacity: 0.25,
  },
  calendarMonthTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  calendarWeekdayText: {
    fontSize: 11,
    fontWeight: '700',
    width: 34,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  calendarDayCellEmpty: {
    width: '14.28%',
    height: 38,
  },
  calendarDayCellInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarDayTextDisabled: {
    opacity: 0.25,
  },
  calendarMinBadge: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  quickShortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  datePickerGridScroll: {
    paddingHorizontal: 20,
  },
  datePickerGridContent: {
    gap: 8,
    paddingBottom: 16,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  dateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateRowBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRowBadgeText: {
    fontSize: 15,
    fontWeight: '900',
  },
  dateRowTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  dateRowSubtitle: {
    fontSize: 11,
  },
  selectedCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSectionWrapper: {
    height: 250,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapOverlayControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  mapOverlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mapOverlayBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapFloatingInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  mapInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapInfoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapInfoDivider: {
    width: 1,
    height: 12,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
    marginTop: 12,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  timelineList: {
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  nodeColumn: {
    alignItems: 'center',
    width: 36,
    marginRight: 10,
  },
  numberedStopNode: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  nodeFirstStop: {
    backgroundColor: '#4F46E5',
  },
  nodeRegularStop: {
    backgroundColor: '#3B82F6',
  },
  nodeCurrentStop: {
    backgroundColor: '#10B981',
  },
  stopNodeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tripNodeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  trackLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  tripTrackLine: {
    width: 0,
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  cardContent: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stopTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopNumberBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stopNumberBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemAddress: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  batteryPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  focusOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  focusOnMapText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tripCardContent: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tripStatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tripStatText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
  },
  tripRouteText: {
    fontSize: 11,
    marginBottom: 6,
  },
  tripBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  speedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    marginTop: 2,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 5,
  },
  filterTabActive: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetFilterBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  resetFilterBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
export default MemberTimelineModal;
