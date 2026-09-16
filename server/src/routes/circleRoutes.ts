import { FastifyInstance } from 'fastify';
import { query } from '../db';
import { z } from 'zod';

export async function circleRoutes(fastify: FastifyInstance) {
  // 1. Get all members of a circle with their latest location & status
  fastify.get('/api/circles/:circleId/members', async (request, reply) => {
    const { circleId } = request.params as { circleId: string };

    try {
      const sql = `
        SELECT 
          u.id,
          u.full_name,
          u.avatar_url,
          u.battery_level,
          u.is_charging,
          u.last_online_at,
          cm.role,
          lh.speed,
          lh.heading,
          lh.resolved_address,
          ST_X(lh.location) AS longitude,
          ST_Y(lh.location) AS latitude,
          lh.recorded_at AS last_location_time
        FROM circle_members cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN LATERAL (
          SELECT speed, heading, resolved_address, location, recorded_at
          FROM location_history
          WHERE user_id = u.id
          ORDER BY recorded_at DESC
          LIMIT 1
        ) lh ON TRUE
        WHERE cm.circle_id = $1
      `;

      const members = await query(sql, [circleId]);
      return reply.send({ success: true, circleId, members });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch circle members' });
    }
  });

  // 2. Get places (geofences) configured for this circle
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

  // 3. Create a new geofenced place (e.g., "Home", "School", 200m radius)
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

  // 4. Seed sample Family Circle for instant out-of-the-box demo
  fastify.post('/api/seed', async (request, reply) => {
    try {
      // Create users
      const usersData = [
        { name: 'Sarah (Mom)', phone: '+15550001', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', lat: 37.7749, lng: -122.4194, speed: 42, battery: 88 },
        { name: 'Noah (Son)', phone: '+15550002', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', lat: 37.7680, lng: -122.4280, speed: 0, battery: 74 },
        { name: 'Maya (Daughter)', phone: '+15550003', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', lat: 37.7580, lng: -122.4120, speed: 12, battery: 61 },
      ];

      // Create or get circle
      const circleRes = await query<{ id: string }>(`
        INSERT INTO circles (name, invite_code)
        VALUES ('Family Circle', 'FAMILY-88')
        ON CONFLICT (invite_code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `);
      const circleId = circleRes[0].id;

      for (const u of usersData) {
        const uRes = await query<{ id: string }>(`
          INSERT INTO users (full_name, phone, avatar_url, battery_level, is_charging)
          VALUES ($1, $2, $3, $4, FALSE)
          ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name, battery_level = EXCLUDED.battery_level
          RETURNING id
        `, [u.name, u.phone, u.avatar, u.battery]);
        const userId = uRes[0].id;

        // Add to circle
        await query(`
          INSERT INTO circle_members (circle_id, user_id, role)
          VALUES ($1, $2, 'member')
          ON CONFLICT (circle_id, user_id) DO NOTHING
        `, [circleId, userId]);

        // Add initial location
        await query(`
          INSERT INTO location_history (user_id, circle_id, location, speed, battery_level, recorded_at)
          VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, NOW())
        `, [userId, circleId, u.lng, u.lat, u.speed, u.battery]);
      }

      // Add default geofenced places (Home, School)
      await query(`
        INSERT INTO places (circle_id, name, category, location, radius_meters)
        VALUES 
          ($1, 'Home', 'home', ST_SetSRID(ST_MakePoint(-122.4280, 37.7680), 4326), 200.0),
          ($1, 'Lincoln High School', 'school', ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326), 250.0)
        ON CONFLICT DO NOTHING
      `, [circleId]);

      return reply.send({ success: true, message: 'Demo data seeded', circleId });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to seed sample data' });
    }
  });
}
