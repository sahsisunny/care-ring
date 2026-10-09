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
  private activeBubbles: Map<string, { circleId: string; radiusMeters: number; expiresAt: number }> = new Map();
  private lastSpeedingAlertTime: Map<string, number> = new Map();
  private lastMovementAlertTime: Map<string, number> = new Map();
  private previousIsMovingState: Map<string, boolean> = new Map();
  private lastRecordedPoints: Map<string, RecordedHistoryPoint> = new Map();
  private userProfileCache: Map<string, { fullName: string; avatarUrl: string | null }> = new Map();
  private verifiedMemberships: Set<string> = new Set();
  private userLastActivity: Map<string, string> = new Map();
  private lastTelemetryTimestamp: Map<string, number> = new Map();

  constructor() {
    // Wire up asynchronous address resolution callback
    stationaryDetector.onAddressResolved = (userId, address, lat, lng) => {
      for (const [circleId, userMap] of this.rooms.entries()) {
        if (userMap.has(userId)) {
          this.broadcastToCircle(circleId, {
            type: 'ADDRESS_RESOLVED',
            data: {
              userId,
              circleId,
              address,
              latitude: lat,
              longitude: lng,
            },
          });
        }
      }
    };
  }

  public setUserProfile(userId: string, fullName: string, avatarUrl: string | null): void {
    this.userProfileCache.set(userId, { fullName, avatarUrl });
  }

  public getUserProfile(userId: string): { fullName: string; avatarUrl: string | null } | undefined {
    return this.userProfileCache.get(userId);
  }

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
   * 1. 0ms Immediate in-memory fan-out broadcast to circle members.
   * 2. Asynchronous stationary detection & reverse geocode throttling (<50m for >3min).
   * 3. Geofence evaluation using PostGIS ST_DWithin.
   * 4. Asynchronous persistence to PostgreSQL location_history.
   */
  public handleTelemetryPing(ping: TelemetryPing): void {
    const now = ping.timestamp || Date.now();

    // 0. Out-of-order & Future Timestamp Guards
    // Reject timestamps more than 2 minutes in the future
    if (ping.timestamp && ping.timestamp > Date.now() + 120_000) {
      return;
    }
    // Reject out-of-order timestamps
    const prevTimestamp = this.lastTelemetryTimestamp.get(ping.userId);
    if (ping.timestamp && prevTimestamp && ping.timestamp <= prevTimestamp) {
      return;
    }
    if (ping.timestamp) {
      this.lastTelemetryTimestamp.set(ping.userId, ping.timestamp);
    }

    // Cache user profile name if passed
    if (ping.userName) {
      const existing = this.userProfileCache.get(ping.userId);
      this.userProfileCache.set(ping.userId, {
        fullName: ping.userName,
        avatarUrl: existing?.avatarUrl || null,
      });
    }

    // 1. Process stationary status (0ms calculation)
    const stationaryStatus = stationaryDetector.processLocation(
      ping.userId,
      ping.latitude,
      ping.longitude,
      ping.speed || 0,
      ping.activity,
      now
    );

    const stationaryStartTime = now - stationaryStatus.stationaryDurationMs;
    const stationarySinceIso = new Date(stationaryStartTime).toISOString();

    // Evaluate active Privacy Bubble status for this user
    const bubble = this.activeBubbles.get(ping.userId);
    const isBubbleActive = Boolean(bubble && bubble.expiresAt > now);
    if (bubble && !isBubbleActive) {
      this.activeBubbles.delete(ping.userId);
    }

    // Ghost Mode privacy: never reveal "Inside Privacy Bubble" to other circle members.
    // They see a standard resolved address without any indicator that Ghost Mode is active.
    const effectiveAddress = stationaryStatus.resolvedAddress || this.lastRecordedPoints.get(ping.userId)?.address || null;

    // Rule: The 50m anchor must never override the sender's reported activity.
    // Only mark isStationary=true if the sender's activity is stationary or speed < 1.8 km/h for 30+ s.
    // Never mark stationary if speed > 5 km/h.
    const normPingAct = ping.activity?.trim().toLowerCase();
    const isSenderExplicitlyStationary = normPingAct === 'stationary' || normPingAct === 'still';
    const isSenderReportedMoving = Boolean(
      normPingAct && ['walking', 'running', 'cycling', 'driving', 'riding', 'high_speed'].includes(normPingAct)
    );
    const rawSpeed = ping.speed || 0;

    // A user with speed < 1.8 km/h without active walking/driving is stationary.
    // Never broadcast "moving" or "unknown" when speed is 0.
    const effectiveStationary =
      (rawSpeed < 1.8 && !isSenderReportedMoving) ||
      isSenderExplicitlyStationary ||
      (stationaryStatus.isStationary && rawSpeed <= 3.0);
    const effectiveSpeed = (effectiveStationary || isBubbleActive) ? 0 : rawSpeed;
    const effectiveActivity = effectiveStationary
      ? 'stationary'
      : (ping.activity && ping.activity !== 'unknown' ? ping.activity : (rawSpeed >= 1.8 ? 'moving' : 'stationary'));

    // Latch coordinates to the stationary anchor if user is stationary to suppress GPS jitter
    const effectiveLat = effectiveStationary ? stationaryStatus.snappedLat : ping.latitude;
    const effectiveLng = effectiveStationary ? stationaryStatus.snappedLng : ping.longitude;

    // 2. IMMEDIATE real-time fan-out broadcast to circle members (0ms latency!)
    // Note: Other members NEVER receive inBubble flags or bubble metadata (stealth Ghost Mode)
    const broadcastMsg: TelemetryBroadcastMessage = {
      type: 'TELEMETRY_UPDATE',
      data: {
        ...ping,
        latitude: effectiveLat,
        longitude: effectiveLng,
        avatarUrl: this.userProfileCache.get(ping.userId)?.avatarUrl || null,
        speed: effectiveSpeed,
        resolvedAddress: effectiveAddress,
        isStationary: effectiveStationary,
        stationarySince: stationarySinceIso,
        inBubble: false,
        bubbleRadius: undefined,
        bubbleUntil: undefined,
        activity: effectiveActivity,
        activityConfidence: ping.activityConfidence,
        activityStartedAt: ping.activityStartedAt,
      },
    };
    this.broadcastToCircle(ping.circleId, broadcastMsg, ping.userId);

    // High Speeding Alert evaluation (> 80 km/h, debounced to 60s per user) - suppressed in bubble
    const speedKmH = ping.speed || 0;
    const SPEED_THRESHOLD = 80;
    if (!isBubbleActive && speedKmH >= SPEED_THRESHOLD) {
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

    // 3. Asynchronous Geofence evaluation using PostGIS with confidence verification
    geofenceEngine
      .evaluateGeofences(
        ping.userId,
        ping.circleId,
        effectiveLng,
        effectiveLat,
        ping.accuracy || 10,
        effectiveSpeed,
        effectiveActivity
      )
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

    // Emergency SOS immediately bursts any active privacy bubble for life-saving safety!
    try {
      await query('DELETE FROM member_bubbles WHERE user_id = $1', [userUuid]);
      this.activeBubbles.delete(userId);
      this.broadcastBubbleStatus(circleId, userId, null, 0, latitude, longitude);
    } catch (err) {
      console.error('[RoomManager] Failed to burst bubble on SOS:', err);
    }

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

    const now = ping.timestamp || Date.now();

    const displayName = ping.userName && ping.userName.trim().length > 0
      ? ping.userName
      : 'Family Member';

    const normPingAct = ping.activity?.trim().toLowerCase();
    const isSenderReportedMoving = Boolean(normPingAct && ['walking', 'running', 'cycling', 'driving', 'riding', 'high_speed'].includes(normPingAct));
    const effectiveIsStationary = !isSenderReportedMoving && (ping.speed || 0) <= 5.0 && (isStationary || normPingAct === 'stationary');
    const effectiveActivity = ping.activity || (effectiveIsStationary ? 'stationary' : undefined);

    // Check if user exists and enforce out-of-order timestamp protection
    const userRows = await query('SELECT id, last_location_time FROM users WHERE id = $1', [userUuid]).catch(() => []);
    if (userRows.length > 0) {
      const storedTime = userRows[0].last_location_time ? new Date(userRows[0].last_location_time).getTime() : 0;
      if (ping.timestamp && storedTime && ping.timestamp <= storedTime) {
        // Telemetry is older than or equal to the currently stored location - do not overwrite
        return;
      }

      await query(
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
          last_activity = COALESCE($10, users.last_activity),
          activity_confidence = COALESCE($11, users.activity_confidence),
          activity_started_at = COALESCE(TO_TIMESTAMP($12 / 1000.0), users.activity_started_at),
          last_location_time = TO_TIMESTAMP($13 / 1000.0),
          last_online_at = NOW()
        WHERE id = $14
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
          effectiveActivity || null,
          ping.activityConfidence || null,
          ping.activityStartedAt || null,
          now,
          userUuid,
        ]
      ).catch(() => []);
    } else {
      // If user record doesn't exist yet, insert without touching phone column
      await query(
        `
        INSERT INTO users (
          id, full_name, battery_level, is_charging,
          last_latitude, last_longitude, last_address, last_speed, last_heading,
          stationary_since, is_stationary, last_activity, activity_confidence, activity_started_at,
          last_location_time, last_online_at
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          TO_TIMESTAMP($10 / 1000.0), $11, $12, $13,
          CASE WHEN $14 > 0 THEN TO_TIMESTAMP($14 / 1000.0) ELSE NULL END,
          TO_TIMESTAMP($15 / 1000.0), NOW()
        )
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
          effectiveActivity || null,
          ping.activityConfidence || null,
          ping.activityStartedAt || 0,
          now,
        ]
      ).catch(() => []);
    }

    // Record activity transition into activity_events table (Section 23)
    if (effectiveActivity) {
      const prevAct = this.userLastActivity.get(ping.userId);
      if (prevAct !== effectiveActivity) {
        this.userLastActivity.set(ping.userId, effectiveActivity);
        query(
          `
          INSERT INTO activity_events (
            user_id, circle_id, activity, confidence, started_at, average_speed, max_speed
          )
          VALUES ($1, $2, $3, $4, TO_TIMESTAMP($5 / 1000.0), $6, $6)
          `,
          [
            userUuid,
            circleUuid,
            effectiveActivity,
            ping.activityConfidence || 0.85,
            ping.activityStartedAt || now,
            ping.speed,
          ]
        ).catch(() => {});
      }
    }

    // Ensure circle exists to prevent FK violation (only if not verified in memory)
    const membershipKey = `${circleUuid}:${userUuid}`;
    if (!this.verifiedMemberships.has(membershipKey)) {
      await query(
        `
        INSERT INTO circles (id, name, invite_code)
        VALUES ($1, 'Family Circle', $2)
        ON CONFLICT (id) DO NOTHING
        `,
        [circleUuid, ping.circleId.substring(0, 16)]
      ).catch(() => {});

      await query(
        `
        INSERT INTO circle_members (circle_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (circle_id, user_id) DO NOTHING
        `,
        [circleUuid, userUuid]
      ).catch(() => {});

      this.verifiedMemberships.add(membershipKey);
    }

    // Movement-based and 5-minute stationary checkpoint recording logic
    const lastRec = this.lastRecordedPoints.get(ping.userId);
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
        address: resolvedAddress || lastRec?.address || null,
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

  public broadcastMemberJoined(circleId: string, member: any): void {
    this.broadcastToCircle(circleId, {
      type: 'MEMBER_JOINED',
      data: {
        circleId,
        member,
      },
    });
  }

  public broadcastMemberLeft(circleId: string, userId: string, userName?: string): void {
    this.broadcastToCircle(circleId, {
      type: 'MEMBER_LEFT',
      data: {
        circleId,
        userId,
        userName,
      },
    });
  }

  public broadcastCircleUpdated(
    circleId: string,
    circleData: string | { name?: string; circleType?: string; badgeEmoji?: string; imageUrl?: string | null; distanceUnit?: string }
  ): void {
    const payload = typeof circleData === 'string'
      ? { circleId, name: circleData }
      : { circleId, ...circleData };
    this.broadcastToCircle(circleId, {
      type: 'CIRCLE_UPDATED',
      data: payload,
    });
  }

  public broadcastCircleMetaUpdated(
    circleId: string,
    meta: { circleType?: string; badgeEmoji?: string; imageUrl?: string | null; distanceUnit?: string }
  ): void {
    this.broadcastToCircle(circleId, {
      type: 'CIRCLE_META_UPDATED',
      data: {
        circleId,
        ...meta,
      },
    });
  }

  public broadcastNicknameUpdated(
    circleId: string,
    userId: string,
    targetUserId: string,
    nickname: string
  ): void {
    this.broadcastToCircle(circleId, {
      type: 'NICKNAME_UPDATED',
      data: {
        circleId,
        userId,
        targetUserId,
        nickname,
      },
    });
  }

  public broadcastNicknameDeleted(
    circleId: string,
    userId: string,
    targetUserId: string
  ): void {
    this.broadcastToCircle(circleId, {
      type: 'NICKNAME_DELETED',
      data: {
        circleId,
        userId,
        targetUserId,
      },
    });
  }

  public broadcastFavoritesUpdated(
    circleId: string,
    userId: string,
    favoriteUserId: string,
    isFavorite: boolean
  ): void {
    this.broadcastToCircle(circleId, {
      type: 'FAVORITES_UPDATED',
      data: {
        circleId,
        userId,
        favoriteUserId,
        isFavorite,
      },
    });
  }

  public broadcastToUser(userId: string, message: OutgoingWSMessage): void {
    const payload = JSON.stringify(message);
    const visitedSockets = new Set<WebSocket>();
    for (const [, userMap] of this.rooms.entries()) {
      const sockets = userMap.get(userId);
      if (sockets) {
        for (const sock of sockets) {
          if (!visitedSockets.has(sock) && sock.readyState === WebSocket.OPEN) {
            visitedSockets.add(sock);
            try {
              sock.send(payload);
            } catch (_) {}
          }
        }
      }
    }
  }

  public broadcastCircleDeleted(circleId: string): void {
    this.broadcastToCircle(circleId, {
      type: 'CIRCLE_DELETED',
      data: {
        circleId,
      },
    });
  }

  public broadcastPlaceCreated(circleId: string, place: any): void {
    this.broadcastToCircle(circleId, {
      type: 'PLACE_CREATED',
      data: {
        circleId,
        place,
      },
    });
  }

  public broadcastPlaceDeleted(circleId: string, placeId: string): void {
    this.broadcastToCircle(circleId, {
      type: 'PLACE_DELETED',
      data: {
        circleId,
        placeId,
      },
    });
  }

  public broadcastPlaceUpdated(circleId: string, place: any): void {
    this.broadcastToCircle(circleId, {
      type: 'PLACE_UPDATED',
      data: {
        circleId,
        place,
      },
    });
  }

  public broadcastMemberRoleUpdated(circleId: string, userId: string, newRole: string, updatedBy?: string): void {
    this.broadcastToCircle(circleId, {
      type: 'MEMBER_ROLE_UPDATED',
      data: {
        circleId,
        userId,
        newRole,
        updatedBy,
      },
    });
  }

  public broadcastMemberRemoved(circleId: string, userId: string, userName?: string, removedBy?: string): void {
    this.broadcastToCircle(circleId, {
      type: 'MEMBER_REMOVED',
      data: {
        circleId,
        userId,
        userName,
        removedBy,
      },
    });
  }

  public broadcastInviteCodeRegenerated(circleId: string, newInviteCode: string, regeneratedBy?: string): void {
    this.broadcastToCircle(circleId, {
      type: 'INVITE_CODE_REGENERATED',
      data: {
        circleId,
        newInviteCode,
        regeneratedBy,
      },
    });
  }

  public broadcastNotification(circleId: string, notification: any): void {
    this.broadcastToCircle(circleId, {
      type: 'NOTIFICATION_CREATED',
      data: notification,
    });
  }


  public broadcastBubbleStatus(
    circleId: string,
    userId: string,
    bubbleUntil: string | null,
    bubbleRadius: number,
    latitude?: number,
    longitude?: number
  ): void {
    if (bubbleUntil && new Date(bubbleUntil).getTime() > Date.now()) {
      this.activeBubbles.set(userId, {
        circleId,
        radiusMeters: bubbleRadius,
        expiresAt: new Date(bubbleUntil).getTime(),
      });
    } else {
      this.activeBubbles.delete(userId);
    }

    // Ghost Mode privacy rule:
    // Only notify the user themselves so they can see their countdown and active zone.
    // NEVER broadcast Ghost Mode activation to other circle members.
    this.broadcastToUser(userId, {
      type: 'BUBBLE_STATUS_CHANGED',
      data: {
        circleId,
        userId,
        bubbleUntil,
        bubbleRadius,
        latitude,
        longitude,
      },
    });
  }

  public async loadActiveBubbles(): Promise<void> {
    try {
      const rows = await query<{ user_id: string; circle_id: string; radius_meters: number; expires_at: string }>(
        'SELECT user_id, circle_id, radius_meters, expires_at FROM member_bubbles WHERE expires_at > NOW()'
      );
      for (const row of rows) {
        this.activeBubbles.set(row.user_id, {
          circleId: row.circle_id,
          radiusMeters: row.radius_meters,
          expiresAt: new Date(row.expires_at).getTime(),
        });
      }
      console.log(`[RoomManager] Loaded ${rows.length} active privacy bubbles into memory.`);
    } catch (e) {
      console.warn('[RoomManager] Error loading active bubbles from DB:', e);
    }
  }

  public broadcastProfileUpdated(
    userId: string,
    data: { fullName?: string; avatarUrl?: string | null; phone?: string | null }
  ): void {
    if (data.fullName !== undefined || data.avatarUrl !== undefined) {
      const prev = this.userProfileCache.get(userId);
      this.userProfileCache.set(userId, {
        fullName: data.fullName || prev?.fullName || '',
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : prev?.avatarUrl || null,
      });
    }

    for (const [circleId, userMap] of this.rooms.entries()) {
      if (userMap.has(userId)) {
        this.broadcastToCircle(circleId, {
          type: 'PROFILE_UPDATED',
          data: {
            userId,
            ...data,
          },
        });
      }
    }
  }

  private send(socket: WebSocket, message: OutgoingWSMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

export const roomManager = new RoomManager();
