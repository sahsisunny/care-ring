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
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle, getWebGlassPillStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface FeatureItem {
  id: string;
  title: string;
  category: 'Safety' | 'Driving' | 'Location' | 'Privacy & Chat';
  description: string;
  highlight: string;
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
  const { colors, isDark, isGlass } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);
  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  const features: FeatureItem[] = [
    {
      id: 'feat_live_gps',
      title: 'Live GPS Location Sharing',
      category: 'Location',
      description: 'Pinpoint spatiotemporal tracking with real-time speed, heading, and stationary state detection.',
      highlight: 'Continuous sub-100ms real-time coordinate updates',
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
      highlight: '30-day movement history with interactive timeline',
      icon: 'calendar',
      iconFamily: 'Feather',
      color: '#6366F1',
      badge: '30 DAYS ACTIVE',
      actionId: 'open_timeline',
      actionLabel: 'Open Timeline',
    },
    {
      id: 'feat_geofences',
      title: 'Unlimited Geofence Places',
      category: 'Location',
      description: 'Set custom geographic arrival and departure boundaries with radii from 50m to 5,000m.',
      highlight: 'Unlimited arrival and departure geofence alerts',
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
      highlight: 'High-G sensor fusion & automated emergency notifications',
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
      highlight: 'Instant circle siren with live coordinates dispatch',
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
      highlight: 'Algorithmic driving safety evaluation scored /100',
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
      highlight: 'Real-time road speed limit monitoring & event logs',
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
      highlight: 'Phone screen interaction tracking while driving',
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
      highlight: 'Sensor telemetry analyzing acceleration & braking smoothness',
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
      highlight: 'Customizable temporary privacy cloaking zones',
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
      highlight: 'Circle group messaging & confidential 1-on-1 private chat',
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
      highlight: 'Real-time animated floating reactions on map markers',
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
      highlight: 'Live battery percentage and low charge warnings',
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
      highlight: 'Quick emergency roadside assistance dispatcher simulator',
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
      highlight: 'Cached cartography tiles for uninterrupted offline navigation',
      icon: 'download-cloud',
      iconFamily: 'Feather',
      color: '#475569',
      badge: 'LOCAL CACHING',
      actionId: 'offline_tiles',
      actionLabel: 'Offline Storage',
    },
    {
      id: 'feat_zero_broker',
      title: 'Zero Ads & Complete Data Privacy',
      category: 'Privacy & Chat',
      description: 'Self-hosted PostgreSQL architecture. Your family location data is never packaged or shared with third parties.',
      highlight: '100% private database with zero data monetization',
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.divider }, webGlassCard]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={styles.pillRow}>
              <View style={[styles.activePill, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#F5F3FF' }]}>
                <Ionicons name="sparkles" size={12} color="#A78BFA" />
                <Text style={[styles.activePillText, { color: isDark ? '#DDD6FE' : '#7C3AED' }]}>FULL ACCESS ACTIVE</Text>
              </View>
            </View>
            <Text style={[styles.headerTitle, { color: colors.textMain }]}>CareRing Features Catalog</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, webGlassTile]}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search features (e.g. SOS, Driving, Bubble)..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textMain }]}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.tileBg,
                      borderColor: isSelected ? colors.primary : colors.tileBorder,
                    },
                    !isSelected && webGlassPill,
                  ]}
                >
                  <Text style={[styles.categoryPillText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Feature Count & Stats Header */}
        <View style={styles.statsBar}>
          <Text style={[styles.statsCountText, { color: colors.textMuted }]}>
            Showing <Text style={{ fontWeight: '800', color: colors.primary }}>{filteredFeatures.length}</Text> of {features.length} Features
          </Text>
          <View style={[styles.statsBadge, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }, webGlassPill]}>
            <Ionicons name="shield-checkmark" size={12} color="#10B981" />
            <Text style={[styles.statsBadgeText, { color: isDark ? '#6EE7B7' : '#059669' }]}>100% Private • Complete Access</Text>
          </View>
        </View>

        {/* Feature List */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredFeatures.map((feat) => (
            <View key={feat.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, webGlassCard]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: `${feat.color}20` }]}>
                  {renderIcon(feat)}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, { color: colors.textMain }]}>{feat.title}</Text>
                  </View>
                  <View style={styles.categoryBadgeRow}>
                    <View style={[styles.catTag, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }]}>
                      <Text style={[styles.catTagText, { color: colors.textMuted }]}>{feat.category}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isDark ? `${feat.color}25` : `${feat.color}15`, borderColor: `${feat.color}40`, borderWidth: 1 }]}>
                      <Text style={[styles.statusBadgeText, { color: feat.color }]}>{feat.badge}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{feat.description}</Text>

              {/* Feature capability highlight (Dark mode frosted tile with crisp readable text) */}
              <View style={[styles.featureMetaRow, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }, webGlassTile]}>
                <View style={styles.metaStatusBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={[styles.metaStatusText, { color: colors.textMain }]}>{feat.highlight}</Text>
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
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.08)',
                      borderColor: isDark ? 'rgba(129, 140, 248, 0.35)' : 'rgba(99, 102, 241, 0.25)',
                    },
                    webGlassTile,
                  ]}
                >
                  <Text style={[styles.actionBtnText, { color: isDark ? '#A5B4FC' : colors.primary }]}>{feat.actionLabel || 'Try Feature'}</Text>
                  <Feather name="arrow-right" size={14} color={isDark ? '#A5B4FC' : colors.primary} />
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
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
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
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: 0,
  },
  categoriesWrap: {
    marginBottom: 6,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statsBadgeText: {
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
    marginBottom: 10,
  },
  featureMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  metaStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  metaStatusText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
