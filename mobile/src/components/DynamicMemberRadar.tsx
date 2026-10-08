import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { MemberData } from '../models/Member';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';
import {
  calculateBearing,
  calculateDistanceMeters,
  getMemberDistanceDisplay,
  formatCompactDistance,
  formatSpeed,
  NEARBY_THRESHOLD_METERS,
} from '../utils/distance';
import {
  distancePreferencesService,
  DistancePreferences,
} from '../services/DistancePreferencesService';
import { MapViewportInfo } from './MapView';
import { getMovementActivity, MovementActivityInfo } from '../models/MovementActivity';
import { AnimatedActivityEmoji } from './common/AnimatedActivityEmoji';

interface DynamicMemberRadarProps {
  members: MemberData[];
  currentUserId: string;
  viewport?: MapViewportInfo | null;
  userLocation?: { latitude: number; longitude: number } | null;
  favoriteMemberIds?: string[];
  nicknames?: Record<string, string>;
  selectedMemberId?: string | null;
  isSheetExpanded?: boolean;
  onSelectMember: (member: MemberData) => void;
}

interface BeaconData {
  member: MemberData;
  side: 'left' | 'right';
  bearing: number;
  arrow: string;
  distanceMeters: number;
  distanceFormatted: string;
  distanceEmoji?: string;
  isNearby: boolean;
  statusText?: string;
  statusIcon?: string;
  activity?: MovementActivityInfo;
  isBubble: boolean;
  isMoving: boolean;
  isLowBattery: boolean;
}

function getDirectionalArrow(bearing: number): string {
  if (bearing >= 337.5 || bearing < 22.5) return '↑';
  if (bearing >= 22.5 && bearing < 67.5) return '↗';
  if (bearing >= 67.5 && bearing < 112.5) return '→';
  if (bearing >= 112.5 && bearing < 157.5) return '↘';
  if (bearing >= 157.5 && bearing < 202.5) return '↓';
  if (bearing >= 202.5 && bearing < 247.5) return '↙';
  if (bearing >= 247.5 && bearing < 292.5) return '←';
  return '↖';
}

function isCoordInsideBounds(lat: number, lng: number, bounds: MapViewportInfo['bounds']): boolean {
  // Add a slight margin buffer (~3%) so members near the screen border smoothly transition
  const latMargin = Math.abs(bounds.north - bounds.south) * 0.03;
  const lngMargin = Math.abs(bounds.east - bounds.west) * 0.03;

  return (
    lat <= bounds.north - latMargin &&
    lat >= bounds.south + latMargin &&
    lng <= bounds.east - lngMargin &&
    lng >= bounds.west + lngMargin
  );
}

