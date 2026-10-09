// Telemetry payload sent from the mobile client
export interface TelemetryPing {
  userId: string;
  circleId: string;
  userName?: string;
  latitude: number;
  longitude: number;
  speed: number;        // in km/h
  heading: number;      // 0 - 360 degrees
  batteryLevel: number; // 0 - 100
  isCharging: boolean;
  timestamp: number;    // epoch milliseconds
  accuracy?: number;    // meters
  altitude?: number;    // meters
  activity?: string;
  activityConfidence?: number;
  activityStartedAt?: number;
}

// Outgoing fan-out broadcast sent to all circle sockets
export interface TelemetryBroadcastMessage {
  type: 'TELEMETRY_UPDATE';
  data: TelemetryPing & {
    resolvedAddress?: string | null;
    isStationary: boolean;
    stationarySince?: string | null;
    avatarUrl?: string | null;
    inBubble?: boolean;
    bubbleRadius?: number;
    bubbleUntil?: string | null;
    activity?: string;
    activityConfidence?: number;
    activityStartedAt?: number;
  };
}

export interface GeofenceAlertMessage {
  type: 'GEOFENCE_ALERT';
  data: {
    userId: string;
    userName: string;
    placeId: string;
    placeName: string;
    event: 'ENTER' | 'EXIT';
    timestamp: number;
  };
}

export interface SOSAlertMessage {
  type: 'SOS_ALERT';
  data: {
    userId: string;
    userName: string;
    phone?: string | null;
    circleId: string;
    latitude: number;
    longitude: number;
    timestamp: number;
  };
}

export interface AddressResolvedMessage {
  type: 'ADDRESS_RESOLVED';
  data: {
    userId: string;
    circleId: string;
    address: string;
    latitude: number;
    longitude: number;
  };
}

export interface SpeedingAlertMessage {
  type: 'SPEEDING_ALERT';
  data: {
    userId: string;
    userName: string;
    speed: number;
    latitude: number;
    longitude: number;
    timestamp: number;
  };
}

export interface MovementAlertMessage {
  type: 'MOVEMENT_ALERT';
  data: {
    userId: string;
    userName: string;
    speed: number;
    latitude: number;
    longitude: number;
    timestamp: number;
  };
}

export interface SafetyAlertMessage {
  type: 'SAFETY_ALERT';
  data: {
    userId: string;
    userName: string;
    circleId: string;
    eventType: string;
    severity: string;
    confidence: number;
    title: string;
    message: string;
    speed?: number;
    latitude?: number;
    longitude?: number;
    timestamp: number;
  };
}

export interface SafetyEventPayload {
  id?: string;
  userId: string;
  circleId?: string;
  userName?: string;
  type: string;
  severity: string;
  confidence: number;
  timestamp: number;
  latitude?: number;
  longitude?: number;
  speed?: number;
  speedBefore?: number;
  speedAfter?: number;
  acceleration?: number;
  heading?: number;
  headingChange?: number;
  speedLimit?: number;
  excessSpeed?: number;
  duration?: number;
  evidence?: string[];
  sourceSignals?: string[];
  metadata?: any;
  address?: string;
}

export interface ChatMessage {
  id: string;
  circleId: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
  messageType: 'text' | 'preset' | 'location';
  createdAt: string;
}

export interface ChatMessageWS {
  type: 'CHAT_MESSAGE';
  data: ChatMessage;
}

export interface DirectMessage {
  id: string;
  circleId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  recipientId: string;
  content: string;
  messageType: 'text' | 'preset' | 'location';
  createdAt: string;
}

export interface DirectMessageWS {
  type: 'DIRECT_MESSAGE';
  data: DirectMessage;
}

