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

    // Keep Neon serverless database warm to prevent 2.5s cold-start latencies
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
