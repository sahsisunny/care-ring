import {
  TelemetryPing,
  TelemetryBroadcastData,
  GeofenceAlertData,
  SOSAlertData,
  AddressResolvedData,
  OutgoingWSMessage,
} from '../models/Telemetry';

export type OnTelemetryReceived = (data: TelemetryBroadcastData) => void;
export type OnGeofenceAlert = (alert: GeofenceAlertData) => void;
export type OnSOSAlert = (sos: SOSAlertData) => void;
export type OnAddressResolved = (userId: string, address: string) => void;
export type OnStatusChange = (isConnected: boolean) => void;

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

  public onTelemetryReceived?: OnTelemetryReceived;
  public onGeofenceAlert?: OnGeofenceAlert;
  public onSOSAlert?: OnSOSAlert;
  public onAddressResolved?: OnAddressResolved;
  public onStatusChange?: OnStatusChange;

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

        case 'ADDRESS_RESOLVED':
          if (payload.data && this.onAddressResolved) {
            this.onAddressResolved(payload.data.userId, payload.data.address);
          }
          break;

        case 'CONNECTED':
          console.log('[WS] Server confirmed circle room membership.');
          break;

        default:
          break;
      }
    } catch (err) {
      console.warn('[WS] Failed to parse message payload:', err);
    }
  }

  public sendTelemetry(ping: TelemetryPing): void {
    if (this.isConnectedState && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(ping));
      } catch (e) {
        console.warn('[WS] Error sending telemetry ping:', e);
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
