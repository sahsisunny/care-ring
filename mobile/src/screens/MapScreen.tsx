import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { MapView, MapViewRef } from '../components/MapView';
import { TopFloatingHeader } from '../components/TopFloatingHeader';
import { BottomDraggableSheet } from '../components/BottomDraggableSheet';
import { CreateCircleModal } from '../components/modals/CreateCircleModal';
import { JoinCircleModal } from '../components/modals/JoinCircleModal';
import { InviteMemberModal } from '../components/modals/InviteMemberModal';
import { SettingsModal } from '../components/modals/SettingsModal';
import { ManageCirclesModal } from '../components/modals/ManageCirclesModal';
import {
  TriggerSOSModal,
  IncomingSOSAlertModal,
} from '../components/modals/EmergencySOSModal';
import { MemberData, parseMember } from '../models/Member';
import { Circle } from '../models/Circle';
import { MapStyleConfig, MAP_STYLES } from '../models/MapStyle';
import { SOSAlertData } from '../models/Telemetry';
import { authService } from '../services/AuthService';
import { WebSocketClient } from '../services/WebSocketClient';
import { AdaptiveLocationEngine } from '../services/AdaptiveLocationEngine';
import { MarkerInterpolator, LatLng } from '../services/MarkerInterpolator';
import { Colors } from '../theme/colors';

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

  // Profile & Theme State
  const [displayName, setDisplayName] = useState(currentUserName);
  const [activeMapStyle, setActiveMapStyle] = useState<MapStyleConfig>(
    MAP_STYLES.life360Minimal
  );

  // Circle State - NO dummy data
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

  // Banner Notification State (for Geofence / Alerts)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const bannerAnim = useRef(new Animated.Value(-100)).current;

  // Modals Visibility
  const [showManageCircles, setShowManageCircles] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTriggerSOS, setShowTriggerSOS] = useState(false);
  const [incomingSOS, setIncomingSOS] = useState<SOSAlertData | null>(null);

  // Refs for services
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const locationEngineRef = useRef<AdaptiveLocationEngine | null>(null);
  const interpolatorRef = useRef<MarkerInterpolator | null>(null);

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
              m.fullName = `${displayName} (You)`;
              m.avatarUrl = authService.getUserAvatar();
            }
            next[m.id] = m;
            if (m.latitude && m.longitude) {
              interpolatorRef.current?.updateTarget({
                memberId: m.id,
                newPosition: { latitude: m.latitude, longitude: m.longitude },
                newHeading: m.heading,
              });
            }
          });
          setMembersMap(next);
        }
      } catch (err) {
        console.warn('[MapScreen] Error fetching circle members:', err);
      }
    },
    [backendWsUrl, currentUserId, displayName]
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
      };

      client.onGeofenceAlert = (alert) => {
        const verb = alert.event === 'ENTER' ? 'arrived at' : 'left';
        showToast(`📍 ${alert.userName} has ${verb} ${alert.placeName}`);
      };

      client.onSOSAlert = (sos) => {
        setIncomingSOS(sos);
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

      client.connect();
      wsClientRef.current = client;
    },
    [backendWsUrl, currentUserId, showToast]
  );

  // 4. Start Adaptive Location Engine
  useEffect(() => {
    if (!selectedCircle) return;

    const engine = new AdaptiveLocationEngine({
      userId: currentUserId,
      circleId: selectedCircle.id,
      userName: displayName,
      onTelemetry: (ping) => {
        wsClientRef.current?.sendTelemetry(ping);

        setMyPosition({
          latitude: ping.latitude,
          longitude: ping.longitude,
          heading: ping.heading,
        });

        // Update self in membersMap
        setMembersMap((prev) => {
          const self = prev[currentUserId];
          const updatedSelf: MemberData = {
            id: currentUserId,
            fullName: `${displayName} (You)`,
            avatarUrl: authService.getUserAvatar(),
            role: self?.role || selectedCircle.role || 'member',
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
      },
    });

    engine.start().catch((err) => {
      console.warn('[MapScreen] Location engine start error:', err);
    });

    locationEngineRef.current = engine;

    return () => {
      engine.dispose();
    };
  }, [currentUserId, displayName, selectedCircle]);

  // 5. Load Real Circles from Database for this Authenticated User
  const refreshCircles = useCallback(async () => {
    try {
      const userCircles = await authService.fetchUserCircles(backendWsUrl);
      setCircles(userCircles);

      if (userCircles.length > 0) {
        // Find existing selected circle or default to first
        const active = userCircles.find((c) => c.id === selectedCircle?.id) || userCircles[0];
        setSelectedCircle(active);
        authService.setActiveCircle(active);
        initWebSocket(active.id);
        fetchCircleMembers(active.id);
      } else {
        setSelectedCircle(null);
        authService.setActiveCircle(null);
        setMembersMap({});
        wsClientRef.current?.dispose();
      }
    } catch (err) {
      console.warn('[MapScreen] Error loading circles:', err);
    }
  }, [backendWsUrl, fetchCircleMembers, initWebSocket, selectedCircle?.id]);

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

  const handleGoToMyLocation = () => {
    if (myPosition) {
      mapRef.current?.animateToPosition(myPosition.latitude, myPosition.longitude, 16.5);
    } else {
      showToast('Waiting for device GPS fix...');
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

  const handleSelectMapStyle = (style: MapStyleConfig) => {
    setActiveMapStyle(style);
    mapRef.current?.setMapStyle(style);
  };

  const membersList = Object.values(membersMap);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Layer 1: Base Map */}
      <MapView
        ref={mapRef}
        currentUserId={currentUserId}
        members={membersList}
        myPosition={myPosition}
        mapStyle={activeMapStyle}
        onMemberPress={handleSelectMember}
        onMapPress={() => setSelectedMember(null)}
      />

      {/* Layer 2: Top Floating Header */}
      <TopFloatingHeader
        selectedCircle={selectedCircle}
        availableCircles={circles}
        currentUserName={displayName}
        currentUserAvatar={authService.getUserAvatar()}
        onCirclePress={() => setShowManageCircles(true)}
        onSOSTapped={handleTriggerSOS}
        onMenuTapped={() => setShowSettingsModal(true)}
      />

      {/* Empty State Banner (if user is in 0 family groups) */}
      {!selectedCircle && circles.length === 0 && (
        <View style={styles.noCircleCard}>
          <Text style={styles.noCircleTitle}>No Family Group Yet</Text>
          <Text style={styles.noCircleSubtitle}>
            Create your family group or join one using an invitation code to share locations.
          </Text>
          <View style={styles.noCircleActionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowCreateModal(true)}
              style={styles.noCircleBtnPrimary}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.noCircleBtnPrimaryText}>Create Family</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowJoinModal(true)}
              style={styles.noCircleBtnSecondary}
            >
              <Ionicons name="key-outline" size={16} color={Colors.primary} />
              <Text style={styles.noCircleBtnSecondaryText}>Join with Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Layer 3: Floating Alert Toast Banner */}
      {bannerMessage && (
        <Animated.View
          style={[
            styles.alertBanner,
            { transform: [{ translateY: bannerAnim }] },
          ]}
        >
          <Ionicons name="notifications" size={18} color="#38BDF8" />
          <Text style={styles.alertBannerText}>{bannerMessage}</Text>
        </Animated.View>
      )}

      {/* Layer 4: Bottom Draggable Sheet */}
      {selectedCircle && (
        <BottomDraggableSheet
          members={membersList}
          selectedMember={selectedMember}
          currentUserId={currentUserId}
          onSelectMember={handleSelectMember}
          onCenterAll={handleCenterAll}
          onGoToMyLocation={handleGoToMyLocation}
          onInviteTapped={() => setShowInviteModal(true)}
        />
      )}

      {/* Modals & Dialogs */}
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
        currentUserName={displayName}
        currentUserEmail={authService.getSession()?.email}
        currentUserPhone={authService.getUserPhone()}
        currentUserAvatar={authService.getUserAvatar()}
        activeMapStyle={activeMapStyle}
        onClose={() => setShowSettingsModal(false)}
        onUpdateName={handleUpdateName}
        onSelectMapStyle={handleSelectMapStyle}
        onSignOut={onSignOut}
      />

      <TriggerSOSModal
        visible={showTriggerSOS}
        onCancel={() => setShowTriggerSOS(false)}
        onConfirm={handleConfirmSOS}
      />

      <IncomingSOSAlertModal
        alert={incomingSOS}
        onDismiss={() => setIncomingSOS(null)}
        onTrackNow={(lat, lng) => {
          setIncomingSOS(null);
          mapRef.current?.animateToPosition(lat, lng, 17);
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
  noCircleCard: {
    position: 'absolute',
    bottom: 40,
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
});
