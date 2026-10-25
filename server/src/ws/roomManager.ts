import { WebSocket } from 'ws';
import crypto from 'crypto';
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
import { reverseGeocodeWithTitle } from '../services/geocodingService';
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

// Spatial displacement threshold: If the user stays within this range (in meters),
// it is treated as the same location and duplicate rows are NOT inserted into PostgreSQL location_history.
const MIN_DISPLACEMENT_METERS = parseInt(process.env.LOCATION_HISTORY_MIN_DISPLACEMENT_METERS || '30', 10);

interface RecordedHistoryPoint {
  historyId?: string | number;
  latitude: number;
  longitude: number;
  timestamp: number;
  isStationary: boolean;
  address?: string | null;
  stationaryDurationSec?: number;
  lastPersistedDurationSec?: number;
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

  /**
   * Get real-time connection and room statistics for health monitoring
   */
  public getStats() {
    let activeConnections = 0;
    const uniqueUsers = new Set<string>();

    for (const userMap of this.rooms.values()) {
      for (const [userId, sockets] of userMap.entries()) {
        if (sockets.size > 0) {
          uniqueUsers.add(userId);
          activeConnections += sockets.size;
        }
      }
    }

    return {
      activeRooms: this.rooms.size,
      activeConnections,
      activeUsers: uniqueUsers.size,
      activeBubbles: this.activeBubbles.size,
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
          // Exclude the actor so they do not receive an alert about their own movement!
          this.broadcastToCircle(
            ping.circleId,
            {
              type: 'GEOFENCE_ALERT',
              data: {
                userId: transition.userId,
                userName: transition.userName,
                placeId: transition.placeId,
                placeName: transition.placeName,
                event: transition.eventType,
                timestamp: transition.timestamp,
              },
            },
            ping.userId
          );
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
    longitude: number,
    clientPlaceName?: string | null,
    clientAddress?: string | null
  ): Promise<void> {
    let userName = 'Family Member';
    let userPhone: string | null = null;
    let userAvatar: string | null = null;
    let userBattery: number | null = null;
    let userIsCharging: boolean = false;
    let userSpeed: number | null = null;
    let userHeading: number | null = null;

    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      const user = await query<{
        full_name: string;
        phone: string | null;
        avatar_url: string | null;
        battery_level: number | null;
        is_charging: boolean | null;
        last_speed: number | null;
        last_heading: number | null;
      }>(
        'SELECT full_name, phone, avatar_url, battery_level, is_charging, last_speed, last_heading FROM users WHERE id = $1',
        [userUuid]
      );
      if (user[0]?.full_name) userName = user[0].full_name;
      if (user[0]?.phone) userPhone = user[0].phone;
      if (user[0]?.avatar_url) userAvatar = user[0].avatar_url;
      if (user[0]?.battery_level !== undefined && user[0]?.battery_level !== null) userBattery = user[0].battery_level;
      if (user[0]?.is_charging !== undefined && user[0]?.is_charging !== null) userIsCharging = user[0].is_charging;
      if (user[0]?.last_speed !== undefined && user[0]?.last_speed !== null) userSpeed = Number(user[0].last_speed);
      if (user[0]?.last_heading !== undefined && user[0]?.last_heading !== null) userHeading = Number(user[0].last_heading);
    } catch {}

    // Resolve human-readable place name and address
    let placeName: string | null = clientPlaceName || null;
    let address: string | null = clientAddress || null;

    try {
      const placeRows = await query<{ name: string; address?: string }>(
        `SELECT name, address FROM places 
         WHERE circle_id = $1 
           AND ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) <= radius_meters 
         ORDER BY ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) ASC 
         LIMIT 1`,
        [circleUuid, longitude, latitude]
      );
      if (placeRows && placeRows.length > 0) {
        placeName = placeRows[0].name;
        if (placeRows[0].address) address = placeRows[0].address;
      }
    } catch (err) {
      console.warn('[RoomManager] Failed to query circle place on SOS:', err);
    }

    if (!placeName || !address) {
      try {
        const geo = await reverseGeocodeWithTitle(latitude, longitude);
        if (geo) {
          if (!placeName && geo.title) placeName = geo.title;
          if (!address && geo.address) address = geo.address;
        }
      } catch (err) {
        console.warn('[RoomManager] Reverse geocode on SOS error:', err);
      }
    }

    const sosAlertId = crypto.randomUUID();

    const sosMsg: SOSAlertMessage = {
      type: 'SOS_ALERT',
      data: {
        id: sosAlertId,
        userId,
        userName,
        phone: userPhone,
        circleId,
        latitude,
        longitude,
        placeName: placeName || null,
        address: address || null,
        timestamp: Date.now(),
      },
    };

    console.warn(
      `[EMERGENCY SOS] Triggered by ${userName} (${userId}) in circle ${circleId}! Alert ID: ${sosAlertId} Location: ${placeName || 'Unknown'} (${latitude}, ${longitude}) Phone: ${userPhone}`
    );

    // 1. Persist complete SOS incident record to DB with all details
    try {
      await query(
        `
        INSERT INTO sos_alerts (
          id, circle_id, user_id, user_name, user_phone, status,
          latitude, longitude, location, place_name, address,
          battery_level, is_charging, speed, heading,
          triggered_at, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'active',
          $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326), $8, $9,
          $10, $11, $12, $13,
          NOW(), $14, NOW(), NOW()
        )
        `,
        [
          sosAlertId,
          circleUuid,
          userUuid,
          userName,
          userPhone,
          latitude,
          longitude,
          placeName || null,
          address || null,
          userBattery,
          userIsCharging,
          userSpeed,
          userHeading,
          JSON.stringify({
            avatarUrl: userAvatar,
            clientPlaceName: clientPlaceName || null,
            clientAddress: clientAddress || null,
          }),
        ]
      );
      console.log(`[DB] Successfully recorded SOS incident ${sosAlertId} for ${userName} (${userId})`);
    } catch (dbErr) {
      console.error('[RoomManager] Failed to persist SOS incident to DB:', dbErr);
    }

    // 2. Emergency SOS immediately bursts any active privacy bubble for life-saving safety!
    try {
      await query('DELETE FROM member_bubbles WHERE user_id = $1', [userUuid]);
      this.activeBubbles.delete(userId);
      this.broadcastBubbleStatus(circleId, userId, null, 0, latitude, longitude);
    } catch (err) {
      console.error('[RoomManager] Failed to burst bubble on SOS:', err);
    }

    // 3. High-priority real-time SOS takeover alert to all circle members
    this.broadcastToCircle(circleId, sosMsg);

    // 4. Normal circle group chat message in the background
    const locLabel = placeName
      ? `${placeName} (GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
      : `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const alertChatContent = `🚨 EMERGENCY SOS: ${userName} triggered an Emergency SOS distress alert at ${locLabel}! Immediate assistance needed.`;
    const msgId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const chatPayload: ChatMessage = {
      id: msgId,
      circleId,
      userId,
      userName,
      avatarUrl: userAvatar,
      content: alertChatContent,
      messageType: 'preset',
      createdAt,
    };

    // Broadcast chat message to active sockets immediately
    this.broadcastChatMessage(circleId, chatPayload);

    // Persist to circle_messages in DB
    query(
      `
      INSERT INTO circle_messages (id, circle_id, user_id, content, message_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
      `,
      [msgId, circleUuid, userUuid, alertChatContent, 'preset', createdAt]
    ).catch((err) => console.error('[RoomManager] Failed to persist SOS chat message in DB:', err));

    // 5. Audit record in notifications table for all other circle members
    query(
      `
      INSERT INTO notifications (circle_id, user_id, actor_id, type, title, body, data, created_at)
      SELECT $1, cm.user_id, $2, 'emergency_sos', $3, $4, $5, NOW()
      FROM circle_members cm
      WHERE cm.circle_id = $1 AND cm.user_id != $2
      `,
      [
        circleUuid,
        userUuid,
        `🚨 Emergency SOS Alert from ${userName}`,
        `${userName} triggered an Emergency SOS distress alert at ${placeName || 'their location'}!`,
        JSON.stringify({
          sosAlertId,
          userId,
          userName,
          latitude,
          longitude,
          placeName,
          address,
        }),
      ]
    ).catch((err) => console.error('[RoomManager] Failed to insert SOS notifications in DB:', err));
  }

