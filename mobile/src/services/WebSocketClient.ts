import {
  TelemetryPing,
  TelemetryBroadcastData,
  GeofenceAlertData,
  SOSAlertData,
  SpeedingAlertData,
  MovementAlertData,
  SafetyAlertData,
  OutgoingWSMessage,
  MemberJoinedData,
  MemberLeftData,
  CircleUpdatedData,
  CircleMetaUpdatedData,
  CircleDeletedData,
  PlaceCreatedData,
  PlaceDeletedData,
  NicknameUpdatedData,
  NicknameDeletedData,
  FavoritesUpdatedData,
  UserPreferencesUpdatedData,
  BubbleStatusData,
  ProfileUpdatedData,
} from '../models/Telemetry';
import { ChatMessage, DirectChatMessage, TypingEvent, DirectTypingEvent } from '../models/Chat';

export type OnTelemetryReceived = (data: TelemetryBroadcastData) => void;
export type OnGeofenceAlert = (alert: GeofenceAlertData) => void;
export type OnSOSAlert = (sos: SOSAlertData) => void;
export type OnSpeedingAlert = (alert: SpeedingAlertData) => void;
export type OnMovementAlert = (alert: MovementAlertData) => void;
export type OnSafetyAlert = (alert: SafetyAlertData) => void;
export type OnAddressResolved = (userId: string, address: string) => void;
export type OnChatMessage = (message: ChatMessage) => void;
export type OnDirectMessage = (message: DirectChatMessage) => void;
export type OnTypingStatus = (event: TypingEvent) => void;
export type OnDirectTypingStatus = (event: DirectTypingEvent) => void;
export type OnLiveReaction = (data: any) => void;
export type OnCheckIn = (data: any) => void;
export type OnStatusChange = (isConnected: boolean) => void;
export type OnPresenceChange = (data: {
  userId: string;
  circleId: string;
  isOnline: boolean;
  lastOnlineAt: string;
}) => void;
export type OnMemberJoined = (data: MemberJoinedData) => void;
export type OnMemberLeft = (data: MemberLeftData) => void;
export type OnCircleUpdated = (data: CircleUpdatedData) => void;
export type OnCircleMetaUpdated = (data: CircleMetaUpdatedData) => void;
export type OnCircleDeleted = (data: CircleDeletedData) => void;
export type OnPlaceCreated = (data: PlaceCreatedData) => void;
export type OnPlaceDeleted = (data: PlaceDeletedData) => void;
export type OnNicknameUpdated = (data: NicknameUpdatedData) => void;
export type OnNicknameDeleted = (data: NicknameDeletedData) => void;
export type OnFavoritesUpdated = (data: FavoritesUpdatedData) => void;
export type OnUserPreferencesUpdated = (data: UserPreferencesUpdatedData) => void;
export type OnBubbleStatusChanged = (data: BubbleStatusData) => void;
export type OnProfileUpdated = (data: ProfileUpdatedData) => void;

export class WebSocketClient {
  private serverUrl: string;
  private circleId: string;
  private userId: string;
  private candidateUrls: string[];
  private currentUrlIndex = 0;

  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private isConnectedState = false;
  private isDisposedState = false;
  private pendingPing: TelemetryPing | null = null;

