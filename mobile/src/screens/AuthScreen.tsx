import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Image,
  Keyboard,
  Linking,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../services/AuthService';
import { googleAuthService } from '../services/GoogleAuthService';
import { appleAuthService } from '../services/AppleAuthService';
import { Colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { ServerConfigModal } from '../components/modals/ServerConfigModal';
import { serverConfigService } from '../services/ServerConfigService';
import { LANDING_PAGE_URL } from '../constants/urls';
import { InlineButtonLoader } from '../components/common/Loader';
import { navigationService } from '../services/NavigationService';

interface AuthScreenProps {
  backendWsUrl?: string;
  onAuthenticated: () => void;
  onServerChanged?: (newWsUrl: string) => void;
}

type AuthMode = 'welcome' | 'profile_setup';

interface MergePromptData {
  provider: 'google' | 'apple';
  email: string;
  existingProvider: string;
  existingName?: string;
  payload: any;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  backendWsUrl = 'ws://127.0.0.1:4000',
  onAuthenticated,
  onServerChanged,
}) => {
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [showServerModal, setShowServerModal] = useState(false);


  // Account Merge State (when user signs in with Apple/Google and the same email exists on the other provider)
  const [mergeData, setMergeData] = useState<MergePromptData | null>(null);



  // Profile setup states (shown after authentication: name, image, phone - NOT email)
  const [userEmail, setUserEmail] = useState('');
  const [authProvider, setAuthProvider] = useState<'google' | 'apple'>('google');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const isAuthenticating = googleLoading || appleLoading;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const statusBarHeight =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 36)
      : Math.max(insets.top, 44);



  // Back button handler
  useEffect(() => {
    const handleAuthBack = (): boolean => {
      if (mergeData) {
        setMergeData(null);
        return true;
      }
      if (showServerModal) {
        setShowServerModal(false);
        return true;
      }
      if (mode === 'profile_setup') {
        setMode('welcome');
        return true;
      }
      return false;
    };

    const unregister = navigationService.registerBackHandler('auth_screen', handleAuthBack, 80);
    return () => unregister();
  }, [mergeData, showServerModal, mode]);

  // Pick Avatar from Gallery
  const handlePickAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera roll permission is required to upload a profile photo.');
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
        setUploadedAvatar(dataUri);
      }
    } catch (err) {
      console.warn('[AuthScreen] Error picking avatar:', err);
    }
  };

  // Take Avatar Photo with Camera
  const handleTakeAvatarPhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is required to take a profile photo.');
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
        const dataUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setUploadedAvatar(dataUri);
      }
    } catch (err) {
      console.warn('[AuthScreen] Error taking photo:', err);
    }
  };

  // ─── 1. Real Google Authentication ────────────────────────────────────────
  const handleContinueWithActualGoogle = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);
    setGoogleLoading(true);

    try {
      const activeClientId = await googleAuthService.getClientId(backendWsUrl);
      if (!activeClientId) {
        if (serverConfigService.isCustomServer()) {
          Alert.alert(
            'Google OAuth Required',
            'Your custom private server requires a Google OAuth Client ID. Please configure it in Server Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => setShowServerModal(true) },
            ]
          );
        } else {
          setErrorMessage(
            'Google Client ID is not configured in environment. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID in mobile/.env.'
          );
        }
        return;
      }

      const googleProfile = await googleAuthService.promptAsync(backendWsUrl);
      if (!googleProfile) {
        return;
      }

      const payload = {
        backendUrl: backendWsUrl,
        email: googleProfile.email,
        fullName: googleProfile.fullName,
        avatarUrl: googleProfile.avatarUrl,
        googleId: googleProfile.googleId,
      };

      const res = await authService.signInWithGoogle(payload);

      // Check if merge is requested because account exists on Apple
      if (res.requiresMerge) {
        setMergeData({
          provider: 'google',
          email: googleProfile.email,
          existingProvider: res.existingProvider || 'apple',
          existingName: res.existingName,
          payload,
        });
        return;
      }

      // Successful auth -> Open profile customization screen
      onAuthSuccess(res.user, 'google');
    } catch (e: any) {
      if (e.message?.includes('GOOGLE_CLIENT_ID_REQUIRED')) {
        if (serverConfigService.isCustomServer()) {
          Alert.alert(
            'Google OAuth Required',
            'Your custom private server requires a Google OAuth Client ID. Please configure it in Server Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => setShowServerModal(true) },
            ]
          );
        } else {
          setErrorMessage(
            'Google Client ID is not configured in environment. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID in mobile/.env.'
          );
        }
      } else {
        setErrorMessage(e.message || 'Google authentication failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─── 2. Real Apple Authentication ─────────────────────────────────────────
  const handleContinueWithApple = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);
    setAppleLoading(true);

    try {
      const isAppleAvail = await appleAuthService.isAvailable();
      if (!isAppleAvail) {
        Alert.alert(
          'Sign in with Apple',
          'Sign in with Apple is available on iOS devices with an active Apple ID. On Android, please use Continue with Google.'
        );
        return;
      }

      const appleProfile = await appleAuthService.promptAsync();
      if (!appleProfile) {
        return;
      }

      const payload = {
        backendUrl: backendWsUrl,
        email: appleProfile.email,
        fullName: appleProfile.fullName,
        appleId: appleProfile.appleId,
      };

      const res = await authService.signInWithApple(payload);

      // Check if merge is requested because account exists on Google
      if (res.requiresMerge) {
        setMergeData({
          provider: 'apple',
          email: appleProfile.email,
          existingProvider: res.existingProvider || 'google',
          existingName: res.existingName,
          payload,
        });
        return;
      }

      // Successful auth -> Open profile customization screen
      onAuthSuccess(res.user, 'apple');
    } catch (e: any) {
      setErrorMessage(e.message || 'Apple authentication failed. Please try again.');
    } finally {
      setAppleLoading(false);
    }
  };

  // ─── Confirm Account Merging Action ───────────────────────────────────────
  const handleConfirmMerge = async () => {
    if (!mergeData) return;
    setMergeLoading(true);

    try {
      let res: any;
      if (mergeData.provider === 'apple') {
        res = await authService.signInWithApple({
          ...mergeData.payload,
          merge: true,
        });
      } else {
        res = await authService.signInWithGoogle({
          ...mergeData.payload,
          merge: true,
        });
      }

      setMergeData(null);
      onAuthSuccess(res.user, mergeData.provider);
    } catch (e: any) {
      setErrorMessage(e.message || 'Account merging failed. Please try again.');
    } finally {
      setMergeLoading(false);
    }
  };

  // Helper on authentication success: always shows the profile customization screen
  const onAuthSuccess = (user: any, provider: 'google' | 'apple') => {
    setUserEmail(user.email);
    setAuthProvider(provider);
    setFullName(user.full_name || '');
    setUploadedAvatar(user.avatar_url || null);
    setPhone(user.phone || '');
    setMode('profile_setup');
  };





  // ─── Profile Setup Save Action ────────────────────────────────────
  const handleSaveProfileSetup = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setProfileSaving(true);

    try {
      await authService.updateProfile({
        backendUrl: backendWsUrl,
        fullName: fullName.trim(),
        avatarUrl: uploadedAvatar,
        phone: phone.trim() || null,
      });

      // Proceed directly to the main map dashboard
      onAuthenticated();
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to save profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingTop: statusBarHeight + 16 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        bounces={true}
      >
        {/* ─── 1. App Header & Branding ─── */}
        <View style={styles.logoBadgeContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.appTitle}>CareRing</Text>

        {mode === 'welcome' ? (
          <>
            <Text style={styles.appSubtitle}>
              Live family safety network, real-time GPS circles, and instant emergency alerts.
            </Text>

            {/* Feature Highlights Grid */}
            <View style={styles.featuresCard}>
              <View style={styles.featureItem}>
                <View style={[styles.featureIconBubble, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="navigate-circle" size={20} color={Colors.primary} />
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>Real-Time GPS Circles</Text>
                  <Text style={styles.featureDesc}>
                    Live location radar, battery levels & place check-ins.
                  </Text>
                </View>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureItem}>
                <View style={[styles.featureIconBubble, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>Intelligent Driving Safety</Text>
                  <Text style={styles.featureDesc}>
                    Crash detection, speeding & hard braking alerts.
                  </Text>
                </View>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureItem}>
                <View style={[styles.featureIconBubble, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="lock-closed" size={20} color="#F59E0B" />
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>Private & Encrypted</Text>
                  <Text style={styles.featureDesc}>
                    Your location stays strictly between your family circle.
                  </Text>
                </View>
              </View>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={Colors.sos} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* ─── OPTION 1: Apple Sign-In Button (iOS Only) ─── */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleContinueWithApple}
                disabled={isAuthenticating}
                style={styles.applePrimaryBtn}
              >
                {appleLoading ? (
                  <InlineButtonLoader size={18} color="#FFFFFF" label="Connecting with Apple..." />
                ) : (
                  <View style={styles.socialBtnInner}>
                    <View style={styles.socialIconWrapper}>
                      <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.appleBtnText}>Continue with Apple</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* ─── OPTION 2: Google Sign-In Button ─── */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleContinueWithActualGoogle}
              disabled={isAuthenticating}
              style={styles.googlePrimaryBtn}
            >
              {googleLoading ? (
                <InlineButtonLoader size={18} color="#1F2937" label="Connecting with Google..." />
              ) : (
                <View style={styles.socialBtnInner}>
                  <View style={styles.socialIconWrapper}>
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                  </View>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Trust & Privacy Notice */}
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#64748B" />
              <Text style={styles.trustBadgeText}>
                {Platform.OS === 'ios'
                  ? 'Zero passwords required • Official Apple & Google OAuth'
                  : 'Zero passwords required • Official Google OAuth'}
              </Text>
            </View>


          </>
        ) : (
          /* ─── 2. Profile Setup Mode (Shown right after authentication) ─── */
          <View style={styles.profileSetupWrapper}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 2 OF 2 • PROFILE DETAILS</Text>
            </View>

            <Text style={styles.sectionHeaderTitle}>Customize Your Profile</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Update how your name and photo appear to circle members. Your {authProvider === 'apple' ? 'Apple' : 'Google'} email is securely linked.
            </Text>

            {/* Profile Photo Editor */}
            <View style={styles.avatarEditCard}>
              <View style={styles.avatarWithBadgeWrapper}>
                <Avatar
                  name={fullName || 'U'}
                  avatarUrl={uploadedAvatar}
                  size={84}
                  borderWidth={3}
                  borderColor={Colors.primary}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePickAvatar}
                  style={styles.floatingCameraBadge}
                >
                  <Feather name="camera" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.avatarDetailsCol}>
                <Text style={styles.fieldLabel}>Profile Photo</Text>
                <Text style={styles.fieldSubLabel}>
                  {uploadedAvatar ? 'Custom photo selected' : 'Initial / social avatar'}
                </Text>

                <View style={styles.avatarButtonsRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePickAvatar}
                    style={styles.avatarSmallBtn}
                  >
                    <Feather name="image" size={13} color={Colors.primary} />
                    <Text style={styles.avatarSmallBtnText}>Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleTakeAvatarPhoto}
                    style={styles.avatarSmallBtn}
                  >
                    <Feather name="camera" size={13} color={Colors.primary} />
                    <Text style={styles.avatarSmallBtnText}>Camera</Text>
                  </TouchableOpacity>

                  {uploadedAvatar && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setUploadedAvatar(null)}
                      style={styles.avatarRemoveSmallBtn}
                    >
                      <Feather name="trash-2" size={13} color="#EF4444" />
                      <Text style={styles.avatarRemoveSmallBtnText}>Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Profile Form Card */}
            <View style={styles.setupCard}>
              {/* Field 1: Full Name (Editable) */}
              <Text style={styles.inputLabelText}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={Colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Sunny Sahsi or Dad"
                  placeholderTextColor="#94A3B8"
                  style={styles.inputField}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Field 2: Mobile Phone Number (Editable) */}
              <Text style={[styles.inputLabelText, { marginTop: 14 }]}>
                Mobile Phone Number
              </Text>
              <Text style={styles.inputHelperText}>
                Used for emergency SOS calls & circle safety notifications
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={Colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  style={styles.inputField}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveProfileSetup}
                />
              </View>

              {/* Field 3: Verified Email (LOCKED / NOT EDITABLE) */}
              <Text style={[styles.inputLabelText, { marginTop: 14 }]}>
                Verified Account Email
              </Text>
              <View style={styles.lockedEmailContainer}>
                <View style={styles.lockedEmailRow}>
                  {authProvider === 'apple' ? (
                    <Ionicons
                      name="logo-apple"
                      size={17}
                      color="#0F172A"
                      style={{ marginRight: 8 }}
                    />
                  ) : (
                    <Ionicons
                      name="logo-google"
                      size={16}
                      color="#EA4335"
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text style={styles.lockedEmailText} numberOfLines={1}>
                    {userEmail || 'user@example.com'}
                  </Text>
                  <View style={styles.lockedBadge}>
                    <Feather name="lock" size={11} color="#64748B" />
                    <Text style={styles.lockedBadgeText}>Locked</Text>
                  </View>
                </View>
                <Text style={styles.lockedEmailCaption}>
                  Verified by {authProvider === 'apple' ? 'Apple' : 'Google'}. Permanently linked to your account.
                </Text>
              </View>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={Colors.sos} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Primary Save Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSaveProfileSetup}
              disabled={profileSaving}
              style={styles.primaryBtn}
            >
              {profileSaving ? (
                <InlineButtonLoader size={18} color="#FFFFFF" label="Saving Changes..." />
              ) : (
                <Text style={styles.primaryBtnText}>Save & Enter CareRing</Text>
              )}
            </TouchableOpacity>

            {/* Secondary Skip / Continue with defaults */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onAuthenticated()}
              style={styles.skipBtn}
            >
              <Text style={styles.skipBtnText}>Continue with defaults</Text>
            </TouchableOpacity>

            {/* Switch Account */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                authService.signOut();
                setMode('welcome');
              }}
              style={styles.switchAccountBtn}
            >
              <Text style={styles.switchAccountText}>
                Sign in with a different account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Self-Hosted Server Configuration Pill ─── */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setShowServerModal(true)}
          style={styles.serverPill}
        >
          <View
            style={[
              styles.serverStatusDot,
              { backgroundColor: serverConfigService.isCustomServer() ? '#A855F7' : '#10B981' },
            ]}
          />
          <Ionicons
            name="server-outline"
            size={13}
            color="#64748B"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.serverPillText} numberOfLines={1}>
            Server:{' '}
            <Text style={styles.serverPillHost}>
              {serverConfigService.getCleanHost(backendWsUrl)}
            </Text>
          </Text>
          <Feather name="settings" size={12} color="#64748B" style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        {/* ─── Official Landing Page Link ─── */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => Linking.openURL(LANDING_PAGE_URL)}
          style={styles.websiteLink}
        >
          <Ionicons name="globe-outline" size={13} color="#64748B" />
          <Text style={styles.websiteLinkText}>
            Official Website:{' '}
            <Text style={styles.websiteLinkDomain}>care-ring.netlify.app</Text>
          </Text>
          <Feather name="external-link" size={11} color="#64748B" />
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Account Merge Confirmation Modal ─── */}
      <Modal
        visible={!!mergeData}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMergeData(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.mergeModalContent}>
            {/* Header with Linked Badges */}
            <View style={styles.mergeIconRow}>
              <View style={[styles.mergeProviderIcon, { backgroundColor: '#F8FAFC' }]}>
                <Ionicons
                  name={mergeData?.existingProvider === 'apple' ? 'logo-apple' : 'logo-google'}
                  size={24}
                  color={mergeData?.existingProvider === 'apple' ? '#0F172A' : '#EA4335'}
                />
              </View>
              <Feather name="link-2" size={20} color={Colors.primary} style={{ marginHorizontal: 8 }} />
              <View style={[styles.mergeProviderIcon, { backgroundColor: '#F8FAFC' }]}>
                <Ionicons
                  name={mergeData?.provider === 'apple' ? 'logo-apple' : 'logo-google'}
                  size={24}
                  color={mergeData?.provider === 'apple' ? '#0F172A' : '#EA4335'}
                />
              </View>
            </View>

            <Text style={styles.mergeModalTitle}>Link & Merge Accounts?</Text>
            <Text style={styles.mergeModalSubtitle}>
              An existing account for <Text style={{ fontWeight: '800', color: '#0F172A' }}>{mergeData?.email}</Text> was found via{' '}
              <Text style={{ fontWeight: '800', color: '#0F172A' }}>
                {mergeData?.existingProvider === 'apple' ? 'Apple Sign-In' : 'Google Sign-In'}
              </Text>.
            </Text>

            <View style={styles.mergeBenefitsCard}>
              <View style={styles.mergeBenefitRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.mergeBenefitText}>
                  Keep all your family circles, members, and history
                </Text>
              </View>
              <View style={styles.mergeBenefitRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.mergeBenefitText}>
                  {Platform.OS === 'ios'
                    ? 'Sign in anytime with either Apple or Google'
                    : 'Access your existing account & data with Google'}
                </Text>
              </View>
            </View>

            {/* Merge Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleConfirmMerge}
              disabled={mergeLoading}
              style={[styles.primaryBtn, { marginBottom: 10 }]}
            >
              {mergeLoading ? (
                <InlineButtonLoader size={18} color="#FFFFFF" label="Merging Accounts..." />
              ) : (
                <Text style={styles.primaryBtnText}>Merge & Link Accounts</Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setMergeData(null)}
              style={styles.skipBtn}
            >
              <Text style={styles.skipBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>





      {/* ─── Server Config Modal ─── */}
      <ServerConfigModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        onServerSaved={(newUrl) => {
          if (onServerChanged) {
            onServerChanged(newUrl);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 100,
    alignItems: 'center',
  },
  logoBadgeContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0A0F1D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 24,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 20,
  },
  featuresCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  featureIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  featureDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  applePrimaryBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#000000',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 10,
  },
  appleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  googlePrimaryBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  socialBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconWrapper: {
    marginRight: 12,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.2,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  trustBadgeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  profileSetupWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  stepBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  sectionHeaderSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  avatarEditCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWithBadgeWrapper: {
    position: 'relative',
  },
  floatingCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarDetailsCol: {
    flex: 1,
    marginLeft: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  fieldSubLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 8,
  },
  avatarButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  avatarSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  avatarSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  avatarRemoveSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  avatarRemoveSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  setupCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  inputLabelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  inputHelperText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#F8FAFC',
    marginTop: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMain,
  },
  lockedEmailContainer: {
    marginTop: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedEmailText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  lockedEmailCaption: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 5,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.sosLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.sos,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  skipBtn: {
    paddingVertical: 8,
    marginBottom: 4,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  switchAccountBtn: {
    paddingVertical: 6,
  },
  switchAccountText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serverStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  serverPillText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  serverPillHost: {
    color: '#0F172A',
    fontWeight: '700',
  },
  websiteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  websiteLinkText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  websiteLinkDomain: {
    color: Colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  mergeModalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  mergeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mergeProviderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  mergeModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  mergeBenefitsCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    gap: 8,
  },
  mergeBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mergeBenefitText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
});