  /**
   * Resolves an active emergency SOS broadcast when the member marks themselves as safe
   */
  public async resolveSOS(
    userId: string,
    circleId: string
  ): Promise<void> {
    let userName = 'Family Member';
    let userAvatar: string | null = null;
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      const user = await query<{ full_name: string; avatar_url: string | null }>(
        'SELECT full_name, avatar_url FROM users WHERE id = $1',
        [userUuid]
      );
      if (user[0]?.full_name) userName = user[0].full_name;
      if (user[0]?.avatar_url) userAvatar = user[0].avatar_url;
    } catch {}

    const resolvedMsg: any = {
      type: 'SOS_RESOLVED',
      data: {
        userId,
        userName,
        circleId,
        timestamp: Date.now(),
      },
    };

    console.log(`[EMERGENCY SOS] Resolved: ${userName} (${userId}) marked safe in circle ${circleId}`);

    // 1. Update SOS alert record in DB to resolved
    try {
      await query(
        `
        UPDATE sos_alerts
        SET status = 'resolved',
            resolved_at = NOW(),
            resolved_by = $1,
            updated_at = NOW()
        WHERE user_id = $1 AND circle_id = $2 AND status = 'active'
        `,
        [userUuid, circleUuid]
      );
      console.log(`[DB] Marked active SOS alerts as resolved for user ${userName} (${userId}) in circle ${circleId}`);
    } catch (dbErr) {
      console.error('[RoomManager] Failed to update SOS alert resolution in DB:', dbErr);
    }

