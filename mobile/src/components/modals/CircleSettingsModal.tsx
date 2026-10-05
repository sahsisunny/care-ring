import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Circle } from '../../models/Circle';
import { MemberData } from '../../models/Member';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { Avatar } from '../Avatar';
import { SetNicknameModal } from './SetNicknameModal';
import { NicknameService } from '../../services/NicknameService';
import { MemberCardSkeleton } from '../common/Skeleton';
import {
  circleCustomizationService,
  CIRCLE_TYPES,
  PRESET_CIRCLE_BADGES,
  CircleType,
  CircleCustomMeta,
  getCategoryEmoji,
  formatDistance,
} from '../../services/CircleCustomizationService';

interface CircleSettingsModalProps {
  visible: boolean;
  circle: Circle | null;
  currentUserId: string;
  members?: MemberData[];
  isLoadingMembers?: boolean;
  nicknames?: Record<string, string>;
  places?: any[];
  currentLocation?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onRenameCircle: (newName: string) => void;
  onAddPeople: () => void;
  onLeaveCircle: () => void;
  onEditProfilePhoto?: () => void;
  onUpdateNickname?: (memberId: string, nickname: string) => void;
  onUpdateMemberRole?: (memberId: string, newRole: string) => void;
  onRemoveMember?: (memberId: string) => void;
  onAddPlace?: (place: {
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }) => Promise<void> | void;
  onDeletePlace?: (placeId: string) => Promise<void> | void;
  onUpdateCircleMeta?: (meta: CircleCustomMeta) => void;
}

