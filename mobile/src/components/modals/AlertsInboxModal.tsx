import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

export interface AlertItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  icon: string;
  color: string;
  action?: () => void;
  actionLabel?: string;
}

interface AlertsInboxModalProps {
  visible: boolean;
  onClose: () => void;
  circleName?: string;
  alerts?: AlertItem[];
  onViewReport?: () => void;
}

export const AlertsInboxModal: React.FC<AlertsInboxModalProps> = ({
  visible,
  onClose,
  circleName = 'Circle',
  alerts = [],
  onViewReport,
}) => {
  const { colors, isDark, isGlass } = useTheme();

  const webGlassCard =
    Platform.OS === 'web' && isGlass
      ? {
          backdropFilter: 'blur(30px) saturate(210%)',
          WebkitBackdropFilter: 'blur(30px) saturate(210%)',
          boxShadow: isDark
            ? 'inset 0 1px 0.8px rgba(255, 255, 255, 0.22), 0 8px 32px rgba(0, 0, 0, 0.4)'
            : 'inset 0 1px 1.2px rgba(255, 255, 255, 0.95), 0 8px 28px rgba(0, 0, 0, 0.08)',
        }
      : {};

  const webGlassTile =
    Platform.OS === 'web' && isGlass
      ? {
          backdropFilter: 'blur(20px) saturate(190%)',
          WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          boxShadow: isDark
            ? 'inset 0 1px 0.5px rgba(255, 255, 255, 0.16)'
            : 'inset 0 1px 0.8px rgba(255, 255, 255, 0.9)',
        }
      : {};

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderTopWidth: 1.5,
              borderLeftWidth: 1.5,
              borderRightWidth: 1.5,
            },
            webGlassCard,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.textMain }]}>Alerts & Activity</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Recent notifications from {circleName}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {alerts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="notifications-off-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textMain }]}>No Recent Alerts</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  You're all caught up! Geofence arrivals, battery warnings, and SOS notifications will appear here.
                </Text>
              </View>
            ) : (
              alerts.map((alt) => (
                <View
                  key={alt.id}
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor: colors.tileBg,
                      borderColor: colors.tileBorder,
                    },
                    webGlassTile,
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${alt.color}18` }]}>
                    <Ionicons name={alt.icon as any} size={22} color={alt.color} />
                  </View>
                  <View style={styles.infoWrap}>
                    <View style={styles.topRow}>
                      <Text style={[styles.alertTitle, { color: colors.textMain }]}>{alt.title}</Text>
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>{alt.time}</Text>
                    </View>
                    <Text style={[styles.descText, { color: colors.textSecondary }]}>{alt.desc}</Text>
                    {alt.action && (
                      <TouchableOpacity
                        onPress={() => {
                          onClose();
                          alt.action?.();
                        }}
                        style={styles.actionBtn}
                      >
                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>{alt.actionLabel}</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoWrap: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  descText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 3,
    lineHeight: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  emptyWrap: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