    // 2. Broadcast resolution event to active sockets
    this.broadcastToCircle(circleId, resolvedMsg);

    // 3. Normal circle group chat message in the background confirming member safety
    const resolveContent = `✅ SOS RESOLVED: ${userName} marked themselves as Safe. Emergency alert ended.`;
    const resolveMsgId = crypto.randomUUID();
    const resolveCreatedAt = new Date().toISOString();

    const resolveChatPayload: ChatMessage = {
      id: resolveMsgId,
      circleId,
      userId,
      userName,
      avatarUrl: userAvatar,
      content: resolveContent,
      messageType: 'preset',
      createdAt: resolveCreatedAt,
    };

    this.broadcastChatMessage(circleId, resolveChatPayload);

    query(
      `
      INSERT INTO circle_messages (id, circle_id, user_id, content, message_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
      `,
      [resolveMsgId, circleUuid, userUuid, resolveContent, 'preset', resolveCreatedAt]
    ).catch((err) => console.error('[RoomManager] Failed to persist SOS resolved message in DB:', err));

    // 4. Record resolution notification in notifications table
    query(
      `
      INSERT INTO notifications (circle_id, user_id, actor_id, type, title, body, data, created_at)
      SELECT $1, cm.user_id, $2, 'sos_resolved', $3, $4, $5, NOW()
      FROM circle_members cm
      WHERE cm.circle_id = $1 AND cm.user_id != $2
      `,
      [
        circleUuid,
        userUuid,
        `✅ SOS Resolved: ${userName} is safe`,
        `${userName} has marked themselves as safe. The emergency alert has ended.`,
        JSON.stringify({
          userId,
          userName,
          resolvedAt: new Date().toISOString(),
        }),
      ]
    ).catch((err) => console.error('[RoomManager] Failed to insert SOS resolved notifications in DB:', err));
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

    // Range-based location recording logic (Optimized to eliminate duplicate points within range threshold)
    let lastRec = this.lastRecordedPoints.get(ping.userId);

