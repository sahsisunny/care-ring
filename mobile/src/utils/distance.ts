import { Platform, Linking } from 'react-native';
import {
  TransportMode,
  DistanceUnit,
  DistancePreferences,
  TRANSPORT_MODES,
  DEFAULT_DISTANCE_PREFERENCES,
} from '../services/DistancePreferencesService';
import { routingService, RouteResult } from '../services/RoutingService';
import {
  calculateDistanceMeters,
  calculateModeDistanceMeters,
  calculateTravelMinutes,
  formatTravelEta,
  NEARBY_THRESHOLD_METERS,
  formatDistance,
  formatCompactDistance,
  calculateBearing,
} from './geoMath';

// Re-export all pure geometric math functions & constants so consumers don't break
export {
  calculateDistanceMeters,
  calculateModeDistanceMeters,
  calculateTravelMinutes,
  formatTravelEta,
  NEARBY_THRESHOLD_METERS,
  formatDistance,
  formatCompactDistance,
  calculateBearing,
};

export interface DistanceDisplayResult {
  rawMeters: number;
  isNearby: boolean;
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

  const isNearby = modeMeters <= NEARBY_THRESHOLD_METERS;
  const formattedDistance = formatDistance(modeMeters, unit);
  const compactDistance = formatCompactDistance(modeMeters, unit);
  const etaText = showEta && minutes !== null ? formatTravelEta(minutes, mode) : null;

  return {
    rawMeters: Math.round(modeMeters),
    isNearby,
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
 * Async version of getMemberDistanceDisplay that awaits the real OSRM road route
 * if not already cached.
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

  const routeResult: RouteResult = await routingService.getRoute(
    selfLat,
    selfLng,
    targetLat,
    targetLng,
    mode
  );

  const modeMeters = routeResult.distanceMeters;
  if (modeMeters <= 0) return null;

  const minutes = showEta ? routeResult.durationMinutes : null;
  const isNearby = modeMeters <= NEARBY_THRESHOLD_METERS;
  const formattedDistance = formatDistance(modeMeters, unit);
  const compactDistance = formatCompactDistance(modeMeters, unit);
  const etaText = showEta && minutes !== null ? formatTravelEta(minutes, mode) : null;

  return {
    rawMeters: Math.round(modeMeters),
    isNearby,
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
    Linking.openURL(googleMapsUrl).catch(() => {});
  }
}
