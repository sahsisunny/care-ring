/**
 * Developer Direct Login Modal
 * Allows developers and testers to log in directly with Email and Name
 * Bypasses Google and Apple OAuth requirements for frictionless local development.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../../services/AuthService';
import { serverConfigService } from '../../services/ServerConfigService';
import { SavedDevAccount } from '../../models/DevAuth';
import { Colors } from '../../theme/colors';
import { Avatar } from '../Avatar';
import { InlineButtonLoader } from '../common/Loader';

interface DevDirectLoginModalProps {
  visible: boolean;
  onClose: () => void;
  backendWsUrl: string;
  onAuthenticated: () => void;
}

interface DevPreset {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tag: string;
  icon: string;
}

const DEV_PRESETS: DevPreset[] = [
  {
    id: 'admin',
    name: 'Dev Admin',
    email: 'admin.dev@carering.com',
    phone: '+1 (555) 100-0001',
    tag: 'Admin',
    icon: 'shield-checkmark',
  },
  {
    id: 'sunny',
    name: 'Sunny Sahsi',
    email: 'sunny.dev@carering.com',
    phone: '+1 (555) 100-0002',
    tag: 'Lead',
    icon: 'star',
  },
  {
    id: 'member',
    name: 'Circle Member',
    email: 'member.dev@carering.com',
    phone: '+1 (555) 100-0003',
    tag: 'Member',
    icon: 'people',
  },
  {
    id: 'tester',
    name: 'QA Tester',
    email: 'qa.dev@carering.com',
    phone: '+1 (555) 100-0004',
    tag: 'Tester',
    icon: 'bug',
  },
];

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
];

export const DevDirectLoginModal: React.FC<DevDirectLoginModalProps> = ({
  visible,
  onClose,
  backendWsUrl,
  onAuthenticated,
}) => {
  const [fullName, setFullName] = useState('Dev Admin');
  const [email, setEmail] = useState('admin.dev@carering.com');
  const [phone, setPhone] = useState('+1 (555) 100-0001');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedDevAccount[]>([]);

  // Load saved developer accounts on modal open
  useEffect(() => {
    if (visible) {
      setErrorMessage(null);
      authService.getSavedDevAccounts().then((accounts) => {
        setSavedAccounts(accounts);
        if (accounts.length > 0 && !email) {
          const latest = accounts[0];
          setEmail(latest.email);
          setFullName(latest.fullName);
          setAvatarUrl(latest.avatarUrl || null);
          setPhone(latest.phone || '');
        }
      });
    }
  }, [visible]);

  const handleApplyPreset = (preset: DevPreset) => {
    setFullName(preset.name);
    setEmail(preset.email);
    setPhone(preset.phone || '');
    setErrorMessage(null);
  };

  const handleApplySavedAccount = (account: SavedDevAccount) => {
    setFullName(account.fullName);
    setEmail(account.email);
    setAvatarUrl(account.avatarUrl || null);
    setPhone(account.phone || '');
    setErrorMessage(null);
  };

  const handleRemoveSavedAccount = async (targetEmail: string) => {
    await authService.removeSavedDevAccount(targetEmail);
    const updated = await authService.getSavedDevAccounts();
    setSavedAccounts(updated);
  };

  const handlePickAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera roll access is needed to pick an avatar.');
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
        const dataUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setAvatarUrl(dataUri);
      }
    } catch (err) {
      console.warn('[DevDirectLoginModal] Error picking avatar:', err);
    }
  };

  const handleSubmit = async () => {
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('Please enter a full name.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await authService.devLogin({
        backendUrl: backendWsUrl,
        email: cleanEmail,
        fullName: cleanName,
        avatarUrl: avatarUrl || null,
        phone: phone.trim() || null,
      });

      onClose();
      onAuthenticated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Developer direct login failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const serverHost = serverConfigService.getCleanHost(backendWsUrl);
  const isCustom = serverConfigService.isCustomServer();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.devIconBadge}>
                  <Ionicons name="terminal" size={18} color="#6366F1" />
                </View>
                <View>
                  <View style={styles.titleRow}>
                    <Text style={styles.modalTitle}>Developer Login</Text>
                    <View style={styles.badgeDev}>
                      <Text style={styles.badgeDevText}>DEV ONLY</Text>
                    </View>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    Direct login bypassing Google & Apple OAuth
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Target Server Indicator Pill */}
            <View style={styles.serverPill}>
              <View
                style={[
                  styles.serverStatusDot,
                  { backgroundColor: isCustom ? '#A855F7' : '#10B981' },
                ]}
              />
              <Ionicons name="server-outline" size={13} color="#64748B" style={{ marginRight: 5 }} />
              <Text style={styles.serverPillText} numberOfLines={1}>
                Target Server: <Text style={styles.serverPillBold}>{serverHost}</Text>
              </Text>
            </View>

            {/* Existing User Data Notice */}
            <View style={styles.existingDataNotice}>
              <Ionicons name="sparkles" size={13} color="#6366F1" style={{ marginRight: 6 }} />
              <Text style={styles.existingDataNoticeText}>
                Uses existing account data: enter any registered email to restore their circles, role, and profile.
              </Text>
            </View>

            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Quick Presets Section */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="flash" size={13} color="#F59E0B" style={{ marginRight: 5 }} />
                  <Text style={styles.sectionTitle}>1-TAP TEST PRESETS</Text>
                </View>
                <Text style={styles.sectionHint}>Auto-fills name & email</Text>
              </View>

              <View style={styles.presetsGrid}>
                {DEV_PRESETS.map((p) => {
                  const isSelected = email.toLowerCase() === p.email.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.75}
                      onPress={() => handleApplyPreset(p)}
                      style={[
                        styles.presetChip,
                        isSelected && styles.presetChipActive,
                      ]}
                    >
                      <Ionicons
                        name={p.icon as any}
                        size={13}
                        color={isSelected ? '#6366F1' : '#64748B'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Saved Recent Accounts */}
              {savedAccounts.length > 0 && (
                <View style={styles.recentAccountsSection}>
                  <Text style={styles.sectionTitle}>RECENT DEV LOGINS</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentScrollContent}
                  >
                    {savedAccounts.map((acc) => {
                      const isCurrent = email.toLowerCase() === acc.email.toLowerCase();
                      return (
                        <View
                          key={acc.email}
                          style={[
                            styles.recentChip,
                            isCurrent && styles.recentChipActive,
                          ]}
                        >
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => handleApplySavedAccount(acc)}
                            style={styles.recentChipTouch}
                          >
                            <Avatar
                              name={acc.fullName}
                              avatarUrl={acc.avatarUrl}
                              size={20}
                              borderWidth={1}
                              borderColor="#CBD5E1"
                            />
                            <Text
                              style={[
                                styles.recentChipText,
                                isCurrent && styles.recentChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {acc.fullName}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveSavedAccount(acc.email)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.recentRemoveBtn}
                          >
                            <Ionicons name="close-circle" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Avatar Selector Row */}
              <View style={styles.avatarRow}>
                <View style={styles.avatarPreviewWrapper}>
                  <Avatar
                    name={fullName || 'D'}
                    avatarUrl={avatarUrl}
                    size={56}
                    borderWidth={2}
                    borderColor={Colors.primary}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePickAvatar}
                    style={styles.avatarCameraBadge}
                  >
                    <Feather name="camera" size={11} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.avatarPickersCol}>
                  <Text style={styles.avatarLabel}>Profile Avatar (Optional)</Text>
                  <View style={styles.presetAvatarsRow}>
                    {PRESET_AVATARS.map((url, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.75}
                        onPress={() => setAvatarUrl(url)}
                        style={[
                          styles.presetAvatarThumb,
                          avatarUrl === url && styles.presetAvatarThumbActive,
                        ]}
                      >
                        <Avatar
                          name={`P${idx}`}
                          avatarUrl={url}
                          size={28}
                          borderWidth={0}
                        />
                      </TouchableOpacity>
                    ))}
                    {avatarUrl && (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setAvatarUrl(null)}
                        style={styles.resetAvatarBtn}
                      >
                        <Feather name="trash-2" size={12} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Form Input 1: Full Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Full Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={18} color="#6366F1" style={styles.inputIcon} />
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="e.g. Sunny Sahsi or Dev User"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  {fullName.length > 0 && (
                    <TouchableOpacity onPress={() => setFullName('')}>
                      <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Form Input 2: Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Email Address <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={18} color="#6366F1" style={styles.inputIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="e.g. dev@carering.com"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  {email.length > 0 && (
                    <TouchableOpacity onPress={() => setEmail('')}>
                      <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Form Input 3: Phone Number (Optional) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Phone (Optional)</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="call-outline" size={18} color="#6366F1" style={styles.inputIcon} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. +1 (555) 012-3456"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  {phone.length > 0 && (
                    <TouchableOpacity onPress={() => setPhone('')}>
                      <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Error Message */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Primary Action Button */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleSubmit}
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? (
                  <InlineButtonLoader size={18} color="#FFFFFF" label="Signing In as Developer..." />
                ) : (
                  <View style={styles.submitBtnInner}>
                    <Ionicons name="flash" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Log In Directly</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                disabled={loading}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  keyboardAvoid: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  devIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  badgeDev: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeDevText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  serverStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  serverPillText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  serverPillBold: {
    fontWeight: '700',
    color: '#334155',
  },
  existingDataNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 12,
  },
  existingDataNoticeText: {
    fontSize: 11,
    color: '#4338CA',
    flex: 1,
    lineHeight: 15,
    fontWeight: '500',
  },
  scrollBody: {
    maxHeight: 480,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  sectionHint: {
    fontSize: 10,
    color: '#94A3B8',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#818CF8',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  recentAccountsSection: {
    marginBottom: 14,
  },
  recentScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 4,
  },
  recentChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#818CF8',
  },
  recentChipTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    maxWidth: 100,
  },
  recentChipTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  recentRemoveBtn: {
    padding: 2,
    marginLeft: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 12,
  },
  avatarPreviewWrapper: {
    position: 'relative',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarPickersCol: {
    flex: 1,
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  presetAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetAvatarThumb: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 1,
  },
  presetAvatarThumbActive: {
    borderColor: '#6366F1',
  },
  resetAvatarBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500',
  },
  submitBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cancelBtn: {
    width: '100%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
});
