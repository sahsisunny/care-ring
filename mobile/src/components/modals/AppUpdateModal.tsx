import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { appUpdateService, AppUpdateInfo, UpdateState } from '../../services/AppUpdateService';
import { hapticService } from '../../services/HapticService';

const { height: SCREEN_H } = Dimensions.get('window');

export const AppUpdateModal: React.FC = () => {
  const { colors, isDark, isGlass } = useTheme();

  const [visible, setVisible] = useState(appUpdateService.getIsModalVisible());
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(appUpdateService.getUpdateInfo());
  const [updateState, setUpdateState] = useState<UpdateState>(appUpdateService.getState());
  const [progress, setProgress] = useState<number>(appUpdateService.getDownloadProgress());

  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = appUpdateService.subscribe(() => {
      setVisible(appUpdateService.getIsModalVisible());
      setUpdateInfo(appUpdateService.getUpdateInfo());
      setUpdateState(appUpdateService.getState());
      setProgress(appUpdateService.getDownloadProgress());
    });

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_H,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    if (updateInfo?.isMandatory) return;
    hapticService.light();
    appUpdateService.closeUpdateModal();
  };

  const handleActionPress = () => {
    hapticService.medium();
    appUpdateService.installOrOpenStore();
  };

  if (!visible && slideAnim === (SCREEN_H as any)) {
    return null;
  }

  const isDownloading = updateState === 'downloading';
  const isReady = updateState === 'ready';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Dimmed backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
          disabled={Boolean(updateInfo?.isMandatory)}
        />
      </Animated.View>

      {/* Sheet Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            transform: [{ translateY: slideAnim }],
          },
          isDark ? styles.panelShadowDark : styles.panelShadowLight,
        ]}
      >
        {/* Header (Clean & plain without drawer pill) */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.textMain }]}>
              {updateInfo?.isMandatory ? 'Required App Update' : 'What’s New in CareRing'}
            </Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>v{updateInfo?.version || '1.0.5'}</Text>
            </View>
          </View>

          {!updateInfo?.isMandatory && (
            <TouchableOpacity
              onPress={handleClose}
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* App Branding Hero Card */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#F0F9FF',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.22)' : '#BAE6FD',
              },
            ]}
          >
            <View style={styles.heroIconCircle}>
              <Ionicons name="sparkles" size={26} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroHeading, { color: colors.textMain }]}>
                {updateInfo?.releaseTitle || 'CareRing v1.0.5 Release'}
              </Text>
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                Enhanced for precision live tracking, low latency & rich maps
              </Text>
            </View>
          </View>

          {/* Release Specifications Pill Row */}
          <View style={styles.specRow}>
            <View
              style={[
                styles.specChip,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
              ]}
            >
              <Ionicons name="download-outline" size={14} color={colors.primary} />
              <Text style={[styles.specChipText, { color: colors.textSecondary }]}>
                {updateInfo?.downloadSize || '28.4 MB'}
              </Text>
            </View>

            <View
              style={[
                styles.specChip,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
              ]}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={[styles.specChipText, { color: colors.textSecondary }]}>
                {updateInfo?.releaseDate || 'Oct 2026'}
              </Text>
            </View>

            <View
              style={[
                styles.specChip,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
              <Text style={[styles.specChipText, { color: '#10B981' }]}>Verified Safe</Text>
            </View>
          </View>

          {/* Changelog Items */}
          <Text style={[styles.sectionHeading, { color: colors.textMain }]}>Key Highlights</Text>
          <View style={styles.changelogList}>
            {(updateInfo?.releaseNotes || []).map((note, index) => (
              <View
                key={index}
                style={[
                  styles.changelogCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.noteIconCircle}>
                  <Ionicons name={note.icon as any} size={19} color={colors.primary} />
                </View>
                <View style={styles.noteTextWrap}>
                  <Text style={[styles.noteTitle, { color: colors.textMain }]}>{note.title}</Text>
                  <Text style={[styles.noteDesc, { color: colors.textSecondary }]}>
                    {note.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer Actions & Live Download State */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {isDownloading ? (
            <View style={styles.downloadProgressWrap}>
              <View style={styles.progressHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.progressStatusText, { color: colors.textMain }]}>
                    Downloading CareRing v{updateInfo?.version}...
                  </Text>
                </View>
                <Text style={[styles.progressPercentText, { color: colors.primary }]}>
                  {progress}%
                </Text>
              </View>

              {/* Progress bar track */}
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' },
                ]}
              >
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progress}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.downloadSub, { color: colors.textMuted }]}>
                {((28.4 * progress) / 100).toFixed(1)} MB of 28.4 MB completed
              </Text>
            </View>
          ) : isReady ? (
            <View style={styles.readyWrap}>
              <View style={styles.readyBadgeRow}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.readyBadgeText}>Download Complete • Ready to apply</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleActionPress}
                style={[styles.primaryActionBtn, { backgroundColor: '#10B981' }]}
              >
                <Ionicons name="reload" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionBtnText}>Restart & Install Now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionButtonsCol}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleActionPress}
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="download-outline" size={19} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionBtnText}>
                  Update Now ({updateInfo?.downloadSize || '28.4 MB'})
                </Text>
              </TouchableOpacity>

              {!updateInfo?.isMandatory && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleClose}
                  style={styles.secondaryActionBtn}
                >
                  <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                    Remind Me Later
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 0,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_H * 0.88,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 6,
    zIndex: 1,
  },
  panelShadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 24,
  },
  panelShadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  newBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    maxHeight: SCREEN_H * 0.58,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.2,
    marginBottom: 14,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  specChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  changelogList: {
    gap: 10,
  },
  changelogCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noteTextWrap: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  noteDesc: {
    fontSize: 12,
    lineHeight: 16.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Math.max(Platform.OS === 'ios' ? 34 : 20, 20),
    borderTopWidth: 1,
  },
  actionButtonsCol: {
    gap: 8,
  },
  primaryActionBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryActionBtn: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  downloadProgressWrap: {
    gap: 8,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  downloadSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  readyWrap: {
    gap: 10,
  },
  readyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  readyBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
});
