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

interface LastTransitionRecord {
  timestamp: number;
  eventType: 'ENTER' | 'EXIT';
  distance: number;
}

export class GeofenceEngine {
  // In-memory candidate tracking per (userId:placeId) to ensure high confidence before alerting
  private pendingCandidates = new Map<string, PendingGeofenceCandidate>();

  // Cooldown tracker to prevent boundary flapping (userId:placeId -> LastTransitionRecord)
  private lastTransitions = new Map<string, LastTransitionRecord>();

  /**
   * Evaluates geofences for a user's location with:
   * 1. Dynamic accuracy gating (rejects noisy GPS fixes relative to place radius).
   * 2. Dual-radius hysteresis (outer buffer for exit to prevent boundary oscillations).
   * 3. Dwell time & multi-reading verification (prevents street drive-bys from firing false arrivals).
   * 4. Smart anti-flapping cooldown (15m same event, 4m opposite event unless moved far away).
   * 5. Multi-channel notifications strictly excluding the actor.
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

    // Global accuracy sanity check: reject grossly inaccurate fixes
    if (accuracy > 65) {
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

        // 1. Accuracy Confidence Gating:
        // If GPS inaccuracy exceeds 40% of the geofence radius (or > 45m),
        // we cannot confidently determine whether the user is inside or outside.
        const maxAcceptableAccuracy = Math.min(45, Math.max(20, radius * 0.40));
        if (accuracy > maxAcceptableAccuracy) {
          continue;
        }

        // 2. Hysteresis Boundary Calculation:
        // Entry requires being firmly inside (within 95% of the radius).
        const enterThreshold = radius * 0.95;
        // Exit requires moving beyond radius + buffer (minimum 35m or 25% of radius).
        const exitHysteresisBuffer = Math.max(35, radius * 0.25);
        const exitThreshold = radius + exitHysteresisBuffer;

        const key = `${userId}:${place.place_id}`;

        let isCandidateEnter = false;
        let isCandidateExit = false;

        if (!wasInside && distance <= enterThreshold) {
          isCandidateEnter = true;
        } else if (wasInside && distance > exitThreshold) {
          isCandidateExit = true;
        }

        // If user is inside the hysteresis deadband between enterThreshold and exitThreshold,
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

        // 3. Strict Confidence & Dwell Calculation:
        let isConfident = false;
        if (candidateType === 'ENTER') {
          // For ENTER: Require at least 25 seconds of continuous dwell time inside AND at least 3 pings.
          // This ensures cars/buses driving past on the road (in geofence for 5-10s) NEVER trigger false arrival alerts!
          isConfident = dwellMs >= 25000 && candidate.consecutiveCount >= 3;
        } else {
          // For EXIT:
          // If driving away fast (> 20 km/h with distance > radius + 40m), 15s is enough.
          // Otherwise (walking / stationary drift), require at least 35s dwell time + 3 pings.
          if (speed >= 20 && distance > radius + 40 && accuracy <= 25) {
            isConfident = dwellMs >= 15000 && candidate.consecutiveCount >= 2;
          } else {
            isConfident = dwellMs >= 35000 && candidate.consecutiveCount >= 3;
          }
        }

        if (!isConfident) {
          // Still gathering confidence: do not dispatch notifications yet
          continue;
        }

        // 4. Anti-Flapping Smart Cooldown:
        const lastRec = this.lastTransitions.get(key);
        if (lastRec) {
          const timeSinceLast = now - lastRec.timestamp;
          if (lastRec.eventType === candidateType) {
            // Same event again (e.g. repeated ENTER): 15 minutes minimum cooldown
            if (timeSinceLast < 900000) {
              continue;
            }
          } else {
            // Opposite event (e.g. EXIT right after ENTER):
            // Minimum 4 minutes cooldown (240s) unless user has traveled far away (> 2.5x radius)
            const hasTraveledFar = distance >= radius * 2.5 && speed >= 15;
            if (timeSinceLast < 240000 && !hasTraveledFar) {
              continue;
            }
          }
        }

        // Transition confirmed with high confidence!
        this.lastTransitions.set(key, {
          timestamp: now,
          eventType: candidateType,
          distance,
        });
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
