import axios from 'axios';
import { query } from '../db';

export interface GeocodeResult {
  title: string;
  address: string;
}

// In-memory geocode cache to avoid duplicate external API calls
const geocodeCache = new Map<string, { result: GeocodeResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let isTableInitialized = false;
async function ensureDbCacheTable() {
  if (isTableInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS geocode_cache (
        lat_round NUMERIC(7, 4) NOT NULL,
        lng_round NUMERIC(7, 4) NOT NULL,
        title TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lat_round, lng_round)
      )
    `);
    isTableInitialized = true;
  } catch (err) {
    // Suppress if already exists or permission
    isTableInitialized = true;
  }
}

/**
 * Quantize coordinate key to ~10-20 meters precision for spatial cache hit
 */
const getCacheKey = (lat: number, lng: number): string => {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
};

/**
 * Checks if a string is a raw latitude/longitude coordinate pair
 */
export const isCoordinateString = (val?: string | null): boolean => {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    /^-?\d{1,3}\.\d+[\s,]+-?\d{1,3}\.\d+$/.test(trimmed) ||
    /^(?:Near|Location|Coordinates?|Stop \d+:)\s*\(?-?\d{1,3}\.\d+[\s,]+-?\d{1,3}\.\d+\)?$/i.test(trimmed)
  );
};

/**
 * Cleans an address string to extract the primary human-readable place title
 */
export const extractLocationTitle = (address: string): string => {
  if (!address || isCoordinateString(address)) return 'Visited Place';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return 'Visited Place';
  return parts[0];
};

/**
 * Looks up purely from in-memory or database cache with ZERO external API calls.
 */
export async function lookupCachedGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const cacheKey = getCacheKey(lat, lng);
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    await ensureDbCacheTable();
    const latRound = parseFloat(lat.toFixed(4));
    const lngRound = parseFloat(lng.toFixed(4));
    const rows = await query<{ title: string; address: string }>(
      `SELECT title, address FROM geocode_cache WHERE lat_round = $1 AND lng_round = $2`,
      [latRound, lngRound]
    );
    if (rows && rows.length > 0) {
      const res: GeocodeResult = { title: rows[0].title, address: rows[0].address };
      geocodeCache.set(cacheKey, { result: res, timestamp: Date.now() });
      return res;
    }
  } catch {
    // Ignore DB errors
  }

  return null;
}

async function saveToDbCache(latRound: number, lngRound: number, title: string, address: string) {
  try {
    await ensureDbCacheTable();
    await query(
      `
      INSERT INTO geocode_cache (lat_round, lng_round, title, address)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (lat_round, lng_round) DO UPDATE 
      SET title = EXCLUDED.title, address = EXCLUDED.address
      `,
      [latRound, lngRound, title, address]
    );
  } catch {
    // Ignore DB errors
  }
}

/**
 * Reverse geocodes coordinates to a human-readable place title and full address.
 * Checked against memory cache -> DB cache -> only on stationary detection does it call external API.
 */
export async function reverseGeocodeWithTitle(lat: number, lng: number): Promise<GeocodeResult> {
  // 1. Check in-memory cache
  const cacheKey = getCacheKey(lat, lng);
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // 2. Check persistent DB cache (0 external API cost)
  const dbResult = await lookupCachedGeocode(lat, lng);
  if (dbResult) {
    return dbResult;
  }

  const latRound = parseFloat(lat.toFixed(4));
  const lngRound = parseFloat(lng.toFixed(4));
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Google Maps Geocoding if configured
  if (googleApiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`;
      const response = await axios.get(url, { timeout: 3500 });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const first = response.data.results[0];
        const formatted = first.formatted_address || '';
        const title = first.address_components?.[0]?.long_name || formatted.split(',')[0] || 'Saved Place';
        const result: GeocodeResult = { title, address: formatted };
        geocodeCache.set(cacheKey, { result, timestamp: Date.now() });
        saveToDbCache(latRound, lngRound, title, formatted);
        return result;
      }
    } catch {
      // Fall through to Photon
    }
  }

  // 2. Photon API (Fast OSM spatial reverse geocoder with POI / street / city breakdown)
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const response = await axios.get(photonUrl, {
      timeout: 3500,
      headers: { 'Accept': 'application/json', 'User-Agent': 'CareRing-App/1.0' },
    });

    if (response.data && Array.isArray(response.data.features) && response.data.features.length > 0) {
      const props = response.data.features[0].properties || {};
      const name = props.name;
      const street = props.street;
      const housenumber = props.housenumber;
      const district = props.district || props.suburb || props.locality;
      const city = props.city || props.town || props.village;
      const state = props.state;

      const title = name || (street ? [housenumber, street].filter(Boolean).join(' ') : district || city || 'Place Location');
      const addressParts = [
        name && name !== street ? name : null,
        [housenumber, street].filter(Boolean).join(' '),
        district,
        city,
        state,
      ].filter(Boolean);

      const address = addressParts.length > 0 ? addressParts.join(', ') : title;
      const result: GeocodeResult = { title, address };
      geocodeCache.set(cacheKey, { result, timestamp: Date.now() });
      saveToDbCache(latRound, lngRound, title, address);
      return result;
    }
  } catch {
    // Fall through to Nominatim
  }

  // 3. Nominatim (OpenStreetMap) fallback
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'CareRing-App/1.0 (contact@carering.app)',
        'Accept': 'application/json',
      },
      timeout: 4000,
    });

    if (response.data && response.data.display_name) {
      const addr = response.data.address || {};
      const amenity = addr.amenity || addr.shop || addr.building || addr.tourism || addr.leisure;
      const road = addr.road || addr.pedestrian || addr.street;
      const houseNumber = addr.house_number || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.city_district || addr.residential;
      const city = addr.city || addr.town || addr.village;

      const title = amenity || road || suburb || city || 'Visited Place';
      const streetPart = [houseNumber, road].filter(Boolean).join(' ');
      const address = [amenity, streetPart, suburb, city].filter(Boolean).join(', ') || response.data.display_name;

      const result: GeocodeResult = { title, address };
      geocodeCache.set(cacheKey, { result, timestamp: Date.now() });
      saveToDbCache(latRound, lngRound, title, address);
      return result;
    }
  } catch {
    // Both failed
  }

  // 4. Safe fallback: human-readable location description (NEVER raw lat/lng numbers)
  const result: GeocodeResult = {
    title: 'Visited Place',
    address: 'Local Neighborhood Location',
  };
  geocodeCache.set(cacheKey, { result, timestamp: Date.now() });
  saveToDbCache(latRound, lngRound, result.title, result.address);
  return result;
}

/**
 * Reverse geocodes coordinates to a human-readable address string.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await reverseGeocodeWithTitle(lat, lng);
  return res.address;
}

