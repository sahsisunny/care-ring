import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface SafetyFeature {
  title: string;
  description: string;
  status: string;
  icon: string;
}

interface MembershipTabScreenProps {
  onOpenFeaturesCatalog?: () => void;
}

export const MembershipTabScreen: React.FC<MembershipTabScreenProps> = ({
  onOpenFeaturesCatalog,
}) => {
  const safetyFeatures: SafetyFeature[] = [
    {
      title: '30-Day Location History',
      description: 'Comprehensive 30-day timeline and movement paths',
      status: 'Full 30 Days',
      icon: 'calendar',
    },
    {
      title: 'Unlimited Place Alerts',
      description: 'Instant arrival and departure notifications for all geofences',
      status: 'Unlimited Places',
      icon: 'map-pin',
    },
    {
      title: 'Driver Safety & Speeding Reports',
      description: 'Real-time vehicle speed analysis and safety scoring',
      status: 'Active Protection',
      icon: 'speedometer',
    },
    {
      title: 'Phone Screen Distraction Logs',
      description: 'Monitors device usage while vehicle is in motion',
      status: 'Sensor Monitored',
      icon: 'smartphone',
    },
    {
      title: 'Automatic Crash Detection',
      description: 'Continuous high g-force collision and deceleration sensing',
      status: 'Active Sensors',
      icon: 'shield',
    },
    {
      title: '24/7 Roadside Assistance',
      description: 'On-demand dispatch simulator for towing and tire assistance',
      status: 'Included Free',
      icon: 'tool',
    },
    {
      title: 'Emergency SOS Broadcast',
      description: 'Instant circle-wide emergency alerts with live coordinates',
      status: 'Instant Dispatch',
      icon: 'alert-triangle',
    },
    {
      title: 'Privacy Bubbles',
      description: 'Customizable temporary cloaking zones with timed expiration',
      status: 'Custom Radius',
      icon: 'eye-off',
    },
    {
      title: 'Zero Ads & Complete Privacy',
      description: 'Private self-hosted architecture with zero data sharing',
      status: '100% Private',
      icon: 'lock',
    },
  ];

  const insets = useSafeAreaInsets();
  const headerPaddingTop = Math.max(insets.top + 8, 48);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.activePill}>
          <Ionicons name="sparkles" size={12} color="#7C3AED" />
          <Text style={styles.activePillText}>FULL ACCESS ACTIVE</Text>
        </View>
        <Text style={styles.headerTitle}>Membership & Safety</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Membership Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.starCircle}>
              <Ionicons name="star" size={26} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>CareRing Complete</Text>
              <Text style={styles.heroPrice}>All Features Included • Free</Text>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>
            Enjoy complete access to real-time location sharing, crash protection, driving analytics, place alerts, and private direct messaging — completely secure and free.
          </Text>

          {onOpenFeaturesCatalog && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onOpenFeaturesCatalog}
              style={styles.exploreCatalogBtn}
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.exploreCatalogBtnText}>Browse All Features Catalog</Text>
              <Feather name="arrow-right" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Feature List Table */}
        <Text style={styles.sectionTitle}>Included Features & Capabilities</Text>

        <View style={styles.tableCard}>
          {safetyFeatures.map((feat, idx) => (
            <View
              key={feat.title}
              style={[
                styles.tableRow,
                idx === safetyFeatures.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.featIconCircle}>
                <Feather name={feat.icon as any} size={16} color={Colors.primary} />
              </View>

              <View style={styles.featInfo}>
                <Text style={styles.featTitle}>{feat.title}</Text>
                <Text style={styles.featDesc}>{feat.description}</Text>
              </View>

              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.statusBadgeText}>{feat.status}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  activePillText: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  starCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  heroPrice: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '800',
    marginTop: 2,
  },
  activeTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  heroDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  featIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featInfo: {
    flex: 1,
  },
  featTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  featDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '800',
  },
  exploreCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  exploreCatalogBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
