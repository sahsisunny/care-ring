import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { CacheStats, CacheProgress, FrequentLocation } from '../../services/TileCacheService';

interface OfflineMapModalProps {
  visible: boolean;
  onClose: () => void;
  cacheStats: CacheStats | null;
  frequentLocations: FrequentLocation[];
  cacheProgress: CacheProgress | null;
  isCaching: boolean;
  onCacheAllFrequent: () => void;
  onCacheCurrentView: () => void;
  onClearCache: () => void;
}

export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({
  visible,
  onClose,
  cacheStats,
  frequentLocations,
  cacheProgress,
  isCaching,
  onCacheAllFrequent,
  onCacheCurrentView,
  onClearCache,
}) => {
  const [clearing, setClearing] = useState(false);

  const handleConfirmClear = () => {
    Alert.alert(
      'Clear Offline Map Cache?',
      'All cached raster tiles will be deleted from your device storage. You will need an active internet connection to reload map areas.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await onClearCache();
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const progressPercent = cacheProgress && cacheProgress.total > 0
    ? Math.min(100, Math.round((cacheProgress.current / cacheProgress.total) * 100))
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Feather name="database" size={20} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Offline Map Storage</Text>
                <Text style={styles.headerSubtitle}>Real-time Raster Tile Caching</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close offline map modal"
            >
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Storage Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroLabel}>DEVICE STORAGE USED</Text>
                  <Text style={styles.heroSizeText}>
                    {cacheStats ? cacheStats.formattedSize : '0 B'}
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.statusPillText}>
                    {cacheStats && cacheStats.count > 0 ? 'Offline Ready' : 'Empty'}
                  </Text>
                </View>
              </View>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Feather name="layers" size={15} color="#4F46E5" />
                  <Text style={styles.heroStatValue}>
                    {cacheStats ? `${cacheStats.count} tiles` : '0 tiles'}
                  </Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Ionicons name="location-outline" size={16} color="#10B981" />
                  <Text style={styles.heroStatValue}>
                    {frequentLocations.length} Frequent Spots
                  </Text>
                </View>
              </View>

              {/* Live Caching Progress Bar */}
              {isCaching && cacheProgress && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel} numberOfLines={1}>
                      {cacheProgress.locationName || 'Caching tiles...'}
                    </Text>
                    <Text style={styles.progressPercent}>{progressPercent}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                  </View>
                  <Text style={styles.progressSub}>
                    {cacheProgress.current} of {cacheProgress.total} tiles saved to device
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, isCaching && styles.disabledBtn]}
                activeOpacity={0.85}
                onPress={onCacheAllFrequent}
                disabled={isCaching}
              >
                {isCaching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="download-cloud" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.primaryActionBtnText}>
                  {isCaching ? 'Downloading Tiles...' : 'Pre-Cache Frequent Locations'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                activeOpacity={0.8}
                onPress={onCacheCurrentView}
                disabled={isCaching}
              >
                <Ionicons name="expand-outline" size={18} color={Colors.primary} />
                <Text style={styles.secondaryActionBtnText}>Cache Current Map View</Text>
              </TouchableOpacity>
            </View>

            {/* Frequently Used Locations List */}
            <View style={styles.sectionHeaderWrap}>
              <Text style={styles.sectionTitle}>FREQUENTLY USED LOCATIONS</Text>
              <Text style={styles.sectionBadge}>{frequentLocations.length}</Text>
            </View>

            <View style={styles.locationsCard}>
              {frequentLocations.length === 0 ? (
                <View style={styles.emptyLocationsWrap}>
                  <Ionicons name="map-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyLocationsTitle}>No locations detected yet</Text>
                  <Text style={styles.emptyLocationsSub}>
                    Acquire GPS or add places (Home, Work) to pre-cache tiles around your daily spots.
                  </Text>
                </View>
              ) : (
                frequentLocations.map((loc, idx) => (
                  <View
                    key={loc.id || `${loc.name}-${idx}`}
                    style={[
                      styles.locationRow,
                      idx === frequentLocations.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.locationIconWrap}>
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
                        size={17}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationName} numberOfLines={1}>
                        {loc.name}
                      </Text>
                      <Text style={styles.locationCoords}>
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} • Zooms 13-16
                      </Text>
                    </View>
                    <View style={styles.locBadge}>
                      <Text style={styles.locBadgeText}>Auto-Ready</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Explanation / Zero Signal Notice */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#0284C7" />
              <Text style={styles.infoBoxText}>
                Cached raster tiles are saved permanently to hardware IndexedDB storage. You can freely navigate, pan, and zoom around these areas even without mobile data or Wi-Fi.
              </Text>
            </View>

            {/* Clear Storage Row */}
            <View style={styles.clearCard}>
              <View style={styles.clearLeft}>
                <Feather name="trash-2" size={17} color="#EF4444" />
                <View>
                  <Text style={styles.clearTitle}>Free Up Storage</Text>
                  <Text style={styles.clearSub}>Remove all offline tile cache</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.clearConfirmBtn}
                activeOpacity={0.8}
                onPress={handleConfirmClear}
                disabled={clearing || isCaching}
              >
                {clearing ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={styles.clearConfirmText}>Clear</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 28 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 16,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    marginTop: 16,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroSizeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusPill: {
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
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  heroStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 10,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  progressContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    flex: 1,
    marginRight: 8,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818CF8',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  progressSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  actionButtonGroup: {
    gap: 10,
    marginBottom: 20,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: Colors.primary,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  locationsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  emptyLocationsWrap: {
    padding: 24,
    alignItems: 'center',
  },
  emptyLocationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyLocationsSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  locationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
    marginRight: 8,
  },
  locationName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  locationCoords: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  locBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  locBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 18,
  },
  clearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  clearLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  clearSub: {
    fontSize: 11,
    color: '#EF4444',
  },
  clearConfirmBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  clearConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
});
