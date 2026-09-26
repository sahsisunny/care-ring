import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { MapStyleConfig, ALL_MAP_STYLES } from '../../models/MapStyle';
import {
  TileCacheService,
  CacheStats,
  CacheProgress,
  FrequentLocation,
  SmartCacheConfig,
} from '../../services/TileCacheService';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle, getWebGlassPillStyle } from '../../theme/colors';
import { Avatar } from '../Avatar';
import { Circle } from '../../models/Circle';
import { authService } from '../../services/AuthService';
import { notificationService, NotificationPreferences } from '../../services/NotificationService';
import { AppThemeId, ALL_APP_THEMES, themeService } from '../../theme/ThemeService';
import { useTheme } from '../../theme/ThemeContext';

export type SettingsSubView =
  | 'main'
  | 'profile'
  | 'account'
  | 'circle'
  | 'notifications'
  | 'map'
  | 'offline_cache'
  | 'theme'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'features';

interface SettingsModalProps {
  visible: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail?: string;
  currentUserPhone?: string | null;
  currentUserAvatar?: string | null;
  activeMapStyle: MapStyleConfig;
  backendUrl: string;
  circles: Circle[];
  selectedCircle: Circle | null;
  onClose: () => void;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateProfile?: (name: string, phone: string, avatarUrl: string | null) => Promise<void>;
  onSaveAvatar: (avatarUrl: string | null) => void;
  onSelectMapStyle: (style: MapStyleConfig) => void;
  onSelectCircle?: (circle: Circle) => void;
  onCreateCircle?: () => void;
  onJoinCircle?: () => void;
  onInviteMembers?: () => void;
  onRenameCircle?: (newName: string) => void;
  onLeaveCircle?: () => void;
  onOpenFeaturesCatalog?: () => void;
  onOpenOfflineMapManager?: () => void;
  onTriggerFeature?: (actionId: string) => void;
  cacheStats?: CacheStats | null;
  frequentLocations?: FrequentLocation[];
  cacheProgress?: CacheProgress | null;
  isCaching?: boolean;
  onCacheAllFrequent?: () => void;
  onCacheCurrentView?: () => void;
  onClearCache?: () => void;
  activeThemeId?: AppThemeId;
  onSelectTheme?: (themeId: AppThemeId) => void;
  onSignOut: () => void;
  onDeleteAccount?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserPhone,
  currentUserAvatar,
  activeMapStyle,
  backendUrl,
  circles,
  selectedCircle,
  onClose,
  onUpdateName,
  onUpdateProfile,
  onSaveAvatar,
  onSelectMapStyle,
  onSelectCircle,
  onCreateCircle,
  onJoinCircle,
  onInviteMembers,
  onRenameCircle,
  onLeaveCircle,
  onOpenFeaturesCatalog,
  onOpenOfflineMapManager,
  onTriggerFeature,
  cacheStats: propCacheStats,
  frequentLocations,
  cacheProgress,
  isCaching = false,
  onCacheAllFrequent,
  onCacheCurrentView,
  onClearCache,
  activeThemeId: propActiveThemeId,
  onSelectTheme,
  onSignOut,
  onDeleteAccount,
}) => {
  const { colors, isDark, isGlass, glassConfig, updateGlassConfig, resetGlassConfig } = useTheme();
  const [currentView, setCurrentView] = useState<SettingsSubView>('main');

  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);
  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  // Theme & Liquid Glass State
  const [selectedThemeId, setSelectedThemeId] = useState<AppThemeId>(
    propActiveThemeId || themeService.getActiveThemeId()
  );

  useEffect(() => {
    if (propActiveThemeId) {
      setSelectedThemeId(propActiveThemeId);
    }
  }, [propActiveThemeId]);

  const handleSelectTheme = async (themeId: AppThemeId) => {
    setSelectedThemeId(themeId);
    await themeService.setTheme(themeId);
    if (onSelectTheme) {
      onSelectTheme(themeId);
    }
  };

  // Edit Profile State
  const [profileName, setProfileName] = useState(currentUserName);
  const [profilePhone, setProfilePhone] = useState(currentUserPhone || '');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(currentUserAvatar || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Circle Edit Name State
  const [editingCircleName, setEditingCircleName] = useState(selectedCircle?.name || '');
  const [isSavingCircleName, setIsSavingCircleName] = useState(false);

  // Cache stats & smart config
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(propCacheStats || null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [smartConfig, setSmartConfig] = useState<SmartCacheConfig>({
    enabled: true,
    maxLimitMB: 60,
    autoCacheFrequent: true,
  });

  useEffect(() => {
    if (propCacheStats) {
      setCacheStats(propCacheStats);
    }
  }, [propCacheStats]);

  // Notification Preferences State
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(notificationService.getPreferences());

  useEffect(() => {
    if (visible) {
      setCurrentView('main');
      setProfileName(currentUserName);
      setProfilePhone(currentUserPhone || '');
      setProfileAvatar(currentUserAvatar || null);
      setEditingCircleName(selectedCircle?.name || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatusMsg(null);
      setNotifPrefs(notificationService.getPreferences());
      TileCacheService.getCacheStats().then(setCacheStats);
      TileCacheService.getSmartConfig().then(setSmartConfig);
      const unsubConfig = TileCacheService.subscribeConfig(setSmartConfig);
      const unsubStats = TileCacheService.subscribeStats(setCacheStats);
      return () => {
        unsubConfig();
        unsubStats();
      };
    }
  }, [visible, currentUserName, currentUserPhone, currentUserAvatar, selectedCircle]);

  const handleToggleNotif = async (key: keyof NotificationPreferences, value: any) => {
    const updated = await notificationService.updatePreferences({ [key]: value });
    setNotifPrefs(updated);
  };

  const handleTestNotif = () => {
    notificationService.sendTestNotification();
  };

  // Gallery Picker
  const handlePickFromGallery = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please enable photo library access to upload a picture.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProfileAvatar(dataUri);
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Could not open photo gallery.');
    }
  };

  // Camera Picker
  const handleTakeFromCamera = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please enable camera access to take a picture.');
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProfileAvatar(dataUri);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera.');
    }
  };

  // Remove Photo
  const handleRemovePhoto = () => {
    setProfileAvatar(null);
  };

  // Save Profile
  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }
    setIsSavingProfile(true);
    try {
      await authService.updateProfile({
        backendUrl,
        fullName: profileName.trim(),
        phone: profilePhone.trim() || null,
        avatarUrl: profileAvatar,
      });
      onSaveAvatar(profileAvatar);
      await onUpdateName(profileName.trim());
      Alert.alert('Profile Updated', 'Your profile details have been successfully saved.');
      setCurrentView('main');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async () => {
    setPasswordStatusMsg(null);
    if (!currentPassword) {
      setPasswordStatusMsg({ text: 'Please enter your current password.', error: true });
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setPasswordStatusMsg({ text: 'New password must be at least 4 characters long.', error: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatusMsg({ text: 'New password and confirmation do not match.', error: true });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const res = await authService.changePassword(backendUrl, currentPassword, newPassword);
      if (res.success) {
        setPasswordStatusMsg({ text: 'Password successfully updated!', error: false });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Success', 'Your password has been changed.');
      } else {
        setPasswordStatusMsg({ text: res.error || 'Failed to update password.', error: true });
      }
    } catch (e: any) {
      setPasswordStatusMsg({ text: e.message || 'An error occurred.', error: true });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Clear Tile Cache
  const handleClearCache = async () => {
    setIsClearingCache(true);
    if (onClearCache) {
      await onClearCache();
    } else {
      await TileCacheService.clearCache();
    }
    const updated = await TileCacheService.getCacheStats();
    setCacheStats(updated);
    setIsClearingCache(false);
    Alert.alert('Cache Cleared', 'Offline map tile cache has been freed.');
  };

  // Confirm Sign Out
  const handleConfirmSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from CareRing on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onSignOut },
    ]);
  };

  // Confirm Delete Account
  const handleConfirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, your circle memberships, and all telemetry records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await authService.deleteAccount(backendUrl);
            if (ok) {
              onClose();
              onSignOut();
            } else {
              Alert.alert('Error', 'Could not delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={styles.topDismissArea}
        />
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
            isGlass && (isDark ? styles.darkSheetShadow : styles.lightSheetShadow),
            webGlassCard,
          ]}
        >
          {/* Header Bar */}
          <View style={styles.header}>
            {currentView !== 'main' ? (
              <TouchableOpacity onPress={() => setCurrentView('main')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color={colors.primary} />
                <Text style={[styles.backBtnText, { color: colors.primary }]}>Settings</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.headerTitle, { color: colors.textMain }]}>Settings</Text>
            )}

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Subview Content */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* ========================================================= */}
            {/* 1. ROOT VIEW                                              */}
            {/* ========================================================= */}
            {currentView === 'main' && (
              <>
                {/* Profile Hero Card */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setCurrentView('profile')}
                  style={[styles.profileHeroCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
                >
                  <Avatar name={currentUserName} avatarUrl={currentUserAvatar} size={54} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileHeroName, { color: colors.textMain }]}>{currentUserName}</Text>
                    <Text style={[styles.profileHeroEmail, { color: colors.textMuted }]}>{currentUserEmail || 'No email attached'}</Text>
                    <View style={styles.memberTag}>
                      <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                      <Text style={styles.memberTagText}>PLATINUM ACTIVE</Text>
                    </View>
                  </View>
                  <View style={[styles.editProfilePill, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#F5F3FF' }]}>
                    <Text style={[styles.editProfilePillText, { color: colors.primary }]}>Edit</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </TouchableOpacity>

                {/* Section: Circle & Family */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>CIRCLE & FAMILY</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('circle')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EDE9FE' }]}>
                      <Ionicons name="people" size={18} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Circle Management</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]} numberOfLines={1}>
                        Active: {selectedCircle ? selectedCircle.name : 'None selected'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>

                  {onInviteMembers && (
                    <TouchableOpacity
                      style={[styles.menuRow, { borderBottomWidth: 0 }]}
                      activeOpacity={0.7}
                      onPress={onInviteMembers}
                    >
                      <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#E0F2FE' }]}>
                        <Feather name="user-plus" size={17} color="#0284C7" />
                      </View>
                      <View style={styles.menuTextWrap}>
                        <Text style={[styles.menuTitle, { color: colors.textMain }]}>Invite New Members</Text>
                        <Text style={[styles.menuSub, { color: colors.textMuted }]}>Share circle code with family</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Section: Account & Security */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ACCOUNT & PROFILE</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('profile')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.25)' : '#FEF3C7' }]}>
                      <Ionicons name="person-circle-outline" size={20} color="#D97706" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Edit Profile</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Name, photo upload, phone</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('account')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.25)' : '#FEE2E2' }]}>
                      <Ionicons name="key-outline" size={18} color="#DC2626" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Account & Password</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Security, password, delete account</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section: Features Showcase */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>CARERING FEATURES</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (onOpenFeaturesCatalog) {
                        onOpenFeaturesCatalog();
                      } else {
                        setCurrentView('features');
                      }
                    }}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#ECFDF5' }]}>
                      <Ionicons name="sparkles" size={18} color="#059669" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>All Features Directory</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Explore all 16 safety & tracking capabilities</Text>
                    </View>
                    <View style={styles.badgeFree}>
                      <Text style={styles.badgeFreeText}>FREE</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section: Notifications */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>NOTIFICATIONS & ALERTS</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('notifications')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(219, 39, 119, 0.25)' : '#FDF2F8' }]}>
                      <Ionicons name="notifications-outline" size={18} color="#DB2777" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Push Notifications & Alerts</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Speeding, movement, chat, and geofence alerts</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section: Map & Cartography */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>MAP CARTOGRAPHY & CACHE</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('map')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}>
                      <Ionicons name="map-outline" size={18} color={isDark ? '#94A3B8' : '#475569'} />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Map Cartography Style</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Active: {activeMapStyle.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('offline_cache')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}>
                      <Feather name="database" size={17} color={isDark ? '#94A3B8' : '#475569'} />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Offline Raster Tiles</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                        {cacheStats ? `${cacheStats.count} tiles • ${cacheStats.formattedSize}` : '0 tiles • 0 B'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section: Appearance & Liquid Glass Theme */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>APPEARANCE & THEME</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('theme')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(147, 51, 234, 0.25)' : '#F3E8FF' }]}>
                      <Ionicons name="color-palette-outline" size={18} color="#9333EA" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Theme & Liquid Glass</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                        Active: {ALL_APP_THEMES.find((t) => t.id === selectedThemeId)?.name || 'Light Mode'}
                      </Text>
                    </View>
                    <View style={[styles.themePreviewChip, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}>
                      <Text style={[styles.themePreviewChipText, { color: colors.primary }]}>
                        {selectedThemeId === 'dark-glass' ? 'Dark Glass' : selectedThemeId === 'standard' ? 'Flat UI' : 'Light Glass'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section: Legal & Info */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ABOUT & LEGAL</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('about')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#F5F3FF' }]}>
                      <Ionicons name="information-circle-outline" size={19} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>About Us</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Mission, architecture, and story</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('terms')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#F5F3FF' }]}>
                      <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Terms & Conditions</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Terms of service and safety disclaimers</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('privacy')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#F5F3FF' }]}>
                      <Ionicons name="shield-outline" size={18} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Privacy Policy</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>100% private, zero broker selling</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Sign Out Button */}
                <TouchableOpacity activeOpacity={0.8} onPress={handleConfirmSignOut} style={styles.signOutBtn}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>

                {/* App Version Tag */}
                <Text style={styles.versionFooter}>
                  CareRing Mobile v2.4.0 (Build 2026.09) • Self-Hosted GPS Engine
                </Text>
              </>
            )}

            {/* ========================================================= */}
            {/* 2. EDIT PROFILE VIEW                                      */}
            {/* ========================================================= */}
            {currentView === 'profile' && (
              <View style={styles.subViewContainer}>
                <Text style={styles.subViewTitle}>Edit Profile</Text>
                <Text style={styles.subViewDesc}>
                  Customize how circle members see you on the live map and chat.
                </Text>

                {/* Avatar Preview & Actions */}
                <View style={styles.avatarEditWrap}>
                  <Avatar name={profileName} avatarUrl={profileAvatar} size={84} />
                  <View style={styles.avatarButtonsRow}>
                    <TouchableOpacity onPress={handlePickFromGallery} style={styles.avatarActionBtn}>
                      <Feather name="image" size={15} color={Colors.primary} />
                      <Text style={styles.avatarActionBtnText}>Choose Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleTakeFromCamera} style={styles.avatarActionBtn}>
                      <Feather name="camera" size={15} color={Colors.primary} />
                      <Text style={styles.avatarActionBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                    {profileAvatar && (
                      <TouchableOpacity onPress={handleRemovePhoto} style={styles.avatarRemoveBtn}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                        <Text style={styles.avatarRemoveBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Name Input */}
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  value={profileName}
                  onChangeText={setProfileName}
                  style={styles.textInput}
                  placeholder="Enter full name"
                  placeholderTextColor="#94A3B8"
                />

                {/* Phone Input */}
                <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
                <TextInput
                  value={profilePhone}
                  onChangeText={setProfilePhone}
                  style={styles.textInput}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />

                {/* Save Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                  style={styles.primaryBtn}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save Profile Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* 3. ACCOUNT & PASSWORD VIEW                                */}
            {/* ========================================================= */}
            {currentView === 'account' && (
              <View style={styles.subViewContainer}>
                <Text style={styles.subViewTitle}>Account & Security</Text>
                <Text style={styles.subViewDesc}>
                  Manage your credentials and authentication security.
                </Text>

                {/* Account Details Card */}
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Email Address</Text>
                    <Text style={styles.infoValue}>{currentUserEmail || 'Not configured'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>User ID</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{currentUserId}</Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoKey}>Status</Text>
                    <Text style={[styles.infoValue, { color: '#059669', fontWeight: '800' }]}>
                      Active Platinum
                    </Text>
                  </View>
                </View>

                {/* Change Password Form */}
                <Text style={[styles.sectionHeader, { marginTop: 20 }]}>CHANGE PASSWORD</Text>

                {passwordStatusMsg && (
                  <View
                    style={[
                      styles.statusPill,
                      passwordStatusMsg.error ? styles.statusPillError : styles.statusPillSuccess,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        passwordStatusMsg.error ? { color: '#DC2626' } : { color: '#059669' },
                      ]}
                    >
                      {passwordStatusMsg.text}
                    </Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  style={styles.textInput}
                  placeholder="Enter current password"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  style={styles.textInput}
                  placeholder="Enter new password (min. 4 chars)"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  style={styles.textInput}
                  placeholder="Re-type new password"
                  placeholderTextColor="#94A3B8"
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleChangePassword}
                  disabled={isUpdatingPassword}
                  style={styles.primaryBtn}
                >
                  {isUpdatingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>

                {/* Danger Zone */}
                <Text style={[styles.sectionHeader, { marginTop: 30, color: '#DC2626' }]}>DANGER ZONE</Text>
                <View style={styles.dangerCard}>
                  <Text style={styles.dangerTitle}>Delete Account</Text>
                  <Text style={styles.dangerDesc}>
                    Permanently delete your profile, circles, and telemetry data. This cannot be undone.
                  </Text>
                  <TouchableOpacity
                    onPress={handleConfirmDeleteAccount}
                    style={styles.dangerBtn}
                  >
                    <Text style={styles.dangerBtnText}>Permanently Delete My Account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* 4. CIRCLE MANAGEMENT VIEW                                 */}
            {/* ========================================================= */}
            {currentView === 'circle' && (
              <View style={styles.subViewContainer}>
                <Text style={styles.subViewTitle}>Circle Management</Text>
                <Text style={styles.subViewDesc}>
                  Switch active circles, invite members, or create new family groups.
                </Text>

                {/* Active Circle Details */}
                {selectedCircle ? (
                  <View style={styles.activeCircleCard}>
                    <View style={styles.circleHeaderRow}>
                      <View style={styles.circleAvatar}>
                        <Ionicons name="people" size={24} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activeCircleName}>{selectedCircle.name}</Text>
                        <Text style={styles.activeCircleCode}>Invite Code: {selectedCircle.inviteCode || (selectedCircle as any).invite_code}</Text>
                      </View>
                    </View>

                    {/* Rename Input */}
                    <Text style={styles.inputLabel}>Edit Circle Name</Text>
                    <View style={styles.renameRow}>
                      <TextInput
                        value={editingCircleName}
                        onChangeText={setEditingCircleName}
                        style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                        placeholder="Circle name"
                      />
                      <TouchableOpacity
                        onPress={() => {
                          if (editingCircleName.trim() && onRenameCircle) {
                            onRenameCircle(editingCircleName.trim());
                            Alert.alert('Updated', 'Circle name updated successfully.');
                          }
                        }}
                        style={styles.saveRenameBtn}
                      >
                        <Text style={styles.saveRenameBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: '#64748B', marginBottom: 12 }}>No circle selected.</Text>
                )}

                {/* Circles List */}
                <Text style={styles.sectionHeader}>YOUR CIRCLES ({circles.length})</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  {circles.length === 0 ? (
                    <View style={{ padding: 16 }}>
                      <Text style={{ color: '#64748B', fontSize: 13 }}>You do not belong to any circles yet.</Text>
                    </View>
                  ) : (
                    circles.map((c, idx) => {
                      const isActive = selectedCircle?.id === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.menuRow, idx === circles.length - 1 && { borderBottomWidth: 0 }]}
                          onPress={() => onSelectCircle?.(c)}
                        >
                          <Ionicons
                            name={isActive ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={isActive ? Colors.primary : '#94A3B8'}
                          />
                          <View style={styles.menuTextWrap}>
                            <Text style={[styles.menuTitle, isActive && { color: Colors.primary, fontWeight: '800' }]}>
                              {c.name}
                            </Text>
                            <Text style={styles.menuSub}>Code: {c.inviteCode || (c as any).invite_code}</Text>
                          </View>
                          {isActive && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {/* Circle Actions */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  {onCreateCircle && (
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onCreateCircle();
                      }}
                      style={[styles.actionGridBtn, { backgroundColor: Colors.primary }]}
                    >
                      <Feather name="plus-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.actionGridBtnText}>Create Circle</Text>
                    </TouchableOpacity>
                  )}
                  {onJoinCircle && (
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onJoinCircle();
                      }}
                      style={[styles.actionGridBtn, { backgroundColor: '#F1F5F9' }]}
                    >
                      <Feather name="log-in" size={16} color="#0F172A" />
                      <Text style={[styles.actionGridBtnText, { color: '#0F172A' }]}>Join with Code</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Leave Circle Button */}
                {selectedCircle && onLeaveCircle && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Leave Circle',
                        `Are you sure you want to leave ${selectedCircle.name}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Leave', style: 'destructive', onPress: onLeaveCircle },
                        ]
                      );
                    }}
                    style={styles.leaveCircleBtn}
                  >
                    <Ionicons name="exit-outline" size={16} color="#DC2626" />
                    <Text style={styles.leaveCircleBtnText}>Leave This Circle</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ========================================================= */}
            {/* 5. MAP STYLE VIEW                                         */}
            {/* ========================================================= */}
            {currentView === 'map' && (
              <View style={styles.subViewContainer}>
                <Text style={styles.subViewTitle}>Map Cartography Style</Text>
                <Text style={styles.subViewDesc}>
                  Select your preferred tile rendering style for live location tracking.
                </Text>

                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  {ALL_MAP_STYLES.map((style, idx) => {
                    const isSelected = style.id === activeMapStyle.id;
                    return (
                      <TouchableOpacity
                        key={style.id}
                        activeOpacity={0.8}
                        onPress={() => onSelectMapStyle(style)}
                        style={[
                          styles.menuRow,
                          idx === ALL_MAP_STYLES.length - 1 && { borderBottomWidth: 0 },
                          isSelected && { backgroundColor: '#F5F3FF' },
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? Colors.primary : '#94A3B8'}
                        />
                        <View style={styles.menuTextWrap}>
                          <Text style={[styles.menuTitle, isSelected && { color: Colors.primary, fontWeight: '800' }]}>
                            {style.name}
                          </Text>
                          <Text style={styles.menuSub}>{style.description}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* OFFLINE RASTER TILES & SMART CACHING SUBVIEW              */}
            {/* ========================================================= */}
            {currentView === 'offline_cache' && (
              <View style={styles.subViewContainer}>
                <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Offline Raster Tiles</Text>
                <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
                  On-device hardware tile storage with Smart LFU/LRU eviction and frequent location safeguards.
                </Text>

                {/* Storage Hero Card */}
                <View
                  style={[
                    styles.cacheHeroCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      borderWidth: 1,
                    },
                    webGlassCard,
                  ]}
                >
                  <View style={styles.cacheHeroTop}>
                    <View>
                      <Text style={[styles.cacheHeroLabel, { color: colors.textMuted }]}>STORAGE USED ON DEVICE</Text>
                      <Text style={[styles.cacheHeroSize, { color: colors.textMain }]}>
                        {cacheStats ? cacheStats.formattedSize : '0 B'}
                      </Text>
                    </View>
                    <View style={[styles.cacheStatusBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)', borderColor: isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)' }]}>
                      <View style={styles.cacheGreenDot} />
                      <Text style={[styles.cacheStatusText, { color: isDark ? '#34D399' : '#059669' }]}>
                        {cacheStats && cacheStats.count > 0 ? 'Offline Ready' : 'Empty'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.cacheStatsRow, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }]}>
                    <View style={styles.cacheStatCol}>
                      <Feather name="layers" size={14} color={isDark ? '#A5B4FC' : '#6366F1'} />
                      <Text style={[styles.cacheStatValue, { color: colors.textMain }]}>
                        {cacheStats ? `${cacheStats.count} tiles` : '0 tiles'}
                      </Text>
                    </View>
                    <View style={[styles.cacheStatDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.cacheStatCol}>
                      <Ionicons name="location-outline" size={15} color={isDark ? '#34D399' : '#10B981'} />
                      <Text style={[styles.cacheStatValue, { color: colors.textMain }]}>
                        {frequentLocations?.length || 0} Frequent Spots
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar when downloading */}
                  {isCaching && cacheProgress && (
                    <View style={[styles.cacheProgressWrap, { borderTopColor: colors.divider }]}>
                      <View style={styles.cacheProgressRow}>
                        <Text style={[styles.cacheProgressText, { color: colors.textMain }]} numberOfLines={1}>
                          {cacheProgress.locationName || 'Caching tiles...'}
                        </Text>
                        <Text style={[styles.cacheProgressPct, { color: colors.primary }]}>
                          {cacheProgress.total > 0
                            ? `${Math.min(100, Math.round((cacheProgress.current / cacheProgress.total) * 100))}%`
                            : '0%'}
                        </Text>
                      </View>
                      <View style={[styles.cacheBarBg, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0' }]}>
                        <View
                          style={[
                            styles.cacheBarFill,
                            {
                              backgroundColor: colors.primary,
                              width: `${
                                cacheProgress.total > 0
                                  ? Math.min(100, Math.round((cacheProgress.current / cacheProgress.total) * 100))
                                  : 0
                              }%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.cacheProgressSub, { color: colors.textMuted }]}>
                        {cacheProgress.current} of {cacheProgress.total} tiles downloaded
                      </Text>
                    </View>
                  )}
                </View>

                {/* Smart Caching Controls Card */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SMART CACHING MECHANISM</Text>
                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <View style={[styles.menuRow, { borderBottomColor: colors.divider }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF' }]}>
                      <Ionicons name="sparkles" size={18} color="#818CF8" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Auto-Cache Frequent Spots</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Pre-caches Home, Work & GPS in background</Text>
                    </View>
                    <Switch
                      value={smartConfig.autoCacheFrequent}
                      onValueChange={(val) => {
                        TileCacheService.updateSmartConfig({ autoCacheFrequent: val });
                      }}
                      trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  <View style={[styles.menuRow, { borderBottomColor: colors.divider }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.22)' : '#F0FDF4' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Smart Eviction Protection</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Frequent locations are protected from LRU pruning</Text>
                    </View>
                    <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#EEF2FF', borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#C7D2FE' }]}>
                      <Text style={[styles.badgePillText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>Active</Text>
                    </View>
                  </View>

                  <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#F8FAFC' }]}>
                      <Feather name="pie-chart" size={17} color={isDark ? '#94A3B8' : '#475569'} />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>Storage Quota Limit</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>Smart 60 MB dynamic threshold</Text>
                    </View>
                    <Text style={[styles.quotaValueText, { color: colors.textSecondary }]}>60 MB</Text>
                  </View>
                </View>

                {/* Frequent Locations List */}
                <View style={styles.locHeaderRow}>
                  <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>FREQUENT LOCATIONS SAFEGUARDED</Text>
                  <Text style={[styles.locCountBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF', color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                    {frequentLocations?.length || 0}
                  </Text>
                </View>

                <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  {(!frequentLocations || frequentLocations.length === 0) ? (
                    <View style={styles.emptyLocWrap}>
                      <Ionicons name="navigate-outline" size={28} color={colors.textMuted} />
                      <Text style={[styles.emptyLocText, { color: colors.textMuted }]}>No frequent locations detected yet</Text>
                    </View>
                  ) : (
                    frequentLocations.map((loc, idx) => (
                      <View
                        key={loc.id || `${loc.name}-${idx}`}
                        style={[
                          styles.menuRow,
                          { borderBottomColor: colors.divider },
                          idx === frequentLocations.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#F1F5F9' }]}>
                          <Ionicons
                            name={
                              loc.category === 'home'
                                ? 'home'
                                : loc.category === 'work'
                                ? 'briefcase'
                                : loc.category === 'school'
                                ? 'school'
                                : loc.id === 'my-location'
                                ? 'navigate'
                                : 'location'
                            }
                            size={16}
                            color={colors.primary}
                          />
                        </View>
                        <View style={styles.menuTextWrap}>
                          <Text style={[styles.menuTitle, { color: colors.textMain }]}>{loc.name}</Text>
                          <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} • Zooms 13-16
                          </Text>
                        </View>
                        <View style={[styles.readyBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', borderColor: isDark ? 'rgba(52, 211, 153, 0.4)' : '#A7F3D0' }]}>
                          <Text style={[styles.readyBadgeText, { color: isDark ? '#34D399' : '#059669' }]}>Protected</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* Actions */}
                <View style={styles.cacheActionsCol}>
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, isCaching && styles.disabledBtn]}
                    activeOpacity={0.85}
                    onPress={onCacheAllFrequent}
                    disabled={isCaching}
                  >
                    {isCaching ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Feather name="download-cloud" size={17} color="#FFFFFF" />
                    )}
                    <Text style={styles.primaryActionBtnText}>
                      {isCaching ? 'Downloading Tiles...' : 'Pre-Cache Frequent Locations'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : '#F8FAFC',
                        borderColor: isDark ? 'rgba(129, 140, 248, 0.35)' : '#E2E8F0',
                      },
                      webGlassTile,
                    ]}
                    activeOpacity={0.8}
                    onPress={onCacheCurrentView}
                    disabled={isCaching}
                  >
                    <Ionicons name="expand-outline" size={17} color={isDark ? '#A5B4FC' : colors.primary} />
                    <Text style={[styles.secondaryActionBtnText, { color: isDark ? '#A5B4FC' : colors.primary }]}>Cache Current Map View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.clearStorageBtn,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
                      },
                      webGlassTile,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleClearCache}
                    disabled={isClearingCache || isCaching}
                  >
                    <Feather name="trash-2" size={16} color={isDark ? '#FCA5A5' : '#DC2626'} />
                    <Text style={[styles.clearStorageBtnText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                      {isClearingCache ? 'Clearing Storage...' : 'Free Up All Offline Storage'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Zero Signal Info Note */}
                <View
                  style={[
                    styles.offlineNoteCard,
                    {
                      backgroundColor: isDark ? 'rgba(2, 132, 199, 0.16)' : '#F0F9FF',
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD',
                    },
                    webGlassTile,
                  ]}
                >
                  <Ionicons name="information-circle-outline" size={18} color={isDark ? '#38BDF8' : '#0284C7'} />
                  <Text style={[styles.offlineNoteText, { color: isDark ? '#BAE6FD' : '#0369A1' }]}>
                    Raster map tiles are stored on-device in IndexedDB hardware storage. When driving in rural areas or during network outages, your family's map remains fully readable.
                  </Text>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* THEME & LIQUID GLASS SUBVIEW                             */}
            {/* ========================================================= */}
            {currentView === 'theme' && (
              <View style={styles.subViewContainer}>
                <Text style={[styles.subViewTitle, { color: colors.textMain }]}>App Theme & Liquid Glass</Text>
                <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
                  Customize the visual framework. Select from Apple Liquid Glass (Light & Dark) or Accessible Flat UI.
                </Text>

                <View style={styles.themeListWrap}>
                  {ALL_APP_THEMES.map((theme) => {
                    const isSelected = theme.id === selectedThemeId;
                    return (
                      <TouchableOpacity
                        key={theme.id}
                        activeOpacity={0.85}
                        onPress={() => handleSelectTheme(theme.id)}
                        style={[
                          styles.themeCard,
                          {
                            backgroundColor: colors.tileBg,
                            borderColor: isSelected ? colors.primary : colors.tileBorder,
                          },
                          webGlassTile,
                          isSelected && styles.themeCardSelected,
                        ]}
                      >
                        {/* Theme Header */}
                        <View style={styles.themeCardHeader}>
                          <View style={styles.themeCardIconTitleRow}>
                            <View
                              style={[
                                styles.themeIconCircle,
                                theme.id === 'dark-glass'
                                  ? { backgroundColor: '#0F172A' }
                                  : theme.id === 'standard'
                                  ? { backgroundColor: '#E2E8F0' }
                                  : { backgroundColor: '#EEF2FF' },
                              ]}
                            >
                              <Ionicons
                                name={theme.icon}
                                size={18}
                                color={
                                  theme.id === 'dark-glass'
                                    ? '#38BDF8'
                                    : theme.id === 'standard'
                                    ? '#475569'
                                    : colors.primary
                                }
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.themeTitleBadgeRow}>
                                <Text
                                  style={[
                                    styles.themeCardName,
                                    { color: colors.textMain },
                                    isSelected && { color: colors.primary, fontWeight: '800' },
                                  ]}
                                >
                                  {theme.name}
                                </Text>
                                <View
                                  style={[
                                    styles.themeBadgePill,
                                    theme.id === 'dark-glass'
                                      ? { backgroundColor: '#312E81' }
                                      : theme.id === 'standard'
                                      ? { backgroundColor: '#F1F5F9' }
                                      : { backgroundColor: '#E0E7FF' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.themeBadgePillText,
                                      theme.id === 'dark-glass'
                                        ? { color: '#A5B4FC' }
                                        : theme.id === 'standard'
                                        ? { color: '#475569' }
                                        : { color: colors.primary },
                                    ]}
                                  >
                                    {theme.badge}
                                  </Text>
                                </View>
                              </View>
                              <Text style={[styles.themeTagline, { color: colors.textMuted }]}>{theme.tagline}</Text>
                            </View>
                          </View>

                          {/* Radio Check Indicator */}
                          <View style={styles.themeRadioWrap}>
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={22}
                              color={isSelected ? colors.primary : '#CBD5E1'}
                            />
                          </View>
                        </View>

                        {/* Interactive Visual Mini-Preview Box */}
                        <View style={[styles.themePreviewContainer, { backgroundColor: theme.preview.canvasBg, position: 'relative', overflow: 'hidden' }]}>
                          {theme.id !== 'standard' && (
                            <>
                              <View
                                style={{
                                  position: 'absolute',
                                  top: -10,
                                  right: 15,
                                  width: 60,
                                  height: 60,
                                  borderRadius: 30,
                                  backgroundColor: theme.id === 'dark-glass' ? '#4F46E5' : '#00D2FE',
                                  opacity: 0.55,
                                }}
                              />
                              <View
                                style={{
                                  position: 'absolute',
                                  bottom: -15,
                                  left: 20,
                                  width: 70,
                                  height: 70,
                                  borderRadius: 35,
                                  backgroundColor: theme.id === 'dark-glass' ? '#06B6D4' : '#FF4B72',
                                  opacity: 0.45,
                                }}
                              />
                            </>
                          )}
                          <View
                            style={[
                              styles.themePreviewInnerCard,
                              {
                                backgroundColor: theme.preview.cardBg,
                                borderColor: theme.preview.borderColor,
                                borderWidth: theme.preview.borderWidth,
                              },
                              theme.id !== 'standard' && (Platform.OS === 'web' ? {
                                backdropFilter: 'blur(20px) saturate(200%)',
                                WebkitBackdropFilter: 'blur(20px) saturate(200%)',
                                boxShadow: theme.id === 'dark-glass'
                                  ? 'inset 0 1px 0.8px rgba(255,255,255,0.3), inset 0 0 0 1px rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.35)'
                                  : 'inset 0 1.5px 1.2px rgba(255,255,255,0.95), inset 0 0 0 1px rgba(255,255,255,0.5), 0 4px 14px rgba(31,38,135,0.12)',
                              } as any : {}),
                              theme.preview.hasGlow && styles.themeGlowCard,
                            ]}
                          >
                            <View style={styles.themePreviewTopRow}>
                              <View style={[styles.themeMiniPill, { backgroundColor: theme.preview.pillBg }]}>
                                <Text style={[styles.themeMiniPillText, { color: theme.preview.accentColor }]}>
                                  {theme.id === 'dark-glass'
                                    ? 'Ambient Glow'
                                    : theme.id === 'standard'
                                    ? 'Opaque Flat'
                                    : 'Refractive Glass'}
                                </Text>
                              </View>
                              <Ionicons
                                name={theme.id === 'dark-glass' ? 'sparkles' : 'shield-checkmark'}
                                size={13}
                                color={theme.preview.accentColor}
                              />
                            </View>
                            <Text style={[styles.themePreviewCardTitle, { color: theme.preview.textColor }]}>
                              Family Dashboard
                            </Text>
                            <Text style={[styles.themePreviewCardDesc, { color: theme.preview.subtextColor }]}>
                              {theme.id === 'standard'
                                ? 'Solid 100% opaque container • Zero transparency'
                                : '1px specular edge highlight • Translucent refraction'}
                            </Text>
                          </View>
                        </View>

                        {/* Detailed Description */}
                        <Text style={styles.themeDescriptionText}>{theme.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ========================================================= */}
                {/* LIQUID GLASS REAL-TIME CUSTOMIZER CONTROLS               */}
                {/* ========================================================= */}
                <View
                  style={[
                    styles.customizerSection,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                    },
                    webGlassCard,
                  ]}
                >
                  <View style={styles.customizerHeaderRow}>
                    <View style={styles.customizerTitleGroup}>
                      <View
                        style={[
                          styles.customizerIconBadge,
                          {
                            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#EDE9FE',
                          },
                        ]}
                      >
                        <Ionicons
                          name="options-outline"
                          size={18}
                          color={isDark ? '#38BDF8' : '#7C3AED'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.customizerTitle, { color: colors.textMain }]}>
                          Liquid Glass Fine-Tuning
                        </Text>
                        <Text style={[styles.customizerSub, { color: colors.textSecondary }]}>
                          Adjust optical refraction, blur, and edge highlights in real time
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={resetGlassConfig}
                      style={[
                        styles.resetConfigBtn,
                        {
                          backgroundColor: colors.tileBg,
                          borderColor: colors.tileBorder,
                          borderWidth: 1,
                        },
                        webGlassTile,
                      ]}
                    >
                      <Feather name="rotate-ccw" size={13} color={colors.primary} />
                      <Text style={[styles.resetConfigBtnText, { color: colors.primary }]}>Reset</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Interactive Live Refraction Stage Card */}
                  <View
                    style={[
                      styles.liveStageCanvas,
                      {
                        backgroundColor: isDark ? '#040711' : '#F1F5F9',
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    {/* Simulated background orbs */}
                    <View
                      style={[
                        styles.stageAmbientOrb,
                        { backgroundColor: isDark ? '#818CF8' : '#38BDF8', opacity: 0.35 },
                      ]}
                    />
                    <View
                      style={[
                        styles.stageAmbientOrbTwo,
                        { backgroundColor: isDark ? '#06B6D4' : '#F43F5E', opacity: 0.25 },
                      ]}
                    />

                    {/* The Live Glass Card */}
                    <View
                      style={[
                        styles.stageGlassCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.cardBorder,
                        },
                        isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                      ]}
                    >
                      <View style={styles.stageGlassHeader}>
                        <View style={styles.stageGlassDotRow}>
                          <View style={[styles.stageDot, { backgroundColor: '#EF4444' }]} />
                          <View style={[styles.stageDot, { backgroundColor: '#F59E0B' }]} />
                          <View style={[styles.stageDot, { backgroundColor: '#10B981' }]} />
                        </View>
                        <Text style={[styles.stageGlassStatus, { color: colors.primary }]}>
                          Live Glass Specimen
                        </Text>
                      </View>

                      <Text style={[styles.stageGlassHeadline, { color: colors.textMain }]}>
                        Apple Liquid Glass
                      </Text>
                      <Text style={[styles.stageGlassSub, { color: colors.textSecondary }]}>
                        Diffusion: {glassConfig.blurIntensity}px • Opacity: {glassConfig.opacityPercent}% • Edge: {glassConfig.borderGlow}
                      </Text>

                      <View style={styles.stageTagRow}>
                        <View
                          style={[
                            styles.stageGlassTag,
                            {
                              backgroundColor: isDark
                                ? 'rgba(56, 189, 248, 0.15)'
                                : 'rgba(79, 70, 229, 0.1)',
                            },
                          ]}
                        >
                          <Text style={[styles.stageGlassTagText, { color: colors.primary }]}>
                            {glassConfig.tintColor.toUpperCase()} TINT
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.stageGlassTag,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.05)',
                            },
                          ]}
                        >
                          <Text style={[styles.stageGlassTagText, { color: colors.textSecondary }]}>
                            {glassConfig.borderGlow === 'neon' ? 'NEON LUMINESCENCE' : 'SPECULAR BEVEL'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* 1. Translucency / Opacity Slider Stepper */}
                  <View style={styles.controlGroup}>
                    <View style={styles.controlHeaderRow}>
                      <Text style={[styles.controlLabel, { color: colors.textMain }]}>
                        Backed Scrim Depth
                      </Text>
                      <Text style={[styles.controlValueBadge, { color: colors.primary }]}>
                        {glassConfig.opacityPercent}%
                      </Text>
                    </View>
                    <View style={styles.pillRow}>
                      {[
                        { label: 'Clear', val: 40 },
                        { label: 'Airy', val: 60 },
                        { label: 'Frosted', val: 78 },
                        { label: 'Backed', val: 95 },
                      ].map((item) => {
                        const isAct = Math.abs(glassConfig.opacityPercent - item.val) < 5;
                        return (
                          <TouchableOpacity
                            key={item.label}
                            activeOpacity={0.75}
                            onPress={() => updateGlassConfig({ opacityPercent: item.val })}
                            style={[
                              styles.configPill,
                              {
                                backgroundColor: isAct ? colors.primary : colors.tileBg,
                                borderColor: isAct ? colors.primary : colors.tileBorder,
                              },
                              !isAct && webGlassPill,
                            ]}
                          >
                            <Text
                              style={[
                                styles.configPillText,
                                {
                                  color: isAct ? '#FFFFFF' : colors.textSecondary,
                                  fontWeight: isAct ? '800' : '600',
                                },
                              ]}
                            >
                              {item.label} ({item.val}%)
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 2. Refractive Gaussian Blur Intensity */}
                  <View style={styles.controlGroup}>
                    <View style={styles.controlHeaderRow}>
                      <Text style={[styles.controlLabel, { color: colors.textMain }]}>
                        Frosted Blur Depth
                      </Text>
                      <Text style={[styles.controlValueBadge, { color: colors.primary }]}>
                        {glassConfig.blurIntensity}px
                      </Text>
                    </View>
                    <View style={styles.pillRow}>
                      {[
                        { label: 'Thin', val: 35 },
                        { label: 'Natural', val: 55 },
                        { label: 'Rich', val: 70 },
                        { label: 'Deep', val: 90 },
                      ].map((item) => {
                        const isAct = Math.abs(glassConfig.blurIntensity - item.val) < 6;
                        return (
                          <TouchableOpacity
                            key={item.label}
                            activeOpacity={0.75}
                            onPress={() => updateGlassConfig({ blurIntensity: item.val })}
                            style={[
                              styles.configPill,
                              {
                                backgroundColor: isAct ? colors.primary : colors.tileBg,
                                borderColor: isAct ? colors.primary : colors.tileBorder,
                              },
                              !isAct && webGlassPill,
                            ]}
                          >
                            <Text
                              style={[
                                styles.configPillText,
                                {
                                  color: isAct ? '#FFFFFF' : colors.textSecondary,
                                  fontWeight: isAct ? '800' : '600',
                                },
                              ]}
                            >
                              {item.label} ({item.val})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 3. Specular Edge Highlight Style */}
                  <View style={styles.controlGroup}>
                    <View style={styles.controlHeaderRow}>
                      <Text style={[styles.controlLabel, { color: colors.textMain }]}>
                        Specular Edge Refraction
                      </Text>
                      <Text style={[styles.controlValueBadge, { color: colors.primary }]}>
                        {glassConfig.borderGlow}
                      </Text>
                    </View>
                    <View style={styles.pillRow}>
                      {[
                        { id: 'subtle' as const, label: 'Soft Edge' },
                        { id: 'crisp' as const, label: 'Crisp (Apple)' },
                        { id: 'neon' as const, label: 'Neon Refract' },
                      ].map((item) => {
                        const isAct = glassConfig.borderGlow === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.75}
                            onPress={() => updateGlassConfig({ borderGlow: item.id })}
                            style={[
                              styles.configPill,
                              {
                                backgroundColor: isAct ? colors.primary : colors.tileBg,
                                borderColor: isAct ? colors.primary : colors.tileBorder,
                              },
                              !isAct && webGlassPill,
                            ]}
                          >
                            <Text
                              style={[
                                styles.configPillText,
                                {
                                  color: isAct ? '#FFFFFF' : colors.textSecondary,
                                  fontWeight: isAct ? '800' : '600',
                                },
                              ]}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 4. Refraction Ambient Tint */}
                  <View style={styles.controlGroup}>
                    <View style={styles.controlHeaderRow}>
                      <Text style={[styles.controlLabel, { color: colors.textMain }]}>
                        Chromatic Refraction Tint
                      </Text>
                      <Text style={[styles.controlValueBadge, { color: colors.primary }]}>
                        {glassConfig.tintColor}
                      </Text>
                    </View>
                    <View style={styles.tintSwatchesRow}>
                      {[
                        { id: 'default' as const, name: 'Default', hex: isDark ? '#818CF8' : '#4F46E5' },
                        { id: 'cyan' as const, name: 'Cyan', hex: '#00D2FE' },
                        { id: 'violet' as const, name: 'Violet', hex: '#8B5CF6' },
                        { id: 'amber' as const, name: 'Amber', hex: '#F59E0B' },
                        { id: 'emerald' as const, name: 'Emerald', hex: '#10B981' },
                      ].map((swatch) => {
                        const isAct = glassConfig.tintColor === swatch.id;
                        return (
                          <TouchableOpacity
                            key={swatch.id}
                            activeOpacity={0.8}
                            onPress={() => updateGlassConfig({ tintColor: swatch.id })}
                            style={[
                              styles.tintSwatchBtn,
                              {
                                backgroundColor: isAct
                                  ? (isDark ? 'rgba(99, 102, 241, 0.28)' : 'rgba(99, 102, 241, 0.12)')
                                  : (isDark ? 'rgba(30, 41, 59, 0.7)' : colors.tileBg),
                                borderColor: isAct ? swatch.hex : colors.tileBorder,
                                borderWidth: isAct ? 2 : 1,
                              },
                              !isAct && webGlassTile,
                            ]}
                          >
                            <View style={[styles.tintSwatchCircle, { backgroundColor: swatch.hex }]} />
                            <Text
                              style={[
                                styles.tintSwatchText,
                                {
                                  color: isAct ? colors.textMain : colors.textSecondary,
                                  fontWeight: isAct ? '800' : '500',
                                },
                              ]}
                            >
                              {swatch.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* 6. ABOUT US VIEW                                          */}
            {/* ========================================================= */}
            {currentView === 'about' && (
              <View style={styles.subViewContainer}>
                <Text style={[styles.subViewTitle, { color: colors.textMain }]}>About CareRing</Text>
                <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
                  Private, reliable real-time family safety and location network.
                </Text>

                <View style={[styles.editorialCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>Our Mission</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    CareRing is engineered from the ground up to give families complete peace of mind through precise real-time location sharing, responsive driving insights, and emergency safety tools.
                  </Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    Built on an open, privacy-centric architecture, CareRing ensures your location data remains private, secure, and under your control at all times with zero data monetization.
                  </Text>

                  <Text style={[styles.editorialHeader, { color: colors.textMain, marginTop: 14 }]}>Core Architectural Pillars</Text>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: '700', color: colors.textMain }}>Zero Data Monetization:</Text> Your GPS breadcrumbs and sensor logs are stored securely in your private PostgreSQL database.
                    </Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: '700', color: colors.textMain }}>High-Precision Telemetry:</Text> Sub-100ms real-time WebSocket communication and adaptive sensor fusion.
                    </Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: '700', color: colors.textMain }}>Complete Safety Suite:</Text> 30-day location history, automatic crash detection, unlimited geofences, and driving scores included out of the box.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* 7. TERMS & CONDITIONS VIEW                                */}
            {/* ========================================================= */}
            {currentView === 'terms' && (
              <View style={styles.subViewContainer}>
                <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Terms and Conditions</Text>
                <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>Last updated: September 2026</Text>

                <View style={[styles.editorialCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>1. Acceptance of Terms</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    By creating an account or accessing the CareRing mobile application, you agree to these Terms and Conditions. CareRing is intended exclusively for family safety, mutual coordination, and personal device tracking.
                  </Text>

                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>2. Location Services & Device Permissions</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    CareRing relies on continuous GPS, accelerometer, and network permissions to provide live positioning, crash detection, and geofence alerts. Accuracy depends on satellite geometry and device battery optimization settings.
                  </Text>

                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>3. Emergency SOS & Roadside Disclaimer</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    CareRing SOS and 24/7 Roadside Assistance are personal notification utilities designed to notify designated circle members. They do not replace government public emergency response services (e.g. 911 or 112).
                  </Text>

                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>4. Mutual Consent & Acceptable Use</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    All members in a Circle must consent to location sharing. You agree not to use CareRing for unauthorized surveillance, harassment, or unlawful tracking.
                  </Text>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* 8. PRIVACY POLICY VIEW                                    */}
            {/* ========================================================= */}
            {currentView === 'privacy' && (
              <View style={styles.subViewContainer}>
                <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Privacy Policy</Text>
                <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>Transparent, self-hosted, and 100% private.</Text>

                <View style={[styles.editorialCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>1. Zero Commercial Data Brokering</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    CareRing will NEVER sell, rent, monetize, or share your GPS coordinates, travel routes, driving telemetry, or member information with advertisers or data brokers.
                  </Text>

                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>2. Information We Store</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    We only store data essential to deliver real-time features:
                  </Text>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>GPS Coordinates (latitude, longitude, speed, heading, altitude)</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>Device Telemetry (battery percentage, charging status, sensor g-force)</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>Account profile (name, optional avatar, optional phone number)</Text>
                  </View>

                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>3. Privacy Bubbles</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    You maintain complete autonomy over your privacy. Activating a Privacy Bubble cloaks your exact position with a customized radius for your chosen duration.
                  </Text>

                  <Text style={[styles.editorialHeader, { color: colors.textMain }]}>4. Right to Erasure</Text>
                  <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                    You may purge your telemetry history or delete your entire account at any time from Account Settings. Deletion is instantaneous and permanent.
                  </Text>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* NOTIFICATIONS SUBVIEW                                     */}
            {/* ========================================================= */}
            {/* ========================================================= */}
            {/* NOTIFICATIONS SUBVIEW                                     */}
            {/* ========================================================= */}
            {currentView === 'notifications' && (
              <View style={styles.subViewContainer}>
                <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Notifications & Alerts</Text>
                <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
                  Manage push notifications for high speeding, movement, chat, and place arrivals.
                </Text>

                {/* Master Push Toggle */}
                <View style={[styles.notifCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <View style={styles.notifRow}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.22)' : '#F5F3FF' }]}>
                      <Ionicons name="notifications" size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.notifTextWrap}>
                      <Text style={[styles.notifTitle, { color: colors.textMain }]}>Push Notifications</Text>
                      <Text style={[styles.notifSub, { color: colors.textMuted }]}>Receive immediate safety and message banners</Text>
                    </View>
                    <Switch
                      value={notifPrefs.enabled}
                      onValueChange={(val) => handleToggleNotif('enabled', val)}
                      trackColor={{ true: Colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                    />
                  </View>
                </View>

                {/* Safety & Driving Alerts */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SAFETY & DRIVING</Text>
                <View style={[styles.notifCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <View style={styles.notifRow}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEF2F2' }]}>
                      <Ionicons name="speedometer" size={19} color="#DC2626" />
                    </View>
                    <View style={styles.notifTextWrap}>
                      <Text style={[styles.notifTitle, { color: colors.textMain }]}>High Speeding Alerts</Text>
                      <Text style={[styles.notifSub, { color: colors.textMuted }]}>
                        Notify when a family member drives above {notifPrefs.speedThresholdKmH} km/h
                      </Text>
                    </View>
                    <Switch
                      value={notifPrefs.speedingAlerts}
                      disabled={!notifPrefs.enabled}
                      onValueChange={(val) => handleToggleNotif('speedingAlerts', val)}
                      trackColor={{ true: '#DC2626', false: isDark ? '#334155' : '#CBD5E1' }}
                    />
                  </View>

                  {/* Speed Threshold Selector Pills */}
                  {notifPrefs.speedingAlerts && (
                    <View style={[styles.thresholdContainer, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#F8FAFC', borderTopColor: colors.tileBorder }]}>
                      <Text style={[styles.thresholdLabel, { color: colors.textMuted }]}>ALERT TRIGGER THRESHOLD</Text>
                      <View style={styles.thresholdPillsRow}>
                        {[70, 80, 90, 100].map((speed) => {
                          const isAct = notifPrefs.speedThresholdKmH === speed;
                          return (
                            <TouchableOpacity
                              key={speed}
                              activeOpacity={0.8}
                              onPress={() => handleToggleNotif('speedThresholdKmH', speed)}
                              style={[
                                styles.thresholdPill,
                                {
                                  backgroundColor: isAct ? '#DC2626' : colors.tileBg,
                                  borderColor: isAct ? '#DC2626' : colors.tileBorder,
                                },
                                !isAct && webGlassPill,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.thresholdPillText,
                                  isAct && styles.thresholdPillTextActive,
                                ]}
                              >
                                {speed} km/h
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View style={[styles.notifRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.22)' : '#EFF6FF' }]}>
                      <Ionicons name="car-sport" size={19} color="#3B82F6" />
                    </View>
                    <View style={styles.notifTextWrap}>
                      <Text style={[styles.notifTitle, { color: colors.textMain }]}>Movement & Drive Detection</Text>
                      <Text style={[styles.notifSub, { color: colors.textMuted }]}>Alert when a family member begins driving</Text>
                    </View>
                    <Switch
                      value={notifPrefs.movementAlerts}
                      disabled={!notifPrefs.enabled}
                      onValueChange={(val) => handleToggleNotif('movementAlerts', val)}
                      trackColor={{ true: '#2563EB', false: isDark ? '#334155' : '#CBD5E1' }}
                    />
                  </View>
                </View>

                {/* Communication & Places */}
                <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>COMMUNICATION & PLACES</Text>
                <View style={[styles.notifCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
                  <View style={styles.notifRow}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.22)' : '#F5F3FF' }]}>
                      <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.notifTextWrap}>
                      <Text style={[styles.notifTitle, { color: colors.textMain }]}>Chat & Direct Messages</Text>
                      <Text style={[styles.notifSub, { color: colors.textMuted }]}>Instant banner when a family message arrives</Text>
                    </View>
                    <Switch
                      value={notifPrefs.chatAlerts}
                      disabled={!notifPrefs.enabled}
                      onValueChange={(val) => handleToggleNotif('chatAlerts', val)}
                      trackColor={{ true: Colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                    />
                  </View>

                  <View style={[styles.notifRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.22)' : '#ECFDF5' }]}>
                      <Ionicons name="location" size={18} color="#10B981" />
                    </View>
                    <View style={styles.notifTextWrap}>
                      <Text style={[styles.notifTitle, { color: colors.textMain }]}>Place Arrivals & Departures</Text>
                      <Text style={[styles.notifSub, { color: colors.textMuted }]}>Geofence transitions (Home, School, Work)</Text>
                    </View>
                    <Switch
                      value={notifPrefs.geofenceAlerts}
                      disabled={!notifPrefs.enabled}
                      onValueChange={(val) => handleToggleNotif('geofenceAlerts', val)}
                      trackColor={{ true: '#10B981', false: isDark ? '#334155' : '#CBD5E1' }}
                    />
                  </View>

                  <View style={[styles.notifRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEF2F2' }]}>
                      <Ionicons name="warning" size={18} color="#DC2626" />
                    </View>
                    <View style={styles.notifTextWrap}>
                      <Text style={[styles.notifTitle, { color: colors.textMain }]}>Emergency SOS Broadcasts</Text>
                      <Text style={[styles.notifSub, { color: colors.textMuted }]}>High-priority distress alerts</Text>
                    </View>
                    <Switch
                      value={notifPrefs.sosAlerts}
                      disabled={!notifPrefs.enabled}
                      onValueChange={(val) => handleToggleNotif('sosAlerts', val)}
                      trackColor={{ true: '#DC2626', false: isDark ? '#334155' : '#CBD5E1' }}
                    />
                  </View>
                </View>

                {/* Sound & Haptics */}
                <Text style={styles.sectionHeader}>SOUND & HAPTICS</Text>
                <View style={styles.notifCard}>
                  <View style={styles.notifRow}>
                    <View style={[styles.menuIconCircle, { backgroundColor: '#F8FAFC' }]}>
                      <Ionicons name="volume-high" size={18} color="#475569" />
                    </View>
                    <View style={styles.notifTextWrap}>
                      <Text style={styles.notifTitle}>Play Alert Sound</Text>
                      <Text style={styles.notifSub}>Audible chime on alert arrival</Text>
                    </View>
                    <Switch
                      value={notifPrefs.soundEnabled}
                      disabled={!notifPrefs.enabled}
                      onValueChange={(val) => handleToggleNotif('soundEnabled', val)}
                      trackColor={{ true: Colors.primary, false: '#CBD5E1' }}
                    />
                  </View>
                </View>

                {/* Test Notification Trigger */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleTestNotif}
                  style={styles.testNotifBtn}
                >
                  <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                  <Text style={styles.testNotifBtnText}>Send Test Push Notification</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  topDismissArea: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '90%',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    overflow: 'hidden',
  },
  lightSheetShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },
  darkSheetShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  profileHeroName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileHeroEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  memberTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  memberTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editProfilePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#94A3B8',
    marginBottom: 8,
    marginTop: 10,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    gap: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badgeFree: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  badgeFreeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  clearBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  versionFooter: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  subViewContainer: {
    paddingVertical: 4,
  },
  subViewTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  subViewDesc: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 16,
    lineHeight: 17,
  },
  avatarEditWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  avatarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  avatarActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  avatarRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  avatarRemoveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoKey: {
    fontSize: 12,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '65%',
  },
  statusPill: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  statusPillError: {
    backgroundColor: '#FEE2E2',
  },
  statusPillSuccess: {
    backgroundColor: '#ECFDF5',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dangerCard: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 16,
    padding: 14,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#BE123C',
  },
  dangerDesc: {
    fontSize: 11,
    color: '#9F1239',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 15,
  },
  dangerBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeCircleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  circleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  circleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircleName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeCircleCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  renameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveRenameBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRenameBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  actionGridBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionGridBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaveCircleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  leaveCircleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  editorialCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  editorialHeader: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 6,
  },
  editorialBody: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    color: Colors.primary,
  },
  bulletText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  notifCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  notifTextWrap: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notifSub: {
    fontSize: 12,
    marginTop: 2,
  },
  thresholdContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  thresholdLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  thresholdPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  thresholdPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thresholdPillActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  thresholdPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  thresholdPillTextActive: {
    color: '#FFFFFF',
  },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  testNotifBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Offline Cache Subview Styles
  cacheHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  cacheHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cacheHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cacheHeroSize: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cacheStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cacheGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  cacheStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  cacheStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cacheStatCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cacheStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 10,
  },
  cacheStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  cacheProgressWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cacheProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cacheProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    flex: 1,
    marginRight: 8,
  },
  cacheProgressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818CF8',
  },
  cacheBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  cacheBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  cacheProgressSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  quotaValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  locHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 6,
  },
  emptyLocWrap: {
    padding: 22,
    alignItems: 'center',
  },
  emptyLocText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
  },
  readyBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  cacheActionsCol: {
    gap: 10,
    marginTop: 6,
    marginBottom: 16,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearStorageBtn: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  clearStorageBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  offlineNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  offlineNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  themePreviewChip: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  themePreviewChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9333EA',
  },
  themeListWrap: {
    gap: 14,
    marginBottom: 24,
  },
  themeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  themeCardSelected: {
    borderColor: Colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  themeCardIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  themeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  themeCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  themeBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  themeBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  themeTagline: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  themeRadioWrap: {
    marginLeft: 4,
  },
  themePreviewContainer: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  themePreviewInnerCard: {
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  themeGlowCard: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  themePreviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  themeMiniPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  themeMiniPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  themePreviewCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  themePreviewCardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  themeDescriptionText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  customizerSection: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    marginTop: 8,
    marginBottom: 26,
  },
  customizerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  customizerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  customizerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customizerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  customizerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  resetConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resetConfigBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  liveStageCanvas: {
    borderRadius: 18,
    height: 150,
    borderWidth: 1.5,
    padding: 14,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 18,
  },
  stageAmbientOrb: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  stageAmbientOrbTwo: {
    position: 'absolute',
    bottom: -30,
    right: -20,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  stageGlassCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
  },
  stageGlassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stageGlassDotRow: {
    flexDirection: 'row',
    gap: 5,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageGlassStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stageGlassHeadline: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  stageGlassSub: {
    fontSize: 11,
    marginBottom: 8,
  },
  stageTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stageGlassTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stageGlassTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  controlGroup: {
    marginBottom: 16,
  },
  controlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  controlValueBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  configPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  configPillText: {
    fontSize: 12,
  },
  tintSwatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tintSwatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tintSwatchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  tintSwatchText: {
    fontSize: 12,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
});
