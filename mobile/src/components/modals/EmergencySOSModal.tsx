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
import { notificationService } from '../../services/NotificationService';

/**
 * Intelligent name formatter that avoids returning lone honorifics like "Mr." or "Dr."
 */
const formatDisplayName = (fullName: string): string => {
  if (!fullName) return 'Member';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const prefixes = ['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.', 'er', 'er.', 'prof', 'prof.'];
  if (prefixes.includes(parts[0].toLowerCase()) && parts.length > 1) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
};

/**
 * Resolves personal nickname if available, falling back to a clean formatted first name.
 */
const getMemberDisplayName = (
  member: MemberData,
  nicknames?: Record<string, string>
): string => {
  const fromMap = nicknames?.[member.id]?.trim();
  if (fromMap) return fromMap;

  if (member.nickname && member.nickname.trim()) {
    return member.nickname.trim();
  }

  return formatDisplayName(member.fullName);
};

interface TriggerSOSModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  circleMembers?: MemberData[];
  nicknames?: Record<string, string>;
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
  nicknames = {},
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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    let timer: any = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (visible) {
      hasTriggeredRef.current = false;
      setCountdown(5);

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

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
      if (pulseLoop) pulseLoop.stop();
    };
  }, [visible]);

  const handleManualBroadcast = () => {
    hasTriggeredRef.current = true;
    onConfirm();
  };

  const handleCallEmergencyServices = () => {
    Linking.openURL('tel:112').catch(() => {
      Alert.alert('Emergency Services', 'Dialing 112 / 911 dispatch...');
    });
  };

  const handleCallContact = (phone: string, name: string) => {
    Linking.openURL(`tel:${phone.trim()}`).catch(() => {
      Alert.alert('Call Failed', `Could not initiate phone call to ${name}`);
    });
  };

  // Circle members with a phone number (exclude self)
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
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.45)' : '#FECACA',
              borderWidth: 1.5,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.cardScrollContent}
          >
            {/* ── ENGAGING HEADER & COUNTDOWN BEACON ── */}
            <View style={styles.headerSection}>
              <View style={styles.countdownBeaconWrapper}>
                <Animated.View
                  style={[
                    styles.countdownBeaconRing,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={styles.countdownCenterCircle}>
                  <Text style={styles.countdownNumber}>{countdown}</Text>
                </View>
              </View>

              <View style={styles.headerTitleBadge}>
                <MaterialIcons name="warning" size={16} color="#EF4444" />
                <Text style={styles.headerTitleText}>EMERGENCY SOS</Text>
              </View>

              <Text style={[styles.headerSubtitleText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                Broadcasting distress signal and live GPS in{' '}
                <Text style={{ fontWeight: '900', color: '#EF4444' }}>{countdown} seconds</Text>
              </Text>
            </View>

            {/* ── LIVE LOCATION PILL ── */}
            {(Boolean(placeName) || (latitude != null && longitude != null)) && (
              <View
                style={[
                  styles.locationPill,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.locationPinCircle}>
                  <Feather name="map-pin" size={13} color="#EF4444" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.locationPlaceTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                    numberOfLines={1}
                  >
                    {placeName || 'Current Location'}
                  </Text>
                  {latitude != null && longitude != null && (
                    <Text
                      style={[styles.locationCoordsSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}
                      numberOfLines={1}
                    >
                      GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </Text>
                  )}
                </View>
                <View style={styles.liveTagBadge}>
                  <View style={styles.liveTagDot} />
                  <Text style={styles.liveTagText}>LIVE</Text>
                </View>
              </View>
            )}

            {/* ── PRIMARY BROADCAST / CANCEL BUTTONS ── */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onCancel}
                style={[
                  styles.cancelBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                  CANCEL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleManualBroadcast}
                style={styles.broadcastBtn}
              >
                <MaterialIcons name="emergency-share" size={17} color="#FFFFFF" />
                <Text style={styles.broadcastBtnText}>BROADCAST NOW</Text>
              </TouchableOpacity>
            </View>

            {/* ── OR CALL DIRECTLY DIVIDER ── */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
              <Text style={styles.dividerText}>OR CALL DIRECTLY</Text>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
            </View>

            {/* ── 1-TAP EMERGENCY SERVICES (112 / 911) ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.emergencyServicesBtn,
                {
                  backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.45)' : '#FECACA',
                },
              ]}
              onPress={handleCallEmergencyServices}
            >
              <View style={styles.servicesIconCircle}>
                <Ionicons name="call" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.servicesTitle, { color: isDark ? '#FFFFFF' : '#991B1B' }]}>
                  Call Emergency Services
                </Text>
                <Text style={[styles.servicesSubtitle, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                  Dial 112 / 911 dispatch immediately
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#EF4444" />
            </TouchableOpacity>

            {/* ── CIRCLE MEMBERS HORIZONTALLY SCROLLABLE SQUARE CARDS ── */}
            {emergencyContacts.length > 0 && (
              <View style={styles.contactsSection}>
                <View style={styles.contactsHeaderRow}>
                  <Text style={[styles.contactsSectionTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Circle Members ({emergencyContacts.length})
                  </Text>
                  <Text style={styles.tapToCallHintText}>Swipe • Tap to Call</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalContactsScroll}
                  nestedScrollEnabled
                >
                  {emergencyContacts.map((contact) => {
                    const memberName = getMemberDisplayName(contact, nicknames);
                    return (
                      <TouchableOpacity
                        key={contact.id}
                        activeOpacity={0.8}
                        style={[
                          styles.squareContactCard,
                          {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.75)' : '#F8FAFC',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                          },
                        ]}
                        onPress={() => handleCallContact(contact.phone!, contact.fullName)}
                      >
                        <View style={styles.squareAvatarWrap}>
                          <Avatar
                            name={contact.fullName}
                            avatarUrl={contact.avatarUrl}
                            size={44}
                            borderWidth={2}
                            borderColor={isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1'}
                          />
                          <View style={styles.squareCallBadge}>
                            <Ionicons name="call" size={10} color="#FFFFFF" />
                          </View>
                        </View>

                        <Text
                          style={[styles.squareContactName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                          numberOfLines={1}
                        >
                          {memberName}
                        </Text>

                        <View style={styles.squareCallActionBtn}>
                          <Ionicons name="call" size={9} color="#FFFFFF" />
                          <Text style={styles.squareCallActionText}>Call</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
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
  victimMember?: MemberData | null;
  nicknames?: Record<string, string>;
}

export const IncomingSOSAlertModal: React.FC<IncomingSOSAlertModalProps> = ({
  alert,
  onDismiss,
  onTrackNow,
  victimMember,
  nicknames = {},
}) => {
  if (!alert) return null;

  const { colors, isDark } = useTheme();
  const initialSoundAllowed = notificationService.isSoundEnabled();
  const [isSirenMuted, setIsSirenMuted] = useState(!initialSoundAllowed);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const soundAllowed = notificationService.isSoundEnabled();
    if (soundAllowed) {
      sirenService.playSiren();
      setIsSirenMuted(false);
    } else {
      sirenService.stopSiren();
      setIsSirenMuted(true);
    }

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

    // Listen to real-time notification preference toggles
    const unsub = notificationService.subscribePreferences((prefs) => {
      const allowed = Boolean(prefs.enabled && prefs.soundEnabled);
      if (!allowed) {
        sirenService.stopSiren();
        setIsSirenMuted(true);
      }
    });

    return () => {
      loop.stop();
      unsub();
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

  const victimNick =
    (alert && nicknames?.[alert.userId]?.trim()) ||
    victimMember?.nickname?.trim() ||
    null;

  const displayName = victimNick || formatDisplayName(alert.userName || 'Member');

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.5)' : '#FECACA',
              borderWidth: 2,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.cardScrollContent}
          >
            {/* ── BEACON AVATAR & RADIATING HALO ── */}
            <View style={styles.beaconWrapper}>
              <Animated.View
                style={[
                  styles.beaconRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: isSirenMuted ? 0.2 : 0.65,
                  },
                ]}
              />
              {victimMember?.avatarUrl ? (
                <Avatar
                  name={alert.userName}
                  avatarUrl={victimMember.avatarUrl}
                  size={60}
                  borderWidth={3}
                  borderColor="#EF4444"
                />
              ) : (
                <View style={[styles.beaconFallback, { backgroundColor: '#DC2626' }]}>
                  <MaterialIcons name="emergency-share" size={32} color="#FFFFFF" />
                </View>
              )}
            </View>

            <Text style={styles.incomingAlertTitle}>EMERGENCY SOS ALERT</Text>

            {/* ── UNIFIED SIREN & MAX VOLUME STATUS STRIP ── */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.sirenToggleStrip,
                { backgroundColor: isSirenMuted ? '#64748B' : '#DC2626' },
              ]}
              onPress={handleToggleSiren}
            >
              <Ionicons
                name={isSirenMuted ? 'volume-mute' : 'volume-high'}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.sirenToggleText}>
                {isSirenMuted
                  ? (!notificationService.isSoundEnabled()
                      ? '🔇 SOUND DISABLED IN SETTINGS • TAP TO SOUND'
                      : 'SIREN MUTED • TAP TO SOUND')
                  : '🚨 SIREN BLARING • TAP TO MUTE'}
              </Text>
              {!isSirenMuted && (
                <View style={styles.maxVolChip}>
                  <Text style={styles.maxVolChipText}>MAX VOL</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── DISTRESS SUMMARY TEXT ── */}
            <Text style={[styles.distressDescText, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>
              <Text style={{ fontWeight: '900', color: '#EF4444' }}>
                {victimNick ? `${victimNick} (${alert.userName})` : alert.userName}
              </Text>{' '}
              triggered an Emergency SOS distress signal! Immediate assistance may be needed.
            </Text>

            {/* ── TELEMETRY CHIPS (Battery & Movement) ── */}
            <View style={styles.telemetryRow}>
              {battery !== null && (
                <View
                  style={[
                    styles.telemetryPill,
                    {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#F8FAFC',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                    },
                  ]}
                >
                  <Ionicons
                    name={isCharging ? 'battery-charging' : battery < 20 ? 'battery-dead' : 'battery-half'}
                    size={13}
                    color={battery < 20 ? '#EF4444' : '#10B981'}
                  />
                  <Text style={[styles.telemetryPillText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                    {battery}%
                  </Text>
                </View>
              )}

              <View
                style={[
                  styles.telemetryPill,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                  },
                ]}
              >
                <Ionicons
                  name={speed > 15 ? 'car-outline' : victimMember?.isStationary ? 'hand-right-outline' : 'walk-outline'}
                  size={13}
                  color="#EF4444"
                />
                <Text style={[styles.telemetryPillText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  {speed > 15 ? `${speed} km/h` : victimMember?.isStationary ? 'Stationary' : 'Active'}
                </Text>
              </View>
            </View>

            {/* ── DISTRESS LOCATION CARD ── */}
            <View
              style={[
                styles.incomingLocationBox,
                {
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : '#F8FAFC',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                },
              ]}
            >
              <View style={styles.incomingLocationHeader}>
                <View style={styles.incomingPinBadge}>
                  <MaterialIcons name="place" size={16} color="#DC2626" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.incomingPlaceTitle, { color: isDark ? '#FFFFFF' : '#991B1B' }]}
                    numberOfLines={1}
                  >
                    {placeTitle}
                  </Text>
                  {!!fullAddress && fullAddress !== placeTitle && (
                    <Text
                      style={[styles.incomingAddressSub, { color: isDark ? '#94A3B8' : '#7F1D1D' }]}
                      numberOfLines={1}
                    >
                      {fullAddress}
                    </Text>
                  )}
                </View>
              </View>

              <View style={[styles.incomingGpsRow, { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FEE2E2' }]}>
                <Text style={[styles.incomingGpsCoords, { color: isDark ? '#CBD5E1' : '#991B1B' }]}>
                  GPS: {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
                </Text>
                <View style={styles.liveFixBadge}>
                  <View style={styles.liveFixDot} />
                  <Text style={styles.liveFixText}>LIVE FIX</Text>
                </View>
              </View>
            </View>

            {/* ── HIGH-CONVEX 2x2 ACTION GRID ── */}
            <View style={styles.gridContainer}>
              {/* Row 1: Direct Voice Calls */}
              <View style={styles.gridRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.gridTile, { backgroundColor: '#059669' }]}
                  onPress={handleCallUser}
                >
                  <Ionicons name="call" size={17} color="#FFFFFF" />
                  <View style={styles.gridTileTextCol}>
                    <Text style={styles.gridTileTitle} numberOfLines={1}>
                      Call {displayName}
                    </Text>
                    <Text style={styles.gridTileSub} numberOfLines={1}>
                      {alert.phone || 'Phone'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.gridTile, { backgroundColor: '#DC2626' }]}
                  onPress={handleCallEmergency}
                >
                  <MaterialIcons name="local-police" size={18} color="#FFFFFF" />
                  <View style={styles.gridTileTextCol}>
                    <Text style={styles.gridTileTitle} numberOfLines={1}>
                      Call 112 / 911
                    </Text>
                    <Text style={styles.gridTileSub} numberOfLines={1}>
                      Police Dispatch
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Row 2: Navigation & Tracking */}
              <View style={styles.gridRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.gridTile, { backgroundColor: '#0284C7' }]}
                  onPress={handleOpenExternalMaps}
                >
                  <MaterialIcons name="directions" size={18} color="#FFFFFF" />
                  <View style={styles.gridTileTextCol}>
                    <Text style={styles.gridTileTitle} numberOfLines={1}>
                      Directions
                    </Text>
                    <Text style={styles.gridTileSub} numberOfLines={1}>
                      Maps Route
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.gridTile, { backgroundColor: '#6366F1' }]}
                  onPress={handleTrackNow}
                >
                  <Feather name="navigation" size={16} color="#FFFFFF" />
                  <View style={styles.gridTileTextCol}>
                    <Text style={styles.gridTileTitle} numberOfLines={1}>
                      Track in App
                    </Text>
                    <Text style={styles.gridTileSub} numberOfLines={1}>
                      Live Radar
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── DISMISS ALERT ── */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleDismiss}
              style={styles.dismissBtn}
            >
              <Text style={[styles.dismissBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Dismiss Alert
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 12,
    maxHeight: '92%',
  },
  cardScrollContent: {
    alignItems: 'stretch',
    paddingTop: 12,
    paddingBottom: 4,
  },

  /* ── Trigger SOS Header ── */
  headerSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  countdownBeaconWrapper: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 6,
    marginTop: 2,
  },
  countdownBeaconRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
  },
  countdownCenterCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 5,
  },
  countdownNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerTitleText: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#EF4444',
  },
  headerSubtitleText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },

  /* ── Location Pill ── */
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  locationPinCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPlaceTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  locationCoordsSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  liveTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveTagDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },

  /* ── Action Buttons ── */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  broadcastBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  broadcastBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* ── Divider ── */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    paddingHorizontal: 8,
    letterSpacing: 0.6,
  },

  /* ── 1-Tap Emergency Dispatch ── */
  emergencyServicesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  servicesIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  servicesSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },

  /* ── Family Contacts ── */
  contactsSection: {
    width: '100%',
    marginTop: 2,
  },
  contactsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  contactsSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tapToCallHintText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  horizontalContactsScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  squareContactCard: {
    width: 96,
    height: 112,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  squareAvatarWrap: {
    position: 'relative',
    marginBottom: 5,
  },
  squareCallBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareContactName: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 86,
    marginBottom: 5,
  },
  squareCallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#10B981',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  squareCallActionText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  /* ── Incoming Modal Styles ── */
  beaconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
    width: 96,
    height: 96,
    marginTop: 4,
    marginBottom: 2,
  },
  beaconRing: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(239, 68, 68, 0.45)',
  },
  beaconFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingAlertTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#EF4444',
    textAlign: 'center',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sirenToggleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  sirenToggleText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  maxVolChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  maxVolChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  distressDescText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  telemetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  telemetryPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  incomingLocationBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  incomingLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  incomingPinBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingPlaceTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  incomingAddressSub: {
    fontSize: 11,
    marginTop: 1,
  },
  incomingGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 5,
    borderTopWidth: 1,
  },
  incomingGpsCoords: {
    fontSize: 10,
    fontWeight: '800',
  },
  liveFixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveFixDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#DC2626',
  },
  liveFixText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DC2626',
  },

  /* ── 2x2 Action Grid ── */
  gridContainer: {
    width: '100%',
    gap: 8,
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  gridTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  gridTileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  gridTileTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  gridTileSub: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },

  /* ── Dismiss Button ── */
  dismissBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