  public onTelemetryReceived?: OnTelemetryReceived;
  public onGeofenceAlert?: OnGeofenceAlert;
  public onSOSAlert?: OnSOSAlert;
  public onSpeedingAlert?: OnSpeedingAlert;
  public onMovementAlert?: OnMovementAlert;
  public onSafetyAlert?: OnSafetyAlert;
  public onAddressResolved?: OnAddressResolved;
  public onChatMessage?: OnChatMessage;
  public onDirectMessage?: OnDirectMessage;
  public onTypingStatus?: OnTypingStatus;
  public onDirectTypingStatus?: OnDirectTypingStatus;
  public onLiveReaction?: OnLiveReaction;
  public onCheckIn?: OnCheckIn;
  public onStatusChange?: OnStatusChange;
  public onPresenceChange?: OnPresenceChange;
  public onMemberJoined?: OnMemberJoined;
  public onMemberLeft?: OnMemberLeft;
  public onCircleUpdated?: OnCircleUpdated;
  public onCircleMetaUpdated?: OnCircleMetaUpdated;
  public onCircleDeleted?: OnCircleDeleted;
  public onPlaceCreated?: OnPlaceCreated;
  public onPlaceDeleted?: OnPlaceDeleted;
  public onNicknameUpdated?: OnNicknameUpdated;
  public onNicknameDeleted?: OnNicknameDeleted;
  public onFavoritesUpdated?: OnFavoritesUpdated;
  public onUserPreferencesUpdated?: OnUserPreferencesUpdated;
  public onBubbleStatusChanged?: OnBubbleStatusChanged;
  public onProfileUpdated?: OnProfileUpdated;
  public onMemberRoleUpdated?: (data: { circleId: string; userId: string; newRole: string; updatedBy?: string }) => void;
  public onMemberRemoved?: (data: { circleId: string; userId: string; userName?: string; removedBy?: string }) => void;
  public onInviteCodeRegenerated?: (data: { circleId: string; newInviteCode: string; regeneratedBy?: string }) => void;
  public onNotificationCreated?: (data: any) => void;

  constructor(options: {
    serverUrl: string;
    circleId: string;
    userId: string;
    fallbackUrls?: string[];
  }) {
    this.serverUrl = options.serverUrl;
    this.circleId = options.circleId;
    this.userId = options.userId;

    const isLocalhost =
      options.serverUrl.includes('localhost') ||
      options.serverUrl.includes('127.0.0.1') ||
      options.serverUrl.includes('10.0.2.2');

    const defaults = isLocalhost
      ? [
          options.serverUrl,
          'ws://127.0.0.1:4000',
          'ws://localhost:4000',
          'ws://10.0.2.2:4000',
          ...(options.fallbackUrls || []),
        ]
      : [
          options.serverUrl,
          ...(options.fallbackUrls || []),
        ];
    // De-duplicate
    this.candidateUrls = Array.from(new Set(defaults));
  }

  public get isConnected(): boolean {
    return this.isConnectedState;
  }

  public get activeUrl(): string {
    return this.candidateUrls[this.currentUrlIndex];
  }

  public get configuredServerUrl(): string {
    return this.serverUrl;
  }

