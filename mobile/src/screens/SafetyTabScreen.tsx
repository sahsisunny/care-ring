import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { PlaceCardSkeleton } from '../components/common/Skeleton';
import { MemberData } from '../models/Member';

export interface SafetyTabScreenProps {
  places?: any[];
  placesLoading?: boolean;
  onTriggerSOS: () => void;
  onOpenSavePlace: () => void;
  onDeletePlace?: (placeId: string) => void;
  onEditPlace?: (place: any) => void;
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

export const SafetyTabScreen: React.FC<SafetyTabScreenProps> = React.memo(({
  places = [],
  placesLoading = false,
  onTriggerSOS,
  onOpenSavePlace,
  onDeletePlace,
  onEditPlace,
  onViewTimeline,
  members = [],
  currentUserId,
}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);
  const headerPaddingTop = statusBarHeight + 12;

  const { colors, isDark, isGlass } = useTheme();

  const webGlassTile = getWebGlassTileStyle(isDark, isGlass);
  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);

  const [silentSOS, setSilentSOS] = useState(false);

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
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.textMain }]}>Safety Center</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Emergency assistance, saved places & circle protection
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 120) },
        ]}
      >
        {/* Emergency SOS Hero Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onTriggerSOS}
          style={[styles.heroCard, { backgroundColor: colors.tileBg, borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5' }, webGlassTile]}
        >
          <View style={[styles.heroIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2', borderColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={28} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroCardTitle, { color: colors.textMain }]} numberOfLines={1}>
              Trigger Emergency SOS
            </Text>
            <Text style={[styles.heroCardSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
              Broadcast live GPS coordinates & sirens to circle
            </Text>
            <View style={styles.statusTag}>
              <Ionicons name="radio" size={11} color="#EF4444" />
              <Text style={[styles.statusTagText, { color: '#EF4444' }]}>INSTANT DISPATCH READY</Text>
            </View>
          </View>
          <View style={[styles.heroActionPill, { backgroundColor: '#EF4444' }]}>
            <Text style={[styles.heroActionPillText, { color: '#FFFFFF' }]}>Trigger</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Section 1: Unlimited Saved Places */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: colors.textMuted, marginTop: 0, marginBottom: 0 }]}>
            UNLIMITED SAVED PLACES
          </Text>
          <TouchableOpacity onPress={onOpenSavePlace} style={[styles.addPlaceBtn, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF' }]}>
            <Feather name="plus" size={12} color={colors.primary} />
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
          <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
            {places.map((place, idx) => {
              const catEmoji =
                place.category === 'home' ? '🏠'
                : place.category === 'work' ? '🏢'
                : place.category === 'school' ? '🏫'
                : place.category === 'gym' ? '🏋️'
                : '📍';
              const radiusVal = place.radius_meters || place.radiusMeters || 200;
              const radiusLabel = radiusVal >= 1000 ? `${(radiusVal / 1000).toFixed(1)} km` : `${radiusVal} m`;
              const addressLabel = place.address || place.name;
              return (
                <TouchableOpacity
                  key={place.id}
                  activeOpacity={0.8}
                  onPress={() => onEditPlace?.(place)}
                  style={[
                    styles.menuRow,
                    { borderBottomColor: colors.divider },
                    idx === places.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={[styles.menuEmojiCircle, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.18)' : '#EEF2FF' }]}>
                    <Text style={{ fontSize: 20 }}>{catEmoji}</Text>
                  </View>
                  <View style={styles.menuTextWrap}>
                    <Text style={[styles.menuTitle, { color: colors.textMain }]}>{place.name}</Text>
                    <Text style={[styles.menuSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {addressLabel !== place.name ? addressLabel + ' • ' : ''}{radiusLabel} radius
                    </Text>
                  </View>
                  <View style={styles.placeActions}>
                    {onEditPlace && (
                      <TouchableOpacity
                        onPress={() => onEditPlace(place)}
                        style={styles.placeActionBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="edit-2" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    {onDeletePlace && (
                      <TouchableOpacity
                        onPress={() => onDeletePlace(place.id)}
                        style={styles.placeActionBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Places & Geofence Activity Log Strip */}
        <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, marginTop: 2 }, webGlassTile]}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => onViewTimeline?.('places')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#ECFDF5' }]}>
              <Feather name="map-pin" size={18} color="#10B981" />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: colors.textMain }]}>Places & Geofence Activity Log</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Review arrivals, departures & dwell times at places
              </Text>
            </View>
            <View style={styles.badgeStatus}>
              <Text style={styles.badgeStatusText}>LOGS</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section 2: Crash Detection & Protection */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>CRASH DETECTION & PROTECTION</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
          <View style={[styles.menuRow, { borderBottomColor: colors.divider }]}>
            <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#EF4444" />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: colors.textMain }]}>Crash Detection (Beta - v1.1)</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Autonomous inertial impact & high-G deceleration monitoring
              </Text>
            </View>
            <View style={styles.badgeStatus}>
              <Text style={styles.badgeStatusText}>ACTIVE</Text>
            </View>
          </View>
          <View style={styles.crashStatusRow}>
            <View style={styles.statusDotLive} />
            <Text style={styles.statusText}>Continuous 24/7 background telemetry active</Text>
          </View>
        </View>

        {/* Section 3: 24/7 Roadside Assistance */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: colors.textMuted, marginTop: 0, marginBottom: 0 }]}>
            24/7 ROADSIDE ASSISTANCE
          </Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>INCLUDED</Text>
          </View>
        </View>

        <View style={styles.roadsideGrid}>
          <View style={[styles.roadsideCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
            <View style={[styles.roadsideIconCircle, { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF' }]}>
              <Ionicons name="car-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.roadsideLabel, { color: colors.textMain }]}>Towing</Text>
            <Text style={[styles.roadsideSub, { color: colors.textMuted }]}>Up to 5 miles</Text>
          </View>
          <View style={[styles.roadsideCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
            <View style={[styles.roadsideIconCircle, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
              <Ionicons name="flash-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.roadsideLabel, { color: colors.textMain }]}>Jumpstart</Text>
            <Text style={[styles.roadsideSub, { color: colors.textMuted }]}>Battery boost</Text>
          </View>
          <View style={[styles.roadsideCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
            <View style={[styles.roadsideIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
              <Ionicons name="key-outline" size={20} color="#10B981" />
            </View>
            <Text style={[styles.roadsideLabel, { color: colors.textMain }]}>Lockout</Text>
            <Text style={[styles.roadsideSub, { color: colors.textMuted }]}>Key retrieval</Text>
          </View>
        </View>

        {/* Section 4: Safety Preferences */}
        <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SAFETY PREFERENCES</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder }, webGlassTile]}>
          <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' }]}>
              <Ionicons name="notifications-off-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: colors.textMain }]}>Silent SOS Trigger</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>
                Send SOS alerts without sounding an audible device siren
              </Text>
            </View>
            <Switch
              value={silentSOS}
              onValueChange={setSilentSOS}
              trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}); // end React.memo

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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.sos,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: Colors.sos,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sosQuickBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 18,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  heroCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  heroActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  heroActionPillText: {
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 14,
  },
  addPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addPlaceBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
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
    marginRight: 4,
  },
  badgeStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  crashStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusDotLive: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
  },
  roadsideGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  roadsideCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  roadsideIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  roadsideLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 4,
  },
  roadsideSub: {
    fontSize: 10.5,
    marginTop: 2,
    textAlign: 'center',
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
  emptyPlacesCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyPlacesIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyPlacesTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyPlacesSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  addFirstPlaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
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
  menuEmojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
});
