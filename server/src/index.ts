import path from 'path';
import fs from 'fs';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import { roomManager } from './ws/roomManager';
import { circleRoutes } from './routes/circleRoutes';
import { TelemetryPing } from './types';
import pool, { query } from './db';
import { normalizeToUuid } from './utils/uuid';

dotenv.config();

const fastify = Fastify({
  logger: true,
});

// Telemetry ping Zod validation schema
const TelemetrySchema = z.object({
  type: z.literal('TELEMETRY_PING'),
  userId: z.string().min(1),
  circleId: z.string().min(1),
  userName: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).default(0),
  heading: z.number().min(0).max(360).default(0),
  batteryLevel: z.number().min(0).max(100).default(100),
  isCharging: z.boolean().default(false),
  timestamp: z.number().default(() => Date.now()),
  accuracy: z.number().optional(),
  altitude: z.number().optional(),
  activity: z.string().optional(),
  activityConfidence: z.number().optional(),
  activityStartedAt: z.number().optional(),
});

const SOSSchema = z.object({
  type: z.literal('SOS_TRIGGER'),
  userId: z.string().min(1),
  circleId: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

async function bootstrap() {
  // 1. Register Plugins
  await fastify.register(cors, {
    origin: '*',
  });

  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
    },
  });

  // 2. Health & Status (Supports both GET and HEAD for Render health-checks)
  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/',
    handler: async () => {
      return {
        status: 'ok',
        service: 'carering-realtime-engine',
        message: 'CareRing Real-Time Engine is running',
        health: '/health',
        websocket: '/ws/circles/:circleId',
        timestamp: new Date().toISOString(),
      };
    },
  });

  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/health',
    handler: async () => {
      return {
        status: 'ok',
        service: 'carering-realtime-engine',
        timestamp: new Date().toISOString(),
      };
    },
  });

  // Static avatar files serving
  fastify.get('/avatars/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string };
    const safeName = path.basename(filename);
    const filePath = path.join(__dirname, '..', 'avatars', safeName);
    if (fs.existsSync(filePath)) {
      reply.type('image/png');
      return fs.createReadStream(filePath);
    }
    return reply.status(404).send({ error: 'Avatar not found' });
  });

  // 3. Register HTTP Routes
  await fastify.register(circleRoutes);

  // 4. WebSocket Real-time Ingestion & Fan-out Gateway
  // Route: /ws/circles/:circleId?userId=...
  fastify.get(
    '/ws/circles/:circleId',
    { websocket: true },
    (socket, request) => {
      const { circleId } = request.params as { circleId: string };
      const queryParams = request.query as { userId?: string };
      const userId = queryParams.userId || `guest_${Math.random().toString(36).substring(2, 8)}`;

      // Register socket in circle room
      roomManager.joinRoom(circleId, userId, socket);

      socket.on('message', async (rawMessage: Buffer) => {
        try {
          const payload = JSON.parse(rawMessage.toString());

          // Route by message type
          if (payload.type === 'TELEMETRY_PING') {
            const parsed = TelemetrySchema.safeParse(payload);
            if (!parsed.success) {
              socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid telemetry ping schema' }));
              return;
            }

            // Reject timestamps more than 2 minutes in the future
            if (parsed.data.timestamp > Date.now() + 120_000) {
              socket.send(JSON.stringify({ type: 'ERROR', message: 'Telemetry timestamp rejected (in the future)' }));
              return;
            }

            // Ingest telemetry into room manager
            const ping: TelemetryPing = {
              userId: parsed.data.userId,
              circleId: parsed.data.circleId,
              userName: parsed.data.userName,
              latitude: parsed.data.latitude,
              longitude: parsed.data.longitude,
              speed: parsed.data.speed,
              heading: parsed.data.heading,
              batteryLevel: parsed.data.batteryLevel,
              isCharging: parsed.data.isCharging,
              timestamp: parsed.data.timestamp,
              accuracy: parsed.data.accuracy,
              altitude: parsed.data.altitude,
              activity: parsed.data.activity,
              activityConfidence: parsed.data.activityConfidence,
              activityStartedAt: parsed.data.activityStartedAt,
            };

            await roomManager.handleTelemetryPing(ping);
          } else if (payload.type === 'SOS_TRIGGER') {
            const parsed = SOSSchema.safeParse(payload);
            if (!parsed.success) return;

            await roomManager.triggerSOS(
              parsed.data.userId,
              parsed.data.circleId,
              parsed.data.latitude,
              parsed.data.longitude
            );
          } else if (payload.type === 'CHAT_MESSAGE') {
            const chatSchema = z.object({
              userId: z.string().min(1),
              circleId: z.string().min(1),
              content: z.string().min(1),
              messageType: z.enum(['text', 'preset', 'location']).default('text'),
              userName: z.string().optional(),
              avatarUrl: z.string().nullable().optional(),
            });
            const parsed = chatSchema.safeParse(payload);
            if (parsed.success) {
              const { userId: senderUserId, circleId: targetCircleId, content, messageType } = parsed.data;
              const cached = roomManager.getUserProfile(senderUserId);
              const senderName = parsed.data.userName || cached?.fullName || 'Family Member';
              const avatarUrl = parsed.data.avatarUrl !== undefined ? parsed.data.avatarUrl : (cached?.avatarUrl || null);

              // 0ms Real-Time Fan-out: Broadcast to all room members immediately!
              const msgId = crypto.randomUUID();
              const createdAt = new Date().toISOString();

              roomManager.broadcastChatMessage(targetCircleId, {
                id: msgId,
                circleId: targetCircleId,
                userId: senderUserId,
                userName: senderName,
                avatarUrl,
                content,
                messageType,
                createdAt,
              });

              // Asynchronously persist to database in background
              const userUuid = normalizeToUuid(senderUserId);
              const circleUuid = normalizeToUuid(targetCircleId);
              query(
                `
                INSERT INTO circle_messages (id, circle_id, user_id, content, message_type, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
                `,
                [msgId, circleUuid, userUuid, content, messageType, createdAt]
              ).catch((err) => console.error('[WS Chat] Background insert error:', err));
            }
          } else if (payload.type === 'DIRECT_MESSAGE') {
            const dmSchema = z.object({
              senderId: z.string().min(1),
              recipientId: z.string().min(1),
              circleId: z.string().min(1),
              content: z.string().min(1),
              messageType: z.enum(['text', 'preset', 'location']).default('text'),
              senderName: z.string().optional(),
              senderAvatar: z.string().nullable().optional(),
            });
            const parsed = dmSchema.safeParse(payload);
            if (parsed.success) {
              const { senderId, recipientId, circleId: targetCircleId, content, messageType } = parsed.data;
              const cached = roomManager.getUserProfile(senderId);
              const senderName = parsed.data.senderName || cached?.fullName || 'Family Member';
              const senderAvatar = parsed.data.senderAvatar !== undefined ? parsed.data.senderAvatar : (cached?.avatarUrl || null);

              const msgId = crypto.randomUUID();
              const createdAt = new Date().toISOString();

              // 0ms Real-Time Delivery: Deliver to both sender and recipient sockets immediately!
              roomManager.sendDirectMessage(targetCircleId, senderId, recipientId, {
                id: msgId,
                circleId: targetCircleId,
                senderId,
                senderName,
                senderAvatar,
                recipientId,
                content,
                messageType,
                createdAt,
              });

              // Asynchronously persist to database in background
              const senderUuid = normalizeToUuid(senderId);
              const recipientUuid = normalizeToUuid(recipientId);
              const circleUuid = normalizeToUuid(targetCircleId);
              query(
                `
                INSERT INTO direct_messages (id, circle_id, sender_id, recipient_id, content, message_type, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
                `,
                [msgId, circleUuid, senderUuid, recipientUuid, content, messageType, createdAt]
              ).catch((err) => console.error('[WS DM] Background insert error:', err));
            }
          } else if (payload.type === 'TYPING_STATUS') {
            const typingSchema = z.object({
              circleId: z.string().min(1),
              userId: z.string().min(1),
              userName: z.string().default('Member'),
              isTyping: z.boolean(),
            });
            const parsed = typingSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, userId: senderUserId, userName, isTyping } = parsed.data;
              roomManager.broadcastTypingStatus(
                targetCircleId,
                {
                  circleId: targetCircleId,
                  userId: senderUserId,
                  userName,
                  isTyping,
                },
                senderUserId
              );
            }
          } else if (payload.type === 'DIRECT_TYPING_STATUS') {
            const directTypingSchema = z.object({
              circleId: z.string().min(1),
              senderId: z.string().min(1),
              recipientId: z.string().min(1),
              senderName: z.string().default('Member'),
              isTyping: z.boolean(),
            });
            const parsed = directTypingSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, senderId, recipientId, senderName, isTyping } = parsed.data;
              roomManager.sendDirectTypingStatus(
                targetCircleId,
                senderId,
                recipientId,
                {
                  circleId: targetCircleId,
                  senderId,
                  recipientId,
                  senderName,
                  isTyping,
                }
              );
            }
          } else if (payload.type === 'LIVE_REACTION') {
            const reactionSchema = z.object({
              circleId: z.string().min(1),
              senderId: z.string().min(1),
              senderName: z.string().default('Member'),
              targetUserId: z.string().min(1),
              emoji: z.string().default('🍅'),
              label: z.string().default('Reaction'),
            });
            const parsed = reactionSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, senderId, senderName, targetUserId, emoji, label } = parsed.data;
              roomManager.broadcastLiveReaction(targetCircleId, {
                circleId: targetCircleId,
                senderId,
                senderName,
                targetUserId,
                emoji,
                label,
                timestamp: Date.now(),
              });
            }
          } else if (payload.type === 'CHECK_IN') {
            const checkinSchema = z.object({
              circleId: z.string().min(1),
              userId: z.string().min(1),
              userName: z.string().default('Member'),
              address: z.string().default('Current Location'),
              latitude: z.number(),
              longitude: z.number(),
            });
            const parsed = checkinSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, userId: checkinUserId, userName, address, latitude, longitude } = parsed.data;
              roomManager.broadcastCheckIn(targetCircleId, {
                circleId: targetCircleId,
                userId: checkinUserId,
                userName,
                address,
                latitude,
                longitude,
                timestamp: Date.now(),
              });
            }
          } else if (payload.type === 'JOIN_CIRCLE') {
            const joinSchema = z.object({
              inviteCode: z.string().min(3),
              userId: z.string().min(1),
            });
            const parsed = joinSchema.safeParse(payload);
            if (parsed.success) {
              const { inviteCode, userId: joiningUserId } = parsed.data;
              const cleanCode = inviteCode.trim().toUpperCase();
              const userUuid = normalizeToUuid(joiningUserId);

              const cRows = await query<any>(
                'SELECT id, name FROM circles WHERE UPPER(TRIM(invite_code)) = $1 LIMIT 1',
                [cleanCode]
              );
              if (cRows.length > 0) {
                const targetCircle = cRows[0];
                const circleUuid = normalizeToUuid(targetCircle.id);

                // Check existing
                const existing = await query(
                  'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
                  [circleUuid, userUuid]
                );

                if (existing.length === 0) {
                  await query(
                    `INSERT INTO circle_members (circle_id, user_id, role) VALUES ($1, $2, 'member')`,
                    [circleUuid, userUuid]
                  );
                }

                // Add to room & broadcast
                roomManager.joinRoom(targetCircle.id, joiningUserId, socket);

                const uRows = await query<any>(
                  `SELECT id, full_name, email, phone, avatar_url, battery_level, is_battery_charging,
                          last_latitude, last_longitude, resolved_address
                   FROM users WHERE id = $1`,
                  [userUuid]
                );
                if (uRows.length > 0) {
                  const u = uRows[0];
                  roomManager.broadcastMemberJoined(targetCircle.id, {
                    id: u.id,
                    fullName: u.full_name || 'New Member',
                    email: u.email,
                    phone: u.phone || null,
                    avatarUrl: u.avatar_url || null,
                    role: 'member',
                    batteryLevel: u.battery_level ?? 85,
                    isBatteryCharging: !!u.is_battery_charging,
                    latitude: u.last_latitude ? parseFloat(u.last_latitude) : undefined,
                    longitude: u.last_longitude ? parseFloat(u.last_longitude) : undefined,
                    address: u.resolved_address || null,
                    isOnline: true,
                    joinedAt: new Date().toISOString(),
                  });
                }
              }
            }
          } else if (payload.type === 'LEAVE_CIRCLE') {
            const leaveSchema = z.object({
              circleId: z.string().min(1),
              userId: z.string().min(1),
            });
            const parsed = leaveSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, userId: leavingUserId } = parsed.data;
              const userUuid = normalizeToUuid(leavingUserId);
              const circleUuid = normalizeToUuid(targetCircleId);

              const uRows = await query<{ full_name: string }>('SELECT full_name FROM users WHERE id = $1', [userUuid]);
              const userName = uRows[0]?.full_name;

              await query('DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2', [circleUuid, userUuid]);
              roomManager.leaveRoom(targetCircleId, leavingUserId, socket);
              roomManager.broadcastMemberLeft(targetCircleId, leavingUserId, userName);
            }
          } else if (payload.type === 'UPDATE_BUBBLE') {
            const bubbleSchema = z.object({
              circleId: z.string().min(1),
              userId: z.string().min(1),
              active: z.boolean(),
              radiusMeters: z.number().default(2000),
              durationMinutes: z.number().default(120),
            });
            const parsed = bubbleSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, userId: targetUserId, active, radiusMeters, durationMinutes } = parsed.data;
              const userUuid = normalizeToUuid(targetUserId);
              const circleUuid = normalizeToUuid(targetCircleId);

              if (active) {
                const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
                await query(
                  `INSERT INTO member_bubbles (user_id, circle_id, radius_meters, expires_at)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (user_id) DO UPDATE SET radius_meters = EXCLUDED.radius_meters, expires_at = EXCLUDED.expires_at`,
                  [userUuid, circleUuid, radiusMeters, expiresAt]
                );
                roomManager.broadcastBubbleStatus(targetCircleId, targetUserId, expiresAt, radiusMeters);
              } else {
                await query('DELETE FROM member_bubbles WHERE user_id = $1', [userUuid]);
                roomManager.broadcastBubbleStatus(targetCircleId, targetUserId, null, 0);
              }
            }
          } else if (payload.type === 'UPDATE_CIRCLE_META') {
            const metaSchema = z.object({
              circleId: z.string().min(1),
              circleType: z.string().optional(),
              badgeEmoji: z.string().optional(),
              imageUrl: z.string().nullable().optional(),
              distanceUnit: z.string().optional(),
            });
            const parsed = metaSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, circleType, badgeEmoji, imageUrl, distanceUnit } = parsed.data;
              const circleUuid = normalizeToUuid(targetCircleId);
              await query(
                `UPDATE circles
                 SET circle_type = COALESCE($1, circle_type),
                     badge_emoji = COALESCE($2, badge_emoji),
                     image_url = COALESCE($3, image_url),
                     distance_unit = COALESCE($4, distance_unit),
                     updated_at = NOW()
                 WHERE id = $5`,
                [circleType || null, badgeEmoji || null, imageUrl || null, distanceUnit || null, circleUuid]
              );
              roomManager.broadcastCircleMetaUpdated(targetCircleId, {
                circleType,
                badgeEmoji,
                imageUrl,
                distanceUnit,
              });
            }
          } else if (payload.type === 'UPDATE_NICKNAME') {
            const nickSchema = z.object({
              circleId: z.string().min(1),
              userId: z.string().min(1),
              targetUserId: z.string().min(1),
              nickname: z.string(),
            });
            const parsed = nickSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, userId: sUserId, targetUserId, nickname } = parsed.data;
              const trimmed = nickname.trim();
              const userUuid = normalizeToUuid(sUserId);
              const circleUuid = normalizeToUuid(targetCircleId);
              const targetUuid = normalizeToUuid(targetUserId);

              if (trimmed) {
                await query(
                  `INSERT INTO user_nicknames (user_id, circle_id, target_user_id, nickname, updated_at)
                   VALUES ($1, $2, $3, $4, NOW())
                   ON CONFLICT (user_id, circle_id, target_user_id)
                   DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = NOW()`,
                  [userUuid, circleUuid, targetUuid, trimmed]
                );
                roomManager.broadcastNicknameUpdated(targetCircleId, sUserId, targetUserId, trimmed);
              } else {
                await query(
                  `DELETE FROM user_nicknames WHERE user_id = $1 AND circle_id = $2 AND target_user_id = $3`,
                  [userUuid, circleUuid, targetUuid]
                );
                roomManager.broadcastNicknameDeleted(targetCircleId, sUserId, targetUserId);
              }
            }
          } else if (payload.type === 'TOGGLE_FAVORITE') {
            const favSchema = z.object({
              circleId: z.string().min(1),
              userId: z.string().min(1),
              favoriteUserId: z.string().min(1),
              isFavorite: z.boolean(),
            });
            const parsed = favSchema.safeParse(payload);
            if (parsed.success) {
              const { circleId: targetCircleId, userId: sUserId, favoriteUserId, isFavorite } = parsed.data;
              const userUuid = normalizeToUuid(sUserId);
              const circleUuid = normalizeToUuid(targetCircleId);
              const favUuid = normalizeToUuid(favoriteUserId);

              if (isFavorite) {
                await query(
                  `INSERT INTO user_favorite_members (user_id, circle_id, favorite_user_id)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (user_id, circle_id, favorite_user_id) DO NOTHING`,
                  [userUuid, circleUuid, favUuid]
                );
              } else {
                await query(
                  `DELETE FROM user_favorite_members WHERE user_id = $1 AND circle_id = $2 AND favorite_user_id = $3`,
                  [userUuid, circleUuid, favUuid]
                );
              }
              roomManager.broadcastFavoritesUpdated(targetCircleId, sUserId, favoriteUserId, isFavorite);
            }
          } else if (payload.type === 'UPDATE_PREFERENCES') {
            const prefSchema = z.object({
              userId: z.string().min(1),
              theme: z.string().optional(),
              distanceUnit: z.string().optional(),
              safetyDetectionEnabled: z.boolean().optional(),
              safetyNotificationsEnabled: z.boolean().optional(),
              speedLimitOverride: z.number().nullable().optional(),
              backgroundTrackingEnabled: z.boolean().optional(),
              notificationPreferences: z.any().optional(),
            });
            const parsed = prefSchema.safeParse(payload);
            if (parsed.success) {
              const {
                userId: sUserId,
                theme,
                distanceUnit,
                safetyDetectionEnabled,
                safetyNotificationsEnabled,
                speedLimitOverride,
                backgroundTrackingEnabled,
                notificationPreferences,
              } = parsed.data;
              const userUuid = normalizeToUuid(sUserId);
              await query(
                `INSERT INTO user_preferences (user_id, theme, distance_unit, safety_detection_enabled, safety_notifications_enabled, speed_limit_override, background_tracking_enabled, notification_preferences, updated_at)
                 VALUES ($1, COALESCE($2, 'dark'), COALESCE($3, 'metric'), COALESCE($4, true), COALESCE($5, true), $6, COALESCE($7, true), COALESCE($8, '{}'::jsonb), NOW())
                 ON CONFLICT (user_id) DO UPDATE SET
                   theme = COALESCE($2, user_preferences.theme),
                   distance_unit = COALESCE($3, user_preferences.distance_unit),
                   safety_detection_enabled = COALESCE($4, user_preferences.safety_detection_enabled),
                   safety_notifications_enabled = COALESCE($5, user_preferences.safety_notifications_enabled),
                   speed_limit_override = COALESCE($6, user_preferences.speed_limit_override),
                   background_tracking_enabled = COALESCE($7, user_preferences.background_tracking_enabled),
                   notification_preferences = COALESCE($8, user_preferences.notification_preferences),
                   updated_at = NOW()`,
                [
                  userUuid,
                  theme || null,
                  distanceUnit || null,
                  safetyDetectionEnabled !== undefined ? safetyDetectionEnabled : null,
                  safetyNotificationsEnabled !== undefined ? safetyNotificationsEnabled : null,
                  speedLimitOverride !== undefined ? speedLimitOverride : null,
                  backgroundTrackingEnabled !== undefined ? backgroundTrackingEnabled : null,
                  notificationPreferences ? JSON.stringify(notificationPreferences) : null,
                ]
              );
              roomManager.broadcastToUser(sUserId, {
                type: 'USER_PREFERENCES_UPDATED',
                data: {
                  userId: sUserId,
                  preferences: parsed.data,
                },
              });
            }
          } else if (payload.type === 'PING') {
            socket.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch (err) {
          fastify.log.error(err, '[WS] Error processing incoming payload');
        }
      });

      socket.on('close', () => {
        roomManager.leaveRoom(circleId, userId, socket);
      });

      socket.on('error', (error) => {
        fastify.log.error(error, `[WS] Socket error for user ${userId}`);
        roomManager.leaveRoom(circleId, userId, socket);
      });
    }
  );

  // 5. Start Listening
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    console.log(`🚀 CareRing Real-Time Server running on http://${host}:${port}`);
    console.log(`📡 WebSocket endpoint available at ws://${host}:${port}/ws/circles/:circleId`);

    // Load active privacy bubbles into memory cache for 0ms telemetry masking
    await roomManager.loadActiveBubbles();

    // Validate Social Authentication Settings (Google Client ID or Apple Client ID)
    const googleClientId = (process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const appleClientId = (process.env.APPLE_CLIENT_ID || process.env.APPLE_SERVICE_ID || '').trim();

    if (!googleClientId && !appleClientId) {
      console.warn(`\n⚠️  [SELF-HOSTED AUTH NOTICE]`);
      console.warn(`   Neither GOOGLE_CLIENT_ID nor APPLE_CLIENT_ID is set in environment.`);
      console.warn(`   CareRing uses social authentication (no passwords). For self-hosting,`);
      console.warn(`   AT LEAST ONE of the following is required for users to log in:`);
      console.warn(`   • GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com`);
      console.warn(`   • APPLE_CLIENT_ID=your-apple-service-id (or app bundle ID)`);
      console.warn(`   Endpoint status available at GET /api/auth/config\n`);
    } else {
      const activeList = [
        googleClientId ? 'Google OAuth 2.0' : null,
        appleClientId ? 'Apple Sign-In' : null,
      ].filter(Boolean).join(' & ');
      console.log(`🔐 Social Authentication Ready: ${activeList}`);
    }    // Keep Neon serverless database warm to prevent 2.5s cold-start latencies
    setInterval(() => {
      query('SELECT 1').catch(() => {});
    }, 2.5 * 60 * 1000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful Shutdown
const cleanup = async () => {
  console.log('Shutting down server...');
  await fastify.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

bootstrap();
