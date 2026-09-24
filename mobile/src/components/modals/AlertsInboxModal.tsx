import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

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
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Alerts & Activity</Text>
              <Text style={styles.subtitle}>Recent notifications from {circleName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {alerts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="notifications-off-outline" size={44} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Recent Alerts</Text>
                <Text style={styles.emptySub}>
                  You're all caught up! Geofence arrivals, battery warnings, and SOS notifications will appear here.
                </Text>
              </View>
            ) : (
              alerts.map((alt) => (
                <View key={alt.id} style={styles.alertCard}>
                  <View style={[styles.iconWrap, { backgroundColor: `${alt.color}18` }]}>
                    <Ionicons name={alt.icon as any} size={22} color={alt.color} />
                  </View>
                  <View style={styles.infoWrap}>
                    <View style={styles.topRow}>
                      <Text style={styles.alertTitle}>{alt.title}</Text>
                      <Text style={styles.timeText}>{alt.time}</Text>
                    </View>
                    <Text style={styles.descText}>{alt.desc}</Text>
                    {alt.action && (
                      <TouchableOpacity
                        onPress={() => {
                          onClose();
                          alt.action?.();
                        }}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>{alt.actionLabel}</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
