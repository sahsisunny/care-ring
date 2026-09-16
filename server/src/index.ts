import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import { roomManager } from './ws/roomManager';
import { circleRoutes } from './routes/circleRoutes';
import { TelemetryPing } from './types';
import pool from './db';

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

  // 2. Health & Status
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'life360-realtime-engine',
      timestamp: new Date().toISOString(),
    };
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
          } else if (payload.type === 'PING') {
            socket.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch (err) {
          fastify.log.error(err, '[WS] Error processing incoming payload');
        }
      });

      socket.on('close', () => {
        roomManager.leaveRoom(circleId, userId);
      });

      socket.on('error', (error) => {
        fastify.log.error(error, `[WS] Socket error for user ${userId}`);
        roomManager.leaveRoom(circleId, userId);
      });
    }
  );

  // 5. Start Listening
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    console.log(`🚀 Life360 Real-Time Server running on http://${host}:${port}`);
    console.log(`📡 WebSocket endpoint available at ws://${host}:${port}/ws/circles/:circleId`);
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
