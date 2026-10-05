import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  PanResponder,
  LayoutChangeEvent,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { MapView, MapViewRef } from '../MapView';
import { MemberData } from '../../models/Member';
import { MapStyleConfig } from '../../models/MapStyle';

interface CreateBubbleModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmBubble: (radiusMeters: number, durationMinutes: number) => void;
  onRadiusChange?: (radiusMeters: number) => void;
  initialRadius?: number;
  initialDuration?: number;
  currentUserId?: string;
  targetMember?: MemberData | null;
  myPosition?: { latitude: number; longitude: number; heading: number } | null;
  mapStyle?: MapStyleConfig;
}

const MIN_RADIUS = 500; // 500m (0.5 km)
const MAX_RADIUS = 8000; // 8,000m (8.0 km)
const STEP_METERS = 250; // 250m step

const DURATION_PRESETS = [
  { label: '30m', value: 30, desc: 'Quick trip' },
  { label: '1 hr', value: 60, desc: '1 hour' },
  { label: '2 hrs', value: 120, desc: 'Popular', badge: 'Standard' },
  { label: '4 hrs', value: 240, desc: 'Half day' },
  { label: '6 hrs', value: 360, desc: 'Work day' },
  { label: '8 hrs', value: 480, desc: 'Full day' },
  { label: '12 hrs', value: 720, desc: '12 hours' },
  { label: '24 hrs', value: 1440, desc: 'All day' },
];

