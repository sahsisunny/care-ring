import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MapView, MapViewRef } from '../components/MapView';
import { TopFloatingHeader } from '../components/TopFloatingHeader';
import { RightMemberStack } from '../components/RightMemberStack';
import { BottomDraggableSheet } from '../components/BottomDraggableSheet';
import { BottomNavBar, BottomNavTab } from '../components/BottomNavBar';
import { CreateCircleModal } from '../components/modals/CreateCircleModal';
import { JoinCircleModal } from '../components/modals/JoinCircleModal';
import { InviteMemberModal } from '../components/modals/InviteMemberModal';
import { SettingsModal } from '../components/modals/SettingsModal';
import { ManageCirclesModal } from '../components/modals/ManageCirclesModal';
import { CircleSettingsModal } from '../components/modals/CircleSettingsModal';
import { ProfilePhotoModal } from '../components/modals/ProfilePhotoModal';
import { AlertsInboxModal, AlertItem } from '../components/modals/AlertsInboxModal';
import { WeeklyDriveReportModal } from '../components/modals/WeeklyDriveReportModal';
import { SpeedingModal } from '../components/modals/SpeedingModal';
import { CreateBubbleModal } from '../components/modals/CreateBubbleModal';
import { SavePlaceModal } from '../components/modals/SavePlaceModal';
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
import { MapStyleConfig, MAP_STYLES } from '../models/MapStyle';
import { SOSAlertData } from '../models/Telemetry';
import { ChatMessage, DirectChatMessage } from '../models/Chat';
import { authService } from '../services/AuthService';
import { WebSocketClient } from '../services/WebSocketClient';
import { AdaptiveLocationEngine } from '../services/AdaptiveLocationEngine';
import { MarkerInterpolator, LatLng } from '../services/MarkerInterpolator';
import { Colors, getWebGlassCardStyle, getWebGlassPillStyle } from '../theme/colors';
import { InAppPushBanner } from '../components/InAppPushBanner';
import { notificationService, InAppNotification } from '../services/NotificationService';
import { backgroundLocationService } from '../services/BackgroundLocationService';
import { AppThemeId, themeService } from '../theme/ThemeService';
import { useTheme } from '../theme/ThemeContext';

import { DrivingTabScreen } from './DrivingTabScreen';
import { SafetyTabScreen } from './SafetyTabScreen';
import { MembershipTabScreen } from './MembershipTabScreen';
import { FeaturesCatalogModal } from './FeaturesCatalogModal';
import {
  TileCacheService,
  CacheStats,
  CacheProgress,
  FrequentLocation,
} from '../services/TileCacheService';

