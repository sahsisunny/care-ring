import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { InlineButtonLoader } from '../common/Loader';
import { locationSearchService, LocationSearchResult } from '../../services/LocationSearchService';
import { MapView, MapViewRef } from '../MapView';
import { MemberData } from '../../models/Member';
import { MapStyleConfig } from '../../models/MapStyle';

export interface SavePlaceModalProps {
  visible: boolean;
  onClose: () => void;
  initialAddress?: string;
  latitude?: number;
  longitude?: number;
  myPosition?: { latitude: number; longitude: number; heading?: number } | null;
  currentUserId?: string;
  mapStyle?: MapStyleConfig;
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

export const SavePlaceModal: React.FC<SavePlaceModalProps> = React.memo(({
  visible,
  onClose,
  initialAddress = '',
  latitude = 12.9095,
  longitude = 77.6753,
  myPosition = null,
  currentUserId = '',
  mapStyle,
  onSavePlace,
}) => {
  const { colors, isDark } = useTheme();

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
  const wasVisibleRef = useRef<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);
  const modalMapRef = useRef<MapViewRef>(null);

  // Categories list
  const categories = [
    { key: 'home', label: 'Home', icon: 'home-outline', emoji: '🏠' },
    { key: 'work', label: 'Office', icon: 'briefcase-outline', emoji: '🏢' },
    { key: 'school', label: 'School / College', icon: 'school-outline', emoji: '🏫' },
    { key: 'gym', label: 'Gym', icon: 'fitness-outline', emoji: '🏋️' },
    { key: 'other', label: 'Other', icon: 'location-outline', emoji: '📍' },
  ];

  // Target member object to display pin marker on the map preview
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
    } as MemberData;
  }, [name, searchQuery, currentLat, currentLng, radiusMeters]);

  // Synchronize state when modal opens
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      wasVisibleRef.current = true;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setName('');
      setSearchQuery('');
      setSearchResults([]);
      setShowSuggestions(false);
      setIsSearching(false);
      setIsLocating(false);

      const targetLat = latitude ?? myPosition?.latitude ?? 12.9095;
      const targetLng = longitude ?? myPosition?.longitude ?? 77.6753;
      setCurrentAddress(initialAddress);
      setCurrentLat(targetLat);
      setCurrentLng(targetLng);
      setRadiusMeters(200);

      // Fit map bubble when Leaflet finishes mounting
      const timer = setTimeout(() => {
        modalMapRef.current?.fitBubble(targetLat, targetLng, 200);
      }, 380);

      return () => clearTimeout(timer);
    } else if (!visible) {
      wasVisibleRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [visible, latitude, longitude, myPosition, initialAddress]);

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
      setCategory(item.category);
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
        // Fallback: check device GPS directly
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

        // Live update the map to center & draw circle at user's current GPS location
        modalMapRef.current?.fitBubble(lat, lng, radiusMeters);

        // Reverse-geocode to get readable area/street name
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

      // Reverse geocode new coordinate
      locationSearchService.getNearbyPlaces(coords.latitude, coords.longitude).then((nearby) => {
        if (nearby && nearby.length > 0) {
          setCurrentAddress(nearby[0].address || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
          if (!name) setName(nearby[0].name);
        } else {
          setCurrentAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        }
      }).catch(() => {
        setCurrentAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
      });
    }
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      const km = meters / 1000;
      return `${km.toFixed(km % 1 === 0 ? 0 : 1)} km`;
    }
    return `${meters} m`;
  };

  // Save place handler
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
      Alert.alert('Error', 'Failed to save place. Please try again.');
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
              <Text style={[styles.title, { color: colors.textMain }]}>Add Saved Place</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {currentAddress || `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`}
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

            {/* Scrollable Suggestions List (Fix: nested ScrollView with dedicated scrolling & max-height) */}
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
                    {searchResults.length} matching locations (scroll to view)
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

            {/* Embedded Live Map Preview with Bubble/Ghost Geofence Range */}
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
                />

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
                    Geofence Range: <Text style={{ fontWeight: '800', color: colors.primary }}>{formatDistance(radiusMeters)}</Text>
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

                {/* Floating Map Tap Hint */}
                <View
                  style={[
                    styles.mapHintPill,
                    {
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                    },
                  ]}
                >
                  <Text style={[styles.mapHintText, { color: colors.textMuted }]}>
                    Tap map or search to adjust place pin
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

            {/* Quick Category Buttons */}
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
                    }}
                    style={[
                      styles.categoryBtn,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF')
                          : colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.tileBorder,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
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

            {/* Geofence Radius Selector + Fine-Tune Steppers */}
            <View style={[styles.radiusHeaderRow, { marginTop: 14 }]}>
              <Text style={[styles.fieldLabel, { color: colors.textMain, marginBottom: 0 }]}>
                Geofence Radius ({formatDistance(radiusMeters)})
              </Text>
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => updateRadius(radiusMeters - 50)}
                  style={[styles.stepperBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
                >
                  <Ionicons name="remove" size={16} color={colors.textMain} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => updateRadius(radiusMeters + 50)}
                  style={[styles.stepperBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }]}
                >
                  <Ionicons name="add" size={16} color={colors.textMain} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.radiusRow}>
              {[100, 200, 500, 1000, 2000, 5000].map((r) => {
                const isSelected = radiusMeters === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => updateRadius(r)}
                    style={[
                      styles.radiusBtn,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.tileBg,
                        borderColor: isSelected ? colors.primary : colors.tileBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.radiusText,
                        { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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

            {/* Coordinates Chip */}
            <View style={[styles.coordsChip, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="navigate-circle" size={16} color="#7C3AED" />
              <Text style={[styles.coordsText, { color: colors.textMuted }]} numberOfLines={1}>
                {currentLat.toFixed(5)}, {currentLng.toFixed(5)} • Radius: {formatDistance(radiusMeters)}
              </Text>
            </View>

            {/* Save Place Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.8 : 1 }]}
            >
              {isSaving ? (
                <InlineButtonLoader size={18} label="Saving Place & Geofence..." />
              ) : (
                <Text style={styles.saveBtnText}>Save Place & Geofence</Text>
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
    paddingHorizontal: 10,
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

  /* Radius Section */
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  radiusText: {
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
  coordsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 14,
  },
  coordsText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
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