  public connect(): void {
    if (this.isDisposedState) return;

    try {
      const activeBase = this.candidateUrls[this.currentUrlIndex]
        .replace(/^http:\/\//i, 'ws://')
        .replace(/^https:\/\//i, 'wss://');

      const wsUri = `${activeBase}/ws/circles/${this.circleId}?userId=${this.userId}`;
      console.log(`[WS] Connecting to ${wsUri}...`);

      this.ws = new WebSocket(wsUri);

      this.ws.onopen = () => {
        console.log(`[WS] Connected to circle ${this.circleId}`);
        this.isConnectedState = true;
        this.onStatusChange?.(true);

        if (this.pendingPing) {
          const pingToSend = this.pendingPing;
          this.pendingPing = null;
          this.sendTelemetry(pingToSend);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn(`[WS] Socket error on ${activeBase}:`, err);
        this.isConnectedState = false;
        this.onStatusChange?.(false);
      };

      this.ws.onclose = () => {
        console.log('[WS] Connection closed. Reconnecting in 1.2s...');
        this.isConnectedState = false;
        this.onStatusChange?.(false);
        this.currentUrlIndex = (this.currentUrlIndex + 1) % this.candidateUrls.length;
        this.scheduleReconnect();
      };
    } catch (e) {
      console.warn('[WS] Failed to initiate connection:', e);
      this.currentUrlIndex = (this.currentUrlIndex + 1) % this.candidateUrls.length;
      this.scheduleReconnect();
    }
  }

  private handleMessage(raw: any): void {
    try {
      const payload: OutgoingWSMessage = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!payload || !payload.type) return;

      switch (payload.type) {
        case 'TELEMETRY_UPDATE':
          if (payload.data && this.onTelemetryReceived) {
            this.onTelemetryReceived(payload.data);
          }
          break;

        case 'GEOFENCE_ALERT':
          if (payload.data && this.onGeofenceAlert) {
            this.onGeofenceAlert(payload.data);
          }
          break;

        case 'SOS_ALERT':
          if (payload.data && this.onSOSAlert) {
            this.onSOSAlert(payload.data);
          }
          break;

        case 'SPEEDING_ALERT':
          if (payload.data && this.onSpeedingAlert) {
            this.onSpeedingAlert(payload.data);
          }
          break;

        case 'MOVEMENT_ALERT':
          if (payload.data && this.onMovementAlert) {
            this.onMovementAlert(payload.data);
          }
          break;

        case 'SAFETY_ALERT':
          if (payload.data && this.onSafetyAlert) {
            this.onSafetyAlert(payload.data);
          }
          break;

        case 'ADDRESS_RESOLVED':
          if (payload.data && this.onAddressResolved) {
            this.onAddressResolved(payload.data.userId, payload.data.address);
          }
          break;

        case 'CONNECTED':
          console.log('[WS] Server confirmed circle room membership.');
          break;

        case 'CHAT_MESSAGE':
          if (payload.data && this.onChatMessage) {
            this.onChatMessage(payload.data);
          }
          break;

        case 'DIRECT_MESSAGE':
          if (payload.data && this.onDirectMessage) {
            this.onDirectMessage(payload.data);
          }
          break;

        case 'TYPING_STATUS':
          if (payload.data && this.onTypingStatus) {
            this.onTypingStatus(payload.data);
          }
          break;

        case 'DIRECT_TYPING_STATUS':
          if (payload.data && this.onDirectTypingStatus) {
            this.onDirectTypingStatus(payload.data);
          }
          break;

        case 'LIVE_REACTION':
          if (payload.data && this.onLiveReaction) {
            this.onLiveReaction(payload.data);
          }
          break;

        case 'CHECK_IN':
          if (payload.data && this.onCheckIn) {
            this.onCheckIn(payload.data);
          }
          break;

        case 'PRESENCE_CHANGE':
          if (payload.data && this.onPresenceChange) {
            this.onPresenceChange(payload.data as any);
          }
          break;

        case 'MEMBER_JOINED':
          if (payload.data && this.onMemberJoined) {
            this.onMemberJoined(payload.data);
          }
          break;

        case 'MEMBER_LEFT':
          if (payload.data && this.onMemberLeft) {
            this.onMemberLeft(payload.data);
          }
          break;

        case 'CIRCLE_UPDATED':
          if (payload.data && this.onCircleUpdated) {
            this.onCircleUpdated(payload.data);
          }
          break;

        case 'CIRCLE_META_UPDATED':
          if (payload.data && this.onCircleMetaUpdated) {
            this.onCircleMetaUpdated(payload.data);
          }
          break;

        case 'CIRCLE_DELETED':
          if (payload.data && this.onCircleDeleted) {
            this.onCircleDeleted(payload.data);
          }
          break;

        case 'PLACE_CREATED':
          if (payload.data && this.onPlaceCreated) {
            this.onPlaceCreated(payload.data);
          }
          break;

        case 'PLACE_DELETED':
          if (payload.data && this.onPlaceDeleted) {
            this.onPlaceDeleted(payload.data);
          }
          break;

        case 'NICKNAME_UPDATED':
          if (payload.data && this.onNicknameUpdated) {
            this.onNicknameUpdated(payload.data);
          }
          break;

        case 'NICKNAME_DELETED':
          if (payload.data && this.onNicknameDeleted) {
            this.onNicknameDeleted(payload.data);
          }
          break;

        case 'FAVORITES_UPDATED':
          if (payload.data && this.onFavoritesUpdated) {
            this.onFavoritesUpdated(payload.data);
          }
          break;

        case 'USER_PREFERENCES_UPDATED':
          if (payload.data && this.onUserPreferencesUpdated) {
            this.onUserPreferencesUpdated(payload.data);
          }
          break;

        case 'BUBBLE_STATUS_CHANGED':
          if (payload.data && this.onBubbleStatusChanged) {
            this.onBubbleStatusChanged(payload.data);
          }
          break;

        case 'PROFILE_UPDATED':
          if (payload.data && this.onProfileUpdated) {
            this.onProfileUpdated(payload.data);
          }
          break;

        case 'MEMBER_ROLE_UPDATED':
          if (payload.data && this.onMemberRoleUpdated) {
            this.onMemberRoleUpdated(payload.data);
          }
          break;

        case 'MEMBER_REMOVED':
          if (payload.data && this.onMemberRemoved) {
            this.onMemberRemoved(payload.data);
          }
          break;

        case 'INVITE_CODE_REGENERATED':
          if (payload.data && this.onInviteCodeRegenerated) {
            this.onInviteCodeRegenerated(payload.data);
          }
          break;

        case 'NOTIFICATION_CREATED':
          if (payload.data) {
            if (this.onNotificationCreated) {
              this.onNotificationCreated(payload.data);
            }
            try {
              const { notificationService } = require('./NotificationService');
              notificationService.triggerNotification({
                id: payload.data.id || String(Date.now()),
                type: 'info',
                title: payload.data.title,
                message: payload.data.body,
                timestamp: Date.now(),
                actionPayload: payload.data.data,
              });
            } catch (_) {}
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.warn('[WS] Failed to parse message payload:', err);
    }
  }

  public updateCircleMeta(meta: {
    circleType?: string;
    badgeEmoji?: string;
    imageUrl?: string | null;
    distanceUnit?: string;
  }): void {
    if (!this.isConnected || !this.ws) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'UPDATE_CIRCLE_META',
          circleId: this.circleId,
          ...meta,
        })
      );
    } catch (err) {
      console.warn('[WS] Failed to send UPDATE_CIRCLE_META:', err);
    }
  }

