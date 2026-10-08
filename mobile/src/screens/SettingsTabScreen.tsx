import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Share,
  Platform,
  Linking,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { navigationService } from '../services/NavigationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle, getWebGlassPillStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from '../components/Avatar';
import { Circle } from '../models/Circle';
import { MapStyleConfig, MAP_STYLES, ALL_MAP_STYLES } from '../models/MapStyle';
import { AppThemeId, ALL_APP_THEMES, themeService } from '../theme/ThemeService';
import {
  TileCacheService,
  CacheStats,
  CacheProgress,
  FrequentLocation,
  SmartCacheConfig,
  CACHE_LIMIT_PRESETS,
} from '../services/TileCacheService';
import {
  distancePreferencesService,
  DistancePreferences,
  TransportMode,
  DistanceUnit,
  TRANSPORT_MODES,
} from '../services/DistancePreferencesService';
import {
  notificationService,
  NotificationPreferences,
} from '../services/NotificationService';
import { authService } from '../services/AuthService';
import { circleCustomizationService } from '../services/CircleCustomizationService';
import { backgroundLocationService } from '../services/BackgroundLocationService';
import { serverConfigService } from '../services/ServerConfigService';
import { ServerConfigModal } from '../components/modals/ServerConfigModal';
import { SafetyDebugModal } from '../components/modals/SafetyDebugModal';
import {
  LANDING_PAGE_URL,
  GITHUB_REPO_URL,
  GITHUB_RELEASES_URL,
  GITHUB_ISSUES_URL,
  CLOUD_API_HEALTH_URL,
  DEVELOPER_PROFILE_URL,
  LICENSE_URL,
} from '../constants/urls';
import {
  formatDistance,
  formatSpeed,
  calculateTravelMinutes,
  formatTravelEta,
} from '../utils/distance';

type SettingsSubView =
  | 'main'
  | 'profile'
  | 'account'
  | 'circle'
  | 'notifications'
  | 'map'
  | 'distance_mode'
  | 'offline_cache'
  | 'theme'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'features';

export interface SettingsTabScreenProps {
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserPhone?: string | null;
  currentUserAvatar?: string | null;
  activeMapStyle?: MapStyleConfig;
  backendUrl?: string;
  circles?: Circle[];
  selectedCircle?: Circle | null;
  activeThemeId?: AppThemeId;
  onUpdateName?: (newName: string) => Promise<void>;
  onSaveAvatar?: (avatarUrl: string | null) => void;
  onSelectMapStyle?: (style: MapStyleConfig) => void;
  onSelectTheme?: (themeId: AppThemeId) => void;
  onSelectCircle?: (circle: Circle) => void;
  onCreateCircle?: () => void;
  onJoinCircle?: () => void;
  onInviteMembers?: () => void;
  onRenameCircle?: (newName: string) => void;
  onLeaveCircle?: () => void;
  onOpenCircleSettings?: () => void;
  onRequestPermissions?: () => void;
  cacheStats?: CacheStats | null;
  frequentLocations?: FrequentLocation[];
  cacheProgress?: CacheProgress | null;
  isCaching?: boolean;
  onCacheAllFrequent?: () => void;
  onCacheCurrentView?: () => void;
  onClearCache?: () => void;
  onSignOut?: () => void;
  onOpenFeaturesCatalog?: () => void;
  onServerChanged?: (newWsUrl: string) => void;
  onTriggerFeature?: (actionId: string) => void;
  onDistancePreferencesChanged?: (prefs: DistancePreferences) => void;
  onSubViewChange?: (isSubView: boolean) => void;
}

const MAP_CARD_METADATA: Record<string, { badge: string; subtitle: string }> = {
  detailedOsm: { badge: 'Civic', subtitle: 'Streets, landmarks & amenities' },
  satellite: { badge: 'Aerial', subtitle: 'High-res satellite photography' },
  streetMap: { badge: 'Highways', subtitle: 'Clean arterials & roadways' },
  topographic: { badge: 'Terrain', subtitle: 'Elevation contours & trails' },
  cyclosm: { badge: 'Cycling', subtitle: 'Dedicated bike & walking paths' },
  humanitarian: { badge: 'Safety', subtitle: 'Community & emergency routes' },
};

