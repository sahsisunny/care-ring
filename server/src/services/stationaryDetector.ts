import { StationaryAnchor } from '../types';
import { reverseGeocode } from './geocodingService';

/**
 * Computes Haversine distance in meters between two lat/lng coordinates
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class StationaryDetector {
  private anchors: Map<string, StationaryAnchor> = new Map();

  // Configurable thresholds: 50 meters radius and 3 minutes (180,000 ms)
  private readonly radiusMeters: number;
  private readonly durationThresholdMs: number;

  constructor(
    radiusMeters: number = parseInt(process.env.STATIONARY_RADIUS_METERS || '50', 10),
    durationThresholdMs: number = parseInt(process.env.STATIONARY_DURATION_THRESHOLD_MS || '180000', 10)
  ) {
    this.radiusMeters = radiusMeters;
    this.durationThresholdMs = durationThresholdMs;
  }

  /**
   * Processes a telemetry ping and applies stationary rate-limiting for reverse geocoding.
   * Only queries the geocoding provider when a user has been within a 50m radius for > 3 minutes.
   */
  public async processLocation(
    userId: string,
    lat: number,
    lng: number,
    now: number = Date.now()
  ): Promise<{
    isStationary: boolean;
    stationaryDurationMs: number;
    resolvedAddress: string | null;
    justResolved: boolean;
  }> {
    let anchor = this.anchors.get(userId);

    if (!anchor) {
      // First ping for this user: initialize anchor
      anchor = {
        userId,
        lat,
        lng,
        anchorStartTime: now,
        lastPingTime: now,
        isResolved: false,
      };
      this.anchors.set(userId, anchor);
      return {
        isStationary: true,
        stationaryDurationMs: 0,
        resolvedAddress: null,
        justResolved: false,
      };
    }

    const distance = calculateHaversineDistance(anchor.lat, anchor.lng, lat, lng);
    anchor.lastPingTime = now;

    if (distance <= this.radiusMeters) {
      // User is still within 50m stationary bubble
      const stationaryDurationMs = now - anchor.anchorStartTime;

      if (stationaryDurationMs >= this.durationThresholdMs) {
        if (!anchor.isResolved) {
          // Trigger reverse geocoding exactly ONCE per stationary session
          console.log(
            `[StationaryDetector] User ${userId} stationary for ${(stationaryDurationMs / 1000).toFixed(0)}s (> 3m). Resolving address...`
          );
          const address = await reverseGeocode(lat, lng);
          anchor.isResolved = true;
          anchor.cachedAddress = address;

          return {
            isStationary: true,
            stationaryDurationMs,
            resolvedAddress: address,
            justResolved: true,
          };
        }

        // Already resolved for this stationary dwell
        return {
          isStationary: true,
          stationaryDurationMs,
          resolvedAddress: anchor.cachedAddress || null,
          justResolved: false,
        };
      }

      // Stationary but duration < 3 minutes
      return {
        isStationary: true,
        stationaryDurationMs,
        resolvedAddress: null,
        justResolved: false,
      };
    } else {
      // User moved outside 50m radius -> reset anchor to new location
      this.anchors.set(userId, {
        userId,
        lat,
        lng,
        anchorStartTime: now,
        lastPingTime: now,
        isResolved: false,
      });

      return {
        isStationary: false,
        stationaryDurationMs: 0,
        resolvedAddress: null,
        justResolved: false,
      };
    }
  }

  public getAnchor(userId: string): StationaryAnchor | undefined {
    return this.anchors.get(userId);
  }

  public clear(userId: string): void {
    this.anchors.delete(userId);
  }
}

export const stationaryDetector = new StationaryDetector();
