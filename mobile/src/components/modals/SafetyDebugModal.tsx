/**
 * Developer Safety Debug Screen / Modal
 * Implements Section 25 of Safety Detection Layer.md
 */

import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { safetyDetectionEngine, useSafetyDebug, SafetyConfig } from '../../safety';
import { safetyService } from '../../services/SafetyService';

interface SafetyDebugModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SafetyDebugModal: React.FC<SafetyDebugModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const debug = useSafetyDebug();

  const [engineEnabled, setEngineEnabled] = useState(safetyDetectionEngine.isSafetyDetectionEnabled());
  const [notifsEnabled, setNotifsEnabled] = useState(safetyDetectionEngine.areNotificationsEnabled());

  const handleToggleEngine = (val: boolean) => {
    setEngineEnabled(val);
    safetyDetectionEngine.setEnabled(val);
    safetyService.setSafetyDetectionEnabled(val);
  };

  const handleToggleNotifs = (val: boolean) => {
    setNotifsEnabled(val);
    safetyDetectionEngine.setNotificationsEnabled(val);
    safetyService.setSafetyNotificationsEnabled(val);
  };

  const renderBadge = (status: 'No' | 'Potential' | 'Yes') => {
    let bg = '#F1F5F9';
    let text = '#64748B';
    if (status === 'Yes') {
      bg = '#FEE2E2';
      text = '#EF4444';
    } else if (status === 'Potential') {
      bg = '#FEF3C7';
      text = '#D97706';
    }
    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: text }]}>{status}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.textMain }]}>Safety Detection Debug</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Real-Time Kinematic Sensor State • Section 25
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Engine Control Switches (Section 24 Privacy & Consent) */}
            <View style={[styles.section, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Engine Controls & Privacy</Text>
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Safety Detection Layer</Text>
                <Switch
                  value={engineEnabled}
                  onValueChange={handleToggleEngine}
                  trackColor={{ false: '#CBD5E1', true: colors.primary }}
                />
              </View>
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Family Push Alerts</Text>
                <Switch
                  value={notifsEnabled}
                  onValueChange={handleToggleNotifs}
                  trackColor={{ false: '#CBD5E1', true: colors.primary }}
                />
              </View>
            </View>

            {/* Core Metrics Grid */}
            <View style={[styles.section, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Kinematic Telemetry</Text>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Current Activity</Text>
                <Text style={[styles.value, { color: colors.textMain, fontWeight: '700' }]}>
                  {debug.currentActivity}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Activity Confidence</Text>
                <Text style={[styles.value, { color: colors.textMain }]}>
                  {(debug.activityConfidence * 100).toFixed(0)}%
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Speed</Text>
                <Text style={[styles.value, { color: colors.primary, fontWeight: '700' }]}>
                  {debug.speed.toFixed(1)} km/h
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>GPS Accuracy</Text>
                <Text style={[styles.value, { color: colors.textMain }]}>
                  {debug.gpsAccuracy}m
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Acceleration</Text>
                <Text style={[styles.value, { color: colors.textMain }]}>
                  {debug.acceleration.toFixed(2)} m/s²
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Heading</Text>
                <Text style={[styles.value, { color: colors.textMain }]}>
                  {debug.heading}°
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Heading Change</Text>
                <Text style={[styles.value, { color: colors.textMain }]}>
                  {debug.headingChange}°
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Road Speed Limit</Text>
                <Text style={[styles.value, { color: colors.textMain }]}>
                  {debug.roadSpeedLimit} km/h
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Overspeed Confidence</Text>
                <Text style={[styles.value, { color: colors.textMain }]}>
                  {(debug.overspeedConfidence * 100).toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Event Detectors Status */}
            <View style={[styles.section, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Detector Status</Text>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Hard Braking</Text>
                {renderBadge(debug.hardBraking)}
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Rapid Acceleration</Text>
                {renderBadge(debug.rapidAcceleration)}
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Harsh Cornering</Text>
                {renderBadge(debug.harshCornering)}
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Possible Distraction</Text>
                {renderBadge(debug.possibleDistraction)}
              </View>

              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Current Safety State</Text>
                <View style={[styles.statePill, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}>
                  <Text style={[styles.statePillText, { color: colors.primary }]}>
                    {debug.currentSafetyState}
                  </Text>
                </View>
              </View>
            </View>

            {/* Active Cooldowns */}
            {Object.keys(debug.activeCooldowns).length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Active Cooldowns</Text>
                {Object.entries(debug.activeCooldowns).map(([type, sec]) => (
                  <View key={type} style={styles.row}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{type}</Text>
                    <Text style={[styles.value, { color: '#F59E0B', fontWeight: '700' }]}>
                      {sec}s remaining
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Simulated Test Injection Action (Section 29) */}
            <TouchableOpacity
              style={[styles.testBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                safetyDetectionEngine.registerUserInteraction();
              }}
            >
              <Ionicons name="finger-print" size={16} color="#FFFFFF" />
              <Text style={styles.testBtnText}>Register Touch Interaction (Distraction Test)</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 28,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  section: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  label: {
    fontSize: 13.5,
  },
  value: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    marginVertical: 12,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
});
