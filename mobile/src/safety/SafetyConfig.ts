/**
 * Configuration parameters and defaults for Driving Safety Detection Layer
 * Complies with Section 4, 5, 6, 7, 8, 14, 23, 24 of Safety Detection Layer.md
 */

import { ActivityType } from '../activity/types';

export class SafetyConfig {
  // 1. Vehicle Context (Section 10)
  public static VALID_VEHICLE_ACTIVITIES: ActivityType[] = ['DRIVING', 'RIDING'];
  public static MIN_VEHICLE_SPEED_KMH = 12.0;

  // 2. Rapid Acceleration (Section 4)
  public static RAPID_ACCEL_MIN_SPEED_KMH = 10.0;
  public static RAPID_ACCEL_THRESHOLD_MS2 = 3.0; // ~0.31g forward acceleration
  public static RAPID_ACCEL_CRITICAL_MS2 = 4.5; // ~0.46g aggressive acceleration
  public static RAPID_ACCEL_MIN_DURATION_MS = 1000;
  public static RAPID_ACCEL_MIN_SAMPLES = 2;

  // 3. Hard Braking (Section 5)
  public static HARD_BRAKING_MIN_SPEED_KMH = 20.0; // Ignore slow rolling stops (5 -> 0 km/h)
  public static HARD_BRAKING_THRESHOLD_MS2 = -3.5; // ~0.36g deceleration
  public static HARD_BRAKING_CRITICAL_MS2 = -5.5; // ~0.56g severe brake
  public static HARD_BRAKING_MIN_DURATION_MS = 800;
  public static HARD_BRAKING_MIN_SAMPLES = 2;
  public static HARD_BRAKING_MAX_GPS_ACCURACY_M = 35.0;

  // 4. Harsh Cornering (Section 6)
  public static HARSH_CORNERING_MIN_SPEED_KMH = 25.0; // Ignore slow turns (10 km/h)
  public static HARSH_CORNERING_MIN_HEADING_CHANGE_DEG = 35.0;
  public static HARSH_CORNERING_MIN_HEADING_RATE_DEG_SEC = 20.0; // deg per sec
  public static HARSH_CORNERING_MIN_LATERAL_ACCEL_G = 0.35; // lateral g-force
  public static HARSH_CORNERING_MIN_SAMPLES = 2;

  // 5. Overspeeding (Section 7)
  public static DEFAULT_ROAD_SPEED_LIMIT_KMH = 60.0;
  public static OVERSPEED_TOLERANCE_KMH = 10.0; // Do not trigger at 61 when limit is 60; buffer before alert
  public static OVERSPEED_CONFIRMATION_MS = 5000; // Sustained duration above limit+tolerance (reject spikes)
  public static OVERSPEED_HIGH_EXCESS_KMH = 25.0;
  public static OVERSPEED_MAX_GPS_ACCURACY_M = 40.0;

  // 6. Possible Distracted Driving (Section 8 & 9)
  public static DISTRACTION_MIN_SPEED_KMH = 20.0;
  public static DISTRACTION_MIN_TOUCH_EVENTS = 3; // Bursts of app interaction while driving
  public static DISTRACTION_CONFIRMATION_MS = 7000; // Sustained phone interaction window
  public static DISTRACTION_MOTION_ENERGY_THRESHOLD = 0.03; // Phone handling energy vs mounted in cradle
  public static DISTRACTION_MIN_DRIVING_CONFIDENCE = 0.80;

  // 7. Event Deduplication & Cooldowns (Section 14)
  public static COOLDOWN_RAPID_ACCEL_MS = 15000; // 15s cooldown
  public static COOLDOWN_HARD_BRAKING_MS = 15000; // 15s cooldown
  public static COOLDOWN_HARSH_CORNERING_MS = 15000; // 15s cooldown
  public static COOLDOWN_OVERSPEEDING_MS = 30000; // 30s cooldown
  public static COOLDOWN_DISTRACTION_MS = 45000; // 45s cooldown

  // 8. Safety Scoring Model (Section 23)
  public static BASE_SCORE = 100;
  public static PENALTY_HARD_BRAKING = 5;
  public static PENALTY_RAPID_ACCEL = 3;
  public static PENALTY_HARSH_CORNERING = 4;
  public static PENALTY_OVERSPEEDING_LOW = 3;
  public static PENALTY_OVERSPEEDING_HIGH = 8;
  public static PENALTY_DISTRACTION = 10;

  // 9. Debug & Logging (Section 26)
  public static DEBUG_LOGGING_ENABLED = false;

  // 10. Privacy & Consent Storage Keys (Section 24)
  public static STORAGE_KEY_SAFETY_ENABLED = '@carering_safety_detection_enabled';
  public static STORAGE_KEY_NOTIFICATIONS_ENABLED = '@carering_safety_notif_enabled';
  public static STORAGE_KEY_SPEED_LIMIT_OVERRIDE = '@carering_user_speed_limit_override';
  public static STORAGE_KEY_EVENTS_CACHE = '@carering_safety_events_cache';
}
