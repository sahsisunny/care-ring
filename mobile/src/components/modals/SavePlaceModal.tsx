import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { hapticService } from '../../services/HapticService';
import { InlineButtonLoader } from '../common/Loader';
import { locationSearchService, LocationSearchResult } from '../../services/LocationSearchService';
import { MapView, MapViewRef, MapViewportInfo } from '../MapView';
import { MapStyleConfig } from '../../models/MapStyle';
import { formatGeofenceRadius } from '../../utils/distance';
import { distancePreferencesService } from '../../services/DistancePreferencesService';

export interface SavePlaceModalProps {
  visible: boolean;
  onClose: () => void;
  initialAddress?: string;
  latitude?: number;
  longitude?: number;
  myPosition?: { latitude: number; longitude: number; heading?: number } | null;
  currentUserId?: string;
  mapStyle?: MapStyleConfig;
  editingPlace?: any | null;
  onSavePlace: (place: {
    name: string;
    category: 'home' | 'work' | 'school' | 'gym' | 'other' | string;
    radiusMeters: number;
    notifyOnEnter: boolean;
    notifyOnExit: boolean;
    latitude: number;
    longitude: number;
    address?: string;
  }) => void | Promise<void>;
}

// Preset geofence distances in meters
const GEOFENCE_PRESETS = [100, 200, 500, 1000, 2000, 5000];

