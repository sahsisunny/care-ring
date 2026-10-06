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
  statusText?: string;
  statusIcon?: string;
  activity?: MovementActivityInfo;
  isBubble: boolean;
  isMoving: boolean;
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

export const DynamicMemberRadar: React.FC<DynamicMemberRadarProps> = ({
  members,
  currentUserId,
  viewport,
  userLocation,
  favoriteMemberIds,
  nicknames = {},
  selectedMemberId,
  onSelectMember,
}) => {
  const { colors, isDark, isGlass } = useTheme();

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
    if (!viewport || !viewport.center || !viewport.bounds) {
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
      // Don't show edge beacon for self or members with invalid coordinates
      if (m.id === currentUserId || !m.latitude || !m.longitude) {
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

      // East half (0° - 180°) -> Right rail, West half (180° - 360°) -> Left rail
      const side: 'left' | 'right' = bearing >= 180 && bearing < 360 ? 'left' : 'right';

      const isMoving = m.isMoving || ((m.speed || 0) >= 1.8 && !m.isStationary);
      const activity = isMoving ? getMovementActivity(m.speed, m.isStationary) : undefined;
      let statusText: string | undefined;
      let statusIcon: string | undefined;

      if (m.inBubble) {
        const km = Math.round((m.bubbleRadius || 2000) / 1000);
        statusText = `~${km}km`;
        statusIcon = '🫧';
      } else if (activity) {
        statusText = `${activity.label} ${Math.round(m.speed)} km/h`;
        statusIcon = activity.emoji;
      } else if (typeof m.batteryLevel === 'number' && m.batteryLevel <= 20) {
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
        statusText,
        statusIcon,
        activity,
        isBubble: Boolean(m.inBubble),
        isMoving,
      });
    }

    // Sort candidates: moving or bubble first, then closest distance
    candidates.sort((a, b) => {
      if (a.isMoving !== b.isMoving) return a.isMoving ? -1 : 1;
      if (a.isBubble !== b.isBubble) return a.isBubble ? -1 : 1;
      return a.distanceMeters - b.distanceMeters;
    });

    // Cap at max 3 beacons per side to preserve map visibility
    const left = candidates.filter((c) => c.side === 'left').slice(0, 3);
    const right = candidates.filter((c) => c.side === 'right').slice(0, 3);

    return { leftBeacons: left, rightBeacons: right };
  }, [viewport, members, currentUserId, userLocation, favoriteMemberIds, distancePrefs]);

  if (leftBeacons.length === 0 && rightBeacons.length === 0) {
    return null;
  }

  const renderBeacon = (beacon: BeaconData) => {
    const isLeft = beacon.side === 'left';
    const isSelected = selectedMemberId === beacon.member.id;
    const memberName = nicknames[beacon.member.id] || beacon.member.fullName.split(' ')[0];

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text
              style={[styles.memberNameText, { color: colors.textMain }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {memberName}
            </Text>
            <Text style={{ fontSize: 9 }}>💖</Text>
          </View>

          <View style={styles.subRow}>
            {beacon.distanceFormatted ? (
              <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                {beacon.distanceEmoji ? `${beacon.distanceEmoji} ` : ''}{beacon.distanceFormatted}
              </Text>
            ) : null}

            {beacon.statusText ? (
              <View
                style={[
                  styles.statusTag,
                  beacon.isBubble && styles.bubbleTag,
                  beacon.isMoving && styles.movingTag,
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
                <Text style={styles.statusTagText}>
                  {beacon.statusText}
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
    zIndex: 90,
  },
  leftRail: {
    position: 'absolute',
    left: 8,
    top: 140,
    gap: 8,
    alignItems: 'flex-start',
  },
  rightRail: {
    position: 'absolute',
    right: 8,
    top: 140,
    gap: 8,
    alignItems: 'flex-end',
  },
  beaconBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
    maxWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
  },
  memberNameText: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 68,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  distanceText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  statusTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  bubbleTag: {
    backgroundColor: 'rgba(167, 139, 250, 0.22)',
  },
  movingTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  statusTagText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#0284C7',
  },
});
