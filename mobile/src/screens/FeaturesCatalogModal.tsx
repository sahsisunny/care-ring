import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface FeatureItem {
  id: string;
  title: string;
  category: 'Safety' | 'Driving' | 'Location' | 'Privacy & Chat';
  description: string;
  life360Tier: string;
  icon: string;
  iconFamily: 'Ionicons' | 'Feather' | 'MaterialIcons' | 'FontAwesome5';
  color: string;
  badge: string;
  actionId?: string;
  actionLabel?: string;
}

interface FeaturesCatalogModalProps {
  visible: boolean;
  onClose: () => void;
  onTriggerFeature?: (actionId: string) => void;
}

export const FeaturesCatalogModal: React.FC<FeaturesCatalogModalProps> = ({
  visible,
  onClose,
  onTriggerFeature,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const features: FeatureItem[] = [
    {
      id: 'feat_live_gps',
      title: 'Live GPS Location Sharing',
      category: 'Location',
      description: 'Pinpoint spatiotemporal tracking with real-time speed, heading, and stationary state detection.',
      life360Tier: 'Basic (Delayed)',
      icon: 'location',
      iconFamily: 'Ionicons',
      color: Colors.primary,
      badge: 'REAL-TIME 100MS',
      actionId: 'open_map',
      actionLabel: 'View Map',
    },
    {
      id: 'feat_history',
      title: '30-Day Location Breadcrumbs',
      category: 'Location',
      description: 'Explore full historical movement paths and daily route timelines for up to 30 days.',
      life360Tier: 'Locked 🔒 (2 Days free, $24.99/mo for 30)',
      icon: 'calendar',
      iconFamily: 'Feather',
      color: '#6366F1',
      badge: '30 DAYS UNLOCKED',
      actionId: 'open_timeline',
      actionLabel: 'Open Timeline',
    },
    {
      id: 'feat_geofences',
      title: 'Unlimited Geofence Places',
      category: 'Location',
      description: 'Set custom geographic arrival and departure boundaries with radii from 50m to 5,000m.',
      life360Tier: 'Locked 🔒 (2 places free only)',
      icon: 'map-pin',
      iconFamily: 'Feather',
      color: '#10B981',
      badge: 'UNLIMITED PLACES',
      actionId: 'open_places',
      actionLabel: 'Add Place',
    },
    {
      id: 'feat_crash',
      title: 'Automatic High-G Crash Detection',
      category: 'Safety',
      description: 'Sensors monitor sudden decelerations and impacts, triggering automated family alerts.',
      life360Tier: 'Locked 🔒 ($14.99/mo Gold)',
      icon: 'car-crash',
      iconFamily: 'MaterialIcons',
      color: '#EF4444',
      badge: 'SENSOR PROTECTED',
      actionId: 'open_safety',
      actionLabel: 'Safety Center',
    },
    {
      id: 'feat_sos',
      title: 'Emergency SOS Broadcast',
      category: 'Safety',
      description: 'One-tap emergency broadcast that transmits live GPS coordinates and sounds alerts on family devices.',
      life360Tier: 'Restricted Tier',
      icon: 'warning',
      iconFamily: 'Ionicons',
      color: '#DC2626',
      badge: 'INSTANT DISPATCH',
      actionId: 'trigger_sos',
      actionLabel: 'Trigger SOS',
    },
    {
      id: 'feat_driving_report',
      title: 'Weekly Driver Safety Scores',
      category: 'Driving',
      description: 'Algorithmic evaluation of driver habits, smooth speed control, and safety ratings out of 100.',
      life360Tier: 'Locked 🔒 ($24.99/mo Platinum)',
      icon: 'speedometer',
      iconFamily: 'Ionicons',
      color: Colors.speeding,
      badge: 'FULL ANALYTICS',
      actionId: 'open_driver_report',
      actionLabel: 'View Report',
    },
    {
      id: 'feat_speeding',
      title: 'Speeding Incident Logging',
      category: 'Driving',
      description: 'Tracks excessive speeds relative to local road thresholds with timestamps and map markers.',
      life360Tier: 'Locked 🔒',
      icon: 'speedometer-outline',
      iconFamily: 'Ionicons',
      color: '#F97316',
      badge: 'ROAD LIMIT AUDIT',
      actionId: 'open_speeding',
      actionLabel: 'Speeding Log',
    },
    {
      id: 'feat_distracted',
      title: 'Phone Screen Distraction Log',
      category: 'Driving',
      description: 'Detects mobile device screen interactions while vehicle is actively moving.',
      life360Tier: 'Locked 🔒 ($24.99/mo)',
      icon: 'smartphone',
      iconFamily: 'Feather',
      color: Colors.distracted,
      badge: 'SCREEN MONITOR',
      actionId: 'open_driver_report',
      actionLabel: 'Check Logs',
    },
    {
      id: 'feat_rapid_braking',
      title: 'Rapid Accel & Hard Braking',
      category: 'Driving',
      description: 'Detailed event breakdown identifying sudden acceleration bursts and harsh brake applications.',
      life360Tier: 'Locked 🔒',
      icon: 'flash-outline',
      iconFamily: 'Ionicons',
      color: Colors.rapidAccel,
      badge: 'G-FORCE SENSING',
      actionId: 'open_driver_report',
      actionLabel: 'View Events',
    },
    {
      id: 'feat_bubbles',
      title: 'Privacy Bubbles (Incognito)',
      category: 'Privacy & Chat',
      description: 'Create customizable temporary blur zones (1km - 5km) for 1 to 6 hours for personal privacy.',
      life360Tier: 'Restricted to 1 Bubble',
      icon: 'eye-off',
      iconFamily: 'Feather',
      color: '#8B5CF6',
      badge: 'PRIVACY FIRST',
      actionId: 'open_bubble',
      actionLabel: 'Create Bubble',
    },
    {
      id: 'feat_chat',
      title: 'Group Chat & Direct Messaging',
      category: 'Privacy & Chat',
      description: 'End-to-end family group messages and private 1-on-1 chats with live typing indicators.',
      life360Tier: 'Basic Group Only',
      icon: 'chatbubble-ellipses',
      iconFamily: 'Ionicons',
      color: Colors.primary,
      badge: 'DIRECT + GROUP',
      actionId: 'open_chat',
      actionLabel: 'Open Chat',
    },
    {
      id: 'feat_reactions',
      title: 'Live Map Emoji Reactions',
      category: 'Privacy & Chat',
      description: 'Broadcast animated live reactions (🍅 Boo!, 💖 Love you, 😳 Slow down) directly onto map pins.',
      life360Tier: 'Not Available in Life360',
      icon: 'heart',
      iconFamily: 'Ionicons',
      color: '#EC4899',
      badge: 'INTERACTIVE',
      actionId: 'open_map',
      actionLabel: 'Send Emoji',
    },
    {
      id: 'feat_battery',
      title: 'Battery Telemetry & Alerts',
      category: 'Safety',
      description: 'Monitors real-time battery percentages, charging state, and issues automated low battery warnings.',
      life360Tier: 'Delayed Battery Check',
      icon: 'battery-charging',
      iconFamily: 'Ionicons',
      color: '#EAB308',
      badge: 'LIVE BATTERY',
      actionId: 'open_map',
      actionLabel: 'Check Status',
    },
    {
      id: 'feat_roadside',
      title: '24/7 Roadside Assistance',
      category: 'Safety',
      description: 'Simulated on-demand roadside dispatch for vehicle towing, battery jump starts, tire repair, and lockouts.',
      life360Tier: 'Locked 🔒 ($24.99/mo Platinum)',
      icon: 'tool',
      iconFamily: 'Feather',
      color: '#0284C7',
      badge: 'INCLUDED FREE',
      actionId: 'open_safety',
      actionLabel: 'Assistance',
    },
    {
      id: 'feat_offline',
      title: 'Offline Raster Tile Caching',
      category: 'Location',
      description: 'Caches map cartography tiles locally on your device for uninterrupted navigation with zero signal.',
      life360Tier: 'Not Supported',
      icon: 'download-cloud',
      iconFamily: 'Feather',
      color: '#475569',
      badge: 'LOCAL CACHING',
      actionId: 'open_settings',
      actionLabel: 'Cache Settings',
    },
    {
      id: 'feat_zero_broker',
      title: 'Zero Ads & Zero Data Brokerage',
      category: 'Privacy & Chat',
      description: 'Self-hosted PostgreSQL architecture. Your family location data is never packaged or sold to advertisers.',
      life360Tier: 'Life360 sells data to brokers',
      icon: 'shield',
      iconFamily: 'Feather',
      color: '#059669',
      badge: '100% PRIVATE',
      actionId: 'open_privacy',
      actionLabel: 'Privacy Policy',
    },
  ];

  const categories = ['All', 'Safety', 'Driving', 'Location', 'Privacy & Chat'];

  const filteredFeatures = features.filter((feat) => {
    const matchesCat = selectedCategory === 'All' || feat.category === selectedCategory;
    const matchesSearch =
      feat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feat.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const renderIcon = (feat: FeatureItem) => {
    switch (feat.iconFamily) {
      case 'Ionicons':
        return <Ionicons name={feat.icon as any} size={22} color={feat.color} />;
      case 'Feather':
        return <Feather name={feat.icon as any} size={20} color={feat.color} />;
      case 'MaterialIcons':
        return <MaterialIcons name={feat.icon as any} size={22} color={feat.color} />;
      case 'FontAwesome5':
        return <FontAwesome5 name={feat.icon as any} size={20} color={feat.color} />;
      default:
        return <Ionicons name="star" size={20} color={feat.color} />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={styles.pillRow}>
              <View style={styles.unlockedPill}>
                <Ionicons name="sparkles" size={12} color="#7C3AED" />
                <Text style={styles.unlockedPillText}>ALL FEATURES UNLOCKED</Text>
              </View>
            </View>
            <Text style={styles.headerTitle}>CareRing Features Catalog</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search features (e.g. SOS, Driving, Bubble)..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills */}
        <View style={styles.categoriesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.8}
                  onPress={() => setSelectedCategory(cat)}
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                >
                  <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Feature Count & Stats Header */}
        <View style={styles.statsBar}>
          <Text style={styles.statsCountText}>
            Showing <Text style={{ fontWeight: '800', color: Colors.primary }}>{filteredFeatures.length}</Text> of {features.length} Features
          </Text>
          <View style={styles.platinumBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#059669" />
            <Text style={styles.platinumBadgeText}>100% Free • Zero Subscriptions</Text>
          </View>
        </View>

        {/* Feature List */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredFeatures.map((feat) => (
            <View key={feat.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: `${feat.color}15` }]}>
                  {renderIcon(feat)}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{feat.title}</Text>
                  </View>
                  <View style={styles.categoryBadgeRow}>
                    <View style={styles.catTag}>
                      <Text style={styles.catTagText}>{feat.category}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${feat.color}18` }]}>
                      <Text style={[styles.statusBadgeText, { color: feat.color }]}>{feat.badge}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={styles.cardDesc}>{feat.description}</Text>

              {/* Life360 comparison row */}
              <View style={styles.compareRow}>
                <View style={styles.compareItem}>
                  <Text style={styles.compareLabel}>Life360 Tier</Text>
                  <Text style={styles.compareValueLife360}>{feat.life360Tier}</Text>
                </View>
                <View style={styles.compareDivider} />
                <View style={styles.compareItem}>
                  <Text style={styles.compareLabel}>CareRing</Text>
                  <Text style={styles.compareValueCareRing}>✓ Included Free</Text>
                </View>
              </View>

              {/* Interactive Try Button */}
              {feat.actionId && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    onClose();
                    onTriggerFeature?.(feat.actionId!);
                  }}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionBtnText}>{feat.actionLabel || 'Try Feature'}</Text>
                  <Feather name="arrow-right" size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  closeBtn: {
    padding: 6,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  unlockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unlockedPillText: {
    color: '#7C3AED',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  categoriesWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statsCountText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  platinumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  platinumBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  catTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  compareItem: {
    flex: 1,
  },
  compareDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  compareLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  compareValueLife360: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  compareValueCareRing: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '800',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
});
