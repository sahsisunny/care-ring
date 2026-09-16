import { WebSocket } from 'ws';
import { query } from '../db';
import {
  TelemetryPing,
  OutgoingWSMessage,
  TelemetryBroadcastMessage,
  SOSAlertMessage,
} from '../types';
import { stationaryDetector } from '../services/stationaryDetector';
import { geofenceEngine } from '../services/geofenceEngine';
import { normalizeToUuid } from '../utils/uuid';

export class RoomManager {
  // Map of circleId -> Map of userId -> WebSocket
  private rooms: Map<string, Map<string, WebSocket>> = new Map();

  /**
   * Registers a client socket to a circle room
   */
  public joinRoom(circleId: string, userId: string, socket: WebSocket): void {
    if (!this.rooms.has(circleId)) {
      this.rooms.set(circleId, new Map());
    }

    const circleSockets = this.rooms.get(circleId)!;
    circleSockets.set(userId, socket);

    console.log(
      `[RoomManager] User ${userId} joined Circle ${circleId}. Active in circle: ${circleSockets.size}`
    );

    // Send confirmation to joining user
    this.send(socket, {
      type: 'CONNECTED',
      circleId,
      userId,
    });
  }

  /**
   * Removes a client socket from a circle room
   */
  public leaveRoom(circleId: string, userId: string): void {
    const circleSockets = this.rooms.get(circleId);
    if (circleSockets) {
      circleSockets.delete(userId);
      console.log(`[RoomManager] User ${userId} left Circle ${circleId}.`);
      if (circleSockets.size === 0) {
        this.rooms.delete(circleId);
      }
    }
  }

