import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  TouchableOpacity,
  Platform,
  Alert,
  AppState,
  BackHandler,
  ToastAndroid,
  PanResponder,
  Dimensions,
} from 'react-native';
import { navigationService } from '../services/NavigationService';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapView, MapViewRef, MapViewportInfo } from '../components/MapView';
import { TopFloatingHeader } from '../components/TopFloatingHeader';
import { DynamicMemberRadar } from '../components/DynamicMemberRadar';
import { BottomDraggableSheet } from '../components/BottomDraggableSheet';
import { BottomNavBar, BottomNavTab } from '../components/BottomNavBar';
import { CreateCircleModal } from '../components/modals/CreateCircleModal';
import { JoinCircleModal } from '../components/modals/JoinCircleModal';
import { InviteMemberModal } from '../components/modals/InviteMemberModal';
import { ManageCirclesModal } from '../components/modals/ManageCirclesModal';
import { CircleSettingsModal } from '../components/modals/CircleSettingsModal';
import { ProfilePhotoModal } from '../components/modals/ProfilePhotoModal';
import { AlertsInboxModal, AlertItem } from '../components/modals/AlertsInboxModal';
import { WeeklyDriveReportModal } from '../components/modals/WeeklyDriveReportModal';
import { SpeedingModal } from '../components/modals/SpeedingModal';
import { CreateBubbleModal } from '../components/modals/CreateBubbleModal';
import { SavePlaceModal } from '../components/modals/SavePlaceModal';
import { CheckInModal } from '../components/modals/CheckInModal';
import {
  TriggerSOSModal,
  IncomingSOSAlertModal,
} from '../components/modals/EmergencySOSModal';
import { GroupChatModal } from '../components/modals/GroupChatModal';
import { DirectChatModal } from '../components/modals/DirectChatModal';
import { MemberTimelineModal } from '../components/modals/MemberTimelineModal';
import { PermissionsModal } from '../components/modals/PermissionsModal';
import { MemberData, parseMember } from '../models/Member';
import { Circle } from '../models/Circle';
import { MapStyleConfig, MAP_STYLES, ALL_MAP_STYLES } from '../models/MapStyle';
import { SOSAlertData } from '../models/Telemetry';
import { ChatMessage, DirectChatMessage } from '../models/Chat';
import { authService } from '../services/AuthService';
import { WebSocketClient } from '../services/WebSocketClient';
import { AdaptiveLocationEngine } from '../services/AdaptiveLocationEngine';
import { MarkerInterpolator, LatLng } from '../services/MarkerInterpolator';
import { NicknameService } from '../services/NicknameService';
import { Colors, getWebGlassCardStyle, getWebGlassPillStyle } from '../theme/colors';
import { InAppPushBanner } from '../components/InAppPushBanner';
import { notificationService, InAppNotification } from '../services/NotificationService';
import { backgroundLocationService } from '../services/BackgroundLocationService';
import { AppThemeId, themeService } from '../theme/ThemeService';
import { useTheme } from '../theme/ThemeContext';

import { DrivingTabScreen } from './DrivingTabScreen';
import { SafetyTabScreen } from './SafetyTabScreen';
import { SettingsTabScreen } from './SettingsTabScreen';
import { FeaturesCatalogModal } from './FeaturesCatalogModal';
import {
  TileCacheService,
  CacheStats,
  CacheProgress,
  FrequentLocation,
  SmartCacheConfig,
} from '../services/TileCacheService';