export interface TypingStatus {
  circleId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface TypingStatusWS {
  type: 'TYPING_STATUS';
  data: TypingStatus;
}

export interface DirectTypingStatus {
  circleId: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  isTyping: boolean;
}

export interface DirectTypingStatusWS {
  type: 'DIRECT_TYPING_STATUS';
  data: DirectTypingStatus;
}

export interface LiveReaction {
  circleId: string;
  senderId: string;
  senderName: string;
  targetUserId: string;
  emoji: string;
  label: string;
  timestamp: number;
}

export interface LiveReactionWS {
  type: 'LIVE_REACTION';
  data: LiveReaction;
}

export interface CheckInAlert {
  circleId: string;
  userId: string;
  userName: string;
  address: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface CheckInWS {
  type: 'CHECK_IN';
  data: CheckInAlert;
}

export interface PresenceChangeWS {
  type: 'PRESENCE_CHANGE';
  data: {
    userId: string;
    circleId: string;
    isOnline: boolean;
    lastOnlineAt: string;
  };
}

export interface MemberJoinedWS {
  type: 'MEMBER_JOINED';
  data: {
    circleId: string;
    member: {
      id: string;
      fullName: string;
      email?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      role: string;
      batteryLevel?: number;
      isBatteryCharging?: boolean;
      latitude?: number;
      longitude?: number;
      address?: string | null;
      isOnline: boolean;
      joinedAt: string;
    };
  };
}

export interface MemberLeftWS {
  type: 'MEMBER_LEFT';
  data: {
    circleId: string;
    userId: string;
    userName?: string;
  };
}

export interface CircleUpdatedWS {
  type: 'CIRCLE_UPDATED';
  data: {
    circleId: string;
    name?: string;
    circleType?: string;
    badgeEmoji?: string;
    imageUrl?: string | null;
    distanceUnit?: string;
  };
}

export interface CircleMetaUpdatedWS {
  type: 'CIRCLE_META_UPDATED';
  data: {
    circleId: string;
    circleType?: string;
    badgeEmoji?: string;
    imageUrl?: string | null;
    distanceUnit?: string;
  };
}

export interface NicknameUpdatedWS {
  type: 'NICKNAME_UPDATED';
  data: {
    circleId: string;
    userId: string;
    targetUserId: string;
    nickname: string;
  };
}

export interface NicknameDeletedWS {
  type: 'NICKNAME_DELETED';
  data: {
    circleId: string;
    userId: string;
    targetUserId: string;
  };
}

export interface FavoritesUpdatedWS {
  type: 'FAVORITES_UPDATED';
  data: {
    circleId: string;
    userId: string;
    favoriteUserId: string;
    isFavorite: boolean;
  };
}

export interface UserPreferencesUpdatedWS {
  type: 'USER_PREFERENCES_UPDATED';
  data: {
    userId: string;
    preferences: any;
  };
}

export interface CircleDeletedWS {
  type: 'CIRCLE_DELETED';
  data: {
    circleId: string;
  };
}

export interface PlaceCreatedWS {
  type: 'PLACE_CREATED';
  data: {
    circleId: string;
    place: any;
  };
}

export interface PlaceUpdatedWS {
  type: 'PLACE_UPDATED';
  data: {
    circleId: string;
    place: any;
  };
}

export interface PlaceDeletedWS {
  type: 'PLACE_DELETED';
  data: {
    circleId: string;
    placeId: string;
  };
}

export interface BubbleStatusChangedWS {
  type: 'BUBBLE_STATUS_CHANGED';
  data: {
    circleId: string;
    userId: string;
    bubbleUntil: string | null;
    bubbleRadius: number;
    latitude?: number;
    longitude?: number;
  };
}

export interface ProfileUpdatedWS {
  type: 'PROFILE_UPDATED';
  data: {
    userId: string;
    fullName?: string;
    avatarUrl?: string | null;
    phone?: string | null;
  };
}

export interface MemberRoleUpdatedWS {
  type: 'MEMBER_ROLE_UPDATED';
  data: {
    circleId: string;
    userId: string;
    newRole: string;
    updatedBy?: string;
  };
}

export interface MemberRemovedWS {
  type: 'MEMBER_REMOVED';
  data: {
    circleId: string;
    userId: string;
    userName?: string;
    removedBy?: string;
  };
}

export interface InviteCodeRegeneratedWS {
  type: 'INVITE_CODE_REGENERATED';
  data: {
    circleId: string;
    newInviteCode: string;
    regeneratedBy?: string;
  };
}

export interface NotificationCreatedWS {
  type: 'NOTIFICATION_CREATED';
  data: {
    id: string;
    circleId?: string;
    type: string;
    title: string;
    body: string;
    data?: any;
    createdAt: string;
  };
}


export type OutgoingWSMessage = 
  | TelemetryBroadcastMessage 
  | GeofenceAlertMessage 
  | SOSAlertMessage 
  | AddressResolvedMessage
  | SpeedingAlertMessage
  | MovementAlertMessage
  | SafetyAlertMessage
  | ChatMessageWS
  | DirectMessageWS
  | TypingStatusWS
  | DirectTypingStatusWS
  | LiveReactionWS
  | CheckInWS
  | PresenceChangeWS
  | MemberJoinedWS
  | MemberLeftWS
  | CircleUpdatedWS
  | CircleMetaUpdatedWS
  | CircleDeletedWS
  | PlaceCreatedWS
  | PlaceUpdatedWS
  | PlaceDeletedWS
  | NicknameUpdatedWS
  | NicknameDeletedWS
  | FavoritesUpdatedWS
  | UserPreferencesUpdatedWS
  | BubbleStatusChangedWS
  | ProfileUpdatedWS
  | MemberRoleUpdatedWS
  | MemberRemovedWS
  | InviteCodeRegeneratedWS
  | NotificationCreatedWS
  | { type: 'ERROR'; message: string }
  | { type: 'CONNECTED'; circleId: string; userId: string };

// In-memory anchor state for reverse geocoding rate-limiting
export interface StationaryAnchor {
  userId: string;
  lat: number;
  lng: number;
  anchorStartTime: number; // epoch ms when user first stayed within threshold
  lastPingTime: number;
  isResolved: boolean;     // whether geocoding API was triggered for this stationary anchor
  isResolving?: boolean;    // in-flight background geocoding request flag
  cachedAddress?: string;
}

export interface PlaceGeofence {
  id: string;
  circle_id: string;
  name: string;
  category: string;
  longitude: number;
  latitude: number;
  radius_meters: number;
  notify_on_enter: boolean;
  notify_on_exit: boolean;
}

// Fallback declaration for environments where @types/web-push is omitted in production
declare module 'web-push';
