import { query } from '../db';
import { normalizeToUuid } from '../utils/uuid';
import { notificationService } from './notificationService';

export interface GeofenceTransition {
  userId: string;
  userName: string;
  placeId: string;
  placeName: string;
  eventType: 'ENTER' | 'EXIT';
  timestamp: number;
}

interface PendingGeofenceCandidate {
  candidateState: 'ENTER' | 'EXIT';
  consecutiveCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastDistance: number;
}

export class GeofenceEngine {
  // In-memory candidate tracking per (userId:placeId) to ensure high confidence before alerting
  private pendingCandidates = new Map<string, PendingGeofenceCandidate>();

  // Cooldown tracker to prevent boundary flapping (userId:placeId -> lastAlertTimestamp)
  private lastAlertTimestamps = new Map<string, number>();

  /**
   * Evaluates geofences for a user's location with:
   * 1. Dual-radius hysteresis (outer buffer for exit to prevent boundary oscillations).
   * 2. Consecutive reading verification (requires 3 consecutive pings or confirmed dwell time).
   * 3. Accuracy gating (rejects GPS fixes with accuracy > 75m).
   * 4. Multi-channel notifications via WebPush, DB persistence, and native push.
   */
  public async evaluateGeofences(
    userId: string,
    circleId: string,
    longitude: number,
    latitude: number,
    accuracy: number = 10,
    speed: number = 0,
    activity?: string
  ): Promise<GeofenceTransition[]> {
    const transitions: GeofenceTransition[] = [];

    // Reject low-accuracy fixes from triggering false place transitions
    if (accuracy > 75) {
      return transitions;
    }

    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      // 1. Fetch user's display name
      const userRows = await query<{ full_name: string }>(
        'SELECT full_name FROM users WHERE id = $1',
        [userUuid]
      );
      const userName = userRows[0]?.full_name || 'Family Member';

      // 2. Query places and exact distance in meters using PostGIS ST_Distance
      const sql = `
        SELECT 
          p.id AS place_id,
          p.name AS place_name,
          p.radius_meters,
          p.notify_on_enter,
          p.notify_on_exit,
          ST_Distance(
            p.location::geography, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) AS distance_meters,
          COALESCE(s.is_inside, FALSE) AS was_inside
        FROM places p
        LEFT JOIN user_geofence_states s 
          ON s.place_id = p.id AND s.user_id = $3
        WHERE p.circle_id = $4
      `;

      const places = await query<{
        place_id: string;
        place_name: string;
        radius_meters: number;
        notify_on_enter: boolean;
        notify_on_exit: boolean;
        distance_meters: number;
        was_inside: boolean;
      }>(sql, [longitude, latitude, userUuid, circleUuid]);

      const now = Date.now();

      for (const place of places) {
        const radius = Number(place.radius_meters) || 200;
        const distance = Number(place.distance_meters) || 0;
        const wasInside = Boolean(place.was_inside);

        // Hysteresis boundary calculation:
        // Entry requires being inside the configured place radius
        const enterThreshold = radius;
        // Exit requires moving beyond radius + buffer (minimum 30m or 20% of radius)
        const exitHysteresisBuffer = Math.max(30, radius * 0.20);
        const exitThreshold = radius + exitHysteresisBuffer;

        const key = `${userId}:${place.place_id}`;

        let isCandidateEnter = false;
        let isCandidateExit = false;

        if (!wasInside && distance <= enterThreshold) {
          isCandidateEnter = true;
        } else if (wasInside && distance > exitThreshold) {
          isCandidateExit = true;
        }

        // If user is inside the deadband between enterThreshold and exitThreshold,
        // or steady-state inside/outside, clear any pending transition candidate.
        if (!isCandidateEnter && !isCandidateExit) {
          this.pendingCandidates.delete(key);
          continue;
        }

        const candidateType: 'ENTER' | 'EXIT' = isCandidateEnter ? 'ENTER' : 'EXIT';
        let candidate = this.pendingCandidates.get(key);

        if (!candidate || candidate.candidateState !== candidateType) {
          candidate = {
            candidateState: candidateType,
            consecutiveCount: 1,
            firstSeenAt: now,
            lastSeenAt: now,
            lastDistance: distance,
          };
          this.pendingCandidates.set(key, candidate);
        } else {
          candidate.consecutiveCount += 1;
          candidate.lastSeenAt = now;
          candidate.lastDistance = distance;
        }

        const dwellMs = now - candidate.firstSeenAt;

        // Confidence validation:
        // Require at least 3 consecutive pings OR dwell time (30s for ENTER, 45s for EXIT).
        // If GPS accuracy is high (< 25m) and vehicle speed is active (> 12 km/h), 2 pings are sufficient.
        const requiredPings = accuracy <= 25 && speed > 12 ? 2 : 3;
        const requiredDwellMs = candidateType === 'ENTER' ? 30000 : 45000;
        const isConfident = candidate.consecutiveCount >= requiredPings || dwellMs >= requiredDwellMs;

        if (!isConfident) {
          // Gathering confidence: do not dispatch notifications yet
          continue;
        }

        // Cooldown check (prevent repeated flip-flops within 90 seconds)
        const lastAlert = this.lastAlertTimestamps.get(key) || 0;
        if (now - lastAlert < 90000) {
          continue;
        }

        // Transition confirmed!
        this.lastAlertTimestamps.set(key, now);
        this.pendingCandidates.delete(key);

        const nextIsInside = candidateType === 'ENTER';

        // 1. Update user_geofence_states
        await query(
          `
          INSERT INTO user_geofence_states (user_id, place_id, is_inside, last_transition_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id, place_id) 
          DO UPDATE SET is_inside = $3, last_transition_at = NOW()
          `,
          [userUuid, place.place_id, nextIsInside]
        );

        // 2. Audit log into geofence_events
        await query(
          `
          INSERT INTO geofence_events (user_id, place_id, event_type, location)
          VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
          `,
          [userUuid, place.place_id, candidateType, longitude, latitude]
        );

        // 3. Record confirmed transition
        transitions.push({
          userId,
          userName,
          placeId: place.place_id,
          placeName: place.place_name,
          eventType: candidateType,
          timestamp: now,
        });

        // 4. Dispatch multi-channel push notifications (WebPush + Expo/FCM + DB persistence)
        if ((nextIsInside && place.notify_on_enter) || (!nextIsInside && place.notify_on_exit)) {
          const title = nextIsInside ? `📍 Arrived at ${place.place_name}` : `🚗 Left ${place.place_name}`;
          const body = nextIsInside
            ? `${userName} has arrived at ${place.place_name}.`
            : `${userName} has left ${place.place_name}.`;

          await notificationService
            .notifyCircleMembers({
              circleId,
              actorId: userId,
              type: nextIsInside ? 'GEOFENCE_ENTER' : 'GEOFENCE_EXIT',
              title,
              body,
              data: {
                placeId: place.place_id,
                placeName: place.place_name,
                eventType: candidateType,
                latitude,
                longitude,
              },
              excludeActor: true,
            })
            .catch((err) => console.warn('[GeofenceEngine] Notification dispatch error:', err));
        }
      }
    } catch (error) {
      console.error('[GeofenceEngine] Error evaluating geofences:', error);
    }

    return transitions;
  }
}

export const geofenceEngine = new GeofenceEngine();