// Curated Category list with vibrant emojis and modern icons
const CATEGORIES = [
  { key: 'home', label: 'Home', icon: 'home-outline', emoji: '🏠', color: '#10B981' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline', emoji: '🏢', color: '#3B82F6' },
  { key: 'school', label: 'School', icon: 'school-outline', emoji: '🏫', color: '#F59E0B' },
  { key: 'gym', label: 'Gym', icon: 'fitness-outline', emoji: '🏋️', color: '#EC4899' },
  { key: 'cafe', label: 'Cafe', icon: 'cafe-outline', emoji: '☕', color: '#8B5CF6' },
  { key: 'family', label: 'Family', icon: 'people-outline', emoji: '👨‍👩‍👧', color: '#06B6D4' },
  { key: 'other', label: 'Other', icon: 'location-outline', emoji: '📍', color: '#6B7280' },
];

// Interactive Smooth Geofence Radius Slider
interface GeofenceRadiusSliderProps {
  value: number;
  onChange: (radius: number) => void;
  formatDistance: (meters: number) => string;
}

const GeofenceRadiusSlider: React.FC<GeofenceRadiusSliderProps> = React.memo(({
  value,
  onChange,
  formatDistance,
}) => {
  const { colors, isDark } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<any>(null);
  const lastHapticRef = useRef<number>(0);

  // Non-linear mapping for natural feel across 50m to 5,000m
  const valueToProgress = useCallback((val: number): number => {
    const clamped = Math.max(50, Math.min(5000, val));
    if (clamped <= 200) {
      return ((clamped - 50) / 150) * 0.25;
    } else if (clamped <= 500) {
      return 0.25 + ((clamped - 200) / 300) * 0.25;
    } else if (clamped <= 1500) {
      return 0.50 + ((clamped - 500) / 1000) * 0.25;
    } else {
      return 0.75 + ((clamped - 1500) / 3500) * 0.25;
    }
  }, []);

  const progressToValue = useCallback((prog: number): number => {
    const p = Math.max(0, Math.min(1, prog));
    let raw: number;
    if (p <= 0.25) {
      raw = 50 + (p / 0.25) * 150;
      return Math.round(raw / 10) * 10;
    } else if (p <= 0.50) {
      raw = 200 + ((p - 0.25) / 0.25) * 300;
      return Math.round(raw / 25) * 25;
    } else if (p <= 0.75) {
      raw = 500 + ((p - 0.50) / 0.25) * 1000;
      return Math.round(raw / 50) * 50;
    } else {
      raw = 1500 + ((p - 0.75) / 0.25) * 3500;
      return Math.round(raw / 100) * 100;
    }
  }, []);

  const currentProgress = valueToProgress(value);

  const triggerHapticIfChanged = (newVal: number) => {
    if (Math.abs(newVal - lastHapticRef.current) >= 50) {
      lastHapticRef.current = newVal;
      hapticService.selection();
    }
  };

  const handleUpdateFromTouch = (locationX: number) => {
    if (trackWidth <= 0) return;
    const prog = Math.max(0, Math.min(1, locationX / trackWidth));
    const newVal = progressToValue(prog);
    triggerHapticIfChanged(newVal);
    onChange(newVal);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          handleUpdateFromTouch(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          handleUpdateFromTouch(evt.nativeEvent.locationX);
        },
      }),
    [trackWidth, progressToValue]
  );

  return (
    <View style={sliderStyles.container}>
      {/* Slider Header */}
      <View style={sliderStyles.headerRow}>
        <View style={sliderStyles.headerLeft}>
          <Ionicons name="radio" size={16} color="#7C3AED" />
          <Text style={[sliderStyles.title, { color: colors.textMain }]}>Geofence Radius</Text>
        </View>
        <View
          style={[
            sliderStyles.badge,
            {
              backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : '#EDE9FE',
              borderColor: isDark ? 'rgba(124, 58, 237, 0.4)' : '#DDD6FE',
            },
          ]}
        >
          <Text style={sliderStyles.badgeText}>{formatDistance(value)}</Text>
        </View>
      </View>

      {/* Preset Pill Bar */}
      <View style={sliderStyles.presetsRow}>
        {GEOFENCE_PRESETS.map((presetVal) => {
          const isSelected = Math.abs(value - presetVal) < 25;
          const label = presetVal >= 1000 ? `${presetVal / 1000} km` : `${presetVal} m`;
          return (
            <TouchableOpacity
              key={presetVal}
              activeOpacity={0.7}
              onPress={() => {
                hapticService.selection();
                onChange(presetVal);
              }}
              style={[
                sliderStyles.presetPill,
                {
                  backgroundColor: isSelected
                    ? colors.primary
                    : isDark
                    ? 'rgba(51, 65, 85, 0.45)'
                    : '#F1F5F9',
                  borderColor: isSelected
                    ? colors.primary
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#E2E8F0',
                },
              ]}
            >
              <Text
                style={[
                  sliderStyles.presetPillText,
                  { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Interactive Slider Track */}
      <View
        ref={trackRef}
        style={sliderStyles.trackTouchArea}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            sliderStyles.trackBackground,
            { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
          ]}
        >
          <View
            style={[
              sliderStyles.trackFill,
              {
                width: `${Math.round(currentProgress * 100)}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        {/* Draggable Thumb */}
        <View
          style={[
            sliderStyles.thumb,
            {
              left:
                trackWidth > 0
                  ? Math.max(0, Math.min(trackWidth - 26, currentProgress * trackWidth - 13))
                  : 0,
              backgroundColor: '#FFFFFF',
              borderColor: colors.primary,
            },
          ]}
        >
          <View style={[sliderStyles.thumbInnerDot, { backgroundColor: colors.primary }]} />
        </View>
      </View>

      <Text style={[sliderStyles.helperNote, { color: colors.textMuted }]}>
        Alerts will fire when circle members cross this boundary.
      </Text>
    </View>
  );
});

export const SavePlaceModal: React.FC<SavePlaceModalProps> = React.memo(({
  visible,
  onClose,
  initialAddress = '',
  latitude = 12.9095,
  longitude = 77.6753,
  myPosition = null,
  currentUserId = '',
  mapStyle,
  editingPlace = null,
  onSavePlace,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const isEditing = Boolean(editingPlace);

  // Form state
  const [name, setName] = useState('');
  const [currentAddress, setCurrentAddress] = useState(initialAddress);
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);

  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [category, setCategory] = useState<string>('home');
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(true);

  // Place search autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchTimeoutRef = useRef<any>(null);
  const searchRequestIdRef = useRef<number>(0);
  const reverseGeocodeTimerRef = useRef<any>(null);
  const wasVisibleRef = useRef<boolean>(false);
  const scrollRef = useRef<any>(null);
  const modalMapRef = useRef<MapViewRef>(null);

  const activeCategory = useMemo(() => {
    return CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];
  }, [category]);


  // Sync state when drawer opens or editingPlace changes
  useEffect(() => {
    if (visible && (!wasVisibleRef.current || editingPlace)) {
      wasVisibleRef.current = true;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setSearchResults([]);
      setShowSuggestions(false);
      setIsSearching(false);
      setIsLocating(false);

      if (editingPlace) {
        setName(editingPlace.name || '');
        setSearchQuery(editingPlace.name || '');
        const editCat = editingPlace.category || 'home';
        setCategory(editCat);
        const rad =
          editingPlace.radiusMeters ||
          editingPlace.radius_meters ||
          editingPlace.radius ||
          200;
        setRadiusMeters(rad);
        setNotifyOnEnter(editingPlace.notifyOnEnter !== false);
        setNotifyOnExit(editingPlace.notifyOnExit !== false);
        const editLat = Number(editingPlace.latitude) || latitude;
        const editLng = Number(editingPlace.longitude) || longitude;
        setCurrentLat(editLat);
        setCurrentLng(editLng);
        setCurrentAddress(editingPlace.address || '');

        const timer = setTimeout(() => {
          modalMapRef.current?.fitBubble(editLat, editLng, rad);
        }, 350);
        return () => clearTimeout(timer);
      } else {
        setName('');
        setSearchQuery('');
        setCategory('home');
        setRadiusMeters(200);
        setNotifyOnEnter(true);
        setNotifyOnExit(true);

        const targetLat = latitude ?? myPosition?.latitude ?? 12.9095;
        const targetLng = longitude ?? myPosition?.longitude ?? 77.6753;
        setCurrentAddress(initialAddress);
        setCurrentLat(targetLat);
        setCurrentLng(targetLng);

        const timer = setTimeout(() => {
          modalMapRef.current?.fitBubble(targetLat, targetLng, 200);
        }, 350);
        return () => clearTimeout(timer);
      }
    } else if (!visible) {
      wasVisibleRef.current = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
    }
  }, [visible, editingPlace, latitude, longitude, myPosition, initialAddress]);

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!name || name === searchQuery) {
      setName(text);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setIsSearching(false);
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    setShowSuggestions(true);
    const reqId = ++searchRequestIdRef.current;

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await locationSearchService.searchPlaces(trimmed, currentLat, currentLng);
        if (reqId === searchRequestIdRef.current) {
          setSearchResults(results);
        }
      } catch {
        if (reqId === searchRequestIdRef.current) {
          setSearchResults([]);
        }
      } finally {
        if (reqId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 280);
  };

  // Suggestion selected
  const handleSelectSuggestion = (item: LocationSearchResult) => {
    hapticService.light();
    setName(item.name);
    setSearchQuery(item.name);
    setCurrentAddress(item.address || item.name);
    setCurrentLat(item.latitude);
    setCurrentLng(item.longitude);
    setShowSuggestions(false);

    modalMapRef.current?.fitBubble(item.latitude, item.longitude, radiusMeters);

    // Auto-detect category
    if (item.category) {
      setCategory(item.category);
    } else {
      const lower = item.name.toLowerCase();
      if (lower.includes('office') || lower.includes('work') || lower.includes('tech park')) {
        setCategory('work');
      } else if (lower.includes('college') || lower.includes('school') || lower.includes('univ')) {
        setCategory('school');
      } else if (lower.includes('gym') || lower.includes('fitness')) {
        setCategory('gym');
      } else if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('starbucks')) {
        setCategory('cafe');
      } else if (lower.includes('home') || lower.includes('house') || lower.includes('apt')) {
        setCategory('home');
      }
    }
  };

  // Use current GPS location
  const handleUseCurrentLocation = async () => {
    hapticService.medium();
    setIsLocating(true);
    try {
      let lat = myPosition?.latitude;
      let lng = myPosition?.longitude;

      if (lat == null || lng == null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      }

      if (lat != null && lng != null) {
        setCurrentLat(lat);
        setCurrentLng(lng);
        setShowSuggestions(false);
        setSearchQuery('');

        modalMapRef.current?.fitBubble(lat, lng, radiusMeters);

        try {
          const nearby = await locationSearchService.getNearbyPlaces(lat, lng);
          if (nearby && nearby.length > 0) {
            const first = nearby[0];
            setCurrentAddress(first.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            if (!name || name === 'Current Location') {
              setName(first.name !== 'Current Location' ? first.name : 'Current Location');
            }
          } else {
            setCurrentAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            if (!name) setName('Current Location');
          }
        } catch {
          setCurrentAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          if (!name) setName('Current Location');
        }
      } else {
        Alert.alert(
          'GPS Unavailable',
          'Could not detect your current location. Please verify device GPS permissions.'
        );
      }
    } catch {
      Alert.alert('Location Error', 'Unable to fetch current location.');
    } finally {
      setIsLocating(false);
    }
  };

  // Live radius update
  const updateRadius = (newRadius: number) => {
    const clamped = Math.max(50, Math.min(10000, newRadius));
    setRadiusMeters(clamped);
    modalMapRef.current?.showBubble(currentLat, currentLng, clamped, false);
  };

  // Recenter map button
  const handleRecenter = () => {
    hapticService.light();
    modalMapRef.current?.fitBubble(currentLat, currentLng, radiusMeters);
  };

  // Tapping directly on the map
  const handleMapPress = (coords?: { latitude: number; longitude: number }) => {
    if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
      hapticService.light();
      setCurrentLat(coords.latitude);
      setCurrentLng(coords.longitude);
      modalMapRef.current?.showBubble(coords.latitude, coords.longitude, radiusMeters, false);

      locationSearchService
        .getNearbyPlaces(coords.latitude, coords.longitude)
        .then((nearby) => {
          if (nearby && nearby.length > 0) {
            setCurrentAddress(
              nearby[0].address || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
            );
            if (!name) setName(nearby[0].name);
          } else {
            setCurrentAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
          }
        })
        .catch(() => {
          setCurrentAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        });
    }
  };

  // Panning map in preview
  const handleViewportChange = (viewport: MapViewportInfo) => {
    const cLat = viewport?.center?.lat;
    const cLng = viewport?.center?.lng;
    if (typeof cLat === 'number' && typeof cLng === 'number') {
      setCurrentLat(cLat);
      setCurrentLng(cLng);

      if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = setTimeout(async () => {
        try {
          const nearby = await locationSearchService.getNearbyPlaces(cLat, cLng);
          if (nearby && nearby.length > 0) {
            setCurrentAddress(nearby[0].address || `${cLat.toFixed(4)}, ${cLng.toFixed(4)}`);
            if (!name) setName(nearby[0].name);
          }
        } catch {}
      }, 450);
    }
  };

  const formatDistance = (meters: number) => {
    return formatGeofenceRadius(meters, distancePreferencesService.getPreferencesSync().unit);
  };

  // Save / Update place
  const handleSave = async () => {
    const finalName = (name || searchQuery || activeCategory.label).trim();
    if (!finalName) {
      Alert.alert(
        'Place Name Required',
        'Please enter or search for a place name (e.g. Home, Office, School).'
      );
      return;
    }

    hapticService.medium();
    setIsSaving(true);
    try {
      await onSavePlace({
        name: finalName,
        category,
        radiusMeters,
        notifyOnEnter,
        notifyOnExit,
        latitude: currentLat,
        longitude: currentLng,
        address: currentAddress || undefined,
      });
      hapticService.success();
      onClose();
      setName('');
    } catch {
      hapticService.light();
      Alert.alert(
        'Error',
        isEditing
          ? 'Failed to update place. Please try again.'
          : 'Failed to save place. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.modalCardBg || colors.card,
              borderColor: colors.cardBorder,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Native Drawer Drag Handle */}
          <View style={styles.dragHandleWrap}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1' },
              ]}
            />
          </View>

          {/* Drawer Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconCircle,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : '#EDE9FE',
                  },
                ]}
              >
                <Ionicons name="location-sharp" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textMain }]}>
                  {isEditing ? 'Edit Saved Place' : 'Add Saved Place'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {isEditing
                    ? 'Update location, emoji & geofence settings'
                    : 'Set geofence alerts for your circle members'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                hapticService.light();
                onClose();
              }}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form Body */}
          <ScrollView
            ref={scrollRef}
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Search Input Bar */}
            <View style={styles.searchSection}>
              <View
                style={[
                  styles.searchBar,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: isDark ? 'rgba(124, 58, 237, 0.4)' : '#DDD6FE',
                  },
                ]}
              >
                <Ionicons name="search" size={18} color="#7C3AED" style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textMain }]}
                  placeholder="Search place, landmark, or address..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery || name}
                  onChangeText={(text) => {
                    setName(text);
                    handleSearchChange(text);
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {isSearching && <ActivityIndicator size="small" color="#7C3AED" />}
                {(searchQuery.length > 0 || name.length > 0) && !isSearching && (
                  <TouchableOpacity
                    onPress={() => {
                      hapticService.light();
                      setName('');
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowSuggestions(false);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Quick GPS Action Pill */}
              <View style={styles.quickActionsRow}>
                <TouchableOpacity
                  onPress={handleUseCurrentLocation}
                  disabled={isLocating}
                  style={[
                    styles.currentLocationChip,
                    {
                      backgroundColor: isDark ? 'rgba(124, 58, 237, 0.16)' : '#EDE9FE',
                      borderColor: isDark ? 'rgba(124, 58, 237, 0.4)' : '#C4B5FD',
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color="#7C3AED" style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="navigate" size={13} color="#7C3AED" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.currentLocationText}>
                    {isLocating ? 'Locating...' : 'Use My Current Location'}
                  </Text>
                </TouchableOpacity>

                {currentAddress ? (
                  <View style={styles.addressPill}>
                    <Ionicons
                      name="pin-outline"
                      size={12}
                      color={colors.textMuted}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[styles.addressPillText, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {currentAddress}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Suggestions Popover List */}
            {showSuggestions && searchResults.length > 0 && (
              <View
                style={[
                  styles.suggestionsCard,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  },
                ]}
              >
                <View style={[styles.suggestionsHeader, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.suggestionsCountText, { color: colors.textMuted }]}>
                    {searchResults.length} places found
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowSuggestions(false)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                      Dismiss
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  style={styles.suggestionsScroll}
                  bounces={false}
                >
                  {searchResults.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id || idx}
                      activeOpacity={0.7}
                      onPress={() => handleSelectSuggestion(item)}
                      style={[
                        styles.suggestionItem,
                        { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9' },
                      ]}
                    >
                      <View
                        style={[
                          styles.suggestionIconWrap,
                          { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : '#EDE9FE' },
                        ]}
                      >
                        <Ionicons name="location-sharp" size={15} color="#7C3AED" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text
                          style={[styles.suggestionTitle, { color: colors.textMain }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {item.address ? (
                          <Text
                            style={[styles.suggestionSub, { color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {item.address}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Embedded Live Map Preview */}
            <View style={styles.mapContainer}>
              <View style={[styles.mapCard, { borderColor: colors.cardBorder }]}>
                <MapView
                  ref={modalMapRef}
                  currentUserId=""
                  members={[]}
                  hideMembers={true}
                  myPosition={{ latitude: currentLat, longitude: currentLng, heading: 0 }}
                  mapStyle={mapStyle}
                  onMapPress={handleMapPress}
                  onViewportChange={handleViewportChange}
                />

                {/* Floating Pinpoint Indicator */}
                <View pointerEvents="none" style={styles.mapCenterPinOverlay}>
                  <View style={styles.centerPinBubble}>
                    <Text style={styles.centerPinEmoji}>{activeCategory.emoji}</Text>
                    <Text style={styles.centerPinText} numberOfLines={1}>
                      {name || activeCategory.label}
                    </Text>
                  </View>
                  <View style={styles.centerPinPointer} />
                  <View style={styles.centerPinDot} />
                </View>

                {/* Floating Geofence Range Badge */}
                <View
                  style={[
                    styles.mapFloatingBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(15, 23, 42, 0.88)'
                        : 'rgba(255, 255, 255, 0.94)',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.purpleDotPulse} />
                  <Text style={[styles.mapFloatingBadgeText, { color: colors.textMain }]}>
                    Zone: <Text style={{ fontWeight: '800', color: colors.primary }}>{formatDistance(radiusMeters)}</Text>
                  </Text>
                </View>

                {/* Recenter Button */}
                <TouchableOpacity
                  style={[
                    styles.mapRecenterBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(30, 41, 59, 0.92)'
                        : 'rgba(255, 255, 255, 0.96)',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={handleRecenter}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="crosshair" size={16} color={colors.primary} />
                </TouchableOpacity>

                {/* Bottom hint pill */}
                <View
                  style={[
                    styles.mapHintPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(15, 23, 42, 0.78)'
                        : 'rgba(255, 255, 255, 0.88)',
                    },
                  ]}
                >
                  <Text style={[styles.mapHintText, { color: colors.textMuted }]}>
                    Pan or tap map to position pin
                  </Text>
                </View>
              </View>
            </View>

            {/* Category Selector */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Place Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {CATEGORIES.map((c) => {
                  const isSelected = category === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      activeOpacity={0.75}
                      onPress={() => {
                        hapticService.selection();
                        setCategory(c.key);
                        if (!name || CATEGORIES.some((cat) => cat.label === name)) {
                          setName(c.label);
                          setSearchQuery(c.label);
                        }
                      }}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(124, 58, 237, 0.22)'
                              : '#EEF2FF'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : '#F8FAFC',
                          borderColor: isSelected
                            ? colors.primary
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#E2E8F0',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color: isSelected ? colors.primary : colors.textSecondary,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Place Name Card */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Place Name</Text>
              <View
                style={[
                  styles.nameInputBox,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                  },
                ]}
              >
                <Ionicons
                  name={activeCategory.icon as any}
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={[styles.nameInput, { color: colors.textMain }]}
                  placeholder="e.g. Home, Office, Downtown Gym..."
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Geofence Slider Component */}
            <GeofenceRadiusSlider
              value={radiusMeters}
              onChange={updateRadius}
              formatDistance={formatDistance}
            />

            {/* Arrival & Departure Notification Card */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Circle Notifications</Text>
              <View
                style={[
                  styles.toggleCard,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.65)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
                ]}
              >
                {/* Arrival Row */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleIconWrap}>
                    <Ionicons name="log-in-outline" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.toggleTitle, { color: colors.textMain }]}>
                      Notify on Arrival
                    </Text>
                    <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                      Alert members when anyone enters this place
                    </Text>
                  </View>
                  <Switch
                    value={notifyOnEnter}
                    onValueChange={(val) => {
                      hapticService.light();
                      setNotifyOnEnter(val);
                    }}
                    trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                <View
                  style={[
                    styles.toggleDivider,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0' },
                  ]}
                />

                {/* Departure Row */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleIconWrap}>
                    <Ionicons name="log-out-outline" size={18} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.toggleTitle, { color: colors.textMain }]}>
                      Notify on Departure
                    </Text>
                    <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                      Alert members when anyone leaves this place
                    </Text>
                  </View>
                  <Switch
                    value={notifyOnExit}
                    onValueChange={(val) => {
                      hapticService.light();
                      setNotifyOnExit(val);
                    }}
                    trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>
              </View>
            </View>

            {/* Save / Update Place CTA Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleSave}
              disabled={isSaving}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: isSaving ? 0.8 : 1,
                },
              ]}
            >
              {isSaving ? (
                <InlineButtonLoader
                  size={18}
                  label={isEditing ? 'Updating Place...' : 'Saving Place...'}
                />
              ) : (
                <View style={styles.saveBtnContent}>
                  <Ionicons
                    name={isEditing ? 'checkmark-circle-outline' : 'add-circle-outline'}
                    size={20}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.saveBtnText}>
                    {isEditing ? 'Update Place & Geofence' : 'Save Place to Circle'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    maxHeight: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  /* Search & Quick Actions */
  searchSection: {
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    padding: 0,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  currentLocationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  currentLocationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '55%',
  },
  addressPillText: {
    fontSize: 11.5,
    fontWeight: '500',
  },

  /* Suggestions Popover */
  suggestionsCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  suggestionsCountText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  suggestionsScroll: {
    maxHeight: 180,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  suggestionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  suggestionSub: {
    fontSize: 11.5,
    marginTop: 1,
  },

  /* Map Container */
  mapContainer: {
    marginBottom: 14,
  },
  mapCard: {
    height: 195,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  mapCenterPinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  centerPinBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
    maxWidth: 150,
  },
  centerPinEmoji: {
    fontSize: 15,
  },
  centerPinText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  centerPinPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#7C3AED',
    marginTop: -1,
  },
  centerPinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
    marginTop: 1,
  },
  mapFloatingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    zIndex: 10,
  },
  purpleDotPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#8B5CF6',
  },
  mapFloatingBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  mapRecenterBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 10,
  },
  mapHintPill: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 10,
    zIndex: 10,
  },
  mapHintText: {
    fontSize: 10.5,
    fontWeight: '600',
  },

  /* Sections */
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  /* Category pills */
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12.5,
  },

  /* Place Name */
  nameInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    padding: 0,
  },

  /* Notification toggles card */
  toggleCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  toggleDesc: {
    fontSize: 11.5,
    marginTop: 1,
  },
  toggleDivider: {
    height: 1,
    marginHorizontal: 4,
  },

  /* Save CTA Button */
  saveBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  presetPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 46,
    alignItems: 'center',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trackTouchArea: {
    height: 34,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbInnerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  helperNote: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
