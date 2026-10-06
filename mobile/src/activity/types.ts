/**
 * Types and interfaces for Smart Activity Detection System
 */

export type ActivityType =
  | 'STATIONARY'
  | 'WALKING'
  | 'RUNNING'
  | 'CYCLING'
  | 'DRIVING'
  | 'RIDING'
  | 'UNKNOWN';

export type StateMachineState =
  | 'UNKNOWN'
  | 'MOVEMENT_STARTED'
  | 'COLLECTING_DATA'
  | 'CANDIDATE_ACTIVITY'
  | 'CONFIRMED_ACTIVITY'
  | 'ACTIVITY_CHANGE_CANDIDATE'
  | 'CONFIRMED_NEW_ACTIVITY';

export type OsActivityType =
  | 'STILL'
  | 'WALKING'
  | 'RUNNING'
  | 'ON_BICYCLE'
  | 'IN_VEHICLE'
  | 'ON_FOOT'
  | 'UNKNOWN';

export interface GpsReading {
  latitude: number;
  longitude: number;
  speed: number; // in km/h
  rawSpeedMs?: number; // m/s
  accuracy?: number; // meters
  heading?: number; // degrees
  altitude?: number; // meters
  timestamp: number; // epoch ms
}

export interface MotionReading {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
  timestamp: number;
}

export interface GpsFeatures {
  rawSpeed: number;
  smoothedSpeed: number;
  speedTrend: 'ACCELERATING' | 'DECELERATING' | 'STEADY';
  acceleration: number; // m/s^2
  speedVariance: number;
  durationAtCurrentSpeed: number; // ms
  maxSpeed: number;
  minSpeed: number;
  accuracyScore: number; // 0.0 to 1.0 (1.0 = highly accurate, 0.0 = inaccurate)
  isJump: boolean;
  isStale: boolean;
  sampleCount: number;
}

export interface MotionFeatures {
  variance: number;
  energy: number;
  peakCount: number;
  estimatedCadence: number; // steps/min
  verticalOscillation: number;
  leanVariance: number; // for motorcycle/bicycle detection
  gyroEnergy: number;
  isStepLike: boolean;
  isVehicleVibration: boolean;
  hasMotionData: boolean;
  sampleCount: number;
}

export interface ActivityPrediction {
  activity: ActivityType;
  confidence: number;
  evidence: string[];
  scores: Record<ActivityType, number>;
}

export interface ActivityState {
  currentActivity: ActivityType;
  confirmedActivity: ActivityType;
  stateMachineState: StateMachineState;
  confidence: number;
  startedAt: number;
  lastUpdatedAt: number;
  candidateActivity?: ActivityType;
  candidateSince?: number;
  candidateConfidence?: number;
  previousActivity: ActivityType;
  evidence: string[];
  isMoving: boolean;
}

export interface ActivityDebugInfo {
  currentActivity: ActivityType;
  confidence: number;
  gpsSpeed: number; // km/h
  gpsSmoothedSpeed: number; // km/h
  gpsAccuracy: number; // meters
  osActivity: OsActivityType;
  accelerometerAvailable: boolean;
  gyroscopeAvailable: boolean;
  motionCadence: number; // steps/min
  motionEnergy: number;
  scores: Record<ActivityType, number>;
  stateMachineState: StateMachineState;
  candidateActivity?: ActivityType;
  candidateConfidence?: number;
  candidateDurationSec: number;
  previousActivity: ActivityType;
  timeSinceConfirmationSec: number;
  evidence: string[];
}

export interface ActivityConfigOptions {
  ACTIVITY_START_CONFIRMATION_MS?: number;
  ACTIVITY_SWITCH_CONFIRMATION_MS?: number;
  STATIONARY_CONFIRMATION_MS?: number;
  MIN_ACTIVITY_CONFIDENCE?: number;
  HIGH_ACTIVITY_CONFIDENCE?: number;
  GPS_ACCURACY_THRESHOLD_METERS?: number;
  GPS_MAX_REALISTIC_SPEED_KMH?: number;
  GPS_SPEED_SMOOTHING_ALPHA?: number;
  GPS_ROLLING_WINDOW_SIZE?: number;
  SENSOR_SAMPLING_RATE_HZ?: number;
  DEBUG_LOGGING_ENABLED?: boolean;
}

export interface ActivityEventRecord {
  id: string;
  activity: ActivityType;
  confidence: number;
  startedAt: number;
  endedAt?: number;
  averageSpeed: number;
  maxSpeed: number;
  evidence: string[];
}

export type ActivityChangeListener = (state: ActivityState) => void;
export type DebugInfoListener = (info: ActivityDebugInfo) => void;