const DynamicMemberRadarInner: React.FC<DynamicMemberRadarProps> = ({
  members,
  currentUserId,
  viewport,
  userLocation,
  favoriteMemberIds,
  nicknames = {},
  selectedMemberId,
  isSheetExpanded = false,
  onSelectMember,
}) => {
  const { colors, isDark } = useTheme();

  const [distancePrefs, setDistancePrefs] = useState<DistancePreferences>(
    distancePreferencesService.getPreferencesSync()
  );

  useEffect(() => {
    const unsub = distancePreferencesService.subscribe((prefs) => {
      setDistancePrefs(prefs);
    });
    return unsub;
  }, []);

  const { leftBeacons, rightBeacons } = useMemo(() => {
    if (isSheetExpanded || !viewport || !viewport.center || !viewport.bounds) {
      return { leftBeacons: [], rightBeacons: [] };
    }

    const { center, bounds } = viewport;
    const centerLat = center.lat;
    const centerLng = center.lng;

    // Fixed user location origin (NOT dynamic viewport camera center)
    const selfLat = userLocation?.latitude || members.find((m) => m.id === currentUserId)?.latitude || centerLat;
    const selfLng = userLocation?.longitude || members.find((m) => m.id === currentUserId)?.longitude || centerLng;

    const candidates: BeaconData[] = [];

    for (const m of members) {
      // Don't show edge beacon for self, invalid coordinates, or the currently selected member whose profile is open
      if (m.id === currentUserId || !m.latitude || !m.longitude || (selectedMemberId && m.id === selectedMemberId)) {
        continue;
      }

      // User preference: ONLY members marked as favorite appear on the map edge radar with directions!
      if (!favoriteMemberIds || !favoriteMemberIds.includes(m.id)) {
        continue;
      }

      // If the member is already visible inside the map viewport, do not show edge beacon
      if (isCoordInsideBounds(m.latitude, m.longitude, bounds)) {
        continue;
      }

      // Bearing relative to screen viewport center so arrow points in correct physical direction on screen edge
      const bearing = calculateBearing(centerLat, centerLng, m.latitude, m.longitude);
      const arrow = getDirectionalArrow(bearing);

      // Distance calculated from user's current GPS location (static, NOT dynamic with camera panning)
      const distInfo = getMemberDistanceDisplay(selfLat, selfLng, m.latitude, m.longitude, distancePrefs);
      const distanceMeters = distInfo?.rawMeters || calculateDistanceMeters(selfLat, selfLng, m.latitude, m.longitude);
      const distanceFormatted = distInfo?.compactDistance || formatCompactDistance(distanceMeters, distancePrefs.unit);
      const isNearby = Boolean(
        distInfo?.isNearby ||
        distanceMeters <= NEARBY_THRESHOLD_METERS ||
        distanceFormatted.toLowerCase() === 'nearby'
      );

      // East half (0° - 180°) -> Right rail, West half (180° - 360°) -> Left rail
      const side: 'left' | 'right' = bearing >= 180 && bearing < 360 ? 'left' : 'right';

      const rawSpd = (typeof m.speed === 'number' && !isNaN(m.speed) && m.speed > 0) ? m.speed : 0;
      const hasMovingAct = Boolean(m.activityType && m.activityType !== 'stationary' && m.activityType !== 'unknown');
      const isMoving = rawSpd >= 1.8 && (rawSpd > 3.5 || hasMovingAct || (m.isMoving && !m.isStationary));
      const activity = (isMoving && rawSpd >= 1.8)
        ? getMovementActivity(m.speed, m.isStationary, m.activityType)
        : undefined;
      const isLowBattery = typeof m.batteryLevel === 'number' && m.batteryLevel <= 20;
      let statusText: string | undefined;
      let statusIcon: string | undefined;

      const isSelf = m.id === currentUserId;
      if (isSelf && m.inBubble) {
        const compactRadius = formatCompactDistance(m.bubbleRadius || 2000, distancePrefs.unit);
        statusText = `~${compactRadius}`;
        statusIcon = '👻';
      } else if (activity && activity.type !== 'stationary') {
        const actLabel = activity.type === 'high_speed' ? 'Highway' : activity.label;
        statusText = `${actLabel} ${formatSpeed(m.speed || 0, distancePrefs.unit)}`;
        statusIcon = activity.emoji;
      } else if (isLowBattery) {
        statusText = `${m.batteryLevel}%`;
        statusIcon = '🪫';
      }

      candidates.push({
        member: m,
        side,
        bearing,
        arrow,
        distanceMeters,
        distanceFormatted,
        distanceEmoji: distInfo?.emoji,
        isNearby,
        statusText,
        statusIcon,
        activity,
        isBubble: Boolean(isSelf && m.inBubble),
        isMoving,
        isLowBattery,
      });
    }

    // Sort candidates: moving or bubble or low battery first, then closest distance
    candidates.sort((a, b) => {
      if (a.isMoving !== b.isMoving) return a.isMoving ? -1 : 1;
      if (a.isBubble !== b.isBubble) return a.isBubble ? -1 : 1;
      if (a.isLowBattery !== b.isLowBattery) return a.isLowBattery ? -1 : 1;
      return a.distanceMeters - b.distanceMeters;
    });

    // Cap at max 3 beacons per side to preserve map visibility
    const left = candidates.filter((c) => c.side === 'left').slice(0, 3);
    const right = candidates.filter((c) => c.side === 'right').slice(0, 3);

    return { leftBeacons: left, rightBeacons: right };
  }, [isSheetExpanded, selectedMemberId, viewport, members, currentUserId, userLocation, favoriteMemberIds, distancePrefs]);

  if (isSheetExpanded || (leftBeacons.length === 0 && rightBeacons.length === 0)) {
    return null;
  }

  const renderBeacon = (beacon: BeaconData) => {
    const isLeft = beacon.side === 'left';
    const isSelected = selectedMemberId === beacon.member.id;
    const memberName = nicknames[beacon.member.id]?.trim() || (beacon.member.fullName ? beacon.member.fullName.trim().split(' ')[0] : 'Member');

    return (
      <TouchableOpacity
        key={beacon.member.id}
        activeOpacity={0.85}
        onPress={() => onSelectMember(beacon.member)}
        style={[
          styles.beaconBubble,
          isLeft ? styles.beaconBubbleLeft : styles.beaconBubbleRight,
          {
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.94)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isSelected
              ? colors.primary
              : isDark
              ? 'rgba(71, 85, 105, 0.6)'
              : 'rgba(226, 232, 240, 0.9)',
          },
          isSelected && styles.beaconBubbleSelected,
          Platform.OS === 'web' && {
            backdropFilter: 'blur(12px)',
          } as any,
        ]}
      >
        {isLeft && (
          <View style={[styles.arrowBox, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
            <Text style={[styles.arrowText, { color: colors.primary }]}>{beacon.arrow}</Text>
          </View>
        )}

        <View style={styles.avatarWrapper}>
          <Avatar
            name={beacon.member.fullName}
            avatarUrl={beacon.member.avatarUrl}
            size={28}
          />
          {beacon.isMoving && (
            <View style={styles.movingDot}>
              <View style={styles.movingDotPulse} />
            </View>
          )}
        </View>

        <View style={styles.infoCol}>
          <Text
            style={[styles.memberNameText, { color: colors.textMain }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {memberName}
          </Text>

          <View style={styles.subRow}>
            {beacon.distanceFormatted ? (
              <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                {(!beacon.isMoving && !beacon.isNearby && beacon.distanceEmoji) ? `${beacon.distanceEmoji} ` : ''}{beacon.distanceFormatted}
              </Text>
            ) : null}

            {beacon.statusText ? (
              <View
                style={[
                  styles.statusTag,
                  beacon.isBubble && styles.bubbleTag,
                  beacon.isMoving && styles.movingTag,
                  beacon.statusIcon === '🪫' && styles.lowBatteryTag,
                ]}
              >
                {beacon.activity ? (
                  <AnimatedActivityEmoji
                    activity={beacon.activity}
                    size={11}
                    style={{ marginRight: 2 }}
                  />
                ) : (
                  beacon.statusIcon ? <Text style={styles.statusTagText}>{beacon.statusIcon} </Text> : null
                )}
                <Text
                  style={[
                    styles.statusTagText,
                    beacon.isMoving && { color: isDark ? '#34D399' : '#047857' },
                    beacon.isBubble && { color: isDark ? '#C4B5FD' : '#7C3AED' },
                    (!beacon.isMoving && !beacon.isBubble && beacon.statusIcon === '🪫') && { color: isDark ? '#FCA5A5' : '#DC2626' },
                  ]}
                  numberOfLines={1}
                >
                  {beacon.statusText}
                </Text>
              </View>
            ) : null}

            {beacon.isLowBattery && beacon.statusIcon !== '🪫' ? (
              <View style={[styles.statusTag, styles.lowBatteryTag]}>
                <Text
                  style={[
                    styles.statusTagText,
                    { color: isDark ? '#FCA5A5' : '#DC2626' },
                  ]}
                  numberOfLines={1}
                >
                  {`🪫 ${beacon.member.batteryLevel}%`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {!isLeft && (
          <View style={[styles.arrowBox, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
            <Text style={[styles.arrowText, { color: colors.primary }]}>{beacon.arrow}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.absoluteContainer} pointerEvents="box-none">
      {/* Left Edge Rail */}
      {leftBeacons.length > 0 && (
        <View style={styles.leftRail} pointerEvents="box-none">
          {leftBeacons.map(renderBeacon)}
        </View>
      )}

      {/* Right Edge Rail */}
      {rightBeacons.length > 0 && (
        <View style={styles.rightRail} pointerEvents="box-none">
          {rightBeacons.map(renderBeacon)}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5000,
    elevation: 50,
  },
  leftRail: {
    position: 'absolute',
    left: 8,
    top: 140,
    maxHeight: 260,
    gap: 8,
    alignItems: 'flex-start',
    zIndex: 5001,
    elevation: 51,
  },
  rightRail: {
    position: 'absolute',
    right: 8,
    top: 140,
    maxHeight: 260,
    gap: 8,
    alignItems: 'flex-end',
    zIndex: 5001,
    elevation: 51,
  },
  beaconBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
    maxWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 52,
    zIndex: 5002,
  },
  beaconBubbleLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  beaconBubbleRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  beaconBubbleSelected: {
    borderWidth: 2,
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  arrowBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  avatarWrapper: {
    position: 'relative',
  },
  movingDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  movingDotPulse: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#34D399',
  },
  infoCol: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  memberNameText: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 100,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1.5,
  },
  distanceText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  bubbleTag: {
    backgroundColor: 'rgba(167, 139, 250, 0.22)',
  },
  movingTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  lowBatteryTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  statusTagText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#0284C7',
  },
});
 
export const DynamicMemberRadar = React.memo(DynamicMemberRadarInner);
