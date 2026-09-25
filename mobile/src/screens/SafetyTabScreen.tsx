import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface SafetyTabScreenProps {
  places?: any[];
  onTriggerSOS: () => void;
  onOpenSavePlace: () => void;
  onDeletePlace?: (placeId: string) => void;
}

export const SafetyTabScreen: React.FC<SafetyTabScreenProps> = ({
  places = [],
  onTriggerSOS,
  onOpenSavePlace,
  onDeletePlace,
}) => {
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Math.max(insets.top + 8, 48);
  const [crashDetection, setCrashDetection] = useState(true);
  const [crimeAlerts, setCrimeAlerts] = useState(true);
  const [silentSOS, setSilentSOS] = useState(false);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View>
          <View style={styles.unlockedPill}>
            <Ionicons name="shield-checkmark" size={12} color="#10B981" />
            <Text style={styles.unlockedPillText}>SAFETY PROTECTION ACTIVE</Text>
          </View>
          <Text style={styles.headerTitle}>Safety Center</Text>
        </View>

        <TouchableOpacity onPress={onTriggerSOS} style={styles.sosQuickBtn}>
          <Text style={styles.sosQuickBtnText}>SOS</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Crash Detection Hero Card */}
        <View style={styles.crashHeroCard}>
          <View style={styles.crashHeroTop}>
            <View style={styles.crashIconWrap}>
              <MaterialIcons name="car-crash" size={26} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.crashTitle}>Automatic Crash Detection</Text>
              <Text style={styles.crashDesc}>
                Sensors continuously monitor high g-force vehicle impacts and sudden decelerations.
              </Text>
            </View>
            <Switch
              value={crashDetection}
              onValueChange={setCrashDetection}
              trackColor={{ true: Colors.primary, false: '#CBD5E1' }}
            />
          </View>
          <View style={styles.crashStatusRow}>
            <View style={styles.statusDotLive} />
            <Text style={styles.statusText}>Accelerometer & Gyroscope Live</Text>
          </View>
        </View>

        {/* SOS Emergency Dispatch Button */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onTriggerSOS}
          style={styles.sosBanner}
        >
          <View style={styles.sosIconCircle}>
            <Ionicons name="warning" size={28} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosBannerTitle}>Trigger Emergency SOS</Text>
            <Text style={styles.sosBannerDesc}>
              Broadcasts immediate location coordinates and critical alerts to all circle members.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* 24/7 Roadside Assistance simulation */}
        <Text style={styles.sectionTitle}>24/7 Roadside Assistance</Text>
        <View style={styles.roadsideGrid}>
          <TouchableOpacity
            style={styles.roadsideCard}
            onPress={() => Alert.alert('Towing Dispatch', 'Locating nearest certified flatbed tow truck to your GPS location...')}
          >
            <FontAwesome5 name="truck-pickup" size={20} color={Colors.primary} />
            <Text style={styles.roadsideLabel}>Towing</Text>
            <Text style={styles.roadsideSub}>Up to 50 miles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roadsideCard}
            onPress={() => Alert.alert('Jump Start Dispatch', 'Dispatching mobile service battery technician to your location...')}
          >
            <Ionicons name="flash" size={20} color="#D97706" />
            <Text style={styles.roadsideLabel}>Jump Start</Text>
            <Text style={styles.roadsideSub}>Battery boost</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roadsideCard}
            onPress={() => Alert.alert('Tire Change', 'Mobile technician dispatched for roadside tire replacement or inflation.')}
          >
            <MaterialIcons name="tire-repair" size={22} color="#059669" />
            <Text style={styles.roadsideLabel}>Tire Service</Text>
            <Text style={styles.roadsideSub}>Flat tire help</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roadsideCard}
            onPress={() => Alert.alert('Lockout Service', 'Certified locksmith dispatched to unlock your vehicle safely.')}
          >
            <Feather name="key" size={20} color="#7C3AED" />
            <Text style={styles.roadsideLabel}>Lockout</Text>
            <Text style={styles.roadsideSub}>Key rescue</Text>
          </TouchableOpacity>
        </View>

        {/* Unlimited Geofence Saved Places */}
        <View style={styles.placesHeader}>
          <Text style={styles.sectionTitle}>Unlimited Saved Places</Text>
          <TouchableOpacity onPress={onOpenSavePlace} style={styles.addPlaceBtn}>
            <Feather name="plus" size={14} color={Colors.primary} />
            <Text style={styles.addPlaceBtnText}>Add Place</Text>
          </TouchableOpacity>
        </View>

        {places.length === 0 ? (
          <View style={styles.emptyPlacesCard}>
            <View style={styles.emptyPlacesIconCircle}>
              <Ionicons name="location-outline" size={28} color="#94A3B8" />
            </View>
            <Text style={styles.emptyPlacesTitle}>No Saved Places Yet</Text>
            <Text style={styles.emptyPlacesSub}>
              Add locations like Home, Work, or School to get automated geofence arrival and departure alerts for your circle.
            </Text>
            <TouchableOpacity onPress={onOpenSavePlace} style={styles.addFirstPlaceBtn}>
              <Feather name="plus" size={15} color="#FFFFFF" />
              <Text style={styles.addFirstPlaceBtnText}>Add Your First Place</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.placesListCard}>
            {places.map((place, idx) => (
              <View
                key={place.id}
                style={[
                  styles.placeRow,
                  idx === places.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.placeIconCircle}>
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
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeRadius}>
                    Radius: {place.radius_meters || place.radius || 200}m • Arrival & Departure Alerts
                  </Text>
                </View>
                {onDeletePlace && (
                  <TouchableOpacity
                    onPress={() => onDeletePlace(place.id)}
                    style={{ padding: 8 }}
                  >
                    <Feather name="trash-2" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Crime & Safety Alerts Settings */}
        <Text style={styles.sectionTitle}>Safety Preferences</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Nearby Crime & Safety Reports</Text>
              <Text style={styles.settingDesc}>Display police incidents and crime alerts directly on your map</Text>
            </View>
            <Switch
              value={crimeAlerts}
              onValueChange={setCrimeAlerts}
              trackColor={{ true: Colors.primary, false: '#CBD5E1' }}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Silent SOS Trigger</Text>
              <Text style={styles.settingDesc}>Trigger SOS without sounding an audible alarm on your device</Text>
            </View>
            <Switch
              value={silentSOS}
              onValueChange={setSilentSOS}
              trackColor={{ true: Colors.primary, false: '#CBD5E1' }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

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
  unlockedPill: {
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
  unlockedPillText: {
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
  sosQuickBtn: {
    backgroundColor: Colors.sos,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 22,
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
});
