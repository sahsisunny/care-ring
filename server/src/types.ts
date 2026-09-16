// Telemetry payload sent from the mobile client
export interface TelemetryPing {
  userId: string;
  circleId: string;
  latitude: number;
  longitude: number;
  speed: number;        // in km/h
  heading: number;      // 0 - 360 degrees
  batteryLevel: number; // 0 - 100
  isCharging: boolean;
  timestamp: number;    // epoch milliseconds
  accuracy?: number;    // meters
  altitude?: number;    // meters
}

// Outgoing fan-out broadcast sent to all circle sockets
export interface TelemetryBroadcastMessage {
  type: 'TELEMETRY_UPDATE';
  data: TelemetryPing & {
    resolvedAddress?: string | null;
    isStationary: boolean;
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

export type OutgoingWSMessage = 
  | TelemetryBroadcastMessage 
  | GeofenceAlertMessage 
  | SOSAlertMessage 
  | AddressResolvedMessage
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
