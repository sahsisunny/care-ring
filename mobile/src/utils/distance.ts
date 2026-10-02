import { Platform, Linking } from 'react-native';
import {
  TransportMode,
  DistanceUnit,
  DistancePreferences,
  TRANSPORT_MODES,
  DEFAULT_DISTANCE_PREFERENCES,
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
 * Formats a distance in meters to a friendly string supporting Metric or Imperial:
 * Metric:
 * - < 30m: "Right here"
 * - < 1000m: "450 m away"
 * - >= 1000m: "3.2 km away"
 * Imperial:
 * - < 100ft: "Right here"
 * - < 0.1 mi: "350 ft away"
 * - >= 0.1 mi: "2.4 mi away"
 */
export function formatDistance(meters: number, unit: DistanceUnit = 'metric'): string {
  if (!meters || meters <= 0) return 'Location unknown';

  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 100) return 'Right here';
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      return `${Math.round(feet)} ft away`;
    }
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
  }

  // Metric
  if (meters < 30) return 'Right here';
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

  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 100) return '<100ft';
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      return `${Math.round(feet)}ft`;
    }
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)}mi`;
  }

  // Metric
  if (meters < 50) return '<50m';
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
}

import { routingService } from '../services/RoutingService';

export interface DistanceDisplayResult {
  rawMeters: number;
  formattedDistance: string;
  compactDistance: string;
  etaText: string | null;
  mode: TransportMode;
  icon: string;
  emoji: string;
  isRealRoute: boolean;
}

/**
 * High-level distance formatter taking user distance preferences into account.
 * Checks RoutingService for cached real-route data; if not yet cached, uses the
 * calibrated formula model and triggers a background fetch so future renders use the real route.
 */
export function getMemberDistanceDisplay(
  selfLat?: number | null,
  selfLng?: number | null,
  targetLat?: number | null,
  targetLng?: number | null,
  prefs: DistancePreferences = DEFAULT_DISTANCE_PREFERENCES,
  triggerBackgroundFetch = true
): DistanceDisplayResult | null {
  if (!selfLat || !selfLng || !targetLat || !targetLng) return null;
  if (selfLat === targetLat && selfLng === targetLng) return null;

  const mode = prefs.mode || 'car';
  const unit = prefs.unit || 'metric';
  const showEta = prefs.showEta !== false;
  const meta = TRANSPORT_MODES[mode] || TRANSPORT_MODES.car;

  // 1. Check if real route is already cached
  const cachedRoute = routingService.getCachedRoute(selfLat, selfLng, targetLat, targetLng, mode);

  let modeMeters = 0;
  let minutes: number | null = null;
  let isRealRoute = false;

  if (cachedRoute) {
    modeMeters = cachedRoute.distanceMeters;
    minutes = showEta ? cachedRoute.durationMinutes : null;
    isRealRoute = cachedRoute.isRealRoute;
  } else {
    // 2. Use formula fallback
    modeMeters = calculateModeDistanceMeters(selfLat, selfLng, targetLat, targetLng, mode);
    minutes = showEta ? calculateTravelMinutes(modeMeters, mode) : null;
    isRealRoute = mode === 'air';

    // 3. Trigger background fetch for the real route if enabled
    if (triggerBackgroundFetch && mode !== 'air') {
      routingService.getRoute(selfLat, selfLng, targetLat, targetLng, mode).catch(() => {});
    }
  }

  if (modeMeters <= 0) return null;

  const formattedDistance = formatDistance(modeMeters, unit);
  const compactDistance = formatCompactDistance(modeMeters, unit);
  const etaText = showEta ? formatTravelEta(minutes, mode) : null;

  return {
    rawMeters: modeMeters,
    formattedDistance,
    compactDistance,
    etaText,
    mode,
    icon: meta.icon,
    emoji: meta.emoji,
    isRealRoute,
  };
}

/**
 * Asynchronously fetches the exact real route distance & travel duration.
 */
export async function fetchMemberDistanceDisplay(
  selfLat?: number | null,
  selfLng?: number | null,
  targetLat?: number | null,
  targetLng?: number | null,
  prefs: DistancePreferences = DEFAULT_DISTANCE_PREFERENCES
): Promise<DistanceDisplayResult | null> {
  if (!selfLat || !selfLng || !targetLat || !targetLng) return null;
  if (selfLat === targetLat && selfLng === targetLng) return null;

  const mode = prefs.mode || 'car';
  const unit = prefs.unit || 'metric';
  const showEta = prefs.showEta !== false;
  const meta = TRANSPORT_MODES[mode] || TRANSPORT_MODES.car;

  const routeResult = await routingService.getRoute(selfLat, selfLng, targetLat, targetLng, mode);
  const modeMeters = routeResult.distanceMeters;
  const minutes = showEta ? routeResult.durationMinutes : null;

  if (modeMeters <= 0) return null;

  const formattedDistance = formatDistance(modeMeters, unit);
  const compactDistance = formatCompactDistance(modeMeters, unit);
  const etaText = showEta ? formatTravelEta(minutes, mode) : null;

  return {
    rawMeters: modeMeters,
    formattedDistance,
    compactDistance,
    etaText,
    mode,
    icon: meta.icon,
    emoji: meta.emoji,
    isRealRoute: routeResult.isRealRoute,
  };
}

/**
 * Calculates compass bearing from point 1 to point 2 in degrees (0 - 360).
 * 0° = North, 90° = East, 180° = South, 270° = West
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
 * Launches external navigation (Google Maps / Apple Maps)
 * with the destination coordinates and selected transport mode.
 */
export async function openNavigationDirections(
  latitude: number,
  longitude: number,
  label?: string,
  mode: TransportMode = 'car'
): Promise<void> {
  if (!latitude || !longitude) return;

  const encodedLabel = encodeURIComponent(label || 'Family Member');

  // Mode mapping:
  // Google Maps: travelmode = driving | bicycling | walking | transit
  // Apple Maps: dirflg = d (driving) | b (bike) | w (walking) | r (transit)
  const googleModes: Record<TransportMode, string> = {
    car: 'driving',
    bike: 'two_wheeler',
    bicycle: 'bicycling',
    walk: 'walking',
    transit: 'transit',
    air: 'driving',
  };

  const appleFlags: Record<TransportMode, string> = {
    car: 'd',
    bike: 'd',
    bicycle: 'b',
    walk: 'w',
    transit: 'r',
    air: 'd',
  };

  const googleTravelMode = googleModes[mode] || 'driving';
  const appleFlag = appleFlags[mode] || 'd';

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodedLabel}&travelmode=${googleTravelMode}`;
  const appleMapsUrl = `maps://?daddr=${latitude},${longitude}&q=${encodedLabel}&dirflg=${appleFlag}`;

  try {
    if (Platform.OS === 'ios') {
      const canOpenApple = await Linking.canOpenURL('maps://');
      if (canOpenApple) {
        await Linking.openURL(appleMapsUrl);
        return;
      }
    }
    await Linking.openURL(googleMapsUrl);
  } catch (err) {
    console.warn('[DistanceUtils] Failed to open maps navigation:', err);
    // Fallback to web Google Maps
    Linking.openURL(googleMapsUrl).catch(() => {});
  }
}
