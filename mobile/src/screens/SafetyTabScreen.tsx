import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors, getWebGlassCardStyle, getWebGlassTileStyle } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { PlaceCardSkeleton } from '../components/common/Skeleton';
import { MemberData } from '../models/Member';

interface SafetyTabScreenProps {
  places?: any[];
  placesLoading?: boolean;
  onTriggerSOS: () => void;
  onOpenSavePlace: () => void;
  onDeletePlace?: (placeId: string) => void;
  onViewTimeline?: (filter?: 'all' | 'places' | 'drives') => void;
  members?: MemberData[];
  currentUserId?: string;
}

export const SafetyTabScreen: React.FC<SafetyTabScreenProps> = React.memo(({
  places = [],
  placesLoading = false,
  onTriggerSOS,
  onOpenSavePlace,
  onDeletePlace,
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

  const [crashDetection, setCrashDetection] = useState(true);
  const [crimeAlerts, setCrimeAlerts] = useState(true);
  const [silentSOS, setSilentSOS] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop, backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
        <View>
          <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
            <Ionicons name="shield-checkmark" size={12} color={isDark ? '#34D399' : '#059669'} />
            <Text style={[styles.statusPillText, { color: isDark ? '#34D399' : '#059669' }]}>SAFETY PROTECTION ACTIVE</Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.textMain }]}>Safety Center</Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={onTriggerSOS} style={styles.sosQuickBtn} activeOpacity={0.85}>
            <Ionicons name="alert-circle" size={15} color="#FFFFFF" />
            <Text style={styles.sosQuickBtnText}>Help</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Crash Detection Hero Card */}
        <View
          style={[
            styles.crashHeroCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassCard,
          ]}
        >
          <View style={styles.crashHeroTop}>
            <View style={styles.crashIconWrap}>
              <MaterialIcons name="car-crash" size={26} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                <Text style={[styles.crashTitle, { color: colors.textMain }]}>Automatic Crash Detection</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>COMING SOON (v1.1)</Text>
                </View>
              </View>
              <Text style={[styles.crashDesc, { color: colors.textSecondary }]}>
                Sensors monitor high g-force vehicle impacts and sudden decelerations. Multi-sensor impact algorithm in active beta.
              </Text>
            </View>
            <Switch
              value={crashDetection}
              onValueChange={(val) => {
                setCrashDetection(val);
                if (val) {
                  Alert.alert(
                    'Crash Detection Beta',
                    'Automatic high-G crash impact dispatch algorithm is in active sensor testing and will be fully enabled in update v1.1.0.'
                  );
                }
              }}
              trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
            />
          </View>
          <View style={styles.crashStatusRow}>
            <View style={styles.statusDotLive} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Accelerometer & Gyroscope Live</Text>
          </View>
        </View>

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


        {/* 24/7 Roadside Assistance */}
        <View style={styles.roadsideHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textMain, marginTop: 0, marginBottom: 0 }]}>24/7 Roadside Assistance</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>COMING SOON (v1.2)</Text>
          </View>
        </View>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
          Nationwide on-demand towing, battery jump starts, tire service, and lockout network.
        </Text>
        <View style={styles.roadsideGrid}>
          <TouchableOpacity
            style={[styles.roadsideCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, opacity: 0.88 }, webGlassTile]}
            onPress={() => Alert.alert('Coming Soon', 'On-demand 24/7 Flatbed Towing partner network dispatch is in active integration for release v1.2.')}
          >
            <FontAwesome5 name="truck-pickup" size={20} color={colors.primary} />
            <Text style={[styles.roadsideLabel, { color: colors.textMain }]}>Towing</Text>
            <Text style={[styles.roadsideSub, { color: colors.textMuted }]}>Up to 50 miles</Text>
            <View style={styles.cardSoonPill}>
              <Text style={styles.cardSoonPillText}>v1.2</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roadsideCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, opacity: 0.88 }, webGlassTile]}
            onPress={() => Alert.alert('Coming Soon', 'Mobile battery technician jump start dispatch service is scheduled for release v1.2.')}
          >
            <Ionicons name="flash" size={20} color="#D97706" />
            <Text style={[styles.roadsideLabel, { color: colors.textMain }]}>Jump Start</Text>
            <Text style={[styles.roadsideSub, { color: colors.textMuted }]}>Battery boost</Text>
            <View style={styles.cardSoonPill}>
              <Text style={styles.cardSoonPillText}>v1.2</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roadsideCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, opacity: 0.88 }, webGlassTile]}
            onPress={() => Alert.alert('Coming Soon', 'On-demand roadside tire change and inflation service is scheduled for release v1.2.')}
          >
            <MaterialIcons name="tire-repair" size={22} color="#059669" />
            <Text style={[styles.roadsideLabel, { color: colors.textMain }]}>Tire Service</Text>
            <Text style={[styles.roadsideSub, { color: colors.textMuted }]}>Flat tire help</Text>
            <View style={styles.cardSoonPill}>
              <Text style={styles.cardSoonPillText}>v1.2</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roadsideCard, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, opacity: 0.88 }, webGlassTile]}
            onPress={() => Alert.alert('Coming Soon', 'Certified mobile locksmith lockout assistance is scheduled for release v1.2.')}
          >
            <Feather name="key" size={20} color="#7C3AED" />
            <Text style={[styles.roadsideLabel, { color: colors.textMain }]}>Lockout</Text>
            <Text style={[styles.roadsideSub, { color: colors.textMuted }]}>Key rescue</Text>
            <View style={styles.cardSoonPill}>
              <Text style={styles.cardSoonPillText}>v1.2</Text>
            </View>
          </TouchableOpacity>
        </View>

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

        {/* Crime & Safety Alerts Settings */}
        <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Safety Preferences</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={[styles.settingTitle, { color: colors.textMain }]}>Nearby Crime & Safety Reports</Text>
                <View style={styles.comingSoonMiniBadge}>
                  <Text style={styles.comingSoonMiniBadgeText}>COMING SOON</Text>
                </View>
              </View>
              <Text style={[styles.settingDesc, { color: colors.textMuted }]}>Display police incidents and crime alerts directly on your map</Text>
            </View>
            <Switch
              value={crimeAlerts}
              onValueChange={(val) => {
                setCrimeAlerts(val);
                if (val) {
                  Alert.alert('Coming Soon', 'Municipal crime and emergency incident data feeds are in development for release v1.2.');
                }
              }}
              trackColor={{ true: colors.primary, false: isDark ? '#334155' : '#CBD5E1' }}
            />
          </View>

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
    </View>
  );
}); // end React.memo

const styles = StyleSheet.create({
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
