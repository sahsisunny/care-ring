import { Platform, Linking } from 'react-native';

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
 * Formats a distance in meters to a friendly string:
 * - < 50m: "Nearby (<50 m)"
 * - < 1000m: "450 m away"
 * - >= 1000m: "3.2 km away"
 */
export function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return 'Location unknown';
  if (meters < 30) return 'Right here';
  if (meters < 1000) {
    return `${Math.round(meters)} m away`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km away`;
}

/**
 * Compact distance for pill tags: e.g. "450m" or "3.2km"
 */
export function formatCompactDistance(meters: number): string {
  if (!meters || meters <= 0) return '';
  if (meters < 50) return '<50m';
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
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
 * with the destination coordinates.
 */
export async function openNavigationDirections(
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> {
  if (!latitude || !longitude) return;

  const encodedLabel = encodeURIComponent(label || 'Family Member');
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodedLabel}`;
  const appleMapsUrl = `maps://?daddr=${latitude},${longitude}&q=${encodedLabel}`;

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
