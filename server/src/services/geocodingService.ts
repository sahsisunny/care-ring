import axios from 'axios';

// In-memory geocode cache to avoid duplicate external API calls
const geocodeCache = new Map<string, { address: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Quantize coordinate key to ~10-20 meters precision for spatial cache hit
 */
const getCacheKey = (lat: number, lng: number): string => {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
};

/**
 * Reverse geocodes coordinates to a human-readable address.
 * Uses Google Geocoding API if configured, otherwise falls back to OpenStreetMap Nominatim.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const cacheKey = getCacheKey(lat, lng);
  const cached = geocodeCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.address;
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const provider = process.env.GEOCODING_PROVIDER || (googleApiKey ? 'google' : 'nominatim');

  try {
    let resolvedAddress = '';

    if (provider === 'google' && googleApiKey) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`;
      const response = await axios.get(url, { timeout: 4000 });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        resolvedAddress = response.data.results[0].formatted_address;
      }
    } else {
      // Nominatim free fallback (OpenStreetMap)
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Life360-MVP-Engineering-Demo/1.0',
        },
        timeout: 4000,
      });

      if (response.data && response.data.display_name) {
        // Extract street name, road, and neighborhood if available for brevity
        const addr = response.data.address;
        if (addr) {
          const street = addr.road || addr.pedestrian || addr.street;
          const houseNumber = addr.house_number || '';
          const neighborhood = addr.neighbourhood || addr.suburb || addr.city_district;
          const city = addr.city || addr.town || addr.village;

          if (street) {
            resolvedAddress = [houseNumber, street, neighborhood || city].filter(Boolean).join(' ');
          } else {
            resolvedAddress = response.data.display_name.split(',').slice(0, 3).join(', ');
          }
        } else {
          resolvedAddress = response.data.display_name.split(',').slice(0, 3).join(', ');
        }
      }
    }

    if (!resolvedAddress) {
      resolvedAddress = `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    geocodeCache.set(cacheKey, { address: resolvedAddress, timestamp: Date.now() });
    return resolvedAddress;
  } catch (error) {
    console.error(`[Geocoding] Failed to reverse geocode (${lat}, ${lng}):`, (error as Error).message);
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}
