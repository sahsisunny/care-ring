import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Circle } from '../../models/Circle';
import { Colors } from '../../theme/colors';

interface InviteMemberModalProps {
  visible: boolean;
  circle: Circle;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  visible,
  circle,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my "${circle.name}" family circle on CareRing! Use invite code: ${circle.inviteCode}`,
      });
    } catch (_) {}
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              <Feather name="share-2" size={22} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Invite Family Member</Text>
          <Text style={styles.subtitle}>
            Share this 6-character code with your family members so they can join "{circle.name}".
          </Text>

          {/* Large Code Badge */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCopy}
            style={styles.codeCard}
          >
            <Text style={styles.codeText}>{circle.inviteCode}</Text>
            <View style={styles.copyRow}>
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={copied ? Colors.moving : Colors.primary}
              />
              <Text
                style={[
                  styles.copyLabel,
                  { color: copied ? Colors.moving : Colors.primary },
                ]}
              >
                {copied ? 'Code Copied!' : 'Tap to copy code'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionText}>
              1. Download and open CareRing{'\n'}
              2. Tap circle dropdown {'>'} "Join Circle"{'\n'}
              3. Enter <Text style={styles.codeHighlight}>{circle.inviteCode}</Text>
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleShare}
            style={styles.shareBtn}
          >
            <Feather name="send" size={16} color="#FFFFFF" />
            <Text style={styles.shareText}>Share Invite Code</Text>
          </TouchableOpacity>
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
  codeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#DBEAFE',
    borderStyle: 'dashed',
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    color: Colors.primary,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  instructionsBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  codeHighlight: {
    fontWeight: '800',
    color: Colors.primary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
