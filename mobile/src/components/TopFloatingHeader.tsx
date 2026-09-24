import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Circle } from '../models/Circle';
import { Colors } from '../theme/colors';

interface TopFloatingHeaderProps {
  selectedCircle: Circle | null;
  unreadAlertCount?: number;
  onCirclePress: () => void;
  onChatTapped: () => void;
  onAlertsTapped: () => void;
  onSettingsTapped: () => void;
}

export const TopFloatingHeader: React.FC<TopFloatingHeaderProps> = ({
  selectedCircle,
  unreadAlertCount = 0,
  onCirclePress,
  onChatTapped,
  onAlertsTapped,
  onSettingsTapped,
}) => {
  return (
    <View style={styles.topContainer} pointerEvents="box-none">
      {/* 1. Left: Circular Settings Gear Button (Life360 style) */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onSettingsTapped}
        style={styles.circleIconButton}
      >
        <Ionicons name="settings-sharp" size={20} color={Colors.primary} />
      </TouchableOpacity>

      {/* 2. Center: Circle Selector Dropdown Pill (e.g. "Family ▾") */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onCirclePress}
        style={styles.circleSelectorPill}
      >
        <Text style={styles.circleNameText} numberOfLines={1}>
          {selectedCircle ? selectedCircle.name : 'Select Circle'}
        </Text>
        <Ionicons name="chevron-down" size={17} color={Colors.primary} />
      </TouchableOpacity>

      {/* 3. Right: Action Buttons (Inbox Mail with Badge + Chat Bubble) */}
      <View style={styles.rightActionsRow} pointerEvents="box-none">
        {/* Inbox / Alert Center Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onAlertsTapped}
          style={styles.circleIconButton}
        >
          <Ionicons name="mail" size={20} color={Colors.primary} />
          {unreadAlertCount > 0 && (
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{unreadAlertCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Group Chat Bubble Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onChatTapped}
          style={styles.circleIconButton}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 38,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  circleSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    maxWidth: '52%',
  },
  circleNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF4B4B',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