    // If cache is empty (e.g. after server restart or new process), retrieve latest recorded point from DB
    if (!lastRec) {
      const recentRows = await query<{
        id: string;
        latitude: number;
        longitude: number;
        recorded_at: Date;
        stationary_duration_sec: number;
        resolved_address: string | null;
        speed: number;
      }>(
        `SELECT id, ST_Y(location)::float AS latitude, ST_X(location)::float AS longitude,
                recorded_at, stationary_duration_sec, resolved_address, speed::float
         FROM location_history
         WHERE user_id = $1
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [userUuid]
      ).catch(() => []);

      if (recentRows.length > 0) {
        const row = recentRows[0];
        lastRec = {
          historyId: row.id,
          latitude: row.latitude,
          longitude: row.longitude,
          timestamp: new Date(row.recorded_at).getTime(),
          isStationary: (row.speed || 0) < 3.0,
          address: row.resolved_address,
          stationaryDurationSec: row.stationary_duration_sec || 0,
          lastPersistedDurationSec: row.stationary_duration_sec || 0,
        };
        this.lastRecordedPoints.set(ping.userId, lastRec);
      }
    }

    let shouldInsert = false;

    if (!lastRec) {
      // First point ever for this user
      shouldInsert = true;
    } else {
      const timeDiffMs = now - lastRec.timestamp;
      const distMeters = computeDistanceMeters(lastRec.latitude, lastRec.longitude, ping.latitude, ping.longitude);
      const isWithinSameLocation = distMeters < MIN_DISPLACEMENT_METERS;

      if (isWithinSameLocation) {
        // User is within range threshold (same location) -> NEVER insert duplicate rows!
        shouldInsert = false;

        // If user is stationary or stopped at this location, update existing record's duration and address (throttled to once per minute)
        if (isStationary || (ping.speed || 0) < 3.0) {
          const durationDiff = Math.abs(stationaryDurationSec - (lastRec.lastPersistedDurationSec || 0));
          const addressNewlyResolved = !!resolvedAddress && resolvedAddress !== lastRec.address;

          if (lastRec.historyId && (durationDiff >= 60 || addressNewlyResolved)) {
            lastRec.lastPersistedDurationSec = stationaryDurationSec;
            lastRec.stationaryDurationSec = stationaryDurationSec;
            if (resolvedAddress) lastRec.address = resolvedAddress;
            lastRec.timestamp = now;

            query(
              `
              UPDATE location_history
              SET stationary_duration_sec = $1,
                  battery_level = $2,
                  is_charging = $3,
                  resolved_address = COALESCE($4, resolved_address)
              WHERE id = $5
              `,
              [
                stationaryDurationSec,
                ping.batteryLevel,
                ping.isCharging,
                resolvedAddress,
                lastRec.historyId,
              ]
            ).catch(() => {});
          }
        }
      } else {
        // User has moved beyond MIN_DISPLACEMENT_METERS (new trip point or moved to new location)
        const isMoving = !isStationary && (ping.speed || 0) >= 3.0;
        if (isMoving) {
          // While traveling, record smooth polyline: every >= 4s if moved >= 30m, or instantly if jumped >= 150m
          if (timeDiffMs >= 4000 || distMeters >= 150) {
            shouldInsert = true;
          }
        } else {
          // User stopped at a new distinct location >= MIN_DISPLACEMENT_METERS away
          shouldInsert = true;
        }
      }
    }

    if (shouldInsert) {
      // Insert into time-series location history with PostGIS point and capture ID
      const insertRes = await query<{ id: string }>(
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
        RETURNING id
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
      ).catch((err) => {
        console.error('[RoomManager] Failed to insert location_history:', err);
        return [];
      });

      const insertedId = insertRes && insertRes.length > 0 ? insertRes[0].id : undefined;

      this.lastRecordedPoints.set(ping.userId, {
        historyId: insertedId,
        latitude: ping.latitude,
        longitude: ping.longitude,
        timestamp: now,
        isStationary,
        address: resolvedAddress || lastRec?.address || null,
        stationaryDurationSec,
        lastPersistedDurationSec: stationaryDurationSec,
      });
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

  public broadcastNotification(circleId: string, notification: any, excludeUserId?: string): void {
    this.broadcastToCircle(
      circleId,
      {
        type: 'NOTIFICATION_CREATED',
        data: notification,
      },
      excludeUserId
    );
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
