import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Circle } from '../models/Circle';
import { Colors } from '../theme/colors';
import { getMemberInitials } from '../models/Member';

interface TopFloatingHeaderProps {
  selectedCircle: Circle | null;
  availableCircles: Circle[];
  currentUserName: string;
  currentUserAvatar?: string | null;
  onCirclePress: () => void;
  onSOSTapped: () => void;
  onMenuTapped: () => void;
}

export const TopFloatingHeader: React.FC<TopFloatingHeaderProps> = ({
  selectedCircle,
  currentUserName,
  currentUserAvatar,
  onCirclePress,
  onSOSTapped,
  onMenuTapped,
}) => {
  const initials = getMemberInitials(currentUserName);

  const innerContent = (
    <View style={styles.headerRow}>
      {/* 1. Profile Avatar (Opens Menu/Settings) */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onMenuTapped}
        style={styles.avatarButton}
      >
        {currentUserAvatar ? (
          <Image
            source={{ uri: currentUserAvatar }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.initialsFallback}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 2. Circle Selector (Dropdown trigger) */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onCirclePress}
        style={styles.circleSelector}
      >
        <View style={styles.circleTitleRow}>
          <Text style={styles.circleName} numberOfLines={1}>
            {selectedCircle ? selectedCircle.name : 'Join or Create Family'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textMain} />
        </View>
        <Text style={styles.circleSubText}>
          {selectedCircle
            ? `${selectedCircle.memberCount} members • Code: ${selectedCircle.inviteCode}`
            : 'Tap to join or create group'}
        </Text>
      </TouchableOpacity>

      {/* 3. SOS Trigger Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onSOSTapped}
        style={styles.sosButton}
      >
        <MaterialIcons name="warning" size={18} color="#FFFFFF" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.outerContainer}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={85} tint="light" style={styles.blurContainer}>
          {innerContent}
        </BlurView>
      ) : (
        <View style={styles.androidGlassContainer}>{innerContent}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  blurContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  androidGlassContainer: {
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  headerRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
    backgroundColor: Colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initialsFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  circleSelector: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  circleName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
    maxWidth: 150,
  },
  circleSubText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.sos,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 4,
    shadowColor: Colors.sos,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  sosText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
