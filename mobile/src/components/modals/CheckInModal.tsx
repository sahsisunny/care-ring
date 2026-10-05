import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { locationSearchService, LocationSearchResult } from '../../services/LocationSearchService';

interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
  myPosition?: { latitude: number; longitude: number } | null;
  savedPlaces?: any[];
  onConfirmCheckIn: (place: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = React.memo(({
  visible,
  onClose,
  myPosition,
  savedPlaces = [],
  onConfirmCheckIn,
}) => {
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<LocationSearchResult[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  
  const searchTimeoutRef = useRef<any>(null);
  const searchRequestIdRef = useRef<number>(0);
  const wasVisibleRef = useRef<boolean>(false);
  const positionRef = useRef({ lat: 12.9095, lng: 77.6753 });
  const savedPlacesRef = useRef(savedPlaces);
  savedPlacesRef.current = savedPlaces;

  const listScrollRef = useRef<ScrollView>(null);

  // Load nearby places ONCE when modal transitions from closed to open
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      wasVisibleRef.current = true;
      listScrollRef.current?.scrollTo({ y: 0, animated: false });
      const initialLat = myPosition?.latitude || 12.9095;
      const initialLng = myPosition?.longitude || 77.6753;
      positionRef.current = { lat: initialLat, lng: initialLng };

      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setIsLoadingNearby(true);

      locationSearchService
        .getNearbyPlaces(initialLat, initialLng, savedPlacesRef.current)
        .then((places) => {
          setNearbyPlaces(places);
        })
        .catch(() => {
          setNearbyPlaces([]);
        })
        .finally(() => {
          setIsLoadingNearby(false);
        });
    } else if (!visible) {
      wasVisibleRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [visible]);

  // Debounced Search Handler - keeps typed text intact and searches smoothly
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const reqId = ++searchRequestIdRef.current;

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { lat, lng } = positionRef.current;
        const results = await locationSearchService.searchPlaces(
          trimmed,
          lat,
          lng,
          savedPlacesRef.current
        );
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

  const handleSelectPlace = (place: LocationSearchResult) => {
    onConfirmCheckIn({
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    onClose();
  };

  const isQueryActive = searchQuery.trim().length > 0;
  const displayedList = isQueryActive ? searchResults : nearbyPlaces;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={26} color={colors.textMain} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textMain }]}>Check In</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        {/* Search Bar Input */}
        <View style={styles.searchBarWrapper}>
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
                borderBottomColor: isDark ? 'rgba(124, 58, 237, 0.5)' : '#C4B5FD',
              },
            ]}
          >
            <Ionicons name="search" size={20} color="#7C3AED" style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.textMain }]}
              placeholder="Search address or location name"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleQueryChange}
              autoCapitalize="words"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {isSearching && (
              <ActivityIndicator size="small" color="#7C3AED" style={{ marginRight: 8 }} />
            )}
            {searchQuery.length > 0 && !isSearching && Platform.OS !== 'ios' && (
              <TouchableOpacity onPress={() => handleQueryChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Section Title */}
        <View
          style={[
            styles.sectionHeader,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
              borderBottomColor: colors.divider,
            },
          ]}
        >
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            {isQueryActive ? `Search results (${searchResults.length})` : 'Nearby places'}
          </Text>
        </View>

        {/* Places List */}
        {isLoadingNearby && !isQueryActive ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Finding nearby locations...</Text>
          </View>
        ) : (
          <ScrollView
            ref={listScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {displayedList.length === 0 && !isSearching ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textMain }]}>No places found</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {isQueryActive
                    ? 'Try searching with another name or check your spelling.'
                    : 'No nearby landmarks found. Try searching for a specific location.'}
                </Text>
              </View>
            ) : (
              displayedList.map((item, index) => {
                const isHome = item.name.toLowerCase() === 'home' || item.category === 'home';
                const isWork = item.name.toLowerCase().includes('office') || item.name.toLowerCase().includes('work') || item.category === 'work';

                return (
                  <TouchableOpacity
                    key={item.id || `${item.name}-${index}`}
                    activeOpacity={0.7}
                    onPress={() => handleSelectPlace(item)}
                    style={[
                      styles.placeItem,
                      { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9' },
                    ]}
                  >
                    {/* Purple Location Pin Icon Circle */}
                    <View
                      style={[
                        styles.pinCircle,
                        {
                          backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : '#F5F3FF',
                          borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : '#EDE9FE',
                        },
                      ]}
                    >
                      <Ionicons
                        name={isHome ? 'home' : (isWork ? 'business' : 'location-sharp')}
                        size={20}
                        color="#7C3AED"
                      />
                    </View>

                    {/* Place Details */}
                    <View style={styles.placeTextWrap}>
                      <View style={styles.placeTitleRow}>
                        <Text style={[styles.placeName, { color: colors.textMain }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.isSavedPlace && (
                          <View style={styles.savedChip}>
                            <Text style={styles.savedChipText}>Saved</Text>
                          </View>
                        )}
                      </View>
                      {item.address ? (
                        <Text style={[styles.placeAddress, { color: colors.textMuted }]} numberOfLines={1}>
                          {item.address}
                        </Text>
                      ) : null}
                    </View>

                    {/* Right Forward Arrow */}
                    <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1'} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRightSpacer: {
    width: 36,
  },
  searchBarWrapper: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderBottomWidth: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    padding: 0,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: -0.1,
  },
  listContent: {
    paddingBottom: 40,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    gap: 14,
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeTextWrap: {
    flex: 1,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  savedChip: {
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  savedChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  placeAddress: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2.5,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
});