interface CatalogFeatureItem {
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

const ALL_CATALOG_FEATURES: CatalogFeatureItem[] = [
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

export const SettingsTabScreen: React.FC<SettingsTabScreenProps> = React.memo(({
  currentUserId = 'user_me',
  currentUserName = 'User',
  currentUserEmail,
  currentUserPhone,
  currentUserAvatar,
  activeMapStyle = MAP_STYLES.detailedOsm,
  backendUrl = '',
  circles = [],
  selectedCircle,
  activeThemeId = 'light',
  onUpdateName,
  onSaveAvatar,
  onSelectMapStyle,
  onSelectTheme,
  onSelectCircle,
  onCreateCircle,
  onJoinCircle,
  onInviteMembers,
  onRenameCircle,
  onLeaveCircle,
  onOpenCircleSettings,
  onRequestPermissions,
  cacheStats: propCacheStats,
  frequentLocations = [],
  cacheProgress,
  isCaching = false,
  onCacheAllFrequent,
  onCacheCurrentView,
  onClearCache,
  onSignOut,
  onOpenFeaturesCatalog,
  onServerChanged,
  onTriggerFeature,
  onDistancePreferencesChanged,
  onSubViewChange,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const insets = useSafeAreaInsets();
  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  // ─── Server & Debug Modals State ──────────────────────────────────────────
  const [showServerModal, setShowServerModal] = useState(false);
  const [showSafetyDebugModal, setShowSafetyDebugModal] = useState(false);
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);

  // ─── Scroll Ref & Auto-Scroll to Top ──────────────────────────────────────
  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToTop = useCallback((animated: boolean = false) => {
    scrollViewRef.current?.scrollTo({ y: 0, animated });
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated });
    });
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated });
    }, 50);
  }, []);

  // ─── Subview Navigation & Back Stack ──────────────────────────────────────
  const [currentView, setCurrentView] = useState<SettingsSubView>('main');
  const viewHistoryRef = useRef<SettingsSubView[]>(['main']);

  useEffect(() => {
    scrollToTop(false);
  }, [currentView, scrollToTop]);

  const navigateToView = useCallback(
    (nextView: SettingsSubView) => {
      if (nextView !== viewHistoryRef.current[viewHistoryRef.current.length - 1]) {
        viewHistoryRef.current.push(nextView);
      }
      setCurrentView(nextView);
      scrollToTop(false);
      onSubViewChange?.(nextView !== 'main');
    },
    [onSubViewChange, scrollToTop]
  );

  const handleSettingsBack = useCallback((): boolean => {
    if (showSafetyDebugModal) {
      setShowSafetyDebugModal(false);
      return true;
    }
    if (showServerModal) {
      setShowServerModal(false);
      return true;
    }
    if (currentView !== 'main') {
      if (viewHistoryRef.current.length > 1) {
        viewHistoryRef.current.pop();
        const prev = viewHistoryRef.current[viewHistoryRef.current.length - 1] || 'main';
        setCurrentView(prev);
        scrollToTop(false);
        onSubViewChange?.(prev !== 'main');
      } else {
        setCurrentView('main');
        scrollToTop(false);
        onSubViewChange?.(false);
      }
      return true;
    }
    return false;
  }, [showServerModal, currentView, onSubViewChange, scrollToTop]);

  useEffect(() => {
    const unregister = navigationService.registerBackHandler('settings_subview', handleSettingsBack, 80);
    return () => unregister();
  }, [handleSettingsBack]);

  // ─── Location Tracking Status ─────────────────────────────────────────────
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  useEffect(() => {
    backgroundLocationService.isTracking().then(setIsTrackingEnabled);
  }, []);

  // ─── Profile State ────────────────────────────────────────────────────────
  const [profileName, setProfileName] = useState(currentUserName);
  const [profilePhone, setProfilePhone] = useState(currentUserPhone || '');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(currentUserAvatar || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    setProfileName(currentUserName);
  }, [currentUserName]);

  useEffect(() => {
    setProfilePhone(currentUserPhone || '');
  }, [currentUserPhone]);

  useEffect(() => {
    setProfileAvatar(currentUserAvatar || null);
  }, [currentUserAvatar]);


  // ─── Circle Rename State ──────────────────────────────────────────────────
  const [editingCircleName, setEditingCircleName] = useState(selectedCircle?.name || '');
  useEffect(() => {
    if (selectedCircle?.name) {
      setEditingCircleName(selectedCircle.name);
    }
  }, [selectedCircle?.name]);

  // ─── Notification Preferences State ───────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    notificationService.getPreferences()
  );

  const handleToggleNotif = async (key: keyof NotificationPreferences, value: any) => {
    const updated = await notificationService.updatePreferences({ [key]: value });
    setNotifPrefs(updated);
    if (backendUrl && currentUserId) {
      authService.saveUserPreferences(backendUrl, currentUserId, {
        safetyNotificationsEnabled: updated.enabled,
        notificationPreferences: updated,
      }).catch(() => {});
    }
  };

  const handleTestNotif = () => {
    notificationService.sendTestNotification();
  };

  // ─── Distance & Travel Mode State ─────────────────────────────────────────
  const [distancePrefs, setDistancePrefs] = useState<DistancePreferences>(
    distancePreferencesService.getPreferencesSync()
  );

  useEffect(() => {
    const unsub = distancePreferencesService.subscribe((prefs) => {
      setDistancePrefs(prefs);
    });
    return unsub;
  }, []);

  const handleUpdateDistanceMode = async (mode: TransportMode) => {
    const updated = await distancePreferencesService.setPreferences({ mode });
    setDistancePrefs(updated);
    onDistancePreferencesChanged?.(updated);
  };

  const handleUpdateDistanceUnit = async (unit: DistanceUnit) => {
    const updated = await distancePreferencesService.setPreferences({ unit });
    setDistancePrefs(updated);
    onDistancePreferencesChanged?.(updated);
    if (backendUrl && currentUserId) {
      authService.saveUserPreferences(backendUrl, currentUserId, {
        distanceUnit: unit,
      }).catch(() => {});
    }
  };

  const handleToggleShowEta = async (val: boolean) => {
    const updated = await distancePreferencesService.setPreferences({ showEta: val });
    setDistancePrefs(updated);
    onDistancePreferencesChanged?.(updated);
  };

  // ─── Cache Stats & Smart Config ───────────────────────────────────────────
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(propCacheStats || null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [smartConfig, setSmartConfig] = useState<SmartCacheConfig>({
    enabled: true,
    maxLimitMB: 60,
    autoCacheFrequent: true,
  });

  useEffect(() => {
    if (propCacheStats) {
      setCacheStats(propCacheStats);
    }
  }, [propCacheStats]);

  useEffect(() => {
    TileCacheService.getCacheStats().then(setCacheStats);
    TileCacheService.getSmartConfig().then(setSmartConfig);
    const unsubConfig = TileCacheService.subscribeConfig(setSmartConfig);
    const unsubStats = TileCacheService.subscribeStats(setCacheStats);
    return () => {
      unsubConfig();
      unsubStats();
    };
  }, []);

  // ─── Theme State ──────────────────────────────────────────────────────────
  const [selectedThemeId, setSelectedThemeId] = useState<AppThemeId>(
    activeThemeId || themeService.getActiveThemeId()
  );

  useEffect(() => {
    if (activeThemeId) {
      setSelectedThemeId(activeThemeId);
    }
  }, [activeThemeId]);

  const handleSelectTheme = async (themeId: AppThemeId) => {
    setSelectedThemeId(themeId);
    await themeService.setTheme(themeId);
    onSelectTheme?.(themeId);
  };

  // ─── Features Catalog Search & Filter State ───────────────────────────────
  const [featureCategory, setFeatureCategory] = useState<string>('All');
  const [featureSearch, setFeatureSearch] = useState<string>('');

  // ─── Image Picker Handlers ────────────────────────────────────────────────
  const handlePickFromGallery = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please enable photo library access to upload a picture.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProfileAvatar(dataUri);
      }
    } catch {
      Alert.alert('Upload Error', 'Could not open photo gallery.');
    }
  };

  const handleTakeFromCamera = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Please enable camera access to take a picture.');
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProfileAvatar(dataUri);
      }
    } catch {
      Alert.alert('Camera Error', 'Could not open camera.');
    }
  };

  const handleRemovePhoto = () => {
    setProfileAvatar(null);
  };

  // ─── Profile Save Action ──────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }
    setIsSavingProfile(true);
    try {
      await authService.updateProfile({
        backendUrl,
        fullName: profileName.trim(),
        phone: profilePhone.trim() || null,
        avatarUrl: profileAvatar,
      });
      onSaveAvatar?.(profileAvatar);
      await onUpdateName?.(profileName.trim());
      Alert.alert('Profile Updated', 'Your profile details have been successfully saved.');
      setCurrentView('main');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };


  // ─── Clear Cache Action ───────────────────────────────────────────────────
  const handleClearCache = async () => {
    setIsClearingCache(true);
    const targetStyle = activeMapStyle?.id || 'detailedOsm';
    if (onClearCache) {
      await onClearCache();
    } else {
      await TileCacheService.clearCache(targetStyle);
    }
    const updated = await TileCacheService.getCacheStats(targetStyle);
    setCacheStats(updated);
    setIsClearingCache(false);
    Alert.alert('Cache Cleared', `Offline map storage for ${activeMapStyle?.name || 'current style'} has been cleared.`);
  };

  // ─── Sign Out Action ──────────────────────────────────────────────────────
  const handleConfirmSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from CareRing on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onSignOut },
    ]);
  };

  // ─── Delete Account Action ────────────────────────────────────────────────
  const handleConfirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account & Data',
      'This will permanently delete your account, circle memberships, and telemetry history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.deleteAccount(backendUrl);
              onSignOut?.();
            } catch (err) {
              console.warn('[SettingsTabScreen] Delete account error:', err);
              onSignOut?.();
            }
          },
        },
      ]
    );
  };

  // ─── Share Invite Code Action ─────────────────────────────────────────────
  const handleShareInviteCode = async () => {
    if (!selectedCircle) return;
    const meta = await circleCustomizationService.getCircleMeta(selectedCircle.id);
    const isPolicyRestricted =
      meta?.invitePolicyAdminsOnly ||
      selectedCircle.invitePolicy === 'admins_only' ||
      (selectedCircle as any).invite_policy === 'admins_only';
    const isOwnerOrAdmin =
      selectedCircle.role?.toLowerCase() === 'owner' ||
      selectedCircle.role?.toLowerCase() === 'admin';
    if (isPolicyRestricted && !isOwnerOrAdmin) {
      Alert.alert(
        'Invite Restricted',
        'Only circle admins and the owner can invite new members or share the invite code for this Circle.'
      );
      return;
    }
    const code = selectedCircle.inviteCode || (selectedCircle as any).invite_code || '';
    try {
      await Share.share({
        message: `Join my private family circle "${selectedCircle.name}" on CareRing! Use invite code: ${code}\n\nDownload CareRing: ${LANDING_PAGE_URL}`,
      });
    } catch {
      // dismissed
    }
  };

  // ─── Server Saved Handler ─────────────────────────────────────────────────
  const handleServerSaved = (newWsUrl: string) => {
    onServerChanged?.(newWsUrl);
    Alert.alert(
      'Server Changed',
      `CareRing is now configured to connect to ${serverConfigService.getCleanHost(newWsUrl)}. If switching to a different instance, please sign in with your credentials on that server.`,
      [
        { text: 'Sign Out & Re-login', onPress: onSignOut },
        { text: 'Keep Current Session', style: 'cancel' },
      ]
    );
  };

  // ─── Subview Header Title Helper ──────────────────────────────────────────
  const getViewTitle = (view: SettingsSubView): string => {
    switch (view) {
      case 'profile':
        return 'Edit Profile';
      case 'account':
        return 'Account & Security';
      case 'circle':
        return 'Circle Management';
      case 'notifications':
        return 'Notifications & Alerts';
      case 'map':
        return 'Map Visual Style';
      case 'distance_mode':
        return 'Distance & Travel Mode';
      case 'offline_cache':
        return 'Offline Raster Tiles';
      case 'theme':
        return 'App Theme';
      case 'about':
        return 'About';
      case 'terms':
        return 'Terms & Conditions';
      case 'privacy':
        return 'Privacy Policy';
      case 'features':
        return 'Features Directory';
      default:
        return 'Settings';
    }
  };

  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);
  const headerPaddingTop = statusBarHeight + 12;

  // Filtered features catalog
  const filteredFeatures = ALL_CATALOG_FEATURES.filter((f) => {
    const matchesCat = featureCategory === 'All' || f.category === featureCategory;
    const matchesQuery =
      !featureSearch.trim() ||
      f.title.toLowerCase().includes(featureSearch.toLowerCase()) ||
      f.description.toLowerCase().includes(featureSearch.toLowerCase()) ||
      f.highlight.toLowerCase().includes(featureSearch.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: headerPaddingTop,
            backgroundColor: colors.card,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        {currentView !== 'main' ? (
          <TouchableOpacity
            onPress={handleSettingsBack}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
            <Text style={[styles.backBtnText, { color: colors.primary }]}>Settings</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.textMain }]}>Settings</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Profile, preferences, security & family circles
            </Text>
          </View>
        )}

        {currentView !== 'main' && (
          <Text style={[styles.subViewHeaderTitle, { color: colors.textMain }]} numberOfLines={1}>
            {getViewTitle(currentView)}
          </Text>
        )}

        {currentView !== 'main' && <View style={{ width: 44 }} />}
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 90, 120) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* VIEW 1: MAIN SETTINGS DIRECTORY                                           */}
        {/* ========================================================================= */}
        {currentView === 'main' && (
          <>
            {/* Profile Hero Card */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigateToView('profile')}
              style={[styles.profileHeroCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
            >
              <Avatar name={currentUserName} avatarUrl={currentUserAvatar} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileHeroName, { color: colors.textMain }]}>{currentUserName}</Text>
                <Text style={[styles.profileHeroEmail, { color: colors.textMuted }]} numberOfLines={1}>
                  {currentUserEmail || 'No email attached'}
                </Text>
                <View style={styles.memberTag}>
                  <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                  <Text style={styles.memberTagText}>PLATINUM ACTIVE</Text>
                </View>
              </View>
              <View style={[styles.editProfilePill, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#F5F3FF' }]}>
                <Text style={[styles.editProfilePillText, { color: colors.primary }]}>Edit</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Section: Circle & Family */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>CIRCLE & FAMILY</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('circle')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EDE9FE' }]}>
                  <Ionicons name="people" size={18} color="#7C3AED" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Circle Management</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]} numberOfLines={1}>
                    Active: {selectedCircle ? selectedCircle.name : 'None selected'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {onInviteMembers && (
                <TouchableOpacity
                  style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                  activeOpacity={0.7}
                  onPress={onInviteMembers}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#ECFDF5' }]}>
                    <Ionicons name="person-add" size={18} color="#10B981" />
                  </View>
                  <View style={styles.menuTextWrap}>
                    <Text style={[styles.menuTitle, { color: colors.textMain }]}>Invite Members</Text>
                    <Text style={[styles.menuSub, { color: colors.textMuted }]}>Share circle code via SMS or messaging</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              {onOpenCircleSettings && (
                <TouchableOpacity
                  style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                  activeOpacity={0.7}
                  onPress={onOpenCircleSettings}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' }]}>
                    <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.menuTextWrap}>
                    <Text style={[styles.menuTitle, { color: colors.textMain }]}>Circle Governance & Safety</Text>
                    <Text style={[styles.menuSub, { color: colors.textMuted }]}>Member roles, nicknames, and permissions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('account')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#EFF6FF' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#2563EB" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Account & Security</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Google account, security, delete account</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: Features Directory */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>CARERING CAPABILITIES</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => {
                  if (onOpenFeaturesCatalog) {
                    onOpenFeaturesCatalog();
                  } else {
                    navigateToView('features');
                  }
                }}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#ECFDF5' }]}>
                  <Ionicons name="sparkles" size={18} color="#059669" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>All Features Directory</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Explore all 16 safety & tracking capabilities</Text>
                </View>
                <View style={styles.badgeStatus}>
                  <Text style={styles.badgeStatusText}>16 ACTIVE</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: 24/7 Background Protection */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>24/7 BACKGROUND LOCATION & TIMELINE</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => onRequestPermissions?.()}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#EEF2FF' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#4F46E5" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Background Tracking & Timeline</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    {isTrackingEnabled
                      ? 'Active • Continuous daily timeline & stop recording'
                      : 'Allow all the time • Tap to configure permissions'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badgeStatus,
                    { backgroundColor: isTrackingEnabled ? '#ECFDF5' : '#FEF3C7' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeStatusText,
                      { color: isTrackingEnabled ? '#059669' : '#D97706' },
                    ]}
                  >
                    {isTrackingEnabled ? 'ACTIVE' : 'SETUP'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: Notifications */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>NOTIFICATIONS & ALERTS</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('notifications')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEF2F2' }]}>
                  <Ionicons name="notifications" size={18} color="#DC2626" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Push Notifications & Alerts</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Speeding, movement, chat, and geofence alerts</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: Map, Navigation & Distance */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>MAP, NAVIGATION & DISTANCE</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('distance_mode')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#ECFDF5' }]}>
                  <Ionicons name="navigate-circle-outline" size={20} color="#10B981" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Distance & Travel Mode</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    {TRANSPORT_MODES[distancePrefs.mode]?.name} • {distancePrefs.unit === 'imperial' ? 'Imperial (mi)' : 'Metric (km)'}
                  </Text>
                </View>
                <View style={[styles.themePreviewChip, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5' }]}>
                  <Text style={[styles.themePreviewChipText, { color: '#059669' }]}>
                    {TRANSPORT_MODES[distancePrefs.mode]?.emoji} {TRANSPORT_MODES[distancePrefs.mode]?.shortName}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('map')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}>
                  <Ionicons name="map-outline" size={18} color={isDark ? '#94A3B8' : '#475569'} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Map Cartography Style</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Active: {activeMapStyle?.name || 'Detailed Civic'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('offline_cache')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}>
                  <Feather name="database" size={17} color={isDark ? '#94A3B8' : '#475569'} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Offline Raster Tiles</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    {cacheStats ? `${cacheStats.count} tiles • ${cacheStats.formattedSize}` : '0 tiles • 0 B'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: Appearance & Theme */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>APPEARANCE & THEME</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('theme')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(147, 51, 234, 0.25)' : '#F3E8FF' }]}>
                  <Ionicons name="color-palette-outline" size={18} color="#9333EA" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Theme</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    {selectedThemeId === 'system'
                      ? 'System Default (Auto Sync)'
                      : selectedThemeId === 'dark' || selectedThemeId === 'dark-glass'
                      ? 'Dark Mode (Flat UI)'
                      : 'Light Mode (Flat UI)'}
                  </Text>
                </View>
                <View style={[styles.themePreviewChip, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }]}>
                  <Text style={[styles.themePreviewChipText, { color: colors.primary }]}>
                    {selectedThemeId === 'system' ? 'Auto' : selectedThemeId === 'dark' ? 'Dark' : 'Light'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: Infrastructure & Server */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>NETWORK & SERVER</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => setShowServerModal(true)}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#F0F9FF' }]}>
                  <Ionicons name="server-outline" size={18} color="#0284C7" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Backend Server</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {serverConfigService.isCustomServer()
                      ? `Self-Hosted (${serverConfigService.getCleanHost(backendUrl)})`
                      : 'CareRing Cloud (care-ring.onrender.com)'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.themePreviewChip,
                    {
                      backgroundColor: serverConfigService.isCustomServer()
                        ? 'rgba(168, 85, 247, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.themePreviewChipText,
                      { color: serverConfigService.isCustomServer() ? '#A855F7' : '#10B981' },
                    ]}
                  >
                    {serverConfigService.isCustomServer() ? 'Custom' : 'Cloud'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: Developer Mode & Diagnostics */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>DEVELOPER MODE & DIAGNOSTICS</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              {/* Row 1: Developer Mode Toggle */}
              <View style={[styles.menuRow, { borderBottomColor: colors.divider }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FEF3C7' }]}>
                  <Ionicons name="code-slash" size={18} color="#D97706" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Developer Mode</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    {developerModeEnabled ? 'Diagnostics & sensor debugging active' : 'Unlock real-time telemetry debug inspection'}
                  </Text>
                </View>
                <Switch
                  value={developerModeEnabled}
                  onValueChange={setDeveloperModeEnabled}
                  trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
                />
              </View>

              {/* Row 2: Safety & Telemetry Debug Tool */}
              <TouchableOpacity
                style={[
                  styles.menuRow,
                  {
                    borderBottomWidth: 0,
                    opacity: developerModeEnabled ? 1 : 0.45,
                  },
                ]}
                activeOpacity={developerModeEnabled ? 0.7 : 1}
                onPress={() => {
                  if (!developerModeEnabled) {
                    Alert.alert(
                      'Developer Mode Required',
                      'Please toggle on Developer Mode above to access real-time safety telemetry & kinematic sensor debugging.'
                    );
                    return;
                  }
                  setShowSafetyDebugModal(true);
                }}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' }]}>
                  <Ionicons name="construct-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Safety Detection Debug</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    Real-time kinematic state, crash impact & engine controls
                  </Text>
                </View>
                <View
                  style={[
                    styles.badgeStatus,
                    {
                      backgroundColor: developerModeEnabled
                        ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF')
                        : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeStatusText,
                      { color: developerModeEnabled ? colors.primary : colors.textMuted },
                    ]}
                  >
                    DEBUG
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Section: About & Legal */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ABOUT & LEGAL</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <TouchableOpacity
                style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('about')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#F5F3FF' }]}>
                  <Ionicons name="information-circle-outline" size={19} color="#7C3AED" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>About Us</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Mission, architecture, and story</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('terms')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#F5F3FF' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Terms & Conditions</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Terms of service and safety disclaimers</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, { borderBottomColor: colors.divider }]}
                activeOpacity={0.7}
                onPress={() => navigateToView('privacy')}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#F5F3FF' }]}>
                  <Ionicons name="shield-outline" size={18} color="#7C3AED" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Privacy Policy</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>100% private, zero broker selling</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(LANDING_PAGE_URL)}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#ECFDF5' }]}>
                  <Ionicons name="globe-outline" size={18} color="#059669" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Official Website</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>care-ring.netlify.app</Text>
                </View>
                <View style={[styles.themePreviewChip, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5' }]}>
                  <Text style={[styles.themePreviewChipText, { color: '#059669' }]}>Web</Text>
                </View>
                <Feather name="external-link" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity activeOpacity={0.8} onPress={handleConfirmSignOut} style={styles.signOutBtn}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            {/* Version Footer */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigateToView('about')}
              style={{ alignItems: 'center' }}
            >
              <Text style={styles.versionFooter}>
                CareRing v{Constants.expoConfig?.version || '1.0.0'} (Build {Constants.expoConfig?.android?.versionCode || 1}) • Developed by Sunny Sahsi
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: PROFILE SUBVIEW                                                   */}
        {/* ========================================================================= */}
        {currentView === 'profile' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Edit Profile</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Customize how circle members see you on the live map and chat.
            </Text>

            {/* Avatar Preview & Actions */}
            <View style={styles.avatarEditWrap}>
              <Avatar name={profileName} avatarUrl={profileAvatar} size={84} />
              <View style={styles.avatarButtonsRow}>
                <TouchableOpacity
                  onPress={handlePickFromGallery}
                  style={[
                    styles.avatarActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#F5F3FF',
                      borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#DDD6FE',
                    },
                  ]}
                >
                  <Feather name="image" size={15} color={colors.primary} />
                  <Text style={[styles.avatarActionBtnText, { color: colors.primary }]}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleTakeFromCamera}
                  style={[
                    styles.avatarActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#F5F3FF',
                      borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#DDD6FE',
                    },
                  ]}
                >
                  <Feather name="camera" size={15} color={colors.primary} />
                  <Text style={[styles.avatarActionBtnText, { color: colors.primary }]}>Camera</Text>
                </TouchableOpacity>

                {profileAvatar ? (
                  <TouchableOpacity onPress={handleRemovePhoto} style={styles.avatarRemoveBtn}>
                    <Feather name="trash-2" size={15} color="#EF4444" />
                    <Text style={styles.avatarRemoveBtnText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Name Input */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Display Name</Text>
            <TextInput
              value={profileName}
              onChangeText={setProfileName}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.textMain,
                },
              ]}
              placeholder="Your full name"
              placeholderTextColor={colors.textMuted}
            />

            {/* Phone Input */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Phone Number (Optional)</Text>
            <TextInput
              value={profilePhone}
              onChangeText={setProfilePhone}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.textMain,
                },
              ]}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />

            {/* Save Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            >
              {isSavingProfile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Save Profile Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: ACCOUNT & PASSWORD SUBVIEW                                        */}
        {/* ========================================================================= */}
        {currentView === 'account' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Account & Security</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Manage your credentials, authentication security, and account status.
            </Text>

            {/* Account Details Card */}
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.cardBorder,
                },
                webGlassTile,
              ]}
            >
              <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Email Address</Text>
                <Text style={[styles.infoValue, { color: colors.textMain }]}>{currentUserEmail || 'Not configured'}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>User ID</Text>
                <Text style={[styles.infoValue, { color: colors.textMain }]} numberOfLines={1}>{currentUserId}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Status</Text>
                <Text style={[styles.infoValue, { color: '#10B981', fontWeight: '800' }]}>
                  Active Platinum
                </Text>
              </View>
            </View>

            {/* Google Authentication Info Card */}
            <Text style={[styles.sectionHeader, { marginTop: 20, color: colors.textMuted }]}>AUTHENTICATION & SECURITY</Text>
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.cardBorder,
                  padding: 16,
                },
                webGlassTile,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textMain }}>
                  Signed in with Google
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                Your account authentication is secured via Google Sign-In. Zero custom passwords are required or stored.
              </Text>
            </View>

            {/* Danger Zone */}
            <Text style={[styles.sectionHeader, { marginTop: 30, color: '#DC2626' }]}>DANGER ZONE</Text>
            <View
              style={[
                styles.dangerCard,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FFF1F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECDD3',
                },
              ]}
            >
              <Text style={[styles.dangerTitle, { color: isDark ? '#F87171' : '#BE123C' }]}>Delete Account</Text>
              <Text style={[styles.dangerDesc, { color: isDark ? '#FCA5A5' : '#9F1239' }]}>
                Permanently delete your profile, circles, and telemetry data. This cannot be undone.
              </Text>
              <TouchableOpacity
                onPress={handleConfirmDeleteAccount}
                style={[styles.dangerBtn, { backgroundColor: '#DC2626' }]}
              >
                <Text style={styles.dangerBtnText}>Permanently Delete My Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: CIRCLE MANAGEMENT SUBVIEW                                         */}
        {/* ========================================================================= */}
        {currentView === 'circle' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Circle Management</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Switch between family circles, manage invite codes, and update permissions.
            </Text>

            {/* Active Circle Card */}
            {selectedCircle ? (
              <View
                style={[
                  styles.activeCircleCard,
                  {
                    backgroundColor: colors.tileBg,
                    borderColor: colors.cardBorder,
                  },
                  webGlassTile,
                ]}
              >
                <View style={styles.circleHeaderRow}>
                  <View
                    style={[
                      styles.circleAvatar,
                      { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#EDE9FE' },
                    ]}
                  >
                    <Ionicons name="people" size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.activeCircleName, { color: colors.textMain }]} numberOfLines={1}>
                        {selectedCircle.name}
                      </Text>
                      {selectedCircle?.role?.toLowerCase() === 'owner' ? (
                        <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>Owner</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: isDark ? 'rgba(100, 116, 139, 0.22)' : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textMuted }}>Member</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.activeCircleCode, { color: colors.textSecondary }]}>
                      Invite Code: {selectedCircle.inviteCode || (selectedCircle as any).invite_code}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleShareInviteCode}
                    style={{
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Ionicons name="share-social-outline" size={14} color={colors.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Share</Text>
                  </TouchableOpacity>
                </View>

                {/* Only Owner can edit circle name */}
                {selectedCircle?.role?.toLowerCase() === 'owner' ? (
                  <>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Edit Circle Name</Text>
                    <View style={styles.renameRow}>
                      <TextInput
                        value={editingCircleName}
                        onChangeText={setEditingCircleName}
                        style={[
                          styles.textInput,
                          {
                            flex: 1,
                            marginBottom: 0,
                            backgroundColor: colors.inputBg,
                            borderColor: colors.inputBorder,
                            color: colors.textMain,
                          },
                        ]}
                        placeholder="Circle name"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          if (editingCircleName.trim() && onRenameCircle) {
                            onRenameCircle(editingCircleName.trim());
                            Alert.alert('Updated', 'Circle name updated successfully.');
                          }
                        }}
                        style={[styles.saveRenameBtn, { backgroundColor: colors.primary }]}
                      >
                        <Text style={styles.saveRenameBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F1F5F9',
                      borderColor: colors.cardBorder,
                      borderWidth: 1,
                      padding: 12,
                      borderRadius: 12,
                      marginTop: 8,
                    }}
                  >
                    <Ionicons name="lock-closed" size={16} color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontWeight: '600', flex: 1, lineHeight: 17 }}>
                      You are a member of this Circle. Group name and settings can only be changed by the Circle Owner.
                    </Text>
                  </View>
                )}

                {onOpenCircleSettings && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.primary,
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      marginTop: 14,
                    }}
                    activeOpacity={0.82}
                    onPress={onOpenCircleSettings}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>
                        Circle Governance & Nicknames
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={{ color: colors.textMuted, marginBottom: 12 }}>No circle selected.</Text>
            )}

            {/* Circles List */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>YOUR CIRCLES ({circles.length})</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              {circles.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>You do not belong to any circles yet.</Text>
                </View>
              ) : (
                circles.map((c, idx) => {
                  const isActive = selectedCircle?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.menuRow,
                        { borderBottomColor: colors.divider },
                        idx === circles.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => onSelectCircle?.(c)}
                    >
                      <Ionicons
                        name={isActive ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isActive ? colors.primary : isDark ? '#64748B' : '#94A3B8'}
                      />
                      <View style={styles.menuTextWrap}>
                        <Text
                          style={[
                            styles.menuTitle,
                            { color: colors.textMain },
                            isActive && { color: colors.primary, fontWeight: '800' },
                          ]}
                        >
                          {c.name}
                        </Text>
                        <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                          Code: {c.inviteCode || (c as any).invite_code}
                        </Text>
                      </View>
                      {isActive && (
                        <View style={[styles.activeBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' }]}>
                          <Text style={[styles.activeBadgeText, { color: colors.primary }]}>ACTIVE</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Circle Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              {onCreateCircle && (
                <TouchableOpacity
                  onPress={onCreateCircle}
                  style={[styles.actionGridBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="plus-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.actionGridBtnText}>Create Circle</Text>
                </TouchableOpacity>
              )}
              {onJoinCircle && (
                <TouchableOpacity
                  onPress={onJoinCircle}
                  style={[
                    styles.actionGridBtn,
                    {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#F1F5F9',
                      borderColor: colors.cardBorder,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Feather name="log-in" size={16} color={colors.textMain} />
                  <Text style={[styles.actionGridBtnText, { color: colors.textMain }]}>Join with Code</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Leave Circle Button */}
            {selectedCircle && onLeaveCircle && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Leave Circle',
                    `Are you sure you want to leave ${selectedCircle.name}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Leave', style: 'destructive', onPress: onLeaveCircle },
                    ]
                  );
                }}
                style={styles.leaveCircleBtn}
              >
                <Ionicons name="exit-outline" size={16} color="#DC2626" />
                <Text style={styles.leaveCircleBtnText}>Leave This Circle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 5: NOTIFICATIONS SUBVIEW                                             */}
        {/* ========================================================================= */}
        {currentView === 'notifications' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Notifications & Alerts</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Manage push notifications for high speeding, movement, chat, and place arrivals.
            </Text>

            {/* Master Push Toggle */}
            <View style={[styles.notifCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.notifRow}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.22)' : '#F5F3FF' }]}>
                  <Ionicons name="notifications" size={20} color={Colors.primary} />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>Push Notifications</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>Receive immediate safety and message banners</Text>
                </View>
                <Switch
                  value={notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('enabled', val)}
                  trackColor={{ true: Colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>
            </View>

            {/* Safety & Driving Alerts */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SAFETY & DRIVING</Text>
            <View style={[styles.notifCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.notifRow}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEF2F2' }]}>
                  <Ionicons name="speedometer" size={19} color="#DC2626" />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>High Speeding Alerts</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>
                    Notify when a family member drives above {formatSpeed(notifPrefs.speedThresholdKmH, distancePrefs.unit)}
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.speedingAlerts}
                  disabled={!notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('speedingAlerts', val)}
                  trackColor={{ true: '#DC2626', false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>

              {/* Speed Threshold Selector Pills */}
              {notifPrefs.speedingAlerts && (
                <View style={[styles.thresholdContainer, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#F8FAFC', borderTopColor: colors.tileBorder }]}>
                  <Text style={[styles.thresholdLabel, { color: colors.textMuted }]}>ALERT TRIGGER THRESHOLD</Text>
                  <View style={styles.thresholdPillsRow}>
                    {[70, 80, 90, 100].map((speed) => {
                      const isAct = notifPrefs.speedThresholdKmH === speed;
                      const speedLabel = formatSpeed(speed, distancePrefs.unit);
                      return (
                        <TouchableOpacity
                          key={speed}
                          activeOpacity={0.8}
                          onPress={() => handleToggleNotif('speedThresholdKmH', speed)}
                          style={[
                            styles.thresholdPill,
                            {
                              backgroundColor: isAct ? '#DC2626' : colors.tileBg,
                              borderColor: isAct ? '#DC2626' : colors.tileBorder,
                            },
                            !isAct && webGlassPill,
                          ]}
                        >
                          <Text
                            style={[
                              styles.thresholdPillText,
                              isAct && styles.thresholdPillTextActive,
                            ]}
                          >
                            {speedLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={[styles.notifRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.22)' : '#EFF6FF' }]}>
                  <Ionicons name="car-sport" size={19} color="#3B82F6" />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>Movement & Drive Detection</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>Alert when a family member begins driving</Text>
                </View>
                <Switch
                  value={notifPrefs.movementAlerts}
                  disabled={!notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('movementAlerts', val)}
                  trackColor={{ true: '#2563EB', false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>

              <View style={[styles.notifRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#FEF2F2' }]}>
                  <Ionicons name="battery-dead" size={19} color="#D97706" />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>Low Battery Warnings</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>Alert when a family member drops below 15%</Text>
                </View>
                <Switch
                  value={notifPrefs.lowBatteryAlerts !== false}
                  disabled={!notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('lowBatteryAlerts', val)}
                  trackColor={{ true: '#D97706', false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>
            </View>

            {/* Communication & Places */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>COMMUNICATION & PLACES</Text>
            <View style={[styles.notifCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.notifRow}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.22)' : '#F5F3FF' }]}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={Colors.primary} />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>Chat & Direct Messages</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>Instant banner when a family message arrives</Text>
                </View>
                <Switch
                  value={notifPrefs.chatAlerts}
                  disabled={!notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('chatAlerts', val)}
                  trackColor={{ true: Colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>

              <View style={[styles.notifRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.22)' : '#ECFDF5' }]}>
                  <Ionicons name="location" size={18} color="#10B981" />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>Place Arrivals & Departures</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>Geofence transitions (Home, School, Work)</Text>
                </View>
                <Switch
                  value={notifPrefs.geofenceAlerts}
                  disabled={!notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('geofenceAlerts', val)}
                  trackColor={{ true: '#10B981', false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>

              <View style={[styles.notifRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEF2F2' }]}>
                  <Ionicons name="warning" size={18} color="#DC2626" />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>Emergency SOS Broadcasts</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>High-priority distress alerts</Text>
                </View>
                <Switch
                  value={notifPrefs.sosAlerts}
                  disabled={!notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('sosAlerts', val)}
                  trackColor={{ true: '#DC2626', false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>
            </View>

            {/* Sound & Haptics */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SOUND & HAPTICS</Text>
            <View style={[styles.notifCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.notifRow}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F8FAFC' }]}>
                  <Ionicons name="volume-high" size={18} color="#475569" />
                </View>
                <View style={styles.notifTextWrap}>
                  <Text style={[styles.notifTitle, { color: colors.textMain }]}>Play Alert Sound</Text>
                  <Text style={[styles.notifSub, { color: colors.textMuted }]}>Audible chime on alert arrival</Text>
                </View>
                <Switch
                  value={notifPrefs.soundEnabled}
                  disabled={!notifPrefs.enabled}
                  onValueChange={(val) => handleToggleNotif('soundEnabled', val)}
                  trackColor={{ true: Colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>
            </View>

            {/* Test Notification Trigger */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleTestNotif}
              style={styles.testNotifBtn}
            >
              <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
              <Text style={styles.testNotifBtnText}>Send Test Push Notification</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 6: MAP VISUAL STYLE SUBVIEW                                          */}
        {/* ========================================================================= */}
        {currentView === 'map' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Map Cartography Style</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Standardized cartography styles with visual previews for live family tracking.
            </Text>

            <View style={styles.mapCardsList}>
              {ALL_MAP_STYLES.map((style) => {
                const isSelected = activeMapStyle?.id === style.id;
                const meta = MAP_CARD_METADATA[style.id] || { badge: 'Map', subtitle: style.description };
                return (
                  <TouchableOpacity
                    key={style.id}
                    activeOpacity={0.85}
                    onPress={() => onSelectMapStyle?.(style)}
                    style={[
                      styles.mapStyleCard,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.tileBorder,
                      },
                      isSelected && styles.mapStyleCardSelected,
                    ]}
                  >
                    {/* Thumbnail Image */}
                    {style.previewThumbnail && (
                      <View style={styles.mapThumbWrap}>
                        <Image
                          source={{ uri: style.previewThumbnail }}
                          style={styles.mapThumbImage}
                          resizeMode="cover"
                        />
                        <View style={[styles.mapThumbBadge, { backgroundColor: isSelected ? colors.primary : 'rgba(15, 23, 42, 0.75)' }]}>
                          <Text style={styles.mapThumbBadgeText}>{meta.badge}</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.mapCardInfoRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.mapCardTitle,
                              { color: colors.textMain },
                              isSelected && { color: colors.primary, fontWeight: '800' },
                            ]}
                          >
                            {style.name}
                          </Text>
                        </View>
                        <Text style={[styles.mapCardSub, { color: colors.textMuted }]}>{meta.subtitle}</Text>
                      </View>

                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 7: DISTANCE & TRAVEL MODE SUBVIEW                                     */}
        {/* ========================================================================= */}
        {currentView === 'distance_mode' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Distance & Travel Mode</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Choose your preferred transport mode, calculation method, and measurement units across CareRing.
            </Text>

            {/* Live Interactive Sample Preview Card */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted, marginTop: 4 }]}>LIVE PREVIEW</Text>
            <View
              style={[
                styles.distancePreviewCard,
                { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                webGlassTile,
              ]}
            >
              <View style={styles.distancePreviewHeader}>
                <View style={styles.distancePreviewAvatarRow}>
                  <View style={[styles.distancePreviewAvatar, { backgroundColor: isDark ? '#312E81' : '#E0E7FF' }]}>
                    <Ionicons name="person" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.distancePreviewName, { color: colors.textMain }]}>Alex (Family Member)</Text>
                    <Text style={[styles.distancePreviewSub, { color: colors.textMuted }]}>
                      Sample member distance badge preview
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.distancePreviewPillRow,
                  {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.08)',
                    borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(79, 70, 229, 0.2)',
                  },
                ]}
              >
                <Ionicons
                  name={(TRANSPORT_MODES[distancePrefs.mode]?.icon as any) || 'car-sport'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.distancePreviewPillText, { color: colors.primary }]}>
                  {(() => {
                    const sampleMeters = 3500;
                    const factor = TRANSPORT_MODES[distancePrefs.mode]?.factor || 1.0;
                    const modeMeters = sampleMeters * factor;
                    const distStr = formatDistance(modeMeters, distancePrefs.unit);
                    if (distancePrefs.showEta && distancePrefs.mode !== 'air') {
                      const mins = calculateTravelMinutes(modeMeters, distancePrefs.mode);
                      const eta = formatTravelEta(mins, distancePrefs.mode);
                      return `${distStr} • ~${eta}`;
                    }
                    return `${distStr} (${TRANSPORT_MODES[distancePrefs.mode]?.shortName})`;
                  })()}
                </Text>
              </View>

              <View style={styles.distancePreviewFooter}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={[styles.distancePreviewFooterText, { color: colors.textSecondary }]}>
                  Distance is calculated from your current GPS location, not dynamic map camera.
                </Text>
              </View>
            </View>

            {/* Section: Select Travel Mode */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>TRANSPORT CALCULATION MODE</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              {(Object.keys(TRANSPORT_MODES) as TransportMode[]).map((modeKey, idx, arr) => {
                const item = TRANSPORT_MODES[modeKey];
                const isSelected = distancePrefs.mode === modeKey;
                return (
                  <TouchableOpacity
                    key={modeKey}
                    activeOpacity={0.8}
                    onPress={() => handleUpdateDistanceMode(modeKey)}
                    style={[
                      styles.menuRow,
                      idx === arr.length - 1 && { borderBottomWidth: 0 },
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.menuIconCircle,
                        {
                          backgroundColor: isSelected
                            ? isDark ? 'rgba(79, 70, 229, 0.3)' : '#E0E7FF'
                            : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.menuTitle,
                            {
                              color: isSelected ? colors.primary : colors.textMain,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {item.name}
                        </Text>
                        {modeKey === 'car' && (
                          <View style={[styles.tagBadge, { backgroundColor: isDark ? '#312E81' : '#E0E7FF' }]}>
                            <Text style={[styles.tagBadgeText, { color: colors.primary }]}>DEFAULT</Text>
                          </View>
                        )}
                        {modeKey === 'bike' && (
                          <View style={[styles.tagBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FEF3C7' }]}>
                            <Text style={[styles.tagBadgeText, { color: '#D97706' }]}>AGILE</Text>
                          </View>
                        )}
                        {modeKey === 'air' && (
                          <View style={[styles.tagBadge, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
                            <Text style={[styles.tagBadgeText, { color: '#059669' }]}>DIRECT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                        {item.description}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section: Distance Units (Metric vs Imperial) */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>MEASUREMENT UNITS</Text>
            <View
              style={[
                styles.unitSelectorCard,
                { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                webGlassTile,
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleUpdateDistanceUnit('metric')}
                style={[
                  styles.unitOptionBtn,
                  distancePrefs.unit === 'metric' && [
                    styles.unitOptionBtnActive,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ],
                ]}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={distancePrefs.unit === 'metric' ? '#FFFFFF' : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.unitOptionTitle,
                      { color: distancePrefs.unit === 'metric' ? '#FFFFFF' : colors.textMain },
                    ]}
                  >
                    Metric (km, m)
                  </Text>
                  <Text
                    style={[
                      styles.unitOptionSub,
                      { color: distancePrefs.unit === 'metric' ? 'rgba(255, 255, 255, 0.85)' : colors.textMuted },
                    ]}
                  >
                    Kilometers & meters
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleUpdateDistanceUnit('imperial')}
                style={[
                  styles.unitOptionBtn,
                  distancePrefs.unit === 'imperial' && [
                    styles.unitOptionBtnActive,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ],
                ]}
              >
                <Ionicons
                  name="navigate-outline"
                  size={18}
                  color={distancePrefs.unit === 'imperial' ? '#FFFFFF' : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.unitOptionTitle,
                      { color: distancePrefs.unit === 'imperial' ? '#FFFFFF' : colors.textMain },
                    ]}
                  >
                    Imperial (mi, ft)
                  </Text>
                  <Text
                    style={[
                      styles.unitOptionSub,
                      { color: distancePrefs.unit === 'imperial' ? 'rgba(255, 255, 255, 0.85)' : colors.textMuted },
                    ]}
                  >
                    Miles & feet
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Section: Display Options */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>DISPLAY OPTIONS</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <View style={[styles.menuRow, { borderBottomWidth: 0, justifyContent: 'space-between' }]}>
                <View style={styles.menuIconCircle}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                </View>
                <View style={[styles.menuTextWrap, { flex: 1 }]}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Show Travel Duration (ETA)</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    Display estimated travel time (e.g. ~8m drive) alongside distance
                  </Text>
                </View>
                <Switch
                  value={distancePrefs.showEta}
                  onValueChange={handleToggleShowEta}
                  trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                />
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 8: OFFLINE RASTER TILES SUBVIEW                                      */}
        {/* ========================================================================= */}
        {currentView === 'offline_cache' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Offline Raster Tiles</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              On-device hardware tile storage isolated per cartography style with Smart LFU/LRU eviction.
            </Text>

            {/* Storage Hero Card */}
            <View style={styles.cacheHeroCard}>
              <View style={styles.cacheHeroTop}>
                <View>
                  <Text style={styles.cacheHeroLabel}>ACTIVE MAP CACHE</Text>
                  <Text style={[styles.cacheHeroSize, { color: '#FFFFFF' }]}>
                    {cacheStats ? cacheStats.formattedSize : '0 B'}
                  </Text>
                </View>
                <View style={styles.cacheStatusBadge}>
                  <View style={styles.cacheGreenDot} />
                  <Text style={styles.cacheStatusText}>
                    {cacheStats && cacheStats.count > 0 ? 'Offline Ready' : 'Empty'}
                  </Text>
                </View>
              </View>

              <View style={styles.cacheStatsRow}>
                <View style={styles.cacheStatCol}>
                  <Feather name="layers" size={14} color="#A5B4FC" />
                  <Text style={[styles.cacheStatValue, { color: '#FFFFFF' }]}>
                    {cacheStats ? `${cacheStats.count} tiles` : '0 tiles'}
                  </Text>
                </View>
                <View style={styles.cacheStatDivider} />
                <View style={styles.cacheStatCol}>
                  <Ionicons name="location-outline" size={15} color="#34D399" />
                  <Text style={[styles.cacheStatValue, { color: '#FFFFFF' }]}>
                    {frequentLocations?.length || 0} Frequent Spots
                  </Text>
                </View>
              </View>

              {/* Progress Bar when caching */}
              {isCaching && cacheProgress && (
                <View style={styles.cacheProgressWrap}>
                  <View style={styles.cacheProgressRow}>
                    <Text style={styles.cacheProgressText} numberOfLines={1}>
                      {cacheProgress.locationName || 'Caching tiles...'}
                    </Text>
                    <Text style={styles.cacheProgressPct}>
                      {cacheProgress.total > 0
                        ? `${Math.min(100, Math.round((cacheProgress.current / cacheProgress.total) * 100))}%`
                        : '0%'}
                    </Text>
                  </View>
                  <View style={styles.cacheBarBg}>
                    <View
                      style={[
                        styles.cacheBarFill,
                        {
                          width: `${
                            cacheProgress.total > 0
                              ? Math.min(100, Math.round((cacheProgress.current / cacheProgress.total) * 100))
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.cacheProgressSub}>
                    {cacheProgress.current} of {cacheProgress.total} tiles downloaded
                  </Text>
                </View>
              )}
            </View>

            {/* Smart Caching Controls Card */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SMART CACHING MECHANISM</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={[styles.menuRow, { borderBottomColor: colors.divider }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF' }]}>
                  <Ionicons name="sparkles" size={18} color="#818CF8" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Auto-Cache Frequent Spots</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Pre-caches Home, Work & GPS in background</Text>
                </View>
                <Switch
                  value={smartConfig.autoCacheFrequent}
                  onValueChange={(val) => {
                    TileCacheService.updateSmartConfig({ autoCacheFrequent: val });
                  }}
                  trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.menuRow, { borderBottomColor: colors.divider }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.22)' : '#F0FDF4' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Smart Eviction Protection</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>Frequent locations are protected from LRU pruning</Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#EEF2FF', borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#C7D2FE' }]}>
                  <Text style={[styles.badgePillText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>Active</Text>
                </View>
              </View>

              <View style={[styles.menuRow, { borderBottomWidth: 0, paddingBottom: 8 }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#F8FAFC' }]}>
                  <Feather name="pie-chart" size={17} color={isDark ? '#94A3B8' : '#475569'} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={[styles.menuTitle, { color: colors.textMain }]}>Storage Quota Limit</Text>
                  <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                    {smartConfig.maxLimitMB === 0
                      ? 'Unlimited: all offline map tiles kept without eviction'
                      : `Smart ${smartConfig.maxLimitMB} MB dynamic threshold`}
                  </Text>
                </View>
              </View>

              {/* Cache Limit Preset Buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 14 }}>
                {CACHE_LIMIT_PRESETS.map((preset) => {
                  const isSelected = smartConfig.maxLimitMB === preset.value;
                  return (
                    <TouchableOpacity
                      key={preset.value}
                      activeOpacity={0.8}
                      onPress={() => TileCacheService.updateSmartConfig({ maxLimitMB: preset.value })}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : (isDark ? '#334155' : '#E2E8F0'),
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF')
                          : (isDark ? 'rgba(30, 41, 59, 0.6)' : '#F8FAFC'),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? (isDark ? '#A5B4FC' : colors.primary) : colors.textSecondary,
                        }}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Frequent Locations Safeguarded */}
            <View style={styles.locHeaderRow}>
              <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>FREQUENT LOCATIONS SAFEGUARDED</Text>
              <Text style={[styles.locCountBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF', color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                {frequentLocations?.length || 0}
              </Text>
            </View>

            <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              {(!frequentLocations || frequentLocations.length === 0) ? (
                <View style={styles.emptyLocWrap}>
                  <Ionicons name="navigate-outline" size={28} color={colors.textMuted} />
                  <Text style={[styles.emptyLocText, { color: colors.textMuted }]}>No frequent locations detected yet</Text>
                </View>
              ) : (
                frequentLocations.map((loc, idx) => (
                  <View
                    key={loc.id || `${loc.name}-${idx}`}
                    style={[
                      styles.menuRow,
                      { borderBottomColor: colors.divider },
                      idx === frequentLocations.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#F1F5F9' }]}>
                      <Ionicons
                        name={
                          loc.category === 'home'
                            ? 'home'
                            : loc.category === 'work'
                            ? 'briefcase'
                            : loc.category === 'school'
                            ? 'school'
                            : loc.id === 'my-location'
                            ? 'navigate'
                            : 'location'
                        }
                        size={16}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.menuTextWrap}>
                      <Text style={[styles.menuTitle, { color: colors.textMain }]}>{loc.name}</Text>
                      <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} • Zooms 13-16
                      </Text>
                    </View>
                    <View style={[styles.readyBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', borderColor: isDark ? 'rgba(52, 211, 153, 0.4)' : '#A7F3D0' }]}>
                      <Text style={[styles.readyBadgeText, { color: isDark ? '#34D399' : '#059669' }]}>Protected</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Cache Actions */}
            <View style={styles.cacheActionsCol}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, isCaching && styles.disabledBtn]}
                activeOpacity={0.85}
                onPress={onCacheAllFrequent}
                disabled={isCaching}
              >
                {isCaching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="download-cloud" size={17} color="#FFFFFF" />
                )}
                <Text style={styles.primaryActionBtnText}>
                  {isCaching ? 'Downloading Tiles...' : 'Pre-Cache Frequent Locations'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(129, 140, 248, 0.35)' : '#E2E8F0',
                  },
                  webGlassTile,
                ]}
                activeOpacity={0.8}
                onPress={onCacheCurrentView}
                disabled={isCaching}
              >
                <Ionicons name="expand-outline" size={17} color={isDark ? '#A5B4FC' : colors.primary} />
                <Text style={[styles.secondaryActionBtnText, { color: isDark ? '#A5B4FC' : colors.primary }]}>
                  Cache Current Map View
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.clearStorageBtn,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
                  },
                  webGlassTile,
                ]}
                activeOpacity={0.8}
                onPress={handleClearCache}
                disabled={isClearingCache || isCaching}
              >
                <Feather name="trash-2" size={16} color={isDark ? '#FCA5A5' : '#DC2626'} />
                <Text style={[styles.clearStorageBtnText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                  {isClearingCache ? 'Clearing Storage...' : 'Clear All Offline Storage'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Info Note */}
            <View
              style={[
                styles.offlineNoteCard,
                {
                  backgroundColor: isDark ? 'rgba(2, 132, 199, 0.16)' : '#F0F9FF',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD',
                },
                webGlassTile,
              ]}
            >
              <Ionicons name="information-circle-outline" size={18} color={isDark ? '#38BDF8' : '#0284C7'} />
              <Text style={[styles.offlineNoteText, { color: isDark ? '#BAE6FD' : '#0369A1' }]}>
                Raster map tiles are stored on-device in persistent hardware storage. When driving in rural areas or during network outages, your family map remains fully readable.
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 9: THEME SUBVIEW                                                     */}
        {/* ========================================================================= */}
        {currentView === 'theme' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>App Theme</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Choose your preferred appearance: System Default, Light Mode, or Dark Mode.
            </Text>

            <View style={styles.themeListWrap}>
              {ALL_APP_THEMES.map((theme) => {
                const isSelected =
                  theme.id === selectedThemeId ||
                  (theme.id === 'dark' && selectedThemeId === 'dark-glass') ||
                  (theme.id === 'light' && (selectedThemeId === 'light-glass' || selectedThemeId === 'standard'));
                const isDarkTheme = theme.id === 'dark' || (theme.id === 'system' && isDark);
                const preview =
                  theme.id === 'system'
                    ? (isDark
                        ? ALL_APP_THEMES.find((t) => t.id === 'dark')?.preview
                        : ALL_APP_THEMES.find((t) => t.id === 'light')?.preview) || theme.preview
                    : theme.preview;

                return (
                  <TouchableOpacity
                    key={theme.id}
                    activeOpacity={0.85}
                    onPress={() => handleSelectTheme(theme.id)}
                    style={[
                      styles.themeCard,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.tileBorder,
                      },
                      isSelected && styles.themeCardSelected,
                    ]}
                  >
                    <View style={styles.themeCardHeader}>
                      <View style={styles.themeCardIconTitleRow}>
                        <View
                          style={[
                            styles.themeIconCircle,
                            isDarkTheme
                              ? { backgroundColor: '#0F172A' }
                              : { backgroundColor: '#EEF2FF' },
                          ]}
                        >
                          <Ionicons
                            name={theme.icon}
                            size={18}
                            color={isDarkTheme ? '#818CF8' : colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.themeTitleBadgeRow}>
                            <Text
                              style={[
                                styles.themeCardName,
                                { color: colors.textMain },
                                isSelected && { color: colors.primary, fontWeight: '800' },
                              ]}
                            >
                              {theme.name}
                            </Text>
                            <View
                              style={[
                                styles.themeBadgePill,
                                isDarkTheme
                                  ? { backgroundColor: '#312E81' }
                                  : { backgroundColor: '#E0E7FF' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.themeBadgePillText,
                                  isDarkTheme
                                    ? { color: '#A5B4FC' }
                                    : { color: colors.primary },
                                ]}
                              >
                                {theme.id === 'system'
                                  ? isDark ? 'System (Dark)' : 'System (Light)'
                                  : theme.badge}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.themeTagline, { color: colors.textMuted }]}>{theme.tagline}</Text>
                        </View>
                      </View>

                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={isSelected ? colors.primary : '#CBD5E1'}
                      />
                    </View>

                    {/* Preview Box */}
                    <View
                      style={[
                        styles.themePreviewContainer,
                        {
                          backgroundColor: preview.canvasBg,
                          borderColor: isDarkTheme ? '#334155' : '#E2E8F0',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.themePreviewInnerCard,
                          {
                            backgroundColor: preview.cardBg,
                            borderColor: preview.borderColor,
                            borderWidth: preview.borderWidth,
                          },
                        ]}
                      >
                        <View style={styles.themePreviewTopRow}>
                          <View style={[styles.themeMiniPill, { backgroundColor: preview.pillBg }]}>
                            <Text style={[styles.themeMiniPillText, { color: preview.accentColor }]}>
                              {theme.name}
                            </Text>
                          </View>
                          <Ionicons
                            name={theme.icon}
                            size={13}
                            color={preview.accentColor}
                          />
                        </View>
                        <Text style={[styles.themePreviewCardTitle, { color: preview.textColor }]}>
                          Family Dashboard
                        </Text>
                        <Text style={[styles.themePreviewCardDesc, { color: preview.subtextColor }]}>
                          {theme.description}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.themeDescriptionText}>{theme.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 10: ABOUT US SUBVIEW                                                 */}
        {/* ========================================================================= */}
        {currentView === 'about' && (
          <View style={styles.subViewContainer}>
            {/* Brand Hero Card */}
            <View style={[styles.aboutHeroCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.aboutLogoCircle}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.aboutLogoImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={[styles.aboutAppName, { color: colors.textMain }]}>CareRing</Text>
              <Text style={[styles.aboutAppTagline, { color: colors.textSecondary }]}>
                Real-Time Family Safety, Driving Insights & Private Location Sharing
              </Text>
              <View style={styles.aboutBadgeRow}>
                <View style={[styles.aboutVersionPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', borderColor: colors.tileBorder }]}>
                  <Text style={[styles.aboutVersionText, { color: colors.textSecondary }]}>
                    v{Constants.expoConfig?.version || '1.0.0'} (Build {Constants.expoConfig?.android?.versionCode || 1})
                  </Text>
                </View>
                <View style={styles.aboutLiveBadge}>
                  <View style={styles.aboutLiveDot} />
                  <Text style={styles.aboutLiveText}>Cloud Active</Text>
                </View>
              </View>
            </View>

            {/* Developer & Maintainer Card */}
            <View style={[styles.aboutSectionCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.aboutSectionHeader}>
                <Ionicons name="code-slash-outline" size={18} color={colors.primary} />
                <Text style={[styles.aboutSectionTitle, { color: colors.textMain }]}>DEVELOPMENT & CREATOR</Text>
              </View>

              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Lead Architect & Developer</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(DEVELOPER_PROFILE_URL)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Text style={[styles.aboutInfoValue, { color: '#0284C7' }]}>Sunny Sahsi</Text>
                  <Feather name="external-link" size={13} color="#0284C7" />
                </TouchableOpacity>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Organization</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(GITHUB_REPO_URL)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>Individual Project</Text>
                  <Feather name="external-link" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>License</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(LICENSE_URL)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Text style={[styles.aboutInfoValue, { color: '#059669' }]}>MIT License (Open Source)</Text>
                  <Feather name="external-link" size={12} color="#059669" />
                </TouchableOpacity>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Data Privacy</Text>
                <Text style={[styles.aboutInfoValue, { color: '#0284C7' }]}>Zero Telemetry Resale</Text>
              </View>
            </View>

            {/* App & Build Specifications */}
            <View style={[styles.aboutSectionCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.aboutSectionHeader}>
                <Ionicons name="cube-outline" size={18} color={colors.primary} />
                <Text style={[styles.aboutSectionTitle, { color: colors.textMain }]}>APPLICATION SPECIFICATIONS</Text>
              </View>

              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Release Version</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Internal Build Number</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>{Constants.expoConfig?.android?.versionCode || 1}</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Client Framework</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>React Native 0.86 • Expo SDK 57</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Language & Typing</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>TypeScript 5 Strict</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Target Architecture</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>Universal (arm64, v7a, x86_64)</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Binary Distribution</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>Standalone APK & EAS Cloud AAB</Text>
              </View>
            </View>

            {/* Core Infrastructure Details */}
            <View style={[styles.aboutSectionCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <View style={styles.aboutSectionHeader}>
                <Ionicons name="hardware-chip-outline" size={17} color={colors.primary} />
                <Text style={[styles.aboutSectionTitle, { color: colors.textMain }]}>Core Engine & Architecture</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Backend Server</Text>
                <TouchableOpacity
                  onPress={() => setShowServerModal(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text style={[styles.aboutInfoValue, { color: '#0284C7' }]}>
                    {serverConfigService.getCleanHost(backendUrl)}
                  </Text>
                  <Feather name="external-link" size={12} color="#0284C7" />
                </TouchableOpacity>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Spatial Database</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>PostgreSQL 16 + PostGIS 3.4</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Geofence Engine</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>PostGIS ST_DWithin Indexing</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Telemetry Smoothing</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.textMain }]}>60 FPS Coordinate Lerp</Text>
              </View>
              <View style={[styles.aboutInfoRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>Battery Preserver</Text>
                <Text style={[styles.aboutInfoValue, { color: '#059669' }]}>Motion Fusion (&lt;1% drain/hr)</Text>
              </View>
            </View>

            {/* Quick Action Links */}
            <View style={styles.aboutActionGrid}>
              <TouchableOpacity
                style={[styles.aboutActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: colors.tileBorder }]}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(LANDING_PAGE_URL)}
              >
                <Ionicons name="globe-outline" size={18} color="#059669" />
                <Text style={[styles.aboutActionBtnText, { color: colors.textMain }]}>Official Website</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.aboutActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: colors.tileBorder }]}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(GITHUB_RELEASES_URL)}
              >
                <Ionicons name="download-outline" size={18} color="#0D9488" />
                <Text style={[styles.aboutActionBtnText, { color: colors.textMain }]}>Releases & APK</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.aboutActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: colors.tileBorder }]}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(GITHUB_REPO_URL)}
              >
                <Ionicons name="logo-github" size={18} color={colors.textMain} />
                <Text style={[styles.aboutActionBtnText, { color: colors.textMain }]}>GitHub Repo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.aboutActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: colors.tileBorder }]}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(CLOUD_API_HEALTH_URL)}
              >
                <Ionicons name="pulse-outline" size={18} color="#10B981" />
                <Text style={[styles.aboutActionBtnText, { color: colors.textMain }]}>Cloud API Status</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.aboutActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: colors.tileBorder }]}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(GITHUB_ISSUES_URL)}
              >
                <Ionicons name="bug-outline" size={18} color="#F59E0B" />
                <Text style={[styles.aboutActionBtnText, { color: colors.textMain }]}>Report an Issue</Text>
              </TouchableOpacity>
            </View>

            {/* Mission & Vision */}
            <View style={[styles.editorialCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, marginBottom: 14 }, webGlassTile]}>
              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>Our Mission & Vision</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                CareRing is engineered from the ground up to give families complete peace of mind through precise real-time location sharing, responsive driving insights, and emergency safety tools.
              </Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                Built on an open, privacy-centric architecture, CareRing ensures your location data remains private, secure, and under your control at all times with zero data monetization.
              </Text>

              <Text style={[styles.editorialHeader, { color: colors.textMain, marginTop: 14 }]}>Core Architectural Pillars</Text>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: colors.textMain }}>Zero Data Monetization:</Text> Your GPS breadcrumbs and sensor logs are stored securely in your private database.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: colors.textMain }}>High-Precision Telemetry:</Text> Sub-50ms real-time WebSocket communication and adaptive sensor fusion.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: colors.textMain }}>Complete Safety Suite:</Text> Unlimited location history, automatic crash detection, unlimited geofences, and driving scores.
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
              <Text style={[styles.aboutCopyrightText, { color: colors.textMuted, marginTop: 0, marginBottom: 3 }]}>
                CareRing v{Constants.expoConfig?.version || '1.0.0'} (Build {Constants.expoConfig?.android?.versionCode || 1}) • Engineered by{' '}
                <Text
                  style={{ color: '#0284C7', fontWeight: '700' }}
                  onPress={() => Linking.openURL(DEVELOPER_PROFILE_URL)}
                >
                  Sunny Sahsi
                </Text>
              </Text>
              <Text style={[styles.aboutCopyrightText, { color: colors.textMuted, marginTop: 0 }]}>
                Distributed under the MIT License • © 2026 CareRing
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 11: TERMS & CONDITIONS SUBVIEW                                       */}
        {/* ========================================================================= */}
        {currentView === 'terms' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Terms and Conditions</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>Last updated: September 2026</Text>

            <View style={[styles.editorialCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>1. Acceptance of Terms</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                By creating an account or accessing the CareRing mobile application, you agree to these Terms and Conditions. CareRing is intended exclusively for family safety, mutual coordination, and personal device tracking.
              </Text>

              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>2. Location Services & Device Permissions</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                CareRing relies on continuous GPS, accelerometer, and network permissions to provide live positioning, crash detection, and geofence alerts. Accuracy depends on satellite geometry and device battery optimization settings.
              </Text>

              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>3. Emergency SOS Disclaimer</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                CareRing SOS is a personal notification utility designed to notify designated circle members. It does not replace government public emergency response services (e.g. 911 or 112).
              </Text>

              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>4. Mutual Consent & Acceptable Use</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                All members in a Circle must consent to location sharing. You agree not to use CareRing for unauthorized surveillance, harassment, or unlawful tracking.
              </Text>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => Linking.openURL(LANDING_PAGE_URL)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 14,
                  paddingVertical: 10,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                  borderRadius: 10,
                }}
              >
                <Ionicons name="globe-outline" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  Read Complete Terms Online (care-ring.netlify.app)
                </Text>
                <Feather name="external-link" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 12: PRIVACY POLICY SUBVIEW                                           */}
        {/* ========================================================================= */}
        {currentView === 'privacy' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Privacy Policy</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>Transparent, self-hosted, and 100% private.</Text>

            <View style={[styles.editorialCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>1. Zero Commercial Data Brokering</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                CareRing will NEVER sell, rent, monetize, or share your GPS coordinates, travel routes, driving telemetry, or member information with advertisers or data brokers.
              </Text>

              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>2. Information We Store</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                We only store data essential to deliver real-time features:
              </Text>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  GPS Coordinates (latitude, longitude, speed, heading, altitude)
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  Device Telemetry (battery percentage, charging status, sensor g-force)
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                  Account profile (name, optional avatar, optional phone number)
                </Text>
              </View>

              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>3. Privacy Bubbles</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                You maintain complete autonomy over your privacy. Activating a Privacy Bubble cloaks your exact position with a customized radius for your chosen duration.
              </Text>

              <Text style={[styles.editorialHeader, { color: colors.textMain }]}>4. Right to Erasure</Text>
              <Text style={[styles.editorialBody, { color: colors.textSecondary }]}>
                You may purge your telemetry history or delete your entire account at any time from Account Settings. Deletion is instantaneous and permanent.
              </Text>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => Linking.openURL(LANDING_PAGE_URL)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 14,
                  paddingVertical: 10,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                  borderRadius: 10,
                }}
              >
                <Ionicons name="globe-outline" size={14} color="#059669" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>
                  Read Full Privacy Statement Online (care-ring.netlify.app)
                </Text>
                <Feather name="external-link" size={12} color="#059669" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* VIEW 13: FEATURES DIRECTORY CATALOG SUBVIEW                               */}
        {/* ========================================================================= */}
        {currentView === 'features' && (
          <View style={styles.subViewContainer}>
            <Text style={[styles.subViewTitle, { color: colors.textMain }]}>Features Directory</Text>
            <Text style={[styles.subViewDesc, { color: colors.textSecondary }]}>
              Explore all verified safety, driving, circles, and location features available in CareRing.
            </Text>

            {/* Search Input */}
            <View style={[styles.featureSearchWrap, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={featureSearch}
                onChangeText={setFeatureSearch}
                placeholder="Search features..."
                placeholderTextColor={colors.textMuted}
                style={[styles.featureSearchInput, { color: colors.textMain }]}
              />
              {featureSearch ? (
                <TouchableOpacity onPress={() => setFeatureSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsRow}>
              {['All', 'Safety', 'Driving', 'Location', 'Circles & Privacy', 'Communication', 'Pipeline'].map((cat) => {
                const isActive = featureCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    activeOpacity={0.8}
                    onPress={() => setFeatureCategory(cat)}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: isActive ? colors.primary : colors.tileBg,
                        borderColor: isActive ? colors.primary : colors.tileBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: isActive ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Feature Cards List */}
            <View style={{ gap: 12, marginTop: 8 }}>
              {filteredFeatures.map((item) => {
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.featureCard,
                      { backgroundColor: colors.tileBg, borderColor: colors.tileBorder },
                      webGlassTile,
                    ]}
                  >
                    <View style={styles.featureCardHeader}>
                      <View style={[styles.featureIconWrap, { backgroundColor: isDark ? `${item.color}22` : `${item.color}15` }]}>
                        {item.iconFamily === 'Feather' ? (
                          <Feather name={item.icon as any} size={20} color={item.color} />
                        ) : item.iconFamily === 'MaterialIcons' ? (
                          <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                        ) : (
                          <Ionicons name={item.icon as any} size={20} color={item.color} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.featureCardTitle, { color: colors.textMain }]}>{item.title}</Text>
                        <View style={[styles.featureBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                          <Text style={[styles.featureBadgeText, { color: item.color }]}>{item.badge}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={[styles.featureDescText, { color: colors.textSecondary }]}>{item.description}</Text>

                    <View style={styles.featureHighlightRow}>
                      <Ionicons name={item.isPipeline ? 'rocket-outline' : 'checkmark-circle'} size={14} color={item.isPipeline ? item.color : '#10B981'} />
                      <Text style={[styles.featureHighlightText, { color: colors.textMuted }]}>{item.highlight}</Text>
                    </View>

                    {item.isPipeline ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 10, alignSelf: 'flex-start' }}>
                        <Feather name="clock" size={13} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>Target {item.targetQuarter || 'Coming Soon'}</Text>
                      </View>
                    ) : item.actionId ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (item.actionId === 'offline_tiles') {
                            navigateToView('offline_cache');
                          } else if (item.actionId === 'open_privacy') {
                            navigateToView('privacy');
                          } else {
                            onTriggerFeature?.(item.actionId!);
                          }
                        }}
                        style={[styles.featureActionBtn, { backgroundColor: colors.primary }]}
                      >
                        <Text style={styles.featureActionBtnText}>{item.actionLabel || 'Open'}</Text>
                        <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Self-Hosted Server Configuration Modal */}
      <ServerConfigModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        requireReloginNotice={true}
        onServerSaved={handleServerSaved}
      />

      {/* Developer Safety Debug Modal */}
      <SafetyDebugModal
        visible={showSafetyDebugModal}
        onClose={() => setShowSafetyDebugModal(false)}
      />
    </View>
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  subViewHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 18,
  },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  profileHeroName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileHeroEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  memberTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  memberTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editProfilePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 10,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSub: {
    fontSize: 11,
    marginTop: 2,
  },
  badgeStatus: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  badgeStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  versionFooter: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  subViewContainer: {
    paddingVertical: 4,
  },
  subViewTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  subViewDesc: {
    fontSize: 13,
    marginTop: 3,
    marginBottom: 16,
    lineHeight: 18,
  },
  avatarEditWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  avatarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  avatarActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  avatarRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  avatarRemoveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 8,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoKey: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '65%',
  },
  statusPill: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dangerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  dangerDesc: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 15,
  },
  dangerBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeCircleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  circleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  circleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircleName: {
    fontSize: 16,
    fontWeight: '800',
  },
  activeCircleCode: {
    fontSize: 11,
    marginTop: 2,
  },
  renameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveRenameBtn: {
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRenameBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  actionGridBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionGridBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaveCircleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  leaveCircleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  editorialCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  editorialHeader: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 6,
  },
  editorialBody: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    color: Colors.primary,
  },
  bulletText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  notifCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  notifTextWrap: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notifSub: {
    fontSize: 12,
    marginTop: 2,
  },
  thresholdContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  thresholdLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  thresholdPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  thresholdPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thresholdPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  thresholdPillTextActive: {
    color: '#FFFFFF',
  },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  testNotifBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cacheHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  cacheHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cacheHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cacheHeroSize: {
    fontSize: 28,
    fontWeight: '800',
  },
  cacheStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cacheGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  cacheStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  cacheStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cacheStatCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cacheStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 10,
  },
  cacheStatValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  cacheProgressWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cacheProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cacheProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    flex: 1,
    marginRight: 8,
  },
  cacheProgressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818CF8',
  },
  cacheBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  cacheBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  cacheProgressSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  locHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 6,
  },
  emptyLocWrap: {
    padding: 22,
    alignItems: 'center',
  },
  emptyLocText: {
    fontSize: 13,
    marginTop: 6,
  },
  readyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cacheActionsCol: {
    gap: 10,
    marginTop: 6,
    marginBottom: 16,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearStorageBtn: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  clearStorageBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  offlineNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  offlineNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  themePreviewChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  themePreviewChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  themeListWrap: {
    gap: 14,
    marginBottom: 24,
  },
  themeCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
  },
  themeCardSelected: {
    borderColor: Colors.primary,
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  themeCardIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  themeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  themeCardName: {
    fontSize: 15,
    fontWeight: '700',
  },
  themeBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  themeBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  themeTagline: {
    fontSize: 12,
    marginTop: 2,
  },
  themePreviewContainer: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  themePreviewInnerCard: {
    borderRadius: 12,
    padding: 12,
  },
  themePreviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  themeMiniPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  themeMiniPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  themePreviewCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  themePreviewCardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  themeDescriptionText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  aboutHeroCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  aboutLogoCircle: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  aboutLogoImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  aboutAppName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  aboutAppTagline: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  aboutBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutVersionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  aboutVersionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  aboutLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  aboutLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  aboutLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  aboutSectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  aboutSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aboutSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  aboutInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  aboutInfoLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  aboutInfoValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  aboutActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
    marginBottom: 14,
  },
  aboutActionBtn: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  aboutActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  aboutCopyrightText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  distancePreviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  distancePreviewHeader: {
    marginBottom: 12,
  },
  distancePreviewAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distancePreviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distancePreviewName: {
    fontSize: 14,
    fontWeight: '700',
  },
  distancePreviewSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  distancePreviewPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  distancePreviewPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  distancePreviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  distancePreviewFooterText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  unitSelectorCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 14,
  },
  unitOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
  },
  unitOptionBtnActive: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  unitOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  unitOptionSub: {
    fontSize: 10,
    marginTop: 1,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  mapCardsList: {
    gap: 14,
  },
  mapStyleCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  mapStyleCardSelected: {
    borderColor: Colors.primary,
  },
  mapThumbWrap: {
    height: 120,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  mapThumbImage: {
    width: '100%',
    height: '100%',
  },
  mapThumbBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mapThumbBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  mapCardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  mapCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  mapCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  featureSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  featureSearchInput: {
    flex: 1,
    fontSize: 13,
  },
  categoryPillsRow: {
    gap: 8,
    paddingBottom: 10,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  featureCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  featureCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  featureBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  featureBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  featureDescText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  featureHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  featureHighlightText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  featureActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  featureActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
