import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { MemberData } from '../models/Member';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';
import { calculateBearing, calculateDistanceMeters, formatCompactDistance } from '../utils/distance';
import { MapViewportInfo } from './MapView';

interface DynamicMemberRadarProps {
  members: MemberData[];
  currentUserId: string;
  viewport?: MapViewportInfo | null;
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
  statusText?: string;
  statusIcon?: string;
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
  favoriteMemberIds,
  nicknames = {},
  selectedMemberId,
  onSelectMember,
}) => {
  const { colors, isDark, isGlass } = useTheme();

  const { leftBeacons, rightBeacons } = useMemo(() => {
    if (!viewport || !viewport.center || !viewport.bounds) {
      return { leftBeacons: [], rightBeacons: [] };
    }

    const { center, bounds } = viewport;
    const centerLat = center.lat;
    const centerLng = center.lng;

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

      const bearing = calculateBearing(centerLat, centerLng, m.latitude, m.longitude);
      const distanceMeters = calculateDistanceMeters(centerLat, centerLng, m.latitude, m.longitude);
      const arrow = getDirectionalArrow(bearing);

      // East half (0° - 180°) -> Right rail, West half (180° - 360°) -> Left rail
      const side: 'left' | 'right' = bearing >= 180 && bearing < 360 ? 'left' : 'right';

      let statusText: string | undefined;
      let statusIcon: string | undefined;

      if (m.inBubble) {
        const km = Math.round((m.bubbleRadius || 2000) / 1000);
        statusText = `~${km}km`;
        statusIcon = '🫧';
      } else if (m.isMoving) {
        statusText = `${Math.round(m.speed)} km/h`;
        statusIcon = '🚗';
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
        distanceFormatted: formatCompactDistance(distanceMeters),
        statusText,
        statusIcon,
        isBubble: Boolean(m.inBubble),
        isMoving: Boolean(m.isMoving),
      });
    }

    // Sort candidates: moving or bubble first, then closest distance
    const sortFn = (a: BeaconData, b: BeaconData) => {
      if (a.isBubble && !b.isBubble) return -1;
      if (!a.isBubble && b.isBubble) return 1;
      if (a.isMoving && !b.isMoving) return -1;
      if (!a.isMoving && b.isMoving) return 1;
      return a.distanceMeters - b.distanceMeters;
    };

    const left = candidates.filter((c) => c.side === 'left').sort(sortFn).slice(0, 3);
    const right = candidates.filter((c) => c.side === 'right').sort(sortFn).slice(0, 3);

    return { leftBeacons: left, rightBeacons: right };
  }, [members, currentUserId, viewport, favoriteMemberIds]);

  if (leftBeacons.length === 0 && rightBeacons.length === 0) {
    return null;
  }

  const renderBeacon = (beacon: BeaconData) => {
    const isSelected = beacon.member.id === selectedMemberId;
    const isLeft = beacon.side === 'left';
    const rawNickname = nicknames[beacon.member.id]?.trim();
    const effectiveFullName = rawNickname || beacon.member.fullName || 'Member';
    const memberName = rawNickname || beacon.member.fullName?.split(' ')[0] || 'Member';

    return (
      <TouchableOpacity
        key={beacon.member.id}
        activeOpacity={0.82}
        onPress={() => onSelectMember(beacon.member)}
        style={[
          styles.beaconPill,
          isLeft ? styles.beaconPillLeft : styles.beaconPillRight,
          {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
            borderColor: isSelected
              ? colors.primary
              : beacon.isBubble
              ? '#8B5CF6'
              : colors.cardBorder,
          },
          isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
          beacon.isBubble && styles.bubbleGlow,
        ]}
      >
        {isLeft && (
          <View style={[styles.arrowBox, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
            <Text style={[styles.arrowText, { color: colors.primary }]}>{beacon.arrow}</Text>
          </View>
        )}

        <View style={styles.avatarWrap}>
          <Avatar
            name={effectiveFullName}
            avatarUrl={beacon.member.avatarUrl}
            size={34}
            borderWidth={1.5}
            borderColor={
              beacon.isBubble
                ? '#8B5CF6'
                : beacon.member.isOnline
                ? colors.moving
                : '#94A3B8'
            }
            showOnlineDot={false}
          />
        </View>

        <View style={[styles.infoCol, isLeft ? styles.infoColLeft : styles.infoColRight]}>
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
                {beacon.distanceFormatted}
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
                <Text style={styles.statusTagText}>
                  {beacon.statusIcon} {beacon.statusText}
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
    ...StyleSheet.absoluteFill,
    zIndex: 92,
  },
  leftRail: {
    position: 'absolute',
    left: 12,
    top: Platform.OS === 'ios' ? 120 : 100,
    gap: 10,
    alignItems: 'flex-start',
  },
  rightRail: {
    position: 'absolute',
    right: 12,
    top: Platform.OS === 'ios' ? 120 : 100,
    gap: 10,
    alignItems: 'flex-end',
  },
  beaconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 22,
    borderWidth: 1.5,
    maxWidth: 165,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  beaconPillLeft: {
    paddingLeft: 5,
  },
  beaconPillRight: {
    paddingRight: 5,
  },
  arrowBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  avatarWrap: {
    marginHorizontal: 5,
  },
  infoCol: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  infoColLeft: {
    marginRight: 4,
  },
  infoColRight: {
    marginLeft: 4,
  },
  memberNameText: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 82,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
  },
  bubbleTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
  },
  movingTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  bubbleGlow: {
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    borderColor: '#8B5CF6',
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOpacity: 0.25,
  },
});
