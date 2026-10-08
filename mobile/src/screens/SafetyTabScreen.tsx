import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  StatusBar,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { PlaceCardSkeleton } from '../components/common/Skeleton';
import { MemberData } from '../models/Member';
import { FloatingMapActionsRow } from '../components/FloatingMapActionsRow';

interface SafetyTabScreenProps {
  places?: any[];
  placesLoading?: boolean;
  onTriggerSOS: () => void;
  onOpenSavePlace: () => void;
  onDeletePlace?: (placeId: string) => void;
  onViewTimeline?: (filter?: 'all' | 'places' | 'drives') => void;
  members?: MemberData[];
  currentUserId?: string;
  pullUpTrigger?: number;
  onCheckInTapped?: () => void;
  onGhostModeTapped?: () => void;
  isSelfInBubble?: boolean;
  onToggleMapLayers?: () => void;
  onGoToMyLocation?: () => void;
  onExpandChange?: (isExpanded: boolean) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_MIN_HEIGHT = 90;
const DRAWER_MID_HEIGHT = 290;

export const SafetyTabScreen: React.FC<SafetyTabScreenProps> = React.memo(({
  places = [],
  placesLoading = false,
  onTriggerSOS,
  onOpenSavePlace,
  onDeletePlace,
  onViewTimeline,
  members = [],
  currentUserId,
  pullUpTrigger,
  onCheckInTapped,
  onGhostModeTapped,
  isSelfInBubble = false,
  onToggleMapLayers,
  onGoToMyLocation,
  onExpandChange,
}) => {
  const onExpandChangeRef = useRef(onExpandChange);
  onExpandChangeRef.current = onExpandChange;
  const insets = useSafeAreaInsets();
  const topSafe = Math.max(
    insets.top || 0,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44
  );
  const bottomTabBarHeight = 60 + (insets.bottom || 0);
  const availableViewportHeight = SCREEN_HEIGHT - bottomTabBarHeight;

  const dynamicMaxExpandedHeight = useMemo(() => {
    return Math.min(
      Math.round(availableViewportHeight * 0.94),
      availableViewportHeight - (topSafe + 16)
    );
  }, [availableViewportHeight, topSafe]);

  const COLLAPSED_TRANSLATE_Y = dynamicMaxExpandedHeight - DRAWER_MIN_HEIGHT;
  const MID_TRANSLATE_Y = dynamicMaxExpandedHeight - DRAWER_MID_HEIGHT;
  const EXPANDED_TRANSLATE_Y = 0;
  const HIDDEN_TRANSLATE_Y = dynamicMaxExpandedHeight + 40;

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentSnapRef = useRef<'min' | 'mid' | 'max' | 'hidden'>('min');
  const translateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const startDragTranslateY = useRef<number>(COLLAPSED_TRANSLATE_Y);

  const animateToTranslateY = (targetY: number, withFlick = false, velocity = 0) => {
    const isAtTop = targetY === EXPANDED_TRANSLATE_Y;
    setIsExpanded(isAtTop);
    onExpandChangeRef.current?.(isAtTop);
    if (targetY === EXPANDED_TRANSLATE_Y) {
      currentSnapRef.current = 'max';
    } else if (targetY === MID_TRANSLATE_Y) {
      currentSnapRef.current = 'mid';
    } else if (targetY === HIDDEN_TRANSLATE_Y) {
      currentSnapRef.current = 'hidden';
    } else {
      currentSnapRef.current = 'min';
    }
    Animated.spring(translateY, {
      toValue: targetY,
      tension: 65,
      friction: 11,
      velocity: velocity ? -velocity : 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  // Sync expand state on mount and cleanup
  useEffect(() => {
    onExpandChangeRef.current?.(false);
    return () => {
      onExpandChangeRef.current?.(false);
    };
  }, []);

  // Pull up drawer whenever tab button is tapped from bottom bar:
  // If drawer is hidden completely at bottom or collapsed, open directly to 2nd stop (MID)
  useEffect(() => {
    if (pullUpTrigger && pullUpTrigger > 0) {
      currentSnapRef.current = 'mid';
      animateToTranslateY(MID_TRANSLATE_Y, true);
    }
  }, [pullUpTrigger]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderGrant: () => {
        startDragTranslateY.current = (translateY as any)._value ?? (
          currentSnapRef.current === 'max'
            ? EXPANDED_TRANSLATE_Y
            : currentSnapRef.current === 'mid'
            ? MID_TRANSLATE_Y
            : currentSnapRef.current === 'min'
            ? COLLAPSED_TRANSLATE_Y
            : HIDDEN_TRANSLATE_Y
        );
      },
      onPanResponderMove: (_, gesture) => {
        const targetTranslateY = startDragTranslateY.current + gesture.dy;
        const clamped = Math.max(
          EXPANDED_TRANSLATE_Y - 8,
          Math.min(HIDDEN_TRANSLATE_Y + 12, targetTranslateY)
        );
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, gesture) => {
        const midpointMaxMid = (EXPANDED_TRANSLATE_Y + MID_TRANSLATE_Y) / 2;
        const midpointMidMin = (MID_TRANSLATE_Y + COLLAPSED_TRANSLATE_Y) / 2;
        const midpointMinHidden = (COLLAPSED_TRANSLATE_Y + HIDDEN_TRANSLATE_Y) / 2;
        const currentTranslateY = startDragTranslateY.current + gesture.dy;

        let targetSnap: 'min' | 'mid' | 'max' | 'hidden' = 'min';

        if (gesture.vy < -0.35) {
          // Flick / Swipe UP
          if (gesture.vy < -1.0 || gesture.dy < -220) {
            targetSnap = 'max';
          } else if (currentSnapRef.current === 'hidden') {
            targetSnap = 'min';
          } else if (currentSnapRef.current === 'min') {
            targetSnap = 'mid';
          } else {
            targetSnap = 'max';
          }
        } else if (gesture.vy > 0.35) {
          // Flick / Swipe DOWN
          if (gesture.vy > 1.2 || gesture.dy > 280) {
            targetSnap = 'hidden';
          } else if (currentSnapRef.current === 'max') {
            targetSnap = 'mid';
          } else if (currentSnapRef.current === 'mid') {
            targetSnap = 'min';
          } else {
            targetSnap = 'hidden';
          }
        } else {
          // Position-based snap to nearest stop point
          if (currentTranslateY <= midpointMaxMid) {
            targetSnap = 'max';
          } else if (currentTranslateY <= midpointMidMin) {
            targetSnap = 'mid';
          } else if (currentTranslateY <= midpointMinHidden) {
            targetSnap = 'min';
          } else {
            targetSnap = 'hidden';
          }
        }

        currentSnapRef.current = targetSnap;
        const targetY =
          targetSnap === 'max'
            ? EXPANDED_TRANSLATE_Y
            : targetSnap === 'mid'
            ? MID_TRANSLATE_Y
            : targetSnap === 'min'
            ? COLLAPSED_TRANSLATE_Y
            : HIDDEN_TRANSLATE_Y;

        animateToTranslateY(targetY, targetSnap !== 'min', gesture.vy);
      },
    })
  ).current;

  const toggleSheet = () => {
    if (currentSnapRef.current === 'hidden') {
      currentSnapRef.current = 'mid';
      animateToTranslateY(MID_TRANSLATE_Y, true);
    } else if (currentSnapRef.current === 'min') {
      currentSnapRef.current = 'mid';
      animateToTranslateY(MID_TRANSLATE_Y, true);
    } else if (currentSnapRef.current === 'mid') {
      currentSnapRef.current = 'max';
      animateToTranslateY(EXPANDED_TRANSLATE_Y, true);
    } else {
      currentSnapRef.current = 'min';
      animateToTranslateY(COLLAPSED_TRANSLATE_Y, false);
    }
  };

  const { colors, isDark, isGlass } = useTheme();

  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);

  const [silentSOS, setSilentSOS] = useState(false);

  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      <FloatingMapActionsRow
        translateY={translateY}
        dynamicMaxExpandedHeight={dynamicMaxExpandedHeight}
        collapsedHeight={DRAWER_MIN_HEIGHT}
        midTranslateY={MID_TRANSLATE_Y}
        expandedTranslateY={EXPANDED_TRANSLATE_Y}
        hiddenTranslateY={HIDDEN_TRANSLATE_Y}
        isExpanded={isExpanded}
        isSelfInBubble={isSelfInBubble}
        onCheckInTapped={onCheckInTapped}
        onGhostModeTapped={onGhostModeTapped}
        onToggleMapLayers={onToggleMapLayers}
        onGoToMyLocation={onGoToMyLocation}
        onSOSTapped={onTriggerSOS}
      />
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            height: dynamicMaxExpandedHeight,
            transform: [{ translateY }],
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
          webGlassCard,
        ]}
      >
        {/* FIXED TOP HEADER: Grab Handle Bar, Title, Status & Actions */}
        <View
          {...panResponder.panHandlers}
          style={[
            styles.sketchFixedHeader,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.divider,
            },
          ]}
        >
          {/* Centered Grab Handle Bar (Tap to toggle min/mid/max; drag to move) */}
          <View style={styles.sketchGrabArea}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleSheet}
              style={styles.handleTouch}
              accessibilityLabel="Toggle safety sheet height"
            >
              <View
                style={[
                  styles.grabBar,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1' },
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Fixed Top Bar */}
          <View style={styles.sketchFixedTopBar}>
            <View style={styles.sketchHeaderLeftCol}>
              <Text style={[styles.sketchNameText, { color: colors.textMain }]} numberOfLines={1}>
                Safety Center
              </Text>
              <View style={styles.sketchSinceAndMetaRow}>
                <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                  <Ionicons name="shield-checkmark" size={10} color={isDark ? '#34D399' : '#10B981'} />
                  <Text style={[styles.statusPillText, { color: isDark ? '#34D399' : '#059669' }]}>
                    ACTIVE
                  </Text>
                </View>
                <View
                  style={[
                    styles.bentoPlacesBadge,
                    {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#EEF2FF',
                      borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                    },
                  ]}
                >
                  <Text style={[styles.bentoPlacesText, { color: colors.primary }]}>
                    {places.length} {places.length === 1 ? 'place' : 'places'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity onPress={onTriggerSOS} style={styles.sosQuickBtn} activeOpacity={0.85}>
                <Ionicons name="alert-circle" size={14} color="#FFFFFF" />
                <Text style={styles.sosQuickBtnText}>Help</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + insets.bottom },
          ]}
          onScrollEndDrag={(e) => {
            if (e.nativeEvent.contentOffset.y < -35) {
              if (currentSnapRef.current === 'max') {
                currentSnapRef.current = 'mid';
                animateToTranslateY(MID_TRANSLATE_Y, true);
              } else if (currentSnapRef.current === 'mid') {
                currentSnapRef.current = 'min';
                animateToTranslateY(COLLAPSED_TRANSLATE_Y, false);
              } else if (currentSnapRef.current === 'min') {
                currentSnapRef.current = 'hidden';
                animateToTranslateY(HIDDEN_TRANSLATE_Y, false);
              }
            }
          }}
        >
        {/* Emergency Help Dispatch Button */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onTriggerSOS}
          style={styles.sosBanner}
        >
          <View style={styles.sosIconCircle}>
            <Ionicons name="alert-circle" size={28} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosBannerTitle}>Trigger Emergency Help</Text>
            <Text style={styles.sosBannerDesc}>
              Broadcasts immediate location coordinates and critical alerts to all circle members.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Unlimited Geofence Saved Places */}
        <View style={styles.placesHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Unlimited Saved Places</Text>
          <TouchableOpacity onPress={onOpenSavePlace} style={[styles.addPlaceBtn, { backgroundColor: colors.tileBg }]}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[styles.addPlaceBtnText, { color: colors.primary }]}>Add Place</Text>
          </TouchableOpacity>
        </View>

        {placesLoading ? (
          <PlaceCardSkeleton count={3} />
        ) : places.length === 0 ? (
          <View style={[styles.emptyPlacesCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
            <View style={[styles.emptyPlacesIconCircle, { backgroundColor: colors.card }]}>
              <Ionicons name="location-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyPlacesTitle, { color: colors.textMain }]}>No Saved Places Yet</Text>
            <Text style={[styles.emptyPlacesSub, { color: colors.textMuted }]}>
              Add locations like Home, Work, or School to get automated geofence arrival and departure alerts for your circle.
            </Text>
            <TouchableOpacity onPress={onOpenSavePlace} style={[styles.addFirstPlaceBtn, { backgroundColor: colors.primary }]}>
              <Feather name="plus" size={15} color="#FFFFFF" />
              <Text style={styles.addFirstPlaceBtnText}>Add Your First Place</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.placesListCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, webGlassCard]}>
            {places.map((place, idx) => (
              <View
                key={place.id}
                style={[
                  styles.placeRow,
                  { borderBottomColor: colors.divider },
                  idx === places.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.placeIconCircle, { backgroundColor: colors.tileBg }]}>
                  <Ionicons
                    name={
                      place.category === 'home'
                        ? 'home'
                        : place.category === 'work'
                        ? 'briefcase'
                        : place.category === 'school'
                        ? 'school'
                        : place.category === 'gym'
                        ? 'barbell'
                        : 'location'
                    }
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={[styles.placeName, { color: colors.textMain }]}>{place.name}</Text>
                  <Text style={[styles.placeRadius, { color: colors.textMuted }]}>
                    Radius: {place.radius_meters || place.radius || 200}m • Arrival & Departure Alerts
                  </Text>
                </View>
                {onDeletePlace && (
                  <TouchableOpacity
                    onPress={() => onDeletePlace(place.id)}
                    style={{ padding: 8 }}
                  >
                    <Feather name="trash-2" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Places & Geofence Activity Log Strip under places */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => onViewTimeline?.('places')}
          style={[styles.underEventsLogStrip, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}
        >
          <View style={[styles.stripIconWrap, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }]}>
            <Feather name="map-pin" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stripTitle, { color: colors.textMain }]}>Places & Geofence Activity Log</Text>
            <Text style={[styles.stripSub, { color: colors.textMuted }]}>
              Review arrivals, departures, and time spent at saved locations
            </Text>
          </View>
          <View style={[styles.stripActionPill, { backgroundColor: colors.primary }]}>
            <Text style={styles.stripActionText}>View Log</Text>
            <Feather name="chevron-right" size={13} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Safety Preferences */}
        <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Safety Preferences</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.textMain }]}>Silent SOS Trigger</Text>
              <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Trigger SOS without sounding an audible alarm on your device</Text>
            </View>
            <Switch
              value={silentSOS}
              onValueChange={setSilentSOS}
              trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
            />
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  </View>
);
}); // end React.memo

