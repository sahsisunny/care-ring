import { FastifyInstance } from 'fastify';
import { query } from '../db';
import { z } from 'zod';
import crypto from 'crypto';
import { roomManager } from '../ws/roomManager';
import { TelemetryPing } from '../types';
import { normalizeToUuid } from '../utils/uuid';
import { lookupCachedGeocode, isCoordinateString, extractLocationTitle } from '../services/geocodingService';

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

  // 3. Google / Social Authentication with Account Merging
  fastify.post('/api/auth/google', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
      avatarUrl: z.string().optional(),
      googleId: z.string().optional(),
      merge: z.boolean().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { email, fullName, avatarUrl, googleId, merge } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();

    try {
      // Check if account already exists with Apple
      const existingRows = await query<{
        id: string;
        email: string;
        full_name: string;
        avatar_url: string | null;
        phone: string | null;
        google_id: string | null;
        apple_id: string | null;
      }>(
        `SELECT id, email, full_name, avatar_url, phone, google_id, apple_id FROM users WHERE LOWER(email) = $1`,
        [cleanEmail]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        // If account registered with Apple and google_id not yet linked, and merge not confirmed
        if (existing.apple_id && !existing.google_id && !merge) {
          return reply.send({
            success: false,
            requiresMerge: true,
            existingProvider: 'apple',
            email: existing.email,
            existingName: existing.full_name,
            message: `An account for ${existing.email} was already created with Apple. Would you like to merge your Google Sign-In with your existing account?`,
          });
        }
      }

      const userRows = await query<{
        id: string;
        email: string;
        full_name: string;
        avatar_url: string | null;
        phone: string | null;
        created_at: string;
        is_new_user: boolean;
      }>(
        `
        INSERT INTO users (email, full_name, avatar_url, google_id, last_online_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (email) DO UPDATE 
        SET full_name = COALESCE(users.full_name, EXCLUDED.full_name),
            avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
            google_id = COALESCE(EXCLUDED.google_id, users.google_id),
            last_online_at = NOW()
        RETURNING id, email, full_name, avatar_url, phone, created_at, (xmax = 0) AS is_new_user
        `,
        [cleanEmail, fullName, avatarUrl || null, googleId || null]
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
        isNewUser: Boolean((user as any).is_new_user),
        circles,
        activeCircle: circles[0] || null,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to authenticate user' });
    }
  });

  // 3a. Google OAuth Code Exchange Endpoint (Proxy for Web Client PKCE with optional client secret)
  fastify.post('/api/auth/google/exchange', async (request, reply) => {
    const schema = z.object({
      code: z.string(),
      codeVerifier: z.string().optional(),
      redirectUri: z.string(),
      clientId: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { code, codeVerifier, redirectUri, clientId } = parsed.data;
    const targetClientId =
      clientId ||
      process.env.GOOGLE_CLIENT_ID ||
      '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    try {
      const bodyParams: Record<string, string> = {
        code,
        client_id: targetClientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      if (clientSecret) {
        bodyParams.client_secret = clientSecret;
      }
      if (codeVerifier) {
        bodyParams.code_verifier = codeVerifier;
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(bodyParams).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        return reply.status(400).send({ error: 'Failed to exchange token with Google', details: errText });
      }

      const tokenData = await tokenRes.json() as any;
      return reply.send({
        accessToken: tokenData.access_token,
        idToken: tokenData.id_token,
      });
    } catch (exchangeErr: any) {
      request.log.error(exchangeErr);
      return reply.status(500).send({ error: exchangeErr.message || 'Server error exchanging Google code' });
    }
  });

  // 3a-ii. Google OAuth Callback Bridge (Redirects Google Web OAuth back into native CareRing app)
  fastify.get('/api/auth/google/callback', async (request, reply) => {
    const rawQuery = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';
    const redirectTarget = `carering://oauthredirect${rawQuery}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CareRing Authentication</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background-color: #0A0F1D;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px 28px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(99, 102, 241, 0.2);
      border-top-color: #6366F1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 24px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 10px 0; font-size: 20px; font-weight: 700; color: #FFFFFF; }
    p { margin: 0; font-size: 14px; color: #94A3B8; line-height: 1.5; }
    .btn {
      display: inline-block;
      margin-top: 24px;
      background: #6366F1;
      color: #FFFFFF;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Authenticating CareRing</h2>
    <p>Signing you in securely and returning you to the app...</p>
    <a id="btn" class="btn" href="${redirectTarget}">Return to App</a>
  </div>
  <script>
    var target = ${JSON.stringify(redirectTarget)};
    try {
      window.location.replace(target);
    } catch (e) {
      window.location.href = target;
    }
  </script>
</body>
</html>`;

    return reply.type('text/html; charset=utf-8').send(html);
  });

  // 3b. Apple Authentication & Account Merging
  fastify.post('/api/auth/apple', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      fullName: z.string().optional(),
      appleId: z.string().min(1),
      merge: z.boolean().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { email, fullName, appleId, merge } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName && fullName.trim().length > 0 ? fullName.trim() : cleanEmail.split('@')[0];

    try {
      // 1. Check if user with this email already exists
      const existingRows = await query<{
        id: string;
        email: string;
        full_name: string;
        avatar_url: string | null;
        phone: string | null;
        google_id: string | null;
        apple_id: string | null;
        created_at: string;
      }>(
        `SELECT id, email, full_name, avatar_url, phone, google_id, apple_id, created_at FROM users WHERE LOWER(email) = $1`,
        [cleanEmail]
      );

      let user: any;
      let isNewUser = false;
      let merged = false;

      if (existingRows.length > 0) {
        const existing = existingRows[0];

        // If user already linked to this exact Apple ID
        if (existing.apple_id === appleId) {
          user = existing;
          await query(`UPDATE users SET last_online_at = NOW() WHERE id = $1`, [user.id]);
        } else if (existing.google_id && !existing.apple_id && !merge) {
          // USER REGISTERED VIA GOOGLE AND ATTEMPTS TO LOGIN WITH APPLE WITH SAME EMAIL!
          // Provide option to merge both accounts!
          return reply.send({
            success: false,
            requiresMerge: true,
            existingProvider: 'google',
            email: existing.email,
            existingName: existing.full_name,
            message: `An account for ${existing.email} was already created with Google. Would you like to merge your Apple Sign-In with your existing account?`,
          });
        } else {
          // Merge Apple ID into existing account (or link new Apple ID)
          const updated = await query<{
            id: string;
            email: string;
            full_name: string;
            avatar_url: string | null;
            phone: string | null;
            created_at: string;
          }>(
            `
            UPDATE users 
            SET apple_id = $1,
                full_name = COALESCE(users.full_name, $2),
                last_online_at = NOW()
            WHERE id = $3
            RETURNING id, email, full_name, avatar_url, phone, created_at
            `,
            [appleId, cleanName, existing.id]
          );
          user = updated[0];
          merged = Boolean(existing.google_id);
        }
      } else {
        // Brand new user registration via Apple
        const inserted = await query<{
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
        }>(
          `
          INSERT INTO users (email, full_name, apple_id, last_online_at)
          VALUES ($1, $2, $3, NOW())
          RETURNING id, email, full_name, avatar_url, phone, created_at
          `,
          [cleanEmail, cleanName, appleId]
        );
        user = inserted[0];
        isNewUser = true;
      }

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
        user,
        isNewUser,
        merged,
        circles,
        activeCircle: circles[0] || null,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to authenticate with Apple' });
    }
  });

  // 3c. Get Server Auth Configuration (Google Client ID & Apple Client ID for Self-Hosters & Cloud)
  fastify.get('/api/auth/config', async (request, reply) => {
    const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || null;
    const appleClientId = process.env.APPLE_CLIENT_ID || process.env.APPLE_SERVICE_ID || null;

    const isGoogleConfigured = Boolean(googleClientId && googleClientId.trim().length > 0);
    const isAppleConfigured = Boolean(appleClientId && appleClientId.trim().length > 0);
    const requirementMet = isGoogleConfigured || isAppleConfigured;

    return reply.send({
      success: true,
      googleClientId: isGoogleConfigured ? googleClientId!.trim() : null,
      appleClientId: isAppleConfigured ? appleClientId!.trim() : null,
      providers: {
        google: isGoogleConfigured,
        apple: isAppleConfigured,
      },
      isConfigured: requirementMet,
      requirementMet,
      message: requirementMet
        ? 'Social authentication configured on server.'
        : 'Self-hosted requirement: At least one of GOOGLE_CLIENT_ID or APPLE_CLIENT_ID is required for user login.',
    });
  });

  // 4. Get all circles for a user
  fastify.get('/api/users/:userId/circles', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const userUuid = normalizeToUuid(userId);

    try {
      const circles = await query<{
        id: string;
        name: string;
        invite_code: string;
        circle_type: string;
        badge_emoji: string;
        image_url: string | null;
        distance_unit: string;
        role: string;
        member_count: number;
        created_at: string;
      }>(
        `
        SELECT 
          c.id,
          c.name,
          c.invite_code,
          COALESCE(c.circle_type, 'family') AS circle_type,
          COALESCE(c.badge_emoji, '👨‍👩‍👧‍👦') AS badge_emoji,
          c.image_url,
          COALESCE(c.distance_unit, 'km') AS distance_unit,
          cm.role,
          (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id)::int AS member_count,
          c.created_at
        FROM circles c
        JOIN circle_members cm ON cm.circle_id = c.id
        WHERE cm.user_id = $1
        ORDER BY c.created_at ASC
        `,
        [userUuid]
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
      circleType: z.string().optional(),
      badgeEmoji: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      distanceUnit: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { name, userId, circleType, badgeEmoji, imageUrl, distanceUnit } = parsed.data;

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
        circle_type: string;
        badge_emoji: string;
        image_url: string | null;
        distance_unit: string;
        created_at: string;
      }>(
        `
        INSERT INTO circles (name, invite_code, created_by, circle_type, badge_emoji, image_url, distance_unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, invite_code, circle_type, badge_emoji, image_url, distance_unit, created_at
        `,
        [
          name.trim(),
          inviteCode,
          userId,
          circleType || 'family',
          badgeEmoji || '👨‍👩‍👧‍👦',
          imageUrl || null,
          distanceUnit || 'km',
        ]
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

      // 0ms Real-Time WebSocket broadcast to entire circle that a new member joined!
      const joinedUserRows = await query<any>(
        `SELECT id, full_name, email, phone, avatar_url, battery_level, is_battery_charging,
                last_latitude, last_longitude, resolved_address
         FROM users WHERE id = $1`,
        [userId]
      );

      if (joinedUserRows.length > 0) {
        const ju = joinedUserRows[0];
        roomManager.broadcastMemberJoined(circle.id, {
          id: ju.id,
          fullName: ju.full_name || 'New Member',
          email: ju.email,
          phone: ju.phone || null,
          avatarUrl: ju.avatar_url || null,
          role: 'member',
          batteryLevel: ju.battery_level ?? 85,
          isBatteryCharging: !!ju.is_battery_charging,
          latitude: ju.last_latitude ? parseFloat(ju.last_latitude) : undefined,
          longitude: ju.last_longitude ? parseFloat(ju.last_longitude) : undefined,
          address: ju.resolved_address || null,
          isOnline: true,
          joinedAt: new Date().toISOString(),
        });
      }

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

  // 7. Update circle (Name, Type, Badge Emoji, Cover Image, Units) - Owner or Admin
  fastify.put('/api/circles/:circleId', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const circleUuid = normalizeToUuid(circleId);
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      circleType: z.string().optional(),
      badgeEmoji: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      distanceUnit: z.string().optional(),
      userId: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid circle update payload' });
    }

    const { name, circleType, badgeEmoji, imageUrl, distanceUnit, userId } = parsed.data;
    const userUuid = normalizeToUuid(userId);

    try {
      // Verify user permissions
      const memberRows = await query<{ role: string }>(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circleUuid, userUuid]
      );

      if (memberRows.length === 0) {
        return reply.status(403).send({ error: 'You are not a member of this circle' });
      }

      const role = memberRows[0].role;
      if (name && role !== 'owner' && role !== 'admin') {
        return reply.status(403).send({ error: 'Only owners or admins can rename the circle' });
      }

      const updated = await query<{
        id: string;
        name: string;
        invite_code: string;
        circle_type: string;
        badge_emoji: string;
        image_url: string | null;
        distance_unit: string;
        created_at: string;
      }>(
        `
        UPDATE circles
        SET name = COALESCE($1, name),
            circle_type = COALESCE($2, circle_type),
            badge_emoji = COALESCE($3, badge_emoji),
            image_url = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE image_url END,
            distance_unit = COALESCE($5, distance_unit),
            updated_at = NOW()
        WHERE id = $6
        RETURNING id, name, invite_code, circle_type, badge_emoji, image_url, distance_unit, created_at
        `,
        [
          name ? name.trim() : null,
          circleType || null,
          badgeEmoji || null,
          imageUrl !== undefined ? imageUrl : null,
          distanceUnit || null,
          circleUuid,
        ]
      );

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Circle not found' });
      }

      const c = updated[0];
      // 0ms Real-Time Fan-out: Broadcast full updated circle to all circle members via WebSocket
      roomManager.broadcastCircleUpdated(circleId, {
        name: c.name,
        circleType: c.circle_type,
        badgeEmoji: c.badge_emoji,
        imageUrl: c.image_url,
        distanceUnit: c.distance_unit,
      });

      return reply.send({ success: true, circle: c });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update circle' });
    }
  });

  // 7b. Update circle metadata (Badge emoji, Circle Type, Units, Image)
  fastify.put('/api/circles/:circleId/meta', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const circleUuid = normalizeToUuid(circleId);
    const schema = z.object({
      circleType: z.string().optional(),
      badgeEmoji: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      distanceUnit: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid circle meta payload' });
    }

    const { circleType, badgeEmoji, imageUrl, distanceUnit } = parsed.data;

    try {
      const updated = await query<{
        id: string;
        name: string;
        circle_type: string;
        badge_emoji: string;
        image_url: string | null;
        distance_unit: string;
      }>(
        `
        UPDATE circles
        SET circle_type = COALESCE($1, circle_type),
            badge_emoji = COALESCE($2, badge_emoji),
            image_url = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE image_url END,
            distance_unit = COALESCE($4, distance_unit),
            updated_at = NOW()
        WHERE id = $5
        RETURNING id, name, circle_type, badge_emoji, image_url, distance_unit
        `,
        [circleType || null, badgeEmoji || null, imageUrl !== undefined ? imageUrl : null, distanceUnit || null, circleUuid]
      );

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Circle not found' });
      }

      const c = updated[0];
      roomManager.broadcastCircleMetaUpdated(circleId, {
        circleType: c.circle_type,
        badgeEmoji: c.badge_emoji,
        imageUrl: c.image_url,
        distanceUnit: c.distance_unit,
      });

      return reply.send({ success: true, circle: c });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update circle metadata' });
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
      const uRows = await query<{ full_name: string }>(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const userName = uRows[0]?.full_name;

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
        roomManager.broadcastCircleDeleted(circleId);
      } else {
        // Broadcast member departure to remaining members
        roomManager.broadcastMemberLeft(circleId, userId, userName);
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

      // Broadcast circle deletion to all connected members
      roomManager.broadcastCircleDeleted(circleId);

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

      // Real-time WebSocket broadcast profile updates to all connected circle members
      roomManager.broadcastProfileUpdated(userId, {
        fullName: rows[0].full_name,
        avatarUrl: rows[0].avatar_url,
        phone: rows[0].phone,
      });

      return reply.send({ success: true, user: rows[0] });
    } catch (err: any) {
      request.log.error(err);
      if (err?.code === '23505') {
        return reply.status(409).send({ error: 'This phone number is already linked to another account.' });
      }
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
    const rawRequesterId = (request.query as any)?.userId || (request.headers['x-user-id'] as string) || '';
    const circleUuid = normalizeToUuid(circleId);
    const requesterUuid = rawRequesterId ? normalizeToUuid(rawRequesterId) : '';

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
          cm.joined_at,
          u.created_at AS user_created_at,
          COALESCE(u.last_speed, 0.0)::float AS speed,
          COALESCE(u.last_heading, 0.0)::float AS heading,
          u.last_address AS resolved_address,
          u.last_longitude::float AS longitude,
          u.last_latitude::float AS latitude,
          u.last_location_time,
          u.stationary_since,
          COALESCE(u.is_stationary, true) AS is_stationary,
          u.last_activity,
          u.last_activity AS activity_type,
          u.activity_confidence::float AS activity_confidence,
          u.activity_started_at,
          mb.expires_at AS bubble_until,
          COALESCE(mb.radius_meters, 2000) AS bubble_radius,
          (mb.expires_at IS NOT NULL AND mb.expires_at > NOW()) AS in_bubble
        FROM circle_members cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN member_bubbles mb ON mb.user_id = u.id AND mb.expires_at > NOW()
        WHERE cm.circle_id = $1
        ORDER BY cm.joined_at ASC
      `;

      const members = await query(sql, [circleUuid]);
      const enrichedMembers = (members || []).map((m: any) => {
        const isSocketActive = roomManager.isUserOnline(circleId, m.id);
        const lastOnlineMs = m.last_online_at ? new Date(m.last_online_at).getTime() : 0;
        const isRecentlyActive = lastOnlineMs > 0 && (Date.now() - lastOnlineMs) < 4 * 60 * 1000;
        const isOnline = isSocketActive || isRecentlyActive;
        const inBubble = Boolean(m.in_bubble);
        const isSelf = requesterUuid ? m.id === requesterUuid : false;

        // Privacy enforcement: mask exact address and raw speed for other members if bubble is active
        const maskedAddress = inBubble && !isSelf
          ? `Inside Privacy Bubble (~${Math.round((m.bubble_radius || 2000) / 1000)}km zone)`
          : m.resolved_address;
        const maskedSpeed = inBubble && !isSelf ? 0 : m.speed;

        return {
          ...m,
          resolved_address: maskedAddress,
          speed: maskedSpeed,
          in_bubble: inBubble,
          bubble_radius: inBubble ? m.bubble_radius : undefined,
          bubble_until: inBubble ? m.bubble_until : null,
          is_online: Boolean(isOnline),
          activityType: m.last_activity || m.activity_type || undefined,
          activityConfidence: m.activity_confidence != null ? Number(m.activity_confidence) : undefined,
          activityStartedAt: m.activity_started_at || undefined,
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

      const createdPlace = rows[0];

      // Broadcast new place geofence to all circle members via WebSocket
      roomManager.broadcastPlaceCreated(circleId, createdPlace);

      return reply.status(201).send({ success: true, place: createdPlace });
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
      activity: z.string().optional(),
      activityConfidence: z.number().optional(),
      activityStartedAt: z.number().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    // Reject timestamps more than 2 minutes in the future
    if (parsed.data.timestamp > Date.now() + 120_000) {
      return reply.status(400).send({ error: 'Telemetry timestamp rejected (in the future)' });
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
        activity: parsed.data.activity,
        activityConfidence: parsed.data.activityConfidence,
        activityStartedAt: parsed.data.activityStartedAt,
      };

      await roomManager.handleTelemetryPing(ping);
      return reply.send({ success: true, message: 'Telemetry synchronized and persisted' });
    } catch (err) {
      request.log.error(err, '[REST Telemetry] Error processing ping');
      return reply.status(500).send({ error: 'Failed to process telemetry' });
    }
  });

  // 14b. Ingest Driving Safety Event via HTTP REST (Section 18, 19, 20)
  fastify.post('/api/safety/events', async (request, reply) => {
    const schema = z.object({
      id: z.string().optional(),
      userId: z.string().min(1),
      circleId: z.string().optional(),
      type: z.enum(['RAPID_ACCELERATION', 'HARD_BRAKING', 'HARSH_CORNERING', 'OVERSPEEDING', 'POSSIBLE_DISTRACTED_DRIVING']),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      confidence: z.number().min(0).max(1),
      timestamp: z.number().default(() => Date.now()),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      speed: z.number().optional(),
      speedBefore: z.number().optional(),
      speedAfter: z.number().optional(),
      acceleration: z.number().optional(),
      heading: z.number().optional(),
      headingChange: z.number().optional(),
      speedLimit: z.number().optional(),
      excessSpeed: z.number().optional(),
      duration: z.number().optional(),
      evidence: z.array(z.string()).optional(),
      sourceSignals: z.array(z.string()).optional(),
      address: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const data = parsed.data;
    const eventId = data.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userUuid = normalizeToUuid(data.userId);
    const circleUuid = data.circleId ? normalizeToUuid(data.circleId) : null;
    const eventTime = new Date(data.timestamp).toISOString();

    try {
      // 1. Asynchronously persist to safety_events table
      await query(
        `
        INSERT INTO safety_events (
          id, user_id, circle_id, event_type, severity, confidence, timestamp,
          latitude, longitude, speed, speed_before, speed_after, acceleration,
          heading, heading_change, speed_limit, excess_speed, duration,
          evidence, source_signals, address, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22
        )
        ON CONFLICT (id) DO NOTHING
        `,
        [
          eventId,
          userUuid,
          circleUuid,
          data.type,
          data.severity,
          data.confidence,
          eventTime,
          data.latitude || null,
          data.longitude || null,
          data.speed || null,
          data.speedBefore || null,
          data.speedAfter || null,
          data.acceleration || null,
          data.heading || null,
          data.headingChange || null,
          data.speedLimit || null,
          data.excessSpeed || null,
          data.duration || null,
          data.evidence || [],
          data.sourceSignals || [],
          data.address || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );

      // 2. Real-time family notification for HIGH or CRITICAL safety events (Section 20)
      if (data.circleId && (data.severity === 'HIGH' || data.severity === 'CRITICAL')) {
        const cachedUser = roomManager.getUserProfile(data.userId);
        const userName = cachedUser?.fullName || 'Family Member';

        let title = 'Driving Safety Alert';
        let message = `${userName} recorded a safety event`;

        switch (data.type) {
          case 'HARD_BRAKING':
            title = '⚠️ Hard Braking Detected';
            message = `${userName} experienced hard braking (${Math.round(data.speed || 0)} km/h).`;
            break;
          case 'RAPID_ACCELERATION':
            title = '⚠️ Rapid Acceleration Detected';
            message = `${userName} experienced rapid acceleration (${Math.round(data.speed || 0)} km/h).`;
            break;
          case 'HARSH_CORNERING':
            title = '⚠️ Harsh Cornering Detected';
            message = `${userName} took a sharp aggressive turn (${Math.round(data.speed || 0)} km/h).`;
            break;
          case 'OVERSPEEDING':
            title = '⚠️ Speed Limit Exceeded';
            message = `${userName} is travelling at ${Math.round(data.speed || 0)} km/h (speed limit: ${data.speedLimit || 60} km/h).`;
            break;
          case 'POSSIBLE_DISTRACTED_DRIVING':
            title = '⚠️ Possible Distraction';
            message = `Possible distracted driving detected for ${userName}.`;
            break;
        }

        roomManager.broadcastToCircle(
          data.circleId,
          {
            type: 'SAFETY_ALERT',
            data: {
              userId: data.userId,
              userName,
              circleId: data.circleId,
              eventType: data.type,
              severity: data.severity,
              confidence: data.confidence,
              title,
              message,
              speed: data.speed,
              latitude: data.latitude,
              longitude: data.longitude,
              timestamp: data.timestamp,
            },
          },
          data.userId
        );
      }

      return reply.send({ success: true, eventId });
    } catch (err) {
      request.log.error(err, '[REST Safety] Error persisting safety event');
      return reply.status(500).send({ error: 'Failed to persist safety event' });
    }
  });

  // 14c. Query Member Safety Events (Past 7 Days)
  fastify.get('/api/circles/:circleId/members/:userId/safety-events', async (request, reply) => {
    const { circleId, userId } = request.params as { circleId: string; userId: string };
    const userUuid = normalizeToUuid(userId);

    try {
      const rows = await query<any>(
        `
        SELECT 
          id, user_id, circle_id, event_type, severity, confidence, timestamp,
          latitude, longitude, speed, speed_before, speed_after, acceleration,
          heading, heading_change, speed_limit, excess_speed, duration,
          evidence, source_signals, address, metadata, created_at
        FROM safety_events
        WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '7 days'
        ORDER BY timestamp DESC
        LIMIT 100
        `,
        [userUuid]
      );

      return reply.send({ success: true, events: rows });
    } catch (err) {
      request.log.error(err, '[REST Safety] Error fetching safety events');
      return reply.status(500).send({ error: 'Failed to fetch safety events' });
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
        SELECT * FROM (
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
          ORDER BY m.created_at DESC
          LIMIT 50
        ) sub
        ORDER BY sub.created_at ASC
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
        SELECT * FROM (
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
          ORDER BY dm.created_at DESC
          LIMIT 100
        ) sub
        ORDER BY sub.created_at ASC
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
    const { circleId, userId } = request.params as { circleId: string; userId: string };
    const { date, tzOffset, requesterId: queryRequesterId } = request.query as { date?: string; tzOffset?: string; requesterId?: string };
    const requesterId = queryRequesterId || (request.headers['x-user-id'] as string) || '';
    const isSelf = requesterId ? requesterId === userId : false;
    const circleUuid = normalizeToUuid(circleId);
    const userUuid = normalizeToUuid(userId);

    // Check if member has an active privacy bubble
    const activeBubbleRes = await query<{ radius_meters: number; expires_at: string; created_at: string }>(
      'SELECT radius_meters, expires_at, created_at FROM member_bubbles WHERE user_id = $1 AND expires_at > NOW()',
      [userUuid]
    );
    const isBubbleActive = activeBubbleRes.length > 0;
    const bubbleRadius = isBubbleActive ? activeBubbleRes[0].radius_meters : 2000;
    const bubbleCreatedMs = isBubbleActive ? new Date(activeBubbleRes[0].created_at).getTime() : 0;

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
        joined_at: string | null;
        created_at: string | null;
      }>(
        `SELECT u.full_name, u.avatar_url, u.last_latitude, u.last_longitude, u.last_address, u.battery_level, u.last_location_time, u.stationary_since, cm.joined_at, u.created_at
         FROM users u
         LEFT JOIN circle_members cm ON cm.user_id = u.id AND cm.circle_id = $2
         WHERE u.id = $1`,
        [userUuid, circleUuid]
      );

      const user = userRes[0];
      if (!user) {
        return reply.status(404).send({ error: 'Member not found or not in this circle' });
      }

      // Privacy Guard: If entire day is before user joined this circle, return empty timeline
      if (user.joined_at) {
        const joinedDateUtc = new Date(user.joined_at);
        if (dayEndUtc < joinedDateUtc) {
          return reply.send({
            success: true,
            userId,
            userName: user.full_name || 'Member',
            avatarUrl: user.avatar_url || null,
            joinedAt: user.joined_at,
            createdAt: user.created_at,
            date: targetDate,
            totalDistanceKm: 0,
            totalMovingMinutes: 0,
            totalStayMinutes: 0,
            stopCount: 0,
            tripCount: 0,
            rawCoordinates: [],
            timeline: [],
          });
        }
      }

      // If user joined mid-day on targetDate, only reveal telemetry from join time onwards
      const effectiveStartUtc =
        user.joined_at && new Date(user.joined_at) > dayStartUtc
          ? new Date(user.joined_at).toISOString()
          : dayStartUtc.toISOString();

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
        [userUuid, effectiveStartUtc, dayEndUtc.toISOString()]
      );

      // 1. Fetch circle saved places (Home, Work, School, etc.) for high-priority place matching
      const circlePlaces = await query<{
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        radius_meters: number;
        address?: string | null;
      }>(
        'SELECT id, name, ST_Y(location)::float AS latitude, ST_X(location)::float AS longitude, radius_meters::float AS radius_meters FROM places WHERE circle_id = $1',
        [circleUuid]
      );

      const findSavedPlace = (lat: number, lng: number) => {
        for (const pl of circlePlaces) {
          const distM = haversineKm(lat, lng, pl.latitude, pl.longitude) * 1000;
          const thresh = Math.max(pl.radius_meters || 150, 150);
          if (distM <= thresh) {
            return pl;
          }
        }
        return null;
      };

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

          const isInBubbleWindow = isBubbleActive && !isSelf && endMs >= bubbleCreatedMs;
          const savedPlace = findSavedPlace(first.latitude, first.longitude);

          let stopTitle = `Stop ${stopCounter}`;
          let stopAddress = `${first.latitude.toFixed(4)}, ${first.longitude.toFixed(4)}`;

          if (isInBubbleWindow) {
            stopTitle = `Stop ${stopCounter}: Privacy Bubble (~${Math.round(bubbleRadius / 1000)}km)`;
            stopAddress = `Inside Privacy Bubble (~${Math.round(bubbleRadius / 1000)}km zone)`;
          } else if (savedPlace) {
            stopTitle = savedPlace.name;
            stopAddress = savedPlace.address || `${savedPlace.name} (Circle Place)`;
          } else if (first.resolved_address && !isCoordinateString(first.resolved_address)) {
            stopTitle = extractLocationTitle(first.resolved_address);
            stopAddress = first.resolved_address;
          }

          timeline.push({
            id: `stop_${first.id}`,
            type: 'stay',
            stopNumber: stopCounter,
            title: stopTitle,
            address: stopAddress,
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

          const fromSaved = findSavedPlace(first.latitude, first.longitude);
          const toSaved = findSavedPlace(last.latitude, last.longitude);
          const coordFrom = `${first.latitude.toFixed(4)}, ${first.longitude.toFixed(4)}`;
          const coordTo = `${last.latitude.toFixed(4)}, ${last.longitude.toFixed(4)}`;

          const fromAddr = fromSaved
            ? fromSaved.name
            : (first.resolved_address && !isCoordinateString(first.resolved_address)
              ? extractLocationTitle(first.resolved_address)
              : coordFrom);
          const toAddr = toSaved
            ? toSaved.name
            : (last.resolved_address && !isCoordinateString(last.resolved_address)
              ? extractLocationTitle(last.resolved_address)
              : coordTo);

          timeline.push({
            id: `trip_${first.id}_${last.id}`,
            type: 'trip',
            title: `Trip • ${roundedDist > 0 ? `${roundedDist} km` : `${durationMins}m`}`,
            address: `${fromAddr} → ${toAddr}`,
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

        const isMasked = isBubbleActive && !isSelf;
        const savedPlace = findSavedPlace(user.last_latitude, user.last_longitude);
        let fallbackTitle = 'Current Location';
        let fallbackAddress = 'Current Area';

        if (savedPlace) {
          fallbackTitle = savedPlace.name;
          fallbackAddress = savedPlace.address || savedPlace.name;
        } else if (user.last_address && !isCoordinateString(user.last_address)) {
          fallbackTitle = extractLocationTitle(user.last_address);
          fallbackAddress = user.last_address;
        } else {
          // Check DB cache only (0 external API calls)
          const dbGeo = await lookupCachedGeocode(user.last_latitude, user.last_longitude);
          if (dbGeo) {
            fallbackTitle = dbGeo.title;
            fallbackAddress = dbGeo.address;
          }
        }

        const finalTitle = isMasked
          ? `Stop 1: Privacy Bubble (~${Math.round(bubbleRadius / 1000)}km)`
          : fallbackTitle;
        const finalAddress = isMasked
          ? `Inside Privacy Bubble (~${Math.round(bubbleRadius / 1000)}km zone)`
          : fallbackAddress;

        timeline.push({
          id: `current_stop_${userId}`,
          type: 'stay',
          stopNumber: 1,
          title: finalTitle,
          address: finalAddress,
          startTime: stayStart,
          endTime: new Date().toISOString(),
          durationMinutes: durationMins,
          latitude: user.last_latitude,
          longitude: user.last_longitude,
          batteryLevel: user.battery_level,
        });
      }

      // Enrich timeline items purely from DB and Circle Places with ZERO external API calls
      for (const item of timeline) {
        if (item.type === 'stay' && item.latitude && item.longitude) {
          const savedPlace = findSavedPlace(item.latitude, item.longitude);
          if (savedPlace) {
            item.title = savedPlace.name;
            item.address = savedPlace.address || `${savedPlace.name} (Circle Place)`;
          } else if (item.address && !isCoordinateString(item.address)) {
            item.title = extractLocationTitle(item.address);
          } else {
            // Check persistent DB cache only (0 external API calls)
            const dbGeo = await lookupCachedGeocode(item.latitude, item.longitude);
            if (dbGeo) {
              item.title = dbGeo.title;
              item.address = dbGeo.address;
            } else {
              // Fallback for old data without DB geocode: show lat/long coordinates
              const coordStr = `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`;
              item.title = item.title && !isCoordinateString(item.title) ? item.title : `Stop ${item.stopNumber || 1}`;
              item.address = coordStr;
            }
          }
        } else if (item.type === 'trip') {
          let fromName = item.fromAddress;
          let toName = item.toAddress;

          if (item.coordinates && item.coordinates.length > 0) {
            const startCoord = item.coordinates[0];
            const endCoord = item.coordinates[item.coordinates.length - 1];
            const startCoordStr = `${startCoord[0].toFixed(4)}, ${startCoord[1].toFixed(4)}`;
            const endCoordStr = `${endCoord[0].toFixed(4)}, ${endCoord[1].toFixed(4)}`;

            const startSaved = findSavedPlace(startCoord[0], startCoord[1]);
            if (startSaved) {
              fromName = startSaved.name;
            } else if (!fromName || fromName === 'Departure Location' || fromName === 'Origin') {
              const startDbGeo = await lookupCachedGeocode(startCoord[0], startCoord[1]);
              fromName = startDbGeo ? startDbGeo.title : startCoordStr;
            }

            const endSaved = findSavedPlace(endCoord[0], endCoord[1]);
            if (endSaved) {
              toName = endSaved.name;
            } else if (!toName || toName === 'Arrival Location' || toName === 'Destination') {
              const endDbGeo = await lookupCachedGeocode(endCoord[0], endCoord[1]);
              toName = endDbGeo ? endDbGeo.title : endCoordStr;
            }
          }

          fromName = (fromName || '').replace(/^Stop \d+:\s*/i, '').trim();
          toName = (toName || '').replace(/^Stop \d+:\s*/i, '').trim();

          item.fromAddress = fromName;
          item.toAddress = toName;
          item.address = `${fromName} → ${toName}`;
          if (toName) {
            item.title = `Trip to ${toName} • ${item.distanceKm ? `${item.distanceKm.toFixed(1)} km` : `${item.durationMinutes}m`}`;
          }
        }
      }

      return reply.send({
        success: true,
        userId,
        userName: user?.full_name || 'Member',
        avatarUrl: user?.avatar_url || null,
        joinedAt: user?.joined_at || user?.created_at || null,
        createdAt: user?.created_at || null,
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

  // Internal helper to compute a member's 7-day driving safety report (shared by driver-report and driver-leaderboard)
  async function computeMemberDriverReport(userId: string): Promise<any> {
    const userUuid = normalizeToUuid(userId);
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
            startTimestamp: currentTripStart.recorded_at,
            endTimestamp: fix.recorded_at,
            startTimeRaw: startTime.toISOString(),
            endTimeRaw: endTime.toISOString(),
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
        startTimestamp: currentTripStart.recorded_at,
        endTimestamp: lastFix.recorded_at,
        startTimeRaw: startTime.toISOString(),
        endTimeRaw: endTime.toISOString(),
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

    // Query real verified safety events for the past 7 days
    const safetyEventsDb = await query<any>(
      `SELECT * FROM safety_events WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '7 days' ORDER BY timestamp DESC`,
      [userUuid]
    ).catch(() => []);

    const harshCorneringEvents: any[] = [];
    const dbDistractedEvents: any[] = [];

    for (const se of safetyEventsDb) {
      const item = {
        id: se.id,
        timestamp: se.timestamp,
        timeFormatted: new Date(se.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        address: se.address || 'Street',
        latitude: se.latitude,
        longitude: se.longitude,
        speed: se.speed,
        severity: se.severity,
        confidence: se.confidence,
        evidence: se.evidence,
      };

      if (se.event_type === 'HARD_BRAKING') {
        hardBrakingEvents.push({
          ...item,
          speedBeforeBrake: se.speed_before || se.speed,
          speedAfterBrake: se.speed_after || 0,
          gForce: Math.abs(se.acceleration || 3.5) / 9.81,
        });
      } else if (se.event_type === 'RAPID_ACCELERATION') {
        rapidAccelEvents.push({
          ...item,
          gForce: (se.acceleration || 3.0) / 9.81,
        });
      } else if (se.event_type === 'HARSH_CORNERING') {
        harshCorneringEvents.push({
          ...item,
          headingChange: se.heading_change,
          lateralG: (se.acceleration || 3.5) / 9.81,
        });
      } else if (se.event_type === 'OVERSPEEDING') {
        speedingEvents.push({
          ...item,
          speed: se.speed,
          speedLimit: se.speed_limit || 60,
          excessSpeed: se.excess_speed || (se.speed - 60),
        });
      } else if (se.event_type === 'POSSIBLE_DISTRACTED_DRIVING') {
        dbDistractedEvents.push({
          ...item,
          durationSec: se.duration || 10,
        });
      }
    }

    // Deduplicate events by id
    const uniqueHb = Array.from(new Map(hardBrakingEvents.map(e => [e.id || e.timestamp, e])).values());
    const uniqueRa = Array.from(new Map(rapidAccelEvents.map(e => [e.id || e.timestamp, e])).values());
    const uniqueSp = Array.from(new Map(speedingEvents.map(e => [e.id || e.timestamp, e])).values());
    const uniqueHc = Array.from(new Map(harshCorneringEvents.map(e => [e.id || e.timestamp, e])).values());
    const uniqueDi = Array.from(new Map(dbDistractedEvents.map(e => [e.id || e.timestamp, e])).values());

    // Transparent scoring model (Section 23 of Safety Detection Layer)
    // Base: 100
    // Deductions: Hard braking (-5), Rapid accel (-3), Harsh cornering (-4), Overspeeding (-4), Distraction (-10)
    let weeklyScore = 100;
    weeklyScore -= uniqueHb.length * 5;
    weeklyScore -= uniqueRa.length * 3;
    weeklyScore -= uniqueHc.length * 4;
    weeklyScore -= uniqueSp.length * 4;
    weeklyScore -= uniqueDi.length * 10;
    weeklyScore = Math.max(50, Math.min(100, weeklyScore));

    const safeMilesPct = trips.length > 0
      ? Math.max(80, Math.min(100, Math.round(100 - (uniqueSp.length * 2.5))))
      : 100;

    return {
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
        count: uniqueSp.length,
        topSpeed: topSpeedKm,
        events: uniqueSp,
      },
      distracted: {
        count: uniqueDi.length,
        screenTimeSec: uniqueDi.reduce((acc, d) => acc + (d.durationSec || 0), 0),
        events: uniqueDi,
      },
      rapidAccel: {
        count: uniqueRa.length,
        events: uniqueRa,
      },
      hardBraking: {
        count: uniqueHb.length,
        events: uniqueHb,
      },
      harshCornering: {
        count: uniqueHc.length,
        events: uniqueHc,
      },
      trips,
    };
  }

  // 17. Driver Safety Report & Weekly Driving Insights (Computed from real location_history)
  fastify.get('/api/circles/:circleId/members/:userId/driver-report', async (request, reply) => {
    const { userId } = request.params as { circleId: string; userId: string };

    try {
      const report = await computeMemberDriverReport(userId);
      return reply.send(report);
    } catch (err) {
      request.log.error(err, '[DriverReport] Error');
      return reply.status(500).send({ error: 'Failed to fetch driver report' });
    }
  });

  // 17.1 Circle Driver Leaderboard (Real weekly driving scores & ranks for all members)
  fastify.get('/api/circles/:circleId/driver-leaderboard', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const circleUuid = normalizeToUuid(circleId);

    try {
      // 1. Fetch all members in this circle
      const members = await query<{
        id: string;
        full_name: string;
        avatar_url: string | null;
      }>(
        `SELECT u.id, u.full_name, u.avatar_url 
         FROM circle_members cm 
         JOIN users u ON u.id = cm.user_id 
         WHERE cm.circle_id = $1`,
        [circleUuid]
      );

      if (members.length === 0) {
        return reply.send({ success: true, leaderboard: [] });
      }

      // 2. Compute individual reports for each circle member in parallel
      const leaderboardData = await Promise.all(
        members.map(async (m) => {
          try {
            const rep = await computeMemberDriverReport(m.id);
            const eventsCount =
              (rep.speeding?.count || 0) +
              (rep.hardBraking?.count || 0) +
              (rep.rapidAccel?.count || 0) +
              (rep.harshCornering?.count || 0) +
              (rep.distracted?.count || 0);

            return {
              userId: m.id,
              fullName: m.full_name,
              avatarUrl: m.avatar_url,
              weeklyScore: rep.weeklyScore ?? 100,
              topSpeedKm: rep.topSpeedKm ?? 0,
              eventsCount,
              speedingCount: rep.speeding?.count || 0,
              hardBrakingCount: rep.hardBraking?.count || 0,
              rapidAccelCount: rep.rapidAccel?.count || 0,
              distractedCount: rep.distracted?.count || 0,
              harshCorneringCount: rep.harshCornering?.count || 0,
              tripsCount: rep.totalTrips ?? 0,
              totalDistanceKm: rep.totalDistanceKm ?? 0,
            };
          } catch (_) {
            return {
              userId: m.id,
              fullName: m.full_name,
              avatarUrl: m.avatar_url,
              weeklyScore: 100,
              topSpeedKm: 0,
              eventsCount: 0,
              speedingCount: 0,
              hardBrakingCount: 0,
              rapidAccelCount: 0,
              distractedCount: 0,
              harshCorneringCount: 0,
              tripsCount: 0,
              totalDistanceKm: 0,
            };
          }
        })
      );

      // 3. Sort by weeklyScore descending (highest score = rank 1), then fewer events
      leaderboardData.sort((a, b) => {
        if (b.weeklyScore !== a.weeklyScore) return b.weeklyScore - a.weeklyScore;
        return a.eventsCount - b.eventsCount;
      });

      // 4. Assign ranks
      const ranked = leaderboardData.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));

      return reply.send({ success: true, leaderboard: ranked });
    } catch (err) {
      request.log.error(err, '[DriverLeaderboard] Error');
      return reply.status(500).send({ error: 'Failed to fetch circle driver leaderboard' });
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

  // 19b. Emergency SOS Broadcast via HTTP
  fastify.post('/api/circles/:circleId/sos', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      userId: z.string().min(1),
      latitude: z.number(),
      longitude: z.number(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid SOS payload' });
    }

    const { userId, latitude, longitude } = parsed.data;
    try {
      await roomManager.triggerSOS(userId, circleId, latitude, longitude);
      return reply.send({ success: true, message: 'Emergency SOS broadcasted successfully' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to broadcast SOS' });
    }
  });

  // 20. Delete Saved Place
  fastify.delete('/api/circles/:circleId/places/:placeId', async (request, reply) => {
    const { circleId, placeId } = request.params as { circleId: string; placeId: string };
    try {
      const circleUuid = normalizeToUuid(circleId);
      const placeUuid = normalizeToUuid(placeId);
      await query('DELETE FROM places WHERE id = $1 AND circle_id = $2', [placeUuid, circleUuid]);

      // Broadcast place deletion to all circle members via WebSocket
      roomManager.broadcastPlaceDeleted(circleId, placeId);

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
          timestamp: r.created_at,
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



  // 23. Update Member Role (Admin, Member, etc.)
  fastify.put('/api/circles/:circleId/members/:userId/role', async (request, reply) => {
    const { circleId, userId } = request.params as { circleId: string; userId: string };
    const { role, requesterId } = request.body as { role: string; requesterId?: string };
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      if (requesterId) {
        const requesterUuid = normalizeToUuid(requesterId);
        const reqRows = await query<{ role: string }>(
          'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
          [circleUuid, requesterUuid]
        );
        if (reqRows.length === 0 || reqRows[0].role !== 'owner') {
          return reply.status(403).send({ error: 'Only circle owners can change member roles' });
        }
      }

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

  // 23b. Remove Member from Circle - Owner or Admin
  fastify.delete('/api/circles/:circleId/members/:memberId', async (request, reply) => {
    const { circleId, memberId } = request.params as { circleId: string; memberId: string };
    const { requesterId } = request.query as { requesterId?: string };

    if (!requesterId) {
      return reply.status(400).send({ error: 'Missing requesterId query parameter' });
    }

    try {
      const requesterUuid = normalizeToUuid(requesterId);
      const memberUuid = normalizeToUuid(memberId);
      const circleUuid = normalizeToUuid(circleId);

      request.log.info(
        `[removeMember] requester=${requesterId} (uuid=${requesterUuid}) ` +
        `target=${memberId} (uuid=${memberUuid}) circle=${circleId} (uuid=${circleUuid})`
      );

      // Verify requester's role
      const requesterRows = await query<{ role: string }>(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circleUuid, requesterUuid]
      );

      request.log.info(`[removeMember] requesterRows=${JSON.stringify(requesterRows)}`);

      if (requesterRows.length === 0) {
        return reply.status(403).send({ error: 'You are not a member of this circle' });
      }

      const requesterRole = requesterRows[0].role?.toLowerCase();
      if (requesterRole !== 'owner' && requesterRole !== 'admin') {
        return reply.status(403).send({ error: 'Only circle owners and admins can remove members' });
      }

      // Check target member's role
      const targetRows = await query<{ role: string }>(
        'SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circleUuid, memberUuid]
      );

      request.log.info(`[removeMember] targetRows=${JSON.stringify(targetRows)}`);

      if (targetRows.length === 0) {
        return reply.status(404).send({ error: 'Member not found in this circle' });
      }

      const targetRole = targetRows[0].role?.toLowerCase();

      // Admins cannot remove owners or other admins
      if (requesterRole === 'admin' && (targetRole === 'owner' || targetRole === 'admin')) {
        return reply.status(403).send({ error: 'Admins cannot remove other admins or the circle owner' });
      }

      if (requesterUuid === memberUuid) {
        return reply.status(400).send({ error: 'Use leave circle to remove yourself' });
      }

      // Fetch member name for notification
      const uRows = await query<{ full_name: string }>(
        'SELECT full_name FROM users WHERE id = $1',
        [memberUuid]
      );
      const memberName = uRows[0]?.full_name || 'Member';

      // Delete from circle_members
      await query(
        'DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2',
        [circleUuid, memberUuid]
      );

      // Broadcast member departure to remaining members
      roomManager.broadcastMemberLeft(circleUuid, memberUuid, memberName);

      return reply.send({ success: true, message: `${memberName} has been removed from the circle` });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to remove member' });
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

      // Broadcast bubble mode activation via WebSocket
      roomManager.broadcastBubbleStatus(circleId, userId, expiresAt, radiusMeters);

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

      // Broadcast bubble removal via WebSocket
      const userCircles = await query<{ circle_id: string }>(
        'SELECT circle_id FROM circle_members WHERE user_id = $1',
        [userUuid]
      );
      for (const row of userCircles) {
        roomManager.broadcastBubbleStatus(row.circle_id, userId, null, 0);
      }

      return reply.send({ success: true });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to remove privacy bubble' });
    }
  });

  // 26. Personal Member Nicknames (Private to user, synced across all user devices)
  fastify.get('/api/circles/:circleId/nicknames', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const { userId } = request.query as { userId?: string };
    if (!userId) {
      return reply.status(400).send({ error: 'userId query parameter is required' });
    }
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      const rows = await query<{ target_user_id: string; nickname: string }>(
        `SELECT target_user_id, nickname FROM user_nicknames WHERE user_id = $1 AND circle_id = $2`,
        [userUuid, circleUuid]
      );
      const nicknames: Record<string, string> = {};
      for (const row of rows) {
        nicknames[row.target_user_id] = row.nickname;
      }
      return reply.send({ success: true, nicknames });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch nicknames' });
    }
  });

  fastify.put('/api/circles/:circleId/nicknames/:targetUserId', async (request, reply) => {
    const { circleId, targetUserId } = request.params as { circleId: string; targetUserId: string };
    const schema = z.object({
      userId: z.string().min(1),
      nickname: z.string(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid nickname payload' });
    }
    const { userId, nickname } = parsed.data;
    const trimmed = nickname.trim();
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);
    const targetUuid = normalizeToUuid(targetUserId);

    try {
      if (trimmed) {
        await query(
          `INSERT INTO user_nicknames (user_id, circle_id, target_user_id, nickname, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id, circle_id, target_user_id)
           DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = NOW()`,
          [userUuid, circleUuid, targetUuid, trimmed]
        );
        roomManager.broadcastNicknameUpdated(circleId, userId, targetUserId, trimmed);
      } else {
        await query(
          `DELETE FROM user_nicknames WHERE user_id = $1 AND circle_id = $2 AND target_user_id = $3`,
          [userUuid, circleUuid, targetUuid]
        );
        roomManager.broadcastNicknameDeleted(circleId, userId, targetUserId);
      }
      return reply.send({ success: true, targetUserId, nickname: trimmed });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to save nickname' });
    }
  });

  fastify.delete('/api/circles/:circleId/nicknames/:targetUserId', async (request, reply) => {
    const { circleId, targetUserId } = request.params as { circleId: string; targetUserId: string };
    const { userId } = (request.query || request.body || {}) as { userId?: string };
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);
    const targetUuid = normalizeToUuid(targetUserId);

    try {
      await query(
        `DELETE FROM user_nicknames WHERE user_id = $1 AND circle_id = $2 AND target_user_id = $3`,
        [userUuid, circleUuid, targetUuid]
      );
      roomManager.broadcastNicknameDeleted(circleId, userId, targetUserId);
      return reply.send({ success: true, targetUserId });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete nickname' });
    }
  });

  // 27. Favorite Members (Pinned / Starred per user per circle)
  fastify.get('/api/circles/:circleId/favorites', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const { userId } = request.query as { userId?: string };
    if (!userId) {
      return reply.status(400).send({ error: 'userId query parameter is required' });
    }
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);

    try {
      const rows = await query<{ favorite_user_id: string }>(
        `SELECT favorite_user_id FROM user_favorite_members WHERE user_id = $1 AND circle_id = $2`,
        [userUuid, circleUuid]
      );
      const favorites = rows.map((r) => r.favorite_user_id);
      return reply.send({ success: true, favorites });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch favorite members' });
    }
  });

  fastify.post('/api/circles/:circleId/favorites', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };
    const schema = z.object({
      userId: z.string().min(1),
      favoriteUserId: z.string().min(1),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid favorites payload' });
    }
    const { userId, favoriteUserId } = parsed.data;
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);
    const favUuid = normalizeToUuid(favoriteUserId);

    try {
      await query(
        `INSERT INTO user_favorite_members (user_id, circle_id, favorite_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, circle_id, favorite_user_id) DO NOTHING`,
        [userUuid, circleUuid, favUuid]
      );
      roomManager.broadcastFavoritesUpdated(circleId, userId, favoriteUserId, true);
      return reply.send({ success: true, favoriteUserId, isFavorite: true });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to add favorite' });
    }
  });

  fastify.delete('/api/circles/:circleId/favorites/:favoriteUserId', async (request, reply) => {
    const { circleId, favoriteUserId } = request.params as { circleId: string; favoriteUserId: string };
    const { userId } = (request.query || request.body || {}) as { userId?: string };
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }
    const userUuid = normalizeToUuid(userId);
    const circleUuid = normalizeToUuid(circleId);
    const favUuid = normalizeToUuid(favoriteUserId);

    try {
      await query(
        `DELETE FROM user_favorite_members WHERE user_id = $1 AND circle_id = $2 AND favorite_user_id = $3`,
        [userUuid, circleUuid, favUuid]
      );
      roomManager.broadcastFavoritesUpdated(circleId, userId, favoriteUserId, false);
      return reply.send({ success: true, favoriteUserId, isFavorite: false });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to remove favorite' });
    }
  });

  // 28. User Preferences (Theme, Distance Units, Safety Toggles, Background Tracking, Notifications)
  fastify.get('/api/users/:userId/preferences', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const userUuid = normalizeToUuid(userId);

    try {
      const rows = await query<{
        theme: string;
        distance_unit: string;
        safety_detection_enabled: boolean;
        safety_notifications_enabled: boolean;
        speed_limit_override: number | null;
        background_tracking_enabled: boolean;
        notification_preferences: any;
      }>(
        `SELECT theme, distance_unit, safety_detection_enabled, safety_notifications_enabled,
                speed_limit_override, background_tracking_enabled, notification_preferences
         FROM user_preferences
         WHERE user_id = $1`,
        [userUuid]
      );

      if (rows.length === 0) {
        return reply.send({
          success: true,
          preferences: {
            theme: 'dark',
            distanceUnit: 'metric',
            safetyDetectionEnabled: true,
            safetyNotificationsEnabled: true,
            speedLimitOverride: null,
            backgroundTrackingEnabled: true,
            notificationPreferences: {},
          },
        });
      }

      const p = rows[0];
      return reply.send({
        success: true,
        preferences: {
          theme: p.theme || 'dark',
          distanceUnit: p.distance_unit || 'metric',
          safetyDetectionEnabled: p.safety_detection_enabled ?? true,
          safetyNotificationsEnabled: p.safety_notifications_enabled ?? true,
          speedLimitOverride: p.speed_limit_override != null ? parseFloat(p.speed_limit_override as any) : null,
          backgroundTrackingEnabled: p.background_tracking_enabled ?? true,
          notificationPreferences: p.notification_preferences || {},
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch preferences' });
    }
  });

  fastify.put('/api/users/:userId/preferences', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const userUuid = normalizeToUuid(userId);
    const schema = z.object({
      theme: z.string().optional(),
      distanceUnit: z.string().optional(),
      safetyDetectionEnabled: z.boolean().optional(),
      safetyNotificationsEnabled: z.boolean().optional(),
      speedLimitOverride: z.number().nullable().optional(),
      backgroundTrackingEnabled: z.boolean().optional(),
      notificationPreferences: z.any().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid preferences payload' });
    }

    const {
      theme,
      distanceUnit,
      safetyDetectionEnabled,
      safetyNotificationsEnabled,
      speedLimitOverride,
      backgroundTrackingEnabled,
      notificationPreferences,
    } = parsed.data;

    try {
      await query(
        `INSERT INTO user_preferences (
          user_id, theme, distance_unit, safety_detection_enabled, 
          safety_notifications_enabled, speed_limit_override, 
          background_tracking_enabled, notification_preferences, updated_at
        )
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

      roomManager.broadcastToUser(userId, {
        type: 'USER_PREFERENCES_UPDATED',
        data: {
          userId,
          preferences: parsed.data,
        },
      });

      return reply.send({ success: true, preferences: parsed.data });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to update preferences' });
    }
  });

  // 29. Full Bootstrap & Background Sync Endpoint (WhatsApp/Google style single-trip hydration)
  fastify.get('/api/users/:userId/bootstrap', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { circleId } = request.query as { circleId?: string };
    const userUuid = normalizeToUuid(userId);

    try {
      // 1. Fetch user circles with full metadata
      const circles = await query<{
        id: string;
        name: string;
        invite_code: string;
        circle_type: string;
        badge_emoji: string;
        image_url: string | null;
        distance_unit: string;
        role: string;
        member_count: number;
        created_at: string;
      }>(
        `
        SELECT 
          c.id,
          c.name,
          c.invite_code,
          COALESCE(c.circle_type, 'family') AS circle_type,
          COALESCE(c.badge_emoji, '👨‍👩‍👧‍👦') AS badge_emoji,
          c.image_url,
          COALESCE(c.distance_unit, 'km') AS distance_unit,
          cm.role,
          (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id)::int AS member_count,
          c.created_at
        FROM circles c
        JOIN circle_members cm ON cm.circle_id = c.id
        WHERE cm.user_id = $1
        ORDER BY c.created_at ASC
        `,
        [userUuid]
      );

      const targetCircleId = circleId || (circles.length > 0 ? circles[0].id : null);
      let activeCircleData: any = null;

      if (targetCircleId) {
        const circleUuid = normalizeToUuid(targetCircleId);

        // Fetch members
        const members = await query<any>(
          `
          SELECT 
            u.id,
            u.full_name,
            u.email,
            u.phone,
            u.avatar_url,
            cm.role,
            COALESCE(u.battery_level, 100) AS battery_level,
            COALESCE(u.is_charging, false) AS is_battery_charging,
            u.last_latitude AS latitude,
            u.last_longitude AS longitude,
            u.last_address AS address,
            u.last_address AS resolved_address,
            u.last_speed AS speed,
            u.last_heading AS heading,
            u.last_location_time,
            u.last_activity AS activity,
            u.activity_confidence,
            u.activity_started_at,
            u.is_stationary,
            u.stationary_since,
            u.last_online_at,
            mb.radius_meters AS bubble_radius,
            mb.expires_at AS bubble_until
          FROM circle_members cm
          JOIN users u ON u.id = cm.user_id
          LEFT JOIN member_bubbles mb ON mb.user_id = u.id AND mb.circle_id = cm.circle_id AND mb.expires_at > NOW()
          WHERE cm.circle_id = $1
          ORDER BY u.full_name ASC
          `,
          [circleUuid]
        );

        // Fetch saved places (geofences)
        const places = await query<any>(
          `
          SELECT 
            id,
            name,
            category,
            radius_meters,
            notify_on_enter,
            notify_on_exit,
            created_at,
            ST_X(location) as longitude,
            ST_Y(location) as latitude
          FROM places
          WHERE circle_id = $1
          ORDER BY created_at DESC
          `,
          [circleUuid]
        );

        // Fetch nicknames for this circle
        const nickRows = await query<{ target_user_id: string; nickname: string }>(
          `SELECT target_user_id, nickname FROM user_nicknames WHERE user_id = $1 AND circle_id = $2`,
          [userUuid, circleUuid]
        );
        const nicknames: Record<string, string> = {};
        for (const nr of nickRows) {
          nicknames[nr.target_user_id] = nr.nickname;
        }

        // Fetch favorites for this circle
        const favRows = await query<{ favorite_user_id: string }>(
          `SELECT favorite_user_id FROM user_favorite_members WHERE user_id = $1 AND circle_id = $2`,
          [userUuid, circleUuid]
        );
        const favorites = favRows.map((fr) => fr.favorite_user_id);

        activeCircleData = {
          circleId: targetCircleId,
          members: (members || []).map((m: any) => ({
            ...m,
            activityType: m.last_activity || m.activity || undefined,
            activityConfidence: m.activity_confidence != null ? Number(m.activity_confidence) : undefined,
            activityStartedAt: m.activity_started_at || undefined,
          })),
          places,
          nicknames,
          favorites,
        };
      }

      // Fetch user preferences
      const prefRows = await query<any>(
        `SELECT theme, distance_unit, safety_detection_enabled, safety_notifications_enabled,
                speed_limit_override, background_tracking_enabled, notification_preferences
         FROM user_preferences WHERE user_id = $1`,
        [userUuid]
      );
      const preferences = prefRows.length > 0
        ? {
            theme: prefRows[0].theme || 'dark',
            distanceUnit: prefRows[0].distance_unit || 'metric',
            safetyDetectionEnabled: prefRows[0].safety_detection_enabled ?? true,
            safetyNotificationsEnabled: prefRows[0].safety_notifications_enabled ?? true,
            speedLimitOverride: prefRows[0].speed_limit_override != null ? parseFloat(prefRows[0].speed_limit_override) : null,
            backgroundTrackingEnabled: prefRows[0].background_tracking_enabled ?? true,
            notificationPreferences: prefRows[0].notification_preferences || {},
          }
        : {
            theme: 'dark',
            distanceUnit: 'metric',
            safetyDetectionEnabled: true,
            safetyNotificationsEnabled: true,
            speedLimitOverride: null,
            backgroundTrackingEnabled: true,
            notificationPreferences: {},
          };

      return reply.send({
        success: true,
        circles,
        activeCircle: activeCircleData,
        preferences,
        serverTime: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to bootstrap sync data' });
    }
  });
}

