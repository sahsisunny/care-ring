import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

interface CreateBubbleModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmBubble: (radiusMeters: number, durationMinutes: number) => void;
}

export const CreateBubbleModal: React.FC<CreateBubbleModalProps> = ({
  visible,
  onClose,
  onConfirmBubble,
}) => {
  const { colors, isDark } = useTheme();
  const [selectedRadius, setSelectedRadius] = useState<number>(2000); // 2km
  const [selectedDuration, setSelectedDuration] = useState<number>(120); // 2 hours

  const radii = [
    { label: '1 km', value: 1000 },
    { label: '2 km', value: 2000 },
    { label: '5 km', value: 5000 },
  ];

  const durations = [
    { label: '1 hr', value: 60 },
    { label: '2 hrs', value: 120 },
    { label: '4 hrs', value: 240 },
    { label: '6 hrs', value: 360 },
  ];

  const handleCreate = () => {
    onConfirmBubble(selectedRadius, selectedDuration);
    onClose();
    Alert.alert(
      '🫧 Privacy Bubble Created',
      `Your circle now sees a generalized ${selectedRadius / 1000}km zone for ${selectedDuration / 60} hours. If a crash or SOS occurs, exact GPS will immediately restore.`
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.textMain }]}>Create a Bubble</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Temporary generalized location for privacy</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={[styles.infoBanner, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Your family will only see you inside this general bubble zone. In an emergency, your exact location bursts through automatically.
              </Text>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMain }]}>Bubble Radius</Text>
            <View style={styles.optionRow}>
              {radii.map((r) => {
                const isSelected = selectedRadius === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    activeOpacity={0.8}
                    onPress={() => setSelectedRadius(r.value)}
                    style={[
                      styles.optionPill,
                      { backgroundColor: isSelected ? colors.primary : colors.tileBg, borderColor: isSelected ? colors.primary : colors.tileBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMain }]}>Duration</Text>
            <View style={styles.optionRow}>
              {durations.map((d) => {
                const isSelected = selectedDuration === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    activeOpacity={0.8}
                    onPress={() => setSelectedDuration(d.value)}
                    style={[
                      styles.optionPill,
                      { backgroundColor: isSelected ? colors.primary : colors.tileBg, borderColor: isSelected ? colors.primary : colors.tileBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCreate}
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.submitBtnText}>Create Bubble</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  infoBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EDE9FE',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#4C1D95',
    lineHeight: 17,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  optionPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  activePill: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  activeText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