const styles = StyleSheet.create({
  outerWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 120,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    overflow: 'visible',
  },
  sketchFixedHeader: {
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomWidth: 1,
  },
  sketchGrabArea: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleTouch: {
    width: 140,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
  },
  sketchFixedTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sketchHeaderLeftCol: {
    flex: 1,
    justifyContent: 'center',
  },
  sketchNameText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  sketchSinceAndMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bentoPlacesBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  bentoPlacesText: {
    fontSize: 11,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusPillText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerLogBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  sosQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.sos,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: Colors.sos,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  sosQuickBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  logHeroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 3,
  },
  logHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  logIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  activePillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logHeroDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  logButtonsGrid: {
    gap: 10,
  },
  fullLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  fullLogBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  subLogButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subLogBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  subLogBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  placesLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  placesLogBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  crashHeroCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  crashHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  crashIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crashTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  crashDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  crashStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusDotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  sosBanner: {
    backgroundColor: Colors.sos,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    shadowColor: Colors.sos,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  sosIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sosBannerDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    lineHeight: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  roadsideGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  roadsideCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  roadsideLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  roadsideSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  placesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addPlaceBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  placesListCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 22,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  placeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  placeRadius: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  emptyPlacesCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyPlacesIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyPlacesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyPlacesSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  addFirstPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  addFirstPlaceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  comingSoonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  comingSoonBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.3,
  },
  comingSoonMiniBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  comingSoonMiniBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.3,
  },
  roadsideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  cardSoonPill: {
    marginTop: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardSoonPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  underEventsLogStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginTop: 14,
    marginBottom: 22,
  },
  stripIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stripSub: {
    fontSize: 11,
    marginTop: 1,
  },
  stripActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stripActionText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
