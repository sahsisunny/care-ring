import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Circle } from '../models/Circle';
import { MemberData } from '../models/Member';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';
import { getWebGlassPillStyle } from '../theme/colors';
import { Skeleton } from './common/Skeleton';
import { getMovementActivity } from '../models/MovementActivity';
import { AnimatedActivityEmoji } from './common/AnimatedActivityEmoji';

interface TopFloatingHeaderProps {
  selectedCircle: Circle | null;
  selectedMember?: MemberData | null;
  isSheetExpanded?: boolean;
  circleMemberCount?: number;
  isLoading?: boolean;
  unreadAlertCount?: number;
  onCirclePress: () => void;
  onChatTapped: () => void;
  onAlertsTapped: () => void;
  onSettingsTapped?: () => void;
  onBackFromMember?: () => void;
  onRefreshMember?: () => void;
  onBackFromMemberList?: () => void;
  onRefreshMemberList?: () => void;
}

export const TopFloatingHeader: React.FC<TopFloatingHeaderProps> = ({
  selectedCircle,
  selectedMember,
  isSheetExpanded = false,
  circleMemberCount,
  isLoading = false,
  unreadAlertCount = 0,
  onCirclePress,
  onChatTapped,
  onAlertsTapped,
  onSettingsTapped,
  onBackFromMember,
  onRefreshMember,
  onBackFromMemberList,
  onRefreshMemberList,
}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);
  const topOffset = statusBarHeight + 10;
  const { colors, isDark, isGlass } = useTheme();

  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  const dynamicCardStyle = [
    {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
    },
    webGlassPill,
  ];

  const dynamicElevation = isGlass
    ? isDark
      ? styles.darkGlassShadow
      : styles.lightGlassShadow
    : styles.standardShadow;

  // 1. User Profile active: Left Back Pill (Arrow + Member Avatar + Name/Status), Right Refresh Button
  if (selectedMember) {
    const firstName = (selectedMember.fullName || 'Member').trim().split(' ')[0];
    return (
      <View style={[styles.topContainer, { top: topOffset }]} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onBackFromMember}
          style={[styles.memberBackHeaderPill, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textMain} />
          <Avatar
            name={selectedMember.fullName || 'Member'}
            avatarUrl={selectedMember.avatarUrl}
            size={32}
          />
          <View style={styles.memberHeaderTextWrap}>
            <Text style={[styles.memberHeaderTitle, { color: colors.textMain }]} numberOfLines={1}>
              {firstName}
            </Text>
            {(() => {
              const isMoving = selectedMember.isMoving || ((selectedMember.speed || 0) >= 1.8 && !selectedMember.isStationary);
              const activity = isMoving ? getMovementActivity(selectedMember.speed, selectedMember.isStationary) : null;
              if (activity) {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <AnimatedActivityEmoji activity={activity} size={11} />
                    <Text style={[styles.memberHeaderSub, { color: activity.color, fontWeight: '700' }]}>
                      {activity.label} • {Math.round(selectedMember.speed)} km/h
                    </Text>
                  </View>
                );
              }
              return (
                <Text style={[styles.memberHeaderSub, { color: colors.textMuted }]}>
                  Last updated now
                </Text>
              );
            })()}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onRefreshMember}
          style={[styles.circleIconButton, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="sync" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>
    );
  }

  // 2. Member List expanded: Left Back Pill (Arrow + Circle Badge + Name/Members count), Right Refresh Button
  if (isSheetExpanded) {
    const circleName = selectedCircle ? selectedCircle.name : 'Circle Members';
    return (
      <View style={[styles.topContainer, { top: topOffset }]} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onBackFromMemberList}
          style={[styles.memberBackHeaderPill, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textMain} />
          <View
            style={[
              styles.circleAvatarBadge,
              { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : 'rgba(124, 58, 237, 0.12)' },
            ]}
          >
            <Ionicons name="people" size={17} color="#7C3AED" />
          </View>
          <View style={styles.memberHeaderTextWrap}>
            <Text style={[styles.memberHeaderTitle, { color: colors.textMain }]} numberOfLines={1}>
              {circleName}
            </Text>
            <Text style={[styles.memberHeaderSub, { color: colors.textMuted }]}>
              {circleMemberCount != null ? `${circleMemberCount} ${circleMemberCount === 1 ? 'member' : 'members'}` : 'Family group'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onRefreshMemberList || onRefreshMember}
          style={[styles.circleIconButton, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="sync" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Normal Map View: Family Switcher on Top-Right Corner with Action Icons
  return (
    <View style={[styles.topContainer, { top: topOffset, justifyContent: 'flex-end' }]} pointerEvents="box-none">
      {/* Right: Action Buttons + Circle Selector Dropdown on the Top-Right Corner */}
      <View style={styles.rightActionsRow} pointerEvents="box-none">
        {/* Inbox / Alert Center Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onAlertsTapped}
          style={[styles.circleIconButton, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="mail" size={20} color={colors.primary} />
          {unreadAlertCount > 0 && (
            <View style={[styles.badgePill, { borderColor: colors.card }]}>
              <Text style={styles.badgeText}>{unreadAlertCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Group Chat Bubble Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onChatTapped}
          style={[styles.circleIconButton, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Top-Right Corner: Circle Selector Dropdown Pill */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCirclePress}
          style={[styles.circleSelectorPillRight, dynamicCardStyle, dynamicElevation]}
        >
          <Ionicons name="people" size={15} color={colors.primary} />
          {isLoading && !selectedCircle ? (
            <Skeleton width={56} height={14} borderRadius={7} style={{ marginVertical: 3 }} />
          ) : (
            <Text style={[styles.circleNameText, { color: colors.textMain }]} numberOfLines={1}>
              {selectedCircle ? selectedCircle.name : 'Select Circle'}
            </Text>
          )}
          <Ionicons name="chevron-down" size={15} color={colors.primary} />
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
    zIndex: 9999,
    elevation: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  circleSelectorPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    maxWidth: 145,
  },
  circleNameText: {
    fontSize: 14,
    fontWeight: '800',
    maxWidth: 82,
  },
  circleAvatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  standardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  memberBackHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 26,
    borderWidth: 1.5,
    maxWidth: '78%',
  },
  memberHeaderTextWrap: {
    justifyContent: 'center',
  },
  memberHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  memberHeaderSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