  /**
   * Broadcasts a JSON message to all active sockets connected to the matching circleId
   */
  public broadcastToCircle(
    circleId: string,
    message: OutgoingWSMessage,
    excludeUserId?: string
  ): void {
    const circleSockets = this.rooms.get(circleId);
    if (!circleSockets) return;

    const payload = JSON.stringify(message);

    for (const [memberUserId, socket] of circleSockets.entries()) {
      if (excludeUserId && memberUserId === excludeUserId) {
        continue;
      }

      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(payload);
        } catch (err) {
          console.error(`[RoomManager] Failed to send message to ${memberUserId}:`, err);
        }
      }
    }
  }

  /**
   * Core telemetry ingestion pipeline:
   * 1. Fan-out broadcast to circle members.
   * 2. Asynchronous stationary detection & reverse geocode throttling (<50m for >3min).
   * 3. Geofence evaluation using PostGIS ST_DWithin.
   * 4. Asynchronous persistence to PostgreSQL location_history.
   */
  public async handleTelemetryPing(ping: TelemetryPing): Promise<void> {
    const now = ping.timestamp || Date.now();

    // 1. Process stationary status & reverse geocoding rate-limiting
    const stationaryStatus = await stationaryDetector.processLocation(
      ping.userId,
      ping.latitude,
      ping.longitude,
      now
    );

    // 2. Immediate real-time fan-out broadcast to circle members
    const broadcastMsg: TelemetryBroadcastMessage = {
      type: 'TELEMETRY_UPDATE',
      data: {
        ...ping,
        resolvedAddress: stationaryStatus.resolvedAddress,
        isStationary: stationaryStatus.isStationary,
      },
    };
    this.broadcastToCircle(ping.circleId, broadcastMsg, ping.userId);

    // If reverse geocoding was just resolved, notify circle members of new address
    if (stationaryStatus.justResolved && stationaryStatus.resolvedAddress) {
      this.broadcastToCircle(ping.circleId, {
        type: 'ADDRESS_RESOLVED',
        data: {
          userId: ping.userId,
          circleId: ping.circleId,
          address: stationaryStatus.resolvedAddress,
          latitude: ping.latitude,
          longitude: ping.longitude,
        },
      });
    }

    // 3. Asynchronous Geofence evaluation using PostGIS
    geofenceEngine
      .evaluateGeofences(ping.userId, ping.circleId, ping.longitude, ping.latitude)
      .then((transitions) => {
        for (const transition of transitions) {
          this.broadcastToCircle(ping.circleId, {
            type: 'GEOFENCE_ALERT',
            data: {
              userId: transition.userId,
              userName: transition.userName,
              placeId: transition.placeId,
              placeName: transition.placeName,
              event: transition.eventType,
              timestamp: transition.timestamp,
            },
          });
        }
      })
      .catch((err) => {
        console.error('[RoomManager] Geofence evaluation error:', err);
      });

    // 4. Asynchronous persistence (fire-and-forget for maximum telemetry ingestion throughput)
    this.persistTelemetry(ping, stationaryStatus.resolvedAddress, Math.round(stationaryStatus.stationaryDurationMs / 1000)).catch(
      (err) => console.error('[RoomManager] Failed to persist location history:', err)
    );
  }

  /**
   * Triggers an emergency SOS broadcast to all members in the circle
   */
  public async triggerSOS(
    userId: string,
    circleId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    let userName = 'Family Member';
    const userUuid = normalizeToUuid(userId);
    try {
      const user = await query<{ full_name: string }>('SELECT full_name FROM users WHERE id = $1', [
        userUuid,
      ]);
      if (user[0]?.full_name) userName = user[0].full_name;
    } catch {}

    const sosMsg: SOSAlertMessage = {
      type: 'SOS_ALERT',
      data: {
        userId,
        userName,
        circleId,
        latitude,
        longitude,
        timestamp: Date.now(),
      },
    };

    console.warn(`[EMERGENCY SOS] Triggered by ${userName} (${userId}) in circle ${circleId}!`);
    this.broadcastToCircle(circleId, sosMsg);
  }

  private async persistTelemetry(
    ping: TelemetryPing,
    resolvedAddress: string | null,
    stationaryDurationSec: number
  ): Promise<void> {
    const userUuid = normalizeToUuid(ping.userId);
    const circleUuid = normalizeToUuid(ping.circleId);

    // Upsert user so foreign key constraint never fails on new client IDs
    const displayName = ping.userName || (ping.userId.includes('sarah')
      ? 'Sarah'
      : ping.userId.includes('noah')
      ? 'Noah'
      : `Member ${ping.userId.substring(0, 8)}`);

    await query(
      `
      INSERT INTO users (id, phone, full_name, battery_level, is_charging, last_online_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE 
      SET battery_level = EXCLUDED.battery_level, 
          is_charging = EXCLUDED.is_charging, 
          last_online_at = NOW()
      `,
      [userUuid, ping.userId, displayName, ping.batteryLevel, ping.isCharging]
    );

    // Ensure circle exists to prevent FK violation
    await query(
      `
      INSERT INTO circles (id, name, invite_code)
      VALUES ($1, 'Family Circle', $2)
      ON CONFLICT (id) DO NOTHING
      `,
      [circleUuid, ping.circleId.substring(0, 16)]
    );

    // Insert into time-series location history with PostGIS point
    await query(
      `
      INSERT INTO location_history (
        user_id, circle_id, location, speed, heading, 
        altitude, accuracy, battery_level, is_charging, 
        resolved_address, stationary_duration_sec, recorded_at
      )
      VALUES (
        $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6,
        $7, $8, $9, $10,
        $11, $12, TO_TIMESTAMP($13 / 1000.0)
      )
      `,
      [
        userUuid,
        circleUuid,
        ping.longitude, // Point(X: lon, Y: lat)
        ping.latitude,
        ping.speed,
        ping.heading,
        ping.altitude || 0,
        ping.accuracy || 5,
        ping.batteryLevel,
        ping.isCharging,
        resolvedAddress,
        stationaryDurationSec,
        ping.timestamp,
      ]
    );
  }

  private send(socket: WebSocket, message: OutgoingWSMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

export const roomManager = new RoomManager();