export const CircleSettingsModal: React.FC<CircleSettingsModalProps> = ({
  visible,
  circle,
  currentUserId,
  members = [],
  isLoadingMembers = false,
  nicknames = {},
  places = [],
  currentLocation = null,
  onClose,
  onRenameCircle,
  onAddPeople,
  onLeaveCircle,
  onEditProfilePhoto,
  onUpdateNickname,
  onUpdateMemberRole,
  onRemoveMember,
  onAddPlace,
  onDeletePlace,
  onUpdateCircleMeta,
}) => {
  const { colors, isDark } = useTheme();
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState(circle?.name || 'Sahsi Family');
  const [bubblesAllowed, setBubblesAllowed] = useState(true);
  const [invitePolicyAdminsOnly, setInvitePolicyAdminsOnly] = useState(false);

  // Circle Customization Meta (Type, Badges, Distance Units)
  const [circleMeta, setCircleMeta] = useState<CircleCustomMeta>({
    circleType: 'family',
    badgeEmoji: '👨‍👩‍👧‍👦',
    distanceUnit: 'km',
  });
  const [showCustomImageModal, setShowCustomImageModal] = useState(false);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');

  // Add Place Modal State
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceCategory, setNewPlaceCategory] = useState('home');
  const [newPlaceRadius, setNewPlaceRadius] = useState(200);
  const [newPlaceLat, setNewPlaceLat] = useState<number>(currentLocation?.latitude || 12.9095);
  const [newPlaceLng, setNewPlaceLng] = useState<number>(currentLocation?.longitude || 77.6753);
  const [isSavingPlace, setIsSavingPlace] = useState(false);

  // Nickname modal state
  const [nicknameModalTarget, setNicknameModalTarget] = useState<MemberData | null>(null);

  useEffect(() => {
    if (circle?.id) {
      setNewName(circle.name);
      circleCustomizationService.getCircleMeta(circle.id).then((meta) => {
        setCircleMeta(meta);
        if (meta.imageUri) setCustomImageUrlInput(meta.imageUri);
      });
    }
  }, [circle?.id]);

  useEffect(() => {
    if (currentLocation) {
      setNewPlaceLat(currentLocation.latitude);
      setNewPlaceLng(currentLocation.longitude);
    }
  }, [currentLocation]);

  const handleUpdateMeta = async (patch: Partial<CircleCustomMeta>) => {
    if (!circle?.id) return;
    const updated = await circleCustomizationService.saveCircleMeta(circle.id, patch);
    setCircleMeta(updated);
    onUpdateCircleMeta?.(updated);
  };

  // Active user's role in this circle — use members list as fallback if circle.role is stale
  const circleRole = (() => {
    const fromCircle = circle?.role?.toLowerCase();
    if (fromCircle && fromCircle !== 'member') return fromCircle; // trust non-member role from circle
    // Fallback: find current user in members list
    const selfMember = members.find((m) => m.id === currentUserId);
    return selfMember?.role?.toLowerCase() || fromCircle || 'member';
  })();
  const isOwner = circleRole === 'owner';
  const isAdmin = circleRole === 'admin' || isOwner;

  const handleSaveRename = () => {
    if (!isOwner) {
      Alert.alert('Permission Denied', 'Only the Circle Owner can rename this group.');
      return;
    }
    if (newName.trim()) {
      onRenameCircle(newName.trim());
      setShowRenameModal(false);
      Alert.alert('Updated', 'Circle name updated successfully.');
    }
  };

  const handleRoleChangePrompt = (targetMember: MemberData) => {
    if (!isOwner) {
      Alert.alert('Permission Denied', 'Only the Circle Owner can change member roles.');
      return;
    }

    if (targetMember.id === currentUserId) {
      Alert.alert('Notice', 'You are the Owner of this circle.');
      return;
    }

    const currentRole = targetMember.role?.toLowerCase() || 'member';
    const isTargetAdmin = currentRole === 'admin';

    Alert.alert(
      'Change Member Role',
      `Manage permissions for ${targetMember.fullName}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isTargetAdmin ? 'Demote to Member' : 'Promote to Admin 🛡️',
          onPress: () => {
            const nextRole = isTargetAdmin ? 'member' : 'admin';
            onUpdateMemberRole?.(targetMember.id, nextRole);
            Alert.alert(
              'Role Updated',
              `${targetMember.fullName} is now ${nextRole === 'admin' ? 'an Admin 🛡️' : 'a Member 👤'}.`
            );
          },
        },
      ]
    );
  };

  const handleRemoveMemberPrompt = (targetMember: MemberData) => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only circle owners and admins can remove members.');
      return;
    }

    if (targetMember.id === currentUserId) {
      Alert.alert('Notice', 'You cannot remove yourself. Use "Leave Circle" instead.');
      return;
    }

    const targetRole = targetMember.role?.toLowerCase() || 'member';
    if (!isOwner && (targetRole === 'owner' || targetRole === 'admin')) {
      Alert.alert('Permission Denied', 'Admins cannot remove other admins or the circle owner.');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${targetMember.fullName} from ${circle?.name || 'this circle'}? They will lose access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onRemoveMember?.(targetMember.id);
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.navBar, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
            <Text style={[styles.navTitle, { color: colors.textMain }]} numberOfLines={1}>
              {circle?.name || 'Sahsi Family Circle'}
            </Text>
            {isOwner ? (
              <View style={[styles.ownerPill, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#FEF3C7' }]}>
                <Text style={[styles.ownerPillText, { color: isDark ? '#FBBF24' : '#B45309' }]}>Owner</Text>
              </View>
            ) : isAdmin ? (
              <View style={[styles.ownerPill, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.22)' : '#EDE9FE' }]}>
                <Text style={[styles.ownerPillText, { color: isDark ? '#A78BFA' : '#7C3AED' }]}>Admin</Text>
              </View>
            ) : (
              <View style={[styles.ownerPill, { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.22)' : '#F1F5F9' }]}>
                <Text style={[styles.ownerPillText, { color: colors.textMuted }]}>Member</Text>
              </View>
            )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Non-owner permission banner */}
          {!isOwner && (
            <View
              style={[
                styles.nonOwnerBanner,
                {
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.65)' : '#F8FAFC',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                },
              ]}
            >
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
              <Text style={[styles.nonOwnerBannerText, { color: colors.textSecondary }]}>
                {isAdmin
                  ? 'You are an Admin. You can remove members, but circle name and role changes require the Owner.'
                  : 'You are viewing as a Member. Group name and governance settings are managed by the Circle Owner.'}
              </Text>
            </View>
          )}

          {/* Circle Management Hero Card */}
          <View
            style={[
              styles.carouselCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: 1.5,
              },
            ]}
          >
            <View style={styles.illustrationWrap}>
              <View style={styles.userCirclePurple}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.userCirclePink}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.userCircleOrange}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.carouselTextWrap}>
              <Text style={[styles.carouselTitle, { color: colors.textMain }]}>Circle Management</Text>
              <Text style={[styles.carouselSubtitle, { color: colors.textSecondary }]}>
                {isOwner
                  ? 'As Circle Owner, you control member roles, permissions, and group settings.'
                  : 'Manage private nicknames for members and view group permissions.'}
              </Text>
            </View>
          </View>

          {/* Section: Circle Details */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>CIRCLE DETAILS</Text>
          </View>

          {/* Only Circle Owner can rename the group */}
          {isOwner ? (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: colors.divider }]}
              activeOpacity={0.7}
              onPress={() => {
                setNewName(circle?.name || 'Sahsi Family');
                setShowRenameModal(true);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.textMain }]}>Circle Name</Text>
                <Text style={{ fontSize: 13, color: colors.primary, marginTop: 2, fontWeight: '600' }}>
                  {circle?.name || 'Sahsi Family'}
                </Text>
              </View>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.settingItem, { borderBottomColor: colors.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.textMain }]}>Circle Name</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '500' }}>
                  {circle?.name || 'Sahsi Family'}
                </Text>
              </View>
              <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={() => {
              if (onEditProfilePhoto) {
                onEditProfilePhoto();
              }
            }}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>Profile Avatar (Photo Optional)</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Section: Circle Type & Activity */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>CIRCLE TYPE & ACTIVITY</Text>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                {CIRCLE_TYPES[circleMeta.circleType]?.label || 'Family'}
              </Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {(Object.keys(CIRCLE_TYPES) as CircleType[]).map((typeKey) => {
                const item = CIRCLE_TYPES[typeKey];
                const isSelected = circleMeta.circleType === typeKey;
                return (
                  <TouchableOpacity
                    key={typeKey}
                    activeOpacity={0.8}
                    onPress={() => {
                      handleUpdateMeta({
                        circleType: typeKey,
                        badgeEmoji: item.emoji,
                      });
                    }}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(56, 189, 248, 0.18)' : '#EEF2FF')
                          : colors.card,
                        borderColor: isSelected ? colors.primary : colors.cardBorder,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 26, marginBottom: 4 }}>{item.emoji}</Text>
                    <Text style={[styles.typeCardTitle, { color: isSelected ? colors.primary : colors.textMain }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.typeDescBox, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#F8FAFC', borderColor: colors.divider }]}>
              <Text style={{ fontSize: 18 }}>{CIRCLE_TYPES[circleMeta.circleType]?.emoji}</Text>
              <Text style={[styles.typeDescText, { color: colors.textSecondary }]}>
                {CIRCLE_TYPES[circleMeta.circleType]?.description}
              </Text>
            </View>
          </View>

          {/* Section: Circle Badge & Visual Icon */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>CIRCLE BADGE / ICON</Text>
              <TouchableOpacity onPress={() => setShowCustomImageModal(true)}>
                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                  {circleMeta.imageUri ? '🖼️ Custom Image' : '+ Image URL'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, alignItems: 'center' }}>
              {PRESET_CIRCLE_BADGES.map((badge) => {
                const isSelected = !circleMeta.imageUri && circleMeta.badgeEmoji === badge;
                return (
                  <TouchableOpacity
                    key={badge}
                    activeOpacity={0.7}
                    onPress={() => handleUpdateMeta({ badgeEmoji: badge, imageUri: undefined })}
                    style={[
                      styles.badgeCircle,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(56, 189, 248, 0.25)' : '#E0F2FE')
                          : colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.divider,
                        borderWidth: isSelected ? 2.5 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{badge}</Text>
                  </TouchableOpacity>
                );
              })}
              {circleMeta.imageUri ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowCustomImageModal(true)}
                  style={[styles.badgeCircle, { borderColor: colors.primary, borderWidth: 2.5, overflow: 'hidden' }]}
                >
                  <Image source={{ uri: circleMeta.imageUri }} style={{ width: '100%', height: '100%' }} />
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>

          {/* Section: Distance Measurement Unit */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>DISTANCE MEASUREMENT UNIT</Text>
          </View>

          <View style={[styles.settingItem, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.itemTitle, { color: colors.textMain }]}>Circle Distance Units</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Used for geofence radius, member speed, and map distance
              </Text>
            </View>
            <View style={styles.unitToggleRow}>
              <TouchableOpacity
                onPress={() => handleUpdateMeta({ distanceUnit: 'km' })}
                style={[
                  styles.unitBtn,
                  circleMeta.distanceUnit === 'km' && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.unitBtnText,
                    { color: circleMeta.distanceUnit === 'km' ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  KM
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleUpdateMeta({ distanceUnit: 'miles' })}
                style={[
                  styles.unitBtn,
                  circleMeta.distanceUnit === 'miles' && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.unitBtnText,
                    { color: circleMeta.distanceUnit === 'miles' ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  Miles
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Circle Places & Geofences */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
                CIRCLE PLACES & GEOFENCES ({places.length})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (currentLocation) {
                    setNewPlaceLat(currentLocation.latitude);
                    setNewPlaceLng(currentLocation.longitude);
                  }
                  setShowAddPlaceModal(true);
                }}
                style={styles.addPlaceTopBtn}
              >
                <Feather name="plus-circle" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '800' }}>Add Place</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.privacyInfoBar, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(14, 165, 233, 0.06)' }]}>
            <Ionicons name="location" size={15} color={colors.primary} />
            <Text style={[styles.privacyInfoText, { color: colors.textSecondary }]}>
              Configured places trigger arrival/departure notifications and show place emojis (🏠, 🏢, 🎓, ⛺) on map pins.
            </Text>
          </View>

          {places.length === 0 ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 18, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMain, marginBottom: 4 }}>
                No Places Added Yet
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 12 }}>
                Add Home, Office, College, or Camp to get notifications when circle members arrive.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (currentLocation) {
                    setNewPlaceLat(currentLocation.latitude);
                    setNewPlaceLng(currentLocation.longitude);
                  }
                  setShowAddPlaceModal(true);
                }}
                style={[styles.addPlaceMainBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.addPlaceMainBtnText}>+ Add First Circle Place</Text>
              </TouchableOpacity>
            </View>
          ) : (
            places.map((place: any) => {
              const placeEmoji = getCategoryEmoji(place.category);
              const radiusVal = place.radius_meters || place.radiusMeters || 200;
              const formattedRadius =
                circleMeta.distanceUnit === 'miles'
                  ? `${(radiusVal / 1609.34).toFixed(1)} mi radius`
                  : `${radiusVal}m radius`;

              return (
                <View
                  key={place.id || place.name}
                  style={[styles.placeItemRow, { borderBottomColor: colors.divider }]}
                >
                  <View style={[styles.placeEmojiBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
                    <Text style={{ fontSize: 20 }}>{placeEmoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.placeItemTitle, { color: colors.textMain }]}>{place.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {formattedRadius} • Alerts Active
                    </Text>
                  </View>
                  {onDeletePlace && (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Delete Place',
                          `Remove "${place.name}" from ${circle?.name || 'this circle'}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => onDeletePlace(place.id),
                            },
                          ]
                        );
                      }}
                      style={styles.deletePlaceBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          {places.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (currentLocation) {
                  setNewPlaceLat(currentLocation.latitude);
                  setNewPlaceLng(currentLocation.longitude);
                }
                setShowAddPlaceModal(true);
              }}
              style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name="plus-circle" size={18} color={colors.primary} />
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.primary }}>
                  + Add Another Place (Home, College, etc.)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Section: Personal Nicknames */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
                PERSONAL NICKNAMES (PRIVATE TO YOU)
              </Text>
              <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
            </View>
          </View>

          <View style={[styles.privacyInfoBar, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(14, 165, 233, 0.06)' }]}>
            <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
            <Text style={[styles.privacyInfoText, { color: colors.textSecondary }]}>
              Nicknames you set here are completely private to your device. Other circle members cannot see them.
            </Text>
          </View>

          {members
            .filter((m) => m.id !== currentUserId)
            .map((m) => {
              const currentNick = nicknames[m.id];
              return (
                <TouchableOpacity
                  key={`nick_${m.id}`}
                  style={[styles.memberItem, { borderBottomColor: colors.divider }]}
                  activeOpacity={0.7}
                  onPress={() => setNicknameModalTarget(m)}
                >
                  <Avatar
                    size={38}
                    avatarUrl={m.avatarUrl}
                    name={m.fullName}
                    showOnlineDot={false}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.memberItemName, { color: colors.textMain }]}>
                      {currentNick ? `${currentNick} (${m.fullName})` : m.fullName}
                    </Text>
                    <Text style={{ fontSize: 12, color: currentNick ? colors.primary : colors.textMuted, fontWeight: '500' }}>
                      {currentNick ? `Personal: "${currentNick}"` : 'Tap to set private nickname'}
                    </Text>
                  </View>
                  <View style={[styles.editChip, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.1)' }]}>
                    <Feather name="edit-2" size={12} color={colors.primary} />
                    <Text style={[styles.editChipText, { color: colors.primary }]}>
                      {currentNick ? 'Edit' : 'Set'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

          {/* Section: Members & Roles Management */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
              MEMBERS & ROLES ({members.length})
            </Text>
          </View>

          {isLoadingMembers ? (
            <View style={{ paddingVertical: 8 }}>
              <MemberCardSkeleton count={3} />
            </View>
          ) : (
            members.map((m) => {
            const isSelf = m.id === currentUserId;
            const mRole = m.role?.toLowerCase() || 'member';
            const isTargetOwner = mRole === 'owner';
            const isTargetAdmin = mRole === 'admin';
            const displayTitle = NicknameService.getEffectiveName(m, nicknames);

            return (
              <View
                key={`member_${m.id}`}
                style={[styles.memberItem, { borderBottomColor: colors.divider }]}
              >
                <Avatar
                  size={40}
                  avatarUrl={m.avatarUrl}
                  name={m.fullName}
                  showOnlineDot={true}
                  isOnline={m.isOnline}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.memberItemName, { color: colors.textMain }]}>
                    {displayTitle} {isSelf ? '(You)' : ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {m.phone || 'Circle member'}
                  </Text>
                </View>

                {/* Role Badge (Tapable if Owner to change role) */}
                <TouchableOpacity
                  activeOpacity={isOwner && !isSelf ? 0.7 : 1}
                  onPress={() => isOwner && !isSelf && handleRoleChangePrompt(m)}
                  style={[
                    styles.roleBadge,
                    isTargetOwner && {
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                      borderColor: isDark ? '#F59E0B' : '#FBBF24',
                    },
                    isTargetAdmin && {
                      backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : '#EDE9FE',
                      borderColor: isDark ? '#7C3AED' : '#C4B5FD',
                    },
                    !isTargetOwner && !isTargetAdmin && {
                      backgroundColor: isDark ? 'rgba(100, 116, 139, 0.2)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(100, 116, 139, 0.3)' : '#E2E8F0',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      isTargetOwner && { color: isDark ? '#FBBF24' : '#B45309' },
                      isTargetAdmin && { color: isDark ? '#A78BFA' : '#7C3AED' },
                      !isTargetOwner && !isTargetAdmin && { color: colors.textSecondary },
                    ]}
                  >
                    {isTargetOwner ? '👑 Owner' : isTargetAdmin ? '🛡️ Admin' : '👤 Member'}
                  </Text>
                </TouchableOpacity>

                {/* Remove Member Button (Owner can remove anyone; Admin can remove Member) */}
                {!isSelf && (isOwner || (isAdmin && !isTargetAdmin && !isTargetOwner)) && (
                  <TouchableOpacity
                    onPress={() => handleRemoveMemberPrompt(m)}
                    style={styles.removeMemberBtn}
                    accessibilityLabel={`Remove ${m.fullName}`}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }))}

          {/* Section: Circle Governance & Permissions */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>CIRCLE GOVERNANCE</Text>
          </View>

          {/* Add People */}
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={onAddPeople}
          >
            <View>
              <Text style={[styles.itemTitle, { color: colors.textMain }]}>Invite Members</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Share invite code with family & friends
              </Text>
            </View>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Who can invite policy (Owner toggle) */}
          {isOwner && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: colors.divider }]}
              activeOpacity={0.7}
              onPress={() => {
                setInvitePolicyAdminsOnly(!invitePolicyAdminsOnly);
                Alert.alert(
                  'Invite Permission Updated',
                  !invitePolicyAdminsOnly
                    ? 'Only Owner and Admins can now invite new members.'
                    : 'All circle members can now invite new members.'
                );
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.itemTitle, { color: colors.textMain }]}>Who Can Invite</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {invitePolicyAdminsOnly ? 'Admins & Owner only' : 'Anyone in this circle'}
                </Text>
              </View>
              <View style={[styles.pillBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE' }]}>
                <Text style={[styles.pillBadgeText, { color: colors.primary }]}>
                  {invitePolicyAdminsOnly ? 'Restricted' : 'Open'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Bubbles Access (Owner only) */}
          {isOwner && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: colors.divider }]}
              activeOpacity={0.7}
              onPress={() => {
                setBubblesAllowed(!bubblesAllowed);
                Alert.alert(
                  'Bubbles Access',
                  bubblesAllowed ? 'Bubbles disabled for circle members.' : 'Bubbles enabled for all circle members.'
                );
              }}
            >
              <View>
                <Text style={[styles.itemTitle, { color: colors.textMain }]}>Privacy Bubbles Access</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Allow members to blur location for privacy
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>
                {bubblesAllowed ? 'Allowed' : 'Disabled'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Leave Circle */}
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomWidth: 0, marginTop: 14 }]}
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert(
                'Leave Circle',
                'Are you sure you want to leave this circle? You will need an invite code to rejoin.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: onLeaveCircle },
                ]
              );
            }}
          >
            <View>
              <Text style={[styles.itemTitle, { color: colors.sos }]}>Leave Circle</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Exit this group and stop sharing location
              </Text>
            </View>
            <Ionicons name="log-out-outline" size={20} color={colors.sos} />
          </TouchableOpacity>
        </ScrollView>

        {/* Modal: Edit Circle Name */}
        <Modal visible={showRenameModal} transparent animationType="fade">
          <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1.5 }]}>
              <Text style={[styles.dialogTitle, { color: colors.textMain }]}>Edit Circle Name</Text>
              <TextInput
                style={[styles.dialogInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textMain }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter circle name"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  onPress={() => setShowRenameModal(false)}
                  style={[styles.dialogBtnSecondary, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }]}
                >
                  <Text style={[styles.dialogBtnSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveRename}
                  style={[styles.dialogBtnPrimary, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.dialogBtnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Add Circle Place / Geofence */}
        <Modal visible={showAddPlaceModal} transparent animationType="slide">
          <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCardLarge, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View>
                  <Text style={[styles.dialogTitleLarge, { color: colors.textMain }]}>Add Circle Place</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Show emoji on map & notify arrivals/departures
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAddPlaceModal(false)}
                  style={[styles.closeIconCircle, { backgroundColor: colors.tileBg }]}
                >
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Place Name */}
                <Text style={[styles.inputLabel, { color: colors.textMain }]}>Place Name</Text>
                <TextInput
                  style={[styles.dialogInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textMain }]}
                  value={newPlaceName}
                  onChangeText={setNewPlaceName}
                  placeholder="e.g. Home, Office, Stanford College"
                  placeholderTextColor={colors.textMuted}
                />

                {/* Place Category */}
                <Text style={[styles.inputLabel, { color: colors.textMain }]}>Category / Icon</Text>
                <View style={styles.catGrid}>
                  {[
                    { id: 'home', label: 'Home', emoji: '🏠' },
                    { id: 'office', label: 'Office', emoji: '🏢' },
                    { id: 'college', label: 'College', emoji: '🎓' },
                    { id: 'school', label: 'School', emoji: '🏫' },
                    { id: 'gym', label: 'Gym', emoji: '🏋️' },
                    { id: 'trip', label: 'Trip Stop', emoji: '⛺' },
                    { id: 'cafe', label: 'Cafe / Hub', emoji: '☕' },
                    { id: 'other', label: 'Other', emoji: '📍' },
                  ].map((cat) => {
                    const isCatSelected = newPlaceCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        activeOpacity={0.7}
                        onPress={() => {
                          setNewPlaceCategory(cat.id);
                          if (!newPlaceName) setNewPlaceName(cat.label);
                        }}
                        style={[
                          styles.catPill,
                          {
                            backgroundColor: isCatSelected
                              ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE')
                              : colors.tileBg,
                            borderColor: isCatSelected ? colors.primary : colors.divider,
                            borderWidth: isCatSelected ? 2 : 1,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                        <Text
                          style={[
                            styles.catPillText,
                            { color: isCatSelected ? colors.primary : colors.textSecondary },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* GPS / Location coordinates */}
                <View style={[styles.gpsBox, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 }}>
                      LOCATION COORDINATES
                    </Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textMain, marginTop: 2 }}>
                      {newPlaceLat.toFixed(5)}, {newPlaceLng.toFixed(5)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (currentLocation) {
                        setNewPlaceLat(currentLocation.latitude);
                        setNewPlaceLng(currentLocation.longitude);
                        Alert.alert('📍 Location Set', 'Using your current GPS location for this place.');
                      } else {
                        Alert.alert('Location Pending', 'Waiting for GPS location from your device.');
                      }
                    }}
                    style={[styles.useLocationBtn, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="navigate" size={14} color="#FFFFFF" />
                    <Text style={styles.useLocationBtnText}>Use My GPS</Text>
                  </TouchableOpacity>
                </View>

                {/* Geofence Radius */}
                <Text style={[styles.inputLabel, { color: colors.textMain, marginTop: 12 }]}>Geofence Radius</Text>
                <View style={styles.radiusRow}>
                  {[100, 200, 500, 1000].map((r) => {
                    const isSelected = newPlaceRadius === r;
                    const rText =
                      circleMeta.distanceUnit === 'miles'
                        ? `${(r / 1609.34).toFixed(1)} mi`
                        : `${r}m`;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setNewPlaceRadius(r)}
                        style={[
                          styles.radiusPill,
                          {
                            backgroundColor: isSelected
                              ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE')
                              : colors.tileBg,
                            borderColor: isSelected ? colors.primary : colors.divider,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.radiusPillText,
                            { color: isSelected ? colors.primary : colors.textSecondary },
                          ]}
                        >
                          {rText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={[styles.dialogBtnRow, { marginTop: 16 }]}>
                <TouchableOpacity
                  onPress={() => setShowAddPlaceModal(false)}
                  style={[styles.dialogBtnSecondary, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }]}
                >
                  <Text style={[styles.dialogBtnSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!newPlaceName.trim()) {
                      Alert.alert('Place Name Required', 'Please enter a name for this place.');
                      return;
                    }
                    setIsSavingPlace(true);
                    try {
                      await onAddPlace?.({
                        name: newPlaceName.trim(),
                        category: newPlaceCategory,
                        latitude: newPlaceLat,
                        longitude: newPlaceLng,
                        radiusMeters: newPlaceRadius,
                      });
                      setShowAddPlaceModal(false);
                      setNewPlaceName('');
                    } finally {
                      setIsSavingPlace(false);
                    }
                  }}
                  disabled={isSavingPlace}
                  style={[styles.dialogBtnPrimary, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.dialogBtnPrimaryText}>
                    {isSavingPlace ? 'Saving...' : 'Save Place'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Custom Circle Image */}
        <Modal visible={showCustomImageModal} transparent animationType="fade">
          <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1.5 }]}>
              <Text style={[styles.dialogTitle, { color: colors.textMain }]}>Circle Image URL</Text>
              <TextInput
                style={[styles.dialogInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textMain }]}
                value={customImageUrlInput}
                onChangeText={setCustomImageUrlInput}
                placeholder="https://example.com/circle-photo.jpg"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
              {customImageUrlInput.trim() ? (
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <Image
                    source={{ uri: customImageUrlInput.trim() }}
                    style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.primary }}
                  />
                </View>
              ) : null}
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  onPress={() => setShowCustomImageModal(false)}
                  style={[styles.dialogBtnSecondary, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }]}
                >
                  <Text style={[styles.dialogBtnSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                {circleMeta.imageUri ? (
                  <TouchableOpacity
                    onPress={() => {
                      handleUpdateMeta({ imageUri: undefined });
                      setCustomImageUrlInput('');
                      setShowCustomImageModal(false);
                    }}
                    style={[styles.dialogBtnSecondary, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1 }]}
                  >
                    <Text style={[styles.dialogBtnSecondaryText, { color: '#EF4444' }]}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => {
                    handleUpdateMeta({ imageUri: customImageUrlInput.trim() || undefined });
                    setShowCustomImageModal(false);
                  }}
                  style={[styles.dialogBtnPrimary, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.dialogBtnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Set Nickname Modal */}
        {nicknameModalTarget && (
          <SetNicknameModal
            visible={Boolean(nicknameModalTarget)}
            memberName={nicknameModalTarget.fullName}
            memberId={nicknameModalTarget.id}
            currentNickname={nicknames[nicknameModalTarget.id] || ''}
            onClose={() => setNicknameModalTarget(null)}
            onSave={(mId, nick) => {
              onUpdateNickname?.(mId, nick);
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    paddingBottom: 50,
  },
  carouselCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  illustrationWrap: {
    width: 60,
    height: 60,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCirclePurple: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCirclePink: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCircleOrange: {
    position: 'absolute',
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselTextWrap: {
    flex: 1,
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  carouselSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeaderWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 16,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  privacyInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  privacyInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  memberItemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  editChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  removeMemberBtn: {
    padding: 8,
    marginLeft: 6,
  },
  pillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dialogBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  dialogCardLarge: {
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogTitleLarge: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 8,
  },
  dialogInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  catPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 4,
  },
  useLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  useLocationBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  radiusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  dialogBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dialogBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  dialogBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ownerPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ownerPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  nonOwnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  nonOwnerBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  typeCard: {
    width: 124,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  typeDescBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeDescText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  unitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  unitBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  addPlaceTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  addPlaceMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  addPlaceMainBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  placeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  placeEmojiBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeItemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  deletePlaceBtn: {
    padding: 8,
  },
});
