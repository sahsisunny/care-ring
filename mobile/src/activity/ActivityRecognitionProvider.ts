/**
 * OS Activity Recognition Provider
 * Integrates native Activity Recognition / CoreMotion / Pedometer where available.
 */

import { OsActivityType } from './types';

let Pedometer: any = null;
let Platform: any = { OS: 'node' };
try {
  Pedometer = require('expo-sensors').Pedometer;
} catch (_) {}
try {
  Platform = require('react-native').Platform;
} catch (_) {}

export class ActivityRecognitionProvider {
  private currentHint: OsActivityType = 'UNKNOWN';
  private mockHint: OsActivityType | null = null;
  private pedometerSubscription: any = null;
  private isPedometerAvailable = false;
  private recentStepRate = 0; // steps in recent interval

  public async initialize(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      this.isPedometerAvailable = await Pedometer.isAvailableAsync();
      if (this.isPedometerAvailable) {
        let lastStepCount = 0;
        let lastStepTime = Date.now();

        this.pedometerSubscription = Pedometer.watchStepCount((result: any) => {
          const now = Date.now();
          const dtSec = Math.max(1, (now - lastStepTime) / 1000);
          const deltaSteps = Math.max(0, result.steps - lastStepCount);
          lastStepCount = result.steps;
          lastStepTime = now;

          // Estimate steps per minute
          this.recentStepRate = Math.round((deltaSteps / dtSec) * 60);

          if (this.recentStepRate > 135) {
            this.currentHint = 'RUNNING';
          } else if (this.recentStepRate >= 70) {
            this.currentHint = 'WALKING';
          } else if (this.recentStepRate === 0 && this.currentHint !== 'IN_VEHICLE') {
            this.currentHint = 'STILL';
          }
        });
      }
    } catch (err) {
      // Gracefully handle if pedometer not supported
      this.isPedometerAvailable = false;
    }
  }

  public getOsActivityHint(): OsActivityType {
    if (this.mockHint !== null) {
      return this.mockHint;
    }
    return this.currentHint;
  }

  public setMockOsActivity(hint: OsActivityType | null): void {
    this.mockHint = hint;
  }

  public getRecentStepRate(): number {
    return this.recentStepRate;
  }

  public isAvailable(): boolean {
    return this.isPedometerAvailable || this.mockHint !== null;
  }

  public dispose(): void {
    if (this.pedometerSubscription) {
      this.pedometerSubscription.remove();
      this.pedometerSubscription = null;
    }
  }
}

export const activityRecognitionProvider = new ActivityRecognitionProvider();
