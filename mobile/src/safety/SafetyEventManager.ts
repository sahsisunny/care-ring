/**
 * Safety Event Manager: Deduplication, Cooldown, and Persistence
 * Implements Section 14, 18 & Section 27 (Test 12) of Safety Detection Layer.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafetyConfig } from './SafetyConfig';
import { SafetyEvent, SafetyEventListener, SafetyEventType, SafetySeverity } from './types';

export class SafetyEventManager {
  private lastEventTimestamps = new Map<SafetyEventType, number>();
  private lastEventSeverities = new Map<SafetyEventType, SafetySeverity>();
  private eventsHistory: SafetyEvent[] = [];
  private listeners = new Set<SafetyEventListener>();

  public constructor() {
    this.loadHistory().catch(() => {});
  }

  public reset(): void {
    this.lastEventTimestamps.clear();
    this.lastEventSeverities.clear();
    this.eventsHistory = [];
  }

  /**
   * Check if a candidate event is in active cooldown (Section 14)
   * Returns true if deduplicated / suppressed, false if allowed to fire.
   */
  public shouldSuppressDueToCooldown(
    type: SafetyEventType,
    severity: SafetySeverity,
    timestamp: number = Date.now()
  ): boolean {
    const lastTime = this.lastEventTimestamps.get(type) || 0;
    const cooldownMs = this.getCooldownForType(type);

    if (timestamp - lastTime < cooldownMs) {
      // Check if significantly more severe (e.g. previous LOW/MEDIUM, new is CRITICAL)
      const lastSeverity = this.lastEventSeverities.get(type);
      if (
        (lastSeverity === 'LOW' || lastSeverity === 'MEDIUM') &&
        severity === 'CRITICAL'
      ) {
        return false; // Allow escalated critical alert through
      }
      return true; // Suppress duplicate
    }

    return false;
  }

  /**
   * Register confirmed safety event
   */
  public recordConfirmedEvent(event: SafetyEvent): void {
    this.lastEventTimestamps.set(event.type, event.timestamp);
    this.lastEventSeverities.set(event.type, event.severity);

    this.eventsHistory.unshift(event);
    if (this.eventsHistory.length > 50) {
      this.eventsHistory.pop();
    }

    this.saveHistory().catch(() => {});
    this.notifyListeners(event);
  }

  public getRecentEvents(): SafetyEvent[] {
    return [...this.eventsHistory];
  }

  public getActiveCooldowns(now: number = Date.now()): Record<string, number> {
    const cooldowns: Record<string, number> = {};
    for (const [type, lastTime] of this.lastEventTimestamps.entries()) {
      const duration = this.getCooldownForType(type);
      const remainingMs = Math.max(0, lastTime + duration - now);
      if (remainingMs > 0) {
        cooldowns[type] = Math.round(remainingMs / 1000);
      }
    }
    return cooldowns;
  }

  public subscribe(listener: SafetyEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(event: SafetyEvent): void {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (_) {}
    });
  }

  private getCooldownForType(type: SafetyEventType): number {
    switch (type) {
      case 'RAPID_ACCELERATION':
        return SafetyConfig.COOLDOWN_RAPID_ACCEL_MS;
      case 'HARD_BRAKING':
        return SafetyConfig.COOLDOWN_HARD_BRAKING_MS;
      case 'HARSH_CORNERING':
        return SafetyConfig.COOLDOWN_HARSH_CORNERING_MS;
      case 'OVERSPEEDING':
        return SafetyConfig.COOLDOWN_OVERSPEEDING_MS;
      case 'POSSIBLE_DISTRACTED_DRIVING':
        return SafetyConfig.COOLDOWN_DISTRACTION_MS;
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        SafetyConfig.STORAGE_KEY_EVENTS_CACHE,
        JSON.stringify(this.eventsHistory)
      );
    } catch (_) {}
  }

  private async loadHistory(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(SafetyConfig.STORAGE_KEY_EVENTS_CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.eventsHistory = parsed;
        }
      }
    } catch (_) {}
  }
}