export const CreateBubbleModal: React.FC<CreateBubbleModalProps> = React.memo(({
  visible,
  onClose,
  onConfirmBubble,
  onRadiusChange,
  initialRadius = 2000,
  initialDuration = 120,
  currentUserId = '',
  targetMember = null,
  myPosition = null,
  mapStyle,
}) => {
  const { colors, isDark } = useTheme();

  // Multi-step flow: Step 1 (Map & Slider) -> Step 2 (Timing presets & Auto-destroy time)
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRadius, setSelectedRadius] = useState<number>(initialRadius);
  const [selectedDuration, setSelectedDuration] = useState<number>(initialDuration);
  const [trackWidth, setTrackWidth] = useState<number>(280);

  const trackWidthRef = useRef<number>(280);
  const wasVisibleRef = useRef<boolean>(false);
  const modalMapRef = useRef<MapViewRef>(null);

  // Target coordinates for preview map: prioritize device GPS for self
  const isSelf = !targetMember || targetMember.id === currentUserId;
  const targetLat = isSelf
    ? (myPosition?.latitude ?? targetMember?.latitude ?? 12.9095)
    : (targetMember?.latitude ?? myPosition?.latitude ?? 12.9095);
  const targetLng = isSelf
    ? (myPosition?.longitude ?? targetMember?.longitude ?? 77.6753)
    : (targetMember?.longitude ?? myPosition?.longitude ?? 77.6753);

  const targetMemberForMap = useMemo(() => {
    if (targetMember) {
      return {
        ...targetMember,
        latitude: isSelf && myPosition?.latitude ? myPosition.latitude : targetMember.latitude,
        longitude: isSelf && myPosition?.longitude ? myPosition.longitude : targetMember.longitude,
        inBubble: true,
        bubbleRadius: selectedRadius,
      };
    }
    return {
      id: currentUserId || 'self',
      fullName: 'You',
      avatarUrl: null,
      latitude: targetLat,
      longitude: targetLng,
      speed: 0,
      heading: 0,
      batteryLevel: 100,
      isCharging: false,
      isStationary: true,
      isMoving: false,
      isOnline: true,
      role: 'member',
      inBubble: true,
      bubbleRadius: selectedRadius,
    } as MemberData;
  }, [targetMember, currentUserId, targetLat, targetLng, selectedRadius, isSelf, myPosition]);

  // Synchronize on modal visibility change
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      wasVisibleRef.current = true;
      setStep(1);
      setSelectedRadius(initialRadius);
      setSelectedDuration(initialDuration);
      onRadiusChange?.(initialRadius);

      // Give Leaflet WebView a moment to mount and trigger bubble preview with auto-fit
      const timer = setTimeout(() => {
        modalMapRef.current?.fitBubble(targetLat, targetLng, initialRadius);
      }, 350);

      return () => clearTimeout(timer);
    } else if (!visible) {
      wasVisibleRef.current = false;
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
      }
    }
  }, [visible, initialRadius, initialDuration, targetLat, targetLng]);

  const fitTimeoutRef = useRef<any>(null);

  // When radius updates in Step 1, sync to embedded map, update circle live & auto-fit zoom ONLY on release
  const updateRadius = (newRadius: number, immediateFit = false) => {
    const clamped = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.round(newRadius / STEP_METERS) * STEP_METERS));
    setSelectedRadius(clamped);
    // Live radius update on map WITHOUT moving camera/zoom during drag
    modalMapRef.current?.showBubble(targetLat, targetLng, clamped, false);
    onRadiusChange?.(clamped);

    // Only animate zoom/bounds when user releases finger
    if (immediateFit) {
      if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
      modalMapRef.current?.fitBubble(targetLat, targetLng, clamped);
    }
  };

  const trackRef = useRef<View>(null);
  const trackLayoutRef = useRef<{ pageX: number; width: number }>({ pageX: 0, width: 280 });

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      setTrackWidth(width);
      trackWidthRef.current = width;
      trackLayoutRef.current.width = width;
    }
    trackRef.current?.measure((x, y, w, h, pageX) => {
      if (w > 0) {
        setTrackWidth(w);
        trackWidthRef.current = w;
        trackLayoutRef.current = { pageX, width: w };
      }
    });
  };

  const handleTouchAtEvent = (evt: any, isRelease = false) => {
    const { pageX: trackPageX, width: measuredWidth } = trackLayoutRef.current;
    const width = measuredWidth > 0 ? measuredWidth : (trackWidthRef.current > 0 ? trackWidthRef.current : 280);
    if (width <= 0) return;

    let x = evt.nativeEvent.locationX;
    if (trackPageX > 0 && evt.nativeEvent.pageX !== undefined) {
      x = evt.nativeEvent.pageX - trackPageX;
    }

    const ratio = Math.max(0, Math.min(1, x / width));
    const radius = MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
    updateRadius(radius, isRelease);
  };

  // Touch and drag slider handler - strictly captures and blocks navigation swipe-to-back
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleTouchAtEvent(evt, false);
      },
      onPanResponderMove: (evt) => {
        handleTouchAtEvent(evt, false);
      },
      onPanResponderRelease: (evt) => {
        handleTouchAtEvent(evt, true);
      },
    })
  ).current;

  const sliderPercent = Math.max(
    0,
    Math.min(100, ((selectedRadius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100)
  );

  const formatKm = (meters: number) => {
    if (meters < 1000) return `${meters} m`;
    const km = meters / 1000;
    return `${km.toFixed(km % 1 === 0 ? 0 : 1)} km`;
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} mins`;
    if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
    return `${h} hr ${m} min`;
  };

  // Format exact time when bubble will be destroyed
  const formatDestroyTime = (durationMins: number) => {
    const target = new Date(Date.now() + durationMins * 60000);
    const now = new Date();
    const isToday = target.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = target.toDateString() === tomorrow.toDateString();

    const timeStr = target.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    let dayPrefix = 'Today';
    if (isTomorrow) {
      dayPrefix = 'Tomorrow';
    } else if (!isToday) {
      dayPrefix = target.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    return `${dayPrefix} at ${timeStr}`;
  };

  const handleRecenterMap = () => {
    modalMapRef.current?.fitBubble(targetLat, targetLng, selectedRadius);
  };

  const handleNextStep = () => {
    setStep(2);
  };

  const handlePrevStep = () => {
    setStep(1);
  };

  const handleConfirm = () => {
    onConfirmBubble(selectedRadius, selectedDuration);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header Navigation */}
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          {step === 1 ? (
            <TouchableOpacity
              onPress={onClose}
              style={[styles.headerIconBtn, { backgroundColor: colors.tileBg }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={colors.textMain} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handlePrevStep}
              style={[styles.headerIconBtn, { backgroundColor: colors.tileBg }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textMain} />
            </TouchableOpacity>
          )}

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.textMain }]}>Create a Bubble</Text>
            {/* Step Progress Pill */}
            <View style={styles.stepBadgeRow}>
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.25)' : '#EDE9FE',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.stepBadgeText, { color: colors.primary }]}>
                  {step === 1 ? 'Step 1 of 2: Zone Size' : 'Step 2 of 2: Duration'}
                </Text>
              </View>
            </View>
          </View>

          {step === 1 ? (
            <TouchableOpacity
              onPress={handleNextStep}
              style={[styles.headerNextTextBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={styles.headerNextText}>Next</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onClose}
              style={[styles.headerIconBtn, { backgroundColor: colors.tileBg }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* STEP 1: MAP WITH SLIDER (NO PRESET VALUES) */}
        {step === 1 && (
          <View style={styles.stepOneContainer}>
            {/* Interactive Embedded Map View */}
            <View style={[styles.mapWrapper, { borderColor: colors.cardBorder }]}>
              <MapView
                ref={modalMapRef}
                currentUserId={currentUserId}
                members={[targetMemberForMap]}
                myPosition={
                  myPosition
                    ? myPosition
                    : { latitude: targetLat, longitude: targetLng, heading: 0 }
                }
                mapStyle={mapStyle}
              />

              {/* Floating Zone Size Badge */}
              <View
                style={[
                  styles.mapFloatingBadge,
                  {
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <View style={styles.purpleDotPulse} />
                <Text style={[styles.mapFloatingBadgeText, { color: colors.textMain }]}>
                  Zone: <Text style={{ fontWeight: '800', color: colors.primary }}>{formatKm(selectedRadius)}</Text>
                </Text>
              </View>

              {/* Floating Re-center Button */}
              <TouchableOpacity
                style={[
                  styles.mapRecenterBtn,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#FFFFFF',
                    borderColor: colors.cardBorder,
                  },
                ]}
                activeOpacity={0.8}
                onPress={handleRecenterMap}
              >
                <Feather name="crosshair" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Slider Control Panel (Clean, No Preset Pills) */}
            <View
              style={[
                styles.sliderCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              {/* Radius Readout & Steppers */}
              <View style={styles.radiusHeaderRow}>
                <View>
                  <Text style={[styles.controlLabel, { color: colors.textMain }]}>Bubble Radius</Text>
                  <Text style={[styles.controlSubLabel, { color: colors.textMuted }]}>
                    Slide freely to choose custom area
                  </Text>
                </View>

                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => updateRadius(selectedRadius - STEP_METERS, true)}
                    style={[
                      styles.stepIconBtn,
                      { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                    ]}
                  >
                    <Ionicons name="remove" size={18} color={colors.textMain} />
                  </TouchableOpacity>

                  <Text style={[styles.radiusNumberText, { color: colors.primary }]}>
                    {formatKm(selectedRadius)}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => updateRadius(selectedRadius + STEP_METERS, true)}
                    style={[
                      styles.stepIconBtn,
                      { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                    ]}
                  >
                    <Ionicons name="add" size={18} color={colors.textMain} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Interactive Smooth Slider */}
              <View
                ref={trackRef}
                style={styles.sliderTrackContainer}
                onLayout={handleTrackLayout}
                {...panResponder.panHandlers}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.sliderTrack,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0' },
                  ]}
                >
                  {/* Filled Track */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.sliderFilledTrack,
                      {
                        width: `${sliderPercent}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />

                  {/* Drag Handle Thumb */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.sliderThumbHandle,
                      {
                        left: `${sliderPercent}%`,
                        backgroundColor: '#FFFFFF',
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <View pointerEvents="none" style={[styles.thumbInnerGlow, { backgroundColor: colors.primary }]} />
                  </View>
                </View>

                {/* Min & Max Labels */}
                <View pointerEvents="none" style={styles.sliderMinMaxWrap}>
                  <Text style={[styles.minMaxLabel, { color: colors.textMuted }]}>0.5 km (Min)</Text>
                  <Text style={[styles.minMaxLabel, { color: colors.textMuted }]}>8.0 km (Max)</Text>
                </View>
              </View>

              {/* Explanatory Info Box */}
              <View
                style={[
                  styles.infoNoteBox,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.12)' : '#F5F3FF',
                    borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#DDD6FE',
                  },
                ]}
              >
                <Ionicons name="shield-outline" size={18} color={colors.primary} />
                <Text style={[styles.infoNoteText, { color: colors.textSecondary }]}>
                  Your circle will only see you anywhere inside this <Text style={{ fontWeight: '700', color: colors.primary }}>{formatKm(selectedRadius)}</Text> circle, hiding your exact address.
                </Text>
              </View>

              {/* Bottom Next Button */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleNextStep}
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.primaryActionBtnText}>Next: Set Duration</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2: TIMING PRESETS, AUTO-DESTRUCTION TIME & CONFIRMATION */}
        {step === 2 && (
          <ScrollView
            style={styles.stepTwoContainer}
            contentContainerStyle={styles.stepTwoContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Step 1 Summary Banner */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePrevStep}
              style={[
                styles.summaryBanner,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={styles.summaryBannerLeft}>
                <View
                  style={[
                    styles.summaryIconWrap,
                    { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE' },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>🫧</Text>
                </View>
                <View>
                  <Text style={[styles.summaryTitle, { color: colors.textMain }]}>Selected Zone</Text>
                  <Text style={[styles.summarySubtitle, { color: colors.primary }]}>
                    {formatKm(selectedRadius)} Radius
                  </Text>
                </View>
              </View>

              <View style={[styles.editPill, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                <Text style={[styles.editPillText, { color: colors.textSecondary }]}>Edit Map</Text>
                <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Timing Presets Section */}
            <View style={styles.sectionHeaderWrap}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Bubble Duration</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Choose from preset timing or fine-tune
              </Text>
            </View>

            {/* Presets Grid */}
            <View style={styles.presetGrid}>
              {DURATION_PRESETS.map((p) => {
                const isSelected = selectedDuration === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    activeOpacity={0.8}
                    onPress={() => setSelectedDuration(p.value)}
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.cardBorder,
                      },
                    ]}
                  >
                    {p.badge && (
                      <View
                        style={[
                          styles.presetBadge,
                          {
                            backgroundColor: isSelected ? '#FFFFFF' : colors.primary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetBadgeText,
                            { color: isSelected ? colors.primary : '#FFFFFF' },
                          ]}
                        >
                          {p.badge}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.presetCardLabel,
                        { color: isSelected ? '#FFFFFF' : colors.textMain },
                      ]}
                    >
                      {p.label}
                    </Text>
                    <Text
                      style={[
                        styles.presetCardDesc,
                        { color: isSelected ? 'rgba(255, 255, 255, 0.85)' : colors.textMuted },
                      ]}
                    >
                      {p.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Fine Duration Stepper (+ / - 30 mins) */}
            <View
              style={[
                styles.customDurationRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View>
                <Text style={[styles.customDurationLabel, { color: colors.textMain }]}>Active Duration</Text>
                <Text style={[styles.customDurationVal, { color: colors.primary }]}>
                  {formatDuration(selectedDuration)}
                </Text>
              </View>

              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedDuration(Math.max(30, selectedDuration - 30))}
                  style={[
                    styles.stepIconBtn,
                    { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                  ]}
                >
                  <Ionicons name="remove" size={18} color={colors.textMain} />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedDuration(Math.min(1440, selectedDuration + 30))}
                  style={[
                    styles.stepIconBtn,
                    { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                  ]}
                >
                  <Ionicons name="add" size={18} color={colors.textMain} />
                </TouchableOpacity>
              </View>
            </View>

            {/* AUTO-DESTRUCTION TIME DISPLAY (Crucial requirement: show time when it will be destroyed) */}
            <View
              style={[
                styles.destructionTimeCard,
                {
                  backgroundColor: isDark ? 'rgba(124, 58, 237, 0.16)' : '#FAF5FF',
                  borderColor: isDark ? 'rgba(139, 92, 246, 0.45)' : '#C4B5FD',
                },
              ]}
            >
              <View style={styles.destructionCardHeader}>
                <View style={styles.destructionIconBadge}>
                  <Ionicons name="hourglass-outline" size={20} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.destructionStatusPill}>
                    <Text style={styles.destructionStatusPillText}>SCHEDULED AUTO-BURST</Text>
                  </View>
                  <Text style={[styles.destructionTitle, { color: colors.textMain }]}>
                    Destroyed At:
                  </Text>
                </View>
              </View>

              {/* Exact Destruction Timestamp */}
              <View style={styles.destructionTimeHighlight}>
                <Text style={[styles.destructionTimeBigText, { color: colors.primary }]}>
                  {formatDestroyTime(selectedDuration)}
                </Text>
                <View style={[styles.countdownPill, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.3)' : '#EDE9FE' }]}>
                  <Ionicons name="time-outline" size={13} color={colors.primary} />
                  <Text style={[styles.countdownPillText, { color: colors.primary }]}>
                    Pops in {formatDuration(selectedDuration)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.destructionExplainText, { color: colors.textSecondary }]}>
                At this exact time, your privacy bubble automatically pops and your exact real-time GPS location will immediately restore for circle members.
              </Text>
            </View>

            {/* Safety & SOS Guarantee Card */}
            <View
              style={[
                styles.safetyCard,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.tileBorder,
                },
              ]}
            >
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.safetyCardTitle, { color: colors.textMain }]}>
                  Safety SOS & Crash Override
                </Text>
                <Text style={[styles.safetyCardText, { color: colors.textMuted }]}>
                  If an Emergency SOS or Car Crash is detected, this bubble pops instantly and exact GPS coordinates are shared with your circle and emergency services.
                </Text>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={styles.stepTwoActionButtons}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleConfirm}
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.primaryActionBtnText}>Confirm & Create Bubble 🫧</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePrevStep}
                style={[
                  styles.secondaryActionBtn,
                  { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                ]}
              >
                <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                  Back to Map & Radius
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  stepBadgeRow: {
    marginTop: 3,
  },
  stepBadge: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerNextTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  headerNextText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Step 1 Layout */
  stepOneContainer: {
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
  },
  mapFloatingBadge: {
    position: 'absolute',
    top: 14,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  purpleDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
  },
  mapFloatingBadgeText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  mapRecenterBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  sliderCard: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  controlSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusNumberText: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 64,
    textAlign: 'center',
  },
  sliderTrackContainer: {
    paddingVertical: 18,
    marginBottom: 4,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 10,
    borderRadius: 5,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFilledTrack: {
    height: 10,
    borderRadius: 5,
  },
  sliderThumbHandle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  thumbInnerGlow: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sliderMinMaxWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  minMaxLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  infoNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  infoNoteText: {
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Step 2 Layout */
  stepTwoContainer: {
    flex: 1,
  },
  stepTwoContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  summarySubtitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeaderWrap: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  presetCard: {
    flexBasis: '22.5%',
    flexGrow: 1,
    minWidth: 74,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  presetBadge: {
    position: 'absolute',
    top: -8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  presetBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  presetCardLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  presetCardDesc: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  customDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  customDurationLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  customDurationVal: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },

  /* Destruction Time Card */
  destructionTimeCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
  },
  destructionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  destructionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructionStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 3,
  },
  destructionStatusPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  destructionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  destructionTimeHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  destructionTimeBigText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  countdownPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  destructionExplainText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 8,
  },

  /* Safety Card */
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  safetyCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  safetyCardText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },

  /* Action Buttons */
  stepTwoActionButtons: {
    gap: 10,
  },
  secondaryActionBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
