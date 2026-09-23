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

export type OutgoingWSMessage =
  | { type: 'TELEMETRY_UPDATE'; data: TelemetryBroadcastData }
  | { type: 'GEOFENCE_ALERT'; data: GeofenceAlertData }
  | { type: 'SOS_ALERT'; data: SOSAlertData }
  | { type: 'ADDRESS_RESOLVED'; data: AddressResolvedData }
  | { type: 'ERROR'; message: string }
  | { type: 'CONNECTED'; circleId: string; userId: string };
