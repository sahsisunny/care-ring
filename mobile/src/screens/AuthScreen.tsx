import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../services/AuthService';
import { Colors } from '../theme/colors';
import { Avatar } from '../components/Avatar';

interface AuthScreenProps {
  backendWsUrl?: string;
  onAuthenticated: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  backendWsUrl = 'ws://127.0.0.1:4000',
  onAuthenticated,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);

  // Form Fields - NO dummy values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePickAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
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

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage('Password must be at least 4 characters long');
      return;
    }

    if (isSignUp && !fullName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up with optional uploaded photo
        await authService.signUp({
          backendUrl: backendWsUrl,
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          avatarUrl: uploadedAvatar || undefined,
        });
      } else {
        // Sign In
        await authService.login({
          backendUrl: backendWsUrl,
          email: email.trim(),
          password,
        });
      }

      onAuthenticated();
    } catch (e: any) {
      setErrorMessage(e.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. App Logo / Hero Icon */}
          <View style={styles.heroBadge}>
            <MaterialIcons name="family-restroom" size={44} color="#FFFFFF" />
          </View>

          {/* 2. Headline & Subtitle */}
          <Text style={styles.appTitle}>CareRing</Text>
          <Text style={styles.appSubtitle}>
            {isSignUp
              ? 'Create your account to start sharing real-time locations with your family.'
              : 'Sign in to access your family circles and real-time safety network.'}
          </Text>

          {/* 3. Auth Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setIsSignUp(false);
                setErrorMessage(null);
              }}
              style={[styles.tabButton, !isSignUp && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setIsSignUp(true);
                setErrorMessage(null);
              }}
              style={[styles.tabButton, isSignUp && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* 4. Credentials Form Card */}
          <View style={styles.setupCard}>
            {/* If Sign Up: Avatar Selection & Direct Upload */}
            {isSignUp && (
              <View style={styles.avatarSection}>
                <View style={styles.avatarPreviewRow}>
                  <Avatar
                    name={fullName || 'U'}
                    avatarUrl={uploadedAvatar}
                    size={62}
                    borderWidth={2}
                    borderColor={Colors.primary}
                  />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.fieldLabel}>Profile Avatar (Photo Optional)</Text>
                    <Text style={styles.fieldSubLabel}>
                      {uploadedAvatar
                        ? 'Custom photo uploaded'
                        : 'Using clean initials avatar'}
                    </Text>
                    <View style={styles.avatarActionRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handlePickAvatar}
                        style={styles.uploadAvatarBtn}
                      >
                        <Feather name="image" size={13} color={Colors.primary} />
                        <Text style={styles.uploadAvatarBtnText}>
                          {uploadedAvatar ? 'Change Photo' : 'Upload Photo'}
                        </Text>
                      </TouchableOpacity>

                      {uploadedAvatar && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => setUploadedAvatar(null)}
                          style={styles.removeAvatarBtn}
                        >
                          <Feather name="trash-2" size={13} color="#EF4444" />
                          <Text style={styles.removeAvatarBtnText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* If Sign Up: Full Name */}
            {isSignUp && (
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full Name"
                  placeholderTextColor="#94A3B8"
                  style={styles.inputField}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputField}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={isSignUp ? 'Create Password (min 4 chars)' : 'Password'}
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={styles.inputField}
              />
            </View>

            {/* If Sign Up: Mobile Phone Number */}
            {isSignUp && (
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Mobile Phone (optional)"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  style={styles.inputField}
                />
              </View>
            )}
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.sos} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Primary Submit Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={loading}
            style={styles.primaryBtn}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isSignUp ? 'Create My Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Switch Mode Prompt */}
          <TouchableOpacity
            onPress={() => {
              setIsSignUp(!isSignUp);
              setErrorMessage(null);
            }}
            style={styles.switchModeBtn}
          >
            <Text style={styles.switchModeText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchModeLink}>
                {isSignUp ? 'Sign In' : 'Create Account'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 26,
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
    marginBottom: 22,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    width: '100%',
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.textMain,
  },
  setupCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  avatarSection: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  fieldSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 8,
  },
  avatarActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadAvatarBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  removeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  removeAvatarBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMain,
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
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  switchModeBtn: {
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  switchModeLink: {
    fontWeight: '800',
    color: Colors.primary,
  },
});
