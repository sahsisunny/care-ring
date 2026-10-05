import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  PanResponder,
  LayoutChangeEvent,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

interface CreateBubbleModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmBubble: (radiusMeters: number, durationMinutes: number) => void;
  onRadiusChange?: (radiusMeters: number) => void;
  initialRadius?: number;
}

const MIN_RADIUS = 500; // 500m
const MAX_RADIUS = 8000; // 8km
const STEP_METERS = 250; // 250m step

export const CreateBubbleModal: React.FC<CreateBubbleModalProps> = React.memo(({
  visible,
  onClose,
  onConfirmBubble,
  onRadiusChange,
  initialRadius = 2000,
}) => {
  const { colors, isDark } = useTheme();
  const [selectedRadius, setSelectedRadius] = useState<number>(initialRadius);
  const [selectedDuration, setSelectedDuration] = useState<number>(120); // 2 hours
  const [trackWidth, setTrackWidth] = useState<number>(280);
  const trackWidthRef = useRef<number>(280);
  const wasVisibleRef = useRef<boolean>(false);

  // Quick preset pills
  const presets = [
    { label: '500m', value: 500 },
    { label: '1 km', value: 1000 },
    { label: '2 km', value: 2000 },
    { label: '3 km', value: 3000 },
    { label: '5 km', value: 5000 },
    { label: '8 km', value: 8000 },
  ];

  const durations = [
    { label: '1 hr', value: 60 },
    { label: '2 hrs', value: 120 },
    { label: '4 hrs', value: 240 },
    { label: '6 hrs', value: 360 },
  ];

  // Notify map when visible opens or initial radius changes
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      wasVisibleRef.current = true;
      setSelectedRadius(initialRadius);
      onRadiusChange?.(initialRadius);
    } else if (!visible) {
      wasVisibleRef.current = false;
    }
  }, [visible, initialRadius]);

  const updateRadius = (newRadius: number) => {
    const clamped = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.round(newRadius / STEP_METERS) * STEP_METERS));
    setSelectedRadius(clamped);
    onRadiusChange?.(clamped);
  };

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      setTrackWidth(width);
      trackWidthRef.current = width;
    }
  };

  // Slider PanResponder for smooth real-time dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleTouchAtX(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleTouchAtX(evt.nativeEvent.locationX);
      },
    })
  ).current;

  const handleTouchAtX = (x: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    const radius = MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
    updateRadius(radius);
  };

  const sliderPercent = Math.max(
    0,
    Math.min(100, ((selectedRadius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100)
  );

  const formatKm = (meters: number) => {
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
  };

  const handleCreate = () => {
    onConfirmBubble(selectedRadius, selectedDuration);
    onClose();
    Alert.alert(
      '🫧 Privacy Bubble Created',
      `Your circle now sees a generalized ${formatKm(selectedRadius)} zone for ${selectedDuration / 60} hours. If a crash or SOS occurs, exact GPS will immediately restore.`
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(15, 23, 42, 0.45)' }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.textMain }]}>Create a Bubble</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Temporary generalized location for privacy
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Live Map Preview Banner */}
            <View
              style={[
                styles.liveBanner,
                {
                  backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : '#F5F3FF',
                  borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : '#DDD6FE',
                },
              ]}
            >
              <View style={styles.pulseDot} />
              <Text style={styles.liveBannerText}>
                Live Map Preview: <Text style={{ fontWeight: '800' }}>{formatKm(selectedRadius)} radius</Text>
              </Text>
            </View>

            {/* Slider Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.textMain }]}>Bubble Radius</Text>
              <View style={styles.stepperButtons}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => updateRadius(selectedRadius - STEP_METERS)}
                  style={[styles.stepBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
                >
                  <Ionicons name="remove" size={16} color={colors.textMain} />
                </TouchableOpacity>
                <Text style={[styles.radiusValText, { color: colors.primary }]}>{formatKm(selectedRadius)}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => updateRadius(selectedRadius + STEP_METERS)}
                  style={[styles.stepBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
                >
                  <Ionicons name="add" size={16} color={colors.textMain} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Interactive Custom Slider Track */}
            <View style={styles.sliderTrackWrapper}>
              <View
                style={[
                  styles.sliderTrack,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0' },
                ]}
                onLayout={handleTrackLayout}
                {...panResponder.panHandlers}
              >
                {/* Active Filled Bar */}
                <View
                  style={[
                    styles.sliderFill,
                    {
                      width: `${sliderPercent}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
                {/* Drag Thumb Handle */}
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      left: `${sliderPercent}%`,
                      backgroundColor: '#FFFFFF',
                      borderColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderMinMaxRow}>
                <Text style={[styles.minMaxText, { color: colors.textMuted }]}>0.5 km</Text>
                <Text style={[styles.minMaxText, { color: colors.textMuted }]}>8.0 km</Text>
              </View>
            </View>

            {/* Quick Preset Pills */}
            <View style={styles.optionRow}>
              {presets.map((p) => {
                const isSelected = selectedRadius === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    activeOpacity={0.8}
                    onPress={() => updateRadius(p.value)}
                    style={[
                      styles.optionPill,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.tileBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration Section */}
            <Text style={[styles.sectionLabel, { color: colors.textMain, marginTop: 14 }]}>Duration</Text>
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
                      {
                        backgroundColor: isSelected ? colors.primary : colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.tileBorder,
                      },
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

            {/* Submit Button */}
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
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
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
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#7C3AED',
  },
  liveBannerText: {
    fontSize: 13.5,
    color: '#7C3AED',
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepperButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusValText: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 64,
    textAlign: 'center',
  },
  sliderTrackWrapper: {
    paddingVertical: 10,
    marginBottom: 8,
  },
  sliderTrack: {
    height: 10,
    borderRadius: 5,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: 10,
    borderRadius: 5,
  },
  sliderThumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    marginLeft: -13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderMinMaxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  minMaxText: {
    fontSize: 11,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  optionPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: 22,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