interface MapScreenProps {
  currentUserId: string;
  currentUserName: string;
  backendWsUrl?: string;
  onSignOut: () => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  currentUserId,
  currentUserName,
  backendWsUrl = 'ws://127.0.0.1:4000',
  onSignOut,
}) => {
  const mapRef = useRef<MapViewRef>(null);

  // Tab Navigation State
  const [activeNavTab, setActiveNavTab] = useState<BottomNavTab>('location');

  // Profile & Theme State
  const { colors, isDark, isGlass, themeId, setTheme } = useTheme();

  const webGlassCard = getWebGlassCardStyle(isDark, isGlass);
  const webGlassPill = getWebGlassPillStyle(isDark, isGlass);

  const [displayName, setDisplayName] = useState(currentUserName);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(authService.getUserAvatar());
  const [activeMapStyle, setActiveMapStyle] = useState<MapStyleConfig>(
    themeId === 'dark-glass' ? MAP_STYLES.darkMinimal : MAP_STYLES.careRingMinimal
  );

  useEffect(() => {
    if (themeId === 'dark-glass') {
      setActiveMapStyle(MAP_STYLES.darkMinimal);
    } else {
      setActiveMapStyle(MAP_STYLES.careRingMinimal);
    }
  }, [themeId]);

  // Circle State
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  // Members & Location State
  const [membersMap, setMembersMap] = useState<Record<string, MemberData>>({});
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
  const [myPosition, setMyPosition] = useState<{
    latitude: number;
    longitude: number;
    heading: number;
  } | null>(null);

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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFeaturesCatalog, setShowFeaturesCatalog] = useState(false);
  const [showTriggerSOS, setShowTriggerSOS] = useState(false);
  const [incomingSOS, setIncomingSOS] = useState<SOSAlertData | null>(null);

  // Offline Tile Cache State
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress | null>(null);
  const [isCachingTiles, setIsCachingTiles] = useState(false);

  // Chat & Timeline State
  const [showChatModal, setShowChatModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
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

  const showToast = useCallback((msg: string) => {
    setBannerMessage(msg);
    Animated.sequence([
      Animated.timing(bannerAnim, {
        toValue: Platform.OS === 'ios' ? 54 : 36,
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

  // Offline Tile Cache Statistics Subscription
  useEffect(() => {
    TileCacheService.getCacheStats().then(setCacheStats);
    const unsubStats = TileCacheService.subscribeStats(setCacheStats);
    const unsubProgress = TileCacheService.subscribeProgress((p) => {
      setCacheProgress(p);
      if (p.isDone) {
        setIsCachingTiles(false);
      }
    });
    return () => {
      unsubStats();
      unsubProgress();
    };
  }, []);

  // 1. Initialize Marker Interpolator
  useEffect(() => {
    interpolatorRef.current = new MarkerInterpolator(
      (memberId: string, pos: LatLng, heading: number) => {
        setMembersMap((prev) => {
          const current = prev[memberId];
          if (!current) return prev;
          return {
            ...prev,
            [memberId]: {
              ...current,
              latitude: pos.latitude,
              longitude: pos.longitude,
              heading,
            },
          };
        });
      }
    );

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
          const timer = setTimeout(() => {
            setShowPermissionsModal(true);
          }, 1200);
          return () => clearTimeout(timer);
        } else {
          backgroundLocationService.startTracking();
        }
      });
    }
  }, []);

  // 2. Fetch Circle Members via REST
  const fetchCircleMembers = useCallback(
    async (circleId: string) => {
      const httpBase = backendWsUrl
        .replace(/^ws:\/\//i, 'http://')
        .replace(/^wss:\/\//i, 'https://');
      const uri = `${httpBase}/api/circles/${circleId}/members`;

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
          const updated: MemberData = {
            id: data.userId,
            fullName: data.userName || existing?.fullName || 'Circle Member',
            avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing?.avatarUrl,
            role: existing?.role || 'member',
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            heading: data.heading,
            batteryLevel: data.batteryLevel,
            isCharging: data.isCharging,
            resolvedAddress: data.resolvedAddress !== undefined ? data.resolvedAddress : existing?.resolvedAddress,
            stationarySince: data.stationarySince ? new Date(data.stationarySince) : existing?.stationarySince,
            isStationary: data.isStationary ?? (data.speed < 3.0),
            isMoving: (data.speed || 0) > 3.0 && !data.isStationary,
            lastOnlineAt: new Date(),
            isOnline: true,
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

      client.onGeofenceAlert = (alert) => {
        const verb = alert.event === 'ENTER' ? 'arrived at' : 'left';
        showToast(`📍 ${alert.userName} has ${verb} ${alert.placeName}`);
        setUnreadAlertCount((c) => c + 1);
        setAlertsList((prev) => [
          {
            id: `geo_${Date.now()}`,
            title: alert.event === 'ENTER' ? `Arrival: ${alert.placeName}` : `Departure: ${alert.placeName}`,
            desc: `${alert.userName} has ${verb} ${alert.placeName}.`,
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
            time: 'Just now',
            icon: 'checkmark-circle',
            color: Colors.primary,
          },
          ...prev,
        ]);
      };

      client.onChatMessage = (msg) => {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
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

      client.connect();
      wsClientRef.current = client;
    },
    [backendWsUrl, currentUserId, membersMap, myPosition, showToast]
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
          wsClientRef.current?.sendTelemetry(ping);
          authService.syncTelemetry(backendWsUrl, ping).catch((err) => {
            console.warn('[MapScreen] Telemetry sync error:', err);
          });
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
            isStationary: ping.speed < 3.0,
            isMoving: ping.speed > 3.0,
            lastOnlineAt: new Date(),
            isOnline: true,
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
    }
  }, [backendWsUrl, fetchCircleMembers, initWebSocket, selectedCircle?.id, currentUserId, displayName, currentUserAvatar, myPosition]);

  const loadMessages = useCallback(async (circleId: string) => {
    const msgs = await authService.fetchCircleMessages(backendWsUrl, circleId);
    setChatMessages(msgs);
  }, [backendWsUrl]);

  const handleSendChatMessage = async (
    content: string,
    messageType: 'text' | 'preset' | 'location' = 'text'
  ) => {
    if (!selectedCircle) return;
    const sentViaWs = wsClientRef.current?.sendChatMessage(content, messageType);
    if (!sentViaWs) {
      const saved = await authService.sendCircleMessage(
        backendWsUrl,
        selectedCircle.id,
        content,
        messageType
      );
      if (saved) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev;
          return [...prev, saved];
        });
      }
    }
  };

  const handleOpenDirectChat = async (peer: MemberData) => {
    if (!selectedCircle) return;
    setDirectChatPeer(peer);
    directChatPeerRef.current = peer;
    setShowDirectChat(true);
    try {
      const msgs = await authService.fetchDirectMessages(
        backendWsUrl,
        selectedCircle.id,
        peer.id
      );
      setDirectMessages(msgs);
    } catch (err) {
      console.warn('[MapScreen] Error fetching direct messages:', err);
    }
  };

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
  const handleSelectMember = (member: MemberData) => {
    setSelectedMember(member);
    if (member.latitude && member.longitude) {
      mapRef.current?.animateToPosition(member.latitude, member.longitude, 16.5);
    } else {
      showToast(`${member.fullName} has not reported a GPS fix yet.`);
    }
  };

  const handleCenterAll = () => {
    const list = Object.values(membersMap).filter((m) => m.latitude && m.longitude);
    if (list.length > 0) {
      mapRef.current?.fitBounds(list);
    } else if (myPosition) {
      mapRef.current?.animateToPosition(myPosition.latitude, myPosition.longitude, 15);
    }
  };

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

  const handleTriggerSOS = () => {
    setShowTriggerSOS(true);
  };

  const handleConfirmSOS = () => {
    setShowTriggerSOS(false);
    if (myPosition && selectedCircle) {
      wsClientRef.current?.sendSOS(myPosition.latitude, myPosition.longitude);
      showToast('🚨 Emergency SOS broadcasted to circle members!');
    } else {
      showToast('Join a family group to broadcast emergency SOS alerts');
    }
  };

  // CRUD Handlers for Circles
  const handleSelectCircle = (circle: Circle) => {
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
    mapRef.current?.setMapStyle(style);
  };

  // Safety & Interactive Actions
  const handleSendLiveReaction = async (member: MemberData, emoji: string, label: string) => {
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
  };

  const handleCheckIn = async () => {
    const lat = myPosition?.latitude || 12.9095;
    const lng = myPosition?.longitude || 77.6753;
    const addr = myPosition ? `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})` : 'Current Location';
    wsClientRef.current?.sendCheckIn(addr, lat, lng, displayName);
    if (selectedCircle) {
      authService.sendCheckIn(backendWsUrl, selectedCircle.id, {
        address: addr,
        latitude: lat,
        longitude: lng,
      });
    }
    showToast(`📍 Checked in! Broadcasted to circle.`);
  };

  const handleConfirmBubble = async (radiusMeters: number, durationMinutes: number) => {
    const lat = myPosition?.latitude || 12.9095;
    const lng = myPosition?.longitude || 77.6753;
    mapRef.current?.showBubble(lat, lng, radiusMeters);

    if (selectedCircle) {
      await authService.createBubble(backendWsUrl, selectedCircle.id, currentUserId, radiusMeters, durationMinutes);
    }
    showToast(`🫧 Privacy Bubble active for ${durationMinutes / 60} hrs (${radiusMeters / 1000} km)`);
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

  const membersList = Object.values(membersMap);
  const effectiveSelectedMember = selectedMember ? (membersMap[selectedMember.id] || selectedMember) : null;

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
        setShowSettingsModal(true);
        break;
      case 'open_privacy':
        setShowSettingsModal(true);
        break;
      case 'offline_tiles':
        setShowSettingsModal(true);
        break;
      default:
        break;
    }
  };

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

  const handleClearTileCache = async () => {
    mapRef.current?.clearTileCache();
    await TileCacheService.clearCache();
    const fresh = await TileCacheService.getCacheStats();
    setCacheStats(fresh);
    showToast('Offline raster cache cleared.');
  };

  const handleOpenWeeklyReport = async (member: MemberData) => {
    setReportMember(member);
    if (selectedCircle) {
      const data = await authService.fetchDriverReport(backendWsUrl, selectedCircle.id, member.id);
      if (data) {
        setDriverReportData(data);
      }
    }
    setShowWeeklyReport(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            members={selectedCircle ? membersList : []}
            myPosition={myPosition}
            mapStyle={isDark ? MAP_STYLES.darkMinimal : activeMapStyle}
            onMemberPress={handleSelectMember}
            onMapPress={() => setSelectedMember(null)}
            onCacheStatsUpdated={setCacheStats}
            onCacheProgress={(p) => {
              setCacheProgress(p);
              if (p.isDone) setIsCachingTiles(false);
            }}
          />

          {/* Top Floating Header */}
          <TopFloatingHeader
            selectedCircle={selectedCircle}
            unreadAlertCount={unreadAlertCount}
            onCirclePress={() => setShowManageCircles(true)}
            onChatTapped={() => {
              setShowChatModal(true);
              if (selectedCircle) loadMessages(selectedCircle.id);
            }}
            onAlertsTapped={() => setShowAlertsInbox(true)}
            onSettingsTapped={() => setShowSettingsModal(true)}
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

          {/* Right Floating Member Stack (Only shown when user is in a family group) */}
          {selectedCircle && (
            <RightMemberStack
              members={membersList}
              selectedMemberId={effectiveSelectedMember?.id}
              onSelectMember={handleSelectMember}
            />
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
                onPress={() => {
                  const stylesList = Object.values(MAP_STYLES);
                  const idx = stylesList.findIndex((s) => s.id === activeMapStyle.id);
                  const next = stylesList[(idx + 1) % stylesList.length];
                  handleSelectMapStyle(next);
                  showToast(`Map style: ${next.name}`);
                }}
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
          {selectedCircle && (
            <BottomDraggableSheet
              members={membersList}
              selectedMember={effectiveSelectedMember}
              currentUserId={currentUserId}
              myPosition={myPosition}
              onSelectMember={handleSelectMember}
              onDeselectMember={() => setSelectedMember(null)}
              onCenterAll={handleCenterAll}
              onGoToMyLocation={handleGoToMyLocation}
              onToggleMapLayers={() => {
                const stylesList = Object.values(MAP_STYLES);
                const idx = stylesList.findIndex((s) => s.id === activeMapStyle.id);
                const next = stylesList[(idx + 1) % stylesList.length];
                handleSelectMapStyle(next);
                showToast(`Map style: ${next.name}`);
              }}
              onCheckInTapped={handleCheckIn}
              onSOSTapped={handleTriggerSOS}
              onAddPersonTapped={() => setShowInviteModal(true)}
              onSavePlaceTapped={(m) => {
                setSavePlaceMember(m);
                setShowSavePlace(true);
              }}
              onCreateBubbleTapped={(m) => {
                setBubbleMember(m);
                setShowCreateBubble(true);
              }}
              onSendLiveReaction={handleSendLiveReaction}
              onViewWeeklyReport={handleOpenWeeklyReport}
              onViewSpeeding={(m) => {
                handleOpenWeeklyReport(m);
                setShowSpeedingModal(true);
              }}
              onViewTimeline={(m) => {
                setTimelineMember(m);
                setShowTimelineModal(true);
              }}
              onOpenChat={() => {
                setShowChatModal(true);
                if (selectedCircle) loadMessages(selectedCircle.id);
              }}
              onOpenDirectChat={handleOpenDirectChat}
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
        />
      )}

      {/* ======================================================== */}
      {/* TAB 3: SAFETY (Crash Detection & Emergency SOS)           */}
      {/* ======================================================== */}
      {activeNavTab === 'safety' && (
        <SafetyTabScreen
          places={placesList}
          onTriggerSOS={handleTriggerSOS}
          onOpenSavePlace={() => {
            setSavePlaceMember(null);
            setShowSavePlace(true);
          }}
          onDeletePlace={handleDeletePlace}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 4: MEMBERSHIP (CareRing Safety Suite & Plan)          */}
      {/* ======================================================== */}
      {activeNavTab === 'membership' && (
        <MembershipTabScreen onOpenFeaturesCatalog={() => setShowFeaturesCatalog(true)} />
      )}
      </View>

      {/* Permanent Bottom Nav Bar (Location, Driving, Safety, Membership) */}
      <BottomNavBar
        activeTab={activeNavTab}
        onSelectTab={(tab) => {
          setActiveNavTab(tab);
          if (tab !== 'location') {
            setSelectedMember(null);
          }
        }}
      />

      {/* ======================================================== */}
      {/* ALL MODALS & DIALOGS                                     */}
      {/* ======================================================== */}

      {/* Circle Settings */}
      <CircleSettingsModal
        visible={showCircleSettings}
        circle={selectedCircle}
        currentUserId={currentUserId}
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

      {/* Weekly Drive Report Modal (Unlocked Premium Feature) */}
      <WeeklyDriveReportModal
        visible={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
        memberName={reportMember?.fullName || displayName}
        reportData={driverReportData}
        onReplayTrip={(trip) => {
          setShowWeeklyReport(false);
          setActiveNavTab('location');
          mapRef.current?.showRouteReplay(trip.routeCoordinates, '#4F46E5');
          showToast(`Replaying drive route on map`);
        }}
      />

      {/* Speeding Log Modal (Unlocked Feature) */}
      <SpeedingModal
        visible={showSpeedingModal}
        onClose={() => setShowSpeedingModal(false)}
        speedingData={driverReportData?.speeding}
      />

      {/* Create Privacy Bubble Modal */}
      <CreateBubbleModal
        visible={showCreateBubble}
        onClose={() => setShowCreateBubble(false)}
        onConfirmBubble={handleConfirmBubble}
      />

      {/* Save Place Geofence Modal */}
      <SavePlaceModal
        visible={showSavePlace}
        onClose={() => setShowSavePlace(false)}
        initialAddress={savePlaceMember?.resolvedAddress || ''}
        latitude={savePlaceMember?.latitude || myPosition?.latitude || 12.9095}
        longitude={savePlaceMember?.longitude || myPosition?.longitude || 77.6753}
        onSavePlace={handleSavePlace}
      />

      {/* Manage Circles Modal */}
      <ManageCirclesModal
        visible={showManageCircles}
        circles={circles}
        selectedCircle={selectedCircle}
        currentUserId={currentUserId}
        onClose={() => setShowManageCircles(false)}
        onSelectCircle={handleSelectCircle}
        onCreateNewPress={() => setShowCreateModal(true)}
        onJoinPress={() => setShowJoinModal(true)}
        onRenameCircle={handleRenameCircle}
        onLeaveCircle={handleLeaveCircle}
        onDeleteCircle={handleDeleteCircle}
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

      <SettingsModal
        visible={showSettingsModal}
        currentUserId={currentUserId}
        currentUserName={displayName}
        currentUserEmail={authService.getSession()?.email}
        currentUserPhone={authService.getUserPhone()}
        currentUserAvatar={currentUserAvatar}
        activeMapStyle={activeMapStyle}
        backendUrl={backendWsUrl}
        circles={circles}
        selectedCircle={selectedCircle}
        onClose={() => setShowSettingsModal(false)}
        onUpdateName={handleUpdateName}
        onSaveAvatar={handleSaveAvatar}
        onSelectMapStyle={handleSelectMapStyle}
        onSelectCircle={(c) => setSelectedCircle(c)}
        onCreateCircle={() => setShowCreateModal(true)}
        onJoinCircle={() => setShowJoinModal(true)}
        onInviteMembers={() => setShowInviteModal(true)}
        onRenameCircle={(newName) => selectedCircle && handleRenameCircle(selectedCircle.id, newName)}
        onLeaveCircle={() => selectedCircle && handleLeaveCircle(selectedCircle.id)}
        onOpenFeaturesCatalog={() => {
          setShowSettingsModal(false);
          setShowFeaturesCatalog(true);
        }}
        cacheStats={cacheStats}
        frequentLocations={getFrequentLocations()}
        cacheProgress={cacheProgress}
        isCaching={isCachingTiles}
        onCacheAllFrequent={handleCacheAllFrequent}
        onCacheCurrentView={handleCacheCurrentView}
        onClearCache={handleClearTileCache}
        onTriggerFeature={handleTriggerFeature}
        activeThemeId={themeId}
        onSelectTheme={(id) => setTheme(id)}
        onRequestPermissions={() => setShowPermissionsModal(true)}
        onSignOut={onSignOut}
      />

      <PermissionsModal
        visible={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
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
        typingUsers={Object.values(groupTypingUsers)}
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
        isPeerTyping={isDirectPeerTyping}
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
        backendUrl={backendWsUrl}
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
});
