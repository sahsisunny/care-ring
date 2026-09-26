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
import { useTheme } from '../../theme/ThemeContext';

interface SpeedingModalProps {
  visible: boolean;
  onClose: () => void;
  speedingData?: any;
}

export const SpeedingModal: React.FC<SpeedingModalProps> = ({
  visible,
  onClose,
  speedingData,
}) => {
  const { colors, isDark } = useTheme();
  const count = speedingData?.count ?? 0;
  const topSpeed = speedingData?.topSpeed ?? 0;
  const events = speedingData?.events || [];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <View style={styles.unlockedBadge}>
                <Ionicons name="lock-open" size={12} color="#10B981" />
                <Text style={styles.unlockedBadgeText}>UNLOCKED FEATURE</Text>
              </View>
              <Text style={[styles.title, { color: colors.textMain }]}>Speeding Insights</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{count} events this week • Top: {topSpeed} km/h</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.summaryCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <View style={styles.iconCircle}>
                <Ionicons name="speedometer" size={28} color="#FF6B6B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryTitle, { color: colors.textMain }]}>Detailed Speed Log</Text>
                <Text style={[styles.summaryDesc, { color: colors.textSecondary }]}>
                  Real-time GPS monitored vehicle speed compared against local road speed limits.
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Recorded Incidents</Text>

            {events.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                <Text style={[styles.emptyText, { color: colors.textMain }]}>Zero speeding incidents this week!</Text>
              </View>
            ) : (
              events.map((ev: any, idx: number) => (
                <View key={ev.id || idx} style={[styles.eventCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                  <View style={styles.eventTop}>
                    <View style={styles.speedPill}>
                      <Text style={styles.speedPillText}>{ev.speed} km/h</Text>
                    </View>
                    <Text style={[styles.limitText, { color: colors.textSecondary }]}>Limit: {ev.speedLimit} km/h</Text>
                    <View style={styles.excessBadge}>
                      <Text style={styles.excessBadgeText}>+{ev.excessSpeed} km/h</Text>
                    </View>
                  </View>

                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={14} color={colors.textMuted} />
                    <Text style={[styles.addressText, { color: colors.textSecondary }]}>{ev.address}</Text>
                  </View>

                  <Text style={[styles.timeText, { color: colors.textMuted }]}>{ev.timeFormatted}</Text>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  unlockedBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    paddingBottom: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF1F2',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9F1239',
  },
  summaryDesc: {
    fontSize: 12,
    color: '#881337',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  speedPill: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  speedPillText: {
    color: '#E11D48',
    fontWeight: '800',
    fontSize: 14,
  },
  limitText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  excessBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  excessBadgeText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 11,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    marginTop: 8,
  },
});
