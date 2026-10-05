import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { InlineButtonLoader } from '../common/Loader';
import { locationSearchService, LocationSearchResult } from '../../services/LocationSearchService';

interface SavePlaceModalProps {
  visible: boolean;
  onClose: () => void;
  initialAddress?: string;
  latitude?: number;
  longitude?: number;
  onSavePlace: (place: {
    name: string;
    category: 'home' | 'work' | 'school' | 'gym' | 'other';
    radiusMeters: number;
    notifyOnEnter: boolean;
    notifyOnExit: boolean;
    latitude: number;
    longitude: number;
    address?: string;
  }) => void;
}

export const SavePlaceModal: React.FC<SavePlaceModalProps> = React.memo(({
  visible,
  onClose,
  initialAddress = '',
  latitude = 12.9095,
  longitude = 77.6753,
  onSavePlace,
}) => {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [currentAddress, setCurrentAddress] = useState(initialAddress);
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);

  const [isSaving, setIsSaving] = useState(false);
  const [category, setCategory] = useState<'home' | 'work' | 'school' | 'gym' | 'other'>('home');
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(true);

  // Place name search autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const searchTimeoutRef = useRef<any>(null);
  const searchRequestIdRef = useRef<number>(0);
  const wasVisibleRef = useRef<boolean>(false);

  // Initialize fields ONLY when modal opens (rising edge of visible)
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      wasVisibleRef.current = true;
      setName('');
      setSearchQuery('');
      setSearchResults([]);
      setShowSuggestions(false);
      setIsSearching(false);
      setCurrentAddress(initialAddress);
      setCurrentLat(latitude);
      setCurrentLng(longitude);
    } else if (!visible) {
      wasVisibleRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [visible]);

  const categories = [
    { key: 'home', label: 'Home', icon: 'home-outline' },
    { key: 'work', label: 'Office', icon: 'briefcase-outline' },
    { key: 'school', label: 'College', icon: 'school-outline' },
    { key: 'gym', label: 'Gym', icon: 'fitness-outline' },
    { key: 'other', label: 'Other', icon: 'location-outline' },
  ];

  // Debounced Place Search - keeps entered text completely stable
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

  const handleSelectSuggestion = (item: LocationSearchResult) => {
    setName(item.name);
    setSearchQuery(item.name);
    setCurrentAddress(item.address || item.name);
    setCurrentLat(item.latitude);
    setCurrentLng(item.longitude);
    setShowSuggestions(false);

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

  const handleSave = () => {
    const finalName = (name || searchQuery).trim();
    if (!finalName) {
      Alert.alert('Place Name Required', 'Please enter or search for a place name (e.g. Home, Office, College).');
      return;
    }

    setIsSaving(true);
    onSavePlace({
      name: finalName,
      category,
      radiusMeters,
      notifyOnEnter,
      notifyOnExit,
      latitude: currentLat,
      longitude: currentLng,
      address: currentAddress || undefined,
    });

    setIsSaving(false);
    onClose();
    setName('');
    Alert.alert('📍 Place Saved', `"${finalName}" added with automatic geofencing alerts.`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.modalCardBg, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.textMain }]}>Add Saved Place</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {currentAddress || `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Search Location / Place Name Input */}
            <Text style={[styles.fieldLabel, { color: colors.textMain }]}>Search Place or Enter Name</Text>
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
                placeholder="Search place name (Home, Office, College...)"
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

            {/* Suggestions Dropdown */}
            {showSuggestions && searchResults.length > 0 && (
              <View style={[styles.suggestionsDropdown, { backgroundColor: colors.card, borderColor: colors.tileBorder }]}>
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
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionTitle, { color: colors.textMain }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.address ? (
                        <Text style={[styles.suggestionSub, { color: colors.textMuted }]} numberOfLines={1}>
                          {item.address}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Quick Category Buttons */}
            <Text style={[styles.fieldLabel, { color: colors.textMain, marginTop: 14 }]}>Category</Text>
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
                    <Ionicons
                      name={c.icon as any}
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
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

            {/* Geofence Radius */}
            <Text style={[styles.fieldLabel, { color: colors.textMain, marginTop: 14 }]}>Geofence Radius</Text>
            <View style={styles.radiusRow}>
              {[100, 200, 500, 1000].map((r) => {
                const isSelected = radiusMeters === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRadiusMeters(r)}
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
                <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>Alert circle when members arrive</Text>
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
                <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>Alert circle when members leave</Text>
              </View>
              <Switch
                value={notifyOnExit}
                onValueChange={setNotifyOnExit}
                trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
              />
            </View>

            {/* Selected Coordinates Chip */}
            <View style={[styles.coordsChip, { backgroundColor: colors.tileBg }]}>
              <Ionicons name="navigate-circle" size={16} color="#7C3AED" />
              <Text style={[styles.coordsText, { color: colors.textMuted }]} numberOfLines={1}>
                Coordinates: {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
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
                <InlineButtonLoader size={18} label="Saving Place..." />
              ) : (
                <Text style={styles.saveBtnText}>Save Place</Text>
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
    maxHeight: '90%',
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
    maxWidth: 260,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
  },
  suggestionsDropdown: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    maxHeight: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
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
  radiusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  radiusBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  radiusText: {
    fontSize: 13,
    fontWeight: '700',
  },
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
