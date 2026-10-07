import { TransportMode, TRANSPORT_MODES } from './DistancePreferencesService';
import { calculateDistanceMeters, calculateModeDistanceMeters, calculateTravelMinutes } from '../utils/geoMath';

export interface RouteResult {
  distanceMeters: number;
  durationMinutes: number | null;
  isRealRoute: boolean;
  source: 'osrm' | 'fallback' | 'air';
}

interface CacheEntry {
  result: RouteResult;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const ROUTE_TIMEOUT_MS = 3500; // 3.5s timeout for network resilience

class RoutingService {
  private cache: Map<string, CacheEntry> = new Map();
  private inFlightRequests: Map<string, Promise<RouteResult>> = new Map();

  /**
   * Quantize coordinates to ~100m precision so minor GPS jitter hits the cache
   */
  private getCacheKey(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: TransportMode
  ): string {
    return `${fromLat.toFixed(3)},${fromLng.toFixed(3)}->${toLat.toFixed(3)},${toLng.toFixed(3)}_${mode}`;
  }

  /**
   * Synchronously checks if a cached route is available.
   */
  public getCachedRoute(
    fromLat?: number | null,
    fromLng?: number | null,
    toLat?: number | null,
    toLng?: number | null,
    mode: TransportMode = 'car'
  ): RouteResult | null {
    if (!fromLat || !fromLng || !toLat || !toLng) return null;
    const key = this.getCacheKey(fromLat, fromLng, toLat, toLng, mode);
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.result;
    }
    return null;
  }

  /**
   * Calculates formula-based fallback when offline or timeout occurs.
   */
  public getFallbackRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: TransportMode
  ): RouteResult {
    if (mode === 'air') {
      const airMeters = calculateDistanceMeters(fromLat, fromLng, toLat, toLng);
      return {
        distanceMeters: airMeters,
        durationMinutes: null,
        isRealRoute: true,
        source: 'air',
      };
    }

    const fallbackMeters = calculateModeDistanceMeters(fromLat, fromLng, toLat, toLng, mode);
    const fallbackMins = calculateTravelMinutes(fallbackMeters, mode);
    return {
      distanceMeters: fallbackMeters,
      durationMinutes: fallbackMins,
      isRealRoute: false,
      source: 'fallback',
    };
  }

  /**
   * Fetches real route distance and ETA based on road network navigation.
   * - Car: queries road turn-by-turn route and actual driving duration
   * - Bike: queries cycling-compatible road route and computes cycling duration
   * - Walk: queries walkable road/pathway route and computes walking duration
   * - Air: direct geodesic line
   */
  public async getRoute(
    fromLat?: number | null,
    fromLng?: number | null,
    toLat?: number | null,
    toLng?: number | null,
    mode: TransportMode = 'car'
  ): Promise<RouteResult> {
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return { distanceMeters: 0, durationMinutes: null, isRealRoute: false, source: 'fallback' };
    }

    // Direct air straight-line does not use road network
    if (mode === 'air') {
      const airMeters = calculateDistanceMeters(fromLat, fromLng, toLat, toLng);
      return {
        distanceMeters: airMeters,
        durationMinutes: null,
        isRealRoute: true,
        source: 'air',
      };
    }

    const key = this.getCacheKey(fromLat, fromLng, toLat, toLng, mode);

    // 1. Check valid cache hit
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }

    // 2. In-flight request de-duplication
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    // 3. Initiate route fetch
    const fetchPromise = this.fetchFromRouter(fromLat, fromLng, toLat, toLng, mode, key);
    this.inFlightRequests.set(key, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.inFlightRequests.delete(key);
    }
  }

  private async fetchFromRouter(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: TransportMode,
    cacheKey: string
  ): Promise<RouteResult> {
    // Controller for request timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);

    try {
      // OSRM accepts lng,lat;lng,lat
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
      const response = await fetch(osrmUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CareRing-Mobile/1.0',
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status}`);
      }

      const data = await response.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const rawDistanceMeters: number = route.distance || 0;
        const rawDrivingSeconds: number = route.duration || 0;

        let distanceMeters = rawDistanceMeters;
        let durationMinutes: number | null = null;

        if (mode === 'car') {
          distanceMeters = rawDistanceMeters;
          durationMinutes = Math.max(1, Math.round(rawDrivingSeconds / 60));
        } else if (mode === 'bike') {
          // Bike / Motorcycle: two-wheelers navigate road traffic with agile speed (~38 km/h)
          distanceMeters = rawDistanceMeters;
          const bikeHours = (distanceMeters / 1000) / (TRANSPORT_MODES.bike.speedKmh || 38);
          const bikeMinutes = Math.round(Math.min((rawDrivingSeconds / 60) * 0.85, bikeHours * 60));
          durationMinutes = Math.max(1, bikeMinutes);
        } else if (mode === 'bicycle') {
          // Bicycle: pedal cycle routes via roads and paths (~16 km/h)
          distanceMeters = Math.round(rawDistanceMeters * 0.96);
          const cyclingHours = (distanceMeters / 1000) / (TRANSPORT_MODES.bicycle.speedKmh || 16);
          durationMinutes = Math.max(1, Math.round(cyclingHours * 60));
        } else if (mode === 'walk') {
          // Pedestrians use walkways / footpaths (~0.92x of motor vehicle road length)
          distanceMeters = Math.round(rawDistanceMeters * 0.92);
          // 4.8 km/h walking speed on actual pedestrian pathway
          const walkHours = (distanceMeters / 1000) / (TRANSPORT_MODES.walk.speedKmh || 4.8);
          durationMinutes = Math.max(1, Math.round(walkHours * 60));
        } else if (mode === 'transit') {
          distanceMeters = Math.round(rawDistanceMeters * 1.12);
          const transitHours = (distanceMeters / 1000) / (TRANSPORT_MODES.transit.speedKmh || 24);
          durationMinutes = Math.max(2, Math.round(transitHours * 60 + 4)); // +4m boarding/stop buffer
        }

        const result: RouteResult = {
          distanceMeters,
          durationMinutes,
          isRealRoute: true,
          source: 'osrm',
        };

        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      throw new Error(`OSRM non-ok code: ${data.code}`);
    } catch (err) {
      clearTimeout(timer);
      // Fallback on timeout or network error without breaking UI
      const fallback = this.getFallbackRoute(fromLat, fromLng, toLat, toLng, mode);
      // Store in cache for 30s to prevent rapid re-fetching during transient offline
      this.cache.set(cacheKey, { result: fallback, timestamp: Date.now() - (CACHE_TTL_MS - 30000) });
      return fallback;
    }
  }

  /**
   * Pre-fetches routes in background for a batch of members.
   */
  public prefetchRoutes(
    fromLat: number,
    fromLng: number,
    destinations: { latitude?: number | null; longitude?: number | null }[],
    mode: TransportMode
  ): void {
    if (!fromLat || !fromLng || mode === 'air') return;
    for (const d of destinations) {
      if (d.latitude && d.longitude) {
        this.getRoute(fromLat, fromLng, d.latitude, d.longitude, mode).catch(() => {});
      }
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const routingService = new RoutingService();