  public updateNickname(targetUserId: string, nickname: string): void {
    if (!this.isConnected || !this.ws) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'UPDATE_NICKNAME',
          circleId: this.circleId,
          userId: this.userId,
          targetUserId,
          nickname,
        })
      );
    } catch (err) {
      console.warn('[WS] Failed to send UPDATE_NICKNAME:', err);
    }
  }

  public toggleFavorite(favoriteUserId: string, isFavorite: boolean): void {
    if (!this.isConnected || !this.ws) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'TOGGLE_FAVORITE',
          circleId: this.circleId,
          userId: this.userId,
          favoriteUserId,
          isFavorite,
        })
      );
    } catch (err) {
      console.warn('[WS] Failed to send TOGGLE_FAVORITE:', err);
    }
  }

  public updatePreferences(preferences: any): void {
    if (!this.isConnected || !this.ws) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'UPDATE_PREFERENCES',
          userId: this.userId,
          ...preferences,
        })
      );
    } catch (err) {
      console.warn('[WS] Failed to send UPDATE_PREFERENCES:', err);
    }
  }

  public sendTelemetry(ping: TelemetryPing): void {
    const payload = {
      type: 'TELEMETRY_PING' as const,
      ...ping,
    };

    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {
        console.warn('[WS] Error sending telemetry ping:', e);
      }
    } else {
      // Buffer latest ping so that when the socket connects, it is flushed immediately!
      this.pendingPing = ping;
    }
  }

  public sendChatMessage(
    content: string,
    messageType: 'text' | 'preset' | 'location' = 'text',
    userName?: string,
    avatarUrl?: string | null
  ): boolean {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'CHAT_MESSAGE',
            userId: this.userId,
            circleId: this.circleId,
            content,
            messageType,
            userName,
            avatarUrl,
          })
        );
        return true;
      } catch (e) {
        console.warn('[WS] Error sending chat message:', e);
        return false;
      }
    }
    return false;
  }

  public sendDirectMessage(
    recipientId: string,
    content: string,
    messageType: 'text' | 'preset' | 'location' = 'text',
    senderName?: string,
    senderAvatar?: string | null
  ): boolean {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'DIRECT_MESSAGE',
            senderId: this.userId,
            recipientId,
            circleId: this.circleId,
            content,
            messageType,
            senderName,
            senderAvatar,
          })
        );
        return true;
      } catch (e) {
        console.warn('[WS] Error sending direct message:', e);
        return false;
      }
    }
    return false;
  }

  public sendTypingStatus(isTyping: boolean, userName: string): void {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'TYPING_STATUS',
            circleId: this.circleId,
            userId: this.userId,
            userName,
            isTyping,
          })
        );
      } catch (e) {
        console.warn('[WS] Error sending typing status:', e);
      }
    }
  }

  public sendDirectTypingStatus(
    recipientId: string,
    isTyping: boolean,
    senderName: string
  ): void {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'DIRECT_TYPING_STATUS',
            circleId: this.circleId,
            senderId: this.userId,
            recipientId,
            senderName,
            isTyping,
          })
        );
      } catch (e) {
        console.warn('[WS] Error sending direct typing status:', e);
      }
    }
  }

  public sendSOS(latitude: number, longitude: number): void {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'SOS_TRIGGER',
            userId: this.userId,
            circleId: this.circleId,
            latitude,
            longitude,
          })
        );
      } catch (e) {
        console.warn('[WS] Error sending SOS trigger:', e);
      }
    }
  }

  public sendLiveReaction(
    targetUserId: string,
    emoji: string,
    label: string,
    senderName: string
  ): boolean {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'LIVE_REACTION',
            circleId: this.circleId,
            senderId: this.userId,
            senderName,
            targetUserId,
            emoji,
            label,
            timestamp: Date.now(),
          })
        );
        return true;
      } catch (e) {
        console.warn('[WS] Error sending live reaction:', e);
      }
    }
    return false;
  }

  public sendCheckIn(
    address: string,
    latitude: number,
    longitude: number,
    userName: string
  ): boolean {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'CHECK_IN',
            circleId: this.circleId,
            userId: this.userId,
            userName,
            address,
            latitude,
            longitude,
            timestamp: Date.now(),
          })
        );
        return true;
      } catch (e) {
        console.warn('[WS] Error sending check in:', e);
      }
    }
    return false;
  }

  public joinCircle(inviteCode: string): boolean {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'JOIN_CIRCLE',
            inviteCode,
            userId: this.userId,
          })
        );
        return true;
      } catch (e) {
        console.warn('[WS] Error sending join circle:', e);
      }
    }
    return false;
  }

  public leaveCircle(): boolean {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'LEAVE_CIRCLE',
            circleId: this.circleId,
            userId: this.userId,
          })
        );
        return true;
      } catch (e) {
        console.warn('[WS] Error sending leave circle:', e);
      }
    }
    return false;
  }

  public updateBubble(active: boolean, radiusMeters = 2000, durationMinutes = 120): boolean {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'UPDATE_BUBBLE',
            circleId: this.circleId,
            userId: this.userId,
            active,
            radiusMeters,
            durationMinutes,
          })
        );
        return true;
      } catch (e) {
        console.warn('[WS] Error sending update bubble:', e);
      }
    }
    return false;
  }

  private scheduleReconnect(): void {
    if (this.isDisposedState) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public dispose(): void {
    this.isDisposedState = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnectedState = false;
  }
}
