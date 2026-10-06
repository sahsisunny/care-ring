/**
 * LocationSearchService.ts
 *
 * Fast location search and nearby place resolution using:
 * 1. Circle saved places (Home, Office, College, etc.)
 * 2. Photon API (OpenStreetMap-based spatial geocoder by Komoot)
 * 3. Nominatim API fallback with spatial radius weighting
 */

import * as Location from 'expo-location';

export interface LocationSearchResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: 'home' | 'work' | 'school' | 'gym' | 'other';
  isSavedPlace?: boolean;
}

// In-memory cache for search queries to prevent duplicate network hits
const searchCache = new Map<string, { data: LocationSearchResult[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class LocationSearchService {
  /**
   * Search places by query string with proximity bias to user's current GPS position.
   */
  public async searchPlaces(
    query: string,
    userLat?: number,
    userLng?: number,
    savedPlaces: any[] = []
  ): Promise<LocationSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 1) return [];

    const cacheKey = `${trimmed.toLowerCase()}_${userLat?.toFixed(2) || '0'}_${userLng?.toFixed(2) || '0'}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const results: LocationSearchResult[] = [];
    const seenIds = new Set<string>();

    // 1. Check circle saved places first for instant matches (Home, Office, etc.)
    if (Array.isArray(savedPlaces)) {
      const qLower = trimmed.toLowerCase();
      savedPlaces.forEach((sp) => {
        const spName = (sp.name || sp.category || '').toLowerCase();
        const spAddr = (sp.address || '').toLowerCase();
        if (spName.includes(qLower) || spAddr.includes(qLower)) {
          const id = `saved-${sp.id || sp.name}`;
          if (!seenIds.has(id) && typeof sp.latitude === 'number' && typeof sp.longitude === 'number') {
            seenIds.add(id);
            results.push({
              id,
              name: sp.name || sp.category || 'Saved Place',
              address: sp.address || 'Circle Saved Place',
              latitude: Number(sp.latitude),
              longitude: Number(sp.longitude),
              category: sp.category || 'other',
              isSavedPlace: true,
            });
          }
        }
      });
    }

    // 2. Query Photon API (Sub-200ms latency, supports proximity biasing)
    try {
      let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=12`;
      if (typeof userLat === 'number' && typeof userLng === 'number' && !isNaN(userLat) && !isNaN(userLng)) {
        photonUrl += `&lat=${userLat}&lon=${userLng}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const resp = await fetch(photonUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json.features)) {
          for (const feat of json.features) {
            const props = feat.properties || {};
            const coords = feat.geometry?.coordinates;
            if (Array.isArray(coords) && coords.length >= 2) {
              const lng = Number(coords[0]);
              const lat = Number(coords[1]);
              if (isNaN(lat) || isNaN(lng)) continue;

              const id = `photon-${props.osm_id || `${lat}_${lng}`}`;
              if (seenIds.has(id)) continue;
              seenIds.add(id);

              const name = props.name || props.street || props.city || trimmed;
              const addrParts = [
                props.housenumber,
                props.street,
                props.district || props.suburb || props.locality,
                props.city || props.town || props.village,
                props.state,
              ].filter(Boolean);

              const address = addrParts.length > 0 ? addrParts.join(', ') : (props.country || '');
              
              let cat: 'home' | 'work' | 'school' | 'gym' | 'other' = 'other';
              const osmVal = (props.osm_value || '').toLowerCase();
              const osmKey = (props.osm_key || '').toLowerCase();
              const nameLower = name.toLowerCase();

              if (nameLower.includes('home') || nameLower.includes('residence') || osmVal.includes('residential')) {
                cat = 'home';
              } else if (nameLower.includes('office') || nameLower.includes('work') || osmVal.includes('commercial') || osmKey.includes('office')) {
                cat = 'work';
              } else if (nameLower.includes('school') || nameLower.includes('college') || nameLower.includes('univ') || osmVal.includes('school')) {
                cat = 'school';
              } else if (nameLower.includes('gym') || nameLower.includes('fitness') || osmVal.includes('sports_centre')) {
                cat = 'gym';
              }

              results.push({
                id,
                name,
                address,
                latitude: lat,
                longitude: lng,
                category: cat,
                isSavedPlace: false,
              });
            }
          }
        }
      }
    } catch {
      // Fall through to Nominatim fallback if Photon is unavailable
    }

    // 3. Fallback to Nominatim if results are sparse
    if (results.length < 3) {
      try {
        let nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=8&addressdetails=1`;
        if (typeof userLat === 'number' && typeof userLng === 'number') {
          // Bounding box ~ 0.5 degrees around user for proximity
          const delta = 0.45;
          nomUrl += `&viewbox=${userLng - delta},${userLat + delta},${userLng + delta},${userLat - delta}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const resp = await fetch(nomUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'CareRing-App/1.0',
            'Accept': 'application/json',
          },
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json)) {
            for (const item of json) {
              const lat = Number(item.lat);
              const lng = Number(item.lon);
              const id = `nom-${item.place_id || `${lat}_${lng}`}`;
              if (seenIds.has(id) || isNaN(lat) || isNaN(lng)) continue;
              seenIds.add(id);

              const name = item.name || item.display_name?.split(',')[0] || trimmed;
              const addr = item.display_name?.split(',').slice(1, 4).join(',').trim() || '';

              results.push({
                id,
                name,
                address: addr,
                latitude: lat,
                longitude: lng,
                category: 'other',
                isSavedPlace: false,
              });
            }
          }
        }
      } catch {
        // Ignore fallback errors
      }
    }

    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  }

  /**
   * Returns nearby places for Check-In modal:
   * Combines circle saved places (Home, Work, etc.) with local reverse-geocoded POIs.
   */
  public async getNearbyPlaces(
    lat: number,
    lng: number,
    savedPlaces: any[] = []
  ): Promise<LocationSearchResult[]> {
    const list: LocationSearchResult[] = [];
    const seenIds = new Set<string>();

    // 1. Circle Saved Places (Home, Office, College, etc.)
    if (Array.isArray(savedPlaces)) {
      savedPlaces.forEach((sp) => {
        if (typeof sp.latitude === 'number' && typeof sp.longitude === 'number') {
          const id = `saved-${sp.id || sp.name}`;
          seenIds.add(id);
          list.push({
            id,
            name: sp.name || sp.category || 'Saved Place',
            address: sp.address || 'Circle Saved Place',
            latitude: Number(sp.latitude),
            longitude: Number(sp.longitude),
            category: sp.category || 'home',
            isSavedPlace: true,
          });
        }
      });
    }

    // 2. Fetch nearby places around current coordinates via reverse geocoding & local points
    try {
      const revUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(revUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CareRing-App/1.0',
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.street;
        const sub = addr.suburb || addr.neighbourhood || addr.city_district || addr.residential;
        const city = addr.city || addr.town || addr.village || addr.county;
        const state = addr.state;

        const mainLoc = road || sub || city || 'Current Location';
        const subLoc = [sub, city, state].filter(Boolean).filter((s) => s !== mainLoc).join(', ');

        const curId = `cur-${lat.toFixed(4)}_${lng.toFixed(4)}`;
        if (!seenIds.has(curId)) {
          seenIds.add(curId);
          list.push({
            id: curId,
            name: mainLoc,
            address: subLoc || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            latitude: lat,
            longitude: lng,
            category: 'other',
            isSavedPlace: false,
          });
        }
      }
    } catch {
      // Ignore reverse error
    }

    // 3. Query Photon with local city/area for nearby landmarks
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=point&lat=${lat}&lon=${lng}&limit=8`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(photonUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json.features)) {
          for (const feat of json.features) {
            const props = feat.properties || {};
            const coords = feat.geometry?.coordinates;
            if (Array.isArray(coords) && coords.length >= 2) {
              const pLng = Number(coords[0]);
              const pLat = Number(coords[1]);
              const id = `nearby-${props.osm_id || `${pLat}_${pLng}`}`;
              if (seenIds.has(id) || !props.name) continue;
              seenIds.add(id);

              const addrParts = [
                props.street,
                props.district || props.suburb,
                props.city || props.town,
              ].filter(Boolean);

              list.push({
                id,
                name: props.name,
                address: addrParts.join(', ') || props.state || '',
                latitude: pLat,
                longitude: pLng,
                category: 'other',
                isSavedPlace: false,
              });
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    return list;
  }

  /**
   * Reverse geocodes coordinates to a human-readable title and full address.
   * Caches results in memory using quantized coordinates (~30m radius).
   */
  public async reverseGeocode(
    lat: number,
    lng: number
  ): Promise<{ title: string; address: string } | null> {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return null;
    }

    const key = `rev_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && cached.data.length > 0) {
      return { title: cached.data[0].name, address: cached.data[0].address };
    }

    // 1. Try native expo-location reverse geocoder (fast, on-device Apple Maps / Google Play geocoder)
    try {
      const geoResults = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (Array.isArray(geoResults) && geoResults.length > 0) {
        const first = geoResults[0];
        const street = first.street || first.name;
        const district = first.district || first.subregion;
        const city = first.city;
        const region = first.region;

        const title = street || district || city || 'Location';
        const parts = [street, district, city, region].filter(Boolean);
        const uniqueParts = parts.filter((item, idx) => parts.indexOf(item) === idx);
        const address = uniqueParts.join(', ');

        const res = { title, address: address || title };
        searchCache.set(key, {
          data: [{ id: key, name: res.title, address: res.address, latitude: lat, longitude: lng }],
          timestamp: Date.now(),
        });
        return res;
      }
    } catch {
      // Fall through to Nominatim/Photon
    }

    // 2. Try Nominatim
    try {
      const revUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(revUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CareRing-App/1.0',
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.street;
        const sub = addr.suburb || addr.neighbourhood || addr.city_district;
        const city = addr.city || addr.town || addr.village;
        const state = addr.state;

        const title = road || sub || city || 'Location';
        const parts = [road, sub, city, state].filter(Boolean);
        const uniqueParts = parts.filter((item, idx) => parts.indexOf(item) === idx);
        const address = uniqueParts.join(', ') || data.display_name || title;

        const res = { title, address };
        searchCache.set(key, {
          data: [{ id: key, name: res.title, address: res.address, latitude: lat, longitude: lng }],
          timestamp: Date.now(),
        });
        return res;
      }
    } catch {
      // Fall through
    }

    return null;
  }
}

export const locationSearchService = new LocationSearchService();
