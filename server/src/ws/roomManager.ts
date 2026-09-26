import { WebSocket } from 'ws';
import { query } from '../db';
import {
  TelemetryPing,
  OutgoingWSMessage,
  TelemetryBroadcastMessage,
  SOSAlertMessage,
  ChatMessage,
  ChatMessageWS,
  DirectMessage,
  DirectMessageWS,
  TypingStatus,
  TypingStatusWS,
  DirectTypingStatus,
  DirectTypingStatusWS,
  LiveReaction,
  LiveReactionWS,
  CheckInAlert,
  CheckInWS,
} from '../types';
import { stationaryDetector } from '../services/stationaryDetector';
import { geofenceEngine } from '../services/geofenceEngine';
import { normalizeToUuid } from '../utils/uuid';

function computeDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
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

interface RecordedHistoryPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  isStationary: boolean;
  address?: string | null;
}

export class RoomManager {
  // Map of circleId -> Map of userId -> Set<WebSocket>
  private rooms: Map<string, Map<string, Set<WebSocket>>> = new Map();
  private lastSpeedingAlertTime: Map<string, number> = new Map();
  private lastMovementAlertTime: Map<string, number> = new Map();
  private previousIsMovingState: Map<string, boolean> = new Map();
  private lastRecordedPoints: Map<string, RecordedHistoryPoint> = new Map();

  /**
   * Checks if a user has an active WebSocket in a given circle
   */
  public isUserOnline(circleId: string, userId: string): boolean {
    const circleSockets = this.rooms.get(circleId);
    if (!circleSockets) return false;
    const userSockets = circleSockets.get(userId);
    return !!(userSockets && userSockets.size > 0);
  }

  /**
   * Returns list of currently online user IDs in a circle
   */
  public getActiveUserIds(circleId: string): string[] {
    const circleSockets = this.rooms.get(circleId);
    if (!circleSockets) return [];
    const active: string[] = [];
    for (const [uid, sockets] of circleSockets.entries()) {
      if (sockets.size > 0) {
        active.push(uid);
      }
    }
    return active;
  }

  /**
   * Registers a client socket to a circle room
   */
  public joinRoom(circleId: string, userId: string, socket: WebSocket): void {
    if (!this.rooms.has(circleId)) {
      this.rooms.set(circleId, new Map());
    }

    const circleSockets = this.rooms.get(circleId)!;
    const isNewOnlineUser = !circleSockets.has(userId) || circleSockets.get(userId)!.size === 0;

    if (!circleSockets.has(userId)) {
      circleSockets.set(userId, new Set());
    }
    circleSockets.get(userId)!.add(socket);

    console.log(
      `[RoomManager] User ${userId} joined Circle ${circleId}. Active users in circle: ${circleSockets.size}, sockets for user: ${circleSockets.get(userId)?.size}`
    );

    // Update user's last_online_at in database
    const userUuid = normalizeToUuid(userId);
    query('UPDATE users SET last_online_at = NOW() WHERE id = $1', [userUuid]).catch(() => {});

    // Send confirmation to joining user
    this.send(socket, {
      type: 'CONNECTED',
      circleId,
      userId,
    });

    // If user just transitioned to online, broadcast presence update to circle
    if (isNewOnlineUser) {
      this.broadcastToCircle(
        circleId,
        {
          type: 'PRESENCE_CHANGE',
          data: {
            userId,
            circleId,
            isOnline: true,
            lastOnlineAt: new Date().toISOString(),
          },
        },
        userId
      );
    }
  }