interface MapScreenProps {
  currentUserId: string;
  currentUserName: string;
  backendWsUrl?: string;
  onSignOut: () => void;
  onServerChanged?: (newWsUrl: string) => void;
  initialTab?: BottomNavTab;
  hideBottomBar?: boolean;
  onTabBarHiddenChange?: (hidden: boolean) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const MapScreen: React.FC<MapScreenProps> = ({
  currentUserId,
  currentUserName,
  backendWsUrl = 'ws://127.0.0.1:4000',
  onSignOut,
  onServerChanged,
  initialTab = 'location',
  hideBottomBar = false,
  onTabBarHiddenChange,
}) => {
  const mapRef = useRef<MapViewRef>(null);

  // Tab Navigation State & History Stack
  const [activeNavTab, setActiveNavTab] = useState<BottomNavTab>(initialTab);
  const tabHistoryRef = useRef<BottomNavTab[]>([initialTab]);
  const [isSettingsSubView, setIsSettingsSubView] = useState(false);
  const isSettingsSubViewRef = useRef(false);
  const activeNavTabRef = useRef<BottomNavTab>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== activeNavTab) {
      setActiveNavTab(initialTab);
      activeNavTabRef.current = initialTab;
    }
  }, [initialTab]);
  const selectedMemberRef = useRef<MemberData | null>(null);
  const isSheetExpandedRef = useRef<boolean>(false);
  const hasOpenModalRef = useRef<boolean>(false);
  const lastBackPressRef = useRef<number>(0);

  // Profile & Theme State
  const { colors, isDark, isGlass, themeId, setTheme } = useTheme();

  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  const [displayName, setDisplayName] = useState(currentUserName);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(authService.getUserAvatar());
  const [activeMapStyle, setActiveMapStyle] = useState<MapStyleConfig>(MAP_STYLES.detailedOsm);

  // Circle State
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  // Members & Location State
  const [membersMap, setMembersMap] = useState<Record<string, MemberData>>({});
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);
  const [myPosition, setMyPosition] = useState<{
    latitude: number;
    longitude: number;
    heading: number;
  } | null>(null);
  const [mapViewport, setMapViewport] = useState<MapViewportInfo | null>(null);

  // Unread alerts count for inbox mail icon
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  const [placesList, setPlacesList] = useState<any[]>([]);
  const [alertsList, setAlertsList] = useState<AlertItem[]>([]);

  // Banner Notification State (for Geofence / Alerts)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;

  // Modals Visibility
  const [showManageCircles, setShowManageCircles] = useState(false);
  const [showCircleSettings, setShowCircleSettings] = useState(false);
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  const [showAlertsInbox, setShowAlertsInbox] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showSpeedingModal, setShowSpeedingModal] = useState(false);
  const [showCreateBubble, setShowCreateBubble] = useState(false);
  const [showSavePlace, setShowSavePlace] = useState(false);
  const [savePlaceMember, setSavePlaceMember] = useState<MemberData | null>(null);
  const [reportMember, setReportMember] = useState<MemberData | null>(null);
  const [bubbleMember, setBubbleMember] = useState<MemberData | null>(null);
  const [driverReportData, setDriverReportData] = useState<any>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFeaturesCatalog, setShowFeaturesCatalog] = useState(false);
  const [showTriggerSOS, setShowTriggerSOS] = useState(false);
  const [incomingSOS, setIncomingSOS] = useState<SOSAlertData | null>(null);

  // Offline Tile Cache State
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress | null>(null);
  const [smartConfig, setSmartConfig] = useState<SmartCacheConfig | null>(null);
  const [isCachingTiles, setIsCachingTiles] = useState(false);

  // Chat & Timeline State
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineInitialFilter, setTimelineInitialFilter] = useState<'all' | 'places' | 'drives'>('all');
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [sheetCollapseKey, setSheetCollapseKey] = useState(0);

  const handleCollapseMemberList = useCallback(() => {
    setIsSheetExpanded(false);
    setSheetCollapseKey((prev) => prev + 1);
  }, []);
  const [timelineMember, setTimelineMember] = useState<MemberData | null>(null);
  const [activeTimelineRouteUser, setActiveTimelineRouteUser] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showDirectChat, setShowDirectChat] = useState(false);
  const [directChatPeer, setDirectChatPeer] = useState<MemberData | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectChatMessage[]>([]);

  // Refs for services
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const locationEngineRef = useRef<AdaptiveLocationEngine | null>(null);
  const interpolatorRef = useRef<MarkerInterpolator | null>(null);
  const directChatPeerRef = useRef<MemberData | null>(null);
  const hasCenteredInitialRef = useRef(false);

  // Typing Indicators State
  const [groupTypingUsers, setGroupTypingUsers] = useState<{ [userId: string]: string }>({});
  const groupTypingTimersRef = useRef<{ [userId: string]: any }>({});
  const [isDirectPeerTyping, setIsDirectPeerTyping] = useState(false);
  const directTypingTimerRef = useRef<any>(null);
  const [favoriteMemberIds, setFavoriteMemberIds] = useState<string[]>([]);

  // Async & Skeleton Loading States
  const [isLoadingCircles, setIsLoadingCircles] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingDirectMessages, setIsLoadingDirectMessages] = useState(false);
  const [isLoadingDriverReport, setIsLoadingDriverReport] = useState(false);

  const showToast = useCallback((msg: string) => {
    setBannerMessage(msg);
    Animated.sequence([
      Animated.timing(bannerAnim, {
        toValue: Platform.OS === 'ios' ? 54 : Math.max(StatusBar.currentHeight || 0, 36) + 12,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3500),
      Animated.timing(bannerAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setBannerMessage(null));
  }, [bannerAnim]);

  // Load favorite members from AsyncStorage
  useEffect(() => {
    if (!currentUserId) return;
    const storageKey = `@carering_fav_members_${currentUserId}`;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setFavoriteMemberIds(parsed);
            }
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, [currentUserId]);

  const handleToggleFavorite = useCallback(
    (member: MemberData) => {
      setFavoriteMemberIds((prev) => {
        const isFav = prev.includes(member.id);
        const next = isFav ? prev.filter((id) => id !== member.id) : [...prev, member.id];
        AsyncStorage.setItem(
          `@carering_fav_members_${currentUserId}`,
          JSON.stringify(next)
        ).catch(() => {});

        const firstName = member.fullName.replace(/\s*\(You\)/gi, '').trim().split(' ')[0];
        if (!isFav) {
          showToast(`💖 ${firstName} added to Favorites (Tracking on Map Radar)`);
        } else {
          showToast(`🤍 ${firstName} removed from Favorites (List only)`);
        }
        return next;
      });
    },
    [currentUserId, showToast]
  );

  // Personal Nicknames (Private to device and circle)
  const [nicknames, setNicknames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentUserId && selectedCircle?.id) {
      NicknameService.getNicknames(currentUserId, selectedCircle.id).then((saved) => {
        setNicknames(saved || {});
      });
    } else {
      setNicknames({});
    }
  }, [currentUserId, selectedCircle?.id]);

  const handleUpdateNickname = useCallback(
    async (memberId: string, nickname: string) => {
      if (!currentUserId || !selectedCircle?.id) return;
      const updated = await NicknameService.setNickname(
        currentUserId,
        selectedCircle.id,
        memberId,
        nickname
      );
      setNicknames(updated);
      const targetMember = membersMap[memberId];
      const targetName = targetMember?.fullName || 'Member';
      if (nickname.trim()) {
        showToast(`Private nickname for ${targetName} set to "${nickname.trim()}"`);
      } else {
        showToast(`Reset nickname for ${targetName}`);
      }
    },
    [currentUserId, selectedCircle?.id, membersMap, showToast]
  );

  const handleUpdateMemberRole = useCallback(
    async (memberId: string, newRole: string) => {
      if (!selectedCircle?.id) return;
      const ok = await authService.updateMemberRole(
        backendWsUrl,
        selectedCircle.id,
        memberId,
        newRole,
        currentUserId
      );
      if (ok) {
        setMembersMap((prev) => {
          if (!prev[memberId]) return prev;
          return {
            ...prev,
            [memberId]: { ...prev[memberId], role: newRole },
          };
        });
        showToast(`Updated member role to ${newRole}`);
      } else {
        Alert.alert('Permission Denied', 'Could not update role. Only the circle owner can change roles.');
      }
    },
    [backendWsUrl, selectedCircle?.id, currentUserId, showToast]
  );

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (!selectedCircle?.id || !currentUserId) return;
      const res = await authService.removeMemberFromCircle(
        backendWsUrl,
        selectedCircle.id,
        memberId,
        currentUserId
      );
      if (res.success) {
        setMembersMap((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
        if (selectedMember?.id === memberId) {
          setSelectedMember(null);
        }
        showToast(res.message || 'Member removed from circle');
      } else {
        Alert.alert('Cannot Remove Member', res.error || 'Failed to remove member');
      }
    },
    [backendWsUrl, selectedCircle?.id, currentUserId, selectedMember?.id, showToast]
  );

  // Offline Tile Cache Statistics & Config Subscription
  useEffect(() => {
    TileCacheService.getCacheStats().then(setCacheStats);
    TileCacheService.getSmartConfig().then(setSmartConfig);
    const unsubStats = TileCacheService.subscribeStats(setCacheStats);
    const unsubConfig = TileCacheService.subscribeConfig(setSmartConfig);
    const unsubProgress = TileCacheService.subscribeProgress((p) => {
      setCacheProgress(p);
      if (p.isDone) {
        setIsCachingTiles(false);
      }
    });
    return () => {
      unsubStats();
      unsubConfig();
      unsubProgress();
    };
  }, []);

  // Ensure map recalculates tile layout when switching back to location tab
  useEffect(() => {
    if (activeNavTab === 'location') {
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeNavTab]);

  // Invalidate map layout when app returns to foreground from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        mapRef.current?.invalidateSize();
      }
    });
    return () => sub.remove();
  }, []);

  // 1. Marker animation is handled natively via Leaflet CSS transitions in WebView.
  // We avoid dispatching 60 React state updates per second to setMembersMap, which
  // previously caused severe UI thread blocking, stuttering, and frame drops across the app.
  useEffect(() => {
    return () => {
      interpolatorRef.current?.dispose();
    };
  }, []);

  // Request push notification & 24/7 background location permissions on mount
  useEffect(() => {
    notificationService.requestPermissions();

    if (Platform.OS !== 'web') {
      backgroundLocationService.checkPermissions().then((status) => {
        if (!status.allGranted) {
          if (backgroundLocationService.shouldAutoPromptPermissions()) {
            backgroundLocationService.markPermissionsAutoPrompted();
            const timer = setTimeout(() => {
              setShowPermissionsModal(true);
            }, 1200);
            return () => clearTimeout(timer);
          }
        } else {
          backgroundLocationService.startTracking();
        }
      });
    }
  }, []);

  // 2. Fetch Circle Members via REST
  const fetchCircleMembers = useCallback(
    async (circleId: string) => {
      setIsLoadingMembers(true);
      setIsLoadingPlaces(true);
      setIsLoadingAlerts(true);
      const httpBase = backendWsUrl
        .replace(/^ws:\/\//i, 'http://')
        .replace(/^wss:\/\//i, 'https://');
      const uri = `${httpBase}/api/circles/${circleId}/members?userId=${currentUserId}`;

      try {
        const res = await fetch(uri);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.members) ? data.members : [];
          const next: Record<string, MemberData> = {};
          list.forEach((mJson: any) => {
            const m = parseMember(mJson);
            if (m.id === currentUserId) {
              m.fullName = displayName.replace(/\s*\(You\)/gi, '').trim() || displayName;
              m.avatarUrl = currentUserAvatar || authService.getUserAvatar();
              m.isOnline = true; // Actively running the client app
              m.lastOnlineAt = new Date();
              if (m.latitude != null && m.longitude != null) {
                setMyPosition((prev) => prev || {
                  latitude: m.latitude,
                  longitude: m.longitude,
                  heading: m.heading,
                });
              }
            }
            next[m.id] = m;
            if (m.latitude != null && m.longitude != null) {
              interpolatorRef.current?.updateTarget({
                memberId: m.id,
                newPosition: { latitude: m.latitude, longitude: m.longitude },
                newHeading: m.heading,
              });
            }
          });
          setMembersMap(next);
        }

        // Fetch saved places (geofences) for this circle
        const circlePlaces = await authService.fetchPlaces(backendWsUrl, circleId);
        setPlacesList(circlePlaces);

        // Fetch real alerts for this circle
        const circleAlerts = await authService.fetchAlerts(backendWsUrl, circleId);
        setAlertsList(circleAlerts);
        setUnreadAlertCount(circleAlerts.length);
      } catch (err) {
        console.warn('[MapScreen] Error fetching circle members:', err);
      } finally {
        setIsLoadingMembers(false);
        setIsLoadingPlaces(false);
        setIsLoadingAlerts(false);
      }
    },
    [backendWsUrl, currentUserId, displayName, currentUserAvatar]
  );

  // 3. Connect WebSocket for Active Circle
  const initWebSocket = useCallback(
    (circleId: string) => {
      if (wsClientRef.current) {
        wsClientRef.current.dispose();
      }

      const client = new WebSocketClient({
        serverUrl: backendWsUrl,
        circleId,
        userId: currentUserId,
      });

      client.onTelemetryReceived = (data) => {
        if (data.userId === currentUserId) return; // Skip self echo

        setMembersMap((prev) => {
          const existing = prev[data.userId];
          const bubbleUntilDate = data.bubbleUntil ? new Date(data.bubbleUntil) : undefined;
          const isBubble = data.inBubble !== undefined
            ? Boolean(data.inBubble)
            : Boolean(bubbleUntilDate && bubbleUntilDate.getTime() > Date.now());

          // If member is newly discovered via socket telemetry, create member entry
          if (!existing) {
            const newMember: MemberData = {
              id: data.userId,
              fullName: data.userName || 'Family Member',
              avatarUrl: data.avatarUrl || null,
              latitude: data.latitude,
              longitude: data.longitude,
              speed: data.speed,
              heading: data.heading,
              batteryLevel: data.batteryLevel,
              isCharging: data.isCharging,
              resolvedAddress: data.resolvedAddress || null,
              stationarySince: data.stationarySince ? new Date(data.stationarySince) : undefined,
              isStationary: data.isStationary ?? (data.speed < 1.8),
              isMoving: (data.speed || 0) >= 1.8 && !data.isStationary,
              lastOnlineAt: new Date(),
              isOnline: true,
              role: 'member',
              inBubble: isBubble,
              bubbleRadius: data.bubbleRadius || 0,
              bubbleUntil: bubbleUntilDate,
              activityType: data.activity ? (data.activity.toLowerCase() as any) : undefined,
              activityConfidence: data.activityConfidence,
              activityStartedAt: data.activityStartedAt ? new Date(data.activityStartedAt) : undefined,
            };
            return { ...prev, [data.userId]: newMember };
          }

          const updated: MemberData = {
            ...existing,
            fullName: data.userName || existing.fullName,
            avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            heading: data.heading,
            batteryLevel: data.batteryLevel,
            isCharging: data.isCharging,
            resolvedAddress: data.resolvedAddress || existing.resolvedAddress || null,
            stationarySince: data.stationarySince ? new Date(data.stationarySince) : existing.stationarySince,
            isStationary: data.isStationary ?? (data.speed < 1.8),
            isMoving: (data.speed || 0) >= 1.8 && !data.isStationary,
            lastOnlineAt: new Date(),
            isOnline: true,
            inBubble: isBubble,
            bubbleRadius: data.bubbleRadius !== undefined ? data.bubbleRadius : existing.bubbleRadius,
            bubbleUntil: bubbleUntilDate !== undefined ? bubbleUntilDate : existing.bubbleUntil,
            activityType: data.activity !== undefined ? (data.activity.toLowerCase() as any) : existing.activityType,
            activityConfidence: data.activityConfidence !== undefined ? data.activityConfidence : existing.activityConfidence,
            activityStartedAt: data.activityStartedAt ? new Date(data.activityStartedAt) : existing.activityStartedAt,
          };
          return { ...prev, [data.userId]: updated };
        });

        // Tween to new position smoothly
        interpolatorRef.current?.updateTarget({
          memberId: data.userId,
          newPosition: { latitude: data.latitude, longitude: data.longitude },
          newHeading: data.heading,
        });

        // Speed & Movement Notification Check
        if (data.speed !== undefined && data.speed > 0) {
          const prefs = notificationService.getPreferences();
          if (data.speed >= prefs.speedThresholdKmH) {
            notificationService.notifySpeeding(data.userName || 'Member', data.speed, data.userId, data.avatarUrl);
          }
        }
      };

      client.onSpeedingAlert = (alert) => {
        if (alert.userId !== currentUserId) {
          notificationService.notifySpeeding(alert.userName, alert.speed, alert.userId);
        }
      };

      client.onMovementAlert = (alert) => {
        if (alert.userId !== currentUserId) {
          notificationService.notifyMovement(alert.userName, alert.speed, alert.userId);
        }
      };

      client.onSafetyAlert = (alert) => {
        if (alert.userId !== currentUserId) {
          showToast(`${alert.title}: ${alert.message}`);
          notificationService.notifySafetyAlert(alert.title, alert.message, alert.userId);
        }
        setMembersMap((prev) => {
          const existing = prev[alert.userId];
          if (!existing) return prev;
          const updated: MemberData = {
            ...existing,
            recentSafetyEvent: alert.message.replace(/^.* experienced /i, '').replace(/^Possible distraction detected for .*/i, 'Possible distraction'),
            safetySeverity: alert.severity,
          };
          return { ...prev, [alert.userId]: updated };
        });
      };

      client.onGeofenceAlert = (alert) => {
        const verb = alert.event === 'ENTER' ? 'arrived at' : 'left';
        showToast(`📍 ${alert.userName} has ${verb} ${alert.placeName}`);
        setUnreadAlertCount((c) => c + 1);
        setAlertsList((prev) => [
          {
            id: `geo_${Date.now()}`,
            title: alert.event === 'ENTER' ? `Arrival: ${alert.placeName}` : `Departure: ${alert.placeName}`,
            desc: `${alert.userName} has ${verb} ${alert.placeName}.`,
            timestamp: new Date().toISOString(),
            time: 'Just now',
            icon: alert.event === 'ENTER' ? 'log-in' : 'log-out',
            color: alert.event === 'ENTER' ? '#10B981' : '#6366F1',
          },
          ...prev,
        ]);
        if (alert.userId !== currentUserId) {
          notificationService.notifyGeofence(alert.userName, alert.placeName, alert.event, alert.userId);
        }
      };

      client.onSOSAlert = (sos) => {
        setIncomingSOS(sos);
        setUnreadAlertCount((c) => c + 1);
        setAlertsList((prev) => [
          {
            id: `sos_${Date.now()}`,
            title: '🚨 Emergency SOS Triggered',
            desc: `An SOS alert was triggered in your circle!`,
            timestamp: new Date().toISOString(),
            time: 'Just now',
            icon: 'warning',
            color: '#EF4444',
          },
          ...prev,
        ]);
        if (sos.userId !== currentUserId) {
          notificationService.notifySOS(sos.userName, sos.phone, sos.userId);
        }
      };

      client.onAddressResolved = (userId, address) => {
        setMembersMap((prev) => {
          if (!prev[userId]) return prev;
          return {
            ...prev,
            [userId]: { ...prev[userId], resolvedAddress: address },
          };
        });
      };

      client.onLiveReaction = (data) => {
        const emoji = data.emoji || '💖';
        const label = data.label || 'Reaction';
        const sender = data.senderName || 'Family member';
        showToast(`${sender} sent ${emoji} ${label}!`);

        const targetMember = membersMap[data.targetUserId] || membersMap[data.senderId];
        if (targetMember && targetMember.latitude && targetMember.longitude) {
          mapRef.current?.triggerReaction(targetMember.latitude, targetMember.longitude, emoji);
        } else if (myPosition) {
          mapRef.current?.triggerReaction(myPosition.latitude, myPosition.longitude, emoji);
        }
      };

      client.onCheckIn = (data) => {
        showToast(`📍 ${data.userName} checked in at ${data.address || 'Current Location'}!`);
        setUnreadAlertCount((c) => c + 1);
        setAlertsList((prev) => [
          {
            id: `chk_${Date.now()}`,
            title: `Check-in from ${data.userName}`,
            desc: `${data.userName} checked in at ${data.address || 'Current Location'}.`,
            timestamp: new Date().toISOString(),
            time: 'Just now',
            icon: 'checkmark-circle',
            color: Colors.primary,
          },
          ...prev,
        ]);
      };

      client.onChatMessage = (msg) => {
        setChatMessages((prev) => {
          const existingIndex = prev.findIndex(
            (m) =>
              m.id === msg.id ||
              (m.id.startsWith('temp-') &&
                m.content === msg.content &&
                m.userId === msg.userId)
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = msg;
            return updated;
          }
          return [...prev, msg];
        });
        if (msg.userId !== currentUserId) {
          notificationService.notifyChat(msg.userName, msg.content, msg.userId, msg.avatarUrl, false);
        }
      };

      client.onDirectMessage = (msg) => {
        const activePeerId = directChatPeerRef.current?.id;
        if (activePeerId && (msg.senderId === activePeerId || msg.recipientId === activePeerId)) {
          setDirectMessages((prev) => {
            const existingIndex = prev.findIndex(
              (m) =>
                m.id === msg.id ||
                (m.id.startsWith('temp-') &&
                  m.content === msg.content &&
                  m.senderId === msg.senderId)
            );
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = msg;
              return updated;
            }
            return [...prev, msg];
          });
        }
        if (msg.senderId !== currentUserId) {
          notificationService.notifyChat(msg.senderName, msg.content, msg.senderId, msg.senderAvatar, true);
        }
      };

      client.onTypingStatus = (event) => {
        if (event.userId === currentUserId) return;

        if (event.isTyping) {
          setGroupTypingUsers((prev) => ({ ...prev, [event.userId]: event.userName }));

          if (groupTypingTimersRef.current[event.userId]) {
            clearTimeout(groupTypingTimersRef.current[event.userId]);
          }
          groupTypingTimersRef.current[event.userId] = setTimeout(() => {
            setGroupTypingUsers((prev) => {
              const updated = { ...prev };
              delete updated[event.userId];
              return updated;
            });
            delete groupTypingTimersRef.current[event.userId];
          }, 4000);
        } else {
          if (groupTypingTimersRef.current[event.userId]) {
            clearTimeout(groupTypingTimersRef.current[event.userId]);
            delete groupTypingTimersRef.current[event.userId];
          }
          setGroupTypingUsers((prev) => {
            const updated = { ...prev };
            delete updated[event.userId];
            return updated;
          });
        }
      };

      client.onDirectTypingStatus = (event) => {
        const activePeerId = directChatPeerRef.current?.id;
        if (activePeerId && event.senderId === activePeerId) {
          if (event.isTyping) {
            setIsDirectPeerTyping(true);
            if (directTypingTimerRef.current) {
              clearTimeout(directTypingTimerRef.current);
            }
            directTypingTimerRef.current = setTimeout(() => {
              setIsDirectPeerTyping(false);
              directTypingTimerRef.current = null;
            }, 4000);
          } else {
            if (directTypingTimerRef.current) {
              clearTimeout(directTypingTimerRef.current);
              directTypingTimerRef.current = null;
            }
            setIsDirectPeerTyping(false);
          }
        }
      };

      // Real-time presence change event from server
      client.onPresenceChange = (presenceData) => {
        setMembersMap((prev) => {
          const target = prev[presenceData.userId];
          if (!target) return prev;
          return {
            ...prev,
            [presenceData.userId]: {
              ...target,
              isOnline: presenceData.isOnline,
              lastOnlineAt: presenceData.lastOnlineAt ? new Date(presenceData.lastOnlineAt) : new Date(),
            },
          };
        });
      };

      // Socket status change
      client.onStatusChange = (connected) => {
        if (connected) {
          setMembersMap((prev) => {
            const self = prev[currentUserId];
            if (!self) return prev;
            return {
              ...prev,
              [currentUserId]: {
                ...self,
                isOnline: true,
                lastOnlineAt: new Date(),
              },
            };
          });
        }
      };

      // 0ms Real-Time Member Joined via Socket
      client.onMemberJoined = (event) => {
        if (event.circleId !== circleId) return;
        const m = event.member;
        showToast(`🎉 ${m.fullName} joined the circle!`);
        notificationService.notifyMemberJoined(m.fullName, m.id);

        setAlertsList((prev) => [
          {
            id: `join_${Date.now()}`,
            title: 'New Member Joined',
            desc: `${m.fullName} has joined your family circle!`,
            timestamp: new Date().toISOString(),
            time: 'Just now',
            icon: 'person-add',
            color: Colors.primary,
          },
          ...prev,
        ]);
        setUnreadAlertCount((c) => c + 1);

        setMembersMap((prev) => {
          const newMember: MemberData = {
            id: m.id,
            fullName: m.fullName,
            phone: m.phone || null,
            avatarUrl: m.avatarUrl || null,
            role: m.role || 'member',
            batteryLevel: m.batteryLevel ?? 85,
            isCharging: !!m.isBatteryCharging,
            latitude: m.latitude || (myPosition?.latitude ? myPosition.latitude + 0.001 : 12.9095),
            longitude: m.longitude || (myPosition?.longitude ? myPosition.longitude + 0.001 : 77.6753),
            speed: 0,
            heading: 0,
            resolvedAddress: m.address || null,
            isStationary: true,
            isMoving: false,
            isOnline: true,
            lastOnlineAt: new Date(),
          };
          return { ...prev, [m.id]: newMember };
        });

        setCircles((prev) =>
          prev.map((c) => (c.id === circleId ? { ...c, memberCount: (c.memberCount || 1) + 1 } : c))
        );
      };

      // Real-Time Member Left via Socket
      client.onMemberLeft = (event) => {
        if (event.circleId !== circleId) return;
        showToast(`${event.userName || 'A member'} left the circle.`);
        setMembersMap((prev) => {
          const updated = { ...prev };
          delete updated[event.userId];
          return updated;
        });
        setCircles((prev) =>
          prev.map((c) =>
            c.id === circleId ? { ...c, memberCount: Math.max(1, (c.memberCount || 2) - 1) } : c
          )
        );
      };

      // Real-Time Circle Renamed via Socket
      client.onCircleUpdated = (event) => {
        if (event.circleId === circleId) {
          showToast(`Circle renamed to "${event.name}"`);
          setSelectedCircle((prev) => (prev ? { ...prev, name: event.name } : prev));
        }
        setCircles((prev) =>
          prev.map((c) => (c.id === event.circleId ? { ...c, name: event.name } : c))
        );
      };

      // Real-Time Circle Deleted via Socket
      client.onCircleDeleted = (event) => {
        if (event.circleId === circleId) {
          showToast('Circle was deleted by owner');
          refreshCircles();
        }
      };

      // Real-Time Place Created via Socket
      client.onPlaceCreated = (event) => {
        if (event.circleId === circleId) {
          const p = event.place;
          showToast(`📍 Place added: ${p.name}`);
          setPlacesList((prev) => {
            if (prev.some((item) => item.id === p.id)) return prev;
            return [p, ...prev];
          });
        }
      };

      // Real-Time Place Deleted via Socket
      client.onPlaceDeleted = (event) => {
        if (event.circleId === circleId) {
          setPlacesList((prev) => prev.filter((item) => item.id !== event.placeId));
        }
      };

      // Real-Time Privacy Bubble Status via Socket
      client.onBubbleStatusChanged = (event) => {
        if (event.circleId === circleId) {
          const isActive = Boolean(event.bubbleUntil && new Date(event.bubbleUntil).getTime() > Date.now());
          setMembersMap((prev) => {
            const target = prev[event.userId];
            if (!target) return prev;
            const isSelf = event.userId === currentUserId;
            const maskedAddress = isActive && !isSelf
              ? `Inside Privacy Bubble (~${Math.round((event.bubbleRadius || 2000) / 1000)}km zone)`
              : target.resolvedAddress;

            return {
              ...prev,
              [event.userId]: {
                ...target,
                inBubble: isActive,
                bubbleUntil: event.bubbleUntil ? new Date(event.bubbleUntil) : null,
                bubbleRadius: event.bubbleRadius || 0,
                resolvedAddress: maskedAddress,
              },
            };
          });
        }
      };

      // Real-Time Profile Updated via Socket
      client.onProfileUpdated = (event) => {
        setMembersMap((prev) => {
          const target = prev[event.userId];
          if (!target) return prev;
          return {
            ...prev,
            [event.userId]: {
              ...target,
              fullName: event.fullName !== undefined ? event.fullName : target.fullName,
              avatarUrl: event.avatarUrl !== undefined ? event.avatarUrl : target.avatarUrl,
              phone: event.phone !== undefined ? event.phone : target.phone,
            },
          };
        });
      };

      client.connect();
      wsClientRef.current = client;
    },
    // NOTE: intentionally omitting membersMap and myPosition from deps.
    // Those are accessed via closures inside callbacks (onLiveReaction, onMemberJoined)
    // and the values there are acceptable to be slightly stale — the tradeoff avoids
    // reconnecting the WebSocket on every GPS update or member telemetry tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backendWsUrl, currentUserId, showToast]
  );

  // 4a. One-shot initial GPS acquisition on mount so map locates user immediately
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!isMounted) return;
          const pos = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading || 0,
          };
          setMyPosition(pos);
          setMembersMap((prev) => {
            const self = prev[currentUserId];
            return {
              ...prev,
              [currentUserId]: {
                id: currentUserId,
                fullName: displayName.replace(/\s*\(You\)/gi, '').trim() || displayName,
                avatarUrl: currentUserAvatar || authService.getUserAvatar(),
                role: self?.role || 'owner',
                latitude: pos.latitude,
                longitude: pos.longitude,
                speed: (loc.coords.speed || 0) * 3.6,
                heading: pos.heading,
                batteryLevel: self?.batteryLevel ?? 100,
                isCharging: self?.isCharging ?? false,
                isStationary: (loc.coords.speed || 0) < 0.8,
                isMoving: (loc.coords.speed || 0) >= 0.8,
                lastOnlineAt: new Date(),
                isOnline: true,
                inBubble: self?.inBubble,
                bubbleRadius: self?.bubbleRadius,
                bubbleUntil: self?.bubbleUntil,
                joinedAt: self?.joinedAt,
                createdAt: self?.createdAt,
              },
            };
          });
          if (!hasCenteredInitialRef.current) {
            hasCenteredInitialRef.current = true;
            mapRef.current?.animateToPosition(pos.latitude, pos.longitude, 16);
          }
        }
      } catch (err) {
        console.warn('[MapScreen] Initial GPS acquisition:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, displayName, currentUserAvatar]);

  // 4b. Start Adaptive Location Engine (runs continuously, even without a circle)
  useEffect(() => {
    const engine = new AdaptiveLocationEngine({
      userId: currentUserId,
      circleId: selectedCircle?.id || '',
      userName: displayName,
      onTelemetry: (ping) => {
        if (selectedCircle) {
          const isWsActive = Boolean(wsClientRef.current?.isConnected);
          if (isWsActive) {
            wsClientRef.current?.sendTelemetry(ping);
          } else {
            authService.syncTelemetry(backendWsUrl, ping).catch(() => {});
          }
        }

        setMyPosition({
          latitude: ping.latitude,
          longitude: ping.longitude,
          heading: ping.heading,
        });

        setMembersMap((prev) => {
          const self = prev[currentUserId];
          const updatedSelf: MemberData = {
            id: currentUserId,
            fullName: displayName.replace(/\s*\(You\)/gi, '').trim() || displayName,
            avatarUrl: currentUserAvatar || authService.getUserAvatar(),
            role: self?.role || selectedCircle?.role || 'owner',
            latitude: ping.latitude,
            longitude: ping.longitude,
            speed: ping.speed,
            heading: ping.heading,
            batteryLevel: ping.batteryLevel,
            isCharging: ping.isCharging,
            resolvedAddress: self?.resolvedAddress,
            stationarySince: self?.stationarySince || new Date(),
            isStationary: ping.speed < 1.8,
            isMoving: (ping.speed || 0) >= 1.8,
            lastOnlineAt: new Date(),
            isOnline: true,
            inBubble: self?.inBubble,
            bubbleRadius: self?.bubbleRadius,
            bubbleUntil: self?.bubbleUntil,
            joinedAt: self?.joinedAt,
            createdAt: self?.createdAt,
            activityType: ping.activity ? (ping.activity.toLowerCase() as any) : self?.activityType,
            activityConfidence: ping.activityConfidence !== undefined ? ping.activityConfidence : self?.activityConfidence,
            activityStartedAt: ping.activityStartedAt ? new Date(ping.activityStartedAt) : self?.activityStartedAt,
          };
          return { ...prev, [currentUserId]: updatedSelf };
        });

        interpolatorRef.current?.updateTarget({
          memberId: currentUserId,
          newPosition: { latitude: ping.latitude, longitude: ping.longitude },
          newHeading: ping.heading,
        });

        if (!hasCenteredInitialRef.current) {
          hasCenteredInitialRef.current = true;
          mapRef.current?.animateToPosition(ping.latitude, ping.longitude, 16);
        }
      },
    });

    engine.start().catch((err) => {
      console.warn('[MapScreen] Location engine start error:', err);
    });

    locationEngineRef.current = engine;

    return () => {
      engine.dispose();
    };
  }, [currentUserId, displayName, currentUserAvatar, selectedCircle?.id, backendWsUrl]);

  // 5. Load Real Circles from Database for this Authenticated User
  const refreshCircles = useCallback(async () => {
    setIsLoadingCircles(true);
    try {
      const userCircles = await authService.fetchUserCircles(backendWsUrl);
      setCircles(userCircles);

      if (userCircles.length > 0) {
        const active = userCircles.find((c) => c.id === selectedCircle?.id) || userCircles[0];
        setSelectedCircle(active);
        authService.setActiveCircle(active);
        initWebSocket(active.id);
        fetchCircleMembers(active.id);
        authService.fetchCircleMessages(backendWsUrl, active.id).then(setChatMessages);
      } else {
        setSelectedCircle(null);
        authService.setActiveCircle(null);
        setChatMessages([]);
        wsClientRef.current?.dispose();
        // Preserve user's own location pin in membersMap
        setMembersMap((prev) => {
          const self = prev[currentUserId];
          if (self) {
            return { [currentUserId]: self };
          }
          if (myPosition) {
            return {
              [currentUserId]: {
                id: currentUserId,
                fullName: displayName.replace(/\s*\(You\)/gi, '').trim() || displayName,
                avatarUrl: currentUserAvatar || authService.getUserAvatar(),
                role: 'owner',
                latitude: myPosition.latitude,
                longitude: myPosition.longitude,
                speed: 0,
                heading: myPosition.heading || 0,
                batteryLevel: 100,
                isCharging: false,
                isStationary: true,
                isMoving: false,
                lastOnlineAt: new Date(),
                isOnline: true,
              },
            };
          }
          return {};
        });
      }
    } catch (err) {
      console.warn('[MapScreen] Error loading circles:', err);
    } finally {
      setIsLoadingCircles(false);
    }
  }, [backendWsUrl, fetchCircleMembers, initWebSocket, selectedCircle?.id, currentUserId, displayName, currentUserAvatar, myPosition]);

  const loadMessages = useCallback(async (circleId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await authService.fetchCircleMessages(backendWsUrl, circleId);
      setChatMessages(msgs);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [backendWsUrl]);

  const handleSendChatMessage = useCallback(async (
    content: string,
    messageType: 'text' | 'preset' | 'location' = 'text'
  ) => {
    if (!selectedCircle) return;
    const cleanName = displayName.replace(/\s*\(You\)/gi, '').trim() || displayName;
    const avatar = currentUserAvatar || authService.getUserAvatar();

    // 0ms Optimistic UI: display immediately in group chat!
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      circleId: selectedCircle.id,
      userId: currentUserId,
      userName: cleanName,
      avatarUrl: avatar,
      content,
      messageType,
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, optimisticMessage]);

    const sentViaWs = wsClientRef.current?.sendChatMessage(
      content,
      messageType,
      cleanName,
      avatar
    );

    if (!sentViaWs) {
      try {
        const saved = await authService.sendCircleMessage(
          backendWsUrl,
          selectedCircle.id,
          content,
          messageType
        );
        if (saved) {
          setChatMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== tempId);
            if (filtered.some((m) => m.id === saved.id)) return filtered;
            return [...filtered, saved];
          });
        }
      } catch (err) {
        console.warn('[MapScreen] Failed to send circle message via REST:', err);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCircle, backendWsUrl, currentUserId, displayName, currentUserAvatar]);

  const handleOpenDirectChat = useCallback(async (peer: MemberData) => {
    if (!selectedCircle) return;
    setDirectChatPeer(peer);
    directChatPeerRef.current = peer;
    setShowDirectChat(true);
    setIsLoadingDirectMessages(true);
    try {
      const msgs = await authService.fetchDirectMessages(
        backendWsUrl,
        selectedCircle.id,
        peer.id
      );
      setDirectMessages(msgs);
    } catch (err) {
      console.warn('[MapScreen] Error fetching direct messages:', err);
    } finally {
      setIsLoadingDirectMessages(false);
    }
  }, [selectedCircle, backendWsUrl]);

  const handleSendDirectMessage = async (
    content: string,
    messageType: 'text' | 'preset' | 'location' = 'text'
  ) => {
    if (!selectedCircle || !directChatPeer) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMessage: DirectChatMessage = {
      id: tempId,
      circleId: selectedCircle.id,
      senderId: currentUserId,
      senderName: displayName,
      recipientId: directChatPeer.id,
      content,
      messageType,
      createdAt: new Date().toISOString(),
    };

    setDirectMessages((prev) => [...prev, optimisticMessage]);

    const sentViaWs = wsClientRef.current?.sendDirectMessage(
      directChatPeer.id,
      content,
      messageType
    );

    if (!sentViaWs) {
      try {
        const saved = await authService.sendDirectMessage(
          backendWsUrl,
          selectedCircle.id,
          directChatPeer.id,
          content,
          messageType
        );
        if (saved) {
          setDirectMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = saved;
              return updated;
            }
            if (prev.some((m) => m.id === saved.id)) return prev;
            return [...prev, saved];
          });
        }
      } catch (err) {
        console.warn('[MapScreen] Failed to send direct message via REST fallback:', err);
      }
    }
  };

  const handleGroupTypingStatus = useCallback(
    (isTyping: boolean) => {
      wsClientRef.current?.sendTypingStatus(isTyping, displayName);
    },
    [displayName]
  );

  const handleDirectTypingStatus = useCallback(
    (isTyping: boolean) => {
      const activePeerId = directChatPeerRef.current?.id;
      if (activePeerId) {
        wsClientRef.current?.sendDirectTypingStatus(activePeerId, isTyping, displayName);
      }
    },
    [displayName]
  );

  useEffect(() => {
    refreshCircles();
    return () => {
      wsClientRef.current?.dispose();
    };
  }, [backendWsUrl]);

  // Handlers for Map Actions
  // From Member List: open profile and animate to position (centered in visible top-half map)
  const handleSelectMember = useCallback((member: MemberData) => {
    setIsSheetExpanded(false);
    setSelectedMember(member);
    setFocusedMemberId(member.id);
    if (member.latitude && member.longitude) {
      // Offset Leaflet camera downwards by 25% of screen height so user is positioned in dead-center of visible top half
      const halfScreenMapOffset = Math.round(SCREEN_HEIGHT * 0.25);
      mapRef.current?.animateToPosition(member.latitude, member.longitude, 16.5, halfScreenMapOffset);
    } else {
      showToast(`${member.fullName} has not reported a GPS fix yet.`);
    }
  }, [showToast]);

  // When user clicks on the dynamic user direction profile (DynamicMemberRadar beacon):
  const handleRadarMemberPress = useCallback((member: MemberData) => {
    handleSelectMember(member);
    const firstName = (member.fullName || 'Member').trim().split(' ')[0];
    showToast(`🎯 Centered on ${firstName}`);
  }, [handleSelectMember, showToast]);

  // From Map marker / Olympic cluster ring:
  // Open user profile in half screen and center on top half map directly
  const handleMapMemberPress = useCallback((member: MemberData) => {
    handleSelectMember(member);
  }, [handleSelectMember]);

  const handleCenterAll = useCallback(() => {
    const list = Object.values(membersMap).filter((m) => m.latitude && m.longitude);
    if (list.length > 0) {
      mapRef.current?.fitBounds(list);
    } else if (myPosition) {
      mapRef.current?.animateToPosition(myPosition.latitude, myPosition.longitude, 15);
    }
  }, [membersMap, myPosition]);

  // Stable callbacks for MapView props — prevents MapView from re-mounting on every render
  const handleMapDeselect = useCallback(() => {
    setSelectedMember(null);
    setFocusedMemberId(null);
  }, []);
  const handleCacheProgressUpdate = useCallback((p: CacheProgress) => {
    setCacheProgress(p);
    if (p.isDone) setIsCachingTiles(false);
  }, []);

  // Stable tab-switch handler so BottomNavBar never re-renders and records navigation history
  const handleNavTabSelect = useCallback((tab: BottomNavTab) => {
    if (tabHistoryRef.current[tabHistoryRef.current.length - 1] !== tab) {
      tabHistoryRef.current.push(tab);
      if (tabHistoryRef.current.length > 25) {
        tabHistoryRef.current = tabHistoryRef.current.slice(-15);
      }
    }
    setActiveNavTab(tab);
    if (tab !== 'location') {
      setSelectedMember(null);
    }
  }, []);

  const handleGoToMyLocation = async () => {
    if (myPosition) {
      mapRef.current?.animateToPosition(myPosition.latitude, myPosition.longitude, 16.5);
      showToast('📍 Centered on your location');
    } else {
      showToast('Acquiring device GPS...');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const pos = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading || 0,
          };
          setMyPosition(pos);
          setMembersMap((prev) => {
            const self = prev[currentUserId];
            return {
              ...prev,
              [currentUserId]: {
                id: currentUserId,
                fullName: displayName.replace(/\s*\(You\)/gi, '').trim() || displayName,
                avatarUrl: currentUserAvatar || authService.getUserAvatar(),
                role: 'owner',
                latitude: pos.latitude,
                longitude: pos.longitude,
                speed: (loc.coords.speed || 0) * 3.6,
                heading: pos.heading,
                batteryLevel: self?.batteryLevel ?? 100,
                isCharging: self?.isCharging ?? false,
                isStationary: (loc.coords.speed || 0) < 0.8,
                isMoving: (loc.coords.speed || 0) >= 0.8,
                lastOnlineAt: new Date(),
                isOnline: true,
                inBubble: self?.inBubble,
                bubbleRadius: self?.bubbleRadius,
                bubbleUntil: self?.bubbleUntil,
                joinedAt: self?.joinedAt,
                createdAt: self?.createdAt,
              },
            };
          });
          mapRef.current?.animateToPosition(pos.latitude, pos.longitude, 16.5);
          showToast('📍 Centered on your location');
        } else {
          showToast('Location permission is required to view your position');
        }
      } catch (err) {
        showToast('Unable to acquire GPS fix. Please ensure location is enabled.');
      }
    }
  };

  const handleTriggerSOS = useCallback(() => {
    setShowTriggerSOS(true);
  }, []);

  const handleConfirmSOS = useCallback(async () => {
    setShowTriggerSOS(false);
    // Burst privacy bubble immediately on emergency SOS for life safety
    setMembersMap((prev) => {
      const self = prev[currentUserId];
      if (!self) return prev;
      return {
        ...prev,
        [currentUserId]: {
          ...self,
          inBubble: false,
          bubbleRadius: 0,
          bubbleUntil: null,
        },
      };
    });
    mapRef.current?.clearBubble();

    const targetCircleId =
      selectedCircle?.id ||
      (circles.length > 0 ? circles[0].id : null) ||
      authService.getActiveCircleId();

    if (!targetCircleId) {
      showToast('Join or create a family group to broadcast emergency SOS alerts');
      return;
    }

    // High-resolution location resolution with progressive fallbacks
    let lat = myPosition?.latitude ?? membersMap[currentUserId]?.latitude;
    let lng = myPosition?.longitude ?? membersMap[currentUserId]?.longitude;

    if (!lat || !lng) {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          lat = last.coords.latitude;
          lng = last.coords.longitude;
        }
      } catch (_) {}
    }

    if (!lat || !lng) {
      lat = 12.9095;
      lng = 77.6753;
    }

    // 1. Instant WebSocket broadcast to active circle room
    wsClientRef.current?.sendSOS(lat, lng);

    // 2. Parallel HTTP REST dispatch (guarantees delivery even if WebSocket is disconnected/reconnecting)
    authService.triggerSOS(backendWsUrl, targetCircleId, currentUserId, lat, lng).catch(() => {});
    authService.deleteBubble(backendWsUrl, targetCircleId, currentUserId).catch(() => {});

    showToast('🚨 Emergency SOS broadcasted! Distress alert sent to family.');
  }, [currentUserId, selectedCircle, circles, myPosition, membersMap, backendWsUrl, showToast]);

  // CRUD Handlers for Circles
  const handleSelectCircle = (circle: Circle) => {
    // Clear stale members from the previous circle immediately so they
    // don't appear in the list while the new circle's members load.
    setMembersMap({});
    setSelectedMember(null);
    setFocusedMemberId(null);
    setSelectedCircle(circle);
    authService.setActiveCircle(circle);
    initWebSocket(circle.id);
    fetchCircleMembers(circle.id);
    loadMessages(circle.id);
    showToast(`Switched to "${circle.name}"`);
    setShowManageCircles(false);
  };

  const handleCreateCircle = async (name: string) => {
    const newCircle = await authService.createCircle({ backendUrl: backendWsUrl, name });
    await refreshCircles();
    handleSelectCircle(newCircle);
    showToast(`Created "${newCircle.name}" family group!`);
  };

  const handleJoinCircle = async (inviteCode: string) => {
    const joined = await authService.joinCircle({ backendUrl: backendWsUrl, inviteCode });
    await refreshCircles();
    handleSelectCircle(joined);
    showToast(`Joined "${joined.name}"!`);
  };

  const handleRenameCircle = async (circleId: string, newName: string) => {
    await authService.updateCircle({ backendUrl: backendWsUrl, circleId, name: newName });
    await refreshCircles();
    showToast('Family group renamed');
  };

  const handleLeaveCircle = async (circleId: string) => {
    await authService.leaveCircle({ backendUrl: backendWsUrl, circleId });
    await refreshCircles();
    showToast('Left family group');
  };

  const handleDeleteCircle = async (circleId: string) => {
    await authService.deleteCircle({ backendUrl: backendWsUrl, circleId });
    await refreshCircles();
    showToast('Family group deleted');
  };

  const handleUpdateName = async (newName: string) => {
    await authService.updateProfile({ backendUrl: backendWsUrl, fullName: newName });
    setDisplayName(newName);
    showToast('Profile name updated');
  };

  const handleSaveAvatar = async (newAvatarUrl: string | null) => {
    try {
      await authService.updateProfile({
        backendUrl: backendWsUrl,
        avatarUrl: newAvatarUrl || '',
      });
      setCurrentUserAvatar(newAvatarUrl);
      setMembersMap((prev) => {
        const self = prev[currentUserId];
        if (!self) return prev;
        return {
          ...prev,
          [currentUserId]: {
            ...self,
            avatarUrl: newAvatarUrl,
          },
        };
      });
      showToast(newAvatarUrl ? 'Profile photo updated!' : 'Clean initials avatar restored.');
    } catch (err) {
      console.warn('[MapScreen] Error saving avatar:', err);
    }
  };

  const handleSelectMapStyle = (style: MapStyleConfig) => {
    setActiveMapStyle(style);
    TileCacheService.setActiveStyleId(style.id);
    mapRef.current?.setMapStyle(style);
    TileCacheService.getCacheStats(style.id).then((stats) => {
      setCacheStats(stats);
    });
  };

  const handleCycleMapLayers = () => {
    const currentIndex = ALL_MAP_STYLES.findIndex((s) => s.id === activeMapStyle.id);
    const nextIndex = (currentIndex + 1) % ALL_MAP_STYLES.length;
    const nextStyle = ALL_MAP_STYLES[nextIndex];
    handleSelectMapStyle(nextStyle);
    showToast(`Map style: ${nextStyle.name}`);
  };

  // Safety & Interactive Actions
  const handleSendLiveReaction = useCallback(async (member: MemberData, emoji: string, label: string) => {
    if (member.latitude && member.longitude) {
      mapRef.current?.triggerReaction(member.latitude, member.longitude, emoji);
    }
    wsClientRef.current?.sendLiveReaction(member.id, emoji, label, displayName);
    if (selectedCircle) {
      authService.sendLiveReaction(backendWsUrl, selectedCircle.id, {
        targetUserId: member.id,
        emoji,
        label,
      });
    }
    showToast(`Sent ${emoji} ${label} to ${member.fullName}!`);
  }, [displayName, selectedCircle, backendWsUrl, showToast]);

  const handleCheckIn = useCallback(() => {
    setShowCheckInModal(true);
  }, []);

  const handleCloseCheckIn = useCallback(() => {
    setShowCheckInModal(false);
  }, []);

  const handleConfirmCheckIn = useCallback(async (place: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    const lat = place.latitude || myPosition?.latitude || 12.9095;
    const lng = place.longitude || myPosition?.longitude || 77.6753;
    const addr = place.address ? `${place.name} (${place.address})` : place.name;
    wsClientRef.current?.sendCheckIn(addr, lat, lng, displayName);
    if (selectedCircle) {
      authService.sendCheckIn(backendWsUrl, selectedCircle.id, {
        address: addr,
        latitude: lat,
        longitude: lng,
      });
    }
    showToast(`📍 Checked in at ${place.name}! Broadcasted to circle.`);
  }, [myPosition?.latitude, myPosition?.longitude, displayName, selectedCircle, backendWsUrl, showToast]);

  const handleCloseBubble = useCallback(() => {
    setShowCreateBubble(false);
    setBubbleMember(null);
    mapRef.current?.clearBubble();
  }, []);

  const handleBubbleRadiusChange = useCallback((radiusMeters: number) => {
    const target = bubbleMember || membersMap[currentUserId];
    const isSelf = !target || target.id === currentUserId;
    const lat = isSelf
      ? (myPosition?.latitude ?? target?.latitude ?? 12.9095)
      : (target?.latitude ?? myPosition?.latitude ?? 12.9095);
    const lng = isSelf
      ? (myPosition?.longitude ?? target?.longitude ?? 77.6753)
      : (target?.longitude ?? myPosition?.longitude ?? 77.6753);
    mapRef.current?.showBubble(lat, lng, radiusMeters, false);
  }, [myPosition, bubbleMember, membersMap, currentUserId]);

  const handleCloseSavePlace = useCallback(() => {
    setShowSavePlace(false);
  }, []);

  const handleConfirmBubble = async (radiusMeters: number, durationMinutes: number) => {
    const target = bubbleMember || membersMap[currentUserId];
    const isSelf = !target || target.id === currentUserId;
    const lat = isSelf
      ? (myPosition?.latitude ?? target?.latitude ?? 12.9095)
      : (target?.latitude ?? myPosition?.latitude ?? 12.9095);
    const lng = isSelf
      ? (myPosition?.longitude ?? target?.longitude ?? 77.6753)
      : (target?.longitude ?? myPosition?.longitude ?? 77.6753);
    const expiresAt = new Date(Date.now() + durationMinutes * 60000);

    // 1. Immediately update self member in state for 0ms reactivity
    setMembersMap((prev) => {
      const self = prev[currentUserId];
      if (!self) return prev;
      return {
        ...prev,
        [currentUserId]: {
          ...self,
          inBubble: true,
          bubbleRadius: radiusMeters,
          bubbleUntil: expiresAt,
        },
      };
    });

    // 2. Animate and show bubble on map
    mapRef.current?.animateToPosition(lat, lng, 13);
    mapRef.current?.showBubble(lat, lng, radiusMeters);

    // 3. Broadcast via WebSocket
    wsClientRef.current?.updateBubble(true, radiusMeters, durationMinutes);

    // 4. Persist via REST
    if (selectedCircle) {
      await authService.createBubble(backendWsUrl, selectedCircle.id, currentUserId, radiusMeters, durationMinutes);
    }
    const durText = durationMinutes >= 60
      ? `${(durationMinutes / 60).toFixed(durationMinutes % 60 === 0 ? 0 : 1)} hrs`
      : `${durationMinutes} mins`;
    showToast(`🫧 Privacy Bubble active for ${durText} (~${(radiusMeters / 1000).toFixed(1)} km)`);
  };

  const handlePopBubble = (member: MemberData) => {
    Alert.alert(
      'Burst Privacy Bubble?',
      'This will immediately reveal your exact location and speed to members in your circle.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Burst Bubble',
          style: 'destructive',
          onPress: async () => {
            // 1. Clear local state
            setMembersMap((prev) => {
              const self = prev[currentUserId];
              if (!self) return prev;
              return {
                ...prev,
                [currentUserId]: {
                  ...self,
                  inBubble: false,
                  bubbleRadius: 0,
                  bubbleUntil: null,
                },
              };
            });

            // 2. Clear map circles
            mapRef.current?.clearBubble();

            // 3. WebSocket burst broadcast
            wsClientRef.current?.updateBubble(false, 0, 0);

            // 4. REST delete
            if (selectedCircle) {
              await authService.deleteBubble(backendWsUrl, selectedCircle.id, currentUserId);
            }
            showToast('🫧 Privacy Bubble burst! Exact location restored.');
          },
        },
      ]
    );
  };

  const handleSavePlace = async (place: any) => {
    setShowSavePlace(false);
    if (!selectedCircle) return;
    try {
      const created = await authService.createPlace(backendWsUrl, selectedCircle.id, {
        name: place.name,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        radiusMeters: place.radiusMeters || 200,
        notifyOnEnter: true,
        notifyOnExit: true,
      });
      if (created) {
        setPlacesList((prev) => [created, ...prev]);
        showToast(`Place "${place.name}" saved! Geofence notifications active.`);
      }
    } catch (e) {
      console.warn('[MapScreen] Error saving place:', e);
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    if (!selectedCircle) return;
    const ok = await authService.deletePlace(backendWsUrl, selectedCircle.id, placeId);
    if (ok) {
      setPlacesList((prev) => prev.filter((p) => p.id !== placeId));
      showToast('Place deleted.');
    }
  };

  // Memoize so downstream components (BottomDraggableSheet, MapView, DrivingTabScreen)
  // only re-render when the actual map contents change, not on every unrelated state update.
  const membersList = useMemo(() => Object.values(membersMap), [membersMap]);
  const effectiveSelectedMember = useMemo(
    () => (selectedMember ? (membersMap[selectedMember.id] || selectedMember) : null),
    [selectedMember, membersMap]
  );

  const handleTriggerFeature = (actionId: string) => {
    switch (actionId) {
      case 'open_map':
        setActiveNavTab('location');
        break;
      case 'open_safety':
        setActiveNavTab('safety');
        break;
      case 'open_driver_report':
        setActiveNavTab('driving');
        break;
      case 'open_speeding':
        if (membersList.length > 0) {
          handleOpenWeeklyReport(membersList[0]);
          setShowSpeedingModal(true);
        }
        break;
      case 'trigger_sos':
        setShowTriggerSOS(true);
        break;
      case 'open_bubble':
        setBubbleMember(membersList.find((m) => m.id === currentUserId) || null);
        setShowCreateBubble(true);
        break;
      case 'open_places':
        setShowSavePlace(true);
        break;
      case 'open_timeline':
        if (membersList.length > 0) {
          setTimelineMember(membersList[0]);
          setShowTimelineModal(true);
        }
        break;
      case 'open_chat':
        setShowChatModal(true);
        if (selectedCircle) loadMessages(selectedCircle.id);
        break;
      case 'open_settings':
      case 'open_privacy':
      case 'offline_tiles':
        setActiveNavTab('settings');
        break;
      default:
        break;
    }
  };

  // Memoize frequent locations so SettingsModal doesn't recompute on every render
  // Get all frequently used locations: current location, saved places, and circle members
  const getFrequentLocations = useCallback((): FrequentLocation[] => {
    const list: FrequentLocation[] = [];

    // 1. User's current location
    if (myPosition && myPosition.latitude && myPosition.longitude) {
      list.push({
        id: 'my-location',
        name: 'My Current Location',
        latitude: myPosition.latitude,
        longitude: myPosition.longitude,
        category: 'current',
      });
    }

    // 2. Saved Places (Home, Work, School, etc.)
    placesList.forEach((place) => {
      if (place.latitude && place.longitude) {
        list.push({
          id: place.id || `place-${place.name}`,
          name: place.name || 'Saved Place',
          latitude: place.latitude,
          longitude: place.longitude,
          category: place.category || 'place',
        });
      }
    });

    // 3. Family Circle Members
    membersList.forEach((member) => {
      if (
        member.id !== currentUserId &&
        member.latitude &&
        member.longitude &&
        !list.some(
          (l) =>
            Math.abs(l.latitude - member.latitude) < 0.001 &&
            Math.abs(l.longitude - member.longitude) < 0.001
        )
      ) {
        list.push({
          id: `member-${member.id}`,
          name: `${member.fullName || 'Member'}'s Location`,
          latitude: member.latitude,
          longitude: member.longitude,
          category: 'member',
        });
      }
    });

    return list;
  }, [myPosition, placesList, membersList, currentUserId]);

  // Stable memoized result — avoids calling getFrequentLocations() inline in JSX
  const frequentLocations = useMemo(() => getFrequentLocations(), [getFrequentLocations]);

  // Smart Background Pre-Caching for Frequent Locations (Home, Work, GPS)
  const hasAutoCachedRef = useRef(false);
  useEffect(() => {
    TileCacheService.getSmartConfig().then((cfg) => {
      if (cfg.enabled && cfg.autoCacheFrequent && myPosition && placesList.length > 0) {
        if (!hasAutoCachedRef.current) {
          hasAutoCachedRef.current = true;
          const locs = getFrequentLocations();
          if (locs.length > 0) {
            mapRef.current?.cacheLocations(locs);
          }
        }
      }
    });
  }, [placesList, myPosition, getFrequentLocations]);

  const handleCacheAllFrequent = () => {
    const locations = getFrequentLocations();
    if (locations.length === 0) {
      Alert.alert(
        'No Locations Found',
        'Acquire your GPS location or save a place (like Home or Work) to cache offline map tiles.'
      );
      return;
    }
    setIsCachingTiles(true);
    mapRef.current?.cacheLocations(locations);
    showToast(`Caching ${locations.length} frequent family locations...`);
  };

  const handleCacheCurrentView = () => {
    setIsCachingTiles(true);
    mapRef.current?.cacheCurrentView();
    showToast('Downloading tiles for current map area...');
  };

  const handleClearTileCache = async (styleId?: string) => {
    const targetStyle = styleId || activeMapStyle.id;
    mapRef.current?.clearTileCache(targetStyle);
    await TileCacheService.clearCache(targetStyle);
    const fresh = await TileCacheService.getCacheStats(targetStyle);
    setCacheStats(fresh);
    showToast(`Offline raster cache for ${activeMapStyle.name} cleared.`);
  };

  const handleOpenWeeklyReport = useCallback(async (member: MemberData) => {
    setReportMember(member);
    setShowWeeklyReport(true);
    setIsLoadingDriverReport(true);
    try {
      if (selectedCircle) {
        const data = await authService.fetchDriverReport(backendWsUrl, selectedCircle.id, member.id);
        if (data) {
          setDriverReportData(data);
        }
      }
    } catch (err) {
      console.warn('[MapScreen] Error fetching driver report:', err);
    } finally {
      setIsLoadingDriverReport(false);
    }
  }, [selectedCircle, backendWsUrl]);

  // Memoized handlers for BottomDraggableSheet to prevent massive child re-renders
  const handleDeselectMember = useCallback(() => {
    setSelectedMember(null);
    setFocusedMemberId(null);
  }, []);

  const handleAddPerson = useCallback(() => {
    setShowInviteModal(true);
  }, []);

  const handleSavePlaceTapped = useCallback((m: MemberData) => {
    setSavePlaceMember(m);
    setShowSavePlace(true);
  }, []);

  const handleCreateBubbleTapped = useCallback((m: MemberData) => {
    setBubbleMember(m);
    setShowCreateBubble(true);
  }, []);

  const handleViewSpeeding = useCallback((m: MemberData) => {
    handleOpenWeeklyReport(m);
    setShowSpeedingModal(true);
  }, [handleOpenWeeklyReport]);

  const handleViewTimeline = useCallback((m: MemberData, filter: 'all' | 'places' | 'drives' = 'all') => {
    setTimelineMember(m);
    setTimelineInitialFilter(filter);
    setShowTimelineModal(true);
  }, []);

  const handleOpenChat = useCallback(() => {
    setShowChatModal(true);
    if (selectedCircle) loadMessages(selectedCircle.id);
  }, [selectedCircle, loadMessages]);

  // ─── Universal Navigation, Back Stack & Swipe Gesture Management ───────────
  const TABS: BottomNavTab[] = useMemo(() => ['location', 'driving', 'safety', 'settings'], []);

  const handleNextTab = useCallback(() => {
    const currentIndex = TABS.indexOf(activeNavTab);
    if (currentIndex >= 0 && currentIndex < TABS.length - 1) {
      handleNavTabSelect(TABS[currentIndex + 1]);
    }
  }, [activeNavTab, handleNavTabSelect, TABS]);

  const handlePreviousTab = useCallback(() => {
    const currentIndex = TABS.indexOf(activeNavTab);
    if (currentIndex > 0) {
      handleNavTabSelect(TABS[currentIndex - 1]);
    }
  }, [activeNavTab, handleNavTabSelect, TABS]);

  // Keep live refs updated for PanResponder & gestures
  useEffect(() => {
    activeNavTabRef.current = activeNavTab;
  }, [activeNavTab]);

  useEffect(() => {
    selectedMemberRef.current = effectiveSelectedMember;
  }, [effectiveSelectedMember]);

  useEffect(() => {
    isSheetExpandedRef.current = isSheetExpanded;
  }, [isSheetExpanded]);

  useEffect(() => {
    isSettingsSubViewRef.current = isSettingsSubView;
  }, [isSettingsSubView]);

  const hasAnyModalOpen = Boolean(
    incomingSOS ||
    showTriggerSOS ||
    showDirectChat ||
    showChatModal ||
    showTimelineModal ||
    showCheckInModal ||
    showCreateBubble ||
    showSavePlace ||
    showSpeedingModal ||
    showWeeklyReport ||
    showPermissionsModal ||
    showFeaturesCatalog ||
    showManageCircles ||
    showCircleSettings ||
    showProfilePhotoModal ||
    showAlertsInbox ||
    showCreateModal ||
    showJoinModal ||
    showInviteModal
  );

  const isAnySubViewOrModalOpen = Boolean(
    effectiveSelectedMember ||
    isSettingsSubView ||
    hasAnyModalOpen ||
    isSheetExpanded
  );

  useEffect(() => {
    onTabBarHiddenChange?.(isAnySubViewOrModalOpen);
  }, [isAnySubViewOrModalOpen, onTabBarHiddenChange]);

  useEffect(() => {
    hasOpenModalRef.current = hasAnyModalOpen;
  }, [hasAnyModalOpen]);

  // Priority 100: Active Modals Dismissal
  const handleModalsBack = useCallback((): boolean => {
    if (incomingSOS) {
      setIncomingSOS(null);
      return true;
    }
    if (showTriggerSOS) {
      setShowTriggerSOS(false);
      return true;
    }
    if (showDirectChat) {
      setShowDirectChat(false);
      return true;
    }
    if (showChatModal) {
      setShowChatModal(false);
      return true;
    }
    if (showTimelineModal) {
      setShowTimelineModal(false);
      return true;
    }
    if (showCheckInModal) {
      setShowCheckInModal(false);
      return true;
    }
    if (showCreateBubble) {
      setShowCreateBubble(false);
      return true;
    }
    if (showSavePlace) {
      setShowSavePlace(false);
      return true;
    }
    if (showSpeedingModal) {
      setShowSpeedingModal(false);
      return true;
    }
    if (showWeeklyReport) {
      setShowWeeklyReport(false);
      return true;
    }
    if (showPermissionsModal) {
      setShowPermissionsModal(false);
      return true;
    }
    if (showFeaturesCatalog) {
      setShowFeaturesCatalog(false);
      return true;
    }
    if (showManageCircles) {
      setShowManageCircles(false);
      return true;
    }
    if (showCircleSettings) {
      setShowCircleSettings(false);
      return true;
    }
    if (showProfilePhotoModal) {
      setShowProfilePhotoModal(false);
      return true;
    }
    if (showAlertsInbox) {
      setShowAlertsInbox(false);
      return true;
    }
    if (showCreateModal) {
      setShowCreateModal(false);
      return true;
    }
    if (showJoinModal) {
      setShowJoinModal(false);
      return true;
    }
    if (showInviteModal) {
      setShowInviteModal(false);
      return true;
    }
    return false;
  }, [
    incomingSOS,
    showTriggerSOS,
    showDirectChat,
    showChatModal,
    showTimelineModal,
    showCheckInModal,
    showCreateBubble,
    showSavePlace,
    showSpeedingModal,
    showWeeklyReport,
    showPermissionsModal,
    showFeaturesCatalog,
    showManageCircles,
    showCircleSettings,
    showProfilePhotoModal,
    showAlertsInbox,
    showCreateModal,
    showJoinModal,
    showInviteModal,
  ]);

  // Priority 50: Map Active States (Timeline route, selected member profile, expanded sheet)
  const handleMapStatesBack = useCallback((): boolean => {
    if (activeTimelineRouteUser) {
      setActiveTimelineRouteUser(null);
      return true;
    }
    if (effectiveSelectedMember) {
      handleMapDeselect();
      return true;
    }
    if (isSheetExpanded) {
      handleCollapseMemberList();
      return true;
    }
    return false;
  }, [activeTimelineRouteUser, effectiveSelectedMember, isSheetExpanded, handleMapDeselect, handleCollapseMemberList]);

  // Priority 20: Tab History Navigation
  const handleTabHistoryBack = useCallback((): boolean => {
    if (tabHistoryRef.current.length > 1) {
      tabHistoryRef.current.pop();
      const prevTab = tabHistoryRef.current[tabHistoryRef.current.length - 1] || 'location';
      setActiveNavTab(prevTab);
      return true;
    } else if (activeNavTab !== 'location') {
      setActiveNavTab('location');
      tabHistoryRef.current = ['location'];
      return true;
    }
    return false;
  }, [activeNavTab]);

  // Register Handlers with Central Navigation Service
  useEffect(() => {
    const unregModals = navigationService.registerBackHandler('map_modals', handleModalsBack, 100);
    const unregStates = navigationService.registerBackHandler('map_states', handleMapStatesBack, 50);
    const unregTabs = navigationService.registerBackHandler('map_tabs', handleTabHistoryBack, 20);

    return () => {
      unregModals();
      unregStates();
      unregTabs();
    };
  }, [handleModalsBack, handleMapStatesBack, handleTabHistoryBack]);

  // Root Screen Double-Back Exit Protection
  useEffect(() => {
    navigationService.setRootBackHandler(() => {
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      } else {
        showToast('Press back again to exit');
      }
      return true;
    });

    return () => {
      navigationService.setRootBackHandler(null);
    };
  }, [showToast]);

  // iOS & Mobile Edge Swipe Gestures (Edge Swipe Back & Edge Swipe Between Tabs)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          const { dx, dy, x0 } = gestureState;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          // Must be primarily a horizontal swipe; do not intercept vertical list/map scrolling
          if (absDx < 25 || absDx < absDy * 1.8) {
            return false;
          }

          // If a modal is open, do not intercept swipe gestures - modals handle their own touches
          if (hasOpenModalRef.current) {
            return false;
          }

          const screenWidth = Dimensions.get('window').width;
          const screenHeight = Dimensions.get('window').height;

          // Do not intercept gestures in the bottom nav region (bottom tab bar, action buttons)
          if (evt.nativeEvent.pageY > screenHeight - 95) {
            return false;
          }

          // Native mobile edge swipe zone (38px from the left/right screen edges)
          // Gestures in the center body of the screen (> 38px) should NEVER trigger back or tab navigation!
          const EDGE_SWIPE_WIDTH = 38;
          const isLeftEdge = x0 <= EDGE_SWIPE_WIDTH && dx > 32;
          const isRightEdge = x0 >= screenWidth - EDGE_SWIPE_WIDTH && dx < -32;

          // Left-edge swipe: standard native "Back" gesture
          // Triggered only from the left screen bezel / edge, matching native iOS & Android:
          // - Closes member profile
          // - Collapses expanded bottom sheet
          // - Exits Settings sub-view
          // - Or navigates to previous tab / screen
          if (isLeftEdge) {
            return true;
          }

          // Right-edge swipe: "Next tab" gesture
          // Only enabled on top-level tab views when no sub-views, profile, or expanded sheets are active
          if (isRightEdge && !selectedMemberRef.current && !isSettingsSubViewRef.current && !isSheetExpandedRef.current) {
            return true;
          }

          // Central screen area (> 38px from edges):
          // Never intercept! Protects all maps, carousels, member profiles, and scrollable lists from accidental triggers.
          return false;
        },
        onPanResponderRelease: (evt, gestureState) => {
          const { dx, dy, x0 } = gestureState;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          if (absDx < 38 || absDx < absDy * 1.5) {
            return;
          }

          const screenWidth = Dimensions.get('window').width;
          const EDGE_SWIPE_WIDTH = 38;

          if (dx > 38 && x0 <= EDGE_SWIPE_WIDTH) {
            // Swiped Left-to-Right from left edge: Back!
            const handled = navigationService.executeBack();
            if (!handled) {
              handlePreviousTab();
            }
          } else if (dx < -38 && x0 >= screenWidth - EDGE_SWIPE_WIDTH) {
            // Swiped Right-to-Left from right edge: Next tab!
            if (!selectedMemberRef.current && !isSettingsSubViewRef.current && !isSheetExpandedRef.current) {
              handleNextTab();
            }
          }
        },
      }),
    [handleNextTab, handlePreviousTab]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} {...panResponder.panHandlers}>
      <StatusBar barStyle={colors.statusBar === 'light' ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Floating Alert Toast Banner */}
      {bannerMessage && (
        <Animated.View
          style={[
            styles.alertBanner,
            {
              transform: [{ translateY: bannerAnim }],
              backgroundColor: isGlass
                ? isDark
                  ? 'rgba(15, 23, 42, 0.94)'
                  : 'rgba(255, 255, 255, 0.94)'
                : colors.card,
              borderColor: colors.cardBorder,
              borderWidth: 1.5,
            },
            isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
            webGlassCard,
          ]}
        >
          <Ionicons name="notifications" size={18} color={colors.primary} />
          <Text style={[styles.alertBannerText, { color: colors.textMain }]}>{bannerMessage}</Text>
        </Animated.View>
      )}

      {/* Main Tab Content Viewport */}
      <View style={styles.tabContentContainer}>
        {/* ======================================================== */}
        {/* TAB 1: LOCATION (Map, Floating Header, Stack, Sheet)     */}
        {/* ======================================================== */}
        <View
          style={[
            StyleSheet.absoluteFill,
            activeNavTab !== 'location' && { display: 'none' },
          ]}
          pointerEvents={activeNavTab === 'location' ? 'auto' : 'none'}
        >
          {/* Base Map (Only shows members when in a circle; solo users see iconic blue dot) */}
          <MapView
            ref={mapRef}
            currentUserId={currentUserId}
            isInCircle={Boolean(selectedCircle || circles.length > 0)}
            members={selectedCircle ? membersList : []}
            myPosition={myPosition}
            mapStyle={activeMapStyle}
            smartConfig={smartConfig || undefined}
            nicknames={nicknames}
            selectedMemberId={effectiveSelectedMember?.id || focusedMemberId || null}
            places={placesList}
            onMemberPress={handleMapMemberPress}
            onMapPress={handleMapDeselect}
            onViewportChange={setMapViewport}
            onCacheStatsUpdated={setCacheStats}
            onCacheProgress={handleCacheProgressUpdate}
          />


          {/* Active Member Timeline Route Floating Chip */}
          {activeTimelineRouteUser && (
            <View style={styles.activeTimelineRouteBanner}>
              <View style={styles.activeTimelineRouteBadge}>
                <Ionicons name="git-branch" size={13} color="#FFFFFF" />
              </View>
              <Text style={styles.activeTimelineRouteText} numberOfLines={1}>
                {activeTimelineRouteUser}'s Route
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setActiveTimelineRouteUser(null);
                  mapRef.current?.clearTimelineRoute();
                }}
                style={styles.activeTimelineRouteClose}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Active Privacy Bubble Floating Chip */}
          {membersMap[currentUserId]?.inBubble && (
            <View
              style={[
                styles.activeBubbleFloatingBanner,
                { top: activeTimelineRouteUser ? 150 : 110 },
              ]}
            >
              <View style={styles.activeBubbleFloatingBadge}>
                <Text style={{ fontSize: 13 }}>🫧</Text>
              </View>
              <Text style={styles.activeBubbleFloatingText} numberOfLines={1}>
                Bubble Active (~{Math.round((membersMap[currentUserId]?.bubbleRadius || 2000) / 1000)}km)
              </Text>
              <TouchableOpacity
                onPress={() => handlePopBubble(membersMap[currentUserId])}
                style={styles.activeBubbleFloatingBurstBtn}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="radio-button-off" size={12} color="#FFFFFF" />
                <Text style={styles.activeBubbleFloatingBurstText}>Burst</Text>
              </TouchableOpacity>
            </View>
          )}


          {/* Solo Floating Map Controls (Locate Me & Map Layers) */}
          {!selectedCircle && circles.length === 0 && (
            <View style={styles.soloMapControlsGroup} pointerEvents="box-none">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleGoToMyLocation}
                style={[
                  styles.circularSoloMapCtrlBtn,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                  webGlassPill,
                ]}
                accessibilityLabel="Locate my position on map"
              >
                <MaterialIcons name="my-location" size={22} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleCycleMapLayers}
                style={[
                  styles.circularSoloMapCtrlBtn,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                  webGlassPill,
                ]}
                accessibilityLabel="Change map layers"
              >
                <Ionicons name="layers" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Empty State Banner (if user is in 0 family groups) */}
          {!selectedCircle && circles.length === 0 && (
            <View
              style={[
                styles.noCircleCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
                webGlassCard,
              ]}
            >
              {/* Tap to locate my location on map pill */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleGoToMyLocation}
                style={[
                  styles.locateMyPositionPill,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#F0F9FF',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD',
                  },
                ]}
              >
                <View style={styles.locatePulseRing}>
                  <View style={styles.locatePulseCenter} />
                </View>
                <MaterialIcons name="my-location" size={17} color={colors.primary} />
                <Text style={[styles.locateMyPositionText, { color: colors.primary }]}>
                  {myPosition ? 'Locate My Position on Map' : 'Tap to Acquire GPS & Locate'}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </TouchableOpacity>

              <Text style={[styles.noCircleTitle, { color: colors.textMain }]}>No Family Group Yet</Text>
              <Text style={[styles.noCircleSubtitle, { color: colors.textSecondary }]}>
                You are currently viewing your own live position on the map. Create or join a family group to start sharing real-time locations.
              </Text>
              <View style={styles.noCircleActionRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowCreateModal(true)}
                  style={[styles.noCircleBtnPrimary, { backgroundColor: colors.primary }]}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                  <Text style={styles.noCircleBtnPrimaryText}>Create Family</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowJoinModal(true)}
                  style={[
                    styles.noCircleBtnSecondary,
                    {
                      backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : Colors.primaryLight,
                      borderColor: isDark ? 'rgba(99, 102, 241, 0.5)' : '#BFDBFE',
                    },
                  ]}
                >
                  <Ionicons name="key-outline" size={16} color={colors.primary} />
                  <Text style={[styles.noCircleBtnSecondaryText, { color: colors.primary }]}>Join with Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom Draggable Sheet */}
          {(selectedCircle || isLoadingCircles) && (
            <BottomDraggableSheet
              members={membersList}
              savedPlaces={placesList}
              isLoadingMembers={isLoadingMembers || isLoadingCircles}
              selectedMember={effectiveSelectedMember}
              currentUserId={currentUserId}
              myPosition={myPosition}
              favoriteMemberIds={favoriteMemberIds}
              onToggleFavorite={handleToggleFavorite}
              nicknames={nicknames}
              onUpdateNickname={handleUpdateNickname}
              onSelectMember={handleSelectMember}
              onDeselectMember={handleDeselectMember}
              onRefreshMember={() => {
                if (selectedCircle) {
                  fetchCircleMembers(selectedCircle.id);
                }
                showToast('Location refreshed');
              }}
              onCenterAll={handleCenterAll}
              onGoToMyLocation={handleGoToMyLocation}
              onToggleMapLayers={handleCycleMapLayers}
              onCheckInTapped={handleCheckIn}
              onSOSTapped={handleTriggerSOS}
              onAddPersonTapped={handleAddPerson}
              onSavePlaceTapped={handleSavePlaceTapped}
              onCreateBubbleTapped={handleCreateBubbleTapped}
              onPopBubble={handlePopBubble}
              onSendLiveReaction={handleSendLiveReaction}
              onViewWeeklyReport={handleOpenWeeklyReport}
              onViewSpeeding={handleViewSpeeding}
              onViewTimeline={handleViewTimeline}
              onOpenChat={handleOpenChat}
              onOpenDirectChat={handleOpenDirectChat}
              onExpandChange={setIsSheetExpanded}
              collapseTrigger={sheetCollapseKey}
            />
          )}

          {/* Top Floating Header - Rendered after sheet so back button and header pills are always on top of drawer */}
          <TopFloatingHeader
            selectedCircle={selectedCircle}
            selectedMember={effectiveSelectedMember}
            isSheetExpanded={isSheetExpanded}
            circleMemberCount={membersList.length}
            isLoading={isLoadingCircles}
            unreadAlertCount={unreadAlertCount}
            onCirclePress={() => setShowManageCircles(true)}
            onChatTapped={() => {
              setShowChatModal(true);
              if (selectedCircle) loadMessages(selectedCircle.id);
            }}
            onAlertsTapped={() => setShowAlertsInbox(true)}
            onBackFromMember={handleMapDeselect}
            onRefreshMember={() => {
              if (selectedCircle) {
                fetchCircleMembers(selectedCircle.id);
              }
              showToast('Location refreshed');
            }}
            onBackFromMemberList={handleCollapseMemberList}
            onRefreshMemberList={() => {
              if (selectedCircle) {
                fetchCircleMembers(selectedCircle.id);
              }
              showToast('Circle members refreshed');
            }}
          />

          {/* Dynamic Member Edge Radar (Shown on main map and half-screen profile details; only hidden when expanded to top) */}
          {selectedCircle && !isSheetExpanded && (
            <DynamicMemberRadar
              members={membersList}
              currentUserId={currentUserId}
              viewport={mapViewport}
              userLocation={myPosition}
              favoriteMemberIds={favoriteMemberIds}
              nicknames={nicknames}
              selectedMemberId={effectiveSelectedMember?.id || focusedMemberId || null}
              isSheetExpanded={isSheetExpanded}
              onSelectMember={handleRadarMemberPress}
            />
          )}
        </View>

      {/* ======================================================== */}
      {/* TAB 2: DRIVING (Driver Safety & Weekly Scores)            */}
      {/* ======================================================== */}
      {activeNavTab === 'driving' && (
        <DrivingTabScreen
          members={membersList}
          currentUserId={currentUserId}
          selectedCircleId={selectedCircle?.id}
          backendUrl={backendWsUrl}
          onReplayTripOnMap={(trip) => {
            setActiveNavTab('location');
            mapRef.current?.showRouteReplay(trip.routeCoordinates, '#4F46E5');
            showToast(`Replaying route: ${trip.startAddress || 'Drive'} ➔ ${trip.endAddress || 'Destination'}`);
          }}
          onViewTimeline={(member, filter) => {
            const target =
              member ||
              membersList.find((m) => m.id === currentUserId) ||
              membersList[0] || {
                id: currentUserId,
                fullName: displayName || 'You',
                batteryLevel: 100,
                isMoving: false,
              };
            handleViewTimeline(target as MemberData, filter || 'all');
          }}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 3: SAFETY (Crash Detection & Emergency SOS)           */}
      {/* ======================================================== */}
      {activeNavTab === 'safety' && (
        <SafetyTabScreen
          places={placesList}
          placesLoading={isLoadingPlaces}
          members={membersList}
          currentUserId={currentUserId}
          onTriggerSOS={handleTriggerSOS}
          onOpenSavePlace={() => {
            setSavePlaceMember(null);
            setShowSavePlace(true);
          }}
          onDeletePlace={handleDeletePlace}
          onViewTimeline={(filter) => {
            const selfOrFirst =
              membersList.find((m) => m.id === currentUserId) ||
              membersList[0] || {
                id: currentUserId,
                fullName: displayName || 'You',
                batteryLevel: 100,
                isMoving: false,
              };
            handleViewTimeline(selfOrFirst as MemberData, filter || 'all');
          }}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 4: SETTINGS & USER PREFERENCES                        */}
      {/* ======================================================== */}
      {activeNavTab === 'settings' && (
        <SettingsTabScreen
          currentUserId={currentUserId}
          currentUserName={displayName}
          currentUserEmail={authService.getSession()?.email}
          currentUserPhone={authService.getUserPhone()}
          currentUserAvatar={currentUserAvatar}
          activeMapStyle={activeMapStyle}
          backendUrl={backendWsUrl}
          circles={circles}
          selectedCircle={selectedCircle}
          activeThemeId={themeId}
          onUpdateName={handleUpdateName}
          onSaveAvatar={handleSaveAvatar}
          onSelectMapStyle={handleSelectMapStyle}
          onSelectTheme={(id) => setTheme(id)}
          onSelectCircle={(c) => handleSelectCircle(c)}
          onCreateCircle={() => setShowCreateModal(true)}
          onJoinCircle={() => setShowJoinModal(true)}
          onInviteMembers={() => setShowInviteModal(true)}
          onRenameCircle={(newName) => selectedCircle && handleRenameCircle(selectedCircle.id, newName)}
          onLeaveCircle={() => selectedCircle && handleLeaveCircle(selectedCircle.id)}
          onOpenCircleSettings={() => setShowCircleSettings(true)}
          onOpenFeaturesCatalog={() => setShowFeaturesCatalog(true)}
          onRequestPermissions={() => setShowPermissionsModal(true)}
          cacheStats={cacheStats}
          frequentLocations={frequentLocations}
          cacheProgress={cacheProgress}
          isCaching={isCachingTiles}
          onCacheAllFrequent={handleCacheAllFrequent}
          onCacheCurrentView={handleCacheCurrentView}
          onClearCache={handleClearTileCache}
          onTriggerFeature={handleTriggerFeature}
          onSignOut={onSignOut}
          onServerChanged={onServerChanged}
          onSubViewChange={setIsSettingsSubView}
        />
      )}
      </View>

      {/* Permanent Bottom Nav Bar (Location, Driving, Safety, Membership) */}
      {!hideBottomBar && !isAnySubViewOrModalOpen && (
        <BottomNavBar
          activeTab={activeNavTab}
          onSelectTab={handleNavTabSelect}
        />
      )}

      {/* ======================================================== */}
      {/* ALL MODALS & DIALOGS                                     */}
      {/* ======================================================== */}

      {/* Circle Settings */}
      <CircleSettingsModal
        visible={showCircleSettings}
        circle={selectedCircle}
        currentUserId={currentUserId}
        members={membersList}
        isLoadingMembers={isLoadingMembers}
        nicknames={nicknames}
        places={placesList}
        currentLocation={myPosition}
        mapStyle={activeMapStyle}
        onClose={() => setShowCircleSettings(false)}
        onRenameCircle={(newName) => selectedCircle && handleRenameCircle(selectedCircle.id, newName)}
        onAddPeople={() => {
          setShowCircleSettings(false);
          setShowInviteModal(true);
        }}
        onLeaveCircle={() => {
          setShowCircleSettings(false);
          if (selectedCircle) handleLeaveCircle(selectedCircle.id);
        }}
        onEditProfilePhoto={() => {
          setShowProfilePhotoModal(true);
        }}
        onUpdateNickname={handleUpdateNickname}
        onUpdateMemberRole={handleUpdateMemberRole}
        onRemoveMember={handleRemoveMember}
        onAddPlace={handleSavePlace}
        onDeletePlace={handleDeletePlace}
      />

      {/* Profile Photo Modal (Custom Upload / Camera Roll or Optional Initials) */}
      <ProfilePhotoModal
        visible={showProfilePhotoModal}
        currentName={displayName}
        currentAvatarUrl={currentUserAvatar}
        onClose={() => setShowProfilePhotoModal(false)}
        onSaveAvatar={handleSaveAvatar}
      />

      {/* Alerts Inbox Modal (Real circle events, geofence, SOS, check-in) */}
      <AlertsInboxModal
        visible={showAlertsInbox}
        circleName={selectedCircle?.name || 'Your Circle'}
        alerts={alertsList}
        loading={isLoadingAlerts}
        onClose={() => {
          setShowAlertsInbox(false);
          setUnreadAlertCount(0);
        }}
        onViewReport={() => {
          setShowAlertsInbox(false);
          if (membersList.length > 0) {
            handleOpenWeeklyReport(membersList[0]);
          }
        }}
      />

      {/* Weekly Drive Report Modal */}
      <WeeklyDriveReportModal
        visible={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
        memberName={reportMember?.fullName || displayName}
        reportData={driverReportData}
        loading={isLoadingDriverReport}
        onReplayTrip={(trip) => {
          setShowWeeklyReport(false);
          setActiveNavTab('location');
          mapRef.current?.showRouteReplay(trip.routeCoordinates, '#4F46E5');
          showToast(`Replaying drive route on map`);
        }}
      />

      {/* Speeding Log Modal */}
      <SpeedingModal
        visible={showSpeedingModal}
        onClose={() => setShowSpeedingModal(false)}
        speedingData={driverReportData?.speeding}
        onViewLog={() => {
          const target =
            effectiveSelectedMember ||
            membersList.find((m) => m.id === currentUserId) ||
            membersList[0];
          if (target) {
            handleViewTimeline(target as MemberData, 'drives');
          }
        }}
      />

      {/* Check In Modal */}
      <CheckInModal
        visible={showCheckInModal}
        onClose={handleCloseCheckIn}
        myPosition={myPosition}
        savedPlaces={placesList}
        onConfirmCheckIn={handleConfirmCheckIn}
      />

      {/* Create Privacy Bubble Modal with Real-time Map Slider Preview */}
      <CreateBubbleModal
        visible={showCreateBubble}
        onClose={handleCloseBubble}
        onRadiusChange={handleBubbleRadiusChange}
        onConfirmBubble={handleConfirmBubble}
        currentUserId={currentUserId}
        targetMember={bubbleMember || membersList.find((m) => m.id === currentUserId) || null}
        myPosition={myPosition}
        mapStyle={activeMapStyle}
      />

      {/* Save Place Geofence Modal */}
      <SavePlaceModal
        visible={showSavePlace}
        onClose={handleCloseSavePlace}
        initialAddress={savePlaceMember?.resolvedAddress || ''}
        latitude={savePlaceMember?.latitude || myPosition?.latitude || 12.9095}
        longitude={savePlaceMember?.longitude || myPosition?.longitude || 77.6753}
        myPosition={myPosition}
        currentUserId={currentUserId}
        mapStyle={activeMapStyle}
        onSavePlace={handleSavePlace}
      />

      {/* Manage Circles Modal */}
      <ManageCirclesModal
        visible={showManageCircles}
        circles={circles}
        isLoadingCircles={isLoadingCircles}
        selectedCircle={selectedCircle}
        currentUserId={currentUserId}
        onClose={() => setShowManageCircles(false)}
        onSelectCircle={handleSelectCircle}
        onCreateNewPress={() => setShowCreateModal(true)}
        onJoinPress={() => setShowJoinModal(true)}
        onRenameCircle={handleRenameCircle}
        onLeaveCircle={handleLeaveCircle}
        onDeleteCircle={handleDeleteCircle}
        onOpenCircleSettings={() => {
          setShowManageCircles(false);
          setShowCircleSettings(true);
        }}
      />

      <CreateCircleModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCircle}
      />

      <JoinCircleModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinCircle}
      />

      {selectedCircle && (
        <InviteMemberModal
          visible={showInviteModal}
          circle={selectedCircle}
          onClose={() => setShowInviteModal(false)}
        />
      )}


      <PermissionsModal
        visible={showPermissionsModal}
        onClose={() => {
          backgroundLocationService.dismissPermissionsPromptForSession();
          setShowPermissionsModal(false);
        }}
        onPermissionsGranted={() => {
          backgroundLocationService.startTracking();
          showToast('24/7 Background Timeline Tracking Active');
        }}
      />

      <FeaturesCatalogModal
        visible={showFeaturesCatalog}
        onClose={() => setShowFeaturesCatalog(false)}
        onTriggerFeature={handleTriggerFeature}
      />

      <TriggerSOSModal
        visible={showTriggerSOS}
        onCancel={() => setShowTriggerSOS(false)}
        onConfirm={handleConfirmSOS}
        circleMembers={membersList}
        currentUserId={currentUserId}
      />

      <IncomingSOSAlertModal
        alert={incomingSOS}
        onDismiss={() => setIncomingSOS(null)}
        onTrackNow={(lat, lng) => {
          setIncomingSOS(null);
          setActiveNavTab('location');
          mapRef.current?.animateToPosition(lat, lng, 17);
        }}
      />

      <GroupChatModal
        visible={showChatModal}
        circle={selectedCircle}
        currentUserId={currentUserId}
        messages={chatMessages}
        loadingMessages={isLoadingMessages}
        typingUsers={Object.values(groupTypingUsers)}
        speed={membersMap[currentUserId]?.speed ?? 0}
        movementState={
          (membersMap[currentUserId]?.speed ?? 0) > 15
            ? 'driving'
            : membersMap[currentUserId]?.isStationary
            ? 'stationary'
            : 'walking'
        }
        onClose={() => {
          setShowChatModal(false);
          handleGroupTypingStatus(false);
        }}
        onSendMessage={handleSendChatMessage}
        onTypingStatus={handleGroupTypingStatus}
      />

      <DirectChatModal
        visible={showDirectChat}
        peer={directChatPeer}
        currentUserId={currentUserId}
        messages={directMessages}
        loadingMessages={isLoadingDirectMessages}
        isPeerTyping={isDirectPeerTyping}
        speed={membersMap[currentUserId]?.speed ?? 0}
        movementState={
          (membersMap[currentUserId]?.speed ?? 0) > 15
            ? 'driving'
            : membersMap[currentUserId]?.isStationary
            ? 'stationary'
            : 'walking'
        }
        onClose={() => {
          handleDirectTypingStatus(false);
          setShowDirectChat(false);
          setDirectChatPeer(null);
          directChatPeerRef.current = null;
          setIsDirectPeerTyping(false);
          if (directTypingTimerRef.current) {
            clearTimeout(directTypingTimerRef.current);
            directTypingTimerRef.current = null;
          }
        }}
        onSendMessage={handleSendDirectMessage}
        onTypingStatus={handleDirectTypingStatus}
      />

      <MemberTimelineModal
        visible={showTimelineModal}
        member={timelineMember}
        circleId={selectedCircle?.id || null}
        currentUserId={currentUserId}
        backendUrl={backendWsUrl}
        initialFilter={timelineInitialFilter}
        onClose={() => {
          setShowTimelineModal(false);
          setTimelineMember(null);
        }}
        onShowOnMap={(lat, lng) => {
          setShowTimelineModal(false);
          setActiveNavTab('location');
          mapRef.current?.animateToPosition(lat, lng, 17);
        }}
        onShowFullTimelineOnMap={(data) => {
          setShowTimelineModal(false);
          setActiveTimelineRouteUser(timelineMember?.fullName || 'Member');
          setActiveNavTab('location');
          mapRef.current?.showTimelineRoute(data);
        }}
      />

      {/* Floating In-App Push Notification Banner */}
      <InAppPushBanner
        onNotificationPress={(notif) => {
          if (notif.type === 'chat') {
            if (notif.actionPayload?.isDirect && notif.userId && membersMap[notif.userId]) {
              setDirectChatPeer(membersMap[notif.userId]);
              setShowDirectChat(true);
            } else {
              setShowChatModal(true);
              if (selectedCircle) loadMessages(selectedCircle.id);
            }
          } else if (notif.userId && membersMap[notif.userId]) {
            setActiveNavTab('location');
            handleSelectMember(membersMap[notif.userId]);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabContentContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  alertBanner: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  alertBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  soloMapControlsGroup: {
    position: 'absolute',
    right: 20,
    bottom: 240,
    flexDirection: 'column',
    gap: 12,
    zIndex: 96,
  },
  circularSoloMapCtrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    borderWidth: 1.5,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  locateMyPositionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    gap: 8,
    width: '100%',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  locatePulseRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatePulseCenter: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#007AFF',
  },
  locateMyPositionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
    flex: 1,
    textAlign: 'center',
  },
  noCircleCard: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 95,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noCircleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6,
  },
  noCircleSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  noCircleActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  noCircleBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  noCircleBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noCircleBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  noCircleBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  activeTimelineRouteBanner: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 22,
    gap: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 90,
  },
  activeTimelineRouteBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTimelineRouteText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 180,
  },
  activeTimelineRouteClose: {
    padding: 2,
    marginLeft: 4,
  },
  activeBubbleFloatingBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 22,
    gap: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 92,
  },
  activeBubbleFloatingBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBubbleFloatingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  activeBubbleFloatingBurstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    marginLeft: 4,
  },
  activeBubbleFloatingBurstText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
