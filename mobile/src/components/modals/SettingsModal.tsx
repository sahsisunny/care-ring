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
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { MapStyleConfig, ALL_MAP_STYLES } from '../../models/MapStyle';
import { TileCacheService, CacheStats } from '../../services/TileCacheService';
import { Colors } from '../../theme/colors';
import { Avatar } from '../Avatar';
import { Circle } from '../../models/Circle';
import { authService } from '../../services/AuthService';

export type SettingsSubView =
  | 'main'
  | 'profile'
  | 'account'
  | 'circle'
  | 'map'
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
  onTriggerFeature?: (actionId: string) => void;
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
  onTriggerFeature,
  onSignOut,
  onDeleteAccount,
}) => {
  const [currentView, setCurrentView] = useState<SettingsSubView>('main');

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

  // Cache stats
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

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
      TileCacheService.getCacheStats().then(setCacheStats);
    }
  }, [visible, currentUserName, currentUserPhone, currentUserAvatar, selectedCircle]);

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
    await TileCacheService.clearCache();
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
        <View style={styles.sheetCard}>
          {/* Header Bar */}
          <View style={styles.header}>
            {currentView !== 'main' ? (
              <TouchableOpacity onPress={() => setCurrentView('main')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color={Colors.primary} />
                <Text style={styles.backBtnText}>Settings</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.headerTitle}>Settings</Text>
            )}

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
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
                  style={styles.profileHeroCard}
                >
                  <Avatar name={currentUserName} avatarUrl={currentUserAvatar} size={54} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileHeroName}>{currentUserName}</Text>
                    <Text style={styles.profileHeroEmail}>{currentUserEmail || 'No email attached'}</Text>
                    <View style={styles.memberTag}>
                      <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                      <Text style={styles.memberTagText}>PLATINUM ACTIVE</Text>
                    </View>
                  </View>
                  <View style={styles.editProfilePill}>
                    <Text style={styles.editProfilePillText}>Edit</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                  </View>
                </TouchableOpacity>

                {/* Section: Circle & Family */}
                <Text style={styles.sectionHeader}>CIRCLE & FAMILY</Text>
                <View style={styles.menuCard}>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('circle')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#EDE9FE' }]}>
                      <Ionicons name="people" size={18} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>Circle Management</Text>
                      <Text style={styles.menuSub} numberOfLines={1}>
                        Active: {selectedCircle ? selectedCircle.name : 'None selected'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  {onInviteMembers && (
                    <TouchableOpacity
                      style={[styles.menuRow, { borderBottomWidth: 0 }]}
                      activeOpacity={0.7}
                      onPress={onInviteMembers}
                    >
                      <View style={[styles.menuIconCircle, { backgroundColor: '#E0F2FE' }]}>
                        <Feather name="user-plus" size={17} color="#0284C7" />
                      </View>
                      <View style={styles.menuTextWrap}>
                        <Text style={styles.menuTitle}>Invite New Members</Text>
                        <Text style={styles.menuSub}>Share circle code with family</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Section: Account & Security */}
                <Text style={styles.sectionHeader}>ACCOUNT & PROFILE</Text>
                <View style={styles.menuCard}>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('profile')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="person-circle-outline" size={20} color="#D97706" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>Edit Profile</Text>
                      <Text style={styles.menuSub}>Name, photo upload, phone</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('account')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="key-outline" size={18} color="#DC2626" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>Account & Password</Text>
                      <Text style={styles.menuSub}>Security, password, delete account</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>

                {/* Section: Features Showcase */}
                <Text style={styles.sectionHeader}>CARERING PLATINUM FEATURES</Text>
                <View style={styles.menuCard}>
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
                    <View style={[styles.menuIconCircle, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="sparkles" size={18} color="#059669" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>All Features Directory</Text>
                      <Text style={styles.menuSub}>18 Unlocked Life360 Platinum features</Text>
                    </View>
                    <View style={styles.badgeFree}>
                      <Text style={styles.badgeFreeText}>FREE</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>

                {/* Section: Map & Cartography */}
                <Text style={styles.sectionHeader}>MAP CARTOGRAPHY & CACHE</Text>
                <View style={styles.menuCard}>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('map')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#F1F5F9' }]}>
                      <Ionicons name="map-outline" size={18} color="#475569" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>Map Cartography Style</Text>
                      <Text style={styles.menuSub}>Active: {activeMapStyle.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.menuIconCircle, { backgroundColor: '#F1F5F9' }]}>
                      <Feather name="database" size={17} color="#475569" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>Offline Raster Tiles</Text>
                      <Text style={styles.menuSub}>
                        {cacheStats ? `${cacheStats.count} tiles • ${cacheStats.formattedSize}` : 'Calculating...'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleClearCache}
                      disabled={isClearingCache}
                      style={styles.clearBtn}
                    >
                      <Text style={styles.clearBtnText}>{isClearingCache ? '...' : 'Clear'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Section: Legal & Info */}
                <Text style={styles.sectionHeader}>ABOUT & LEGAL</Text>
                <View style={styles.menuCard}>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('about')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#F5F3FF' }]}>
                      <Ionicons name="information-circle-outline" size={19} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>About Us</Text>
                      <Text style={styles.menuSub}>Mission, architecture, and story</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('terms')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#F5F3FF' }]}>
                      <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>Terms & Conditions</Text>
                      <Text style={styles.menuSub}>Terms of service and safety disclaimers</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCurrentView('privacy')}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: '#F5F3FF' }]}>
                      <Ionicons name="shield-outline" size={18} color="#7C3AED" />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={styles.menuTitle}>Privacy Policy</Text>
                      <Text style={styles.menuSub}>100% private, zero broker selling</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
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
                <View style={styles.menuCard}>
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

                <View style={styles.menuCard}>
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
            {/* 6. ABOUT US VIEW                                          */}
            {/* ========================================================= */}
            {currentView === 'about' && (
              <View style={styles.subViewContainer}>
                <Text style={styles.subViewTitle}>About CareRing</Text>
                <Text style={styles.subViewDesc}>
                  The self-hosted, privacy-first family safety alternative.
                </Text>

                <View style={styles.editorialCard}>
                  <Text style={styles.editorialHeader}>Why CareRing Exists</Text>
                  <Text style={styles.editorialBody}>
                    Commercial family tracking platforms like Life360 lock essential safety tools behind costly $24.99/month subscriptions and sell family spatiotemporal movement data to third-party data brokers and advertisers.
                  </Text>
                  <Text style={styles.editorialBody}>
                    CareRing was engineered as an open, private, self-hosted family safety network where your location data belongs entirely to you.
                  </Text>

                  <Text style={[styles.editorialHeader, { marginTop: 14 }]}>Core Architectural Pillars</Text>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>
                      <Text style={{ fontWeight: '700' }}>Zero Data Brokering:</Text> Your GPS breadcrumbs and sensor logs are stored in your own PostgreSQL database.
                    </Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>
                      <Text style={{ fontWeight: '700' }}>High-Precision Telemetry:</Text> Sub-100ms real-time WebSocket communication and adaptive sensor fusion.
                    </Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>
                      <Text style={{ fontWeight: '700' }}>Unlocked Platinum:</Text> 30-day breadcrumbs, automatic crash detection, unlimited geofences, and driving scores are 100% free forever.
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
                <Text style={styles.subViewTitle}>Terms and Conditions</Text>
                <Text style={styles.subViewDesc}>Last updated: September 2026</Text>

                <View style={styles.editorialCard}>
                  <Text style={styles.editorialHeader}>1. Acceptance of Terms</Text>
                  <Text style={styles.editorialBody}>
                    By creating an account or accessing the CareRing mobile application, you agree to these Terms and Conditions. CareRing is intended exclusively for family safety, mutual coordination, and personal device tracking.
                  </Text>

                  <Text style={styles.editorialHeader}>2. Location Services & Device Permissions</Text>
                  <Text style={styles.editorialBody}>
                    CareRing relies on continuous GPS, accelerometer, and network permissions to provide live positioning, crash detection, and geofence alerts. Accuracy depends on satellite geometry and device battery optimization settings.
                  </Text>

                  <Text style={styles.editorialHeader}>3. Emergency SOS & Roadside Disclaimer</Text>
                  <Text style={styles.editorialBody}>
                    CareRing SOS and 24/7 Roadside Assistance are personal notification utilities designed to notify designated circle members. They do not replace government public emergency response services (e.g. 911 or 112).
                  </Text>

                  <Text style={styles.editorialHeader}>4. Mutual Consent & Acceptable Use</Text>
                  <Text style={styles.editorialBody}>
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
                <Text style={styles.subViewTitle}>Privacy Policy</Text>
                <Text style={styles.subViewDesc}>Transparent, self-hosted, and 100% private.</Text>

                <View style={styles.editorialCard}>
                  <Text style={styles.editorialHeader}>1. Zero Commercial Data Brokering</Text>
                  <Text style={styles.editorialBody}>
                    CareRing will NEVER sell, rent, monetize, or share your GPS coordinates, travel routes, driving telemetry, or member information with advertisers or data brokers.
                  </Text>

                  <Text style={styles.editorialHeader}>2. Information We Store</Text>
                  <Text style={styles.editorialBody}>
                    We only store data essential to deliver real-time features:
                  </Text>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>GPS Coordinates (latitude, longitude, speed, heading, altitude)</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>Device Telemetry (battery percentage, charging status, sensor g-force)</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>Account profile (name, optional avatar, optional phone number)</Text>
                  </View>

                  <Text style={styles.editorialHeader}>3. Privacy Bubbles</Text>
                  <Text style={styles.editorialBody}>
                    You maintain complete autonomy over your privacy. Activating a Privacy Bubble cloaks your exact position with a customized radius for your chosen duration.
                  </Text>

                  <Text style={styles.editorialHeader}>4. Right to Erasure</Text>
                  <Text style={styles.editorialBody}>
                    You may purge your telemetry history or delete your entire account at any time from Account Settings. Deletion is instantaneous and permanent.
                  </Text>
                </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginBottom: 16,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    color: '#0F172A',
  },
  subViewDesc: {
    fontSize: 12,
    color: '#64748B',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  editorialHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    marginTop: 6,
  },
  editorialBody: {
    fontSize: 12,
    color: '#475569',
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
    color: '#475569',
    lineHeight: 17,
    flex: 1,
  },
});
