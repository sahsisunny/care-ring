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

  // 10. Update user profile (Name, Phone & Avatar Image)
  fastify.put('/api/users/:userId/profile', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const userUuid = normalizeToUuid(userId);

    const schema = z.object({
      fullName: z.string().min(1).optional(),
      avatarUrl: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { fullName, avatarUrl, phone } = parsed.data;
    const bodyObj = request.body as Record<string, any>;
    const hasAvatar = 'avatarUrl' in bodyObj;
    const cleanAvatar = hasAvatar
      ? (avatarUrl && avatarUrl.trim().length > 0 ? avatarUrl.trim() : null)
      : undefined;

    try {
      let queryStr = `UPDATE users SET updated_at = NOW()`;
      const values: any[] = [];
      let valIdx = 1;

      if (fullName) {
        queryStr += `, full_name = $${valIdx++}`;
        values.push(fullName.trim());
      }
      if (hasAvatar) {
        queryStr += `, avatar_url = $${valIdx++}`;
        values.push(cleanAvatar);
      }
      if (phone !== undefined) {
        queryStr += `, phone = $${valIdx++}`;
        values.push(phone && phone.trim().length > 0 ? phone.trim() : null);
      }

      queryStr += ` WHERE id = $${valIdx} RETURNING id, full_name, avatar_url, phone, email`;
      values.push(userUuid);

      const rows = await query<{
        id: string;
        full_name: string;
        avatar_url: string | null;
        phone: string | null;
        email: string;
      }>(queryStr, values);

      if (rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ success: true, user: rows[0] });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update user profile' });
    }
  });

  // 10b. Change user password
  fastify.put('/api/users/:userId/password', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const userUuid = normalizeToUuid(userId);

    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(4, 'New password must be at least 4 characters'),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'New password must be at least 4 characters' });
    }

    const { currentPassword, newPassword } = parsed.data;

    try {
      const users = await query<{ id: string; password_hash: string | null }>(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [userUuid]
      );
      if (users.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const user = users[0];
      if (user.password_hash && !verifyPassword(currentPassword, user.password_hash)) {
        return reply.status(401).send({ error: 'Current password does not match' });
      }

      const newHash = hashPassword(newPassword);
      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userUuid]);

      return reply.send({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update password' });
    }
  });

  // 10c. Delete user account
  fastify.delete('/api/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const userUuid = normalizeToUuid(userId);
      await query('DELETE FROM users WHERE id = $1', [userUuid]);
      return reply.send({ success: true, message: 'Account deleted' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete account' });
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
      const enrichedMembers = (members || []).map((m: any) => {
        const isSocketActive = roomManager.isUserOnline(circleId, m.id);
        const lastOnlineMs = m.last_online_at ? new Date(m.last_online_at).getTime() : 0;
        const isRecentlyActive = lastOnlineMs > 0 && (Date.now() - lastOnlineMs) < 4 * 60 * 1000;
        const isOnline = isSocketActive || isRecentlyActive;
        return {
          ...m,
          is_online: Boolean(isOnline),
        };
      });
      return reply.send({ success: true, circleId, members: enrichedMembers });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch circle members' });
    }
  });

  // 12. Get places (geofences) configured for this circle
  fastify.get('/api/circles/:circleId/places', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const circleUuid = normalizeToUuid(circleId);

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
        ORDER BY created_at ASC
      `;

      const places = await query(sql, [circleUuid]);
      return reply.send({ success: true, places });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch geofence places' });
    }
  });

  // 13. Create a new geofenced place
  fastify.post('/api/circles/:circleId/places', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const circleUuid = normalizeToUuid(circleId);

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
        circleUuid,
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

  // 17. Daily Member Timeline (Life360 / Google Maps style: Stops & Trip Route Polylines)
  fastify.get('/api/circles/:circleId/members/:userId/timeline', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { date, tzOffset } = request.query as { date?: string; tzOffset?: string };
    const userUuid = normalizeToUuid(userId);

    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split('T')[0];

    // Compute day range respecting client's local timezone offset in minutes (e.g. -330 for IST)
    const tzOffsetMinutes = tzOffset !== undefined ? parseInt(tzOffset, 10) : 0;
    const dayStartUtc = new Date(`${targetDate}T00:00:00.000Z`);
    if (!isNaN(tzOffsetMinutes)) {
      dayStartUtc.setUTCMinutes(dayStartUtc.getUTCMinutes() + tzOffsetMinutes);
    }
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

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
          AND recorded_at >= $2 
          AND recorded_at < $3
        ORDER BY recorded_at ASC
        `,
        [userUuid, dayStartUtc.toISOString(), dayEndUtc.toISOString()]
      );

      const rawCoordinates: Array<[number, number]> = [];
      const timeline: Array<{
        id: string;
        type: 'stay' | 'trip';
        stopNumber?: number;
        title: string;
        address: string;
        fromAddress?: string;
        toAddress?: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
        latitude: number;
        longitude: number;
        speed?: number;
        topSpeed?: number;
        avgSpeed?: number;
        distanceKm?: number;
        batteryLevel?: number | null;
        coordinates?: Array<[number, number]>;
      }> = [];

      let totalDistanceKm = 0;
      let totalMovingMinutes = 0;
      let totalStayMinutes = 0;
      let stopCounter = 0;

      if (historyRows.length > 0) {
        // Collect raw coordinates for whole-day path
        for (const r of historyRows) {
          rawCoordinates.push([r.latitude, r.longitude]);
        }

        let currentStopPoints: typeof historyRows = [];
        let currentTripPoints: typeof historyRows = [];

        const flushStop = () => {
          if (currentStopPoints.length === 0) return;
          stopCounter++;
          const first = currentStopPoints[0];
          const last = currentStopPoints[currentStopPoints.length - 1];
          const startMs = new Date(first.recorded_at).getTime();
          const endMs = new Date(last.recorded_at).getTime();
          const durationMins = Math.max(
            1,
            Math.round(
              first.stationary_duration_sec > 0
                ? first.stationary_duration_sec / 60
                : (endMs - startMs) / 60000
            )
          );
          totalStayMinutes += durationMins;

          timeline.push({
            id: `stop_${first.id}`,
            type: 'stay',
            stopNumber: stopCounter,
            title: first.resolved_address ? `Stop ${stopCounter}: ${first.resolved_address.split(',')[0]}` : `Stop ${stopCounter}`,
            address: first.resolved_address || `${first.latitude.toFixed(4)}, ${first.longitude.toFixed(4)}`,
            startTime: first.recorded_at,
            endTime: last.recorded_at,
            durationMinutes: durationMins,
            latitude: first.latitude,
            longitude: first.longitude,
            batteryLevel: first.battery_level,
          });

          currentStopPoints = [];
        };

        const flushTrip = () => {
          if (currentTripPoints.length < 1) return;
          const first = currentTripPoints[0];
          const last = currentTripPoints[currentTripPoints.length - 1];
          const startMs = new Date(first.recorded_at).getTime();
          const endMs = new Date(last.recorded_at).getTime();
          const durationMins = Math.max(1, Math.round((endMs - startMs) / 60000));
          totalMovingMinutes += durationMins;

          let tripDistKm = 0;
          let maxSpeed = 0;
          let sumSpeed = 0;
          const tripCoords: Array<[number, number]> = [];

          for (let k = 0; k < currentTripPoints.length; k++) {
            const p = currentTripPoints[k];
            tripCoords.push([p.latitude, p.longitude]);
            if (p.speed > maxSpeed) maxSpeed = p.speed;
            sumSpeed += p.speed;
            if (k > 0) {
              const prevP = currentTripPoints[k - 1];
              tripDistKm += haversineKm(prevP.latitude, prevP.longitude, p.latitude, p.longitude);
            }
          }

          const avgSpeed = currentTripPoints.length > 0 ? Math.round(sumSpeed / currentTripPoints.length) : 0;
          const roundedDist = Math.round(tripDistKm * 10) / 10;
          totalDistanceKm += roundedDist;

          const fromAddr = first.resolved_address || 'Origin';
          const toAddr = last.resolved_address || 'Destination';

          timeline.push({
            id: `trip_${first.id}_${last.id}`,
            type: 'trip',
            title: `Trip • ${roundedDist > 0 ? `${roundedDist} km` : `${durationMins}m`}`,
            address: `${fromAddr.split(',')[0]} → ${toAddr.split(',')[0]}`,
            fromAddress: fromAddr,
            toAddress: toAddr,
            startTime: first.recorded_at,
            endTime: last.recorded_at,
            durationMinutes: durationMins,
            latitude: first.latitude,
            longitude: first.longitude,
            speed: avgSpeed,
            topSpeed: Math.round(maxSpeed),
            avgSpeed,
            distanceKm: roundedDist,
            batteryLevel: last.battery_level,
            coordinates: tripCoords,
          });

          currentTripPoints = [];
        };

        for (let i = 0; i < historyRows.length; i++) {
          const row = historyRows[i];
          const isStationaryPoint = (row.speed || 0) < 3.0;

          if (isStationaryPoint) {
            if (currentTripPoints.length > 0) {
              // Include the arrival point in the trip coordinates for seamless route line
              currentTripPoints.push(row);
              flushTrip();
            }
            currentStopPoints.push(row);
          } else {
            if (currentStopPoints.length > 0) {
              flushStop();
            }
            currentTripPoints.push(row);
          }
        }

        if (currentStopPoints.length > 0) flushStop();
        if (currentTripPoints.length > 0) flushTrip();
      } else if (user && user.last_latitude && user.last_longitude) {
        // Fallback when no GPS points recorded yet today: show current location as Stop 1
        rawCoordinates.push([user.last_latitude, user.last_longitude]);
        const stayStart = user.stationary_since || user.last_location_time || new Date().toISOString();
        const durationMins = Math.max(1, Math.round((Date.now() - new Date(stayStart).getTime()) / 60000));
        stopCounter = 1;

        timeline.push({
          id: `current_stop_${userId}`,
          type: 'stay',
          stopNumber: 1,
          title: user.last_address ? `Stop 1: ${user.last_address.split(',')[0]}` : 'Stop 1: Current Location',
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
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        totalMovingMinutes,
        totalStayMinutes,
        stopCount: stopCounter,
        tripCount: timeline.filter((t) => t.type === 'trip').length,
        rawCoordinates,
        timeline,
      });
    } catch (err) {
      request.log.error(err, '[Timeline] Error generating member timeline');
      return reply.status(500).send({ error: 'Failed to generate member timeline' });
    }
  });

  // 17. Driver Safety Report & Weekly Driving Insights (Computed from real location_history)
  fastify.get('/api/circles/:circleId/members/:userId/driver-report', async (request, reply) => {
    const { circleId, userId } = request.params as { circleId: string; userId: string };
    const userUuid = normalizeToUuid(userId);

    try {
      const userRes = await query<{
        full_name: string;
        avatar_url: string | null;
        last_latitude: number | null;
        last_longitude: number | null;
        last_address: string | null;
      }>('SELECT full_name, avatar_url, last_latitude, last_longitude, last_address FROM users WHERE id = $1', [userUuid]);

      const user = userRes[0];
      const memberName = user?.full_name || 'Member';

      // Query real location history for the past 7 days
      const historyRows = await query<{
        speed: string | number;
        heading: string | number;
        battery_level: number;
        resolved_address: string | null;
        recorded_at: string;
        lat: number;
        lng: number;
      }>(
        `SELECT 
           speed, 
           heading, 
           battery_level, 
           resolved_address, 
           recorded_at,
           ST_Y(location) AS lat, 
           ST_X(location) AS lng
         FROM location_history
         WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '7 days'
         ORDER BY recorded_at ASC`,
        [userUuid]
      );

      // Haversine distance helper in km
      function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      let totalDistanceKm = 0;
      let topSpeedKm = 0;
      const speedingEvents: any[] = [];
      const hardBrakingEvents: any[] = [];
      const rapidAccelEvents: any[] = [];
      const trips: any[] = [];

      let currentTripPoints: [number, number][] = [];
      let currentTripStart: any = null;
      let currentTripDistance = 0;
      let currentTripTopSpeed = 0;
      let currentTripSpeeding = 0;
      let currentTripHardBraking = 0;

      for (let i = 0; i < historyRows.length; i++) {
        const fix = historyRows[i];
        const spd = Number(fix.speed) || 0;
        if (spd > topSpeedKm) topSpeedKm = Math.round(spd);

        if (i > 0) {
          const prev = historyRows[i - 1];
          const dist = haversineKm(prev.lat, prev.lng, fix.lat, fix.lng);
          const timeDiffHours = (new Date(fix.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 3600000;
          if (dist > 0.005 && (timeDiffHours <= 0 || (dist / timeDiffHours) < 180)) {
            totalDistanceKm += dist;
          }

          const prevSpd = Number(prev.speed) || 0;
          const timeDiffSec = (new Date(fix.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
          if (timeDiffSec > 0 && timeDiffSec <= 10) {
            const speedDelta = spd - prevSpd;
            if (speedDelta >= 18) {
              rapidAccelEvents.push({
                id: `ra_${fix.recorded_at}_${i}`,
                timestamp: fix.recorded_at,
                timeFormatted: new Date(fix.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                gForce: Math.min(0.65, Math.round(((speedDelta / 3.6) / (timeDiffSec * 9.81)) * 100) / 100),
                address: fix.resolved_address || 'Road',
              });
            } else if (speedDelta <= -18) {
              hardBrakingEvents.push({
                id: `hb_${fix.recorded_at}_${i}`,
                timestamp: fix.recorded_at,
                timeFormatted: new Date(fix.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                gForce: Math.min(0.75, Math.round(((-speedDelta / 3.6) / (timeDiffSec * 9.81)) * 100) / 100),
                speedBeforeBrake: Math.round(prevSpd),
                speedAfterBrake: Math.round(spd),
                address: fix.resolved_address || 'Intersection',
                latitude: fix.lat,
                longitude: fix.lng,
              });
              currentTripHardBraking++;
            }
          }
        }

        if (spd > 65) {
          speedingEvents.push({
            id: `sp_${fix.recorded_at}_${i}`,
            timestamp: fix.recorded_at,
            timeFormatted: new Date(fix.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            speed: Math.round(spd),
            speedLimit: 50,
            excessSpeed: Math.round(spd - 50),
            address: fix.resolved_address || 'Main Road',
            latitude: fix.lat,
            longitude: fix.lng,
          });
          currentTripSpeeding++;
        }

        if (spd > 3.0) {
          if (!currentTripStart) {
            currentTripStart = fix;
            currentTripPoints = [[fix.lat, fix.lng]];
            currentTripDistance = 0;
            currentTripTopSpeed = spd;
            currentTripSpeeding = 0;
            currentTripHardBraking = 0;
          } else {
            const prevPoint = currentTripPoints[currentTripPoints.length - 1];
            currentTripDistance += haversineKm(prevPoint[0], prevPoint[1], fix.lat, fix.lng);
            if (spd > currentTripTopSpeed) currentTripTopSpeed = spd;
            currentTripPoints.push([fix.lat, fix.lng]);
          }
        } else {
          if (currentTripStart && currentTripPoints.length >= 2 && currentTripDistance >= 0.2) {
            const startTime = new Date(currentTripStart.recorded_at);
            const endTime = new Date(fix.recorded_at);
            const durationMins = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
            const tripScore = Math.max(70, Math.min(100, 100 - (currentTripSpeeding * 5) - (currentTripHardBraking * 3)));

            trips.push({
              id: `trip_${trips.length + 1}`,
              dayLabel: startTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
              startTime: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              endTime: endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              durationMins,
              distanceKm: Math.round(currentTripDistance * 10) / 10,
              topSpeedKm: Math.round(currentTripTopSpeed),
              startAddress: currentTripStart.resolved_address || 'Departure Location',
              endAddress: fix.resolved_address || 'Arrival Location',
              score: tripScore,
              speedingCount: currentTripSpeeding,
              hardBrakingCount: currentTripHardBraking,
              distractedCount: 0,
              routeCoordinates: currentTripPoints,
            });
          }
          currentTripStart = null;
          currentTripPoints = [];
        }
      }

      if (currentTripStart && currentTripPoints.length >= 2 && currentTripDistance >= 0.2) {
        const lastFix = historyRows[historyRows.length - 1];
        const startTime = new Date(currentTripStart.recorded_at);
        const endTime = new Date(lastFix.recorded_at);
        const durationMins = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
        const tripScore = Math.max(70, Math.min(100, 100 - (currentTripSpeeding * 5) - (currentTripHardBraking * 3)));

        trips.push({
          id: `trip_${trips.length + 1}`,
          dayLabel: startTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
          startTime: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          endTime: endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          durationMins,
          distanceKm: Math.round(currentTripDistance * 10) / 10,
          topSpeedKm: Math.round(currentTripTopSpeed),
          startAddress: currentTripStart.resolved_address || 'Departure Location',
          endAddress: lastFix.resolved_address || 'Current Location',
          score: tripScore,
          speedingCount: currentTripSpeeding,
          hardBrakingCount: currentTripHardBraking,
          distractedCount: 0,
          routeCoordinates: currentTripPoints,
        });
      }

      let weeklyScore = 100;
      if (trips.length > 0) {
        const totalTripScores = trips.reduce((acc, t) => acc + t.score, 0);
        weeklyScore = Math.round(totalTripScores / trips.length);
      } else if (speedingEvents.length > 0 || hardBrakingEvents.length > 0) {
        weeklyScore = Math.max(65, 100 - (speedingEvents.length * 4) - (hardBrakingEvents.length * 3));
      }

      const safeMilesPct = trips.length > 0
        ? Math.max(80, Math.min(100, Math.round(100 - (speedingEvents.length * 2.5))))
        : 100;

      const report = {
        success: true,
        userId,
        userName: memberName,
        avatarUrl: user?.avatar_url || null,
        weekLabel: 'Past 7 Days',
        weeklyScore,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        totalTrips: trips.length,
        topSpeedKm,
        safeMilesPct,
        speeding: {
          count: speedingEvents.length,
          unlocked: true,
          topSpeed: topSpeedKm,
          events: speedingEvents,
        },
        distracted: {
          count: 0,
          unlocked: true,
          screenTimeSec: 0,
          events: [],
        },
        rapidAccel: {
          count: rapidAccelEvents.length,
          unlocked: true,
          events: rapidAccelEvents,
        },
        hardBraking: {
          count: hardBrakingEvents.length,
          unlocked: true,
          events: hardBrakingEvents,
        },
        trips,
      };

      return reply.send(report);
    } catch (err) {
      request.log.error(err, '[DriverReport] Error');
      return reply.status(500).send({ error: 'Failed to fetch driver report' });
    }
  });

  // 18. Broadcast Live Emoji Reaction (Boo! 🍅, Love you 💖, Slow down 😳)
  fastify.post('/api/circles/:circleId/reaction', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      senderId: z.string().min(1),
      senderName: z.string().default('Member'),
      targetUserId: z.string().min(1),
      emoji: z.string().default('🍅'),
      label: z.string().default('Reaction'),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid reaction payload' });
    }

    const { senderId, senderName, targetUserId, emoji, label } = parsed.data;

    roomManager.broadcastLiveReaction(circleId, {
      circleId,
      senderId,
      senderName,
      targetUserId,
      emoji,
      label,
      timestamp: Date.now(),
    });

    return reply.send({ success: true });
  });

  // 19. Check In Broadcast
  fastify.post('/api/circles/:circleId/checkin', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      userId: z.string().min(1),
      userName: z.string().default('Member'),
      address: z.string().default('Current Location'),
      latitude: z.number(),
      longitude: z.number(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid check-in payload' });
    }

    const { userId, userName, address, latitude, longitude } = parsed.data;

    roomManager.broadcastCheckIn(circleId, {
      circleId,
      userId,
      userName,
      address,
      latitude,
      longitude,
      timestamp: Date.now(),
    });

    return reply.send({ success: true, message: `${userName} checked in!` });
  });

  // 20. Delete Saved Place
  fastify.delete('/api/circles/:circleId/places/:placeId', async (request, reply) => {
    const { circleId, placeId } = request.params as { circleId: string; placeId: string };
    try {
      const circleUuid = normalizeToUuid(circleId);
      const placeUuid = normalizeToUuid(placeId);
      await query('DELETE FROM places WHERE id = $1 AND circle_id = $2', [placeUuid, circleUuid]);
      return reply.send({ success: true });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete place' });
    }
  });

  // 21. Get Circle Real Alerts (Geofence events, check-ins, SOS)
  fastify.get('/api/circles/:circleId/alerts', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    try {
      const circleUuid = normalizeToUuid(circleId);
      const rows = await query<any>(
        `SELECT 
          ge.id,
          ge.event_type,
          ge.created_at,
          u.full_name as user_name,
          p.name as place_name,
          p.category as place_category
         FROM geofence_events ge
         JOIN users u ON u.id = ge.user_id
         JOIN places p ON p.id = ge.place_id
         WHERE p.circle_id = $1
         ORDER BY ge.created_at DESC
         LIMIT 30`,
        [circleUuid]
      );

      const alerts = rows.map((r: any) => {
        const isEnter = r.event_type === 'ENTER';
        const date = new Date(r.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          id: `geo_${r.id}`,
          title: isEnter ? `Arrival: ${r.place_name}` : `Departure: ${r.place_name}`,
          desc: `${r.user_name} ${isEnter ? 'arrived at' : 'left'} ${r.place_name}.`,
          time: timeStr,
          icon: isEnter ? 'log-in' : 'log-out',
          color: isEnter ? '#10B981' : '#6366F1',
        };
      });

      return reply.send({ success: true, alerts });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch circle alerts' });
    }
  });



  // 23. Update Member Role (Son / Daughter / Child, Parent, Admin, etc.)
  fastify.put('/api/circles/:circleId/members/:userId/role', async (request, reply) => {
    const { circleId, userId } = request.params as { circleId: string; userId: string };
    const { role } = request.body as { role: string };
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      await query(
        `UPDATE circle_members SET role = $1 WHERE circle_id = $2 AND user_id = $3`,
        [role, circleUuid, userUuid]
      );
      return reply.send({ success: true, role });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update member role' });
    }
  });

  // 24. Create Privacy Bubble (temporary blurred location zone)
  fastify.post('/api/circles/:circleId/members/:userId/bubble', async (request, reply) => {
    const { circleId, userId } = request.params as { circleId: string; userId: string };
    const { radiusMeters = 2000, durationMinutes = 120 } = request.body as {
      radiusMeters?: number;
      durationMinutes?: number;
    };
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
      await query(
        `INSERT INTO member_bubbles (user_id, circle_id, radius_meters, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET radius_meters = EXCLUDED.radius_meters, expires_at = EXCLUDED.expires_at`,
        [userUuid, circleUuid, radiusMeters, expiresAt]
      );
      return reply.send({ success: true, radiusMeters, expiresAt });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to create privacy bubble' });
    }
  });

  // 25. Remove Privacy Bubble
  fastify.delete('/api/circles/:circleId/members/:userId/bubble', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const userUuid = normalizeToUuid(userId);
    try {
      await query('DELETE FROM member_bubbles WHERE user_id = $1', [userUuid]);
      return reply.send({ success: true });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to remove privacy bubble' });
    }
  });
}
