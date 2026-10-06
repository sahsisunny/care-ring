/**
 * SafetyService: Client-side Safety Network & Event Dispatcher
 * Dispatches confirmed on-device safety events to the backend REST API
 * and coordinates safety settings and push notifications.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafetyConfig, SafetyEvent } from '../safety';
import { getBackendWsUrl } from './backendUrl';

class SafetyService {
  private static instance: SafetyService;

  public static getInstance(): SafetyService {
    if (!SafetyService.instance) {
      SafetyService.instance = new SafetyService();
    }
    return SafetyService.instance;
  }

  /**
   * Transmits a confirmed safety event to the backend server.
   */
  public async syncSafetyEvent(
    event: SafetyEvent,
    backendUrlOverride?: string
  ): Promise<boolean> {
    try {
      // Check privacy consent
      const isEnabled = await this.isSafetyDetectionEnabled();
      if (!isEnabled) return false;

      const wsUrl = backendUrlOverride || getBackendWsUrl();
      const httpBase = wsUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');

      const response = await fetch(`${httpBase}/api/safety/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      return response.ok;
    } catch (err) {
      console.warn('[SafetyService] Failed to sync safety event to server:', err);
      return false;
    }
  }

  public async isSafetyDetectionEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(SafetyConfig.STORAGE_KEY_SAFETY_ENABLED);
      return val !== 'false'; // Default enabled
    } catch {
      return true;
    }
  }

  public async setSafetyDetectionEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        SafetyConfig.STORAGE_KEY_SAFETY_ENABLED,
        enabled ? 'true' : 'false'
      );
    } catch (_) {}
  }

  public async areSafetyNotificationsEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(SafetyConfig.STORAGE_KEY_NOTIFICATIONS_ENABLED);
      return val !== 'false';
    } catch {
      return true;
    }
  }

  public async setSafetyNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        SafetyConfig.STORAGE_KEY_NOTIFICATIONS_ENABLED,
        enabled ? 'true' : 'false'
      );
    } catch (_) {}
  }
}

export const safetyService = SafetyService.getInstance();
