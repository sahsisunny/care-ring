/**
 * Activity History & Offline Transition Queue
 * Implements Section 23 & 27 of Smart Activity Detection.
 */

let AsyncStorage: any = {
  getItem: async () => null,
  setItem: async () => {},
};
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
} catch (_) {}
import { ActivityEventRecord, ActivityType } from './types';

const HISTORY_STORAGE_KEY = '@carering_activity_history';
const OFFLINE_QUEUE_KEY = '@carering_activity_offline_queue';

export class ActivityHistory {
  private history: ActivityEventRecord[] = [];
  private offlineQueue: ActivityEventRecord[] = [];
  private currentRecord: ActivityEventRecord | null = null;
  private isLoaded = false;

  public async load(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const rawHist = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (rawHist) {
        this.history = JSON.parse(rawHist);
      }
      const rawQueue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (rawQueue) {
        this.offlineQueue = JSON.parse(rawQueue);
      }
      this.isLoaded = true;
    } catch (_) {
      this.isLoaded = true;
    }
  }

  public recordTransition(
    newActivity: ActivityType,
    confidence: number,
    speed: number,
    evidence: string[],
    timestamp: number = Date.now()
  ): ActivityEventRecord {
    // Close current session if active
    if (this.currentRecord) {
      this.currentRecord.endedAt = timestamp;
      this.history.unshift(this.currentRecord);
      this.offlineQueue.push(this.currentRecord);
      if (this.history.length > 50) this.history.pop();
    }

    const record: ActivityEventRecord = {
      id: `act_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      activity: newActivity,
      confidence,
      startedAt: timestamp,
      averageSpeed: speed,
      maxSpeed: speed,
      evidence,
    };

    this.currentRecord = record;
    this.persist().catch(() => {});
    return record;
  }

  public updateCurrentMetrics(speed: number): void {
    if (!this.currentRecord) return;
    if (speed > this.currentRecord.maxSpeed) {
      this.currentRecord.maxSpeed = speed;
    }
    this.currentRecord.averageSpeed =
      (this.currentRecord.averageSpeed + speed) / 2;
  }

  public getRecentHistory(): ActivityEventRecord[] {
    return [...this.history];
  }

  public getOfflineQueue(): ActivityEventRecord[] {
    return [...this.offlineQueue];
  }

  public clearOfflineQueue(): void {
    this.offlineQueue = [];
    AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([])).catch(() => {});
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history.slice(0, 50)));
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (_) {}
  }
}
