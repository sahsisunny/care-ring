export interface TelemetryPing {
  type?: 'TELEMETRY_PING';
  userId: string;
  circleId: string;
  userName?: string;
  latitude: number;
  longitude: number;
  speed: number;        // in km/h
  heading: number;      // 0 - 360 degrees
  batteryLevel: number; // 0 - 100
  isCharging: boolean;
  timestamp: number;    // epoch ms
  accuracy?: number;    // meters
  altitude?: number;    // meters
}

export interface TelemetryBroadcastData extends TelemetryPing {
  resolvedAddress?: string | null;
  isStationary: boolean;
  stationarySince?: string | null;
  avatarUrl?: string | null;
}

export interface GeofenceAlertData {
  userId: string;
  userName: string;
  placeId: string;
  placeName: string;
  event: 'ENTER' | 'EXIT';
  timestamp: number;
}

export interface SOSAlertData {
  userId: string;
  userName: string;
  phone?: string | null;
  circleId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface AddressResolvedData {
  userId: string;
  circleId: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SpeedingAlertData {
  userId: string;
  userName: string;
  speed: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface MovementAlertData {
  userId: string;
  userName: string;
  speed: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export type OutgoingWSMessage =
  | { type: 'TELEMETRY_UPDATE'; data: TelemetryBroadcastData }
  | { type: 'GEOFENCE_ALERT'; data: GeofenceAlertData }
  | { type: 'SOS_ALERT'; data: SOSAlertData }
  | { type: 'ADDRESS_RESOLVED'; data: AddressResolvedData }
  | { type: 'SPEEDING_ALERT'; data: SpeedingAlertData }
  | { type: 'MOVEMENT_ALERT'; data: MovementAlertData }
  | { type: 'CHAT_MESSAGE'; data: any }
  | { type: 'DIRECT_MESSAGE'; data: any }
  | { type: 'TYPING_STATUS'; data: any }
  | { type: 'DIRECT_TYPING_STATUS'; data: any }
  | { type: 'LIVE_REACTION'; data: any }
  | { type: 'CHECK_IN'; data: any }
  | { type: 'ERROR'; message: string }
  | { type: 'CONNECTED'; circleId: string; userId: string };
