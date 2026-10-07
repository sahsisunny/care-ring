import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { Colors } from '../../theme/colors';
import {
  serverConfigService,
  ServerPingResult,
  DEFAULT_SERVER_WS,
} from '../../services/ServerConfigService';
import { googleAuthService } from '../../services/GoogleAuthService';
import { appleAuthService } from '../../services/AppleAuthService';
import { LANDING_PAGE_URL } from '../../constants/urls';
import { InlineButtonLoader } from '../common/Loader';

interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onServerSaved?: (newWsUrl: string) => void;
  requireReloginNotice?: boolean;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  visible,
  onClose,
  onServerSaved,
  requireReloginNotice = false,
}) => {
  const { colors, isDark } = useTheme();

  // Mode: 'cloud' (official Render instance) or 'custom' (self-hosted)
  const [selectedMode, setSelectedMode] = useState<'cloud' | 'custom'>('cloud');
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [customGoogleClientId, setCustomGoogleClientId] = useState('');
  const [customAppleClientId, setCustomAppleClientId] = useState('');
  const [activeUrl, setActiveUrl] = useState(DEFAULT_SERVER_WS);

  // Ping test state
  const [testing, setTesting] = useState(false);
  const [pingResult, setPingResult] = useState<ServerPingResult | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // On modal open, populate current server configuration
  useEffect(() => {
    if (visible) {
      const current = serverConfigService.getActiveWsUrl();
      const isCustom = serverConfigService.isCustomServer();
      setActiveUrl(current);
      if (isCustom) {
        setSelectedMode('custom');
        setCustomInputUrl(serverConfigService.getCustomWsUrl() || current);
        googleAuthService.getClientId().then((id) => {
          if (id) setCustomGoogleClientId(id);
        });
        appleAuthService.getClientId().then((id) => {
          if (id) setCustomAppleClientId(id);
        });
      } else {
        setSelectedMode('cloud');
        setCustomInputUrl('');
        setCustomGoogleClientId('');
        setCustomAppleClientId('');
      }
      setPingResult(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [visible]);

  const handleTestConnection = async () => {
    const targetUrl =
      selectedMode === 'cloud'
        ? DEFAULT_SERVER_WS
        : customInputUrl.trim() || 'http://127.0.0.1:4000';

    setTesting(true);
    setPingResult(null);

    try {
      const result = await serverConfigService.testConnection(targetUrl);
      setPingResult(result);
      if (result.authConfig) {
        if (result.authConfig.googleClientId && !customGoogleClientId.trim()) {
          setCustomGoogleClientId(result.authConfig.googleClientId);
        }
        if (result.authConfig.appleClientId && !customAppleClientId.trim()) {
          setCustomAppleClientId(result.authConfig.appleClientId);
        }
      }
    } catch (err: any) {
      setPingResult({
        success: false,
        latencyMs: 0,
        error: err?.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleApplyServer = async () => {
    setSaving(true);
    try {
      let finalWsUrl: string;

      if (selectedMode === 'cloud') {
        finalWsUrl = await serverConfigService.resetToDefault();
        await googleAuthService.setClientId('');
        await appleAuthService.setClientId('');
      } else {
        if (!customInputUrl.trim()) {
          Alert.alert('Invalid URL', 'Please enter your self-hosted server address (domain or IP:port).');
          setSaving(false);
          return;
        }
        finalWsUrl = await serverConfigService.setServerUrl(customInputUrl);
        await googleAuthService.setClientId(customGoogleClientId.trim());
        if (Platform.OS === 'ios') {
          await appleAuthService.setClientId(customAppleClientId.trim());
        }
      }

      setActiveUrl(finalWsUrl);

      if (onServerSaved) {
        onServerSaved(finalWsUrl);
      }

      onClose();
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not update server configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = () => {
    if (requireReloginNotice && selectedMode === 'custom' && !serverConfigService.isCustomServer()) {
      Alert.alert(
        'Switch Backend Server?',
        'Connecting to a custom server will switch active network routes. You will need to log in to your custom instance.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch & Connect', onPress: handleApplyServer },
        ]
      );
    } else {
      handleApplyServer();
    }
  };

  const setPreset = (presetUrl: string) => {
    setSelectedMode('custom');
    setCustomInputUrl(presetUrl);
    setPingResult(null);
  };

  const activeHost = serverConfigService.getCleanHost(activeUrl);
  const isCustomActive = serverConfigService.isCustomServer();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
            },
          ]}
        >
          {/* Header Bar */}
          <View style={[styles.headerRow, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
                <Ionicons name="server" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Backend Server
                </Text>
                <Text style={[styles.headerSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Choose official cloud or self-hosted node
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={isDark ? '#CBD5E1' : '#475569'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Current Active Server Banner */}
            <View
              style={[
                styles.activeBanner,
                {
                  backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.activeBannerTop}>
                <View style={styles.activeIndicatorGroup}>
                  <View
                    style={[
                      styles.statusPulseDot,
                      { backgroundColor: isCustomActive ? '#A855F7' : '#10B981' },
                    ]}
                  />
                  <Text style={[styles.activeStatusLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    CURRENTLY ACTIVE
                  </Text>
                </View>
                <View
                  style={[
                    styles.modeBadge,
                    {
                      backgroundColor: isCustomActive
                        ? 'rgba(168, 85, 247, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBadgeText,
                      { color: isCustomActive ? '#C084FC' : '#10B981' },
                    ]}
                  >
                    {isCustomActive ? 'Self-Hosted' : 'CareRing Cloud'}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.activeHostText, { color: isDark ? '#38BDF8' : '#0284C7' }]}
                numberOfLines={1}
              >
                {activeHost}
              </Text>
            </View>

            {/* Mode Switcher Tabs */}
            <Text style={[styles.sectionLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              SELECT ENDPOINT TYPE
            </Text>
            <View style={[styles.tabBar, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedMode('cloud');
                  setPingResult(null);
                }}
                style={[
                  styles.tabItem,
                  selectedMode === 'cloud' && [
                    styles.tabItemActive,
                    { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
                  ],
                ]}
              >
                <Ionicons
                  name="cloud-done-outline"
                  size={16}
                  color={selectedMode === 'cloud' ? Colors.primary : isDark ? '#94A3B8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.tabText,
                    selectedMode === 'cloud'
                      ? [styles.tabTextActive, { color: isDark ? '#FFFFFF' : '#0F172A' }]
                      : { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  CareRing Cloud
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedMode('custom');
                  setPingResult(null);
                }}
                style={[
                  styles.tabItem,
                  selectedMode === 'custom' && [
                    styles.tabItemActive,
                    { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
                  ],
                ]}
              >
                <Ionicons
                  name="server-outline"
                  size={16}
                  color={selectedMode === 'custom' ? '#A855F7' : isDark ? '#94A3B8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.tabText,
                    selectedMode === 'custom'
                      ? [styles.tabTextActive, { color: isDark ? '#FFFFFF' : '#0F172A' }]
                      : { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Custom Private Server
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mode Content */}
            {selectedMode === 'cloud' ? (
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.cloudInfoRow}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.infoCardTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                      Managed Global Infrastructure
                    </Text>
                    <Text style={[styles.infoCardBody, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Zero-setup server hosted on Render with automatic high-availability WebSocket scaling and PostgreSQL PostGIS database.
                    </Text>
                  </View>
                </View>

                <View style={[styles.endpointPreview, { backgroundColor: isDark ? '#0F172A' : '#EDE9FE' }]}>
                  <Text style={[styles.endpointLabel, { color: isDark ? '#94A3B8' : '#6366F1' }]}>
                    ENDPOINT:
                  </Text>
                  <Text style={[styles.endpointValue, { color: isDark ? '#CBD5E1' : '#312E81' }]}>
                    wss://care-ring.onrender.com
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.customSection}>
                <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                  Server URL or Domain
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                    },
                  ]}
                >
                  <Ionicons
                    name="globe-outline"
                    size={18}
                    color={Colors.primary}
                    style={styles.inputPrefixIcon}
                  />
                  <TextInput
                    value={customInputUrl}
                    onChangeText={(text) => {
                      setCustomInputUrl(text);
                      setPingResult(null);
                    }}
                    placeholder="https://tracker.myfamily.com or IP:4000"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    style={[styles.urlInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  {customInputUrl.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setCustomInputUrl('');
                        setPingResult(null);
                      }}
                      style={styles.clearInputBtn}
                    >
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Presets */}
                <View style={styles.presetsRow}>
                  <Text style={[styles.presetsLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Quick Fill:
                  </Text>
                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}
                    onPress={() => setPreset('http://10.0.2.2:4000')}
                  >
                    <Text style={styles.presetChipText}>Android Sim (10.0.2.2)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetChip, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}
                    onPress={() => setPreset('http://localhost:4000')}
                  >
                    <Text style={styles.presetChipText}>Local (4000)</Text>
                  </TouchableOpacity>
                </View>

                {/* ─── Social OAuth Client IDs (For Private Server) ─── */}
                <View
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? '#334155' : '#E2E8F0',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                    <Ionicons name="key-outline" size={16} color={Colors.primary} />
                    <Text style={[styles.inputLabel, { marginBottom: 0, color: isDark ? '#F1F5F9' : '#0F172A', fontWeight: '700' }]}>
                      Social OAuth Client Credentials
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 10, lineHeight: 16 }}>
                    Enter your client credentials configured for this private server.
                  </Text>

                  {/* Google Client ID */}
                  <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#334155', fontSize: 12 }]}>
                    Google OAuth Client ID
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        marginBottom: 10,
                      },
                    ]}
                  >
                    <Ionicons
                      name="logo-google"
                      size={17}
                      color="#EA4335"
                      style={styles.inputPrefixIcon}
                    />
                    <TextInput
                      value={customGoogleClientId}
                      onChangeText={setCustomGoogleClientId}
                      placeholder="xxxx.apps.googleusercontent.com"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[styles.urlInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {customGoogleClientId.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setCustomGoogleClientId('')}
                        style={styles.clearInputBtn}
                      >
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Apple Client ID (iOS only) */}
                  {Platform.OS === 'ios' && (
                    <>
                      <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#334155', fontSize: 12 }]}>
                        Apple Client ID / Service ID (iOS)
                      </Text>
                      <View
                        style={[
                          styles.inputWrapper,
                          {
                            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                            borderColor: isDark ? '#334155' : '#CBD5E1',
                            marginBottom: 10,
                          },
                        ]}
                      >
                        <Ionicons
                          name="logo-apple"
                          size={18}
                          color={isDark ? '#FFFFFF' : '#0F172A'}
                          style={styles.inputPrefixIcon}
                        />
                        <TextInput
                          value={customAppleClientId}
                          onChangeText={setCustomAppleClientId}
                          placeholder="com.carering.client or Apple Service ID"
                          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                          style={[styles.urlInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {customAppleClientId.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setCustomAppleClientId('')}
                            style={styles.clearInputBtn}
                          >
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </View>

                {/* Architecture Note */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => Linking.openURL(LANDING_PAGE_URL)}
                  style={[
                    styles.sovereigntyCard,
                    {
                      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.08)' : '#FAF5FF',
                      borderColor: isDark ? 'rgba(168, 85, 247, 0.25)' : '#E9D5FF',
                    },
                  ]}
                >
                  <MaterialIcons name="security" size={18} color="#A855F7" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sovereigntyText, { color: isDark ? '#D8B4FE' : '#6B21A8' }]}>
                      Data Sovereignty: When connected to your private server, all GPS pings, chat messages, and circles reside strictly on your own database.
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#C084FC' : '#7C3AED' }}>
                        View Self-Hosting Guides on Official Website
                      </Text>
                      <Feather name="external-link" size={11} color={isDark ? '#C084FC' : '#7C3AED'} />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Test Connection Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleTestConnection}
              disabled={testing}
              style={[
                styles.testBtn,
                {
                  backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                },
              ]}
            >
              {testing ? (
                <InlineButtonLoader text="Testing Reachability..." color={Colors.primary} textColor={Colors.primary} size={15} />
              ) : (
                <View style={styles.testBtnContent}>
                  <Ionicons name="pulse" size={16} color={Colors.primary} />
                  <Text style={[styles.testBtnText, { color: Colors.primary }]}>
                    Test Server Reachability (/health)
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Ping Result Banner */}
            {pingResult && (
              <View
                style={[
                  styles.pingResultCard,
                  pingResult.success
                    ? {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                        borderColor: '#10B981',
                      }
                    : {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                        borderColor: '#EF4444',
                      },
                ]}
              >
                <View style={styles.pingResultHeader}>
                  <Ionicons
                    name={pingResult.success ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={pingResult.success ? '#10B981' : '#EF4444'}
                  />
                  <Text
                    style={[
                      styles.pingResultTitle,
                      { color: pingResult.success ? '#059669' : '#DC2626' },
                    ]}
                  >
                    {pingResult.success ? 'Server is Online & Reachable' : 'Connection Failed'}
                  </Text>
                </View>

                {pingResult.success ? (
                  <View style={styles.pingDetailsRow}>
                    <Text style={[styles.pingDetailText, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                      ⚡ Round-trip Latency: <Text style={{ fontWeight: '700' }}>{pingResult.latencyMs} ms</Text>
                    </Text>
                    {pingResult.service && (
                      <Text style={[styles.pingDetailText, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                        ⚙️ Service: {pingResult.service}
                      </Text>
                    )}
                    {pingResult.authConfig && (
                      <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}>
                        {pingResult.authConfig.isConfigured ? (
                          <Text style={[styles.pingDetailText, { color: isDark ? '#A7F3D0' : '#065F46', fontWeight: '600' }]}>
                            🔐 Social Auth:{' '}
                            {[
                              pingResult.authConfig.google ? 'Google ✓' : null,
                              pingResult.authConfig.apple ? 'Apple ✓' : null,
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </Text>
                        ) : (
                          <Text style={[styles.pingDetailText, { color: isDark ? '#FCD34D' : '#B45309', fontWeight: '600' }]}>
                            ⚠️ Self-Hosting Notice: At least one of GOOGLE_CLIENT_ID or APPLE_CLIENT_ID is required on this server for social login.
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={[styles.pingErrorText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                    {pingResult.error}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footer, { borderTopColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={[
                styles.cancelBtn,
                { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleConfirmSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: Colors.primary }]}
            >
              {saving ? (
                <InlineButtonLoader text="Connecting..." color="#FFFFFF" textColor="#FFFFFF" size={16} />
              ) : (
                <View style={styles.saveBtnContent}>
                  <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save &amp; Connect</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  activeBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },
  activeBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  activeIndicatorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  activeStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeHostText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabItemActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cloudInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoCardBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  endpointPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  endpointLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  endpointValue: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  customSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
  },
  inputPrefixIcon: {
    marginRight: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  clearInputBtn: {
    padding: 4,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  sovereigntyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  sovereigntyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  testBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  testBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pingResultCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pingResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pingResultTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pingDetailsRow: {
    marginLeft: 28,
    gap: 2,
  },
  pingDetailText: {
    fontSize: 12,
  },
  pingErrorText: {
    marginLeft: 28,
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
