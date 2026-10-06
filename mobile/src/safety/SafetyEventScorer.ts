/**
 * Safety Event Scorer & Safety Score Calculation
 * Implements Section 12, 13, 22, 23 of Safety Detection Layer.md
 */

import { SafetyConfig } from './SafetyConfig';
import { SafetyEvent, SafetyEventType, SafetySummary } from './types';

export class SafetyEventScorer {
  /**
   * Computes an overall driving safety score (0 - 100) based on confirmed safety events.
   * Transparent rule-based model:
   * Base: 100
   * Deductions:
   *  - Hard braking: -5
   *  - Rapid acceleration: -3
   *  - Harsh cornering: -4
   *  - Overspeeding: -3 (LOW/MEDIUM) or -8 (HIGH)
   *  - Possible distracted driving: -10
   */
  public static calculateSafetyScore(events: SafetyEvent[]): number {
    let score = SafetyConfig.BASE_SCORE;

    for (const evt of events) {
      let penalty = 0;
      switch (evt.type) {
        case 'HARD_BRAKING':
          penalty = SafetyConfig.PENALTY_HARD_BRAKING;
          if (evt.severity === 'HIGH' || evt.severity === 'CRITICAL') penalty += 2;
          break;
        case 'RAPID_ACCELERATION':
          penalty = SafetyConfig.PENALTY_RAPID_ACCEL;
          if (evt.severity === 'HIGH') penalty += 2;
          break;
        case 'HARSH_CORNERING':
          penalty = SafetyConfig.PENALTY_HARSH_CORNERING;
          if (evt.severity === 'HIGH') penalty += 2;
          break;
        case 'OVERSPEEDING':
          penalty = evt.severity === 'HIGH' || evt.severity === 'CRITICAL'
            ? SafetyConfig.PENALTY_OVERSPEEDING_HIGH
            : SafetyConfig.PENALTY_OVERSPEEDING_LOW;
          break;
        case 'POSSIBLE_DISTRACTED_DRIVING':
          penalty = SafetyConfig.PENALTY_DISTRACTION;
          break;
      }
      score -= penalty;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate complete SafetySummary for today's drives (Section 22)
   */
  public static buildSummary(
    events: SafetyEvent[],
    distanceKm: number = 0,
    drivingTimeSec: number = 0
  ): SafetySummary {
    const eventsCount: Record<SafetyEventType, number> = {
      HARD_BRAKING: 0,
      RAPID_ACCELERATION: 0,
      HARSH_CORNERING: 0,
      OVERSPEEDING: 0,
      POSSIBLE_DISTRACTED_DRIVING: 0,
    };

    for (const evt of events) {
      if (eventsCount[evt.type] !== undefined) {
        eventsCount[evt.type]++;
      }
    }

    const safetyScore = this.calculateSafetyScore(events);

    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      drivingTimeSec,
      safetyScore,
      eventsCount,
      events,
    };
  }
}
