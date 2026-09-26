import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { backgroundLocationService, PermissionsStatus } from '../../services/BackgroundLocationService';
import { useTheme } from '../../theme/ThemeContext';

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
    allGranted: false,
  });

  const checkStatus = async () => {
    const res = await backgroundLocationService.checkPermissions();
    setStatus(res);
  };

  useEffect(() => {
    if (visible) {
      checkStatus();
    }
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
          </ScrollView>

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
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={handleRequestAll}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {status.allGranted ? 'Protection Active' : 'Grant All Permissions'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {!status.backgroundLocation && status.foregroundLocation && (
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

            <TouchableOpacity style={styles.skipBtn} activeOpacity={0.7} onPress={onClose}>
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
