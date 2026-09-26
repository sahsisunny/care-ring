import {
  TelemetryPing,
  TelemetryBroadcastData,
  GeofenceAlertData,
  SOSAlertData,
  AddressResolvedData,
  SpeedingAlertData,
  MovementAlertData,
  OutgoingWSMessage,
} from '../models/Telemetry';
import { ChatMessage, DirectChatMessage, TypingEvent, DirectTypingEvent } from '../models/Chat';

export type OnTelemetryReceived = (data: TelemetryBroadcastData) => void;
export type OnGeofenceAlert = (alert: GeofenceAlertData) => void;
export type OnSOSAlert = (sos: SOSAlertData) => void;
export type OnSpeedingAlert = (alert: SpeedingAlertData) => void;
export type OnMovementAlert = (alert: MovementAlertData) => void;
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
  public onAddressResolved?: OnAddressResolved;
  public onChatMessage?: OnChatMessage;
  public onDirectMessage?: OnDirectMessage;
  public onTypingStatus?: OnTypingStatus;
  public onDirectTypingStatus?: OnDirectTypingStatus;
  public onLiveReaction?: OnLiveReaction;
  public onCheckIn?: OnCheckIn;
  public onStatusChange?: OnStatusChange;
  public onPresenceChange?: OnPresenceChange;

  constructor(options: {
    serverUrl: string;
    circleId: string;
    userId: string;
    fallbackUrls?: string[];
  }) {
    this.serverUrl = options.serverUrl;
    this.circleId = options.circleId;
    this.userId = options.userId;

    const defaults = [
      options.serverUrl,
      'ws://127.0.0.1:4000',
      'ws://localhost:4000',
      'ws://10.0.2.2:4000',
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
        console.log('[WS] Connection closed. Rotating candidate url in 3s...');
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

        default:
          break;
      }
    } catch (err) {
      console.warn('[WS] Failed to parse message payload:', err);
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
    messageType: 'text' | 'preset' | 'location' = 'text'
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
    messageType: 'text' | 'preset' | 'location' = 'text'
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
