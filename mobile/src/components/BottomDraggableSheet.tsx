import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { MemberData, getMemberInitials, formatSinceTime } from '../models/Member';
import { calculateDistanceMeters, formatDistance, openNavigationDirections } from '../utils/distance';
import { Colors } from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = 190;
const MEMBER_DETAIL_HEIGHT = 390;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.74;

interface BottomDraggableSheetProps {
  members: MemberData[];
  selectedMember: MemberData | null;
  currentUserId: string;
  myPosition?: { latitude: number; longitude: number; heading?: number } | null;
  onSelectMember: (member: MemberData) => void;
  onDeselectMember: () => void;
  onCenterAll: () => void;
  onGoToMyLocation: () => void;
  onInviteTapped?: () => void;
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
  onInviteTapped,
  onViewTimeline,
  onOpenChat,
  onOpenDirectChat,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  // Automatically adjust sheet height when a member is selected or deselected
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
      Alert.alert('Your Profile', 'This is your own CareRing account.');
      return;
    }

    if (member.phone && member.phone.trim().length > 0) {
      Linking.openURL(`tel:${member.phone.trim()}`).catch(() => {
        Alert.alert('Call Failed', `Could not initiate call to ${member.fullName}`);
      });
    } else {
      Alert.alert(
        'No Phone Number',
        `${member.fullName} has not added a mobile number to their profile yet.`
      );
    }
  };

  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      {/* Floating Action Buttons above the sheet */}
      <Animated.View
        style={[
          styles.fabColumn,
          {
            bottom: Animated.add(sheetHeight, 14),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onGoToMyLocation}
          style={styles.fabButton}
        >
          <MaterialIcons name="my-location" size={22} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCenterAll}
          style={styles.fabButton}
        >
          <MaterialIcons name="center-focus-strong" size={22} color={Colors.textMain} />
        </TouchableOpacity>
      </Animated.View>

      {/* Animated Bottom Draggable Sheet */}
      <Animated.View style={[styles.sheetContainer, { height: sheetHeight }]}>
        {/* Grab Handle Header */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <TouchableOpacity onPress={toggleSheet} style={styles.handleTouch}>
            <View style={styles.grabBar} />
          </TouchableOpacity>
        </View>

        {/* =========================================================================
            VIEW A: CARERING MEMBER DETAIL VIEW (When a user is clicked/selected)
        ========================================================================= */}
        {selectedMember ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.memberDetailScroll}
          >
            {/* Top Navigation Row: Back Button & Close */}
            <View style={styles.detailNavRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onDeselectMember}
                style={styles.backButton}
              >
                <Feather name="chevron-left" size={18} color={Colors.primary} />
                <Text style={styles.backButtonText}>All Members</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onDeselectMember}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Profile Header Row */}
            <View style={styles.profileHeaderRow}>
              <View
                style={[
                  styles.detailAvatarWrap,
                  {
                    borderColor: selectedMember.isOnline
                      ? (selectedMember.isMoving ? '#10B981' : '#059669')
                      : '#94A3B8',
                  },
                ]}
              >
                {selectedMember.avatarUrl ? (
                  <Image
                    source={{ uri: selectedMember.avatarUrl }}
                    style={styles.detailAvatarImg}
                  />
                ) : (
                  <Text style={styles.detailAvatarInitials}>
                    {getMemberInitials(selectedMember.fullName)}
                  </Text>
                )}
              </View>

              <View style={styles.profileInfoWrap}>
                <View style={styles.profileNameRow}>
                  <Text style={styles.detailNameText} numberOfLines={1}>
                    {selectedMember.id === currentUserId
                      ? `${selectedMember.fullName} (You)`
                      : selectedMember.fullName}
                  </Text>
                  {selectedMember.role === 'owner' && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                </View>

                {/* Status + Battery Pill Row */}
                <View style={styles.statusPillRow}>
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: selectedMember.isOnline ? '#10B981' : '#94A3B8' },
                    ]}
                  />
                  <Text style={styles.onlineStatusText}>
                    {selectedMember.isOnline
                      ? (selectedMember.isMoving ? 'Moving' : 'Online')
                      : 'Offline'}
                  </Text>
                  <Text style={styles.metaDot}>•</Text>
                  <View style={styles.batteryRow}>
                    <Ionicons
                      name={selectedMember.isCharging ? 'battery-charging' : 'battery-full'}
                      size={14}
                      color={selectedMember.batteryLevel < 20 ? Colors.sos : Colors.moving}
                    />
                    <Text style={styles.batteryText}>{selectedMember.batteryLevel}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Current Location Card */}
            <View style={styles.locationCard}>
              <View style={styles.locationCardHeader}>
                <View style={styles.pinCircle}>
                  <Ionicons name="location-sharp" size={16} color={Colors.primary} />
                </View>
                <View style={styles.locationAddressWrap}>
                  <Text style={styles.locationAddressText} numberOfLines={2}>
                    {selectedMember.resolvedAddress ||
                      (selectedMember.latitude && selectedMember.longitude
                        ? `${selectedMember.latitude.toFixed(4)}, ${selectedMember.longitude.toFixed(4)}`
                        : 'Waiting for device GPS fix...')}
                  </Text>
                  <Text style={styles.locationStatusSubtext}>
                    {formatSinceTime(selectedMember)}
                  </Text>
                </View>
              </View>

              {/* In-App Distance from current device */}
              {getDistanceText(selectedMember) && (
                <View style={styles.distanceBar}>
                  <Feather name="navigation" size={13} color={Colors.primary} />
                  <Text style={styles.distanceBarText}>
                    <Text style={{ fontWeight: '800' }}>{getDistanceText(selectedMember)}</Text> from your location
                  </Text>
                </View>
              )}
            </View>

            {/* CareRing Iconic 4-Action Round Buttons */}
            <View style={styles.actionGrid}>
              {/* 1. Directions */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionColumn}
                onPress={() => {
                  if (selectedMember.latitude && selectedMember.longitude) {
                    openNavigationDirections(
                      selectedMember.latitude,
                      selectedMember.longitude,
                      selectedMember.fullName
                    );
                  } else {
                    Alert.alert('No GPS Fix', 'Member has not reported GPS coordinates yet.');
                  }
                }}
              >
                <View style={[styles.roundActionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Feather name="navigation" size={22} color="#2563EB" />
                </View>
                <Text style={styles.actionLabel}>Directions</Text>
              </TouchableOpacity>

              {/* 2. Call */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionColumn}
                onPress={() => handleCallMember(selectedMember)}
              >
                <View style={[styles.roundActionIcon, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="call" size={22} color="#059669" />
                </View>
                <Text style={styles.actionLabel}>Call</Text>
              </TouchableOpacity>

              {/* 3. Chat */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionColumn}
                onPress={() => {
                  if (onOpenDirectChat && selectedMember) {
                    onOpenDirectChat(selectedMember);
                  } else {
                    onOpenChat?.();
                  }
                }}
              >
                <View style={[styles.roundActionIcon, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="chatbubble-ellipses" size={22} color="#7C3AED" />
                </View>
                <Text style={styles.actionLabel}>Chat</Text>
              </TouchableOpacity>

              {/* 4. Timeline */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionColumn}
                onPress={() => onViewTimeline?.(selectedMember)}
              >
                <View style={[styles.roundActionIcon, { backgroundColor: '#FFFBEB' }]}>
                  <Feather name="clock" size={22} color="#D97706" />
                </View>
                <Text style={styles.actionLabel}>Timeline</Text>
              </TouchableOpacity>
            </View>

            {/* Additional GPS & Contact Metadata */}
            <View style={styles.metaBox}>
              <View style={styles.metaRowItem}>
                <Text style={styles.metaLabel}>Coordinates</Text>
                <Text style={styles.metaValue}>
                  {selectedMember.latitude
                    ? `${selectedMember.latitude.toFixed(5)}°, ${selectedMember.longitude.toFixed(5)}°`
                    : 'N/A'}
                </Text>
              </View>

              {selectedMember.phone && (
                <View style={styles.metaRowItem}>
                  <Text style={styles.metaLabel}>Phone</Text>
                  <TouchableOpacity onPress={() => handleCallMember(selectedMember)}>
                    <Text style={[styles.metaValue, { color: Colors.primary, fontWeight: '700' }]}>
                      {selectedMember.phone}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.metaRowItem}>
                <Text style={styles.metaLabel}>Speed</Text>
                <Text style={styles.metaValue}>
                  {selectedMember.isMoving ? `${Math.round(selectedMember.speed)} km/h` : '0 km/h (Stationary)'}
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          /* =========================================================================
              VIEW B: UNIFIED FAMILY MEMBERS LIST (When no member is selected)
          ========================================================================= */
          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                Family Members ({members.length})
              </Text>
              {onInviteTapped && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={onInviteTapped}
                  style={styles.addMemberBtn}
                >
                  <Feather name="user-plus" size={14} color={Colors.primary} />
                  <Text style={styles.addMemberText}>Add Member</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.verticalMemberList}
            >
              {members.map((member) => {
                const isSelf = member.id === currentUserId;
                const initials = getMemberInitials(member.fullName);
                const sinceText = formatSinceTime(member);
                const distanceText = getDistanceText(member);

                return (
                  <TouchableOpacity
                    key={member.id}
                    activeOpacity={0.8}
                    onPress={() => onSelectMember(member)}
                    style={styles.memberListItem}
                  >
                    {/* Avatar with Halo Ring */}
                    <View
                      style={[
                        styles.avatarHalo,
                        {
                          borderColor: member.isOnline
                            ? (member.isMoving ? '#10B981' : '#059669')
                            : '#94A3B8',
                        },
                      ]}
                    >
                      {member.avatarUrl ? (
                        <Image
                          source={{ uri: member.avatarUrl }}
                          style={styles.avatarImg}
                        />
                      ) : (
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      )}
                    </View>

                    {/* Member Details */}
                    <View style={styles.memberInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.nameText} numberOfLines={1}>
                          {isSelf ? `${member.fullName} (You)` : member.fullName}
                        </Text>
                        {member.role === 'owner' && (
                          <View style={styles.adminBadge}>
                            <Text style={styles.adminBadgeText}>Admin</Text>
                          </View>
                        )}
                      </View>

                      {/* Current Location / Address */}
                      <Text style={styles.addressText} numberOfLines={1}>
                        {member.resolvedAddress ||
                          (member.latitude && member.longitude
                            ? `${member.latitude.toFixed(3)}, ${member.longitude.toFixed(3)}`
                            : 'Waiting for GPS fix...')}
                      </Text>

                      {/* Subtitle Details: Duration / Distance / Battery */}
                      <View style={styles.metaRow}>
                        <Text
                          style={[
                            styles.statusSubtext,
                            { color: member.isMoving ? Colors.moving : Colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {sinceText}
                        </Text>

                        {distanceText && (
                          <>
                            <Text style={styles.metaDivider}>•</Text>
                            <View style={styles.distanceBadge}>
                              <Feather name="navigation" size={10} color={Colors.primary} />
                              <Text style={styles.distanceText}>{distanceText}</Text>
                            </View>
                          </>
                        )}

                        <Text style={styles.metaDivider}>•</Text>
                        <View style={styles.batteryRow}>
                          <Ionicons
                            name={member.isCharging ? 'battery-charging' : 'battery-full'}
                            size={12}
                            color={member.batteryLevel < 20 ? Colors.sos : Colors.moving}
                          />
                          <Text style={styles.batteryText}>{member.batteryLevel}%</Text>
                        </View>
                      </View>
                    </View>

                    {/* Right Chevron indicating clickability */}
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                );
              })}
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
  fabColumn: {
    position: 'absolute',
    right: 16,
    gap: 12,
    zIndex: 95,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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

  /* Member Detail Styles (CareRing Style) */
  memberDetailScroll: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  detailNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  detailAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  detailAvatarImg: {
    width: '100%',
    height: '100%',
  },
  detailAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfoWrap: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
    flexShrink: 1,
  },
  adminBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  onlineStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  metaDot: {
    marginHorizontal: 6,
    color: '#CBD5E1',
    fontSize: 12,
  },

  /* Location Card */
  locationCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  locationAddressWrap: {
    flex: 1,
  },
  locationAddressText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
    lineHeight: 19,
  },
  locationStatusSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
  },
  distanceBarText: {
    fontSize: 12,
    color: '#1E40AF',
  },

  /* 4-Action Iconic Round Buttons */
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  actionColumn: {
    alignItems: 'center',
    gap: 6,
  },
  roundActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  /* Metadata Box */
  metaBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  metaRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 12,
    color: Colors.textMain,
    fontWeight: '600',
  },

  /* Unified Member List Styles */
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  addMemberText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  verticalMemberList: {
    paddingBottom: 32,
    gap: 10,
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarHalo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    flexShrink: 1,
  },
  addressText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusSubtext: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaDivider: {
    fontSize: 10,
    color: '#CBD5E1',
    marginHorizontal: 5,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  batteryText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
