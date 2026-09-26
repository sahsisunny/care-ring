import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { SOSAlertData } from '../../models/Telemetry';
import { MemberData } from '../../models/Member';

interface TriggerSOSModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  circleMembers?: MemberData[];
  currentUserId?: string;
}

export const TriggerSOSModal: React.FC<TriggerSOSModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  circleMembers = [],
  currentUserId,
}) => {
  const { colors, isDark } = useTheme();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    let timer: any = null;
    if (visible) {
      setCountdown(5);
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

  const handleCallEmergencyServices = () => {
    Linking.openURL('tel:112').catch(() => {
      Alert.alert('Calling Emergency Services', 'Dialing 112 / 911...');
    });
  };

  const handleCallContact = (phone: string, name: string) => {
    Linking.openURL(`tel:${phone.trim()}`).catch(() => {
      Alert.alert('Call Failed', `Could not initiate phone call to ${name}`);
    });
  };

  const emergencyContacts = circleMembers.filter(
    (m) => m.id !== currentUserId && m.phone && m.phone.trim().length > 0
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderWidth: 1.5,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Siren Icon with pulse aura */}
            <View style={styles.iconCircle}>
              <MaterialIcons name="warning" size={38} color="#FFFFFF" />
            </View>

            <Text style={styles.title}>EMERGENCY SOS</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Broadcasting distress alert and live GPS position to your family circle in:
            </Text>

            {/* Countdown Badge */}
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
            </View>

            {/* Primary Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onCancel}
                style={[
                  styles.cancelBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' },
                ]}
              >
                <Text style={[styles.cancelText, { color: colors.textMain }]}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onConfirm}
                style={styles.sendNowBtn}
              >
                <MaterialIcons name="emergency-share" size={18} color="#FFFFFF" />
                <Text style={styles.sendNowText}>BROADCAST NOW</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
              <Text style={styles.dividerText}>OR CALL DIRECTLY</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            </View>

            {/* 1-Tap Emergency Police / Ambulance Call */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.callServicesBtn,
                {
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2',
                },
              ]}
              onPress={handleCallEmergencyServices}
            >
              <View style={styles.callServicesIconWrap}>
                <Ionicons name="call" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.callServicesTextWrap}>
                <Text style={[styles.callServicesTitle, { color: colors.textMain }]}>Call Emergency Services</Text>
                <Text style={[styles.callServicesSubtitle, { color: colors.textSecondary }]}>Dial 112 / 911 dispatch immediately</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#EF4444" />
            </TouchableOpacity>

            {/* Family Members Quick Call List */}
            {emergencyContacts.length > 0 && (
              <View style={styles.contactsContainer}>
                <Text style={[styles.contactsHeader, { color: colors.textSecondary }]}>Call Family Contact:</Text>
                {emergencyContacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    activeOpacity={0.8}
                    style={[
                      styles.contactRow,
                      {
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F8FAFC',
                        borderColor: colors.cardBorder,
                      },
                    ]}
                    onPress={() => handleCallContact(contact.phone!, contact.fullName)}
                  >
                    <View style={styles.contactAvatarWrap}>
                      <Text style={styles.contactAvatarInitials}>
                        {contact.fullName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactName, { color: colors.textMain }]}>{contact.fullName}</Text>
                      <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>{contact.phone}</Text>
                    </View>
                    <View style={styles.callIconBtn}>
                      <Ionicons name="call" size={16} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
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

  const handleCallUser = () => {
    if (alert.phone && alert.phone.trim()) {
      Linking.openURL(`tel:${alert.phone.trim()}`).catch(() => {
        Alert.alert('Call Failed', `Could not initiate call to ${alert.userName}`);
      });
    } else {
      Alert.alert(
        'No Phone Number',
        `${alert.userName} has not registered a phone number yet. Try calling emergency dispatch.`
      );
    }
  };

  const handleCallEmergency = () => {
    Linking.openURL('tel:112').catch(() => {
      Alert.alert('Emergency Dispatch', 'Dialing 112...');
    });
  };

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 2.5 },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.sos }]}>
            <MaterialIcons name="emergency-share" size={38} color="#FFFFFF" />
          </View>

          <Text style={[styles.title, { color: Colors.sos }]}>EMERGENCY SOS ALERT</Text>
          <Text style={[styles.description, { color: '#7F1D1D' }]}>
            <Text style={{ fontWeight: '800' }}>{alert.userName}</Text> has triggered an
            Emergency SOS distress signal! Immediate assistance may be required.
          </Text>

          <View style={styles.coordBox}>
            <Feather name="map-pin" size={14} color="#EF4444" />
            <Text style={styles.coordText}>
              GPS: {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
            </Text>
          </View>

          {/* Action List */}
          <View style={styles.incomingActionsCol}>
            {/* 1. Call Distressed Member */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.incomingCallBtn}
              onPress={handleCallUser}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={styles.incomingCallBtnText}>
                Call {alert.userName} {alert.phone ? `(${alert.phone})` : ''}
              </Text>
            </TouchableOpacity>

            {/* 2. Call Emergency Dispatch */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.incomingDispatchBtn}
              onPress={handleCallEmergency}
            >
              <MaterialIcons name="local-police" size={18} color="#FFFFFF" />
              <Text style={styles.incomingDispatchBtnText}>
                Call Emergency Services (112 / 911)
              </Text>
            </TouchableOpacity>

            {/* 3. Track on Map */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onTrackNow(alert.latitude, alert.longitude)}
              style={styles.incomingTrackBtn}
            >
              <Feather name="navigation" size={18} color="#FFFFFF" />
              <Text style={styles.incomingTrackBtnText}>Track Coordinates on Map</Text>
            </TouchableOpacity>

            {/* 4. Dismiss */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onDismiss}
              style={styles.incomingDismissBtn}
            >
              <Text style={styles.incomingDismissText}>Dismiss Alert</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    maxHeight: '88%',
  },
  scrollContent: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.sos,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: Colors.sos,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
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
    paddingHorizontal: 8,
  },
  countdownBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.sosLight,
    borderWidth: 2.5,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  countdownNumber: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.sos,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  sendNowBtn: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sos,
    shadowColor: Colors.sos,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  sendNowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    paddingHorizontal: 10,
    letterSpacing: 0.5,
  },
  callServicesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  callServicesIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.sos,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  callServicesTextWrap: {
    flex: 1,
  },
  callServicesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  callServicesSubtitle: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
  },
  contactsContainer: {
    width: '100%',
    marginTop: 6,
  },
  contactsHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  contactAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contactAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  contactPhone: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  callIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  coordText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  incomingActionsCol: {
    width: '100%',
    gap: 10,
  },
  incomingCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  incomingCallBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  incomingDispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 13,
    borderRadius: 16,
  },
  incomingDispatchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  incomingTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 16,
  },
  incomingTrackBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  incomingDismissBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingDismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});
