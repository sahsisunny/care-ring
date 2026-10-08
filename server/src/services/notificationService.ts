import webpush from 'web-push';
import { query } from '../db';
import { normalizeToUuid } from '../utils/uuid';
import { roomManager } from '../ws/roomManager';

// Standard fallback VAPID keys for CareRing (can be overridden via environment variables)
const DEFAULT_VAPID_PUBLIC =
  process.env.VAPID_PUBLIC_KEY ||
  'BADHXTi5MObj-FzrGPTCcfF--eUsAb5gsHlOB4ii55xPXqH01fSEtgYtkzo5T5TT1IuoEMwSXZ3NLU4hKC4FQzg';
const DEFAULT_VAPID_PRIVATE =
  process.env.VAPID_PRIVATE_KEY || 'WlXwss0SPeLui5nnHyVX_-CFdhEOKGrGF-loFQ9RMg4';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:support@carering.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, DEFAULT_VAPID_PUBLIC, DEFAULT_VAPID_PRIVATE);
  console.log('[WebPush] VAPID configuration initialized successfully.');
} catch (err) {
  console.warn('[WebPush] Failed to initialize VAPID details:', err);
}

export interface WebPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface WebPushSubscriptionPayload {
  endpoint: string;
  keys: WebPushSubscriptionKeys;
  userAgent?: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  circle_id: string | null;
  actor_id: string | null;
  type: string;
  title: string;
  body: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

export interface DispatchNotificationOptions {
  circleId?: string;
  actorId?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  excludeActor?: boolean;
}

export class NotificationService {
  /**
   * Return the public VAPID key so web/PWA clients can subscribe using PushManager
   */
  public getVapidPublicKey(): string {
    return DEFAULT_VAPID_PUBLIC;
  }

  /**
   * Register or update a WebPush subscription for a user
   */
  public async registerWebPushSubscription(
    userId: string,
    subscription: WebPushSubscriptionPayload
  ): Promise<void> {
    const userUuid = normalizeToUuid(userId);
    const { endpoint, keys, userAgent } = subscription;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('Invalid web push subscription format');
    }

    await query(
      `
      INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = COALESCE(EXCLUDED.user_agent, web_push_subscriptions.user_agent),
        updated_at = NOW()
      `,
      [userUuid, endpoint, keys.p256dh, keys.auth, userAgent || null]
    );
  }

  /**
   * Remove a WebPush subscription endpoint
   */
  public async unregisterWebPushSubscription(userId: string, endpoint: string): Promise<void> {
    const userUuid = normalizeToUuid(userId);
    await query(
      'DELETE FROM web_push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userUuid, endpoint]
    );
  }

