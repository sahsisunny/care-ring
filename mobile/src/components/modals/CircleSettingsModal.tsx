import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
  StatusBar,
  Switch,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Circle } from '../../models/Circle';
import { MemberData } from '../../models/Member';
import { useTheme } from '../../theme/ThemeContext';
import { Avatar } from '../Avatar';
import { SetNicknameModal } from './SetNicknameModal';
import { NicknameService } from '../../services/NicknameService';
import { MemberCardSkeleton } from '../common/Skeleton';
import { SavePlaceModal } from './SavePlaceModal';
import { MapStyleConfig } from '../../models/MapStyle';
import {
  circleCustomizationService,
  CIRCLE_TYPES,
  PRESET_CIRCLE_BADGES,
  CircleType,
  CircleCustomMeta,
  getCategoryEmoji,
} from '../../services/CircleCustomizationService';
import { hapticService } from '../../services/HapticService';
import { LANDING_PAGE_URL } from '../../constants/urls';

const COLOR_PALETTE = [
  { id: 'indigo', hex: '#4F46E5', name: 'Indigo' },
  { id: 'emerald', hex: '#10B981', name: 'Emerald' },
  { id: 'sky', hex: '#0284C7', name: 'Sky Blue' },
  { id: 'amber', hex: '#F59E0B', name: 'Amber' },
  { id: 'rose', hex: '#E11D48', name: 'Rose' },
  { id: 'violet', hex: '#7C3AED', name: 'Violet' },
  { id: 'cyan', hex: '#06B6D4', name: 'Cyan' },
  { id: 'slate', hex: '#334155', name: 'Slate' },
];

