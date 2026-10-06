/**
 * Structured debug logging for Safety Detection Engine
 * Implements Section 26 of Safety Detection Layer.md
 */

import { SafetyConfig } from './SafetyConfig';

export interface SafetyLogEntry {
  activity: string;
  speed: number;
  gpsAccuracy?: number;
  acceleration?: number;
  roadLimit?: number;
  candidate?: string;
  confidence?: number;
  action: string;
  reason: string;
}

export class SafetyLogger {
  private static logHistory: string[] = [];
  private static maxHistorySize = 100;

  public static log(entry: SafetyLogEntry): void {
    const formatted =
      `[SafetyDetection]\n` +
      `activity=${entry.activity} speed=${entry.speed.toFixed(1)} ` +
      (entry.gpsAccuracy !== undefined ? `gpsAccuracy=${Math.round(entry.gpsAccuracy)} ` : '') +
      (entry.acceleration !== undefined ? `acceleration=${entry.acceleration.toFixed(2)} ` : '') +
      (entry.roadLimit !== undefined ? `roadLimit=${entry.roadLimit} ` : '') +
      `\n` +
      (entry.candidate ? `candidate=${entry.candidate} ` : '') +
      (entry.confidence !== undefined ? `confidence=${entry.confidence.toFixed(2)} ` : '') +
      `action=${entry.action}\n` +
      `Reason: ${entry.reason}`;

    this.logHistory.unshift(`[${new Date().toLocaleTimeString()}] ${formatted}`);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.pop();
    }

    if (SafetyConfig.DEBUG_LOGGING_ENABLED) {
      console.log(formatted);
    }
  }

  public static getRecentLogs(): string[] {
    return [...this.logHistory];
  }

  public static clear(): void {
    this.logHistory = [];
  }
}
