import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { MemberData, formatSinceTime } from '../models/Member';
import { Avatar } from './Avatar';
import { calculateDistanceMeters, formatDistance, openNavigationDirections } from '../utils/distance';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle, getWebGlassPillStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = 210;
const MEMBER_DETAIL_HEIGHT = 440;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.78;

interface BottomDraggableSheetProps {
  members: MemberData[];
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
  onSendLiveReaction?: (member: MemberData, emoji: string, label: string) => void;
  onViewWeeklyReport?: (member: MemberData) => void;
  onViewSpeeding?: (member: MemberData) => void;
  onViewTimeline?: (member: MemberData) => void;
  onOpenChat?: () => void;
  onOpenDirectChat?: (member: MemberData) => void;
}

export const BottomDraggableSheet: React.FC<BottomDraggableSheetProps> = ({
  members,
  selectedMember,
  currentUserId,
  myPosition,
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
  onSendLiveReaction,
  onViewWeeklyReport,
  onViewSpeeding,
  onViewTimeline,
  onOpenChat,
  onOpenDirectChat,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [placeAlertActive, setPlaceAlertActive] = useState(true);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassSheet = getWebGlassCardStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  useEffect(() => {
    if (selectedMember) {
      animateToHeight(MEMBER_DETAIL_HEIGHT, false);
    } else {
      animateToHeight(COLLAPSED_HEIGHT, false);
    }
  }, [selectedMember?.id]);

  const animateToHeight = (toValue: number, expandedState: boolean) => {
    Animated.spring(sheetHeight, {
      toValue,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start(() => {
      setIsExpanded(expandedState);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
      onPanResponderMove: (_, gesture) => {
        const baseHeight = selectedMember
          ? (isExpanded ? EXPANDED_HEIGHT : MEMBER_DETAIL_HEIGHT)
          : (isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
        const newHeight = baseHeight - gesture.dy;
        const minHeight = (selectedMember ? MEMBER_DETAIL_HEIGHT : COLLAPSED_HEIGHT) - 30;
        if (newHeight >= minHeight && newHeight <= EXPANDED_HEIGHT + 40) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const defaultHeight = selectedMember ? MEMBER_DETAIL_HEIGHT : COLLAPSED_HEIGHT;
        if (gesture.dy < -45) {
          animateToHeight(EXPANDED_HEIGHT, true);
        } else if (gesture.dy > 45) {
          animateToHeight(defaultHeight, false);
        } else {
          animateToHeight(isExpanded ? EXPANDED_HEIGHT : defaultHeight, isExpanded);
        }
      },
    })
  ).current;

  const toggleSheet = () => {
    const defaultHeight = selectedMember ? MEMBER_DETAIL_HEIGHT : COLLAPSED_HEIGHT;
    if (isExpanded) {
      animateToHeight(defaultHeight, false);
    } else {
      animateToHeight(EXPANDED_HEIGHT, true);
    }
  };

  const getDistanceText = (member: MemberData): string | null => {
    if (member.id === currentUserId) return null;
    if (!myPosition || !member.latitude || !member.longitude) return null;

    const meters = calculateDistanceMeters(
      myPosition.latitude,
      myPosition.longitude,
      member.latitude,
      member.longitude
    );
    return formatDistance(meters);
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
      {/* 1. Floating Map Action Buttons above sheet */}
      {!selectedMember && (
        <Animated.View
          style={[
            styles.floatingMapActionsRow,
            { bottom: Animated.add(sheetHeight, 14) },
          ]}
          pointerEvents="box-none"
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

        {/* =========================================================================
            VIEW A: MEMBER DETAIL VIEW
        ========================================================================= */}
        {selectedMember ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.memberDetailScroll}
          >
            {/* Top Navigation Row: Back Button */}
            <View style={styles.detailNavRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onDeselectMember}
                style={[styles.backCircleBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#F1F5F9' }]}
              >
                <Feather name="chevron-left" size={20} color={colors.textMain} />
              </TouchableOpacity>
            </View>

            {/* Large Avatar Centered Overlapping Header */}
            <View style={styles.detailAvatarCenterWrap}>
              <Avatar
                name={selectedMember.fullName}
                avatarUrl={selectedMember.avatarUrl}
                size={74}
                borderWidth={3}
                borderColor={colors.card}
                statusBorderColor={colors.card}
                showOnlineDot={true}
                isOnline={selectedMember.isOnline}
              />
            </View>

            {/* Member Name + Address + Save Place Card Row */}
            <View style={styles.nameAndAddressRow}>
              <View style={styles.nameAddressTextWrap}>
                <Text style={[styles.memberNameLarge, { color: colors.textMain }]} numberOfLines={1}>
                  {selectedMember.id === currentUserId
                    ? `${selectedMember.fullName.replace(/\s*\(You\)/gi, '').trim()} (You)`
                    : selectedMember.fullName.replace(/\s*\(You\)/gi, '').trim()}
                </Text>

                <Text style={[styles.memberAddressText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {selectedMember.resolvedAddress ||
                    (selectedMember.latitude && selectedMember.longitude
                      ? `${selectedMember.latitude.toFixed(4)}, ${selectedMember.longitude.toFixed(4)}`
                      : 'Bengaluru, Karnataka')}
                </Text>

                <Text style={[styles.sinceText, { color: colors.textMuted }]}>
                  {formatSinceTime(selectedMember)}
                </Text>
              </View>

              {/* Save Place Button Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onSavePlaceTapped?.(selectedMember)}
                style={[
                  styles.savePlaceCard,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                  webGlassTile,
                ]}
              >
                <Ionicons name="location" size={24} color={colors.primary} />
                <Text style={[styles.savePlaceCardText, { color: colors.textMain }]}>Save Place</Text>
              </TouchableOpacity>
            </View>

            {/* Live Emoji Reaction Floating Bar — hidden for self */}
            {!isSelectedSelf && (
              <View style={styles.reactionsBar}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onSendLiveReaction?.(selectedMember, '🍅', 'Boo!')}
                  style={[
                    styles.reactionBtn,
                    {
                      backgroundColor: colors.tileBg,
                      borderColor: colors.tileBorder,
                    },
                    webGlassTile,
                  ]}
                >
                  <Text style={styles.reactionEmoji}>🍅</Text>
                  <Text style={[styles.reactionLabel, { color: colors.textMain }]}>Boo!</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onSendLiveReaction?.(selectedMember, '💖', 'Love you')}
                  style={[
                    styles.reactionBtn,
                    {
                      backgroundColor: colors.tileBg,
                      borderColor: colors.tileBorder,
                    },
                    webGlassTile,
                  ]}
                >
                  <Text style={styles.reactionEmoji}>💖</Text>
                  <Text style={[styles.reactionLabel, { color: colors.textMain }]}>Love you</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onSendLiveReaction?.(selectedMember, '😳', 'Slow down')}
                  style={[
                    styles.reactionBtn,
                    {
                      backgroundColor: colors.tileBg,
                      borderColor: colors.tileBorder,
                    },
                    webGlassTile,
                  ]}
                >
                  <Text style={styles.reactionEmoji}>😳</Text>
                  <Text style={[styles.reactionLabel, { color: colors.textMain }]}>Slow down</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Place Alert Card — hidden for self */}
            {!isSelectedSelf && (
              <View
                style={[
                  styles.placeAlertCard,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                  webGlassTile,
                ]}
              >
                <View style={styles.placeAlertLeft}>
                  <View
                    style={[
                      styles.bellCircle,
                      { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.25)' : '#EDE9FE' },
                    ]}
                  >
                    <Ionicons name="notifications" size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.placeAlertTitle, { color: colors.textMain }]}>Place Alert</Text>
                </View>
                <Switch
                  value={placeAlertActive}
                  onValueChange={setPlaceAlertActive}
                  trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>
            )}

            {/* Quick Action Buttons — self only sees Timeline; others see all 4 */}
            <View style={styles.quickActionPillsRow}>
              {/* Timeline — always visible */}
              <TouchableOpacity
                style={[
                  styles.quickActionPill,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.tileBorder,
                  },
                  webGlassTile,
                ]}
                onPress={() => onViewTimeline?.(selectedMember)}
              >
                <Feather name="rotate-ccw" size={15} color={colors.textMain} />
                <Text style={[styles.quickActionText, { color: colors.textMain }]}>33 hrs 4 min</Text>
              </TouchableOpacity>

              {/* Call, Text, Alerts — hidden for self */}
              {!isSelectedSelf && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.quickActionPill,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: colors.tileBorder,
                      },
                      webGlassTile,
                    ]}
                    onPress={() => handleCallMember(selectedMember)}
                  >
                    <Ionicons name="call-outline" size={15} color={colors.textMain} />
                    <Text style={[styles.quickActionText, { color: colors.textMain }]}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.quickActionPill,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: colors.tileBorder,
                      },
                      webGlassTile,
                    ]}
                    onPress={() => {
                      if (onOpenDirectChat) onOpenDirectChat(selectedMember);
                      else onOpenChat?.();
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={15} color={colors.textMain} />
                    <Text style={[styles.quickActionText, { color: colors.textMain }]}>Text</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.quickActionPill,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: colors.tileBorder,
                      },
                      webGlassTile,
                    ]}
                    onPress={() => Alert.alert('ETA / Alerts', `Monitoring arrivals for ${selectedMember.fullName}`)}
                  >
                    <Feather name="bell" size={15} color={colors.textMain} />
                    <Text style={[styles.quickActionText, { color: colors.textMain }]}>Alerts</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* DRIVER SAFETY SUITE CARD */}
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
                    { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.25)' : '#EDE9FE' },
                  ]}
                >
                  <MaterialIcons name="assignment" size={28} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverCardTitle, { color: colors.textMain }]}>Check out this week's drives</Text>
                  <Text style={[styles.driverCardSubtitle, { color: colors.textSecondary }]}>Since Mon, 21 Sep</Text>
                </View>
              </View>

              {/* 1. Speeding */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => onViewSpeeding?.(selectedMember)}
                style={[styles.driverReportRow, { borderTopColor: colors.divider }]}
              >
                <View style={[styles.driverEventIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                  <Ionicons name="speedometer-outline" size={18} color={Colors.speeding} />
                </View>
                <Text style={[styles.driverEventName, { color: colors.textMain }]}>Speeding</Text>
                <View style={styles.unlockedArrowWrap}>
                  <Text style={styles.unlockedStatusText}>View Log</Text>
                  <Feather name="arrow-right" size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>

              {/* 2. Distracted Driving */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => onViewWeeklyReport?.(selectedMember)}
                style={[styles.driverReportRow, { borderTopColor: colors.divider }]}
              >
                <View style={[styles.driverEventIcon, { backgroundColor: isDark ? 'rgba(6, 182, 212, 0.2)' : '#E0F2FE' }]}>
                  <Feather name="smartphone" size={18} color={Colors.distracted} />
                </View>
                <Text style={[styles.driverEventName, { color: colors.textMain }]}>Distracted</Text>
                <View style={styles.unlockedArrowWrap}>
                  <Text style={styles.unlockedStatusText}>Normal</Text>
                  <Feather name="trending-down" size={16} color="#059669" />
                </View>
              </TouchableOpacity>

              {/* 3. Rapid Acceleration */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => onViewWeeklyReport?.(selectedMember)}
                style={[styles.driverReportRow, { borderTopColor: colors.divider }]}
              >
                <View style={[styles.driverEventIcon, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.2)' : '#FCE7F3' }]}>
                  <Ionicons name="flash-outline" size={18} color={Colors.rapidAccel} />
                </View>
                <Text style={[styles.driverEventName, { color: colors.textMain }]}>Rapid Accel</Text>
                <View style={styles.unlockedArrowWrap}>
                  <Text style={styles.unlockedStatusText}>Clean</Text>
                  <Feather name="trending-down" size={16} color="#059669" />
                </View>
              </TouchableOpacity>

              {/* 4. Hard Braking */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => onViewWeeklyReport?.(selectedMember)}
                style={[styles.driverReportRow, { borderTopColor: colors.divider }]}
              >
                <View style={[styles.driverEventIcon, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                  <MaterialIcons name="car-crash" size={18} color={Colors.hardBraking} />
                </View>
                <Text style={[styles.driverEventName, { color: colors.textMain }]}>Hard Braking</Text>
                <View style={styles.unlockedArrowWrap}>
                  <Text style={styles.unlockedStatusText}>Clean</Text>
                  <Feather name="trending-down" size={16} color="#059669" />
                </View>
              </TouchableOpacity>

              {/* Full Weekly Report Banner Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onViewWeeklyReport?.(selectedMember)}
                style={[
                  styles.unlockBannerBtn,
                  {
                    backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : colors.primaryLight,
                    borderColor: colors.primaryBorder,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <Text style={[styles.unlockBannerText, { color: colors.primary }]}>View Full Weekly Driver Report</Text>
                <Feather name="chevron-right" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Create Bubble Pill Button */}
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
          </ScrollView>
        ) : (
          /* =========================================================================
              VIEW B: FAMILY MEMBERS LIST (Direct Family Tracking)
          ========================================================================= */
          <View style={styles.listContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.memberListScroll}
            >
              {members.map((member) => {
                const isSelf = member.id === currentUserId;
                const sinceText = formatSinceTime(member);

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
                      showBattery={true}
                      batteryLevel={member.batteryLevel}
                      isCharging={member.isCharging}
                      showOnlineDot={true}
                      isOnline={member.isOnline}
                    />

                    <View style={styles.memberMainInfo}>
                      <Text style={[styles.memberNameBold, { color: colors.textMain }]} numberOfLines={1}>
                        {isSelf
                          ? `${member.fullName.replace(/\s*\(You\)/gi, '').trim()} (You)`
                          : member.fullName.replace(/\s*\(You\)/gi, '').trim()}
                      </Text>
                      <Text style={[styles.memberLocationSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {member.resolvedAddress || 'At Home'}
                      </Text>
                      <Text style={[styles.memberSinceSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {sinceText}
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => Alert.alert('Circle', `Sent a ping to ${member.fullName}`)}
                      style={styles.heartBtn}
                    >
                      <Ionicons name="heart-outline" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}

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
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 90,
  },
  floatingMapActionsRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 95,
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
    overflow: 'hidden',
  },
  handleArea: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleTouch: {
    width: 60,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  listContainer: {
    flex: 1,
  },
  memberListScroll: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
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
  },
  memberNameBold: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  memberLocationSub: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginTop: 2,
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
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  detailNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  unlockedArrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unlockedStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  unlockBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  unlockBannerText: {
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
});
