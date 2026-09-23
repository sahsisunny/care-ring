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

interface JoinCircleModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}

export const JoinCircleModal: React.FC<JoinCircleModalProps> = ({
  visible,
  onClose,
  onJoin,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onJoin(code.trim().toUpperCase());
      setCode('');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Invalid invite code');
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
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="key" size={22} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Join a Circle</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character invitation code provided by the circle admin.
          </Text>

          <TextInput
            value={code}
            onChangeText={(txt) => setCode(txt.toUpperCase())}
            placeholder="e.g. FAM-1234"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            autoCapitalize="characters"
            maxLength={10}
            autoFocus
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleJoin}
              style={[
                styles.joinBtn,
                (!code.trim() || loading) && styles.joinBtnDisabled,
              ]}
              disabled={!code.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.joinText}>Join Circle</Text>
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
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
    color: Colors.textMain,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: Colors.sos,
    marginBottom: 12,
    textAlign: 'center',
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
  joinBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
