import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { SOSAlertData } from '../../models/Telemetry';

interface TriggerSOSModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const TriggerSOSModal: React.FC<TriggerSOSModalProps> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    let timer: any = null;
    if (visible) {
      setCountdown(3);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onConfirm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="warning" size={36} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>EMERGENCY SOS</Text>
          <Text style={styles.description}>
            Broadcasting emergency distress alert and exact GPS position to your circle members in:
          </Text>

          <View style={styles.countdownBadge}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onConfirm} style={styles.sendNowBtn}>
              <Text style={styles.sendNowText}>SEND NOW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface IncomingSOSAlertModalProps {
  alert: SOSAlertData | null;
  onDismiss: () => void;
  onTrackNow: (lat: number, lng: number) => void;
}

export const IncomingSOSAlertModal: React.FC<IncomingSOSAlertModalProps> = ({
  alert,
  onDismiss,
  onTrackNow,
}) => {
  if (!alert) return null;

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 2 }]}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.sos }]}>
            <MaterialIcons name="emergency-share" size={36} color="#FFFFFF" />
          </View>

          <Text style={[styles.title, { color: Colors.sos }]}>EMERGENCY SOS ALERT</Text>
          <Text style={[styles.description, { color: '#7F1D1D' }]}>
            <Text style={{ fontWeight: '800' }}>{alert.userName}</Text> has triggered an Emergency SOS! Check their live coordinates immediately.
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={onDismiss} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>DISMISS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onTrackNow(alert.latitude, alert.longitude)}
              style={styles.sendNowBtn}
            >
              <Text style={styles.sendNowText}>TRACK NOW</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.sos,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.sos,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.sos,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  countdownBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.sosLight,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  countdownNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.sos,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  sendNowBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: Colors.sos,
  },
  sendNowText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
