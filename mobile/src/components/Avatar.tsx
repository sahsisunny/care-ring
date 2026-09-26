import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getAvatarColor } from '../theme/colors';
import { getMemberInitials } from '../models/Member';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
  showBattery?: boolean;
  batteryLevel?: number | null;
  isCharging?: boolean;
  showOnlineDot?: boolean;
  isOnline?: boolean;
  statusBorderColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarUrl,
  size = 46,
  borderWidth = 0,
  borderColor = 'transparent',
  showBattery = false,
  batteryLevel,
  isCharging = false,
  showOnlineDot = false,
  isOnline = true,
  statusBorderColor,
}) => {
  const initials = getMemberInitials(name);
  const bgColor = getAvatarColor(name);
  const fontSize = Math.max(12, Math.round(size * 0.42));

  // Determine battery color
  const getBatteryColor = (level?: number | null, charging?: boolean) => {
    if (charging) return Colors.batteryCharging;
    if (level === undefined || level === null) return '#94A3B8';
    if (level <= 20) return Colors.batteryLow;
    if (level <= 50) return Colors.batteryMed;
    return Colors.batteryHigh;
  };

  const dotSize = Math.max(11, Math.min(18, Math.round(size * 0.22)));
  const dotBorderWidth = Math.max(2, Math.round(dotSize * 0.16));
  const activeBorderColor = statusBorderColor || (borderColor !== 'transparent' ? borderColor : '#FFFFFF');

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor,
            backgroundColor: avatarUrl ? '#E2E8F0' : bgColor,
          },
        ]}
      >
        {avatarUrl && avatarUrl.trim().length > 0 ? (
          <Image source={{ uri: avatarUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        )}
      </View>

      {/* Online/Offline Status Dot Badge */}
      {showOnlineDot && (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: dotBorderWidth,
              borderColor: activeBorderColor,
              backgroundColor: isOnline ? '#10B981' : '#94A3B8',
              right: 0,
              top: 0,
              shadowColor: isOnline ? '#10B981' : 'transparent',
              shadowOpacity: isOnline ? 0.45 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: isOnline ? 3 : 1,
            },
          ]}
        />
      )}

      {/* Optional Battery Badge (bottom-left) */}
      {showBattery && batteryLevel !== undefined && batteryLevel !== null && (
        <View style={styles.batteryPill}>
          <Ionicons
            name={isCharging ? 'flash' : 'battery-full'}
            size={10}
            color={getBatteryColor(batteryLevel, isCharging)}
          />
          <Text style={styles.batteryText}>{batteryLevel}%</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  onlineDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  batteryPill: {
    position: 'absolute',
    bottom: -6,
    left: -4,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  batteryText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
});
