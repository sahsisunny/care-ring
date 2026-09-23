import React, { useRef, useState } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { MemberData, getMemberInitials, formatSinceTime } from '../models/Member';
import { Colors } from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = 175;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.72;

interface BottomDraggableSheetProps {
  members: MemberData[];
  selectedMember: MemberData | null;
  currentUserId: string;
  onSelectMember: (member: MemberData) => void;
  onCenterAll: () => void;
  onGoToMyLocation: () => void;
  onInviteTapped?: () => void;
}

export const BottomDraggableSheet: React.FC<BottomDraggableSheetProps> = ({
  members,
  selectedMember,
  currentUserId,
  onSelectMember,
  onCenterAll,
  onGoToMyLocation,
  onInviteTapped,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

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
        const baseHeight = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
        const newHeight = baseHeight - gesture.dy;
        if (newHeight >= COLLAPSED_HEIGHT - 30 && newHeight <= EXPANDED_HEIGHT + 40) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -50) {
          // Dragged up -> Expand
          animateToHeight(EXPANDED_HEIGHT, true);
        } else if (gesture.dy > 50) {
          // Dragged down -> Collapse
          animateToHeight(COLLAPSED_HEIGHT, false);
        } else {
          // Snap back to current state
          animateToHeight(isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT, isExpanded);
        }
      },
    })
  ).current;

  const toggleSheet = () => {
    if (isExpanded) {
      animateToHeight(COLLAPSED_HEIGHT, false);
    } else {
      animateToHeight(EXPANDED_HEIGHT, true);
    }
  };

  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      {/* Floating Action Buttons ("My Location" & "Center All") */}
      <View style={styles.fabColumn}>
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
      </View>

      {/* Animated Bottom Draggable Sheet */}
      <Animated.View style={[styles.sheetContainer, { height: sheetHeight }]}>
        {/* Grab Handle Header */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <TouchableOpacity onPress={toggleSheet} style={styles.handleTouch}>
            <View style={styles.grabBar} />
          </TouchableOpacity>
        </View>

        {/* Collapsed State: Horizontal Carousel Cards */}
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselScroll}
          >
            {members.map((member) => {
              const isSelected = member.id === selectedMember?.id;
              const isSelf = member.id === currentUserId;
              const initials = getMemberInitials(member.fullName);
              const sinceText = formatSinceTime(member);

              return (
                <TouchableOpacity
                  key={member.id}
                  activeOpacity={0.85}
                  onPress={() => onSelectMember(member)}
                  style={[
                    styles.memberCard,
                    isSelected && styles.memberCardSelected,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardAvatar}>
                      {member.avatarUrl ? (
                        <Image
                          source={{ uri: member.avatarUrl }}
                          style={styles.cardAvatarImg}
                        />
                      ) : (
                        <Text style={styles.cardAvatarInitials}>{initials}</Text>
                      )}
                    </View>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {isSelf ? `${member.fullName} (You)` : member.fullName}
                    </Text>
                  </View>

                  <Text style={styles.cardAddress} numberOfLines={1}>
                    {member.resolvedAddress ||
                      (member.latitude && member.longitude
                        ? `${member.latitude.toFixed(3)}, ${member.longitude.toFixed(3)}`
                        : 'Waiting for GPS...')}
                  </Text>

                  <View style={styles.cardFooter}>
                    <Text
                      style={[
                        styles.cardSince,
                        { color: member.isMoving ? Colors.moving : Colors.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {sinceText}
                    </Text>
                    <View style={styles.batteryRow}>
                      <Ionicons
                        name={member.isCharging ? 'battery-charging' : 'battery-full'}
                        size={13}
                        color={member.batteryLevel < 20 ? Colors.sos : Colors.moving}
                      />
                      <Text style={styles.batteryText}>{member.batteryLevel}%</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Expanded State: Full Member Directory */}
        <View style={styles.expandedSection}>
          <View style={styles.expandedHeader}>
            <Text style={styles.expandedTitle}>
              Family Members ({members.length})
            </Text>
            {onInviteTapped && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onInviteTapped}
                style={styles.addMemberBtn}
              >
                <Feather name="user-plus" size={15} color={Colors.primary} />
                <Text style={styles.addMemberText}>Add Member</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.expandedList}
          >
            {members.map((member) => {
              const isSelected = member.id === selectedMember?.id;
              const isSelf = member.id === currentUserId;
              const initials = getMemberInitials(member.fullName);
              const sinceText = formatSinceTime(member);

              return (
                <TouchableOpacity
                  key={`list-${member.id}`}
                  activeOpacity={0.85}
                  onPress={() => onSelectMember(member)}
                  style={[
                    styles.expandedItem,
                    isSelected && styles.expandedItemSelected,
                  ]}
                >
                  <View style={styles.expandedAvatar}>
                    {member.avatarUrl ? (
                      <Image
                        source={{ uri: member.avatarUrl }}
                        style={styles.expandedAvatarImg}
                      />
                    ) : (
                      <Text style={styles.expandedAvatarInitials}>{initials}</Text>
                    )}
                  </View>

                  <View style={styles.expandedDetails}>
                    <View style={styles.nameRow}>
                      <Text style={styles.expandedName} numberOfLines={1}>
                        {isSelf ? `${member.fullName} (You)` : member.fullName}
                      </Text>
                      {member.role === 'owner' && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.expandedAddress} numberOfLines={1}>
                      {member.resolvedAddress ||
                        (member.latitude && member.longitude
                          ? `${member.latitude.toFixed(3)}, ${member.longitude.toFixed(3)}`
                          : 'Waiting for GPS fix...')}
                    </Text>

                    <View style={styles.expandedMetaRow}>
                      <Text
                        style={[
                          styles.expandedSince,
                          { color: member.isMoving ? Colors.moving : Colors.primary },
                        ]}
                      >
                        {sinceText}
                      </Text>
                      <Text style={styles.metaDivider}>•</Text>
                      <View style={styles.batteryRow}>
                        <Ionicons
                          name={member.isCharging ? 'battery-charging' : 'battery-full'}
                          size={13}
                          color={member.batteryLevel < 20 ? Colors.sos : Colors.moving}
                        />
                        <Text style={styles.batteryText}>{member.batteryLevel}%</Text>
                      </View>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
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
    bottom: COLLAPSED_HEIGHT + 18,
    gap: 12,
    zIndex: 95,
  },
  fabButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  handleArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleTouch: {
    width: 60,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabBar: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  carouselContainer: {
    height: 125,
  },
  carouselScroll: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  memberCard: {
    width: 175,
    height: 110,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  memberCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarImg: {
    width: '100%',
    height: '100%',
  },
  cardAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cardName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  cardAddress: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSince: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  batteryText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMain,
  },
  expandedSection: {
    flex: 1,
    paddingTop: 8,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  expandedTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addMemberText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  expandedList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 8,
  },
  expandedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expandedItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    borderWidth: 1.5,
  },
  expandedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  expandedAvatarImg: {
    width: '100%',
    height: '100%',
  },
  expandedAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  expandedDetails: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandedName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
    maxWidth: 180,
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  expandedAddress: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  expandedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  expandedSince: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaDivider: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
