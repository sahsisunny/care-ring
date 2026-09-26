import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { MemberData, getMemberInitials } from '../../models/Member';
import { MemberTimelineData, TimelineItem } from '../../models/Timeline';
import { authService } from '../../services/AuthService';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { MapView, MapViewRef } from '../MapView';

export interface TimelineRouteData {
  coords: [number, number][];
  stops: Array<{
    latitude: number;
    longitude: number;
    stopNumber: number;
    title: string;
    duration?: string;
    address?: string;
  }>;
}

interface MemberTimelineModalProps {
  visible: boolean;
  member: MemberData | null;
  circleId: string | null;
  backendUrl: string;
  onClose: () => void;
  onShowOnMap: (latitude: number, longitude: number) => void;
  onShowFullTimelineOnMap?: (data: TimelineRouteData) => void;
}

export const MemberTimelineModal: React.FC<MemberTimelineModalProps> = ({
  visible,
  member,
  circleId,
  backendUrl,
  onClose,
  onShowOnMap,
  onShowFullTimelineOnMap,
}) => {
  const { colors, isDark } = useTheme();
  const [selectedDayOffset, setSelectedDayOffset] = useState<0 | 1>(0); // 0 = Today, 1 = Yesterday
  const [timelineData, setTimelineData] = useState<MemberTimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const timelineMapRef = useRef<MapViewRef>(null);

  const getTargetDate = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (!visible || !member || !circleId) return;

    const loadTimeline = async () => {
      setLoading(true);
      const targetDate = getTargetDate(selectedDayOffset);
      const data = await authService.fetchMemberTimeline(
        backendUrl,
        circleId,
        member.id,
        targetDate
      );
      setTimelineData(data);
      setLoading(false);
    };

    loadTimeline();
  }, [visible, member?.id, circleId, selectedDayOffset, backendUrl]);

  // Sync timeline polyline and stop dots to the embedded mini-map
  useEffect(() => {
    if (!visible || !timelineData) return;

    const timer = setTimeout(() => {
      syncRouteToMap();
    }, 450);

    return () => clearTimeout(timer);
  }, [visible, timelineData]);

  const syncRouteToMap = () => {
    if (!timelineData || !timelineMapRef.current) return;
    const rawCoords = timelineData.rawCoordinates || [];
    const stops = timelineData.timeline
      .filter((t) => t.type === 'stay' && t.latitude && t.longitude)
      .map((t, idx) => ({
        latitude: t.latitude,
        longitude: t.longitude,
        stopNumber: t.stopNumber || idx + 1,
        title: t.title,
        duration: t.durationMinutes ? `${t.durationMinutes}m` : undefined,
        address: t.address,
      }));

    timelineMapRef.current.showTimelineRoute({
      coords: rawCoords,
      stops,
      color: '#4F46E5',
    });
  };

  const handleFocusStop = (item: TimelineItem) => {
    setSelectedItemId(item.id);
    if (item.latitude && item.longitude && timelineMapRef.current) {
      timelineMapRef.current.animateToPosition(item.latitude, item.longitude, 16);
    }
  };

  const handleFocusTrip = (item: TimelineItem) => {
    setSelectedItemId(item.id);
    if (item.coordinates && item.coordinates.length > 0 && timelineMapRef.current) {
      const midIdx = Math.floor(item.coordinates.length / 2);
      const midCoord = item.coordinates[midIdx];
      timelineMapRef.current.animateToPosition(midCoord[0], midCoord[1], 15);
    }
  };

  const handleOpenFullMap = () => {
    if (!timelineData) return;
    const rawCoords = timelineData.rawCoordinates || [];
    const stops = timelineData.timeline
      .filter((t) => t.type === 'stay' && t.latitude && t.longitude)
      .map((t, idx) => ({
        latitude: t.latitude,
        longitude: t.longitude,
        stopNumber: t.stopNumber || idx + 1,
        title: t.title,
        duration: t.durationMinutes ? `${t.durationMinutes}m` : undefined,
        address: t.address,
      }));

    if (onShowFullTimelineOnMap && (rawCoords.length > 0 || stops.length > 0)) {
      onShowFullTimelineOnMap({ coords: rawCoords, stops });
    } else if (stops.length > 0) {
      onClose();
      onShowOnMap(stops[0].latitude, stops[0].longitude);
    } else {
      onClose();
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  };

  if (!member) return null;

  const initials = getMemberInitials(member.fullName);
  const items = timelineData?.timeline || [];
  const totalDistance = timelineData?.totalDistanceKm || 0;
  const totalMoving = timelineData?.totalMovingMinutes || 0;
  const stopCount = timelineData?.stopCount ?? items.filter((i) => i.type === 'stay').length;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>

          <View style={styles.memberCardHeader}>
            <View style={styles.avatarWrap}>
              {member.avatarUrl ? (
                <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: colors.textMain }]} numberOfLines={1}>
                {member.fullName}
              </Text>
              <Text style={[styles.memberSubtitle, { color: colors.textMuted }]}>
                Member Daily Timeline • {member.batteryLevel ?? 100}% Battery
              </Text>
            </View>
          </View>

          {/* Action to view full screen map */}
          <TouchableOpacity
            style={[styles.fullMapActionBtn, { backgroundColor: colors.tileBg }]}
            activeOpacity={0.7}
            onPress={handleOpenFullMap}
          >
            <Feather name="maximize-2" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Day Selector Pill Tabs */}
        <View style={[styles.daySelectorContainer, { backgroundColor: colors.tileBg }]}>
          <TouchableOpacity
            style={[
              styles.dayTab,
              selectedDayOffset === 0 && [styles.dayTabActive, { backgroundColor: colors.card }],
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedDayOffset(0)}
          >
            <Text
              style={[
                styles.dayTabText,
                { color: selectedDayOffset === 0 ? colors.primary : colors.textMuted },
                selectedDayOffset === 0 && styles.dayTabTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dayTab,
              selectedDayOffset === 1 && [styles.dayTabActive, { backgroundColor: colors.card }],
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedDayOffset(1)}
          >
            <Text
              style={[
                styles.dayTabText,
                { color: selectedDayOffset === 1 ? colors.primary : colors.textMuted },
                selectedDayOffset === 1 && styles.dayTabTextActive,
              ]}
            >
              Yesterday
            </Text>
          </TouchableOpacity>
        </View>

        {/* Embedded Interactive Map Preview */}
        <View style={[styles.mapSectionWrapper, { borderColor: colors.cardBorder }]}>
          <View style={styles.mapContainer}>
            <MapView
              ref={timelineMapRef}
              currentUserId={member.id}
              members={[member]}
              myPosition={
                member.latitude && member.longitude
                  ? { latitude: member.latitude, longitude: member.longitude, heading: member.heading || 0 }
                  : null
              }
            />

            {/* Floating Map Re-center & Fit Controls */}
            <View style={styles.mapOverlayControls}>
              <TouchableOpacity
                style={[styles.mapOverlayBtn, { backgroundColor: colors.card }]}
                activeOpacity={0.8}
                onPress={syncRouteToMap}
              >
                <Feather name="crosshair" size={16} color={colors.primary} />
                <Text style={[styles.mapOverlayBtnText, { color: colors.textMain }]}>Fit Route</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mapOverlayBtn, { backgroundColor: colors.card }]}
                activeOpacity={0.8}
                onPress={handleOpenFullMap}
              >
                <Feather name="map" size={16} color={colors.primary} />
                <Text style={[styles.mapOverlayBtnText, { color: colors.textMain }]}>Full Screen</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Floating Stats Pill */}
            <View style={[styles.mapFloatingInfo, { backgroundColor: colors.card }]}>
              <View style={styles.mapInfoItem}>
                <Ionicons name="location" size={13} color="#4F46E5" />
                <Text style={[styles.mapInfoText, { color: colors.textMain }]}>
                  {stopCount} {stopCount === 1 ? 'Stop' : 'Stops'}
                </Text>
              </View>
              <View style={[styles.mapInfoDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.mapInfoItem}>
                <MaterialIcons name="directions-car" size={14} color="#059669" />
                <Text style={[styles.mapInfoText, { color: colors.textMain }]}>
                  {totalDistance.toFixed(1)} km
                </Text>
              </View>
              {totalMoving > 0 && (
                <>
                  <View style={[styles.mapInfoDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.mapInfoItem}>
                    <Feather name="clock" size={12} color="#D97706" />
                    <Text style={[styles.mapInfoText, { color: colors.textMain }]}>
                      {formatDuration(totalMoving)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textMuted }]}>
              Loading timeline & route...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textMain }]}>
                  No movements recorded for this day
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Stops and travel routes will automatically record every 5 minutes when stationary, and
                  continuously update as {member.fullName} moves.
                </Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {items.map((item: TimelineItem, index: number) => {
                  const isLast = index === items.length - 1;
                  const isStay = item.type === 'stay';
                  const isSelected = selectedItemId === item.id;

                  if (isStay) {
                    const stopNumber = item.stopNumber || 1;
                    return (
                      <View key={item.id || `stop-${index}`} style={styles.timelineRow}>
                        {/* Left Track & Numbered Stop Dot Node */}
                        <View style={styles.nodeColumn}>
                          <View
                            style={[
                              styles.numberedStopNode,
                              isLast
                                ? styles.nodeCurrentStop
                                : stopNumber === 1
                                ? styles.nodeFirstStop
                                : styles.nodeRegularStop,
                            ]}
                          >
                            <Text style={styles.stopNodeText}>{stopNumber}</Text>
                          </View>
                          {!isLast && (
                            <View style={[styles.trackLine, { backgroundColor: colors.divider }]} />
                          )}
                        </View>

                        {/* Right Card Content */}
                        <TouchableOpacity
                          style={[
                            styles.cardContent,
                            {
                              backgroundColor: colors.card,
                              borderColor: isSelected ? colors.primary : colors.cardBorder,
                              borderWidth: isSelected ? 2 : 1,
                            },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => handleFocusStop(item)}
                        >
                          <View style={styles.cardTopRow}>
                            <View style={styles.stopTitleWrap}>
                              <View style={[styles.stopNumberBadge, { backgroundColor: colors.tileBg }]}>
                                <Text style={[styles.stopNumberBadgeText, { color: colors.primary }]}>
                                  Stop #{stopNumber}
                                </Text>
                              </View>
                              <Text
                                style={[styles.itemTitle, { color: colors.textMain }]}
                                numberOfLines={1}
                              >
                                {item.title || 'Stop'}
                              </Text>
                            </View>

                            <View style={[styles.durationBadge, { backgroundColor: colors.tileBg }]}>
                              <Feather name="clock" size={11} color={colors.primary} />
                              <Text style={[styles.durationText, { color: colors.primary }]}>
                                {formatDuration(item.durationMinutes)}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={[styles.itemAddress, { color: colors.textSecondary }]}
                            numberOfLines={2}
                          >
                            {item.address}
                          </Text>

                          <View style={styles.itemBottomRow}>
                            <Text style={[styles.itemTime, { color: colors.textMuted }]}>
                              {formatTime(item.startTime)}
                              {item.endTime && item.endTime !== item.startTime
                                ? ` - ${formatTime(item.endTime)}`
                                : ''}
                            </Text>

                            <View style={styles.cardActions}>
                              {item.batteryLevel !== undefined && item.batteryLevel !== null && (
                                <View style={[styles.batteryPill, { backgroundColor: colors.tileBg }]}>
                                  <Ionicons
                                    name={item.batteryLevel < 20 ? 'battery-dead' : 'battery-charging'}
                                    size={12}
                                    color={item.batteryLevel < 20 ? '#EF4444' : '#10B981'}
                                  />
                                  <Text style={[styles.batteryPillText, { color: colors.textSecondary }]}>
                                    {item.batteryLevel}%
                                  </Text>
                                </View>
                              )}

                              <TouchableOpacity
                                style={[styles.focusOnMapBtn, { backgroundColor: colors.tileBg }]}
                                activeOpacity={0.7}
                                onPress={() => handleFocusStop(item)}
                              >
                                <Feather name="crosshair" size={12} color={colors.primary} />
                                <Text style={[styles.focusOnMapText, { color: colors.primary }]}>
                                  Locate
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  // Trip Item (driving or moving segment)
                  const distanceStr =
                    item.distanceKm !== undefined ? `${item.distanceKm.toFixed(1)} km` : '';
                  const topSpeedStr = item.topSpeed ? `Max ${Math.round(item.topSpeed)} km/h` : '';

                  return (
                    <View key={item.id || `trip-${index}`} style={styles.timelineRow}>
                      {/* Left Track & Trip Node */}
                      <View style={styles.nodeColumn}>
                        <View style={[styles.tripNodeCircle, { backgroundColor: colors.tileBg }]}>
                          <MaterialIcons name="directions-car" size={15} color="#4F46E5" />
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.tripTrackLine,
                              { borderColor: colors.primary, opacity: 0.5 },
                            ]}
                          />
                        )}
                      </View>

                      {/* Right Trip Card */}
                      <TouchableOpacity
                        style={[
                          styles.tripCardContent,
                          {
                            backgroundColor: colors.card,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => handleFocusTrip(item)}
                      >
                        <View style={styles.tripHeaderRow}>
                          <View style={styles.tripBadgeWrap}>
                            <Text style={[styles.tripTitle, { color: colors.textMain }]}>
                              {item.title || 'Drive'}
                            </Text>
                            {distanceStr ? (
                              <View style={[styles.tripStatBadge, { backgroundColor: '#EEF2FF' }]}>
                                <Text style={styles.tripStatText}>{distanceStr}</Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={[styles.durationBadge, { backgroundColor: colors.tileBg }]}>
                            <Feather name="clock" size={11} color="#6366F1" />
                            <Text style={[styles.durationText, { color: '#6366F1' }]}>
                              {formatDuration(item.durationMinutes)}
                            </Text>
                          </View>
                        </View>

                        {item.address ? (
                          <Text
                            style={[styles.tripRouteText, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {item.address}
                          </Text>
                        ) : null}

                        <View style={styles.tripBottomRow}>
                          <Text style={[styles.itemTime, { color: colors.textMuted }]}>
                            {formatTime(item.startTime)} - {formatTime(item.endTime)}
                          </Text>

                          {topSpeedStr ? (
                            <View style={styles.speedWrap}>
                              <Ionicons name="speedometer-outline" size={12} color={colors.textMuted} />
                              <Text style={[styles.speedText, { color: colors.textMuted }]}>
                                {topSpeedStr}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  memberCardHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800',
  },
  memberSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  fullMapActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  daySelectorContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 3,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 10,
  },
  dayTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  dayTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayTabTextActive: {
    fontWeight: '700',
  },
  mapSectionWrapper: {
    height: 250,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapOverlayControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  mapOverlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mapOverlayBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapFloatingInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  mapInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapInfoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapInfoDivider: {
    width: 1,
    height: 12,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
    marginTop: 12,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  timelineList: {
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  nodeColumn: {
    alignItems: 'center',
    width: 36,
    marginRight: 10,
  },
  numberedStopNode: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  nodeFirstStop: {
    backgroundColor: '#4F46E5',
  },
  nodeRegularStop: {
    backgroundColor: '#3B82F6',
  },
  nodeCurrentStop: {
    backgroundColor: '#10B981',
  },
  stopNodeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tripNodeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  trackLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  tripTrackLine: {
    width: 0,
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  cardContent: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stopTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopNumberBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stopNumberBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemAddress: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  batteryPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  focusOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  focusOnMapText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tripCardContent: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tripStatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tripStatText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
  },
  tripRouteText: {
    fontSize: 11,
    marginBottom: 6,
  },
  tripBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  speedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
export default MemberTimelineModal;
