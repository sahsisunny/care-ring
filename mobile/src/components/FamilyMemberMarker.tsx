import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MemberData, getMemberInitials } from '../models/Member';
import { getMovementActivity } from '../models/MovementActivity';
import { AnimatedActivityEmoji } from './common/AnimatedActivityEmoji';
import { Colors } from '../theme/colors';

interface FamilyMemberMarkerProps {
  member: MemberData;
  onTap?: () => void;
}

export const FamilyMemberMarker: React.FC<FamilyMemberMarkerProps> = ({
  member,
  onTap,
}) => {
  const isMoving = member.isMoving || ((member.speed || 0) >= 1.8 && !member.isStationary);
  const activity = isMoving ? getMovementActivity(member.speed, member.isStationary) : null;

  const ringColor = member.isOnline
    ? isMoving
      ? (activity?.color || Colors.moving)
      : Colors.movingDark
    : Colors.offline;

  const displayName = member.fullName?.trim() || 'Family Member';
  const batteryText = member.batteryLevel !== undefined ? `${member.isCharging ? '⚡' : ''}${member.batteryLevel}%` : '';
  const detailText = isMoving ? `${activity?.label} ${Math.round(member.speed)} km/h` : batteryText;
  const pillLabel = detailText ? `${displayName} • ${detailText}` : displayName;
  const initials = getMemberInitials(member.fullName);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onTap} style={styles.container}>
      {/* 1. Circular Avatar with Online/Moving Glowing Halo */}
      <View
        style={[
          styles.avatarHalo,
          {
            borderColor: ringColor,
            shadowColor: ringColor,
          },
        ]}
      >
        {member.avatarUrl ? (
          <Image
            source={{ uri: member.avatarUrl }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.initialsContainer}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}
      </View>

      {/* 2. Floating Status Pill (User Name & Battery / Speed / Animated Emoji) */}
      <View style={styles.pillContainer}>
        {activity && (
          <AnimatedActivityEmoji
            activity={activity}
            size={12}
            style={{ marginRight: 3 }}
          />
        )}
        <Text style={styles.pillText} numberOfLines={1}>
          {pillLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHalo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3.5,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initialsContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pillContainer: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
});
