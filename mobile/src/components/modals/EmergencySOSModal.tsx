import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { SOSAlertData } from '../../models/Telemetry';
import { MemberData } from '../../models/Member';
import { Avatar } from '../Avatar';
import { sirenService } from '../../services/SirenService';
import { hapticService } from '../../services/HapticService';

interface TriggerSOSModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  circleMembers?: MemberData[];
  currentUserId?: string;
  placeName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const TriggerSOSModal: React.FC<TriggerSOSModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  circleMembers = [],
  currentUserId,
  placeName,
  address,
  latitude,
  longitude,
}) => {
  const { colors, isDark } = useTheme();
  const [countdown, setCountdown] = useState(5);
  const onConfirmRef = useRef(onConfirm);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    let timer: any = null;
    if (visible) {
      hasTriggeredRef.current = false;
      setCountdown(5);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            if (!hasTriggeredRef.current) {
              hasTriggeredRef.current = true;
              setTimeout(() => {
                onConfirmRef.current?.();
              }, 0);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(5);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible]);

  const contactsScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (visible) {
      contactsScrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [visible]);

  const handleManualBroadcast = () => {
    hasTriggeredRef.current = true;
    onConfirm();
  };

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

  // Members with a phone number (exclude self)
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
          {/* ── STATIC TOP SECTION ── */}
          <View style={styles.topSection}>
            {/* Siren Icon */}
            <View style={styles.iconCircle}>
              <MaterialIcons name="warning" size={38} color="#FFFFFF" />
            </View>

            <Text style={styles.title}>EMERGENCY SOS</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Broadcasting distress alert and live GPS position to your family circle in:
            </Text>

            {/* Live Location & Coordinates Broadcast Card */}
            {(Boolean(placeName) || (latitude != null && longitude != null)) && (
              <View
                style={[
                  styles.broadcastLocationCard,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.broadcastLocationHeader}>
                  <View style={styles.broadcastPinIconWrap}>
                    <Feather name="map-pin" size={15} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.broadcastPlaceTitle, { color: colors.textMain }]}
                      numberOfLines={1}
                    >
                      {placeName || 'Current Location'}
                    </Text>
                    {!!address && address !== placeName && (
                      <Text
                        style={[styles.broadcastAddressText, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {address}
                      </Text>
                    )}
                  </View>
                </View>

                {latitude != null && longitude != null && (
                  <View style={styles.broadcastGpsRow}>
                    <View
                      style={[
                        styles.broadcastGpsChip,
                        { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#FFFFFF' },
                      ]}
                    >
                      <Text style={styles.broadcastGpsLabel}>LAT</Text>
                      <Text style={[styles.broadcastGpsValue, { color: colors.textMain }]}>
                        {latitude.toFixed(5)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.broadcastGpsChip,
                        { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#FFFFFF' },
                      ]}
                    >
                      <Text style={styles.broadcastGpsLabel}>LONG</Text>
                      <Text style={[styles.broadcastGpsValue, { color: colors.textMain }]}>
                        {longitude.toFixed(5)}
                      </Text>
                    </View>
                    <View style={styles.broadcastLiveBadge}>
                      <View style={styles.broadcastLiveDot} />
                      <Text style={styles.broadcastLiveText}>LIVE GPS</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

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
                onPress={handleManualBroadcast}
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
                <Text style={[styles.callServicesTitle, { color: colors.textMain }]}>
                  Call Emergency Services
                </Text>
                <Text style={[styles.callServicesSubtitle, { color: colors.textSecondary }]}>
                  Dial 112 / 911 dispatch immediately
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* ── SCROLLABLE CONTACT LIST ── */}
          {emergencyContacts.length > 0 && (
            <View style={styles.contactsContainer}>
              <Text style={[styles.contactsHeader, { color: colors.textSecondary }]}>
                Call Family Contact ({emergencyContacts.length}):
              </Text>

              {/* Only this section scrolls */}
              <ScrollView
                ref={contactsScrollRef}
                style={styles.contactsScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
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
                    {/* Avatar with real image or initials fallback */}
                    <Avatar
                      name={contact.fullName}
                      avatarUrl={contact.avatarUrl}
                      size={42}
                      borderWidth={1.5}
                      borderColor={isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0'}
                    />

                    {/* Name + Phone */}
                    <View style={styles.contactInfo}>
                      <Text
                        style={[styles.contactName, { color: colors.textMain }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {contact.fullName}
                      </Text>
                      <Text
                        style={[styles.contactPhone, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {contact.phone}
                      </Text>
                    </View>

                    {/* Green Call Button */}
                    <TouchableOpacity
                      style={styles.callIconBtn}
                      onPress={() => handleCallContact(contact.phone!, contact.fullName)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="call" size={17} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};



interface IncomingSOSAlertModalProps {
  alert: SOSAlertData | null;
  onDismiss: () => void;
  onTrackNow: (lat: number, lng: number) => void;
  victimMember?: MemberData | null;
}

export const IncomingSOSAlertModal: React.FC<IncomingSOSAlertModalProps> = ({
  alert,
  onDismiss,
  onTrackNow,
  victimMember,
}) => {
  if (!alert) return null;

  const [isSirenMuted, setIsSirenMuted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Immediately blare loud emergency siren on family member's device
    sirenService.playSiren();
    setIsSirenMuted(false);

    // 2. Pulse beacon ring animation
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
      sirenService.stopSiren();
    };
  }, [alert]);

  const handleToggleSiren = async () => {
    if (isSirenMuted) {
      await sirenService.playSiren();
      setIsSirenMuted(false);
    } else {
      await sirenService.stopSiren();
      setIsSirenMuted(true);
    }
  };

  const handleDismiss = () => {
    sirenService.stopSiren();
    onDismiss();
  };

  const handleTrackNow = () => {
    sirenService.stopSiren();
    onTrackNow(alert.latitude, alert.longitude);
  };

  const handleCallUser = () => {
    const phone = alert.phone || victimMember?.phone;
    if (phone && phone.trim()) {
      Linking.openURL(`tel:${phone.trim()}`).catch(() => {
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

  const handleOpenExternalMaps = () => {
    const lat = alert.latitude;
    const lng = alert.longitude;
    const label = encodeURIComponent(`${alert.userName} - SOS Emergency`);
    const scheme = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(scheme!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const battery = victimMember?.batteryLevel ?? null;
  const isCharging = victimMember?.isCharging ?? false;
  const speed = victimMember?.speed ? Math.round(victimMember.speed) : 0;
  const placeTitle =
    alert.placeName ||
    (alert.address ? alert.address.split(',')[0].trim() : null) ||
    (victimMember?.resolvedAddress ? victimMember.resolvedAddress.split(',')[0].trim() : null) ||
    'Distress Location';
  const fullAddress =
    alert.address ||
    victimMember?.resolvedAddress ||
    null;

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 2.5 },
          ]}
        >
          {/* Pulsing Siren Icon with animated beacon ring */}
          <View style={styles.beaconWrap}>
            <Animated.View
              style={[
                styles.beaconPulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: isSirenMuted ? 0.2 : 0.6,
                },
              ]}
            />
            {victimMember?.avatarUrl ? (
              <Avatar
                name={alert.userName}
                avatarUrl={victimMember.avatarUrl}
                size={64}
                borderWidth={3}
                borderColor="#EF4444"
              />
            ) : (
              <View style={[styles.iconCircle, { backgroundColor: Colors.sos, marginBottom: 0 }]}>
                <MaterialIcons name="emergency-share" size={38} color="#FFFFFF" />
              </View>
            )}
          </View>

          <Text style={[styles.title, { color: Colors.sos, marginTop: 12 }]}>EMERGENCY SOS ALERT</Text>

          {/* Quick Siren Silence / Sound Toggle */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.sirenStatusBadge,
              { backgroundColor: isSirenMuted ? '#64748B' : '#DC2626' },
            ]}
            onPress={handleToggleSiren}
          >
            <Ionicons name={isSirenMuted ? 'volume-mute' : 'volume-high'} size={15} color="#FFFFFF" />
            <Text style={styles.sirenStatusText}>
              {isSirenMuted ? 'SIREN MUTED • TAP TO SOUND' : '🚨 SIREN BLARING • TAP TO MUTE'}
            </Text>
          </TouchableOpacity>

          {/* Find My Style Volume & Silent Bypass Status Badge */}
          {!isSirenMuted && (
            <View style={styles.findMyAlertPill}>
              <Ionicons name="volume-high" size={13} color="#991B1B" />
              <Text style={styles.findMyAlertText}>
                MAX VOLUME • OVERRIDING SILENT MODE
              </Text>
            </View>
          )}

          <Text style={[styles.description, { color: '#7F1D1D', marginBottom: 10 }]}>
            <Text style={{ fontWeight: '800' }}>{alert.userName}</Text> triggered an
            Emergency SOS distress signal! Immediate assistance may be needed.
          </Text>

          {/* Real-time Telemetry Status Pill (Battery, Speed, Movement) */}
          <View style={styles.telemetryRow}>
            {battery !== null && (
              <View style={styles.telemetryChip}>
                <Ionicons
                  name={isCharging ? 'battery-charging' : battery < 20 ? 'battery-dead' : 'battery-half'}
                  size={14}
                  color={battery < 20 ? '#EF4444' : '#15803D'}
                />
                <Text style={styles.telemetryChipText}>{battery}%</Text>
              </View>
            )}

            <View style={styles.telemetryChip}>
              <Ionicons
                name={speed > 15 ? 'car-outline' : victimMember?.isStationary ? 'hand-right-outline' : 'walk-outline'}
                size={14}
                color="#B91C1C"
              />
              <Text style={styles.telemetryChipText}>
                {speed > 15 ? `${speed} km/h` : victimMember?.isStationary ? 'Stationary' : 'Active'}
              </Text>
            </View>
          </View>

          {/* Prominent Place Name, Address & Exact GPS Coordinates Card */}
          <View style={styles.incomingLocationCard}>
            <View style={styles.incomingLocationHeader}>
              <View style={styles.incomingPinWrap}>
                <MaterialIcons name="place" size={18} color="#DC2626" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.incomingPlaceTitle} numberOfLines={1}>
                  {placeTitle}
                </Text>
                {!!fullAddress && fullAddress !== placeTitle && (
                  <Text style={styles.incomingAddressText} numberOfLines={2}>
                    {fullAddress}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.incomingGpsRow}>
              <View style={styles.incomingGpsPill}>
                <Ionicons name="navigate" size={12} color="#991B1B" />
                <Text style={styles.incomingGpsText}>
                  GPS: {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
                </Text>
              </View>
              <View style={styles.liveBeaconChip}>
                <View style={styles.liveBeaconDot} />
                <Text style={styles.liveBeaconText}>LIVE FIX</Text>
              </View>
            </View>
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

            {/* 3. Navigation Directions */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleOpenExternalMaps}
              style={styles.incomingDirectionsBtn}
            >
              <MaterialIcons name="directions" size={18} color="#FFFFFF" />
              <Text style={styles.incomingDirectionsBtnText}>Directions in Maps (Navigate)</Text>
            </TouchableOpacity>

            {/* 4. Track on Map */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleTrackNow}
              style={styles.incomingTrackBtn}
            >
              <Feather name="navigation" size={16} color="#FFFFFF" />
              <Text style={styles.incomingTrackBtnText}>Track Coordinates in App</Text>
            </TouchableOpacity>

            {/* 5. Dismiss */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDismiss}
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    maxHeight: '92%',
  },
  topSection: {
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
    marginTop: 4,
    paddingBottom: 8,
  },
  contactsScroll: {
    maxHeight: 200,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  broadcastLocationCard: {
    width: '100%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  broadcastLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  broadcastPinIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastPlaceTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  broadcastAddressText: {
    fontSize: 11,
    marginTop: 2,
  },
  broadcastGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  broadcastGpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  broadcastGpsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  broadcastGpsValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  broadcastLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  broadcastLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  broadcastLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  incomingLocationCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    padding: 12,
    marginBottom: 16,
  },
  incomingLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  incomingPinWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingPlaceTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#991B1B',
  },
  incomingAddressText: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 16,
  },
  incomingGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  incomingGpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  incomingGpsText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
  liveBeaconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveBeaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  liveBeaconText: {
    fontSize: 10,
    fontWeight: '900',
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
  beaconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 6,
    marginBottom: 4,
  },
  beaconPulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EF4444',
  },
  sirenStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 2,
    marginBottom: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sirenStatusText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  findMyAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: -4,
    marginBottom: 10,
  },
  findMyAlertText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 0.4,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    width: '100%',
  },
  telemetryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  telemetryChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7F1D1D',
  },
  incomingDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 16,
  },
  incomingDirectionsBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
