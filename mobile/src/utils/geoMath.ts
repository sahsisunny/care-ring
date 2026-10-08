import {
  TransportMode,
  DistanceUnit,
  TRANSPORT_MODES,
} from '../services/DistancePreferencesService';

/**
 * Calculates geodesic distance between two points in meters using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates distance adjusted for the chosen transport mode (e.g. road factor).
 */
export function calculateModeDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  mode: TransportMode = 'car'
): number {
  const straightMeters = calculateDistanceMeters(lat1, lon1, lat2, lon2);
  if (straightMeters <= 0) return 0;

  const meta = TRANSPORT_MODES[mode] || TRANSPORT_MODES.car;
  return straightMeters * meta.factor;
}

/**
 * Calculates estimated travel duration in minutes based on distance and mode.
 */
export function calculateTravelMinutes(
  distanceMeters: number,
  mode: TransportMode = 'car'
): number | null {
  if (!distanceMeters || distanceMeters <= 0) return null;
  const meta = TRANSPORT_MODES[mode] || TRANSPORT_MODES.car;
  if (!meta.speedKmh || meta.speedKmh <= 0) return null;

  const distanceKm = distanceMeters / 1000;
  const hours = distanceKm / meta.speedKmh;
  const minutes = Math.round(hours * 60);
  return Math.max(1, minutes);
}

/**
 * Friendly ETA description based on mode and travel minutes.
 */
export function formatTravelEta(minutes: number | null, mode: TransportMode = 'car'): string | null {
  if (minutes === null || minutes === undefined) return null;

  const suffixMap: Record<TransportMode, string> = {
    car: 'drive',
    bike: 'ride',
    bicycle: 'cycle',
    walk: 'walk',
    transit: 'transit',
    air: 'direct',
  };

  const suffix = suffixMap[mode] || 'away';

  if (minutes < 1) {
    return `< 1 min ${suffix}`;
  }
  if (minutes < 60) {
    return `${minutes}m ${suffix}`;
  }
  const hrs = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hrs}h ${suffix}`;
  }
  return `${hrs}h ${remainingMins}m ${suffix}`;
}

/**
 * Fixed threshold radius (in meters) under which members are considered co-located/nearby.
 */
export const NEARBY_THRESHOLD_METERS = 100;

/**
 * Formats a distance in meters to a friendly string supporting Metric or Imperial:
 */
export function formatDistance(meters: number, unit: DistanceUnit = 'metric'): string {
  if (!meters || meters <= 0) return 'Location unknown';
  if (meters <= NEARBY_THRESHOLD_METERS) return 'Nearby';

  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      return `${Math.round(feet)} ft away`;
    }
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
  }

  // Metric
  if (meters < 1000) {
    return `${Math.round(meters)} m away`;
  }
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/**
 * Compact distance for pill tags: e.g. "450m", "3.2km" or "350ft", "2.4mi"
 */
export function formatCompactDistance(meters: number, unit: DistanceUnit = 'metric'): string {
  if (!meters || meters <= 0) return '';
  if (meters <= NEARBY_THRESHOLD_METERS) return 'Nearby';

  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      return `${Math.round(feet)}ft`;
    }
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)}mi`;
  }

  // Metric
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
}

/**
 * Calculates compass bearing from point 1 to point 2 in degrees (0 - 360).
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Formats vehicle or user speed in km/h or mph according to user unit preference.
 */
export function formatSpeed(speedKmh: number, unit: DistanceUnit = 'metric'): string {
  if (!speedKmh || speedKmh <= 0) return unit === 'imperial' ? '0 mph' : '0 km/h';
  if (unit === 'imperial') {
    const mph = Math.round(speedKmh * 0.621371);
    return `${mph} mph`;
  }
  return `${Math.round(speedKmh)} km/h`;
}

/**
 * Formats a geofence radius (meters) appropriately for geofence displays:
 * e.g. "200 m", "1.5 km", or "650 ft", "1.0 mi".
 */
export function formatGeofenceRadius(radiusMeters: number, unit: DistanceUnit = 'metric'): string {
  if (unit === 'imperial') {
    const feet = Math.round(radiusMeters * 3.28084);
    if (feet < 1000) return `${feet} ft`;
    const miles = radiusMeters / 1609.344;
    return `${miles >= 10 ? Math.round(miles) : miles.toFixed(1)} mi`;
  }
  if (radiusMeters >= 1000) {
    const km = radiusMeters / 1000;
    return `${km.toFixed(km % 1 === 0 ? 0 : 1)} km`;
  }
  return `${Math.round(radiusMeters)} m`;
}