  /**
   * Removes a client socket from a circle room
   */
  public leaveRoom(circleId: string, userId: string, socket?: WebSocket): void {
    const circleSockets = this.rooms.get(circleId);
    if (!circleSockets) return;

    let userWentOffline = false;

    if (socket) {
      const userSockets = circleSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          circleSockets.delete(userId);
          userWentOffline = true;
          console.log(`[RoomManager] User ${userId} has no remaining sockets in Circle ${circleId}. Removed user.`);
        } else {
          console.log(`[RoomManager] Socket closed for user ${userId}. Remaining sockets for user: ${userSockets.size}`);
        }
      }
    } else {
      circleSockets.delete(userId);
      userWentOffline = true;
      console.log(`[RoomManager] All sockets for user ${userId} removed from Circle ${circleId}.`);
    }

    if (userWentOffline) {
      const userUuid = normalizeToUuid(userId);
      query('UPDATE users SET last_online_at = NOW() WHERE id = $1', [userUuid]).catch(() => {});

      this.broadcastToCircle(circleId, {
        type: 'PRESENCE_CHANGE',
        data: {
          userId,
          circleId,
          isOnline: false,
          lastOnlineAt: new Date().toISOString(),
        },
      });
    }

    if (circleSockets.size === 0) {
      this.rooms.delete(circleId);
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

    for (const [memberUserId, userSockets] of circleSockets.entries()) {
      if (excludeUserId && memberUserId === excludeUserId) {
        continue;
      }

      for (const socket of userSockets) {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(payload);
          } catch (err) {
            console.error(`[RoomManager] Failed to send message to ${memberUserId}:`, err);
          }
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

    const stationaryStartTime = now - stationaryStatus.stationaryDurationMs;
    const stationarySinceIso = new Date(stationaryStartTime).toISOString();

    // 2. Immediate real-time fan-out broadcast to circle members
    const broadcastMsg: TelemetryBroadcastMessage = {
      type: 'TELEMETRY_UPDATE',
      data: {
        ...ping,
        resolvedAddress: stationaryStatus.resolvedAddress,
        isStationary: stationaryStatus.isStationary,
        stationarySince: stationarySinceIso,
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

    // High Speeding Alert evaluation (> 80 km/h, debounced to 60s per user)
    const speedKmH = ping.speed || 0;
    const SPEED_THRESHOLD = 80;
    if (speedKmH >= SPEED_THRESHOLD) {
      const lastSpeedAlert = this.lastSpeedingAlertTime.get(ping.userId) || 0;
      if (now - lastSpeedAlert > 60000) {
        this.lastSpeedingAlertTime.set(ping.userId, now);
        this.broadcastToCircle(
          ping.circleId,
          {
            type: 'SPEEDING_ALERT',
            data: {
              userId: ping.userId,
              userName: ping.userName || 'Family Member',
              speed: Math.round(speedKmH),
              latitude: ping.latitude,
              longitude: ping.longitude,
              timestamp: now,
            },
          },
          ping.userId
        );
      }
    }

    // Movement / Driving Start evaluation (stationary -> moving at >= 15 km/h, debounced 3 min)
    const wasMoving = this.previousIsMovingState.get(ping.userId) ?? false;
    const isNowMoving = !stationaryStatus.isStationary || speedKmH >= 15;
    this.previousIsMovingState.set(ping.userId, isNowMoving);

    if (!wasMoving && isNowMoving && speedKmH >= 15) {
      const lastMoveAlert = this.lastMovementAlertTime.get(ping.userId) || 0;
      if (now - lastMoveAlert > 180000) {
        this.lastMovementAlertTime.set(ping.userId, now);
        this.broadcastToCircle(
          ping.circleId,
          {
            type: 'MOVEMENT_ALERT',
            data: {
              userId: ping.userId,
              userName: ping.userName || 'Family Member',
              speed: Math.round(speedKmH),
              latitude: ping.latitude,
              longitude: ping.longitude,
              timestamp: now,
            },
          },
          ping.userId
        );
      }
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
    this.persistTelemetry(
      ping,
      stationaryStatus.resolvedAddress,
      Math.round(stationaryStatus.stationaryDurationMs / 1000),
      stationaryStartTime,
      stationaryStatus.isStationary
    ).catch(
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
    let userPhone: string | null = null;
    const userUuid = normalizeToUuid(userId);
    try {
      const user = await query<{ full_name: string; phone: string | null }>(
        'SELECT full_name, phone FROM users WHERE id = $1',
        [userUuid]
      );
      if (user[0]?.full_name) userName = user[0].full_name;
      if (user[0]?.phone) userPhone = user[0].phone;
    } catch {}

    const sosMsg: SOSAlertMessage = {
      type: 'SOS_ALERT',
      data: {
        userId,
        userName,
        phone: userPhone,
        circleId,
        latitude,
        longitude,
        timestamp: Date.now(),
      },
    };

    console.warn(`[EMERGENCY SOS] Triggered by ${userName} (${userId}) in circle ${circleId}! Phone: ${userPhone}`);
    this.broadcastToCircle(circleId, sosMsg);
  }

  /**
   * Broadcasts a live interactive emoji reaction (Boo! 🍅, Love you 💖, Slow down 😳)
   */
  public broadcastLiveReaction(circleId: string, reaction: LiveReaction): void {
    const reactionMsg: LiveReactionWS = {
      type: 'LIVE_REACTION',
      data: reaction,
    };
    this.broadcastToCircle(circleId, reactionMsg);
  }

  /**
   * Broadcasts a 1-tap Check-In alert to the circle
   */
  public broadcastCheckIn(circleId: string, checkIn: CheckInAlert): void {
    const checkInMsg: CheckInWS = {
      type: 'CHECK_IN',
      data: checkIn,
    };
    this.broadcastToCircle(circleId, checkInMsg);
  }

  /**
   * Broadcasts a chat message to all active sockets in the circle room
   */
  public broadcastChatMessage(circleId: string, message: ChatMessage): void {
    const chatMsg: ChatMessageWS = {
      type: 'CHAT_MESSAGE',
      data: message,
    };
    this.broadcastToCircle(circleId, chatMsg);
  }

  /**
   * Sends a 1-on-1 direct chat message to both the sender and recipient sockets in the circle room
   */
  public sendDirectMessage(
    circleId: string,
    senderId: string,
    recipientId: string,
    message: DirectMessage
  ): void {
    const circleSockets = this.rooms.get(circleId);
    if (!circleSockets) {
      console.warn(`[RoomManager] Cannot send DM: Circle ${circleId} not found in active rooms.`);
      return;
    }

    const dmMsg: DirectMessageWS = {
      type: 'DIRECT_MESSAGE',
      data: message,
    };
    const payload = JSON.stringify(dmMsg);

    const getSocketsForUser = (uid: string): Set<WebSocket> => {
      if (!uid) return new Set();
      const direct = circleSockets.get(uid);
      if (direct && direct.size > 0) return direct;
      const lower = circleSockets.get(uid.toLowerCase());
      if (lower && lower.size > 0) return lower;
      try {
        const normalized = circleSockets.get(normalizeToUuid(uid));
        if (normalized && normalized.size > 0) return normalized;
      } catch {
        // Not a UUID format
      }
      return new Set();
    };

    // Send to all open sockets of recipient
    const recipientSockets = getSocketsForUser(recipientId);
    let recipientSentCount = 0;
    for (const socket of recipientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(payload);
          recipientSentCount++;
        } catch (err) {
          console.error(`[RoomManager] Failed to send DM to recipient socket ${recipientId}:`, err);
        }
      }
    }

    // Also send to all open sockets of sender (so sender receives confirmed message with DB id)
    const senderSockets = getSocketsForUser(senderId);
    let senderSentCount = 0;
    for (const socket of senderSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(payload);
          senderSentCount++;
        } catch (err) {
          console.error(`[RoomManager] Failed to send DM to sender socket ${senderId}:`, err);
        }
      }
    }

    console.log(
      `[RoomManager] DM delivered: sender=${senderId} (${senderSentCount} sockets), recipient=${recipientId} (${recipientSentCount} sockets)`
    );
  }

  /**
   * Broadcasts typing status for Circle Group Chat (excludes the sender)
   */
  public broadcastTypingStatus(
    circleId: string,
    typing: TypingStatus,
    excludeUserId?: string
  ): void {
    const typingMsg: TypingStatusWS = {
      type: 'TYPING_STATUS',
      data: typing,
    };
    this.broadcastToCircle(circleId, typingMsg, excludeUserId);
  }

  /**
   * Sends 1-on-1 direct typing status strictly to recipient sockets
   */
  public sendDirectTypingStatus(
    circleId: string,
    senderId: string,
    recipientId: string,
    typing: DirectTypingStatus
  ): void {
    const circleSockets = this.rooms.get(circleId);
    if (!circleSockets) return;

    const dmTypingMsg: DirectTypingStatusWS = {
      type: 'DIRECT_TYPING_STATUS',
      data: typing,
    };
    const payload = JSON.stringify(dmTypingMsg);

    const getSocketsForUser = (uid: string): Set<WebSocket> => {
      if (!uid) return new Set();
      const direct = circleSockets.get(uid);
      if (direct && direct.size > 0) return direct;
      const lower = circleSockets.get(uid.toLowerCase());
      if (lower && lower.size > 0) return lower;
      try {
        const normalized = circleSockets.get(normalizeToUuid(uid));
        if (normalized && normalized.size > 0) return normalized;
      } catch {
        // Not a UUID format
      }
      return new Set();
    };

    const recipientSockets = getSocketsForUser(recipientId);
    for (const socket of recipientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(payload);
        } catch (err) {
          console.error(`[RoomManager] Failed to send typing status to recipient ${recipientId}:`, err);
        }
      }
    }
  }

  private async persistTelemetry(
    ping: TelemetryPing,
    resolvedAddress: string | null,
    stationaryDurationSec: number,
    stationaryStartTime: number,
    isStationary: boolean
  ): Promise<void> {
    const userUuid = normalizeToUuid(ping.userId);
    const circleUuid = normalizeToUuid(ping.circleId);

    const displayName = ping.userName && ping.userName.trim().length > 0
      ? ping.userName
      : 'Family Member';

    // Update existing user with latest location, stationary since, and battery state
    const updateResult = await query(
      `
      UPDATE users SET
        battery_level = $1,
        is_charging = $2,
        last_latitude = $3,
        last_longitude = $4,
        last_address = COALESCE($5, users.last_address),
        last_speed = $6,
        last_heading = $7,
        stationary_since = TO_TIMESTAMP($8 / 1000.0),
        is_stationary = $9,
        last_location_time = NOW(),
        last_online_at = NOW()
      WHERE id = $10
      RETURNING id
      `,
      [
        ping.batteryLevel,
        ping.isCharging,
        ping.latitude,
        ping.longitude,
        resolvedAddress,
        ping.speed,
        ping.heading,
        stationaryStartTime,
        isStationary,
        userUuid,
      ]
    );

    // If user record doesn't exist yet, insert without touching phone column
    if (!updateResult || updateResult.length === 0) {
      await query(
        `
        INSERT INTO users (
          id, full_name, battery_level, is_charging,
          last_latitude, last_longitude, last_address, last_speed, last_heading,
          stationary_since, is_stationary, last_location_time, last_online_at
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          TO_TIMESTAMP($10 / 1000.0), $11, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE 
        SET battery_level = EXCLUDED.battery_level, 
            is_charging = EXCLUDED.is_charging,
            last_latitude = EXCLUDED.last_latitude,
            last_longitude = EXCLUDED.last_longitude,
            last_address = COALESCE(EXCLUDED.last_address, users.last_address),
            last_speed = EXCLUDED.last_speed,
            last_heading = EXCLUDED.last_heading,
            stationary_since = EXCLUDED.stationary_since,
            is_stationary = EXCLUDED.is_stationary,
            last_location_time = NOW(),
            last_online_at = NOW()
        `,
        [
          userUuid,
          displayName,
          ping.batteryLevel,
          ping.isCharging,
          ping.latitude,
          ping.longitude,
          resolvedAddress,
          ping.speed,
          ping.heading,
          stationaryStartTime,
          isStationary,
        ]
      );
    }

    // Ensure circle exists to prevent FK violation
    await query(
      `
      INSERT INTO circles (id, name, invite_code)
      VALUES ($1, 'Family Circle', $2)
      ON CONFLICT (id) DO NOTHING
      `,
      [circleUuid, ping.circleId.substring(0, 16)]
    );

    // Ensure circle_members entry exists
    await query(
      `
      INSERT INTO circle_members (circle_id, user_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (circle_id, user_id) DO NOTHING
      `,
      [circleUuid, userUuid]
    );

    // Movement-based and 5-minute stationary checkpoint recording logic
    const lastRec = this.lastRecordedPoints.get(ping.userId);
    const now = ping.timestamp || Date.now();
    let shouldInsert = false;

    if (!lastRec) {
      // First point for this user session
      shouldInsert = true;
    } else {
      const timeDiffMs = now - lastRec.timestamp;
      const distMeters = computeDistanceMeters(lastRec.latitude, lastRec.longitude, ping.latitude, ping.longitude);
      const stateChanged = lastRec.isStationary !== isStationary;

      if (stateChanged) {
        // State transition: user started moving (departure) or stopped (arrival)
        shouldInsert = true;
      } else if (!isStationary || (ping.speed || 0) >= 3.0) {
        // User is moving: record every 25+ meters or every 15-20s for smooth route polyline
        if (distMeters >= 25 || timeDiffMs >= 15000) {
          shouldInsert = true;
        }
      } else {
        // User is stationary: record checkpoint every 5 minutes (300,000 ms) or if reverse-geocoded address resolved
        const addressChanged = !!resolvedAddress && resolvedAddress !== lastRec.address;
        if (timeDiffMs >= 300000 || addressChanged) {
          shouldInsert = true;
        }
      }
    }

    if (shouldInsert) {
      this.lastRecordedPoints.set(ping.userId, {
        latitude: ping.latitude,
        longitude: ping.longitude,
        timestamp: now,
        isStationary,
        address: resolvedAddress,
      });

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
          now,
        ]
      );
    }
  }

  private send(socket: WebSocket, message: OutgoingWSMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

export const roomManager = new RoomManager();
