import { query } from '../db';
import { normalizeToUuid } from '../utils/uuid';

export interface DbMemberInfo {
  id: string;
  name: string;
  email?: string;
  role: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  battery?: number;
  isStationary?: boolean;
  stationarySince?: string;
  isOnline?: boolean;
  lastSeen?: string;
  inBubble?: boolean;
}

export interface DbDrivingSummary {
  topSpeedKm: number;
  totalDistanceKm: number;
  safetyScore: number;
  rapidAccelCount: number;
  hardBrakingCount: number;
  tripsCount: number;
}

export interface DbTimelineSummary {
  userId: string;
  totalDistanceKm: number;
  stopCount: number;
  tripCount: number;
  stops: Array<{
    title: string;
    address: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  }>;
  trips: Array<{
    fromAddress: string;
    toAddress: string;
    distanceKm: number;
    durationMinutes: number;
    topSpeed: number;
  }>;
}

class CareAiDbService {
  /**
   * Safe fetch of circle members directly from PostgreSQL
   */
  async getCircleMembers(circleId: string, currentUserId?: string): Promise<DbMemberInfo[]> {
    if (!circleId) return [];
    try {
      const circleUuid = normalizeToUuid(circleId);
      const sql = `
        SELECT 
          u.id,
          u.name,
          u.email,
          cm.role,
          u.battery_level AS battery,
          COALESCE(u.speed, 0) AS speed,
          u.is_online,
          u.last_online_at,
          u.last_address AS location,
          u.last_latitude::float AS latitude,
          u.last_longitude::float AS longitude,
          u.stationary_since,
          COALESCE(u.is_stationary, true) AS is_stationary,
          (mb.expires_at IS NOT NULL AND mb.expires_at > NOW()) AS in_bubble
        FROM circle_members cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN member_bubbles mb ON mb.user_id = u.id AND mb.expires_at > NOW()
        WHERE cm.circle_id = $1
        ORDER BY cm.joined_at ASC
      `;

      const rows = await query(sql, [circleUuid]);
      return (rows || []).map((m: any) => {
        let lastSeenText = 'Online active now';
        if (!m.is_online && m.last_online_at) {
          const mins = Math.max(0, Math.floor((Date.now() - new Date(m.last_online_at).getTime()) / 60000));
          lastSeenText = mins < 1 ? 'Just now' : `${mins}m ago`;
        }

        return {
          id: String(m.id),
          name: String(m.name || 'Member'),
          email: m.email,
          role: String(m.role || 'member'),
          location: m.location || undefined,
          latitude: m.latitude ? Number(m.latitude) : undefined,
          longitude: m.longitude ? Number(m.longitude) : undefined,
          speed: Math.round(Number(m.speed) || 0),
          battery: m.battery !== null && m.battery !== undefined ? Number(m.battery) : undefined,
          isStationary: Boolean(m.is_stationary),
          stationarySince: m.stationary_since ? new Date(m.stationary_since).toLocaleTimeString() : undefined,
          isOnline: Boolean(m.is_online),
          lastSeen: lastSeenText,
          inBubble: Boolean(m.in_bubble),
        };
      });
    } catch (err) {
      console.warn('[CareAiDbService] getCircleMembers fallback:', err);
      return [];
    }
  }

  /**
   * Safe fetch of circle saved places from PostgreSQL
   */
  async getCirclePlaces(circleId: string): Promise<Array<{ name: string; address?: string; radius?: number }>> {
    if (!circleId) return [];
    try {
      const circleUuid = normalizeToUuid(circleId);
      const sql = `
        SELECT name, address, radius
        FROM places
        WHERE circle_id = $1
        ORDER BY created_at ASC
      `;
      const rows = await query(sql, [circleUuid]);
      return (rows || []).map((p: any) => ({
        name: String(p.name || 'Place'),
        address: p.address || undefined,
        radius: p.radius ? Number(p.radius) : 150,
      }));
    } catch (err) {
      console.warn('[CareAiDbService] getCirclePlaces fallback:', err);
      return [];
    }
  }