export interface CircleSettingsModalProps {
  visible: boolean;
  circle: Circle | null;
  currentUserId: string;
  members?: MemberData[];
  isLoadingMembers?: boolean;
  nicknames?: Record<string, string>;
  places?: any[];
  currentLocation?: { latitude: number; longitude: number } | null;
  mapStyle?: MapStyleConfig;
  backendUrl?: string;
  wsClient?: any;
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
  onRegenerateInviteCode?: (newCode: string) => void;
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
  mapStyle,
  backendUrl,
  wsClient,
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
  onRegenerateInviteCode,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight || 36)
    : Math.max(insets.top, 44);

  // Circle Meta State
  const [circleMeta, setCircleMeta] = useState<CircleCustomMeta>({
    circleType: 'family',
    badgeEmoji: circle?.badgeEmoji || '👨‍👩‍👧‍👦',
    distanceUnit: (circle?.distanceUnit as 'km' | 'miles') || 'km',
    bubblesAllowed: circle?.bubblesAllowed !== false,
    invitePolicyAdminsOnly: circle?.invitePolicy === 'admins_only',
    initials: circle?.initials || '',
    color: circle?.color || '#4F46E5',
    imageUri: circle?.imageUrl || undefined,
  });

  // Modal sub-states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameText, setRenameText] = useState(circle?.name || '');
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showTypePickerModal, setShowTypePickerModal] = useState(false);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [nicknameModalTarget, setNicknameModalTarget] = useState<MemberData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync state with circle changes
  useEffect(() => {
    if (circle?.id) {
      setRenameText(circle.name);
      circleCustomizationService.getCircleMeta(circle.id).then((meta) => {
        setCircleMeta({
          ...meta,
          initials: circle.initials || meta.initials || '',
          color: circle.color || meta.color || '#4F46E5',
          imageUri: circle.imageUrl || meta.imageUri,
          badgeEmoji: circle.badgeEmoji || meta.badgeEmoji || '👨‍👩‍👧‍👦',
          distanceUnit: (circle.distanceUnit as 'km' | 'miles') || meta.distanceUnit || 'km',
          bubblesAllowed: circle.bubblesAllowed !== undefined ? circle.bubblesAllowed : meta.bubblesAllowed !== false,
          invitePolicyAdminsOnly: circle.invitePolicy === 'admins_only' || meta.invitePolicyAdminsOnly === true,
        });
      });
    }
  }, [circle]);

  // Role detection
  const circleRole = (() => {
    const fromCircle = circle?.role?.toLowerCase();
    if (fromCircle && fromCircle !== 'member') return fromCircle;
    const selfMember = members.find((m) => m.id === currentUserId);
    return selfMember?.role?.toLowerCase() || fromCircle || 'member';
  })();
  const isOwner = circleRole === 'owner';
  const isAdmin = circleRole === 'admin' || isOwner;

  // Meta update helper
  const handleUpdateMeta = async (patch: Partial<CircleCustomMeta>) => {
    if (!circle?.id) return;
    hapticService.light();
    const updated = await circleCustomizationService.saveCircleMeta(
      circle.id,
      patch,
      backendUrl,
      wsClient,
      currentUserId
    );
    setCircleMeta(updated);
    onUpdateCircleMeta?.(updated);
  };

  // Rename Circle
  const handleSaveRename = () => {
    if (!isOwner) {
      Alert.alert('Permission Denied', 'Only the Circle Owner can rename this group.');
      return;
    }
    const trimmed = renameText.trim();
    if (trimmed && trimmed !== circle?.name) {
      hapticService.selection();
      onRenameCircle(trimmed);
    }
    setShowRenameModal(false);
  };

  // Share Invite Link
  const handleShareInvite = async () => {
    if (!circle) return;
    hapticService.light();
    try {
      const inviteUrl = `${LANDING_PAGE_URL}/invite/${circle.inviteCode}`;
      await Share.share({
        message: `Join our "${circle.name}" circle on CareRing!\n\nInvite Code: ${circle.inviteCode}\nJoin Link: ${inviteUrl}`,
      });
    } catch (_) {}
  };

  // Copy Code Feedback
  const handleCopyCode = () => {
    hapticService.selection();
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  // Role Change
  const handleRoleChangePrompt = (targetMember: MemberData) => {
    if (!isOwner) {
      Alert.alert('Permission Denied', 'Only the Circle Owner can promote or demote members.');
      return;
    }
    if (targetMember.id === currentUserId) return;

    const currentRole = targetMember.role?.toLowerCase() || 'member';
    const isTargetAdmin = currentRole === 'admin';

    Alert.alert(
      'Member Permissions',
      `Change role for ${targetMember.fullName}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isTargetAdmin ? 'Demote to Member' : 'Promote to Admin 🛡️',
          onPress: () => {
            const nextRole = isTargetAdmin ? 'member' : 'admin';
            onUpdateMemberRole?.(targetMember.id, nextRole);
          },
        },
      ]
    );
  };

  // Remove Member
  const handleRemoveMemberPrompt = (targetMember: MemberData) => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only owners and admins can remove members.');
      return;
    }
    if (targetMember.id === currentUserId) return;

    Alert.alert(
      'Remove Member',
      `Remove ${targetMember.fullName} from "${circle?.name || 'this circle'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemoveMember?.(targetMember.id),
        },
      ]
    );
  };

  // Regenerate Invite Code
  const handleRegenerateInviteCode = () => {
    if (!isAdmin) return;
    Alert.alert(
      'Regenerate Invite Code',
      'Are you sure? Previous invite codes and links will stop working immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate Code',
          style: 'destructive',
          onPress: async () => {
            if (!circle?.id || !backendUrl) return;
            try {
              const { authService } = require('../../services/AuthService');
              const res = await authService.regenerateInviteCode(backendUrl, circle.id, currentUserId);
              if (res.success && res.inviteCode) {
                Alert.alert('Success', `New invite code: ${res.inviteCode}`);
                onRegenerateInviteCode?.(res.inviteCode);
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to regenerate invite code');
            }
          },
        },
      ]
    );
  };

  const currentType = CIRCLE_TYPES[circleMeta.circleType] || CIRCLE_TYPES.family;
  const effectiveInitials = circleMeta.initials || circle?.initials || (circle?.name ? circle.name.substring(0, 2).toUpperCase() : 'CR');
  const effectiveColor = circleMeta.color || circle?.color || '#4F46E5';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Clean Modern Nav Bar */}
        <View
          style={[
            styles.navBar,
            {
              paddingTop: statusBarHeight + 6,
              backgroundColor: colors.card,
              borderBottomColor: colors.divider,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              hapticService.light();
              onClose();
            }}
            style={[
              styles.navBackBtn,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)' },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.textMain} />
          </TouchableOpacity>

          <Text style={[styles.navTitle, { color: colors.textMain }]}>Circle Settings</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              hapticService.light();
              onClose();
            }}
            style={styles.navCloseBtn}
          >
            <Text style={[styles.navCloseText, { color: colors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          {/* Hero Profile Card */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {/* Circle Avatar */}
            <TouchableOpacity
              activeOpacity={isOwner ? 0.8 : 1}
              onPress={() => isOwner && setShowCustomizeModal(true)}
              style={[
                styles.heroAvatar,
                { backgroundColor: effectiveColor },
              ]}
            >
              {circleMeta.imageUri ? (
                <Image source={{ uri: circleMeta.imageUri }} style={styles.heroAvatarImage} />
              ) : circleMeta.badgeEmoji ? (
                <Text style={styles.heroAvatarEmoji}>{circleMeta.badgeEmoji}</Text>
              ) : (
                <Text style={styles.heroAvatarInitials}>{effectiveInitials}</Text>
              )}

              {isOwner && (
                <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
                  <Feather name="edit-2" size={11} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Circle Name */}
            <TouchableOpacity
              activeOpacity={isOwner ? 0.7 : 1}
              onPress={() => {
                if (isOwner) {
                  setRenameText(circle?.name || '');
                  setShowRenameModal(true);
                }
              }}
              style={styles.heroTitleRow}
            >
              <Text style={[styles.heroName, { color: colors.textMain }]} numberOfLines={1}>
                {circle?.name || 'Family Circle'}
              </Text>
              {isOwner && (
                <Feather name="edit-3" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>

            {/* Meta Subtitle & Roles */}
            <View style={styles.heroPillsRow}>
              <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF' }]}>
                <Text style={[styles.pillText, { color: colors.primary }]}>
                  {currentType.emoji} {currentType.label}
                </Text>
              </View>

              <View
                style={[
                  styles.pill,
                  isOwner
                    ? { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }
                    : isAdmin
                    ? { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : '#EDE9FE' }
                    : { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.2)' : '#F1F5F9' },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    isOwner
                      ? { color: isDark ? '#FBBF24' : '#B45309' }
                      : isAdmin
                      ? { color: isDark ? '#A78BFA' : '#7C3AED' }
                      : { color: colors.textSecondary },
                  ]}
                >
                  {isOwner ? '👑 Owner' : isAdmin ? '🛡️ Admin' : '👤 Member'}
                </Text>
              </View>
            </View>

            {/* Invite Code Quick Card */}
            <View
              style={[
                styles.inviteBox,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.divider,
                },
              ]}
            >
              <View style={styles.inviteCodeArea}>
                <Text style={[styles.inviteLabel, { color: colors.textMuted }]}>INVITE CODE</Text>
                <Text style={[styles.inviteCodeText, { color: colors.textMain }]}>
                  {circle?.inviteCode || 'FAM-0000'}
                </Text>
              </View>

              <View style={styles.inviteActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCopyCode}
                  style={[
                    styles.codeBtn,
                    copiedCode && { backgroundColor: '#10B981', borderColor: '#10B981' },
                  ]}
                >
                  <Ionicons
                    name={copiedCode ? 'checkmark' : 'copy-outline'}
                    size={14}
                    color={copiedCode ? '#FFFFFF' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.codeBtnText,
                      { color: copiedCode ? '#FFFFFF' : colors.primary },
                    ]}
                  >
                    {copiedCode ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleShareInvite}
                  style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="share-social-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 1: Appearance & Identity */}
          <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
            APPEARANCE & DETAILS
          </Text>
          <View
            style={[
              styles.cardGroup,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {/* Rename Row */}
            <TouchableOpacity
              activeOpacity={isOwner ? 0.7 : 1}
              onPress={() => {
                if (isOwner) {
                  setRenameText(circle?.name || '');
                  setShowRenameModal(true);
                }
              }}
              style={[styles.rowItem, { borderBottomColor: colors.divider }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF' }]}>
                  <Feather name="edit-3" size={16} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: colors.textMain }]}>Circle Name</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {circle?.name || 'Family Circle'}
                  </Text>
                </View>
              </View>
              {isOwner ? (
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              ) : (
                <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {/* Circle Type Row */}
            <TouchableOpacity
              activeOpacity={isOwner ? 0.7 : 1}
              onPress={() => isOwner && setShowTypePickerModal(true)}
              style={[styles.rowItem, { borderBottomColor: colors.divider }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                  <Text style={{ fontSize: 16 }}>{currentType.emoji}</Text>
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: colors.textMain }]}>Circle Type</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {currentType.label}
                  </Text>
                </View>
              </View>
              {isOwner ? (
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              ) : (
                <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {/* Customize Badge, Color & Initials Row */}
            <TouchableOpacity
              activeOpacity={isOwner ? 0.7 : 1}
              onPress={() => isOwner && setShowCustomizeModal(true)}
              style={[styles.rowItem, { borderBottomColor: colors.divider }]}
            >
              <View style={styles.rowLeft}>
                <View
                  style={[
                    styles.rowIconWrap,
                    { backgroundColor: effectiveColor },
                  ]}
                >
                  <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '800' }}>
                    {circleMeta.badgeEmoji || effectiveInitials}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: colors.textMain }]}>Avatar & Colors</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    Badge icon, initials, and theme color
                  </Text>
                </View>
              </View>
              {isOwner ? (
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              ) : (
                <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {/* Distance Measurement Unit */}
            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#E0F2FE' }]}>
                  <Ionicons name="speedometer-outline" size={16} color="#0284C7" />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: colors.textMain }]}>Distance Units</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {circleMeta.distanceUnit === 'miles' ? 'Imperial (Miles)' : 'Metric (Kilometers)'}
                  </Text>
                </View>
              </View>

              <View style={styles.miniSegment}>
                <TouchableOpacity
                  onPress={() => handleUpdateMeta({ distanceUnit: 'km' })}
                  style={[
                    styles.miniSegmentBtn,
                    circleMeta.distanceUnit === 'km' && [
                      styles.miniSegmentBtnActive,
                      { backgroundColor: colors.primary },
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.miniSegmentText,
                      circleMeta.distanceUnit === 'km'
                        ? { color: '#FFFFFF', fontWeight: '800' }
                        : { color: colors.textSecondary },
                    ]}
                  >
                    km
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleUpdateMeta({ distanceUnit: 'miles' })}
                  style={[
                    styles.miniSegmentBtn,
                    circleMeta.distanceUnit === 'miles' && [
                      styles.miniSegmentBtnActive,
                      { backgroundColor: colors.primary },
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.miniSegmentText,
                      circleMeta.distanceUnit === 'miles'
                        ? { color: '#FFFFFF', fontWeight: '800' }
                        : { color: colors.textSecondary },
                    ]}
                  >
                    mi
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 2: Members */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              MEMBERS ({members.length})
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onAddPeople}
              style={styles.addMemberInlineBtn}
            >
              <Feather name="user-plus" size={13} color={colors.primary} />
              <Text style={[styles.addMemberInlineText, { color: colors.primary }]}>Invite</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.cardGroup,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {isLoadingMembers && members.length === 0 ? (
              <View style={{ padding: 12 }}>
                <MemberCardSkeleton count={2} />
              </View>
            ) : (
              members.map((m, idx) => {
                const isSelf = m.id === currentUserId;
                const mRole = m.role?.toLowerCase() || 'member';
                const isTargetOwner = mRole === 'owner';
                const isTargetAdmin = mRole === 'admin';
                const userNickname = nicknames[m.id];
                const displayTitle = NicknameService.getEffectiveName(m, nicknames);
                const isLast = idx === members.length - 1;

                return (
                  <View
                    key={`m_${m.id}`}
                    style={[
                      styles.memberRow,
                      !isLast && { borderBottomColor: colors.divider, borderBottomWidth: 1 },
                    ]}
                  >
                    <Avatar
                      size={40}
                      avatarUrl={m.avatarUrl}
                      name={m.fullName}
                      showOnlineDot={true}
                      isOnline={m.isOnline}
                    />

                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.memberName, { color: colors.textMain }]} numberOfLines={1}>
                          {displayTitle} {isSelf && '(You)'}
                        </Text>
                      </View>

                      {/* Nickname button */}
                      {!isSelf && (
                        <TouchableOpacity
                          onPress={() => setNicknameModalTarget(m)}
                          style={styles.nicknameTag}
                        >
                          <Feather name="tag" size={10} color={colors.primary} />
                          <Text style={[styles.nicknameTagText, { color: colors.primary }]}>
                            {userNickname ? `"${userNickname}"` : 'Set nickname'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Role badge */}
                    <TouchableOpacity
                      activeOpacity={isOwner && !isSelf ? 0.7 : 1}
                      onPress={() => isOwner && !isSelf && handleRoleChangePrompt(m)}
                      style={[
                        styles.roleChip,
                        isTargetOwner
                          ? { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }
                          : isTargetAdmin
                          ? { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : '#EDE9FE' }
                          : { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          isTargetOwner
                            ? { color: isDark ? '#FBBF24' : '#B45309' }
                            : isTargetAdmin
                            ? { color: isDark ? '#A78BFA' : '#7C3AED' }
                            : { color: colors.textSecondary },
                        ]}
                      >
                        {isTargetOwner ? 'Owner' : isTargetAdmin ? 'Admin' : 'Member'}
                      </Text>
                    </TouchableOpacity>

                    {/* Remove button */}
                    {!isSelf && (isOwner || (isAdmin && !isTargetAdmin && !isTargetOwner)) && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMemberPrompt(m)}
                        style={styles.memberRemoveBtn}
                        accessibilityLabel={`Remove ${m.fullName}`}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={colors.sos} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Section 3: Saved Places & Geofences */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              PLACES & ALERTS ({places.length})
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticService.light();
                setShowAddPlaceModal(true);
              }}
              style={styles.addMemberInlineBtn}
            >
              <Feather name="plus-circle" size={13} color={colors.primary} />
              <Text style={[styles.addMemberInlineText, { color: colors.primary }]}>Add Place</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.cardGroup,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {places.length === 0 ? (
              <View style={styles.emptyPlacesBox}>
                <Ionicons name="location-outline" size={26} color={colors.primary} />
                <Text style={[styles.emptyPlacesTitle, { color: colors.textMain }]}>
                  No Places Configured
                </Text>
                <Text style={[styles.emptyPlacesDesc, { color: colors.textSecondary }]}>
                  Save Home, Work, or School to get arrival & departure notifications.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddPlaceModal(true)}
                  style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.emptyAddBtnText}>+ Add Circle Place</Text>
                </TouchableOpacity>
              </View>
            ) : (
              places.map((place: any, idx) => {
                const placeEmoji = getCategoryEmoji(place.category);
                const radiusVal = place.radius_meters || place.radiusMeters || 200;
                const formattedRadius =
                  circleMeta.distanceUnit === 'miles'
                    ? `${(radiusVal / 1609.34).toFixed(1)} mi radius`
                    : `${radiusVal}m radius`;
                const isLast = idx === places.length - 1;

                return (
                  <View
                    key={place.id || `pl_${idx}`}
                    style={[
                      styles.placeRow,
                      !isLast && { borderBottomColor: colors.divider, borderBottomWidth: 1 },
                    ]}
                  >
                    <View style={[styles.placeIconBadge, { backgroundColor: colors.tileBg }]}>
                      <Text style={{ fontSize: 18 }}>{placeEmoji}</Text>
                    </View>

                    <View style={styles.placeInfo}>
                      <Text style={[styles.placeName, { color: colors.textMain }]}>
                        {place.name}
                      </Text>
                      <Text style={[styles.placeRadius, { color: colors.textSecondary }]}>
                        {formattedRadius} • Alerts active
                      </Text>
                    </View>

                    {onDeletePlace && (
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Delete Place', `Remove "${place.name}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => onDeletePlace(place.id) },
                          ]);
                        }}
                        style={styles.placeDeleteBtn}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.sos} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Section 4: Privacy & Permissions */}
          <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
            PERMISSIONS & PRIVACY
          </Text>
          <View
            style={[
              styles.cardGroup,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {/* Who Can Invite Toggle */}
            <View style={[styles.rowItem, { borderBottomColor: colors.divider, borderBottomWidth: 1 }]}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF' }]}>
                  <Ionicons name="people-outline" size={16} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: colors.textMain }]}>Member Invitations</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    {circleMeta.invitePolicyAdminsOnly ? 'Admins & Owner only' : 'All members can invite'}
                  </Text>
                </View>
              </View>

              {isOwner ? (
                <View style={styles.miniSegment}>
                  <TouchableOpacity
                    onPress={() => handleUpdateMeta({ invitePolicyAdminsOnly: false })}
                    style={[
                      styles.miniSegmentBtn,
                      !circleMeta.invitePolicyAdminsOnly && [
                        styles.miniSegmentBtnActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.miniSegmentText,
                        !circleMeta.invitePolicyAdminsOnly
                          ? { color: '#FFFFFF', fontWeight: '800' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleUpdateMeta({ invitePolicyAdminsOnly: true })}
                    style={[
                      styles.miniSegmentBtn,
                      circleMeta.invitePolicyAdminsOnly && [
                        styles.miniSegmentBtnActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.miniSegmentText,
                        circleMeta.invitePolicyAdminsOnly
                          ? { color: '#FFFFFF', fontWeight: '800' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      Admins
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>
                  {circleMeta.invitePolicyAdminsOnly ? 'Admins' : 'All'}
                </Text>
              )}
            </View>

            {/* Privacy Bubbles Switch */}
            <View
              style={[
                styles.rowItem,
                isAdmin && { borderBottomColor: colors.divider, borderBottomWidth: 1 },
              ]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                  <Ionicons name="eye-off-outline" size={16} color="#10B981" />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: colors.textMain }]}>Privacy Bubbles</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    Allow members to blur location
                  </Text>
                </View>
              </View>

              <Switch
                value={circleMeta.bubblesAllowed !== false}
                disabled={!isOwner}
                onValueChange={(val) => handleUpdateMeta({ bubblesAllowed: val })}
                trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Regenerate Invite Code (Admins only) */}
            {isAdmin && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleRegenerateInviteCode}
                style={styles.rowItem}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                    <Ionicons name="refresh-outline" size={16} color="#F59E0B" />
                  </View>
                  <View>
                    <Text style={[styles.rowTitle, { color: colors.textMain }]}>Regenerate Invite Code</Text>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                      Revokes old links & creates a new code
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Section 5: Danger Zone */}
          <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
            MEMBERSHIP
          </Text>
          <View
            style={[
              styles.cardGroup,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  'Leave Circle',
                  `Are you sure you want to leave "${circle?.name || 'this circle'}"? You will need an invite code to rejoin.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: onLeaveCircle },
                  ]
                );
              }}
              style={styles.rowItem}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                  <Ionicons name="log-out-outline" size={16} color={colors.sos} />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: colors.sos }]}>Leave Circle</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                    Stop sharing location with this group
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Modal: Rename Circle */}
        <Modal visible={showRenameModal} transparent animationType="fade">
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.dialogTitle, { color: colors.textMain }]}>Rename Circle</Text>
              <Text style={[styles.dialogSubtitle, { color: colors.textSecondary }]}>
                Choose a new name for your circle.
              </Text>
              <TextInput
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Circle Name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                style={[
                  styles.dialogInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.textMain,
                  },
                ]}
              />
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  onPress={() => setShowRenameModal(false)}
                  style={[styles.dialogSecondaryBtn, { backgroundColor: colors.tileBg }]}
                >
                  <Text style={[styles.dialogSecondaryBtnText, { color: colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveRename}
                  disabled={!renameText.trim()}
                  style={[
                    styles.dialogPrimaryBtn,
                    { backgroundColor: colors.primary },
                    !renameText.trim() && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.dialogPrimaryBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Customize Appearance (Initials, Emoji, Color) */}
        <Modal visible={showCustomizeModal} transparent animationType="slide">
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.customSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.customSheetHeader}>
                <Text style={[styles.dialogTitle, { color: colors.textMain }]}>
                  Customize Circle Avatar
                </Text>
                <TouchableOpacity onPress={() => setShowCustomizeModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Avatar Live Preview */}
              <View style={{ alignItems: 'center', marginVertical: 14 }}>
                <View
                  style={[
                    styles.heroAvatar,
                    { backgroundColor: effectiveColor, width: 68, height: 68, borderRadius: 34 },
                  ]}
                >
                  {circleMeta.badgeEmoji ? (
                    <Text style={{ fontSize: 32 }}>{circleMeta.badgeEmoji}</Text>
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF' }}>
                      {effectiveInitials}
                    </Text>
                  )}
                </View>
              </View>

              {/* Initials Input */}
              <Text style={[styles.controlLabel, { color: colors.textMain }]}>Circle Initials</Text>
              <TextInput
                value={circleMeta.initials || ''}
                onChangeText={(val) => handleUpdateMeta({ initials: val.toUpperCase().substring(0, 4) })}
                maxLength={4}
                autoCapitalize="characters"
                placeholder="e.g. SF, FAM"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.dialogInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.textMain,
                    textAlign: 'center',
                    fontWeight: '800',
                    fontSize: 16,
                  },
                ]}
              />

              {/* Theme Color Swatches */}
              <Text style={[styles.controlLabel, { color: colors.textMain, marginTop: 12 }]}>
                Theme Color
              </Text>
              <View style={styles.swatchRow}>
                {COLOR_PALETTE.map((c) => {
                  const isSelected = effectiveColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.8}
                      onPress={() => handleUpdateMeta({ color: c.hex })}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c.hex },
                        isSelected && styles.colorCircleSelected,
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Emoji Badges */}
              <Text style={[styles.controlLabel, { color: colors.textMain, marginTop: 14 }]}>
                Badge Icon
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                {PRESET_CIRCLE_BADGES.map((badge) => {
                  const isSelected = circleMeta.badgeEmoji === badge;
                  return (
                    <TouchableOpacity
                      key={badge}
                      activeOpacity={0.7}
                      onPress={() => handleUpdateMeta({ badgeEmoji: badge })}
                      style={[
                        styles.badgeOption,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(79, 70, 229, 0.3)' : '#EEF2FF')
                            : colors.tileBg,
                          borderColor: isSelected ? colors.primary : colors.cardBorder,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>{badge}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setShowCustomizeModal(false)}
                style={[styles.dialogPrimaryBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
              >
                <Text style={styles.dialogPrimaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal: Circle Type Picker */}
        <Modal visible={showTypePickerModal} transparent animationType="slide">
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.customSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.customSheetHeader}>
                <Text style={[styles.dialogTitle, { color: colors.textMain }]}>Circle Type</Text>
                <TouchableOpacity onPress={() => setShowTypePickerModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {(Object.keys(CIRCLE_TYPES) as CircleType[]).map((typeKey) => {
                const item = CIRCLE_TYPES[typeKey];
                const isSelected = circleMeta.circleType === typeKey;

                return (
                  <TouchableOpacity
                    key={typeKey}
                    activeOpacity={0.7}
                    onPress={() => {
                      handleUpdateMeta({
                        circleType: typeKey,
                        badgeEmoji: item.emoji,
                      });
                      setShowTypePickerModal(false);
                    }}
                    style={[
                      styles.typeOptionRow,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF')
                          : colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 22, marginRight: 12 }}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.typeOptionTitle, { color: colors.textMain }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.typeOptionDesc, { color: colors.textSecondary }]}>
                        {item.description}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>

        {/* Modal: Add Place / Geofence */}
        <SavePlaceModal
          visible={showAddPlaceModal}
          onClose={() => setShowAddPlaceModal(false)}
          latitude={currentLocation?.latitude ?? 12.9095}
          longitude={currentLocation?.longitude ?? 77.6753}
          myPosition={currentLocation}
          currentUserId={currentUserId}
          mapStyle={mapStyle}
          onSavePlace={async (place) => {
            await onAddPlace?.({
              name: place.name,
              category: place.category,
              latitude: place.latitude,
              longitude: place.longitude,
              radiusMeters: place.radiusMeters,
            });
            setShowAddPlaceModal(false);
          }}
        />

        {/* Modal: Set Private Nickname */}
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
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  navCloseBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  navCloseText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  heroAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  heroAvatarEmoji: {
    fontSize: 34,
  },
  heroAvatarInitials: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  inviteBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  inviteCodeArea: {
    flex: 1,
  },
  inviteLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inviteCodeText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  codeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  addMemberInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  addMemberInlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 22,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowValue: {
    fontSize: 12,
    marginTop: 1,
  },
  miniSegment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 10,
    padding: 2,
  },
  miniSegmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniSegmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  miniSegmentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
  },
  nicknameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  nicknameTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  memberRemoveBtn: {
    padding: 6,
    marginLeft: 6,
  },
  emptyPlacesBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyPlacesTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyPlacesDesc: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 14,
  },
  emptyAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  placeIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  placeRadius: {
    fontSize: 11,
    marginTop: 2,
  },
  placeDeleteBtn: {
    padding: 6,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  dialogSubtitle: {
    fontSize: 13,
    marginBottom: 14,
  },
  dialogInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dialogSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dialogPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dialogPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  customSheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  customSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeRow: {
    gap: 8,
    paddingVertical: 4,
  },
  badgeOption: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  typeOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  typeOptionDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
});
