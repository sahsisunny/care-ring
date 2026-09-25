import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const PREFS_STORAGE_KEY = '@carering_notification_preferences_v1';

export interface NotificationPreferences {
  enabled: boolean;
  speedingAlerts: boolean;
  speedThresholdKmH: number;
  movementAlerts: boolean;
  chatAlerts: boolean;
  geofenceAlerts: boolean;
  sosAlerts: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  speedingAlerts: true,
  speedThresholdKmH: 80,
  movementAlerts: true,
  chatAlerts: true,
  geofenceAlerts: true,
  sosAlerts: true,
  soundEnabled: true,
};

export interface InAppNotification {
  id: string;
  type: 'speeding' | 'movement' | 'chat' | 'geofence' | 'sos' | 'info';
  title: string;
  message: string;
  timestamp: number;
  avatarUrl?: string | null;
  userName?: string;
  userId?: string;
  actionPayload?: any;
}

type NotificationListener = (notification: InAppNotification) => void;

class NotificationService {
  private preferences: NotificationPreferences = { ...DEFAULT_PREFERENCES };
  private listeners: Set<NotificationListener> = new Set();
  private initialized = false;
  private hasNativePermission = false;
  private lastAlertTimestamps: Map<string, number> = new Map();

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // 1. Load preferences from AsyncStorage
      const stored = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
      if (stored) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[NotificationService] Error loading preferences:', e);
    }

    try {
      // 2. Configure expo-notifications handler (native only)
      if (Platform.OS !== 'web') {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: this.preferences.soundEnabled,
            shouldSetBadge: false,
            shouldPresentAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        // Setup notification channels on Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('safety_alerts', {
            name: 'Safety & Driving Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#4F46E5',
            sound: 'default',
          });

          await Notifications.setNotificationChannelAsync('chat_messages', {
            name: 'Family Chat Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 150, 150],
            lightColor: '#4F46E5',
            sound: 'default',
          });

          await Notifications.setNotificationChannelAsync('emergency_sos', {
            name: 'Emergency SOS Broadcasts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            lightColor: '#EF4444',
            sound: 'default',
          });
        }
      }
    } catch (err) {
      console.warn('[NotificationService] Expo-notifications setup notice:', err);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      this.hasNativePermission = finalStatus === 'granted';
      return this.hasNativePermission;
    } catch (err) {
      console.warn('[NotificationService] requestPermissions error:', err);
      return false;
    }
  }

  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  public async updatePreferences(nextPrefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    this.preferences = { ...this.preferences, ...nextPrefs };
    try {
      await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('[NotificationService] Error saving preferences:', e);
    }
    return { ...this.preferences };
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private dispatchToListeners(notification: InAppNotification): void {
    this.listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        console.warn('[NotificationService] Listener error:', err);
      }
    });
  }

  public async triggerNotification(notification: InAppNotification): Promise<void> {
    if (!this.preferences.enabled) return;

    // Check specific category toggles
    if (notification.type === 'speeding' && !this.preferences.speedingAlerts) return;
    if (notification.type === 'movement' && !this.preferences.movementAlerts) return;
    if (notification.type === 'chat' && !this.preferences.chatAlerts) return;
    if (notification.type === 'geofence' && !this.preferences.geofenceAlerts) return;
    if (notification.type === 'sos' && !this.preferences.sosAlerts) return;

    // Local in-app banner broadcast
    this.dispatchToListeners(notification);

    // Schedule system push/local notification via expo-notifications
    if (Platform.OS !== 'web') {
      try {
        let channelId = 'safety_alerts';
        if (notification.type === 'chat') channelId = 'chat_messages';
        if (notification.type === 'sos') channelId = 'emergency_sos';

        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.message,
            sound: this.preferences.soundEnabled,
            data: {
              type: notification.type,
              userId: notification.userId,
              actionPayload: notification.actionPayload,
            },
          },
          trigger: null, // deliver immediately
        });
      } catch (err) {
        console.warn('[NotificationService] scheduleNotificationAsync error:', err);
      }
    }
  }

  // 1. High Speeding Notification
  public notifySpeeding(userName: string, speedKmH: number, userId?: string, avatarUrl?: string | null): void {
    const key = `speeding_${userId || userName}`;
    const now = Date.now();
    const last = this.lastAlertTimestamps.get(key) || 0;
    // Debounce 45 seconds per member
    if (now - last < 45000) return;
    this.lastAlertTimestamps.set(key, now);

    this.triggerNotification({
      id: `speed_${Date.now()}_${Math.random()}`,
      type: 'speeding',
      title: '🚨 High Speed Warning',
      message: `${userName} is driving at ${Math.round(speedKmH)} km/h.`,
      timestamp: now,
      userName,
      userId,
      avatarUrl,
      actionPayload: { speedKmH, memberId: userId },
    });
  }

  // 2. Movement / Drive Started Notification
  public notifyMovement(userName: string, speedKmH: number, userId?: string, avatarUrl?: string | null): void {
    const key = `movement_${userId || userName}`;
    const now = Date.now();
    const last = this.lastAlertTimestamps.get(key) || 0;
    // Debounce 2 minutes per member
    if (now - last < 120000) return;
    this.lastAlertTimestamps.set(key, now);

    this.triggerNotification({
      id: `move_${Date.now()}_${Math.random()}`,
      type: 'movement',
      title: '🚗 Movement Detected',
      message: `${userName} just started moving (${Math.round(speedKmH)} km/h).`,
      timestamp: now,
      userName,
      userId,
      avatarUrl,
      actionPayload: { speedKmH, memberId: userId },
    });
  }

  // 3. Chat Message Notification
  public notifyChat(
    senderName: string,
    messageText: string,
    senderId?: string,
    avatarUrl?: string | null,
    isDirect?: boolean
  ): void {
    this.triggerNotification({
      id: `chat_${Date.now()}_${Math.random()}`,
      type: 'chat',
      title: isDirect ? `💬 Direct message from ${senderName}` : `💬 ${senderName} in Family Chat`,
      message: messageText.length > 80 ? `${messageText.substring(0, 77)}...` : messageText,
      timestamp: Date.now(),
      userName: senderName,
      userId: senderId,
      avatarUrl,
      actionPayload: { isDirect, senderId },
    });
  }

  // 4. Geofence Place Arrival / Departure
  public notifyGeofence(
    userName: string,
    placeName: string,
    eventType: 'ENTER' | 'EXIT',
    userId?: string
  ): void {
    const action = eventType === 'ENTER' ? 'arrived at' : 'left';
    this.triggerNotification({
      id: `geofence_${Date.now()}_${Math.random()}`,
      type: 'geofence',
      title: `📍 ${placeName} Update`,
      message: `${userName} has ${action} ${placeName}.`,
      timestamp: Date.now(),
      userName,
      userId,
      actionPayload: { placeName, eventType, memberId: userId },
    });
  }

  // 5. Emergency SOS Broadcast
  public notifySOS(userName: string, phone?: string | null, userId?: string): void {
    this.triggerNotification({
      id: `sos_${Date.now()}_${Math.random()}`,
      type: 'sos',
      title: '🆘 CRITICAL SOS ALERT',
      message: `${userName} triggered an Emergency SOS! Tap to locate immediately.`,
      timestamp: Date.now(),
      userName,
      userId,
      actionPayload: { phone, memberId: userId },
    });
  }

  // 6. Test Push Notification
  public sendTestNotification(): void {
    this.triggerNotification({
      id: `test_${Date.now()}`,
      type: 'info',
      title: '🔔 Push Notifications Active',
      message: 'CareRing notification engine is active and ready to deliver real-time driving & safety alerts.',
      timestamp: Date.now(),
      userName: 'CareRing Safety',
    });
  }
}

export const notificationService = new NotificationService();
