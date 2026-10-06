/**
 * Types and interfaces for the Driving Safety Detection Layer
 * Complies with Section 2, 8, 12, 13, 15, 18, 19, 21, 22, 23 of Safety Detection Layer.md
 */

import { ActivityType } from '../activity/types';

export type SafetyEventType =
  | 'RAPID_ACCELERATION'
  | 'HARD_BRAKING'
  | 'HARSH_CORNERING'
  | 'OVERSPEEDING'
  | 'POSSIBLE_DISTRACTED_DRIVING';

export type SafetySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SafetyStateMachineState =
  | 'NORMAL'
  | 'POTENTIAL_EVENT'
  | 'VALIDATING'
  | 'CONFIRMED_EVENT'
  | 'COOLDOWN';

export type SafetySignalSource =
  | 'GPS'
  | 'ACCELEROMETER'
  | 'GYROSCOPE'
  | 'ROAD_SPEED_LIMIT'
  | 'APP_INTERACTION'
  | 'HEADING_RATE'
  | 'ACTIVITY_RECOGNITION';

export interface SafetyEvent {
  id: string;
  userId?: string;
  circleId?: string;
  type: SafetyEventType;
  severity: SafetySeverity;
  confidence: number; // 0.0 to 1.0
  timestamp: number; // epoch ms
  latitude?: number;
  longitude?: number;
  speed?: number; // km/h
  speedBefore?: number;
  speedAfter?: number;
  acceleration?: number; // m/s^2
  heading?: number; // degrees
  headingChange?: number; // degrees
  speedLimit?: number; // km/h
  excessSpeed?: number; // km/h
  duration: number; // seconds
  evidence: string[];
  sourceSignals: SafetySignalSource[];
  address?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface CandidateDetection {
  type: SafetyEventType;
  initialTimestamp: number;
  lastTimestamp: number;
  sampleCount: number;
  peakMagnitude: number;
  speedBefore?: number;
  speedAfter?: number;
  headingBefore?: number;
  headingAfter?: number;
  evidence: string[];
  sourceSignals: SafetySignalSource[];
}

export interface DetectorResult {
  detected: boolean;
  status: 'NONE' | 'POTENTIAL' | 'CONFIRMED';
  type: SafetyEventType;
  confidence: number;
  severity: SafetySeverity;
  magnitude: number;
  duration: number;
  evidence: string[];
  sourceSignals: SafetySignalSource[];
  extra?: Record<string, any>;
}

export interface SafetyDebugState {
  currentActivity: ActivityType;
  activityConfidence: number;
  speed: number; // km/h
  gpsAccuracy: number; // meters
  acceleration: number; // m/s^2
  heading: number; // degrees
  headingChange: number; // degrees
  roadSpeedLimit: number; // km/h
  overspeedConfidence: number; // 0.0 to 1.0
  hardBraking: 'No' | 'Potential' | 'Yes';
  rapidAcceleration: 'No' | 'Potential' | 'Yes';
  harshCornering: 'No' | 'Potential' | 'Yes';
  possibleDistraction: 'No' | 'Potential' | 'Yes';
  currentSafetyState: SafetyStateMachineState;
  lastConfirmedEvent?: SafetyEvent;
  activeCooldowns: Record<string, number>;
}

export interface SafetySummary {
  distanceKm: number;
  drivingTimeSec: number;
  safetyScore: number; // 0 to 100
  eventsCount: Record<SafetyEventType, number>;
  events: SafetyEvent[];
}

export interface SafetyConfigOptions {
  // Vehicle Context
  VALID_VEHICLE_ACTIVITIES?: ActivityType[];
  MIN_VEHICLE_SPEED_KMH?: number;

  // Rapid Acceleration
  RAPID_ACCEL_MIN_SPEED_KMH?: number;
  RAPID_ACCEL_THRESHOLD_MS2?: number;
  RAPID_ACCEL_CRITICAL_MS2?: number;
  RAPID_ACCEL_MIN_DURATION_MS?: number;
  RAPID_ACCEL_MIN_SAMPLES?: number;

  // Hard Braking
  HARD_BRAKING_MIN_SPEED_KMH?: number;
  HARD_BRAKING_THRESHOLD_MS2?: number;
  HARD_BRAKING_CRITICAL_MS2?: number;
  HARD_BRAKING_MIN_DURATION_MS?: number;
  HARD_BRAKING_MIN_SAMPLES?: number;
  HARD_BRAKING_MAX_GPS_ACCURACY_M?: number;

  // Harsh Cornering
  HARSH_CORNERING_MIN_SPEED_KMH?: number;
  HARSH_CORNERING_MIN_HEADING_CHANGE_DEG?: number;
  HARSH_CORNERING_MIN_HEADING_RATE_DEG_SEC?: number;
  HARSH_CORNERING_MIN_LATERAL_ACCEL_G?: number;
  HARSH_CORNERING_MIN_SAMPLES?: number;

  // Overspeeding
  DEFAULT_ROAD_SPEED_LIMIT_KMH?: number;
  OVERSPEED_TOLERANCE_KMH?: number;
  OVERSPEED_CONFIRMATION_MS?: number;
  OVERSPEED_HIGH_EXCESS_KMH?: number;
  OVERSPEED_MAX_GPS_ACCURACY_M?: number;

  // Distraction
  DISTRACTION_MIN_SPEED_KMH?: number;
  DISTRACTION_MIN_TOUCH_EVENTS?: number;
  DISTRACTION_CONFIRMATION_MS?: number;
  DISTRACTION_MOTION_ENERGY_THRESHOLD?: number;
  DISTRACTION_MIN_DRIVING_CONFIDENCE?: number;

  // Cooldowns
  COOLDOWN_RAPID_ACCEL_MS?: number;
  COOLDOWN_HARD_BRAKING_MS?: number;
  COOLDOWN_HARSH_CORNERING_MS?: number;
  COOLDOWN_OVERSPEEDING_MS?: number;
  COOLDOWN_DISTRACTION_MS?: number;

  // Scoring
  BASE_SCORE?: number;
  PENALTY_HARD_BRAKING?: number;
  PENALTY_RAPID_ACCEL?: number;
  PENALTY_HARSH_CORNERING?: number;
  PENALTY_OVERSPEEDING_LOW?: number;
  PENALTY_OVERSPEEDING_HIGH?: number;
  PENALTY_DISTRACTION?: number;

  // Logging
  DEBUG_LOGGING_ENABLED?: boolean;
}

export type SafetyEventListener = (event: SafetyEvent) => void;
export type SafetyDebugListener = (state: SafetyDebugState) => void;