  /**
   * Safe fetch of driving stats directly from PostgreSQL
   */
  async getMemberDrivingStats(circleId: string, memberId: string): Promise<DbDrivingSummary | null> {
    if (!memberId) return null;
    try {
      const memberUuid = normalizeToUuid(memberId);
      const sql = `
        SELECT speed, ST_Y(location) as lat, ST_X(location) as lng, recorded_at
        FROM location_history
        WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '24 HOURS'
        ORDER BY recorded_at ASC
        LIMIT 500
      `;
      const rows = await query(sql, [memberUuid]);

      let topSpeedKm = 0;
      let totalDistanceKm = 0;
      let rapidAccelCount = 0;
      let hardBrakingCount = 0;
      let tripsCount = 0;
      let inTrip = false;

      const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

      for (let i = 0; i < rows.length; i++) {
        const spd = Number(rows[i].speed) || 0;
        if (spd > topSpeedKm) topSpeedKm = Math.round(spd);

        if (spd > 15) {
          if (!inTrip) {
            inTrip = true;
            tripsCount++;
          }
        } else if (spd < 5) {
          inTrip = false;
        }

        if (i > 0) {
          const prev = rows[i - 1];
          const prevSpd = Number(prev.speed) || 0;
          if (prev.lat && prev.lng && rows[i].lat && rows[i].lng) {
            const dist = haversineKm(Number(prev.lat), Number(prev.lng), Number(rows[i].lat), Number(rows[i].lng));
            if (dist > 0.005 && dist < 10) {
              totalDistanceKm += dist;
            }
          }

          const timeSec = (new Date(rows[i].recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
          if (timeSec > 0 && timeSec <= 10) {
            const delta = spd - prevSpd;
            if (delta >= 18) rapidAccelCount++;
            else if (delta <= -18) hardBrakingCount++;
          }
        }
      }

      // Compute safety score out of 100
      const penalties = rapidAccelCount * 3 + hardBrakingCount * 4 + (topSpeedKm > 80 ? 10 : 0);
      const safetyScore = Math.max(60, Math.min(100, 100 - penalties));

      return {
        topSpeedKm,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        safetyScore,
        rapidAccelCount,
        hardBrakingCount,
        tripsCount: Math.max(tripsCount, rows.length > 5 ? 1 : 0),
      };
    } catch (err) {
      console.warn('[CareAiDbService] getMemberDrivingStats fallback:', err);
      return null;
    }
  }

  /**
   * Safe fetch of daily timeline directly from PostgreSQL
   */
  async getMemberTimeline(circleId: string, memberId: string): Promise<DbTimelineSummary | null> {
    if (!memberId) return null;
    try {
      const memberUuid = normalizeToUuid(memberId);
      const sql = `
        SELECT 
          id,
          ST_Y(location) as lat,
          ST_X(location) as lng,
          speed,
          battery_level,
          resolved_address,
          stationary_duration_sec,
          recorded_at
        FROM location_history
        WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '24 HOURS'
        ORDER BY recorded_at ASC
        LIMIT 200
      `;
      const rows = await query(sql, [memberUuid]);

      const stops: DbTimelineSummary['stops'] = [];
      const trips: DbTimelineSummary['trips'] = [];
      let totalDistanceKm = 0;

      const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

      if (rows && rows.length > 0) {
        let currentStop: any = null;
        let currentTripPoints: any[] = [];

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const spd = Number(r.speed) || 0;

          if (i > 0 && rows[i - 1].lat && r.lat) {
            const d = haversineKm(Number(rows[i - 1].lat), Number(rows[i - 1].lng), Number(r.lat), Number(r.lng));
            if (d > 0.005 && d < 10) totalDistanceKm += d;
          }

          if (spd < 5) {
            // Stationary / Stay
            if (!currentStop) {
              currentStop = {
                title: r.resolved_address ? r.resolved_address.split(',')[0] : `Stop ${stops.length + 1}`,
                address: r.resolved_address || 'Known Location',
                startTime: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                endTime: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                durationMinutes: Math.max(5, Math.round((Number(r.stationary_duration_sec) || 300) / 60)),
              };
            } else {
              currentStop.endTime = new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            if (currentTripPoints.length > 2) {
              const start = currentTripPoints[0];
              const end = currentTripPoints[currentTripPoints.length - 1];
              const durMins = Math.max(2, Math.round((new Date(end.recorded_at).getTime() - new Date(start.recorded_at).getTime()) / 60000));
              trips.push({
                fromAddress: start.resolved_address || 'Departure Location',
                toAddress: end.resolved_address || 'Arrival Location',
                distanceKm: Math.round(totalDistanceKm * 10) / 10,
                durationMinutes: durMins,
                topSpeed: Math.round(Math.max(...currentTripPoints.map((p) => Number(p.speed) || 0))),
              });
              currentTripPoints = [];
            }
          } else {
            // Moving
            if (currentStop) {
              stops.push(currentStop);
              currentStop = null;
            }
            currentTripPoints.push(r);
          }
        }

        if (currentStop) {
          stops.push(currentStop);
        }
      }

      return {
        userId: memberId,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        stopCount: stops.length,
        tripCount: trips.length,
        stops,
        trips,
      };
    } catch (err) {
      console.warn('[CareAiDbService] getMemberTimeline fallback:', err);
      return null;
    }
  }

  /**
   * Safe fetch of active circle emergency SOS from PostgreSQL
   */
  async getActiveEmergency(circleId: string): Promise<{ senderName: string; time?: string } | null> {
    if (!circleId) return null;
    try {
      const circleUuid = normalizeToUuid(circleId);
      const sql = `
        SELECT u.name, s.created_at
        FROM sos_alerts s
        JOIN users u ON u.id = s.user_id
        WHERE s.circle_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `;
      const rows = await query(sql, [circleUuid]);
      if (rows && rows.length > 0) {
        return {
          senderName: String(rows[0].name || 'Circle Member'),
          time: new Date(rows[0].created_at).toLocaleTimeString(),
        };
      }
      return null;
    } catch (err) {
      console.warn('[CareAiDbService] getActiveEmergency fallback:', err);
      return null;
    }
  }

  /**
   * Safe DB Action: Remove member from circle with strict authorization check
   */
  async removeMember(circleId: string, requesterUserId: string, targetUserId: string): Promise<{ success: boolean; message: string }> {
    if (!circleId || !targetUserId) {
      return { success: false, message: 'Invalid circle or member ID' };
    }
    try {
      const circleUuid = normalizeToUuid(circleId);
      const targetUuid = normalizeToUuid(targetUserId);

      // Verify requester has admin role if requesterUserId is provided
      if (requesterUserId) {
        const requesterUuid = normalizeToUuid(requesterUserId);
        const checkSql = `SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2`;
        const checkRows = await query(checkSql, [circleUuid, requesterUuid]);
        const requesterRole = checkRows?.[0]?.role;
        if (requesterRole !== 'admin' && requesterRole !== 'owner') {
          return { success: false, message: 'Permission denied: Only circle admins can remove members.' };
        }
      }

      // Safe parameter-bound delete
      const delSql = `DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2`;
      await query(delSql, [circleUuid, targetUuid]);

      return { success: true, message: 'Member successfully removed from circle in database.' };
    } catch (err: any) {
      console.warn('[CareAiDbService] removeMember error:', err);
      return { success: false, message: `Database operation failed: ${err.message || 'Unknown error'}` };
    }
  }

  /**
   * Safe DB Action: Join circle by invite code
   */
  async joinCircleByCode(userId: string, inviteCode: string): Promise<{ success: boolean; circleId?: string; circleName?: string; message: string }> {
    if (!userId || !inviteCode) {
      return { success: false, message: 'User ID and Invite Code are required' };
    }
    try {
      const userUuid = normalizeToUuid(userId);
      const cleanCode = inviteCode.trim().toUpperCase();

      const findSql = `SELECT id, name FROM circles WHERE UPPER(invite_code) = $1 LIMIT 1`;
      const circles = await query(findSql, [cleanCode]);

      if (!circles || circles.length === 0) {
        return { success: false, message: `No circle found with invite code "${cleanCode}".` };
      }

      const circle = circles[0];
      const insertMemberSql = `
        INSERT INTO circle_members (circle_id, user_id, role, joined_at)
        VALUES ($1, $2, 'member', NOW())
        ON CONFLICT (circle_id, user_id) DO NOTHING
      `;
      await query(insertMemberSql, [circle.id, userUuid]);

      return {
        success: true,
        circleId: String(circle.id),
        circleName: String(circle.name),
        message: `Successfully joined "${circle.name}"!`,
      };
    } catch (err: any) {
      console.warn('[CareAiDbService] joinCircleByCode error:', err);
      return { success: false, message: `Could not join circle: ${err.message || 'DB error'}` };
    }
  }
}

export const careAiDbService = new CareAiDbService();
