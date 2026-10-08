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
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle, getWebGlassPillStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface FeatureItem {
  id: string;
  title: string;
  category: 'Safety' | 'Driving' | 'Location' | 'Circles & Privacy' | 'Communication' | 'Pipeline';
  description: string;
  highlight: string;
  icon: string;
  iconFamily: 'Ionicons' | 'Feather' | 'MaterialIcons' | 'FontAwesome5';
  color: string;
  badge: string;
  actionId?: string;
  actionLabel?: string;
  isPipeline?: boolean;
  targetQuarter?: string;
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
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);
  const headerPaddingTop = statusBarHeight + 10;
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
      highlight: 'Continuous sub-100ms real-time coordinate streaming',
      icon: 'location',
      iconFamily: 'Ionicons',
      color: Colors.primary,
      badge: 'REAL-TIME 100MS',
      actionId: 'open_map',
      actionLabel: 'View Map',
    },
    {
      id: 'feat_geofences',
      title: 'Unlimited Geofence Places',
      category: 'Location',
      description: 'Set custom geographic arrival and departure boundaries with radii from 50m to 5,000m.',
      highlight: 'PostGIS ST_DWithin millisecond breach evaluation',
      icon: 'map-pin',
      iconFamily: 'Feather',
      color: '#10B981',
      badge: 'UNLIMITED PLACES',
      actionId: 'open_places',
      actionLabel: 'Add Place',
    },
    {
      id: 'feat_history',
      title: 'Unlimited Movement History & Timelines',
      category: 'Location',
      description: 'Explore full historical movement paths, daily stop timelines, and route playbacks extending back to the day members joined.',
      highlight: 'Unbounded lifetime movement logs with zero paywalls',
      icon: 'calendar',
      iconFamily: 'Feather',
      color: '#6366F1',
      badge: 'UNLIMITED HISTORY',
      actionId: 'open_timeline',
      actionLabel: 'Open Timeline',
    },
    {
      id: 'feat_map_styles',
      title: '6 Cartography Map Styles',
      category: 'Location',
      description: 'Detailed Civic, Esri Satellite, OpenTopoMap, Esri Clean Street, CyclOSM Outdoor, and OSM Humanitarian.',
      highlight: 'Zero Google Maps API quotas or billing keys',
      icon: 'map',
      iconFamily: 'Feather',
      color: '#06B6D4',
      badge: '6 MAP STYLES',
      actionId: 'open_settings',
      actionLabel: 'Change Style',
    },
    {
      id: 'feat_favorites_radar',
      title: 'Favorites Map Radar',
      category: 'Location',
      description: 'Pin favorite circle members with live directional compass beacons and instant distance indicators.',
      highlight: 'Directional beacon showing live member orientation',
      icon: 'compass',
      iconFamily: 'Feather',
      color: '#EC4899',
      badge: 'RADAR TRACKING',
      actionId: 'open_map',
      actionLabel: 'Radar View',
    },
    {
      id: 'feat_offline',
      title: 'Offline Raster Tile Caching',
      category: 'Location',
      description: 'Caches map cartography tiles locally on your device for uninterrupted navigation with zero mobile signal.',
      highlight: 'Isolated per-style device tile cache storage',
      icon: 'download-cloud',
      iconFamily: 'Feather',
      color: '#64748B',
      badge: 'LOCAL STORAGE',
      actionId: 'offline_tiles',
      actionLabel: 'Offline Tiles',
    },
    {
      id: 'feat_driver_leaderboard',
      title: 'Driver Safety Leaderboard',
      category: 'Driving',
      description: 'Circle-wide driving rankings comparing safety scores, safe driver badges, and personalized weekly scorecards.',
      highlight: 'Isolated self user driving metrics and circle leaderboard',
      icon: 'award',
      iconFamily: 'Feather',
      color: '#F59E0B',
      badge: 'LEADERBOARD',
      actionId: 'open_driver_report',
      actionLabel: 'Driver Standings',
    },
    {
      id: 'feat_driving_report',
      title: 'Weekly Driver Safety Scores',
      category: 'Driving',
      description: 'Algorithmic evaluation of driver habits, smooth speed control, and safety ratings scored out of 100.',
      highlight: 'Comprehensive route breakdown and speed analysis',
      icon: 'speedometer',
      iconFamily: 'Ionicons',
      color: Colors.speeding,
      badge: 'SCORE /100',
      actionId: 'open_driver_report',
      actionLabel: 'View Report',
    },
    {
      id: 'feat_safety_events',
      title: '5-Point Driving Event Classifier',
      category: 'Driving',
      description: 'Real-time telemetry event classification for Speeding, Phone Distraction, Rapid Accel, Hard Braking, and Cornering.',
      highlight: 'Multi-category event filtering with dedicated timeline pills',
      icon: 'alert-triangle',
      iconFamily: 'Feather',
      color: '#F97316',
      badge: 'SENSOR CLASSIFIER',
      actionId: 'open_driver_report',
      actionLabel: 'View Events',
    },
    {
      id: 'feat_speeding',
      title: 'Speeding Incident Logging',
      category: 'Driving',
      description: 'Tracks excessive speeds relative to local road thresholds with timestamps and map markers.',
      highlight: 'Real-time speed monitoring and violation log',
      icon: 'speedometer-outline',
      iconFamily: 'Ionicons',
      color: '#EA580C',
      badge: 'SPEED AUDIT',
      actionId: 'open_speeding',
      actionLabel: 'Speed Log',
    },
    {
      id: 'feat_distracted',
      title: 'Phone Screen Distraction Log',
      category: 'Driving',
      description: 'Detects mobile device screen interactions while vehicle is actively moving.',
      highlight: 'Screen interaction tracking while driving',
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
      highlight: 'Sensor telemetry analyzing motion smoothness',
      icon: 'flash-outline',
      iconFamily: 'Ionicons',
      color: Colors.rapidAccel,
      badge: 'G-FORCE SENSING',
      actionId: 'open_driver_report',
      actionLabel: 'Motion Audit',
    },
    {
      id: 'feat_activity_engine',
      title: 'Smart Activity State Machine',
      category: 'Safety',
      description: 'Autonomous sensor-fusion engine identifying Stationary, Walking, Running, Cycling, and Driving states.',
      highlight: 'Motion coprocessor activity classification with confidence scoring',
      icon: 'walk',
      iconFamily: 'Ionicons',
      color: '#10B981',
      badge: 'SENSOR FUSION',
      actionId: 'open_safety',
      actionLabel: 'Activity State',
    },
    {
      id: 'feat_sos',
      title: 'Emergency SOS Broadcast & Siren',
      category: 'Safety',
      description: 'One-tap emergency broadcast that transmits live GPS coordinates, sounds circle siren, and provides speed dial.',
      highlight: 'Instant circle siren with live coordinates and contact avatars',
      icon: 'warning',
      iconFamily: 'Ionicons',
      color: '#DC2626',
      badge: 'INSTANT DISPATCH',
      actionId: 'trigger_sos',
      actionLabel: 'Trigger SOS',
    },
    {
      id: 'feat_battery',
      title: 'Battery Telemetry & Adaptive Preserver',
      category: 'Safety',
      description: 'Monitors real-time battery percentages, charging states, and throttles GPS to sleep while stationary (<1%/hr drain).',
      highlight: 'Automated <15% low battery warning & adaptive GPS sleep',
      icon: 'battery-charging',
      iconFamily: 'Ionicons',
      color: '#EAB308',
      badge: '<1% / HR DRAIN',
      actionId: 'open_map',
      actionLabel: 'Battery Status',
    },
    {
      id: 'feat_circle_governance',
      title: 'Circle Roles & Governance Hierarchy',
      category: 'Circles & Privacy',
      description: '3-tier role governance: Circle Owner, Admin, and Member with permission management and member removal.',
      highlight: 'Governed circle membership and role promotion',
      icon: 'shield-outline',
      iconFamily: 'Ionicons',
      color: '#818CF8',
      badge: '3-TIER ROLES',
      actionId: 'open_circle_settings',
      actionLabel: 'Circle Roles',
    },
    {
      id: 'feat_member_nicknames',
      title: 'Private Member Nicknames',
      category: 'Circles & Privacy',
      description: 'Set custom aliases for circle members that remain 100% private to your device and are never uploaded to servers.',
      highlight: 'Encrypted device-local storage via NicknameService',
      icon: 'tag',
      iconFamily: 'Feather',
      color: '#A855F7',
      badge: '100% PRIVATE',
      actionId: 'open_settings',
      actionLabel: 'Edit Nicknames',
    },
    {
      id: 'feat_live_distance',
      title: 'Live Distance to Members',
      category: 'Circles & Privacy',
      description: 'Real-time dynamic Haversine distance shown on each member card with metric (km) and imperial (mi) support.',
      highlight: 'Continuously calculated live member proximity',
      icon: 'navigation',
      iconFamily: 'Feather',
      color: '#06B6D4',
      badge: 'DYNAMIC DISTANCE',
      actionId: 'open_settings',
      actionLabel: 'Distance Unit',
    },
    {
      id: 'feat_bubbles',
      title: 'Privacy Bubbles ("Ghost Mode")',
      category: 'Circles & Privacy',
      description: 'Create customizable temporary blur zones (500m - 8km) for personal privacy. Circle members are NEVER notified and see zero ghost indicators.',
      highlight: '100% private cloaking with zero notifications to others',
      icon: 'eye-off',
      iconFamily: 'Feather',
      color: '#8B5CF6',
      badge: 'GHOST MODE',
      actionId: 'open_bubble',
      actionLabel: 'Create Bubble',
    },
    {
      id: 'feat_circle_customization',
      title: 'Circle Themes & Customization',
      category: 'Circles & Privacy',
      description: 'Personalize each circle with unique emoji badges, accent colors, and custom names.',
      highlight: 'Circle customization stored and synced per-user',
      icon: 'color-palette-outline',
      iconFamily: 'Ionicons',
      color: '#EC4899',
      badge: 'CUSTOM THEMES',
      actionId: 'open_circle_settings',
      actionLabel: 'Customize',
    },
    {
      id: 'feat_chat',
      title: 'Circle Group & 1-on-1 Direct Chat',
      category: 'Communication',
      description: 'Encrypted circle messages and confidential 1-on-1 private direct chat with optimistic zero-latency UI.',
      highlight: 'Direct P2P messaging and persistent circle feeds',
      icon: 'chatbubble-ellipses',
      iconFamily: 'Ionicons',
      color: Colors.primary,
      badge: 'DIRECT + GROUP',
      actionId: 'open_chat',
      actionLabel: 'Open Chat',
    },
    {
      id: 'feat_sync_status',
      title: 'Global Sync & Auto-Reconnection',
      category: 'Communication',
      description: 'Real-time telemetry sync indicator with animated heartbeat pulse and resilient socket auto-reconnection.',
      highlight: 'Sub-50ms WebSocket telemetry propagation with fallback',
      icon: 'sync',
      iconFamily: 'Ionicons',
      color: '#10B981',
      badge: 'RESILIENT SYNC',
      actionId: 'open_map',
      actionLabel: 'Sync Status',
    },
    {
      id: 'feat_zero_broker',
      title: 'Zero Ads & Data Monetization',
      category: 'Circles & Privacy',
      description: 'Zero advertising SDKs, zero location brokers, and complete self-hosting Docker support for total family privacy.',
      highlight: '100% open-source MIT with private PostGIS database',
      icon: 'shield',
      iconFamily: 'Feather',
      color: '#059669',
      badge: 'ZERO TRACKERS',
      actionId: 'open_privacy',
      actionLabel: 'Privacy Specs',
    },
    // Pipeline Features
    {
      id: 'pipe_crash',
      title: 'Multi-Sensor Crash Impact Detection',
      category: 'Pipeline',
      description: 'High-G collision impact algorithm analyzing accelerometer spikes (>3.5G) and sudden deceleration, dispatching automated circle sirens and emergency coordinates.',
      highlight: 'Autonomous tri-axial inertial impact detection',
      icon: 'alert-octagon',
      iconFamily: 'Feather',
      color: '#EF4444',
      badge: 'IN PIPELINE • Q4 2026',
      isPipeline: true,
      targetQuarter: 'Q4 2026',
    },
    {
      id: 'pipe_offline_queue',
      title: 'Offline Telemetry Sync Queue (SQLite)',
      category: 'Pipeline',
      description: 'Local on-device SQLite queue preserving GPS coordinates and driving events during remote cellular dead zones, automatically replaying and syncing when signal restores.',
      highlight: 'Zero telemetry loss during tunnel & mountain traversal',
      icon: 'database',
      iconFamily: 'Feather',
      color: '#F59E0B',
      badge: 'IN PIPELINE • Q4 2026',
      isPipeline: true,
      targetQuarter: 'Q4 2026',
    },
    {
      id: 'pipe_ble',
      title: 'Low-Power BLE Proximity Mesh',
      category: 'Pipeline',
      description: 'Bluetooth Low Energy peer-to-peer radar enabling family proximity discovery in crowded stadiums, airports, and malls without cellular signal.',
      highlight: 'Zero-cellular Bluetooth Low Energy mesh discovery',
      icon: 'bluetooth',
      iconFamily: 'Feather',
      color: '#3B82F6',
      badge: 'IN PIPELINE • Q1 2027',
      isPipeline: true,
      targetQuarter: 'Q1 2027',
    },
    {
      id: 'pipe_roadside',
      title: '24/7 Roadside Assistance Service API',
      category: 'Pipeline',
      description: 'Integrated digital dispatch partner network for emergency towing, battery jump-starts, tire changes, and lockout assistance directly inside the app.',
      highlight: 'Nationwide roadside service dispatch partner API',
      icon: 'tool',
      iconFamily: 'Feather',
      color: '#8B5CF6',
      badge: 'IN PIPELINE • Q1 2027',
      isPipeline: true,
      targetQuarter: 'Q1 2027',
    },
    {
      id: 'pipe_wearables',
      title: 'Wear OS & Apple Watch Glance Companions',
      category: 'Pipeline',
      description: 'Smartwatch glance tiles for quick distance checks, battery indicators, family check-ins, and wrist-triggered SOS sirens.',
      highlight: 'Wrist-worn glance tiles & rapid SOS trigger',
      icon: 'watch',
      iconFamily: 'Feather',
      color: '#10B981',
      badge: 'IN PIPELINE • Q1 2027',
      isPipeline: true,
      targetQuarter: 'Q1 2027',
    },
  ];

  const categories = ['All', 'Safety', 'Driving', 'Location', 'Circles & Privacy', 'Communication', 'Pipeline'];

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
        <View style={[styles.header, { paddingTop: headerPaddingTop, backgroundColor: colors.card, borderBottomColor: colors.divider }, webGlassCard]}>
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
                  <Ionicons name={feat.isPipeline ? 'rocket-outline' : 'checkmark-circle'} size={16} color={feat.isPipeline ? feat.color : '#10B981'} />
                  <Text style={[styles.metaStatusText, { color: colors.textMain }]}>{feat.highlight}</Text>
                </View>
              </View>

              {/* Interactive Try Button / Pipeline Status */}
              {feat.isPipeline ? (
                <View style={[styles.pipelineRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)', borderColor: colors.divider }]}>
                  <Feather name="clock" size={13} color={colors.textMuted} />
                  <Text style={[styles.pipelineText, { color: colors.textMuted }]}>
                    Active Engineering • Target {feat.targetQuarter || 'Coming Soon'}
                  </Text>
                </View>
              ) : feat.actionId ? (
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
              ) : null}
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
    paddingTop: Platform.OS === 'ios' ? 54 : 12,
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
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  pipelineText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
