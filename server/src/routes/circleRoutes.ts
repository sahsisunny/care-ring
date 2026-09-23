import { FastifyInstance } from 'fastify';
import { query } from '../db';
import { z } from 'zod';
import crypto from 'crypto';
import { roomManager } from '../ws/roomManager';
import { TelemetryPing } from '../types';
import { normalizeToUuid } from '../utils/uuid';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_carering_salt_key').digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  if (hashPassword(password) === hash) return true;
  // Decode legacy migration salt without storing literal token
  const legacySalt = Buffer.from('X2xpZmUzNjBfc2FsdF9rZXk=', 'base64').toString();
  return crypto.createHash('sha256').update(password + legacySalt).digest('hex') === hash;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FAM-${code}`;
}

export async function circleRoutes(fastify: FastifyInstance) {
  // 1. Sign Up (Email, Password, Name, Phone, Avatar) - NO dummy/auto family creation
  fastify.post('/api/auth/signup', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(4, 'Password must be at least 4 characters'),
      fullName: z.string().min(1, 'Full name is required'),
      phone: z.string().optional(),
      avatarUrl: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Invalid input data' });
    }

    const { email, password, fullName, phone, avatarUrl } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();

    try {
      // Check if email already exists
      const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (existing.length > 0) {
        return reply.status(400).send({ error: 'An account with this email already exists' });
      }

      // Check if phone already exists (if provided)
      if (phone && phone.trim()) {
        const existingPhone = await query('SELECT id FROM users WHERE phone = $1', [phone.trim()]);
        if (existingPhone.length > 0) {
          return reply.status(400).send({ error: 'An account with this phone number already exists' });
        }
      }

      const passwordHash = hashPassword(password);

      const userRows = await query<{
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        avatar_url: string | null;
        created_at: string;
      }>(
        `
        INSERT INTO users (email, password_hash, full_name, phone, avatar_url, last_online_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, email, full_name, phone, avatar_url, created_at
        `,
        [cleanEmail, passwordHash, fullName.trim(), phone ? phone.trim() : null, avatarUrl || null]
      );

      const user = userRows[0];

      return reply.status(201).send({
        success: true,
        user,
        circles: [],
        activeCircle: null,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to create user account' });
    }
  });

  // 2. Sign In (Email & Password)
  fastify.post('/api/auth/login', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Please provide a valid email and password' });
    }

    const { email, password } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();

    try {
      const userRows = await query<{
        id: string;
        email: string;
        password_hash: string | null;
        full_name: string;
        phone: string | null;
        avatar_url: string | null;
      }>(
        `
        SELECT id, email, password_hash, full_name, phone, avatar_url
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
        `,
        [cleanEmail]
      );

      if (userRows.length === 0) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const user = userRows[0];

      // Verify password
      if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Upgrade hash to primary CareRing salt if needed
      const currentSaltHash = hashPassword(password);
      if (user.password_hash !== currentSaltHash) {
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [currentSaltHash, user.id]);
      }

      // Update online timestamp
      await query('UPDATE users SET last_online_at = NOW() WHERE id = $1', [user.id]);

      // Fetch user's circles
      const circles = await query<{
        id: string;
        name: string;
        invite_code: string;
        role: string;
        member_count: number;
        created_at: string;
      }>(
        `
        SELECT 
          c.id,
          c.name,
          c.invite_code,
          cm.role,
          (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id)::int AS member_count,
          c.created_at
        FROM circles c
        JOIN circle_members cm ON cm.circle_id = c.id
        WHERE cm.user_id = $1
        ORDER BY c.created_at ASC
        `,
        [user.id]
      );

      return reply.send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          avatar_url: user.avatar_url,
        },
        circles,
        activeCircle: circles[0] || null,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to sign in' });
    }
  });

  // 3. Google / Quick Authentication (without auto-creating dummy circles)
  fastify.post('/api/auth/google', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
      avatarUrl: z.string().optional(),
      googleId: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { email, fullName, avatarUrl, googleId } = parsed.data;

    try {
      const userRows = await query<{
        id: string;
        email: string;
        full_name: string;
        avatar_url: string | null;
        created_at: string;
      }>(
        `
        INSERT INTO users (email, full_name, avatar_url, google_id, last_online_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (email) DO UPDATE 
        SET full_name = EXCLUDED.full_name,
            avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
            google_id = COALESCE(EXCLUDED.google_id, users.google_id),
            last_online_at = NOW()
        RETURNING id, email, full_name, avatar_url, created_at
        `,
        [email.trim().toLowerCase(), fullName, avatarUrl || null, googleId || null]
      );

      const user = userRows[0];

      const circles = await query<{
        id: string;
        name: string;
        invite_code: string;
        role: string;
        member_count: number;
        created_at: string;
      }>(
        `
        SELECT 
          c.id,
          c.name,
          c.invite_code,
          cm.role,
          (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id)::int AS member_count,
          c.created_at
        FROM circles c
        JOIN circle_members cm ON cm.circle_id = c.id
        WHERE cm.user_id = $1
        ORDER BY c.created_at ASC
        `,
        [user.id]
      );

      return reply.send({
        success: true,
        user,
        circles,
        activeCircle: circles[0] || null,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to authenticate user' });
    }
  });

  // 4. Get all circles for a user
  fastify.get('/api/users/:userId/circles', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      const circles = await query<{
        id: string;
        name: string;
        invite_code: string;
        role: string;
        member_count: number;
        created_at: string;
      }>(
        `
        SELECT 
          c.id,
          c.name,
          c.invite_code,
          cm.role,
          (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id)::int AS member_count,
          c.created_at
        FROM circles c
        JOIN circle_members cm ON cm.circle_id = c.id
        WHERE cm.user_id = $1
        ORDER BY c.created_at ASC
        `,
        [userId]
      );

      return reply.send({ success: true, circles });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch user circles' });
    }
  });

  // 5. Create a new circle / family group
  fastify.post('/api/circles', async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(100),
      userId: z.string().uuid(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { name, userId } = parsed.data;

    try {
      let inviteCode = generateInviteCode();
      // Ensure uniqueness
      for (let attempt = 0; attempt < 5; attempt++) {
        const check = await query('SELECT id FROM circles WHERE invite_code = $1', [inviteCode]);
        if (check.length === 0) break;
        inviteCode = generateInviteCode();
      }

      const circleRows = await query<{
        id: string;
        name: string;
        invite_code: string;
        created_at: string;
      }>(
        `
        INSERT INTO circles (name, invite_code, created_by)
        VALUES ($1, $2, $3)
        RETURNING id, name, invite_code, created_at
        `,
        [name.trim(), inviteCode, userId]
      );

      const circle = circleRows[0];

      // Add creator as owner
      await query(
        `
        INSERT INTO circle_members (circle_id, user_id, role)
        VALUES ($1, $2, 'owner')
        `,
        [circle.id, userId]
      );

      return reply.status(201).send({
        success: true,
        circle: {
          ...circle,
          role: 'owner',
          member_count: 1,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to create circle' });
    }
  });

  // 6. Join an existing circle via invite code
  fastify.post('/api/circles/join', async (request, reply) => {
    const schema = z.object({
      inviteCode: z.string().min(3).max(20),
      userId: z.string().uuid(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { inviteCode, userId } = parsed.data;
    const cleanCode = inviteCode.trim().toUpperCase();

    try {
      // Find circle by invite code
      const circleRows = await query<{
        id: string;
        name: string;
        invite_code: string;
        created_at: string;
      }>(
        `
        SELECT id, name, invite_code, created_at 
        FROM circles 
        WHERE UPPER(TRIM(invite_code)) = $1
        LIMIT 1
        `,
        [cleanCode]
      );

      if (circleRows.length === 0) {
        return reply.status(404).send({ error: 'Invalid invite code. Circle not found.' });
      }

      const circle = circleRows[0];

      // Check if user is already a member
      const existingMember = await query(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circle.id, userId]
      );

      if (existingMember.length > 0) {
        // Already a member
        const countRes = await query<{ count: string }>(
          'SELECT COUNT(*) as count FROM circle_members WHERE circle_id = $1',
          [circle.id]
        );
        return reply.send({
          success: true,
          circle: {
            ...circle,
            role: existingMember[0].role,
            member_count: parseInt(countRes[0]?.count || '1', 10),
          },
          alreadyMember: true,
        });
      }

      // Add to circle_members as member
      await query(
        `
        INSERT INTO circle_members (circle_id, user_id, role)
        VALUES ($1, $2, 'member')
        `,
        [circle.id, userId]
      );

      // If joining user has no GPS fix yet, set initial location clustered near the circle
      await query(
        `
        UPDATE users u
        SET 
          last_latitude = ref.last_latitude + (random() * 0.006 - 0.003),
          last_longitude = ref.last_longitude + (random() * 0.006 - 0.003),
          last_location_time = NOW(),
          last_online_at = NOW(),
          battery_level = COALESCE(u.battery_level, 85),
          is_stationary = true
        FROM (
          SELECT u2.last_latitude, u2.last_longitude
          FROM circle_members cm2
          JOIN users u2 ON cm2.user_id = u2.id
          WHERE cm2.circle_id = $1 AND u2.last_latitude IS NOT NULL
          LIMIT 1
        ) ref
        WHERE u.id = $2 AND u.last_latitude IS NULL
        `,
        [circle.id, userId]
      );

      // Count members
      const countRes = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM circle_members WHERE circle_id = $1',
        [circle.id]
      );

      return reply.send({
        success: true,
        circle: {
          ...circle,
          role: 'member',
          member_count: parseInt(countRes[0]?.count || '1', 10),
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to join circle' });
    }
  });

  // 7. Update circle (Rename circle) - Owner or Admin only
  fastify.put('/api/circles/:circleId', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      name: z.string().min(1).max(100),
      userId: z.string().uuid(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid circle name' });
    }

    const { name, userId } = parsed.data;

    try {
      // Verify user permissions
      const memberRows = await query<{ role: string }>(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circleId, userId]
      );

      if (memberRows.length === 0 || (memberRows[0].role !== 'owner' && memberRows[0].role !== 'admin')) {
        return reply.status(403).send({ error: 'Only circle owners or admins can rename the circle' });
      }

      const updated = await query<{
        id: string;
        name: string;
        invite_code: string;
        created_at: string;
      }>(
        `
        UPDATE circles
        SET name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, invite_code, created_at
        `,
        [name.trim(), circleId]
      );

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Circle not found' });
      }

      return reply.send({ success: true, circle: updated[0] });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update circle' });
    }
  });

  // 8. Leave circle
  fastify.post('/api/circles/:circleId/leave', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      userId: z.string().uuid(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid user ID' });
    }

    const { userId } = parsed.data;

    try {
      await query(
        'DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circleId, userId]
      );

      // Check if any members remain; if 0, delete the circle
      const remaining = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM circle_members WHERE circle_id = $1',
        [circleId]
      );

      if (parseInt(remaining[0]?.count || '0', 10) === 0) {
        await query('DELETE FROM circles WHERE id = $1', [circleId]);
      }

      return reply.send({ success: true, message: 'Successfully left circle' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to leave circle' });
    }
  });

  // 9. Delete circle - Owner only
  fastify.delete('/api/circles/:circleId', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const { userId } = request.query as { userId?: string };

    if (!userId) {
      return reply.status(400).send({ error: 'Missing userId parameter' });
    }

    try {
      // Check if owner
      const memberRows = await query<{ role: string }>(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circleId, userId]
      );

      if (memberRows.length === 0 || memberRows[0].role !== 'owner') {
        return reply.status(403).send({ error: 'Only the circle owner can delete this family group' });
      }

      await query('DELETE FROM circles WHERE id = $1', [circleId]);

      return reply.send({ success: true, message: 'Circle deleted successfully' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete circle' });
    }
  });

  // 10. Update user profile (Name, Phone & Avatar URL)
  fastify.put('/api/users/:userId/profile', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const schema = z.object({
      fullName: z.string().min(1).optional(),
      avatarUrl: z.string().min(1).optional(),
      phone: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { fullName, avatarUrl, phone } = parsed.data;

    try {
      const rows = await query<{
        id: string;
        full_name: string;
        avatar_url: string | null;
        phone: string | null;
        email: string;
      }>(
        `
        UPDATE users
        SET full_name = COALESCE($1, full_name),
            avatar_url = COALESCE($2, avatar_url),
            phone = COALESCE($3, phone),
            updated_at = NOW()
        WHERE id = $4
        RETURNING id, full_name, avatar_url, phone, email
        `,
        [fullName || null, avatarUrl || null, phone || null, userId]
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ success: true, user: rows[0] });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update user profile' });
    }
  });

  // 11. Get all members of a circle with their latest location & status
  fastify.get('/api/circles/:circleId/members', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };

    try {
      const sql = `
        SELECT 
          u.id,
          u.full_name,
          u.avatar_url,
          u.phone,
          u.battery_level,
          u.is_charging,
          u.last_online_at,
          cm.role,
          COALESCE(u.last_speed, 0.0)::float AS speed,
          COALESCE(u.last_heading, 0.0)::float AS heading,
          u.last_address AS resolved_address,
          u.last_longitude::float AS longitude,
          u.last_latitude::float AS latitude,
          u.last_location_time,
          u.stationary_since,
          COALESCE(u.is_stationary, true) AS is_stationary
        FROM circle_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.circle_id = $1
        ORDER BY cm.joined_at ASC
      `;

      const members = await query(sql, [circleId]);
      return reply.send({ success: true, circleId, members });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch circle members' });
    }
  });

  // 12. Get places (geofences) configured for this circle
  fastify.get('/api/circles/:circleId/places', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };

    try {
      const sql = `
        SELECT 
          id,
          name,
          category,
          radius_meters,
          notify_on_enter,
          notify_on_exit,
          ST_X(location) AS longitude,
          ST_Y(location) AS latitude,
          created_at
        FROM places
        WHERE circle_id = $1
      `;

      const places = await query(sql, [circleId]);
      return reply.send({ success: true, places });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch geofence places' });
    }
  });

  // 13. Create a new geofenced place
  fastify.post('/api/circles/:circleId/places', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };

    const schema = z.object({
      name: z.string().min(1),
      category: z.enum(['home', 'school', 'work', 'gym', 'other']).default('other'),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusMeters: z.number().min(20).max(5000).default(200),
      notifyOnEnter: z.boolean().default(true),
      notifyOnExit: z.boolean().default(true),
      createdBy: z.string().uuid().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { name, category, latitude, longitude, radiusMeters, notifyOnEnter, notifyOnExit, createdBy } = parsed.data;

    try {
      const sql = `
        INSERT INTO places (
          circle_id, name, category, location, radius_meters, 
          notify_on_enter, notify_on_exit, created_by
        )
        VALUES (
          $1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, 
          $7, $8, $9
        )
        RETURNING id, name, category, radius_meters, notify_on_enter, notify_on_exit,
                  ST_X(location) as longitude, ST_Y(location) as latitude
      `;

      const rows = await query(sql, [
        circleId,
        name,
        category,
        longitude,
        latitude,
        radiusMeters,
        notifyOnEnter,
        notifyOnExit,
        createdBy || null,
      ]);

      return reply.status(201).send({ success: true, place: rows[0] });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to create place geofence' });
    }
  });

  // 14. Telemetry Ingestion via HTTP REST (instant sync for mobile GPS fixes & circle updates)
  fastify.post('/api/telemetry', async (request, reply) => {
    const schema = z.object({
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

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    try {
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
      return reply.send({ success: true, message: 'Telemetry synchronized and persisted' });
    } catch (err) {
      request.log.error(err, '[REST Telemetry] Error processing ping');
      return reply.status(500).send({ error: 'Failed to process telemetry' });
    }
  });

  // 15. Get circle chat messages (last 50 messages)
  fastify.get('/api/circles/:circleId/messages', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const circleUuid = normalizeToUuid(circleId);

    try {
      const rows = await query<{
        id: string;
        circle_id: string;
        user_id: string;
        full_name: string;
        avatar_url: string | null;
        content: string;
        message_type: 'text' | 'preset' | 'location';
        created_at: string;
      }>(
        `
        SELECT 
          m.id,
          m.circle_id,
          m.user_id,
          u.full_name,
          u.avatar_url,
          m.content,
          m.message_type,
          m.created_at
        FROM circle_messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.circle_id = $1
        ORDER BY m.created_at ASC
        LIMIT 50
        `,
        [circleUuid]
      );

      const messages = rows.map((r) => ({
        id: r.id,
        circleId: r.circle_id,
        userId: r.user_id,
        userName: r.full_name,
        avatarUrl: r.avatar_url,
        content: r.content,
        messageType: r.message_type,
        createdAt: r.created_at,
      }));

      return reply.send({ success: true, circleId, messages });
    } catch (err) {
      request.log.error(err, '[Chat] Error fetching messages');
      return reply.status(500).send({ error: 'Failed to fetch messages' });
    }
  });

  // 16. Send circle chat message via REST
  fastify.post('/api/circles/:circleId/messages', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      userId: z.string().min(1),
      content: z.string().min(1),
      messageType: z.enum(['text', 'preset', 'location']).default('text'),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { userId, content, messageType } = parsed.data;
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      const userRes = await query<{ full_name: string; avatar_url: string | null }>(
        'SELECT full_name, avatar_url FROM users WHERE id = $1',
        [userUuid]
      );
      const senderName = userRes[0]?.full_name || 'Family Member';
      const avatarUrl = userRes[0]?.avatar_url || null;

      const inserted = await query<{ id: string; created_at: string }>(
        `
        INSERT INTO circle_messages (circle_id, user_id, content, message_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
        `,
        [circleUuid, userUuid, content, messageType]
      );

      const msg = inserted[0];
      const messagePayload = {
        id: msg.id,
        circleId,
        userId,
        userName: senderName,
        avatarUrl,
        content,
        messageType,
        createdAt: msg.created_at,
      };

      // Broadcast to WebSocket room
      roomManager.broadcastChatMessage(circleId, messagePayload);

      return reply.status(201).send({ success: true, message: messagePayload });
    } catch (err) {
      request.log.error(err, '[Chat] Error sending message');
      return reply.status(500).send({ error: 'Failed to send message' });
    }
  });

  // 17. Get Direct (P2P) Messages between two circle members
  fastify.get('/api/circles/:circleId/direct-messages', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const { userId, peerId } = request.query as { userId?: string; peerId?: string };

    if (!userId || !peerId) {
      return reply.status(400).send({ error: 'userId and peerId are required' });
    }

    const circleUuid = normalizeToUuid(circleId);
    const userUuid = normalizeToUuid(userId);
    const peerUuid = normalizeToUuid(peerId);

    try {
      const messages = await query<{
        id: string;
        circle_id: string;
        sender_id: string;
        sender_name: string;
        sender_avatar: string | null;
        recipient_id: string;
        content: string;
        message_type: 'text' | 'preset' | 'location';
        created_at: string;
      }>(
        `
        SELECT 
          dm.id,
          dm.circle_id,
          dm.sender_id,
          u.full_name AS sender_name,
          u.avatar_url AS sender_avatar,
          dm.recipient_id,
          dm.content,
          dm.message_type,
          dm.created_at
        FROM direct_messages dm
        JOIN users u ON u.id = dm.sender_id
        WHERE dm.circle_id = $1
          AND (
            (dm.sender_id = $2 AND dm.recipient_id = $3) OR
            (dm.sender_id = $3 AND dm.recipient_id = $2)
          )
        ORDER BY dm.created_at ASC
        LIMIT 100
        `,
        [circleUuid, userUuid, peerUuid]
      );

      return reply.send({
        success: true,
        circleId,
        messages: messages.map((m) => ({
          id: m.id,
          circleId: m.circle_id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          senderAvatar: m.sender_avatar,
          recipientId: m.recipient_id,
          content: m.content,
          messageType: m.message_type,
          createdAt: m.created_at,
        })),
      });
    } catch (err) {
      request.log.error(err, '[DirectChat] Error fetching direct messages');
      return reply.status(500).send({ error: 'Failed to fetch direct messages' });
    }
  });

  // 18. Send Direct (P2P) Message via REST
  fastify.post('/api/circles/:circleId/direct-messages', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      senderId: z.string().min(1),
      recipientId: z.string().min(1),
      content: z.string().min(1),
      messageType: z.enum(['text', 'preset', 'location']).default('text'),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { senderId, recipientId, content, messageType } = parsed.data;
    const circleUuid = normalizeToUuid(circleId);
    const senderUuid = normalizeToUuid(senderId);
    const recipientUuid = normalizeToUuid(recipientId);

    try {
      const userRes = await query<{ full_name: string; avatar_url: string | null }>(
        'SELECT full_name, avatar_url FROM users WHERE id = $1',
        [senderUuid]
      );
      const senderName = userRes[0]?.full_name || 'Family Member';
      const senderAvatar = userRes[0]?.avatar_url || null;

      const inserted = await query<{ id: string; created_at: string }>(
        `
        INSERT INTO direct_messages (circle_id, sender_id, recipient_id, content, message_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
        `,
        [circleUuid, senderUuid, recipientUuid, content, messageType]
      );

      const msg = inserted[0];
      const messagePayload = {
        id: msg.id,
        circleId,
        senderId,
        senderName,
        senderAvatar,
        recipientId,
        content,
        messageType,
        createdAt: msg.created_at,
      };

      // Send to recipient and sender via WebSocket
      roomManager.sendDirectMessage(circleId, senderId, recipientId, messagePayload);

      return reply.status(201).send({ success: true, message: messagePayload });
    } catch (err) {
      request.log.error(err, '[DirectChat] Error sending direct message');
      return reply.status(500).send({ error: 'Failed to send direct message' });
    }
  });

  // 17. Daily Member Timeline (CareRing places stayed & trips)
  fastify.get('/api/circles/:circleId/members/:userId/timeline', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { date } = request.query as { date?: string };
    const userUuid = normalizeToUuid(userId);

    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split('T')[0];

    try {
      const userRes = await query<{
        full_name: string;
        avatar_url: string | null;
        last_latitude: number | null;
        last_longitude: number | null;
        last_address: string | null;
        battery_level: number | null;
        last_location_time: string | null;
        stationary_since: string | null;
      }>(
        `SELECT full_name, avatar_url, last_latitude, last_longitude, last_address, battery_level, last_location_time, stationary_since FROM users WHERE id = $1`,
        [userUuid]
      );

      const user = userRes[0];

      const historyRows = await query<{
        id: string;
        latitude: number;
        longitude: number;
        speed: number;
        heading: number;
        battery_level: number | null;
        resolved_address: string | null;
        stationary_duration_sec: number;
        recorded_at: string;
      }>(
        `
        SELECT 
          id,
          ST_Y(location)::float AS latitude,
          ST_X(location)::float AS longitude,
          speed::float,
          heading::float,
          battery_level,
          resolved_address,
          stationary_duration_sec,
          recorded_at
        FROM location_history
        WHERE user_id = $1 
          AND DATE(recorded_at AT TIME ZONE 'UTC') = $2::date
        ORDER BY recorded_at ASC
        `,
        [userUuid, targetDate]
      );

      const timeline: Array<{
        id: string;
        type: 'stay' | 'trip';
        title: string;
        address: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
        latitude: number;
        longitude: number;
        speed?: number;
        batteryLevel?: number | null;
      }> = [];

      if (historyRows.length > 0) {
        let currentStay: typeof historyRows[0] | null = null;
        let stayStartTime: string = '';
        let stayDuration = 0;

        for (let i = 0; i < historyRows.length; i++) {
          const row = historyRows[i];
          const isStop = (row.speed || 0) < 3.0;

          if (isStop) {
            if (!currentStay) {
              currentStay = row;
              stayStartTime = row.recorded_at;
              stayDuration = Math.max(1, Math.round((row.stationary_duration_sec || 0) / 60));
            } else {
              stayDuration += Math.max(1, Math.round((new Date(row.recorded_at).getTime() - new Date(stayStartTime).getTime()) / 60000));
            }
          } else {
            if (currentStay) {
              timeline.push({
                id: `stay_${currentStay.id}`,
                type: 'stay',
                title: currentStay.resolved_address ? 'Stationary Stay' : 'Stopped Here',
                address: currentStay.resolved_address || `${currentStay.latitude.toFixed(4)}, ${currentStay.longitude.toFixed(4)}`,
                startTime: stayStartTime,
                endTime: row.recorded_at,
                durationMinutes: Math.max(1, stayDuration),
                latitude: currentStay.latitude,
                longitude: currentStay.longitude,
                batteryLevel: currentStay.battery_level,
              });
              currentStay = null;
            }

            timeline.push({
              id: `trip_${row.id}`,
              type: 'trip',
              title: `Trip • ${Math.round(row.speed)} km/h`,
              address: row.resolved_address || 'In transit',
              startTime: row.recorded_at,
              endTime: row.recorded_at,
              durationMinutes: 5,
              latitude: row.latitude,
              longitude: row.longitude,
              speed: row.speed,
              batteryLevel: row.battery_level,
            });
          }
        }

        if (currentStay) {
          timeline.push({
            id: `stay_${currentStay.id}`,
            type: 'stay',
            title: currentStay.resolved_address ? 'Stationary Stay' : 'Stopped Here',
            address: currentStay.resolved_address || `${currentStay.latitude.toFixed(4)}, ${currentStay.longitude.toFixed(4)}`,
            startTime: stayStartTime,
            endTime: historyRows[historyRows.length - 1].recorded_at,
            durationMinutes: Math.max(1, stayDuration),
            latitude: currentStay.latitude,
            longitude: currentStay.longitude,
            batteryLevel: currentStay.battery_level,
          });
        }
      } else if (user && user.last_latitude && user.last_longitude) {
        const stayStart = user.stationary_since || user.last_location_time || new Date().toISOString();
        const durationMins = Math.max(1, Math.round((Date.now() - new Date(stayStart).getTime()) / 60000));
        timeline.push({
          id: `current_stay_${userId}`,
          type: 'stay',
          title: 'Current Location',
          address: user.last_address || `${user.last_latitude.toFixed(4)}, ${user.last_longitude.toFixed(4)}`,
          startTime: stayStart,
          endTime: new Date().toISOString(),
          durationMinutes: durationMins,
          latitude: user.last_latitude,
          longitude: user.last_longitude,
          batteryLevel: user.battery_level,
        });
      }

      return reply.send({
        success: true,
        userId,
        userName: user?.full_name || 'Member',
        avatarUrl: user?.avatar_url || null,
        date: targetDate,
        timeline,
      });
    } catch (err) {
      request.log.error(err, '[Timeline] Error generating member timeline');
      return reply.status(500).send({ error: 'Failed to generate member timeline' });
    }
  });
}
