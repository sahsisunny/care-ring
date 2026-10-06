/**
 * Centralized Activity Detection Configuration
 * Provides configurable thresholds as mandated by the Smart Activity Detection specification.
 */

export class ActivityConfig {
  // Confirmation Windows (milliseconds)
  public static ACTIVITY_START_CONFIRMATION_MS = 15000; // 15 seconds of evidence before initial confirmation
  public static ACTIVITY_SWITCH_CONFIRMATION_MS = 12000; // 12 seconds of strong sustained evidence before switching
  public static STATIONARY_CONFIRMATION_MS = 25000; // 25 seconds of continuous 0-speed before switching to STATIONARY

  // Confidence Thresholds
  public static MIN_ACTIVITY_CONFIDENCE = 0.75;
  public static HIGH_ACTIVITY_CONFIDENCE = 0.85;

  // GPS Filtering & Smoothing Thresholds
  public static GPS_ACCURACY_THRESHOLD_METERS = 50; // Locations with accuracy > 50m have severely degraded weight
  public static GPS_IDEAL_ACCURACY_METERS = 15; // Locations <= 15m get 1.0 accuracy score
  public static GPS_MAX_REALISTIC_SPEED_KMH = 220; // Reject speeds higher than 220 km/h as GPS glitched spikes
  public static GPS_MAX_REALISTIC_ACCEL_MS2 = 8.5; // Max realistic acceleration (m/s^2) ~0-100 km/h in 3.3s
  public static GPS_SPEED_SMOOTHING_ALPHA = 0.35; // Exponential Moving Average smoothing factor (0.0 to 1.0)
  public static GPS_ROLLING_WINDOW_SIZE = 8; // Number of GPS points in rolling analysis window
  public static GPS_MAX_STALE_AGE_MS = 30000; // Discard GPS fixes older than 30s

  // Sensor Sampling & Adaptive Rates
  public static SENSOR_SAMPLING_RATE_STATIONARY_HZ = 1; // 1 Hz in low-power stationary state
  public static SENSOR_SAMPLING_RATE_MOVING_HZ = 5; // 5 Hz when moving
  public static SENSOR_SAMPLING_RATE_TRANSITION_HZ = 15; // 15 Hz when candidate transition is being evaluated
  public static MOTION_WINDOW_SAMPLE_COUNT = 60; // Keep up to 60 motion samples for spectral/cadence analysis

  // Adaptive Location Update Rates
  public static LOCATION_UPDATE_INTERVAL_STATIONARY_MS = 15000; // 15s in stationary
  public static LOCATION_UPDATE_INTERVAL_MOVING_MS = 3000; // 3s while moving
  public static LOCATION_UPDATE_INTERVAL_FAST_MS = 1500; // 1.5s during candidate activity transition

  // Debug Logging
  public static DEBUG_LOGGING_ENABLED = false;

  /**
   * Allows runtime overrides (e.g. for automated test suites or developer configuration)
   */
  public static overrideConfig(overrides: Partial<typeof ActivityConfig>): void {
    Object.assign(ActivityConfig, overrides);
  }

  /**
   * Reset config to defaults
   */
  public static resetDefaults(): void {
    ActivityConfig.ACTIVITY_START_CONFIRMATION_MS = 15000;
    ActivityConfig.ACTIVITY_SWITCH_CONFIRMATION_MS = 12000;
    ActivityConfig.STATIONARY_CONFIRMATION_MS = 25000;
    ActivityConfig.MIN_ACTIVITY_CONFIDENCE = 0.75;
    ActivityConfig.HIGH_ACTIVITY_CONFIDENCE = 0.85;
    ActivityConfig.GPS_ACCURACY_THRESHOLD_METERS = 50;
    ActivityConfig.GPS_IDEAL_ACCURACY_METERS = 15;
    ActivityConfig.GPS_MAX_REALISTIC_SPEED_KMH = 220;
    ActivityConfig.GPS_MAX_REALISTIC_ACCEL_MS2 = 8.5;
    ActivityConfig.GPS_SPEED_SMOOTHING_ALPHA = 0.35;
    ActivityConfig.GPS_ROLLING_WINDOW_SIZE = 8;
    ActivityConfig.GPS_MAX_STALE_AGE_MS = 30000;
    ActivityConfig.SENSOR_SAMPLING_RATE_STATIONARY_HZ = 1;
    ActivityConfig.SENSOR_SAMPLING_RATE_MOVING_HZ = 5;
    ActivityConfig.SENSOR_SAMPLING_RATE_TRANSITION_HZ = 15;
    ActivityConfig.MOTION_WINDOW_SAMPLE_COUNT = 60;
    ActivityConfig.LOCATION_UPDATE_INTERVAL_STATIONARY_MS = 15000;
    ActivityConfig.LOCATION_UPDATE_INTERVAL_MOVING_MS = 3000;
    ActivityConfig.LOCATION_UPDATE_INTERVAL_FAST_MS = 1500;
    ActivityConfig.DEBUG_LOGGING_ENABLED = false;
  }
}
