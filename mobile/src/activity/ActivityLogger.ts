/**
 * Structured Activity Detection Logger
 * Outputs structured logs adhering to Section 30 of the Smart Activity Detection specification.
 */

import { ActivityConfig } from './ActivityConfig';
import { ActivityType, OsActivityType } from './types';

export interface StructuredLogPayload {
  speed: number;
  accuracy: number;
  osActivity: OsActivityType;
  candidate: ActivityType;
  confidence: number;
  previousActivity: ActivityType;
  action: 'CONFIRM_NEW' | 'KEEP_CURRENT' | 'COLLECTING' | 'DISCARD_SPIKE' | 'START_CANDIDATE';
  reason: 'HYSTERESIS' | 'CONFIRMATION_TIMEOUT_MET' | 'INSUFFICIENT_EVIDENCE' | 'GPS_NOISE_REJECTED' | 'INITIAL_START';
  evidence?: string[];
}

export class ActivityLogger {
  private static lastLogTime = 0;
  private static readonly THROTTLE_MS = 2500; // avoid log flooding unless significant event

  public static logStructured(payload: StructuredLogPayload, force: boolean = false): void {
    const now = Date.now();
    if (!force && !ActivityConfig.DEBUG_LOGGING_ENABLED && now - this.lastLogTime < this.THROTTLE_MS) {
      return;
    }
    this.lastLogTime = now;

    const logLines = [
      '[ActivityDetection]',
      `speed=${payload.speed.toFixed(1)}`,
      `accuracy=${Math.round(payload.accuracy)}`,
      `osActivity=${payload.osActivity}`,
      `candidate=${payload.candidate}`,
      `confidence=${payload.confidence.toFixed(2)}`,
      `previousActivity=${payload.previousActivity}`,
      `action=${payload.action}`,
      `reason=${payload.reason}`,
    ];

    if (payload.evidence && payload.evidence.length > 0) {
      logLines.push(`evidence=[${payload.evidence.join('; ')}]`);
    }

    if (ActivityConfig.DEBUG_LOGGING_ENABLED || payload.action === 'CONFIRM_NEW') {
      console.log(logLines.join('\n'));
    }
  }

  public static info(message: string, ...args: any[]): void {
    if (ActivityConfig.DEBUG_LOGGING_ENABLED) {
      console.log(`[ActivityDetection] ${message}`, ...args);
    }
  }

  public static warn(message: string, ...args: any[]): void {
    console.warn(`[ActivityDetection:WARN] ${message}`, ...args);
  }

  public static error(message: string, ...args: any[]): void {
    console.error(`[ActivityDetection:ERROR] ${message}`, ...args);
  }
}
