import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface MembershipTabScreenProps {
  onOpenFeaturesCatalog?: () => void;
}

export const MembershipTabScreen: React.FC<MembershipTabScreenProps> = ({
  onOpenFeaturesCatalog,
}) => {
  const unlockedFeatures = [
    {
      title: '30-Day Location History',
      life360Free: '2 Days only',
      careRing: 'Full 30 Days Unlocked',
      icon: 'calendar',
    },
    {
      title: 'Unlimited Place Alerts',
      life360Free: '2 Places only',
      careRing: 'Unlimited Places',
      icon: 'map-pin',
    },
    {
      title: 'Driver Safety & Speeding Reports',
      life360Free: 'Locked 🔒 ($24.99/mo)',
      careRing: 'Full Reports Unlocked',
      icon: 'speedometer',
    },
    {
      title: 'Phone Screen Distraction Logs',
      life360Free: 'Locked 🔒',
      careRing: 'Detailed Logs Unlocked',
      icon: 'smartphone',
    },
    {
      title: 'Automatic Crash Detection',
      life360Free: 'Locked 🔒',
      careRing: 'Active with Sensors',
      icon: 'shield',
    },
    {
      title: '24/7 Roadside Assistance',
      life360Free: 'Locked 🔒',
      careRing: 'Included for Free',
      icon: 'tool',
    },
    {
      title: 'Emergency SOS Broadcast',
      life360Free: 'Locked 🔒',
      careRing: 'Instant Push & Siren',
      icon: 'alert-triangle',
    },
    {
      title: 'Privacy Bubbles',
      life360Free: 'Restricted',
      careRing: 'Custom Radius & Duration',
      icon: 'eye-off',
    },
    {
      title: 'Zero Ads & Data Privacy',
      life360Free: 'Data sold to brokers',
      careRing: 'Self-hosted & 100% Private',
      icon: 'lock',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.unlockedPill}>
          <Ionicons name="sparkles" size={12} color="#7C3AED" />
          <Text style={styles.unlockedPillText}>ALL PREMIUM FEATURES UNLOCKED</Text>
        </View>
        <Text style={styles.headerTitle}>Membership</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Platinum Card Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.starCircle}>
              <Ionicons name="star" size={26} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>CareRing Platinum</Text>
              <Text style={styles.heroPrice}>$0.00 / forever free</Text>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>
            Enjoy every single feature that Life360 locks behind its $24.99/month Platinum tier — completely open, private, and free.
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

        {/* Feature Comparison Table */}
        <Text style={styles.sectionTitle}>What's Unlocked in CareRing</Text>

        <View style={styles.tableCard}>
          {unlockedFeatures.map((feat, idx) => (
            <View
              key={feat.title}
              style={[
                styles.tableRow,
                idx === unlockedFeatures.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.featIconCircle}>
                <Feather name={feat.icon as any} size={16} color={Colors.primary} />
              </View>

              <View style={styles.featInfo}>
                <Text style={styles.featTitle}>{feat.title}</Text>
                <View style={styles.compareRow}>
                  <Text style={styles.life360Text}>Life360: {feat.life360Free}</Text>
                  <Text style={styles.careRingText}>✓ {feat.careRing}</Text>
                </View>
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
  unlockedPill: {
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
  unlockedPillText: {
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
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 3,
  },
  life360Text: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  careRingText: {
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
