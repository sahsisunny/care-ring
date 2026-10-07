import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  AppState,
  AppStateStatus,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { backgroundLocationService, PermissionsStatus } from '../../services/BackgroundLocationService';
import { useTheme } from '../../theme/ThemeContext';
import { InlineButtonLoader } from '../common/Loader';

interface PermissionsModalProps {
  visible: boolean;
  onClose: () => void;
  onPermissionsGranted?: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  visible,
  onClose,
  onPermissionsGranted,
}) => {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PermissionsStatus>({
    foregroundLocation: false,
    backgroundLocation: false,
    notifications: false,
    activityRecognition: false,
    allGranted: false,
  });

  const checkStatus = async () => {
    const res = await backgroundLocationService.checkPermissions();
    setStatus(res);
    if (res.allGranted) {
      onPermissionsGranted?.();
    }
  };

  useEffect(() => {
    if (!visible) return;

    checkStatus();

    // Re-check permissions automatically when user returns from iOS Settings or Android Settings
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [visible]);

  const handleRequestAll = async () => {
    setLoading(true);
    const res = await backgroundLocationService.requestAllPermissions();
    setStatus(res);
    setLoading(false);

    if (res.allGranted) {
      onPermissionsGranted?.();
      onClose();
    }
  };

  const handleOpenSettings = () => {
    backgroundLocationService.openSystemSettings();
  };

  const handleClose = () => {
    if (!status.allGranted) {
      backgroundLocationService.dismissPermissionsPromptForSession();
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Top Shield Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={36} color="#FFFFFF" />
          </View>

          <Text style={[styles.title, { color: colors.textMain }]}>
            24/7 Family Protection & Daily Timeline
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            To record your daily travel timeline and send emergency arrival & SOS alerts when your phone is in
            your pocket or the app is closed, CareRing needs background permissions.
          </Text>

          <ScrollView style={styles.featuresList} showsVerticalScrollIndicator={false}>
            {/* 1. Precise GPS */}
            <View style={[styles.featureItem, { backgroundColor: colors.tileBg }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="navigate" size={20} color="#4F46E5" />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={[styles.featureTitle, { color: colors.textMain }]}>Precise Location</Text>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                  Shows your real-time position with high-precision GPS.
                </Text>
              </View>
              {status.foregroundLocation ? (
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              ) : (
                <View style={styles.statusDotPending} />
              )}
            </View>

            {/* 2. Background "Allow All the Time" */}
            <View style={[styles.featureItem, { backgroundColor: colors.tileBg }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="infinite" size={20} color="#059669" />
              </View>
              <View style={styles.featureTextWrap}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.featureTitle, { color: colors.textMain }]}>
                    Background Tracking
                  </Text>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>Allow All The Time</Text>
                  </View>
                </View>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                  Records daily routes, stops, and driving speed even when closed.
                </Text>
              </View>
              {status.backgroundLocation ? (
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              ) : (
                <View style={styles.statusDotPending} />
              )}
            </View>

            {/* 3. Safety Notifications */}
            <View style={[styles.featureItem, { backgroundColor: colors.tileBg }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="notifications" size={20} color="#D97706" />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={[styles.featureTitle, { color: colors.textMain }]}>Instant Alerts</Text>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                  Keeps the active safety service running and alerts your circle.
                </Text>
              </View>
              {status.notifications ? (
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              ) : (
                <View style={styles.statusDotPending} />
              )}
            </View>

            {/* 4. Motion & Physical Activity Sensors */}
            <View style={[styles.featureItem, { backgroundColor: colors.tileBg }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="fitness" size={20} color="#DB2777" />
              </View>
              <View style={styles.featureTextWrap}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.featureTitle, { color: colors.textMain }]}>
                    Motion & Activity
                  </Text>
                  <View style={[styles.requiredBadge, { backgroundColor: 'rgba(219, 39, 119, 0.12)' }]}>
                    <Text style={[styles.requiredBadgeText, { color: '#DB2777' }]}>Smart Battery</Text>
                  </View>
                </View>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                  Detects driving, walking, and stops automatically while preserving phone battery.
                </Text>
              </View>
              {status.activityRecognition ? (
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              ) : (
                <View style={styles.statusDotPending} />
              )}
            </View>
          </ScrollView>

          {/* Expo Go iOS Notice */}
          {status.isExpoGo && Platform.OS === 'ios' && (
            <View
              style={[
                styles.iosHintBox,
                {
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
                },
              ]}
            >
              <Ionicons name="information-circle" size={20} color="#2563EB" style={{ marginTop: 1 }} />
              <View style={styles.hintContent}>
                <Text style={[styles.iosHintTitle, { color: colors.textMain }]}>
                  Testing in Expo Go (iOS)
                </Text>
                <Text style={[styles.iosHintText, { color: colors.textSecondary }]}>
                  Apple does not allow "Always" background location inside the Expo Go app.{'\n'}
                  <Text style={{ fontWeight: '700' }}>"While Using the App"</Text> is fully active for testing. "Always" is automatically available in standalone builds (EAS Build / TestFlight).
                </Text>
              </View>
            </View>
          )}

          {/* iOS Specific Guidance (for Standalone / Dev Client builds) */}
          {Platform.OS === 'ios' && !status.backgroundLocation && !status.isExpoGo && (
            <View
              style={[
                styles.iosHintBox,
                {
                  backgroundColor: isDark ? 'rgba(79, 70, 229, 0.15)' : '#EEF2FF',
                  borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#C7D2FE',
                },
              ]}
            >
              <Ionicons name="information-circle" size={20} color="#4F46E5" style={{ marginTop: 1 }} />
              <View style={styles.hintContent}>
                <Text style={[styles.iosHintTitle, { color: colors.textMain }]}>
                  Why isn't "Always" shown in iOS prompt?
                </Text>
                <Text style={[styles.iosHintText, { color: colors.textSecondary }]}>
                  {status.foregroundLocation ? (
                    <>
                      Apple's privacy system does not display "Always" in the initial popup.{'\n\n'}
                      To record 24/7 timeline & alerts, tap <Text style={{ fontWeight: '700' }}>"Open Settings & Select Always"</Text> below, tap <Text style={{ fontWeight: '700' }}>Location</Text>, and choose <Text style={{ fontWeight: '700' }}>"Always"</Text>.
                    </>
                  ) : (
                    <>
                      Apple's initial prompt only displays <Text style={{ fontWeight: '700' }}>"Allow While Using App"</Text>. Select that first, then set Location to <Text style={{ fontWeight: '700' }}>"Always"</Text> in Settings.
                    </>
                  )}
                </Text>
              </View>
            </View>
          )}

          {/* Android Hint */}
          {Platform.OS === 'android' && !status.backgroundLocation && (
            <View style={[styles.androidHintBox, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.androidHintText, { color: colors.textSecondary }]}>
                On Android, please choose <Text style={{ fontWeight: '700' }}>"Allow all the time"</Text> in the
                system prompt or Settings.
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {status.allGranted ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10B981' }]}
                activeOpacity={0.85}
                onPress={handleClose}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Protection Active</Text>
              </TouchableOpacity>
            ) : Platform.OS === 'ios' && status.foregroundLocation && !status.backgroundLocation ? (
              // On iOS when foreground is already given, the system popup won't show again: direct them straight to Settings!
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={handleOpenSettings}
              >
                <Feather name="settings" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Open Settings & Select "Always"</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={handleRequestAll}
                disabled={loading}
              >
                {loading ? (
                  <InlineButtonLoader size={18} label="Checking Permissions..." />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Grant All Permissions</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!status.backgroundLocation && status.foregroundLocation && Platform.OS !== 'ios' && (
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.divider }]}
                activeOpacity={0.8}
                onPress={handleOpenSettings}
              >
                <Feather name="settings" size={16} color={colors.primary} />
                <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
                  Open App System Settings
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.skipBtn} activeOpacity={0.7} onPress={handleClose}>
              <Text style={[styles.skipBtnText, { color: colors.textMuted }]}>
                {status.allGranted ? 'Done' : 'Maybe Later'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    maxHeight: '90%',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  featuresList: {
    maxHeight: 250,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    gap: 12,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  requiredBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  requiredBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4F46E5',
  },
  featureDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  statusDotPending: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94A3B8',
  },
  androidHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  androidHintText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  iosHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  hintContent: {
    flex: 1,
  },
  iosHintTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  iosHintText: {
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
export default PermissionsModal;