  /**
   * Save a notification record in PostgreSQL
   */
  public async saveNotification(
    userId: string,
    circleId: string | null,
    actorId: string | null,
    type: string,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<NotificationRecord> {
    const userUuid = normalizeToUuid(userId);
    const circleUuid = circleId ? normalizeToUuid(circleId) : null;
    const actorUuid = actorId ? normalizeToUuid(actorId) : null;

    const rows = await query<NotificationRecord>(
      `
      INSERT INTO notifications (user_id, circle_id, actor_id, type, title, body, data, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
      RETURNING id, user_id, circle_id, actor_id, type, title, body, data, is_read, created_at
      `,
      [userUuid, circleUuid, actorUuid, type, title, body, JSON.stringify(data)]
    );

    return rows[0];
  }

  /**
   * Deliver WebPush notification to all registered browser subscriptions for a user
   */
  public async sendWebPush(
    userId: string,
    notification: { title: string; body: string; data?: any; type: string }
  ): Promise<void> {
    const userUuid = normalizeToUuid(userId);
    const subscriptions = await query<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>(
      'SELECT id, endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = $1',
      [userUuid]
    );

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        ...(notification.data || {}),
        type: notification.type,
        timestamp: Date.now(),
      },
    });

    for (const sub of subscriptions) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, payload, {
          TTL: 86400, // 24 hours
          urgency: 'high',
        });
      } catch (err: any) {
        // Prune inactive subscriptions (410 Gone or 404 Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[WebPush] Pruning expired subscription for user ${userId} (${sub.endpoint})`);
          await query('DELETE FROM web_push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
        } else {
          console.warn(`[WebPush] Failed sending push to user ${userId}:`, err.message);
        }
      }
    }
  }

  /**
   * Dispatch native push notification (FCM / Expo Push Tokens)
   */
  public async sendNativePush(
    userId: string,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    try {
      const userUuid = normalizeToUuid(userId);
      const rows = await query<{ fcm_token: string | null }>(
        'SELECT fcm_token FROM users WHERE id = $1',
        [userUuid]
      );
      const token = rows[0]?.fcm_token;
      if (!token) return;

      // 1. Expo Push Notifications
      if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              to: token,
              title,
              body,
              sound: 'default',
              data,
            }),
          });
          console.log(`[ExpoPush] Sent push to user ${userId} (${token.substring(0, 15)}...): ${title}`);
        } catch (e) {
          console.warn('[ExpoPush] Dispatch error:', e);
        }
        return;
      }

      // 2. FCM Notifications
      const fcmKey = process.env.FCM_SERVER_KEY;
      if (fcmKey && !fcmKey.includes('your_firebase')) {
        try {
          await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `key=${fcmKey}`,
            },
            body: JSON.stringify({
              to: token,
              notification: { title, body, sound: 'default' },
              data,
            }),
          });
          console.log(`[FCM] Sent push to token ${token.substring(0, 10)}...: ${title}`);
        } catch (e) {
          console.warn('[FCM] Dispatch error:', e);
        }
      } else {
        console.log(`[Push-Simulator] Push for user ${userId}: "${title}" - "${body}"`);
      }
    } catch (err) {
      console.warn('[Push] Error in sendNativePush:', err);
    }
  }

  /**
   * Dispatch push and store in DB for a single user
   */
  public async notifyUser(
    userId: string,
    options: {
      circleId?: string | null;
      actorId?: string | null;
      type: string;
      title: string;
      body: string;
      data?: Record<string, any>;
    }
  ): Promise<NotificationRecord> {
    const { circleId = null, actorId = null, type, title, body, data = {} } = options;

    // 1. Store in Database
    const record = await this.saveNotification(userId, circleId, actorId, type, title, body, data);

    // 2. Dispatch WebPush
    await this.sendWebPush(userId, { title, body, type, data }).catch((e) =>
      console.warn('[WebPush] notifyUser error:', e)
    );

    // 3. Dispatch Native Push (Expo / FCM)
    await this.sendNativePush(userId, title, body, { ...data, notificationId: record.id, type }).catch((e) =>
      console.warn('[NativePush] notifyUser error:', e)
    );

    // 4. Send Real-Time in-app notification over WebSocket if user is connected
    roomManager.broadcastToUser(userId, {
      type: 'NOTIFICATION_CREATED',
      data: {
        id: record.id,
        circleId: circleId || undefined,
        type,
        title,
        body,
        data,
        createdAt: record.created_at,
      },
    });

    return record;
  }

  /**
   * Notify all members of a circle about a circle action, persist each to DB, and send WebPush
   */
  public async notifyCircleMembers(options: DispatchNotificationOptions): Promise<void> {
    const { circleId, actorId, type, title, body, data = {}, excludeActor = true } = options;
    if (!circleId) return;

    const circleUuid = normalizeToUuid(circleId);
    const actorUuid = actorId ? normalizeToUuid(actorId) : null;

    try {
      // Find all members of the circle
      const memberRows = await query<{ user_id: string }>(
        'SELECT user_id FROM circle_members WHERE circle_id = $1',
        [circleUuid]
      );

      const recipientUuids = memberRows
        .map((r) => r.user_id)
        .filter((uid) => !excludeActor || uid !== actorUuid);

      // Persist in DB and deliver WebPush/Native Push to each member
      for (const recipientId of recipientUuids) {
        await this.notifyUser(recipientId, {
          circleId,
          actorId,
          type,
          title,
          body,
          data,
        }).catch((err) => {
          console.warn(`[Notification] Error notifying member ${recipientId}:`, err);
        });
      }

      // Also broadcast to WebSocket circle room for 0ms active client refresh
      roomManager.broadcastNotification(circleId, {
        id: `notif_${Date.now()}`,
        circleId,
        type,
        title,
        body,
        data,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[NotificationService] Error in notifyCircleMembers:', err);
    }
  }

  /**
   * Retrieve notification history for a user
   */
  public async getUserNotifications(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    const userUuid = normalizeToUuid(userId);

    const [rows, countRes] = await Promise.all([
      query<NotificationRecord>(
        `
        SELECT n.id, n.user_id, n.circle_id, n.actor_id, n.type, n.title, n.body, n.data, n.is_read, n.created_at,
               u.full_name as actor_name, u.avatar_url as actor_avatar,
               c.name as circle_name
        FROM notifications n
        LEFT JOIN users u ON u.id = n.actor_id
        LEFT JOIN circles c ON c.id = n.circle_id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [userUuid, limit, offset]
      ),
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
        [userUuid]
      ),
    ]);

    return {
      notifications: rows,
      unreadCount: parseInt(countRes[0]?.count || '0', 10),
    };
  }

  /**
   * Mark a single notification as read
   */
  public async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    const userUuid = normalizeToUuid(userId);
    const notifUuid = normalizeToUuid(notificationId);
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [notifUuid, userUuid]
    );
    return true;
  }

  /**
   * Mark all notifications as read for a user
   */
  public async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    const userUuid = normalizeToUuid(userId);
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userUuid]);
    return true;
  }

  /**
   * Delete a notification
   */
  public async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const userUuid = normalizeToUuid(userId);
    const notifUuid = normalizeToUuid(notificationId);
    await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [notifUuid, userUuid]);
    return true;
  }
}

export const notificationService = new NotificationService();
