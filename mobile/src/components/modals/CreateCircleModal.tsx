import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

interface CreateCircleModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export const CreateCircleModal: React.FC<CreateCircleModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName('');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create circle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.dialogCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderWidth: 1.5,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : colors.primaryLight }]}>
              <Ionicons name="people" size={24} color={colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: colors.textMain }]}>Create New Circle</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Circles allow you to organize family members, close friends, or teams.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sahsi Family, Roadtrippers"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.textMain,
              },
            ]}
            autoFocus
          />

          {error && <Text style={[styles.errorText, { color: colors.sos }]}>{error}</Text>}

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.cancelBtn,
                { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 },
              ]}
              disabled={loading}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreate}
              style={[
                styles.createBtn,
                { backgroundColor: colors.primary },
                (!name.trim() || loading) && styles.createBtnDisabled,
              ]}
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.createText}>Create Circle</Text>
              )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textMain,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: Colors.sos,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  createBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
