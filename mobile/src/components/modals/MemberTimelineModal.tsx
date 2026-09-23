import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { MemberData, getMemberInitials } from '../../models/Member';
import { MemberTimelineData, TimelineItem } from '../../models/Timeline';
import { authService } from '../../services/AuthService';
import { Colors } from '../../theme/colors';

interface MemberTimelineModalProps {
  visible: boolean;
  member: MemberData | null;
  circleId: string | null;
  backendUrl: string;
  onClose: () => void;
  onShowOnMap: (latitude: number, longitude: number) => void;
}

export const MemberTimelineModal: React.FC<MemberTimelineModalProps> = ({
  visible,
  member,
  circleId,
  backendUrl,
  onClose,
  onShowOnMap,
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState<0 | 1>(0); // 0 = Today, 1 = Yesterday
  const [timelineData, setTimelineData] = useState<MemberTimelineData | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.textMain} />
          </TouchableOpacity>

          <View style={styles.memberCardHeader}>
            <View style={styles.avatarWrap}>
              {member.avatarUrl ? (
                <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.memberInfo}>
              <Text style={styles.memberName} numberOfLines={1}>
                {member.fullName}
              </Text>
              <Text style={styles.memberSubtitle}>
                Daily Location Timeline • {member.batteryLevel}% Battery
              </Text>
            </View>
          </View>
        </View>

        {/* Day Selector Pill Tabs */}
        <View style={styles.daySelectorContainer}>
          <TouchableOpacity
            style={[styles.dayTab, selectedDayOffset === 0 && styles.dayTabActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedDayOffset(0)}
          >
            <Text
              style={[styles.dayTabText, selectedDayOffset === 0 && styles.dayTabTextActive]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dayTab, selectedDayOffset === 1 && styles.dayTabActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedDayOffset(1)}
          >
            <Text
              style={[styles.dayTabText, selectedDayOffset === 1 && styles.dayTabTextActive]}
            >
              Yesterday
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loaderText}>Loading timeline...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No history recorded for this day</Text>
                <Text style={styles.emptySubtitle}>
                  Location points and stops will automatically populate here as {member.fullName} travels throughout the day.
                </Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {items.map((item: TimelineItem, index: number) => {
                  const isLast = index === items.length - 1;
                  const isStay = item.type === 'stay';

                  return (
                    <View key={item.id || index} style={styles.timelineRow}>
                      {/* Left Track & Icon Node */}
                      <View style={styles.nodeColumn}>
                        <View
                          style={[
                            styles.nodeCircle,
                            isStay ? styles.nodeStay : styles.nodeTrip,
                          ]}
                        >
                          <MaterialIcons
                            name={isStay ? 'place' : 'directions-car'}
                            size={16}
                            color="#FFFFFF"
                          />
                        </View>
                        {!isLast && <View style={styles.trackLine} />}
                      </View>

                      {/* Right Card Content */}
                      <View style={styles.cardContent}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <View style={styles.durationBadge}>
                            <Feather name="clock" size={11} color={Colors.primary} />
                            <Text style={styles.durationText}>
                              {formatDuration(item.durationMinutes)}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.itemAddress} numberOfLines={2}>
                          {item.address}
                        </Text>

                        <View style={styles.itemBottomRow}>
                          <Text style={styles.itemTime}>
                            {formatTime(item.startTime)}
                            {item.endTime && item.endTime !== item.startTime
                              ? ` - ${formatTime(item.endTime)}`
                              : ''}
                          </Text>

                          {item.latitude && item.longitude && (
                            <TouchableOpacity
                              style={styles.viewOnMapBtn}
                              activeOpacity={0.7}
                              onPress={() => {
                                onClose();
                                onShowOnMap(item.latitude, item.longitude);
                              }}
                            >
                              <Feather name="map-pin" size={12} color={Colors.primary} />
                              <Text style={styles.viewOnMapText}>Show on Map</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  memberCardHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
  },
  memberSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  daySelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 4,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  dayTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dayTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  dayTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
    color: '#64748B',
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
    paddingTop: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  nodeColumn: {
    alignItems: 'center',
    width: 36,
    marginRight: 10,
  },
  nodeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeStay: {
    backgroundColor: '#10B981',
  },
  nodeTrip: {
    backgroundColor: '#3B82F6',
  },
  trackLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  cardContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
    flex: 1,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  itemAddress: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  viewOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewOnMapText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textMain,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
