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
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { InlineButtonLoader } from '../common/Loader';
import { locationSearchService, LocationSearchResult } from '../../services/LocationSearchService';
import { MapView, MapViewRef, MapViewportInfo } from '../MapView';
import { MemberData } from '../../models/Member';
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
  const trackRef = useRef<View>(null);
  const lastHapticRef = useRef<number>(0);

  // Conversion: piecewise mapping for natural feel across 50m to 5,000m
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
      try {
        Haptics.selectionAsync();
      } catch {}
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

  const presets = [100, 200, 500, 1000, 2000, 5000];

  return (
    <View style={sliderStyles.container}>
      {/* Slider Header */}
      <View style={sliderStyles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="radio" size={16} color="#7C3AED" />
          <Text style={[sliderStyles.title, { color: colors.textMain }]}>Geofence Radius</Text>
        </View>
        <View
          style={[
            sliderStyles.badge,
            {
              backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EDE9FE',
              borderColor: '#7C3AED',
            },
          ]}
        >
          <Text style={sliderStyles.badgeText}>{formatDistance(value)}</Text>
        </View>
      </View>

      {/* Interactive Slider Track */}
      <View
        ref={trackRef}
        style={sliderStyles.trackTouchArea}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={[sliderStyles.trackBackground, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
          <View
            style={[
              sliderStyles.trackFill,
              { width: `${Math.round(currentProgress * 100)}%` },
            ]}
          />
        </View>

        {/* Draggable Thumb */}
        <View
          style={[
            sliderStyles.thumb,
            {
              left: trackWidth > 0 ? Math.max(0, Math.min(trackWidth - 28, currentProgress * trackWidth - 14)) : 0,
              backgroundColor: '#FFFFFF',
              borderColor: '#7C3AED',
            },
          ]}
        >
          <View style={sliderStyles.thumbInnerDot} />
        </View>
      </View>

      {/* Quick Preset Badges */}
      <View style={sliderStyles.presetsRow}>
        {presets.map((presetVal) => {
          const isSelected = Math.abs(value - presetVal) < 25;
          return (
            <TouchableOpacity
              key={presetVal}
              activeOpacity={0.7}
              onPress={() => {
                try {
                  Haptics.selectionAsync();
                } catch {}
                onChange(presetVal);
              }}
              style={[
                sliderStyles.presetPill,
                {
                  backgroundColor: isSelected
                    ? '#7C3AED'
                    : isDark ? 'rgba(51, 65, 85, 0.5)' : '#F1F5F9',
                  borderColor: isSelected ? '#7C3AED' : (isDark ? '#475569' : '#E2E8F0'),
                },
              ]}
            >
              <Text
                style={[
                  sliderStyles.presetPillText,
                  { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {presetVal >= 1000 ? `${presetVal / 1000}km` : `${presetVal}m`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const sliderStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7C3AED',
  },
  trackTouchArea: {
    height: 38,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  thumbInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  presetPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
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

  const isEditing = Boolean(editingPlace);

  const [name, setName] = useState('');
  const [currentAddress, setCurrentAddress] = useState(initialAddress);
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);

  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [category, setCategory] = useState<'home' | 'work' | 'school' | 'gym' | 'other'>('home');
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
  const scrollRef = useRef<ScrollView>(null);
  const modalMapRef = useRef<MapViewRef>(null);

  // Categories list with curated emojis
  const categories = useMemo(() => [
    { key: 'home', label: 'Home', icon: 'home-outline', emoji: '🏠' },
    { key: 'work', label: 'Office', icon: 'briefcase-outline', emoji: '🏢' },
    { key: 'school', label: 'School / College', icon: 'school-outline', emoji: '🏫' },
    { key: 'gym', label: 'Gym', icon: 'fitness-outline', emoji: '🏋️' },
    { key: 'other', label: 'Other', icon: 'location-outline', emoji: '📍' },
  ], []);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.key === category) || categories[categories.length - 1];
  }, [categories, category]);

  // Target member object to display pin marker on the map preview with emoji!
  const placeMemberForMap = useMemo(() => {
    return {
      id: 'place-marker-preview',
      fullName: (name || searchQuery || 'New Place').trim(),
      avatarUrl: null,
      latitude: currentLat,
      longitude: currentLng,
      speed: 0,
      heading: 0,
      batteryLevel: 100,
      isCharging: false,
      isStationary: true,
      isMoving: false,
      isOnline: true,
      role: 'member',
      inBubble: true,
      bubbleRadius: radiusMeters,
      // Custom flags so MapView renders the exact selected emoji instead of an avatar
      isPlacePreview: true,
      emoji: activeCategory.emoji,
      category: category,
    } as any;
  }, [name, searchQuery, currentLat, currentLng, radiusMeters, activeCategory.emoji, category]);

  // Synchronize state when modal opens or editingPlace changes
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
        const rad = editingPlace.radiusMeters || editingPlace.radius_meters || editingPlace.radius || 200;
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
        }, 380);
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
        }, 380);
        return () => clearTimeout(timer);
      }
    } else if (!visible) {
      wasVisibleRef.current = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
    }
  }, [visible, editingPlace, latitude, longitude, myPosition, initialAddress]);

  // Debounced Place Search autocomplete
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!name || name === searchQuery) setName(text);

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

  // Suggestion item tapped from the scrollable list
  const handleSelectSuggestion = (item: LocationSearchResult) => {
    setName(item.name);
    setSearchQuery(item.name);
    setCurrentAddress(item.address || item.name);
    setCurrentLat(item.latitude);
    setCurrentLng(item.longitude);
    setShowSuggestions(false);

    // Reposition map and draw bubble circle
    modalMapRef.current?.fitBubble(item.latitude, item.longitude, radiusMeters);

    // Auto-detect category
    if (item.category) {
      setCategory(item.category as any);
    } else {
      const lower = item.name.toLowerCase();
      if (lower.includes('office') || lower.includes('work') || lower.includes('tech park')) {
        setCategory('work');
      } else if (lower.includes('college') || lower.includes('school') || lower.includes('univ')) {
        setCategory('school');
      } else if (lower.includes('gym') || lower.includes('fitness')) {
        setCategory('gym');
      } else if (lower.includes('home') || lower.includes('house')) {
        setCategory('home');
      }
    }
  };

  // "Use Current Location" (GPS) action handler
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      let lat = myPosition?.latitude;
      let lng = myPosition?.longitude;

      if (lat == null || lng == null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
        Alert.alert('GPS Unavailable', 'Could not detect your current location. Please verify device GPS permissions.');
      }
    } catch {
      Alert.alert('Location Error', 'Unable to fetch current location.');
    } finally {
      setIsLocating(false);
    }
  };

  // Live radius update - updates map circle live without resetting viewport
  const updateRadius = (newRadius: number) => {
    const clamped = Math.max(50, Math.min(10000, newRadius));
    setRadiusMeters(clamped);
    modalMapRef.current?.showBubble(currentLat, currentLng, clamped, false);
  };

  // Recenter map button
  const handleRecenter = () => {
    modalMapRef.current?.fitBubble(currentLat, currentLng, radiusMeters);
  };

  // Tapping directly on the map to set place coordinates
  const handleMapPress = (coords?: { latitude: number; longitude: number }) => {
    if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
      setCurrentLat(coords.latitude);
      setCurrentLng(coords.longitude);
      modalMapRef.current?.showBubble(coords.latitude, coords.longitude, radiusMeters, false);

      locationSearchService
        .getNearbyPlaces(coords.latitude, coords.longitude)
        .then((nearby) => {
          if (nearby && nearby.length > 0) {
            setCurrentAddress(nearby[0].address || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
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

  // Viewport change while panning map in preview
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
      }, 400);
    }
  };

  const formatDistance = (meters: number) => {
    return formatGeofenceRadius(meters, distancePreferencesService.getPreferencesSync().unit);
  };

  // Save / Update place handler
  const handleSave = async () => {
    const finalName = (name || searchQuery).trim();
    if (!finalName) {
      Alert.alert('Place Name Required', 'Please enter or search for a place name (e.g. Home, Office, College).');
      return;
    }

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
      onClose();
      setName('');
    } catch {
      Alert.alert('Error', isEditing ? 'Failed to update place. Please try again.' : 'Failed to save place. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.title, { color: colors.textMain }]}>
                {isEditing ? 'Edit Saved Place' : 'Add Saved Place'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {isEditing
                  ? 'Update location, emoji & geofence settings'
                  : currentAddress || `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Search Location + Use Current Location Bar */}
            <Text style={[styles.fieldLabel, { color: colors.textMain }]}>Location & Search</Text>

            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchBox,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: isDark ? 'rgba(124, 58, 237, 0.4)' : '#C4B5FD',
                  },
                ]}
              >
                <Ionicons name="search" size={18} color="#7C3AED" style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textMain }]}
                  placeholder="Search place name or address..."
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

              {/* "Use Current Location" Quick Button */}
              <TouchableOpacity
                onPress={handleUseCurrentLocation}
                disabled={isLocating}
                style={[
                  styles.useLocationBtn,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : '#EDE9FE',
                    borderColor: '#7C3AED',
                  },
                ]}
                activeOpacity={0.8}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : (
                  <>
                    <Ionicons name="navigate" size={15} color="#7C3AED" />
                    <Text style={styles.useLocationBtnText}>My Location</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Scrollable Suggestions List */}
            {showSuggestions && searchResults.length > 0 && (
              <View
                style={[
                  styles.suggestionsContainer,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.tileBorder,
                  },
                ]}
              >
                <View style={[styles.suggestionsHeader, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.suggestionsCountText, { color: colors.textMuted }]}>
                    {searchResults.length} matching locations
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowSuggestions(false)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>Hide</Text>
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
                        { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
                      ]}
                    >
                      <View style={styles.suggestionIconWrap}>
                        <Ionicons name="location-sharp" size={16} color="#7C3AED" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={[styles.suggestionTitle, { color: colors.textMain }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.address ? (
                          <Text style={[styles.suggestionSub, { color: colors.textMuted }]} numberOfLines={1}>
                            {item.address}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Embedded Live Map Preview with Emoji Pinpoint Indicator */}
            <View style={styles.mapSectionWrap}>
              <View style={[styles.mapCard, { borderColor: colors.cardBorder }]}>
                <MapView
                  ref={modalMapRef}
                  currentUserId={currentUserId || 'preview-user'}
                  members={[placeMemberForMap]}
                  myPosition={
                    myPosition
                      ? { latitude: myPosition.latitude, longitude: myPosition.longitude, heading: myPosition.heading ?? 0 }
                      : { latitude: currentLat, longitude: currentLng, heading: 0 }
                  }
                  mapStyle={mapStyle}
                  onMapPress={handleMapPress}
                  onViewportChange={handleViewportChange}
                />

                {/* Floating Pinpoint Indicator in center of preview */}
                <View pointerEvents="none" style={styles.mapCenterPinOverlay}>
                  <View style={styles.centerPinBubble}>
                    <Text style={styles.centerPinEmoji}>{activeCategory.emoji}</Text>
                    <Text style={styles.centerPinText} numberOfLines={1}>
                      {name || 'Place'}
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
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.95)',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.purpleDotPulse} />
                  <Text style={[styles.mapFloatingBadgeText, { color: colors.textMain }]}>
                    Geofence: <Text style={{ fontWeight: '800', color: colors.primary }}>{formatDistance(radiusMeters)}</Text>
                  </Text>
                </View>

                {/* Floating Re-center Crosshair Button */}
                <TouchableOpacity
                  style={[
                    styles.mapRecenterBtn,
                    {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : '#FFFFFF',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={handleRecenter}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="crosshair" size={18} color={colors.primary} />
                </TouchableOpacity>

                {/* Floating Map Hint */}
                <View
                  style={[
                    styles.mapHintPill,
                    {
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.9)',
                    },
                  ]}
                >
                  <Text style={[styles.mapHintText, { color: colors.textMuted }]}>
                    Move map or tap to adjust pinpoint
                  </Text>
                </View>
              </View>
            </View>

            {/* Place Name Input */}
            <Text style={[styles.fieldLabel, { color: colors.textMain, marginTop: 14 }]}>Place Name</Text>
            <View
              style={[
                styles.nameInputBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <TextInput
                style={[styles.nameInput, { color: colors.textMain }]}
                placeholder="e.g. Home, Office, College, Gym"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* Quick Category Buttons with Emojis */}
            <Text style={[styles.fieldLabel, { color: colors.textMain, marginTop: 14 }]}>Category & Emoji</Text>
            <View style={styles.categoryRow}>
              {categories.map((c) => {
                const isSelected = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    activeOpacity={0.8}
                    onPress={() => {
                      setCategory(c.key as any);
                      if (!name) {
                        setName(c.label);
                        setSearchQuery(c.label);
                      }
                      try {
                        Haptics.selectionAsync();
                      } catch {}
                    }}
                    style={[
                      styles.categoryBtn,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(124, 58, 237, 0.22)' : '#EEF2FF')
                          : colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.tileBorder,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: isSelected ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Geofence Radius Slider (Smooth interactive slider instead of preset buttons) */}
            <GeofenceRadiusSlider
              value={radiusMeters}
              onChange={updateRadius}
              formatDistance={formatDistance}
            />

            {/* Arrival/Departure Toggles */}
            <View style={[styles.toggleRow, { borderBottomColor: colors.divider, marginTop: 14 }]}>
              <View>
                <Text style={[styles.toggleTitle, { color: colors.textMain }]}>Notify on Arrival</Text>
                <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>Alert circle members when arriving</Text>
              </View>
              <Switch
                value={notifyOnEnter}
                onValueChange={setNotifyOnEnter}
                trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
              />
            </View>

            <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
              <View>
                <Text style={[styles.toggleTitle, { color: colors.textMain }]}>Notify on Departure</Text>
                <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>Alert circle members when leaving</Text>
              </View>
              <Switch
                value={notifyOnExit}
                onValueChange={setNotifyOnExit}
                trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
              />
            </View>

            {/* Bottom Place Summary Card (Replaces raw lat/long coordinates with actual place name, address and emoji) */}
            <View
              style={[
                styles.bottomPlaceSummaryCard,
                {
                  backgroundColor: colors.tileBg,
                  borderColor: colors.tileBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.summaryEmojiCircle,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.22)' : '#EDE9FE',
                  },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{activeCategory.emoji}</Text>
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.summaryPlaceTitle, { color: colors.textMain }]} numberOfLines={1}>
                  {name.trim() || searchQuery.trim() || 'Selected Place'}
                </Text>
                <Text style={[styles.summaryPlaceSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {currentAddress || `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`}
                </Text>
              </View>
              <View
                style={[
                  styles.summaryRadiusPill,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EEF2FF',
                    borderColor: '#7C3AED',
                  },
                ]}
              >
                <Ionicons name="radio" size={13} color="#7C3AED" style={{ marginRight: 4 }} />
                <Text style={styles.summaryRadiusPillText}>{formatDistance(radiusMeters)}</Text>
              </View>
            </View>

            {/* Save / Update Place Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.8 : 1 }]}
            >
              {isSaving ? (
                <InlineButtonLoader
                  size={18}
                  label={isEditing ? 'Updating Place & Geofence...' : 'Saving Place & Geofence...'}
                />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isEditing ? 'Update Place & Geofence' : 'Save Place & Geofence'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    maxHeight: '94%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
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
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
  useLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  useLocationBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  suggestionsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
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
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionsScroll: {
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    gap: 10,
  },
  suggestionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSub: {
    fontSize: 12,
    marginTop: 1,
  },

  /* Embedded Map Preview */
  mapSectionWrap: {
    marginTop: 14,
  },
  mapCard: {
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
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
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    maxWidth: 140,
  },
  centerPinEmoji: {
    fontSize: 16,
  },
  centerPinText: {
    color: '#FFFFFF',
    fontSize: 11,
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
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 18,
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
    fontSize: 12,
    fontWeight: '600',
  },
  mapRecenterBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
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
  mapHintPill: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  mapHintText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Name Box */
  nameInputBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  nameInput: {
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
  },

  /* Category pills */
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Toggles */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },

  /* Bottom Place Summary Card */
  bottomPlaceSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    gap: 10,
  },
  summaryEmojiCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryPlaceTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  summaryPlaceSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  summaryRadiusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryRadiusPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED',
  },

  saveBtn: {
    marginTop: 18,
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
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
