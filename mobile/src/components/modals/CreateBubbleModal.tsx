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
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Create a Bubble</Text>
              <Text style={styles.subtitle}>Temporary generalized location for privacy</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.infoBanner}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>
                Your family will only see you inside this general bubble zone. In an emergency, your exact location bursts through automatically.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Bubble Radius</Text>
            <View style={styles.optionRow}>
              {radii.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  activeOpacity={0.8}
                  onPress={() => setSelectedRadius(r.value)}
                  style={[
                    styles.optionPill,
                    selectedRadius === r.value && styles.activePill,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedRadius === r.value && styles.activeText,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.optionRow}>
              {durations.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  activeOpacity={0.8}
                  onPress={() => setSelectedDuration(d.value)}
                  style={[
                    styles.optionPill,
                    selectedDuration === d.value && styles.activePill,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedDuration === d.value && styles.activeText,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCreate}
              style={styles.submitBtn}
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
