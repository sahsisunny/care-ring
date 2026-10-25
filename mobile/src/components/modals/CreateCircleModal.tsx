import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Switch,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { InlineButtonLoader } from '../common/Loader';
import {
  CircleType,
  CIRCLE_TYPES,
  PRESET_CIRCLE_BADGES,
} from '../../services/CircleCustomizationService';
import { hapticService } from '../../services/HapticService';

export interface CreateCirclePayload {
  name: string;
  circleType?: CircleType;
  badgeEmoji?: string;
  initials?: string;
  color?: string;
  imageUrl?: string | null;
  distanceUnit?: 'km' | 'miles';
  invitePolicy?: 'all' | 'admins_only';
  bubblesAllowed?: boolean;
}

export interface CreateCircleModalProps {
  visible?: boolean;
  isEmbedded?: boolean;
  onClose: () => void;
  onCreate: (payload: CreateCirclePayload) => Promise<void>;
}

const PRESET_NAMES = [
  'Sahsi Family',
  'Home Sweet Home',
  'Road Warriors',
  'The Core Squad',
  'Campus Gang',
  'Work & Crew',
];

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

export const CreateCircleModal: React.FC<CreateCircleModalProps> = ({
  visible = true,
  isEmbedded = false,
  onClose,
  onCreate,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<CircleType>('family');
  const [initials, setInitials] = useState('');
  const [isInitialsManual, setIsInitialsManual] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'initials' | 'emoji'>('initials');
  const [selectedEmoji, setSelectedEmoji] = useState('👨‍👩‍👧‍👦');
  const [selectedColor, setSelectedColor] = useState('#4F46E5');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  // Settings State
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'miles'>('km');
  const [invitePolicy, setInvitePolicy] = useState<'all' | 'admins_only'>('all');
  const [bubblesAllowed, setBubblesAllowed] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate top bar padding
  const statusBarHeight = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight || 36)
    : Math.max(insets.top, 44);

  // Auto-generate initials from name unless user customized manually
  useEffect(() => {
    if (!isInitialsManual) {
      const trimmed = name.trim();
      if (!trimmed) {
        setInitials('CR');
        return;
      }
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        setInitials((words[0][0] + words[1][0]).toUpperCase());
      } else {
        setInitials(trimmed.substring(0, 2).toUpperCase());
      }
    }
  }, [name, isInitialsManual]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setName('');
      setSelectedType('family');
      setInitials('CR');
      setIsInitialsManual(false);
      setAvatarMode('initials');
      setSelectedEmoji('👨‍👩‍👧‍👦');
      setSelectedColor('#4F46E5');
      setCustomImageUrl('');
      setShowImageInput(false);
      setDistanceUnit('km');
      setInvitePolicy('all');
      setBubblesAllowed(true);
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  // Handle Type Change
  const handleSelectType = (typeKey: CircleType) => {
    hapticService.selection();
    setSelectedType(typeKey);
    const meta = CIRCLE_TYPES[typeKey];
    if (meta) {
      setSelectedEmoji(meta.emoji);
      if (typeKey === 'trip') setSelectedColor('#F59E0B');
      else if (typeKey === 'friends') setSelectedColor('#0284C7');
      else if (typeKey === 'work') setSelectedColor('#10B981');
      else if (typeKey === 'family') setSelectedColor('#4F46E5');
    }
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a name for your circle.');
      hapticService.light();
      return;
    }

    setLoading(true);
    setError(null);
    hapticService.light();

    try {
      const payload: CreateCirclePayload = {
        name: trimmedName,
        circleType: selectedType,
        badgeEmoji: selectedEmoji,
        initials: initials.trim().toUpperCase() || undefined,
        color: selectedColor,
        imageUrl: customImageUrl.trim().length > 0 ? customImageUrl.trim() : null,
        distanceUnit,
        invitePolicy,
        bubblesAllowed,
      };

      await onCreate(payload);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create circle. Please try again.');
      hapticService.light();
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = CIRCLE_TYPES[selectedType] || CIRCLE_TYPES.family;

  const ScrollOrView: any = isEmbedded ? View : ScrollView;
  const scrollProps = isEmbedded
    ? { style: { paddingHorizontal: 0, paddingTop: 4 } }
    : {
        ref: scrollViewRef,
        style: styles.scroll,
        contentContainerStyle: [
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ],
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled' as const,
      };

  const innerContent = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fullScreen, { backgroundColor: isEmbedded ? 'transparent' : colors.background }]}
    >
      {!isEmbedded && (
        <View
          style={[
            styles.navBar,
            {
              paddingTop: statusBarHeight + 8,
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
              styles.navIconBtn,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)' },
            ]}
            accessibilityLabel="Close creation flow"
          >
            <Feather name="x" size={20} color={colors.textMain} />
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <Text style={[styles.navTitle, { color: colors.textMain }]}>
              Create New Circle
            </Text>
            <Text style={[styles.navSubtitle, { color: colors.textSecondary }]}>
              Step 1 of 1 • Details &amp; Preferences
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCreate}
            disabled={!name.trim() || loading}
            style={[
              styles.navDoneBtn,
              { backgroundColor: colors.primary },
              (!name.trim() || loading) && styles.navDoneBtnDisabled,
            ]}
          >
            <Text style={styles.navDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <ScrollOrView {...scrollProps}>
          {/* Error Banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: colors.sos }]}>
              <Ionicons name="alert-circle" size={18} color={colors.sos} />
              <Text style={[styles.errorBannerText, { color: colors.sos }]}>{error}</Text>
            </View>
          )}

          {/* Live Interactive Preview Card */}
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <View style={styles.previewTopRow}>
              {/* Circle Avatar with chosen color and initials or emoji */}
              <View
                style={[
                  styles.previewAvatar,
                  { backgroundColor: selectedColor },
                ]}
              >
                {customImageUrl.trim().length > 0 ? (
                  <Image
                    source={{ uri: customImageUrl.trim() }}
                    style={styles.previewAvatarImage}
                  />
                ) : avatarMode === 'emoji' ? (
                  <Text style={styles.previewAvatarEmoji}>{selectedEmoji}</Text>
                ) : (
                  <Text style={styles.previewAvatarInitials}>
                    {initials || 'CR'}
                  </Text>
                )}

                {/* Sub-badge indicating type */}
                <View style={styles.avatarTypeBadge}>
                  <Text style={styles.avatarTypeBadgeEmoji}>{selectedEmoji}</Text>
                </View>
              </View>

              <View style={styles.previewInfo}>
                <View style={styles.previewBadgeRow}>
                  <View
                    style={[
                      styles.typePill,
                      { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#EEF2FF' },
                    ]}
                  >
                    <Text style={[styles.typePillText, { color: colors.primary }]}>
                      {typeConfig.emoji} {typeConfig.label}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.rolePill,
                      { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' },
                    ]}
                  >
                    <Text style={[styles.rolePillText, { color: '#10B981' }]}>
                      Owner
                    </Text>
                  </View>
                </View>

                <Text
                  style={[styles.previewName, { color: colors.textMain }]}
                  numberOfLines={1}
                >
                  {name.trim() || 'New Circle Name'}
                </Text>

                <Text style={[styles.previewSubtitle, { color: colors.textSecondary }]}>
                  {distanceUnit === 'km' ? 'Metric (km)' : 'Imperial (mi)'} • {invitePolicy === 'all' ? 'All members invite' : 'Admins only'}
                </Text>
              </View>
            </View>

            <View style={[styles.previewDivider, { backgroundColor: colors.divider }]} />

            <View style={styles.previewFooter}>
              <Ionicons name="key-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.previewFooterText, { color: colors.textMuted }]}>
                Invite Code: <Text style={{ fontWeight: '800', color: colors.primary }}>{((initials || name || 'FAM').replace(/[^A-Za-z0-9]/g, '').substring(0, 4) || 'FAM').toUpperCase()}-••••</Text> will be generated in DB.
              </Text>
            </View>
          </View>

          {/* Section 1: Circle Name */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                Circle Name
              </Text>
              <Text style={[styles.charCount, { color: colors.textMuted }]}>
                {name.length}/60
              </Text>
            </View>

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Ionicons name="people-outline" size={20} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (error) setError(null);
                }}
                maxLength={60}
                placeholder="e.g. Sahsi Family, Roadtrippers, Campus Squad"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textMain }]}
                returnKeyType="done"
              />
              {name.length > 0 && (
                <TouchableOpacity
                  onPress={() => setName('')}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Inspiration Name Chips */}
            <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
              Quick Suggestions:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {PRESET_NAMES.map((item) => (
                <TouchableOpacity
                  key={item}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticService.selection();
                    setName(item);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: name === item
                        ? (isDark ? 'rgba(79, 70, 229, 0.3)' : '#EEF2FF')
                        : colors.tileBg,
                      borderColor: name === item ? colors.primary : colors.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: name === item ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Section 2: Circle Type */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
              Circle Type
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Choose the category that best matches your group.
            </Text>

            <View style={styles.typesGrid}>
              {(Object.keys(CIRCLE_TYPES) as CircleType[]).map((typeKey) => {
                const item = CIRCLE_TYPES[typeKey];
                const isSelected = selectedType === typeKey;

                return (
                  <TouchableOpacity
                    key={typeKey}
                    activeOpacity={0.75}
                    onPress={() => handleSelectType(typeKey)}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.cardBorder,
                        borderWidth: isSelected ? 2 : 1,
                      },
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(79, 70, 229, 0.18)' : '#F5F7FF',
                      },
                    ]}
                  >
                    <View style={styles.typeCardHeader}>
                      <Text style={styles.typeEmoji}>{item.emoji}</Text>
                      {isSelected && (
                        <View style={[styles.typeCheck, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.typeTitle, { color: colors.textMain }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.typeDesc, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 3: Visual Initials, Badge & Color Styling */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
              Avatar & Visual Identity
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Customize the initials, emoji badge, and accent color stored for this circle.
            </Text>

            {/* Initials & Avatar Mode Selector */}
            <View
              style={[
                styles.identityCard,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={styles.initialsRow}>
                <View style={styles.initialsInputArea}>
                  <Text style={[styles.controlLabel, { color: colors.textMain }]}>
                    Circle Initials (1-4 letters)
                  </Text>
                  <TextInput
                    value={initials}
                    onChangeText={(val) => {
                      setIsInitialsManual(true);
                      setInitials(val.toUpperCase().substring(0, 4));
                    }}
                    maxLength={4}
                    autoCapitalize="characters"
                    placeholder="SF"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.initialsInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.textMain,
                      },
                    ]}
                  />
                </View>

                {/* Avatar Display Mode: Initials vs Emoji */}
                <View style={styles.avatarModeArea}>
                  <Text style={[styles.controlLabel, { color: colors.textMain }]}>
                    Display As
                  </Text>
                  <View style={styles.modeToggleRow}>
                    <TouchableOpacity
                      onPress={() => {
                        hapticService.selection();
                        setAvatarMode('initials');
                      }}
                      style={[
                        styles.modeBtn,
                        avatarMode === 'initials' && [
                          styles.modeBtnActive,
                          { backgroundColor: colors.primary },
                        ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeBtnText,
                          avatarMode === 'initials'
                            ? { color: '#FFFFFF', fontWeight: '800' }
                            : { color: colors.textSecondary },
                        ]}
                      >
                        Initials
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        hapticService.selection();
                        setAvatarMode('emoji');
                      }}
                      style={[
                        styles.modeBtn,
                        avatarMode === 'emoji' && [
                          styles.modeBtnActive,
                          { backgroundColor: colors.primary },
                        ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeBtnText,
                          avatarMode === 'emoji'
                            ? { color: '#FFFFFF', fontWeight: '800' }
                            : { color: colors.textSecondary },
                        ]}
                      >
                        Emoji
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Accent Color Palette */}
              <Text style={[styles.paletteLabel, { color: colors.textMain }]}>
                Circle Theme Color
              </Text>
              <View style={styles.colorPaletteRow}>
                {COLOR_PALETTE.map((c) => {
                  const isSelected = selectedColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        hapticService.selection();
                        setSelectedColor(c.hex);
                      }}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.hex },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                      accessibilityLabel={c.name}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Badge Emoji Selector */}
              <Text style={[styles.paletteLabel, { color: colors.textMain, marginTop: 16 }]}>
                Badge Icon
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiRow}
              >
                {PRESET_CIRCLE_BADGES.map((emoji) => {
                  const isSelected = selectedEmoji === emoji;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      activeOpacity={0.7}
                      onPress={() => {
                        hapticService.selection();
                        setSelectedEmoji(emoji);
                      }}
                      style={[
                        styles.emojiCircle,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(79, 70, 229, 0.35)' : '#EEF2FF')
                            : colors.inputBg,
                          borderColor: isSelected ? colors.primary : colors.cardBorder,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Optional Custom Cover Photo URL */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowImageInput(!showImageInput)}
                style={styles.toggleImageBtn}
              >
                <Feather
                  name={showImageInput ? 'chevron-up' : 'image'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.toggleImageText, { color: colors.primary }]}>
                  {showImageInput ? 'Hide Custom Image URL' : 'Use Custom Image Avatar (Optional)'}
                </Text>
              </TouchableOpacity>

              {showImageInput && (
                <View style={styles.imageInputContainer}>
                  <TextInput
                    value={customImageUrl}
                    onChangeText={setCustomImageUrl}
                    placeholder="https://example.com/avatar.jpg"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="url"
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                        color: colors.textMain,
                        marginBottom: 0,
                      },
                    ]}
                  />
                  {customImageUrl.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={() => setCustomImageUrl('')}
                      style={{ marginTop: 6 }}
                    >
                      <Text style={{ fontSize: 12, color: colors.sos }}>Clear Image URL</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Section 4: Circle Settings & Privacy Rules */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
              Circle Settings & Rules
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              These preferences will be saved directly into the database for all circle members.
            </Text>

            <View
              style={[
                styles.settingsCard,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              {/* Distance Unit Segmented */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingTitleRow}>
                    <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
                    <Text style={[styles.settingTitle, { color: colors.textMain }]}>
                      Distance Measurement
                    </Text>
                  </View>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    Unit used for travel speed, accuracy and geofences.
                  </Text>
                </View>

                <View style={styles.segmentedToggle}>
                  <TouchableOpacity
                    onPress={() => {
                      hapticService.selection();
                      setDistanceUnit('km');
                    }}
                    style={[
                      styles.segmentBtn,
                      distanceUnit === 'km' && [
                        styles.segmentBtnActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        distanceUnit === 'km'
                          ? { color: '#FFFFFF', fontWeight: '800' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      km
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      hapticService.selection();
                      setDistanceUnit('miles');
                    }}
                    style={[
                      styles.segmentBtn,
                      distanceUnit === 'miles' && [
                        styles.segmentBtnActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        distanceUnit === 'miles'
                          ? { color: '#FFFFFF', fontWeight: '800' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      mi
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.settingDivider, { backgroundColor: colors.divider }]} />

              {/* Invite Policy */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingTitleRow}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                    <Text style={[styles.settingTitle, { color: colors.textMain }]}>
                      Member Invitations
                    </Text>
                  </View>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    {invitePolicy === 'all'
                      ? 'Anyone in this circle can share the invite code.'
                      : 'Only circle owners and admins can invite new members.'}
                  </Text>
                </View>

                <View style={styles.segmentedToggle}>
                  <TouchableOpacity
                    onPress={() => {
                      hapticService.selection();
                      setInvitePolicy('all');
                    }}
                    style={[
                      styles.segmentBtn,
                      invitePolicy === 'all' && [
                        styles.segmentBtnActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        invitePolicy === 'all'
                          ? { color: '#FFFFFF', fontWeight: '800' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      hapticService.selection();
                      setInvitePolicy('admins_only');
                    }}
                    style={[
                      styles.segmentBtn,
                      invitePolicy === 'admins_only' && [
                        styles.segmentBtnActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        invitePolicy === 'admins_only'
                          ? { color: '#FFFFFF', fontWeight: '800' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      Admins
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.settingDivider, { backgroundColor: colors.divider }]} />

              {/* Privacy Bubbles / Ghost Mode */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingTitleRow}>
                    <Ionicons name="eye-off-outline" size={18} color={colors.primary} />
                    <Text style={[styles.settingTitle, { color: colors.textMain }]}>
                      Ghost Mode
                    </Text>
                  </View>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    Allow members to set temporary privacy zones where their exact location is fuzzed.
                  </Text>
                </View>

                <Switch
                  value={bubblesAllowed}
                  onValueChange={(val) => {
                    hapticService.light();
                    setBubblesAllowed(val);
                  }}
                  trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </ScrollOrView>

        {/* Action Button Bar */}
        <View
          style={[
            isEmbedded
              ? { backgroundColor: 'transparent', paddingHorizontal: 0, paddingTop: 16, borderTopWidth: 0 }
              : [
                  styles.bottomBar,
                  {
                    backgroundColor: colors.card,
                    borderTopColor: colors.divider,
                    paddingBottom: Math.max(insets.bottom, 16),
                  },
                ],
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCreate}
            disabled={!name.trim() || loading}
            style={[
              styles.primaryBtn,
              { backgroundColor: selectedColor || colors.primary },
              (!name.trim() || loading) && styles.primaryBtnDisabled,
            ]}
          >
            {loading ? (
              <InlineButtonLoader size={18} label="Creating Circle in Database..." />
            ) : (
              <View style={styles.btnContentRow}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  Create {name.trim() ? `"${name.trim()}"` : 'Circle'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
  );

  if (isEmbedded) {
    return innerContent;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {innerContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  navSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  navDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  navDoneBtnDisabled: {
    opacity: 0.5,
  },
  navDoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  previewAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  previewAvatarInitials: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  previewAvatarEmoji: {
    fontSize: 28,
  },
  avatarTypeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  avatarTypeBadgeEmoji: {
    fontSize: 11,
  },
  previewInfo: {
    flex: 1,
  },
  previewBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rolePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  previewName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  previewSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  previewDivider: {
    height: 1,
    marginVertical: 14,
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewFooterText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 6,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 16,
  },
  typeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeEmoji: {
    fontSize: 24,
  },
  typeCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  identityCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  initialsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  initialsInputArea: {
    flex: 1,
  },
  avatarModeArea: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  initialsInput: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
  },
  modeToggleRow: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
    borderRadius: 12,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  modeBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paletteLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  emojiRow: {
    gap: 8,
    paddingVertical: 2,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
  toggleImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 6,
  },
  toggleImageText: {
    fontSize: 13,
    fontWeight: '700',
  },
  imageInputContainer: {
    marginTop: 10,
  },
  settingsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  settingDivider: {
    height: 1,
    marginVertical: 14,
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
