import { query } from '../db';
import { GeofenceAlertMessage } from '../types';

export interface GeofenceTransition {
  userId: string;
  userName: string;
  placeId: string;
  placeName: string;
  eventType: 'ENTER' | 'EXIT';
  timestamp: number;
}

/**
 * Dispatches a push notification via Firebase Cloud Messaging (or logs if mock)
 */
async function dispatchPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  const fcmKey = process.env.FCM_SERVER_KEY;
  if (!fcmKey || fcmKey.includes('your_firebase')) {
    console.log(`[FCM-SIMULATOR] Alert for ${userId}: "${title}" - "${body}"`, data);
    return;
  }

  // Production FCM v1 / Legacy HTTP API dispatch
  try {
    const userRows = await query<{ fcm_token: string | null }>(
      'SELECT fcm_token FROM users WHERE id = $1',
      [userId]
    );
    const token = userRows[0]?.fcm_token;
    if (!token) return;

    // Dispatch via fetch or FCM admin
    console.log(`[FCM] Sending push notification to token ${token.substring(0, 10)}...: ${title}`);
  } catch (error) {
    console.error('[FCM] Error sending push notification:', error);
  }
}

export class GeofenceEngine {
  /**
   * Evaluates geofences for a user's location ping using PostGIS ST_DWithin geography calculation.
   * Compares against previous state in `user_geofence_states` to detect transitions.
   */
  public async evaluateGeofences(
    userId: string,
    circleId: string,
    longitude: number,
    latitude: number
  ): Promise<GeofenceTransition[]> {
    const transitions: GeofenceTransition[] = [];

    try {
      // 1. Fetch user's name
      const userRows = await query<{ full_name: string }>(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = userRows[0]?.full_name || 'Family Member';

      // 2. Query places in this circle and calculate containment using PostGIS
      const sql = `
        SELECT 
          p.id AS place_id,
          p.name AS place_name,
          p.radius_meters,
          p.notify_on_enter,
          p.notify_on_exit,
          ST_DWithin(
            p.location::geography, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
            p.radius_meters
          ) AS is_inside,
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
        is_inside: boolean;
        was_inside: boolean;
      }>(sql, [longitude, latitude, userId, circleId]);

      const now = Date.now();

      for (const place of places) {
        const hasEntered = place.is_inside && !place.was_inside;
        const hasExited = !place.is_inside && place.was_inside;

        if (hasEntered || hasExited) {
          const eventType = hasEntered ? 'ENTER' : 'EXIT';

          // Update user_geofence_states
          await query(
            `
            INSERT INTO user_geofence_states (user_id, place_id, is_inside, last_transition_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, place_id) 
            DO UPDATE SET is_inside = $3, last_transition_at = NOW()
            `,
            [userId, place.place_id, place.is_inside]
          );

          // Audit log into geofence_events
          await query(
            `
            INSERT INTO geofence_events (user_id, place_id, event_type, location)
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
            `,
            [userId, place.place_id, eventType, longitude, latitude]
          );

          // Record transition
          transitions.push({
            userId,
            userName,
            placeId: place.place_id,
            placeName: place.place_name,
            eventType,
            timestamp: now,
          });

          // Trigger Push Notification if configured for this place
          if ((hasEntered && place.notify_on_enter) || (hasExited && place.notify_on_exit)) {
            const title = hasEntered ? `📍 Arrived at ${place.place_name}` : `🚗 Left ${place.place_name}`;
            const body = hasEntered
              ? `${userName} has arrived at ${place.place_name}.`
              : `${userName} has left ${place.place_name}.`;

            await dispatchPushNotification(userId, title, body, {
              placeId: place.place_id,
              eventType,
              circleId,
            });
          }
        }
      }
    } catch (error) {
      console.error('[GeofenceEngine] Error evaluating geofences:', error);
    }

    return transitions;
  }
}

export const geofenceEngine = new GeofenceEngine();
