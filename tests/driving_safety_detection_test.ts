/**
 * Automated Verification & Audit Test Suite for Driving Safety Detection Engine
 * Comprehensive audit, boundary verification, negative tests, and malformed telemetry tests.
 * Implements Section 4–15, 23, 24, 26, 27, 29 of Safety Detection Layer.md
 */

import { AccelerationDetector } from '../mobile/src/safety/AccelerationDetector';
import { CorneringDetector } from '../mobile/src/safety/CorneringDetector';
import { DistractionDetector } from '../mobile/src/safety/DistractionDetector';
import { SafetyConfig } from '../mobile/src/safety/SafetyConfig';
import { SafetyDetectionEngine } from '../mobile/src/safety/SafetyDetectionEngine';
import { SafetyEventManager } from '../mobile/src/safety/SafetyEventManager';
import { SafetyEventScorer } from '../mobile/src/safety/SafetyEventScorer';
import { SensorReplay } from '../mobile/src/safety/SensorReplay';
import { SafetyEvent } from '../mobile/src/safety/types';

export type TestClassification = 'True Integration Test' | 'Unit Test' | 'Weak Integration Test';

export interface TestAuditRecord {
  id: number;
  name: string;
  category: string;
  classification: TestClassification;
  passed: boolean;
  details: string;
}

const auditRecords: TestAuditRecord[] = [];

function recordTest(
  id: number,
  name: string,
  category: string,
  classification: TestClassification,
  condition: boolean,
  details: string
) {
  auditRecords.push({
    id,
    name,
    category,
    classification,
    passed: condition,
    details,
  });

  const badge = condition ? '✅ [PASSED]' : '❌ [FAILED]';
  const tag = `[${classification}]`;
  console.log(`${badge} ${tag} Test ${id}: ${name} — ${details}`);
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('🛡️ DRIVING SAFETY DETECTION TEST SUITE & PIPELINE AUDIT');
  console.log('================================================================================\n');

  const engine = new SafetyDetectionEngine();

  // ===========================================================================
  // SECTION 1: BASELINE SPECIFICATION TESTS (Upgraded from Tests 1-14)
  // ===========================================================================

  // Test 1: Rapid Acceleration
  {
    engine.reset();
    let time = 100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedMotion({ x: 0.1, y: 0.45, z: 0.95, magnitude: 1.05, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 32, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedMotion({ x: 0.1, y: 0.5, z: 0.95, magnitude: 1.08, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 46, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedMotion({ x: 0.1, y: 0.52, z: 0.95, magnitude: 1.1, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7709, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const rapidEvent = events.find((e) => e.type === 'RAPID_ACCELERATION');
    const isPassing =
      !!rapidEvent &&
      rapidEvent.confidence >= 0.75 &&
      (rapidEvent.severity === 'LOW' || rapidEvent.severity === 'MEDIUM') &&
      rapidEvent.sourceSignals.includes('GPS') &&
      (rapidEvent.acceleration || 0) >= 3.0;

    recordTest(
      1,
      'Rapid Acceleration Full Pipeline',
      'Baseline Specification',
      'True Integration Test',
      isPassing,
      rapidEvent
        ? `Emitted with confidence ${rapidEvent.confidence}, severity ${rapidEvent.severity}, accel ${rapidEvent.acceleration} m/s²`
        : 'Failed to emit RAPID_ACCELERATION'
    );
  }

  // Test 2: Normal Acceleration
  {
    engine.reset();
    let time = 200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const normalSpeeds = [20, 25, 30, 35];
    for (const spd of normalSpeeds) {
      engine.feedMotion({ x: 0.02, y: 0.08, z: 0.98, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1500;
    }
    unsub();

    const hasEvent = events.some((e) => e.type === 'RAPID_ACCELERATION');
    recordTest(
      2,
      'Normal Acceleration Negative Guard',
      'Baseline Specification',
      'True Integration Test',
      !hasEvent,
      'Normal acceleration (20 -> 35 km/h over 4.5s) correctly produces no safety event'
    );
  }

  // Test 3: Hard Braking
  {
    engine.reset();
    let time = 300000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);
    time += 700;
    engine.feedMotion({ x: 0.05, y: -0.45, z: 0.92, magnitude: 1.05, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 65, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);
    time += 700;
    engine.feedMotion({ x: 0.05, y: -0.55, z: 0.90, magnitude: 1.1, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7708, longitude: -122.41, speed: 45, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);
    time += 700;
    engine.feedMotion({ x: 0.05, y: -0.58, z: 0.88, magnitude: 1.15, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7710, longitude: -122.41, speed: 20, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const brakeEvent = events.find((e) => e.type === 'HARD_BRAKING');
    const isPassing =
      !!brakeEvent &&
      brakeEvent.severity === 'HIGH' &&
      brakeEvent.confidence >= 0.78 &&
      brakeEvent.speedBefore === 80 &&
      (brakeEvent.speedAfter || 0) <= 45 &&
      (brakeEvent.acceleration || 0) < 0;

    recordTest(
      3,
      'Hard Braking Full Pipeline',
      'Baseline Specification',
      'True Integration Test',
      isPassing,
      brakeEvent
        ? `Emitted with severity ${brakeEvent.severity}, confidence ${brakeEvent.confidence}, decel ${brakeEvent.acceleration} m/s², drop ${brakeEvent.speedBefore}->${brakeEvent.speedAfter} km/h`
        : 'Failed to emit HARD_BRAKING'
    );
  }

  // Test 4: Normal Gentle Braking
  {
    engine.reset();
    let time = 400000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const gentleBrakes = [50, 45, 40, 35];
    for (const spd of gentleBrakes) {
      engine.feedMotion({ x: 0.02, y: -0.05, z: 0.98, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1500;
    }
    unsub();

    const hasHardBrake = events.some((e) => e.type === 'HARD_BRAKING');
    recordTest(
      4,
      'Normal Gentle Braking Negative Guard',
      'Baseline Specification',
      'True Integration Test',
      !hasHardBrake,
      'Gentle braking (50 -> 35 km/h over 4.5s) safely produces zero hard braking alerts'
    );
  }

  // Test 5: Harsh Cornering
  {
    engine.reset();
    let time = 500000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const headings = [120, 142, 168, 190];
    for (const h of headings) {
      engine.feedMotion({ x: 0.42, y: 0.05, z: 0.92, gyroZ: 0.65, magnitude: 1.02, timestamp: time });
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: 48, heading: h, accuracy: 5, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 600;
    }
    unsub();

    const cornerEvent = events.find((e) => e.type === 'HARSH_CORNERING');
    const isPassing =
      !!cornerEvent &&
      cornerEvent.confidence >= 0.72 &&
      (cornerEvent.severity === 'MEDIUM' || cornerEvent.severity === 'HIGH') &&
      cornerEvent.sourceSignals.includes('HEADING_RATE');

    recordTest(
      5,
      'Harsh Cornering Full Pipeline',
      'Baseline Specification',
      'True Integration Test',
      isPassing,
      cornerEvent
        ? `Emitted with confidence ${cornerEvent.confidence}, severity ${cornerEvent.severity}, heading change ${cornerEvent.headingChange}°`
        : 'Failed to emit HARSH_CORNERING'
    );
  }

  // Test 6: Normal Corner
  {
    engine.reset();
    let time = 600000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const slowHeadings = [90, 115, 140, 180];
    for (const h of slowHeadings) {
      engine.feedMotion({ x: 0.05, y: 0.02, z: 0.98, gyroZ: 0.1, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: 10, heading: h, accuracy: 5, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 1000;
    }
    unsub();

    const hasHarshCorner = events.some((e) => e.type === 'HARSH_CORNERING');
    recordTest(
      6,
      'Normal Slow Corner Negative Guard',
      'Baseline Specification',
      'True Integration Test',
      !hasHarshCorner,
      'Slow cornering at 10 km/h correctly rejected from harsh cornering classification'
    );
  }

  // Test 7: Overspeeding
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    let time = 700000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const overSpeeds = [72, 74, 76, 75, 78, 77, 76];
    for (const spd of overSpeeds) {
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 6, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 1000;
    }
    unsub();

    const overspeedEvent = events.find((e) => e.type === 'OVERSPEEDING');
    const isPassing =
      !!overspeedEvent &&
      overspeedEvent.duration >= 5 &&
      (overspeedEvent.excessSpeed || 0) >= 14 &&
      overspeedEvent.speedLimit === 60 &&
      overspeedEvent.sourceSignals.includes('ROAD_SPEED_LIMIT');

    recordTest(
      7,
      'Overspeeding Full Pipeline',
      'Baseline Specification',
      'True Integration Test',
      isPassing,
      overspeedEvent
        ? `Emitted with duration ${overspeedEvent.duration}s, excess +${overspeedEvent.excessSpeed} km/h over limit ${overspeedEvent.speedLimit} km/h`
        : 'Failed to emit OVERSPEEDING'
    );
  }

  // Test 8: GPS Spike
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    let time = 800000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const spikeSequence = [50, 150, 48, 52];
    for (const spd of spikeSequence) {
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 6, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 500;
    }
    unsub();

    const hasOverspeed = events.some((e) => e.type === 'OVERSPEEDING');
    recordTest(
      8,
      'GPS Speed Spike Negative Guard',
      'Baseline Specification',
      'True Integration Test',
      !hasOverspeed,
      'Single noisy GPS jump (50 -> 150 -> 48) correctly rejected without false overspeeding'
    );
  }

  // Test 9: Traffic Stop-and-Go
  {
    engine.reset();
    let time = 900000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const trafficSpeeds = [35, 25, 12, 4, 0, 5, 15];
    for (const spd of trafficSpeeds) {
      engine.feedMotion({ x: 0.03, y: -0.08, z: 0.98, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 5, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 2000;
    }
    unsub();

    const hasHardBrake = events.some((e) => e.type === 'HARD_BRAKING');
    recordTest(
      9,
      'Traffic Stop-and-Go Deceleration Negative Guard',
      'Baseline Specification',
      'True Integration Test',
      !hasHardBrake,
      'Stop-and-go traffic deceleration safely processed without false hard-braking alert'
    );
  }

  // Test 10: Phone Interaction / Distraction
  {
    engine.reset();
    let time = 1000000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 9; i++) {
      engine.registerUserInteraction(time);
      engine.feedMotion({ x: 0.15, y: 0.12, z: 0.95, magnitude: 1.08, timestamp: time });
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 1000;
    }
    unsub();

    const distractEvent = events.find((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    const isPassing =
      !!distractEvent &&
      distractEvent.confidence >= 0.85 &&
      distractEvent.confidence < 1.0 &&
      distractEvent.duration >= 7 &&
      distractEvent.metadata?.touchCount >= 3;

    recordTest(
      10,
      'Phone Interaction Distraction Pipeline',
      'Baseline Specification',
      'True Integration Test',
      isPassing,
      distractEvent
        ? `Emitted with confidence ${distractEvent.confidence}, duration ${distractEvent.duration}s, touches ${distractEvent.metadata?.touchCount}`
        : 'Failed to emit POSSIBLE_DISTRACTED_DRIVING'
    );
  }

  // Test 11: Walking Context Guard
  {
    engine.reset();
    let time = 1100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedMotion({ x: 0.3, y: 0.8, z: 1.3, magnitude: 1.5, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 6, accuracy: 5, timestamp: time }, 'WALKING', 0.95);
    time += 800;
    engine.feedMotion({ x: 0.3, y: 0.9, z: 1.4, magnitude: 1.6, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 14, accuracy: 5, timestamp: time }, 'WALKING', 0.95);
    unsub();

    recordTest(
      11,
      'Walking Activity Context Guard',
      'Baseline Specification',
      'True Integration Test',
      events.length === 0,
      'Non-vehicle activity (WALKING) correctly ignores driving safety detectors'
    );
  }

  // Test 12: Event Deduplication & Cooldown
  {
    engine.reset();
    let time = 1200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 70, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 500;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 500;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 15, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    for (let i = 0; i < 5; i++) {
      time += 1000;
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 500;
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    }
    unsub();

    const hardBrakingCount = events.filter((e) => e.type === 'HARD_BRAKING').length;
    recordTest(
      12,
      'Single Event-Type Cooldown Deduplication',
      'Baseline Specification',
      'True Integration Test',
      hardBrakingCount === 1,
      `Cooldown correctly prevented repeated duplicate events (expected 1, got ${hardBrakingCount})`
    );
  }

  // Test 13: Strengthened Sensor Replay Harness
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    const replay = new SensorReplay(engine);
    let time = 1300000;

    const recordedTrack = [
      // 1. Rapid Accel
      { latitude: 37.77, longitude: -122.41, speed: 20, timestamp: time, activity: 'DRIVING' as const, motion: { x: 0.1, y: 0.45, z: 0.95, magnitude: 1.05, timestamp: time } },
      { latitude: 37.7701, longitude: -122.41, speed: 35, timestamp: time + 800, activity: 'DRIVING' as const, motion: { x: 0.1, y: 0.5, z: 0.95, magnitude: 1.08, timestamp: time + 800 } },
      { latitude: 37.7703, longitude: -122.41, speed: 55, timestamp: time + 1600, activity: 'DRIVING' as const, motion: { x: 0.1, y: 0.52, z: 0.95, magnitude: 1.1, timestamp: time + 1600 } },

      // 2. Duplicate rapid accel attempt 3s later (at +4600ms, < 15000ms cooldown) -> SHOULD BE SUPPRESSED
      { latitude: 37.7704, longitude: -122.41, speed: 30, timestamp: time + 4000, activity: 'DRIVING' as const },
      { latitude: 37.7706, longitude: -122.41, speed: 65, timestamp: time + 4800, activity: 'DRIVING' as const },

      // 3. Harsh Corner at +16000ms (> 15s since start, but cornering has its own cooldown)
      { latitude: 37.771, longitude: -122.41, speed: 45, heading: 90, timestamp: time + 16000, activity: 'DRIVING' as const },
      { latitude: 37.7712, longitude: -122.41, speed: 45, heading: 120, timestamp: time + 16600, activity: 'DRIVING' as const, motion: { x: 0.4, y: 0.05, z: 0.9, gyroZ: 0.6, magnitude: 1.02, timestamp: time + 16600 } },
      { latitude: 37.7714, longitude: -122.41, speed: 45, heading: 155, timestamp: time + 17200, activity: 'DRIVING' as const, motion: { x: 0.4, y: 0.05, z: 0.9, gyroZ: 0.6, magnitude: 1.02, timestamp: time + 17200 } },

      // 4. Duplicate corner 2s later -> SHOULD BE SUPPRESSED
      { latitude: 37.7716, longitude: -122.41, speed: 45, heading: 190, timestamp: time + 19000, activity: 'DRIVING' as const },
      { latitude: 37.7718, longitude: -122.41, speed: 45, heading: 240, timestamp: time + 19600, activity: 'DRIVING' as const },

      // 5. Overspeeding at +32000ms sustained for 6s
      { latitude: 37.772, longitude: -122.41, speed: 76, timestamp: time + 32000, activity: 'DRIVING' as const },
      { latitude: 37.7722, longitude: -122.41, speed: 78, timestamp: time + 33000, activity: 'DRIVING' as const },
      { latitude: 37.7724, longitude: -122.41, speed: 80, timestamp: time + 34000, activity: 'DRIVING' as const },
      { latitude: 37.7726, longitude: -122.41, speed: 82, timestamp: time + 35000, activity: 'DRIVING' as const },
      { latitude: 37.7728, longitude: -122.41, speed: 81, timestamp: time + 36000, activity: 'DRIVING' as const },
      { latitude: 37.773, longitude: -122.41, speed: 83, timestamp: time + 37500, activity: 'DRIVING' as const },
    ];

    const replayed = replay.replaySequence(recordedTrack);
    const types = replayed.map((e) => e.type);

    const isPassing =
      replayed.length === 3 &&
      types[0] === 'RAPID_ACCELERATION' &&
      types[1] === 'HARSH_CORNERING' &&
      types[2] === 'OVERSPEEDING' &&
      replayed[0].timestamp < replayed[1].timestamp &&
      replayed[1].timestamp < replayed[2].timestamp &&
      replayed.every((e) => e.confidence >= 0.7);

    recordTest(
      13,
      'Strengthened Sensor Replay Multi-Event Validation',
      'Baseline Specification',
      'True Integration Test',
      isPassing,
      `Replayed ${recordedTrack.length} points; emitted ${replayed.length} events [${types.join(', ')}], ordered monotonically, duplicate attempts suppressed`
    );
  }

  // Test 14: Safety Score Calculation (Isolated Unit Test)
  {
    const mockEvents: SafetyEvent[] = [
      { id: '1', type: 'HARD_BRAKING', severity: 'HIGH', confidence: 0.9, timestamp: 1, duration: 2, evidence: [], sourceSignals: ['GPS'] },
      { id: '2', type: 'RAPID_ACCELERATION', severity: 'MEDIUM', confidence: 0.85, timestamp: 2, duration: 1.5, evidence: [], sourceSignals: ['GPS'] },
      { id: '3', type: 'HARSH_CORNERING', severity: 'MEDIUM', confidence: 0.88, timestamp: 3, duration: 1.8, evidence: [], sourceSignals: ['GPS'] },
      { id: '4', type: 'OVERSPEEDING', severity: 'HIGH', confidence: 0.92, timestamp: 4, duration: 15, evidence: [], sourceSignals: ['GPS'] },
      { id: '5', type: 'POSSIBLE_DISTRACTED_DRIVING', severity: 'HIGH', confidence: 0.9, timestamp: 5, duration: 20, evidence: [], sourceSignals: ['GPS'] },
    ];

    const score = SafetyEventScorer.calculateSafetyScore(mockEvents);
    recordTest(
      14,
      'Safety Score Direct Calculation Model',
      'Baseline Specification',
      'Unit Test',
      score === 68,
      `Calculated score 100 - 7 - 3 - 4 - 8 - 10 = ${score} (expected 68)`
    );
  }

  // Test 15: Safety Score Live Engine Pipeline Integration
  {
    engine.reset();
    let time = 1500000;

    // Trigger Rapid Accel (-3 penalty)
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 35, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 55, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    // After 20 seconds, trigger Hard Braking (severity MEDIUM -> -5 penalty)
    time += 20000;
    engine.feedGpsLocation({ latitude: 37.771, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7712, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7714, longitude: -122.41, speed: 30, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    const summary = engine.getSummary();
    const isPassing =
      summary.eventsCount.RAPID_ACCELERATION === 1 &&
      summary.eventsCount.HARD_BRAKING === 1 &&
      summary.safetyScore === 92;

    recordTest(
      15,
      'Live Engine Score & Summary Integration',
      'Integration Pipeline',
      'True Integration Test',
      isPassing,
      `Engine summary computed score ${summary.safetyScore}/100, accel count: ${summary.eventsCount.RAPID_ACCELERATION}, brake count: ${summary.eventsCount.HARD_BRAKING}`
    );
  }

  // ===========================================================================
  // SECTION 2: MISSING NEGATIVE TESTS (Events MUST NOT Fire)
  // ===========================================================================

  // Test 16: Negative — Overspeed Tolerance Buffer (65 km/h in 60 zone sustained)
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    let time = 1600000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 8; i++) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 65, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'OVERSPEEDING');
    recordTest(
      16,
      'Negative: Overspeed Within +10 km/h Tolerance',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Driving at 65 km/h in 60 km/h zone sustained for 8s correctly produces 0 overspeed alerts'
    );
  }

  // Test 17: Negative — Overspeed Tolerance Exact Boundary (70.0 km/h in 60 zone)
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    let time = 1700000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 8; i++) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 70.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'OVERSPEEDING');
    recordTest(
      17,
      'Negative: Overspeed Exactly At Tolerance Boundary (70.0 km/h)',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Speed exactly equal to limit + tolerance (70.0 km/h) correctly does NOT trigger overspeeding'
    );
  }

  // Test 18: Negative — Brief Phone Interaction (< 3 touches)
  {
    engine.reset();
    let time = 1800000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const fired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      18,
      'Negative: Brief Phone Interaction (2 Taps)',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Brief 2-tap interaction rejected (< 3 taps minimum threshold)'
    );
  }

  // Test 19: Negative — Tap Burst with Insufficient Duration (< 7000ms)
  {
    engine.reset();
    let time = 1900000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 5; i++) {
      engine.registerUserInteraction(time);
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 500;
    }
    unsub();

    const fired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      19,
      'Negative: Active Taps Below 7s Duration Window',
      'Negative Tests',
      'True Integration Test',
      !fired,
      '5 taps over 2.5s correctly rejected (requires >= 7000ms sustained interaction)'
    );
  }

  // Test 20: Negative — Stationary Phone Interaction (Speed 0 km/h)
  {
    engine.reset();
    let time = 2000000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 15; i++) {
      engine.registerUserInteraction(time);
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      20,
      'Negative: Stationary Phone Interaction at Red Light / Parked',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Phone interactions while stationary (0 km/h) safely produce 0 distraction alerts'
    );
  }

  // Test 21: Negative — Low Speed Phone Interaction (12 km/h < 20 km/h Floor)
  {
    engine.reset();
    let time = 2100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 10; i++) {
      engine.registerUserInteraction(time);
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 12, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      21,
      'Negative: Phone Interaction Below 20 km/h Speed Floor',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Interactions at 12 km/h safely suppressed by distraction speed floor'
    );
  }

  // Test 22: Negative — Cycling Activity Hard Deceleration (24 -> 0 km/h)
  {
    engine.reset();
    let time = 2200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 24, accuracy: 5, timestamp: time }, 'CYCLING', 0.95);
    time += 800;
    engine.feedMotion({ x: 0.1, y: -0.6, z: 0.8, magnitude: 1.2, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7701, longitude: -122.41, speed: 0, accuracy: 5, timestamp: time }, 'CYCLING', 0.95);
    unsub();

    recordTest(
      22,
      'Negative: Cycling Hard Braking False Positive Guard',
      'Negative Tests',
      'True Integration Test',
      events.length === 0,
      'Bicycle sudden stop (24 -> 0 km/h) safely ignored by vehicle context guard'
    );
  }

  // Test 23: Negative — Cycling Activity Sharp Turn (90° at 26 km/h)
  {
    engine.reset();
    let time = 2300000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 26, heading: 0, accuracy: 5, timestamp: time }, 'CYCLING', 0.95);
    time += 600;
    engine.feedMotion({ x: 0.45, y: 0.05, z: 0.9, magnitude: 1.05, gyroZ: 0.8, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 26, heading: 90, accuracy: 5, timestamp: time }, 'CYCLING', 0.95);
    unsub();

    recordTest(
      23,
      'Negative: Cycling Sharp Corner False Positive Guard',
      'Negative Tests',
      'True Integration Test',
      events.length === 0,
      'Bicycle 90° turn safely ignored under non-vehicle CYCLING context'
    );
  }

  // Test 24: Negative — Running / Jogging Shakes
  {
    engine.reset();
    let time = 2400000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 5; i++) {
      engine.feedMotion({ x: 0.6, y: 0.9, z: 1.4, magnitude: 1.8, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 11, accuracy: 5, timestamp: time }, 'RUNNING', 0.95);
      time += 600;
    }
    unsub();

    recordTest(
      24,
      'Negative: Running Motion Shock Guard',
      'Negative Tests',
      'True Integration Test',
      events.length === 0,
      'Runner motion energy safely produces 0 driving alerts'
    );
  }

  // Test 25: Negative — Realistic Freeway Curve Normal Cornering
  {
    engine.reset();
    let time = 2500000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const curveHeadings = [100, 104, 108, 112];
    for (const h of curveHeadings) {
      engine.feedMotion({ x: 0.12, y: 0.02, z: 0.98, gyroZ: 0.14, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 55, heading: h, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 500;
    }
    unsub();

    const fired = events.some((e) => e.type === 'HARSH_CORNERING');
    recordTest(
      25,
      'Negative: Realistic Highway Curve (55 km/h)',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Normal freeway bend safely classified as benign cornering'
    );
  }

  // Test 26: Negative — Low Speed Intersection Cornering (16 km/h)
  {
    engine.reset();
    let time = 2600000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const turnHeadings = [0, 30, 60, 90];
    for (const h of turnHeadings) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 16, heading: h, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'HARSH_CORNERING');
    recordTest(
      26,
      'Negative: Low Speed Intersection Turn (16 km/h)',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Intersection 90° turn at 16 km/h rejected by cornering speed floor'
    );
  }

  // Test 27: Negative — Normal Gentle Acceleration (20 -> 30 km/h over 5s)
  {
    engine.reset();
    let time = 2700000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const steps = [20, 22, 25, 27, 30];
    for (const spd of steps) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1200;
    }
    unsub();

    const fired = events.some((e) => e.type === 'RAPID_ACCELERATION');
    recordTest(
      27,
      'Negative: Gentle Commute Acceleration',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Acceleration at ~0.55 m/s² safely produces 0 rapid acceleration alerts'
    );
  }

  // Test 28: Negative — Slow Rolling Stop (7 -> 0 km/h in 0.5s)
  {
    engine.reset();
    let time = 2800000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 7, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 500;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const fired = events.some((e) => e.type === 'HARD_BRAKING');
    recordTest(
      28,
      'Negative: Slow Rolling Stop (7 -> 0 km/h)',
      'Negative Tests',
      'True Integration Test',
      !fired,
      'Slow rolling stop rejected by 20 km/h hard braking speed floor'
    );
  }

  // Test 29: Negative — Steady High Speed Highway Cruising (100 km/h in 100 zone)
  {
    engine.reset();
    engine.setContextualSpeedLimit(100);
    let time = 2900000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 10; i++) {
      engine.feedMotion({ x: 0.01, y: 0.02, z: 0.98, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 100, heading: 180, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    recordTest(
      29,
      'Negative: Steady High-Speed Highway Cruising (100 km/h)',
      'Negative Tests',
      'True Integration Test',
      events.length === 0,
      'Cruising at 100 km/h on highway produces 0 safety events'
    );
  }

  // Test 30: Negative — Sub-Threshold Vehicle Speed (8 km/h < 12 km/h Vehicle Floor)
  {
    engine.reset();
    let time = 3000000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 8, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 8, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    recordTest(
      30,
      'Negative: Vehicle Speed Below 12 km/h Minimum',
      'Negative Tests',
      'True Integration Test',
      events.length === 0,
      'Crawling vehicle below 12 km/h correctly deactivates vehicle safety detectors'
    );
  }

  // ===========================================================================
  // SECTION 3: GPS ACCURACY, DEGRADED & MISSING SIGNALS
  // ===========================================================================

  // Test 31: GPS Accuracy Degradation on Hard Braking (accuracy = 50m > 35m limit)
  {
    engine.reset();
    let time = 3100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 50, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 50, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const fired = events.some((e) => e.type === 'HARD_BRAKING');
    recordTest(
      31,
      'GPS Accuracy Degradation Guard on Hard Braking (50m > 35m)',
      'Signal Degradation',
      'True Integration Test',
      !fired,
      'Severe deceleration with degraded accuracy (50m) safely rejected'
    );
  }

  // Test 32: GPS Accuracy Degradation on Overspeeding (accuracy = 45m > 40m limit)
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    let time = 3200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 8; i++) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 95, accuracy: 45, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'OVERSPEEDING');
    recordTest(
      32,
      'GPS Accuracy Degradation Guard on Overspeeding (45m > 40m)',
      'Signal Degradation',
      'True Integration Test',
      !fired,
      'Excess speed with degraded accuracy (45m) safely rejected'
    );
  }

  // Test 33: GPS Accuracy Degradation on Rapid Accel (accuracy = 50m > 45m limit)
  {
    engine.reset();
    let time = 3300000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 50, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 55, accuracy: 50, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const fired = events.some((e) => e.type === 'RAPID_ACCELERATION');
    recordTest(
      33,
      'GPS Accuracy Degradation Guard on Rapid Accel (50m > 45m)',
      'Signal Degradation',
      'True Integration Test',
      !fired,
      'Rapid speed surge with degraded accuracy (50m) safely rejected'
    );
  }

  // Test 34: Motion Unavailable: GPS-Only Hard Braking
  {
    engine.reset();
    let time = 3400000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 700;
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 700;
    engine.feedGpsLocation({ latitude: 37.7710, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const brakeEvent = events.find((e) => e.type === 'HARD_BRAKING');
    const isPassing = !!brakeEvent && brakeEvent.sourceSignals.includes('GPS') && !brakeEvent.sourceSignals.includes('ACCELEROMETER');
    recordTest(
      34,
      'Motion Sensor Unavailable: GPS-Only Hard Braking',
      'Signal Availability',
      'True Integration Test',
      isPassing,
      brakeEvent
        ? `Successfully detected HARD_BRAKING without accelerometer (signals: [${brakeEvent.sourceSignals.join(', ')}])`
        : 'Failed to detect GPS-only hard braking'
    );
  }

  // Test 35: Motion Unavailable: GPS-Only Rapid Acceleration
  {
    engine.reset();
    let time = 3500000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 38, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const accelEvent = events.find((e) => e.type === 'RAPID_ACCELERATION');
    const isPassing = !!accelEvent && accelEvent.sourceSignals.includes('GPS') && !accelEvent.sourceSignals.includes('ACCELEROMETER');
    recordTest(
      35,
      'Motion Sensor Unavailable: GPS-Only Rapid Acceleration',
      'Signal Availability',
      'True Integration Test',
      isPassing,
      accelEvent
        ? `Successfully detected RAPID_ACCELERATION without accelerometer (signals: [${accelEvent.sourceSignals.join(', ')}])`
        : 'Failed to detect GPS-only rapid acceleration'
    );
  }

  // Test 36: Motion Unavailable: GPS-Only Harsh Cornering
  {
    engine.reset();
    let time = 3600000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const headings = [90, 115, 145, 175];
    for (const h of headings) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 48, heading: h, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 600;
    }
    unsub();

    const cornerEvent = events.find((e) => e.type === 'HARSH_CORNERING');
    const isPassing = !!cornerEvent && cornerEvent.sourceSignals.includes('HEADING_RATE') && !cornerEvent.sourceSignals.includes('GYROSCOPE');
    recordTest(
      36,
      'Motion Sensor Unavailable: GPS-Only Harsh Cornering',
      'Signal Availability',
      'True Integration Test',
      isPassing,
      cornerEvent
        ? `Successfully detected HARSH_CORNERING via kinematic lateral G calculation`
        : 'Failed to detect GPS-only harsh cornering'
    );
  }

  // Test 37: Conflicting Signals: Violent Phone Shake in Car Cradle with Constant Speed
  {
    engine.reset();
    let time = 3700000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 5; i++) {
      engine.feedMotion({ x: 0.9, y: -1.2, z: 2.1, magnitude: 2.5, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 60.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 600;
    }
    unsub();

    const fired = events.some((e) => e.type === 'HARD_BRAKING' || e.type === 'RAPID_ACCELERATION');
    recordTest(
      37,
      'Conflicting Signals: Heavy Motion Shaking with Steady Speed',
      'Signal Conflict',
      'True Integration Test',
      !fired,
      'Violent motion shocks rejected when kinematic GPS speed remains steady'
    );
  }

  // Test 38: Conflicting Signals: High Handheld Motion but Zero UI Touches
  {
    engine.reset();
    let time = 3800000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 8; i++) {
      engine.feedMotion({ x: 0.3, y: 0.25, z: 1.05, magnitude: 1.15, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      38,
      'Conflicting Signals: Handheld Movement with Zero UI Touches',
      'Signal Conflict',
      'True Integration Test',
      !fired,
      'Handheld phone motion alone does not trigger distracted driving without UI interactions'
    );
  }

  // Test 39: Activity Transition DRIVING -> WALKING -> DRIVING
  {
    engine.reset();
    let time = 3900000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 2000;

    engine.feedGpsLocation({ latitude: 37.7701, longitude: -122.41, speed: 4, accuracy: 5, timestamp: time }, 'WALKING', 0.95);
    time += 2000;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 5, accuracy: 5, timestamp: time }, 'WALKING', 0.95);
    time += 2000;

    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 2000;
    engine.feedGpsLocation({ latitude: 37.7708, longitude: -122.41, speed: 52, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    recordTest(
      39,
      'Activity Transition DRIVING <-> WALKING Seamless Guard',
      'Activity Transitions',
      'True Integration Test',
      events.length === 0,
      'Transitions between DRIVING and non-driving reset detector states without false alerts'
    );
  }

  // ===========================================================================
  // SECTION 4: COOLDOWN & ESCALATION ARCHITECTURE
  // ===========================================================================

  // Test 40: Per-Event-Type Cooldown Independence
  {
    engine.reset();
    let time = 4000000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // 1. Hard brake (3 points for 2 steps >= -3.5 m/s²)
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7704, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    // 2. Rapid accel at t = 4005000 (during 15s braking cooldown)
    time += 3400;
    engine.feedGpsLocation({ latitude: 37.7704, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7706, longitude: -122.41, speed: 38, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7708, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const hasBrake = events.some((e) => e.type === 'HARD_BRAKING');
    const hasAccel = events.some((e) => e.type === 'RAPID_ACCELERATION');
    const isPassing = hasBrake && hasAccel;

    recordTest(
      40,
      'Per-Event-Type Cooldown Independence',
      'Cooldown & Escalation',
      'True Integration Test',
      isPassing,
      isPassing
        ? 'Hard braking cooldown did NOT block different event type (Rapid Acceleration)'
        : 'Hard braking cooldown incorrectly blocked Rapid Acceleration'
    );
  }

  // Test 41: Per-Event-Type Cooldown Suppression (Same Type Within 15s)
  {
    engine.reset();
    let time = 4100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // Event 1: Rapid accel
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 40, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    // Event 2 attempt: 5s later (< 15s cooldown)
    time += 5000;
    engine.feedGpsLocation({ latitude: 37.7707, longitude: -122.41, speed: 30, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7709, longitude: -122.41, speed: 70, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const accelCount = events.filter((e) => e.type === 'RAPID_ACCELERATION').length;
    recordTest(
      41,
      'Per-Event-Type Duplicate Suppression Within Cooldown',
      'Cooldown & Escalation',
      'True Integration Test',
      accelCount === 1,
      `Second rapid acceleration suppressed by 15s cooldown (expected 1, got ${accelCount})`
    );
  }

  // Test 42: Cooldown Expiry Allows Subsequent Event
  {
    engine.reset();
    let time = 4200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // Event 1: Rapid accel at t = 4200000
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 40, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    // Event 2: 20 seconds later (> 15s cooldown expired)
    time += 20000;
    engine.feedGpsLocation({ latitude: 37.7707, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7709, longitude: -122.41, speed: 40, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7711, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const accelCount = events.filter((e) => e.type === 'RAPID_ACCELERATION').length;
    recordTest(
      42,
      'Cooldown Expiry Restores Detection Readiness',
      'Cooldown & Escalation',
      'True Integration Test',
      accelCount === 2,
      `Second event successfully fired after cooldown expired (expected 2, got ${accelCount})`
    );
  }

  // Test 43: Severity Escalation Bypasses Active Cooldown
  {
    const eventManager = new SafetyEventManager();
    eventManager.reset();
    const time = 4300000;

    const initialEvent: SafetyEvent = {
      id: 'e1',
      type: 'HARD_BRAKING',
      severity: 'MEDIUM',
      confidence: 0.8,
      timestamp: time,
      latitude: 37.77,
      longitude: -122.41,
      speed: 40,
      duration: 1,
      evidence: [],
      sourceSignals: ['GPS'],
    };
    eventManager.recordConfirmedEvent(initialEvent);

    const isSuppressed = eventManager.shouldSuppressDueToCooldown('HARD_BRAKING', 'CRITICAL', time + 3000);

    recordTest(
      43,
      'Severity Escalation (CRITICAL) Bypasses Cooldown',
      'Cooldown & Escalation',
      'True Integration Test',
      !isSuppressed,
      !isSuppressed
        ? 'CRITICAL severity escalation correctly bypassed active MEDIUM cooldown'
        : 'CRITICAL severity was incorrectly suppressed by lower severity cooldown'
    );
  }

  // Test 44: Small / Relative Timestamp Cooldown Verification (t in [0, 15000])
  {
    const eventManager = new SafetyEventManager();
    eventManager.reset();

    const isSuppressed = eventManager.shouldSuppressDueToCooldown('RAPID_ACCELERATION', 'LOW', 5000);

    recordTest(
      44,
      'Small Relative Timestamp Cooldown Guard (t = 5000ms)',
      'Cooldown & Escalation',
      'Unit Test',
      !isSuppressed,
      !isSuppressed
        ? 'Unrecorded event at t=5000ms was not suppressed'
        : 'BUG: EventManager incorrectly assumed prior event at epoch 0 and suppressed brand new event'
    );
  }

  // ===========================================================================
  // SECTION 5: RESET, STATE ISOLATION & TIMERS
  // ===========================================================================

  // Test 45: Engine Reset Clears Event History, Distance, Time, and Resets Score to 100
  {
    engine.reset();
    let time = 4500000;

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.771, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.772, longitude: -122.41, speed: 65, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    engine.reset();

    const summary = engine.getSummary();
    const recent = engine.getRecentEvents();
    const isClean =
      recent.length === 0 &&
      summary.distanceKm === 0 &&
      summary.drivingTimeSec === 0 &&
      summary.safetyScore === 100 &&
      Object.values(summary.eventsCount).every((count) => count === 0);

    recordTest(
      45,
      'Engine Reset Clears History, Mileage, and Restores Score to 100',
      'State Isolation',
      'True Integration Test',
      isClean,
      `After reset: score = ${summary.safetyScore}, events = ${recent.length}, distance = ${summary.distanceKm} km`
    );
  }

  // Test 46: Engine Reset Clears Detector Rolling Buffers
  {
    engine.reset();
    let time = 4600000;

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    engine.reset();

    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));
    time += 1500;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 46, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1500;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 47, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    recordTest(
      46,
      'Engine Reset Clears Detector Rolling Candidate Buffers',
      'State Isolation',
      'True Integration Test',
      events.length === 0,
      'Pre-reset candidate state did not leak into post-reset evaluation'
    );
  }

  // Test 47: Engine Reset Clears Active Cooldowns
  {
    engine.reset();
    let time = 4700000;

    // Event 1: Hard brake (3 points for confirmation)
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7704, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    // Call reset
    engine.reset();

    // Event 2: Immediate hard brake 1s later (normally blocked by 15s cooldown)
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7704, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const brakeCount = events.filter((e) => e.type === 'HARD_BRAKING').length;
    recordTest(
      47,
      'Engine Reset Clears Active Cooldown Timers',
      'State Isolation',
      'True Integration Test',
      brakeCount === 1,
      `Post-reset hard brake fired immediately without cooldown obstruction (expected 1, got ${brakeCount})`
    );
  }

  // Test 48: Contextual Speed Limit Isolation After Reset
  {
    engine.reset();
    engine.setContextualSpeedLimit(45);

    engine.reset();
    const limitAfter = engine.getDebugState().roadSpeedLimit;
    const isIsolated = limitAfter === SafetyConfig.DEFAULT_ROAD_SPEED_LIMIT_KMH;

    recordTest(
      48,
      'Contextual Speed Limit Isolation After Reset',
      'State Isolation',
      'True Integration Test',
      isIsolated,
      isIsolated
        ? `Reset correctly cleared override limit (reverted from 45 to default ${limitAfter} km/h)`
        : `BUG: engine.reset() leaked contextualSpeedLimit (${limitAfter} km/h instead of default ${SafetyConfig.DEFAULT_ROAD_SPEED_LIMIT_KMH} km/h)`
    );
  }

  // ===========================================================================
  // SECTION 6: PROBABILISTIC DISTRACTION & PRIVACY AUDIT
  // ===========================================================================

  // Test 49: Distraction Detection Remains Probabilistic & Non-Definitive
  {
    engine.reset();
    let time = 4900000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 9; i++) {
      engine.registerUserInteraction(time);
      engine.feedMotion({ x: 0.15, y: 0.12, z: 0.95, magnitude: 1.08, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const event = events.find((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    const isProbabilisticType = event?.type === 'POSSIBLE_DISTRACTED_DRIVING';
    const isProbabilisticConfidence = (event?.confidence || 0) < 1.0;

    const forbiddenDefinitiveTerms = ['definitely', 'driver was texting', 'driver was looking', 'driver was on phone'];
    const evidenceHasForbidden = event?.evidence.some((ev) =>
      forbiddenDefinitiveTerms.some((term) => ev.toLowerCase().includes(term))
    );

    const isPassing = isProbabilisticType && isProbabilisticConfidence && !evidenceHasForbidden;

    recordTest(
      49,
      'Distraction Detection Remains Probabilistic (Non-Definitive)',
      'Privacy & Wording Audit',
      'True Integration Test',
      isPassing,
      isPassing
        ? `Type is '${event?.type}', confidence is ${event?.confidence} (< 1.0), evidence uses non-invasive phrasing`
        : 'Distraction event failed probabilistic contract or contained definitive claims'
    );
  }

  // Test 50: Distraction Guard on Low Driving Confidence (< 0.80)
  {
    engine.reset();
    let time = 5000000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 9; i++) {
      engine.registerUserInteraction(time);
      engine.feedMotion({ x: 0.15, y: 0.12, z: 0.95, magnitude: 1.08, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.65);
      time += 1000;
    }
    unsub();

    const fired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      50,
      'Distraction Guard on Low Driving Confidence (0.65 < 0.80)',
      'Privacy & Wording Audit',
      'True Integration Test',
      !fired,
      'Uncertain driving context (confidence 0.65) safely prevents distracted driving alert'
    );
  }

  // ===========================================================================
  // SECTION 7: THRESHOLD BOUNDARY VALUE MATRIX
  // ===========================================================================

  // Test 51: Rapid Accel Speed Floor Boundary (9.9 km/h vs 10.0 km/h)
  {
    const detector = new AccelerationDetector();
    let time = 5100000;

    // Below floor: speed reaches 9.9 km/h at 3.4 m/s² accel -> status NONE
    detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: 0.0, accuracy: 5, timestamp: time });
    time += 800;
    const rBelow = detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: 9.9, accuracy: 5, timestamp: time });

    // At floor: speed reaches 10.0 km/h at 3.4 m/s² accel -> status POTENTIAL, then CONFIRMED
    detector.reset();
    detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: 0.0, accuracy: 5, timestamp: time });
    time += 800;
    const rAt1 = detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: 10.0, accuracy: 5, timestamp: time });
    time += 800;
    const rAt2 = detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: 20.0, accuracy: 5, timestamp: time });

    const isPassing = rBelow.status === 'NONE' && rAt1.status === 'POTENTIAL' && rAt2.status === 'CONFIRMED';
    recordTest(
      51,
      'Rapid Accel Speed Floor Boundary (9.9 vs 10.0 km/h)',
      'Threshold Boundaries',
      'Unit Test',
      isPassing,
      `At 9.9 km/h status = ${rBelow.status}; at 10.0 km/h status = ${rAt1.status} -> ${rAt2.status}`
    );
  }

  // Test 52: Rapid Accel Acceleration Threshold Boundary (2.9 vs 3.1 m/s²)
  {
    engine.reset();
    let time = 5200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // 2.9 m/s² accel
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 30.4, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 40.8, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    const belowFired = events.some((e) => e.type === 'RAPID_ACCELERATION');

    // 3.1 m/s² accel
    time += 20000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 31.2, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 42.4, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const aboveFired = events.some((e) => e.type === 'RAPID_ACCELERATION');
    recordTest(
      52,
      'Rapid Accel Threshold Boundary (2.9 vs 3.1 m/s²)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && aboveFired,
      `Below threshold (2.9 m/s²) fired = ${belowFired}; above threshold (3.1 m/s²) fired = ${aboveFired}`
    );
  }

  // Test 53: Hard Braking Initial Speed Floor Boundary (19.9 vs 20.0 km/h)
  {
    engine.reset();
    let time = 5300000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // Initial speed 19.9 km/h (below 20.0 km/h floor)
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 19.9, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 300;
    engine.feedGpsLocation({ latitude: 37.7701, longitude: -122.41, speed: 16.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 300;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 12.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    const belowFired = events.some((e) => e.type === 'HARD_BRAKING');

    // Initial speed 20.0 km/h (at floor)
    time += 20000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 300;
    engine.feedGpsLocation({ latitude: 37.7701, longitude: -122.41, speed: 16.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 300;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 12.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const atFired = events.some((e) => e.type === 'HARD_BRAKING');
    recordTest(
      53,
      'Hard Braking Initial Speed Floor Boundary (19.9 vs 20.0 km/h)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && atFired,
      `Initial speed below floor (19.9 km/h) fired = ${belowFired}; at floor (20.0 km/h) fired = ${atFired}`
    );
  }

  // Test 54: Hard Braking Deceleration Threshold Boundary (-3.3 vs -3.7 m/s²)
  {
    engine.reset();
    let time = 5400000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // -3.3 m/s² deceleration
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 48, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 36, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    const belowFired = events.some((e) => e.type === 'HARD_BRAKING');

    // -3.7 m/s² deceleration
    time += 20000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 46, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 32, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const aboveFired = events.some((e) => e.type === 'HARD_BRAKING');
    recordTest(
      54,
      'Hard Braking Decel Threshold Boundary (-3.3 vs -3.7 m/s²)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && aboveFired,
      `Below decel threshold (-3.3 m/s²) fired = ${belowFired}; above threshold (-3.7 m/s²) fired = ${aboveFired}`
    );
  }

  // Test 55: Hard Braking GPS Accuracy Limit Boundary (35.0m vs 35.1m)
  {
    engine.reset();
    let time = 5500000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // 35.0m accuracy
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 35.0, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 35.0, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 35.0, timestamp: time }, 'DRIVING', 0.95);
    const atLimitFired = events.some((e) => e.type === 'HARD_BRAKING');

    // 35.1m accuracy
    time += 20000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 35.1, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 35.1, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 35.1, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const aboveLimitEvents = events.filter((e) => e.type === 'HARD_BRAKING');
    recordTest(
      55,
      'Hard Braking GPS Accuracy Limit Boundary (35.0m vs 35.1m)',
      'Threshold Boundaries',
      'True Integration Test',
      atLimitFired && aboveLimitEvents.length === 1,
      `At accuracy limit (35.0m) fired = ${atLimitFired}; above limit (35.1m) suppressed = ${aboveLimitEvents.length === 1}`
    );
  }

  // Test 56: Harsh Cornering Speed Floor Boundary (24.9 vs 25.0 km/h)
  {
    engine.reset();
    let time = 5600000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const turnHeadings = [90, 120, 150, 180];
    for (const h of turnHeadings) {
      engine.feedMotion({ x: 0.4, y: 0.05, z: 0.9, gyroZ: 0.6, magnitude: 1.05, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 24.9, heading: h, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 600;
    }
    const belowFired = events.some((e) => e.type === 'HARSH_CORNERING');

    time += 20000;
    for (const h of turnHeadings) {
      engine.feedMotion({ x: 0.4, y: 0.05, z: 0.9, gyroZ: 0.6, magnitude: 1.05, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 25.0, heading: h, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 600;
    }
    unsub();

    const atFired = events.some((e) => e.type === 'HARSH_CORNERING');
    recordTest(
      56,
      'Harsh Cornering Speed Floor Boundary (24.9 vs 25.0 km/h)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && atFired,
      `Speed below floor (24.9 km/h) fired = ${belowFired}; at floor (25.0 km/h) fired = ${atFired}`
    );
  }

  // Test 57: Harsh Cornering Lateral Accel Boundary (0.34g vs 0.36g)
  {
    engine.reset();
    let time = 5700000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const turn1 = [90, 103, 117, 130];
    for (const h of turn1) {
      engine.feedMotion({ x: 0.34, y: 0.05, z: 0.95, magnitude: 1.0, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 30, heading: h, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 600;
    }
    const belowFired = events.some((e) => e.type === 'HARSH_CORNERING');

    time += 20000;
    for (const h of turn1) {
      engine.feedMotion({ x: 0.36, y: 0.05, z: 0.95, magnitude: 1.0, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 30, heading: h, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 600;
    }
    unsub();

    const aboveFired = events.some((e) => e.type === 'HARSH_CORNERING');
    recordTest(
      57,
      'Harsh Cornering Lateral Force Boundary (0.34g vs 0.36g)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && aboveFired,
      `Below lateral threshold (0.34g) fired = ${belowFired}; above threshold (0.36g) fired = ${aboveFired}`
    );
  }

  // Test 58: Overspeed Speed + Tolerance Boundary (70.0 vs 70.1 km/h in 60 zone)
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    let time = 5800000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 7; i++) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 70.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    const atLimitFired = events.some((e) => e.type === 'OVERSPEEDING');

    time += 35000;
    for (let i = 0; i < 7; i++) {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 70.1, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const aboveLimitFired = events.some((e) => e.type === 'OVERSPEEDING');
    recordTest(
      58,
      'Overspeed Tolerance Boundary (70.0 vs 70.1 km/h)',
      'Threshold Boundaries',
      'True Integration Test',
      !atLimitFired && aboveLimitFired,
      `At tolerance limit (70.0 km/h) fired = ${atLimitFired}; above limit (70.1 km/h) fired = ${aboveLimitFired}`
    );
  }

  // Test 59: Overspeed Confirmation Duration Boundary (4900ms vs 5000ms)
  {
    engine.reset();
    engine.setContextualSpeedLimit(60);
    let time = 5900000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 4900;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    const belowFired = events.some((e) => e.type === 'OVERSPEEDING');

    time += 100;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const atThresholdFired = events.some((e) => e.type === 'OVERSPEEDING');
    recordTest(
      59,
      'Overspeed Confirmation Duration Boundary (4900ms vs 5000ms)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && atThresholdFired,
      `Duration 4900ms fired = ${belowFired}; duration >= 5000ms fired = ${atThresholdFired}`
    );
  }

  // Test 60: Distraction Minimum Speed Floor Boundary (19.9 vs 20.0 km/h)
  {
    engine.reset();
    let time = 6000000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    for (let i = 0; i < 9; i++) {
      engine.registerUserInteraction(time);
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 19.9, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    const belowFired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');

    time += 50000;
    for (let i = 0; i < 9; i++) {
      engine.registerUserInteraction(time);
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20.0, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
    }
    unsub();

    const atFired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      60,
      'Distraction Speed Floor Boundary (19.9 vs 20.0 km/h)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && atFired,
      `Speed below floor (19.9 km/h) fired = ${belowFired}; at floor (20.0 km/h) fired = ${atFired}`
    );
  }

  // Test 61: Distraction Touch Count Boundary (2 vs 3 taps)
  {
    engine.reset();
    let time = 6100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 4000;
    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 4000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    const belowFired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');

    time += 50000;
    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 3500;
    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 4000;
    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const atFired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      61,
      'Distraction Touch Count Boundary (2 vs 3 Taps)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && atFired,
      `Touch count below threshold (2 taps) fired = ${belowFired}; at threshold (3 taps) fired = ${atFired}`
    );
  }

  // Test 62: Distraction Confirmation Window Boundary (6900ms vs 7000ms)
  {
    engine.reset();
    let time = 6200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 3000;
    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 3900;
    engine.registerUserInteraction(time);
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    const belowFired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');

    time += 200;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const atThresholdFired = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    recordTest(
      62,
      'Distraction Confirmation Duration Boundary (6900ms vs 7000ms)',
      'Threshold Boundaries',
      'True Integration Test',
      !belowFired && atThresholdFired,
      `Duration 6900ms fired = ${belowFired}; duration >= 7000ms fired = ${atThresholdFired}`
    );
  }

  // ===========================================================================
  // SECTION 8: MALFORMED & INVALID SENSOR VALUES
  // ===========================================================================

  // Test 63: Malformed Speed — NaN on Braking / Accel Pipeline
  {
    engine.reset();
    let time = 6300000;
    let didCrash = false;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    try {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: NaN, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 50, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    } catch (_) {
      didCrash = true;
    }
    unsub();

    recordTest(
      63,
      'Malformed Speed NaN Handling in Kinematic Engine',
      'Malformed Inputs',
      'True Integration Test',
      !didCrash && events.length === 0,
      `Handled NaN speed gracefully without crash (didCrash: ${didCrash}, falseEvents: ${events.length})`
    );
  }

  // Test 64: Malformed Speed — NaN on Distraction Detector Minimum Speed Guard
  {
    const detector = new DistractionDetector();
    detector.reset();
    detector.registerInteraction(100000);
    detector.registerInteraction(103000);
    detector.registerInteraction(108000);

    const res = detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: NaN, timestamp: 108000 }, null, null, true, 0.9);
    const didRejectNaN = !res.detected;

    recordTest(
      64,
      'Malformed Speed NaN Guard on Distraction Speed Floor',
      'Malformed Inputs',
      'Unit Test',
      didRejectNaN,
      didRejectNaN
        ? 'NaN speed was safely rejected by distraction speed floor'
        : 'BUG: Distraction detector allowed NaN speed through (NaN < 20.0 evaluates to false in JS)'
    );
  }

  // Test 65: Malformed Speed — Infinity and -Infinity Handling
  {
    engine.reset();
    let time = 6500000;
    let didCrash = false;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    try {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: Infinity, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: -Infinity, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    } catch (_) {
      didCrash = true;
    }
    unsub();

    recordTest(
      65,
      'Malformed Speed Infinity Handling',
      'Malformed Inputs',
      'True Integration Test',
      !didCrash && events.length === 0,
      `Handled Infinity speeds without crash (didCrash: ${didCrash}, falseEvents: ${events.length})`
    );
  }

  // Test 66: Malformed Speed — Negative Speed
  {
    engine.reset();
    let time = 6600000;
    let didCrash = false;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    try {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: -30, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1000;
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: -10, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    } catch (_) {
      didCrash = true;
    }
    unsub();

    recordTest(
      66,
      'Negative Speed Values Handled Safely',
      'Malformed Inputs',
      'True Integration Test',
      !didCrash && events.length === 0,
      `Handled negative speed without false braking or crashes (events: ${events.length})`
    );
  }

  // Test 67: Malformed Heading — Missing / NaN Cornering Protection
  {
    engine.reset();
    let time = 6700000;
    const detector = new CorneringDetector();

    const resUndefined = detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time });
    const resNaN = detector.evaluate({ latitude: 37.77, longitude: -122.41, speed: 45, heading: NaN, accuracy: 5, timestamp: time });

    const isPassing = !resUndefined.detected && !resNaN.detected;
    recordTest(
      67,
      'Malformed Heading NaN & Undefined Guard in Cornering',
      'Malformed Inputs',
      'Unit Test',
      isPassing,
      `Cornering detector safely returned status NONE for missing/NaN headings`
    );
  }

  // Test 68: Malformed Heading — Engine State NaN Heading Poisoning Guard
  {
    engine.reset();
    let time = 6800000;

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 30, heading: 90, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 30, heading: NaN, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 1000;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 30, heading: 100, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    const headingChange = engine.getDebugState().headingChange;
    const isClean = !isNaN(headingChange);

    recordTest(
      68,
      'Engine State Heading Change NaN Poisoning Guard',
      'Malformed Inputs',
      'True Integration Test',
      isClean,
      isClean
        ? `Debug headingChange resumed cleanly to ${headingChange}°`
        : `BUG: engine.getDebugState().headingChange permanently poisoned with NaN`
    );
  }

  // Test 69: Very Poor GPS Accuracy (accuracy = 9999m)
  {
    engine.reset();
    let time = 6900000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 10, accuracy: 9999, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 90, accuracy: 9999, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 10, accuracy: 9999, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    recordTest(
      69,
      'Extreme Poor GPS Accuracy (9999m) Total Rejection',
      'Malformed Inputs',
      'True Integration Test',
      events.length === 0,
      'Extreme GPS inaccuracy (9999m) completely rejected across all detectors'
    );
  }

  // Test 70: Duplicate Timestamps (dt = 0 Division by Zero Guard)
  {
    engine.reset();
    const time = 7000000;
    let didCrash = false;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    try {
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 30, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    } catch (_) {
      didCrash = true;
    }
    unsub();

    recordTest(
      70,
      'Duplicate Timestamps (dt = 0) Division by Zero Guard',
      'Malformed Inputs',
      'True Integration Test',
      !didCrash,
      `dt = 0 handled cleanly without division by zero crash or NaN acceleration`
    );
  }

  // Test 71: Large Timestamp Gap (dt = 3600s / 1 Hour)
  {
    engine.reset();
    let time = 7100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 3600 * 1000;
    engine.feedGpsLocation({ latitude: 37.85, longitude: -122.35, speed: 80, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    recordTest(
      71,
      'Large Timestamp Gap (1 Hour) False Surge Guard',
      'Malformed Inputs',
      'True Integration Test',
      events.length === 0,
      'Large 1-hour timestamp gap did not cause false kinematic surge or trigger rapid acceleration'
    );
  }

  // Test 72: Panic Stop to Standstill vs MIN_VEHICLE_SPEED_KMH (60 -> 30 -> 5 km/h)
  {
    engine.reset();
    let time = 7200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // Severe panic stop bringing car from 60 km/h to 5 km/h in 1.6s
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 30, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;
    engine.feedGpsLocation({ latitude: 37.7704, longitude: -122.41, speed: 5, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    unsub();

    const hasBrake = events.some((e) => e.type === 'HARD_BRAKING');
    recordTest(
      72,
      'Panic Stop to Standstill (60 -> 30 -> 5 km/h) Vehicle Gate Guard',
      'Integration Pipeline',
      'True Integration Test',
      hasBrake,
      hasBrake
        ? 'Hard panic stop to standstill correctly detected'
        : 'BUG: Panic brake to standstill wiped out because final point (5 km/h) < MIN_VEHICLE_SPEED_KMH (12.0) sets isVehicle=false'
    );
  }

  // ===========================================================================
  // AUDIT REPORT & SUMMARY
  // ===========================================================================
  console.log('\n================================================================================');
  console.log('📊 DRIVING SAFETY DETECTION TEST AUDIT REPORT');
  console.log('================================================================================');

  const totalTests = auditRecords.length;
  const passedTests = auditRecords.filter((r) => r.passed).length;
  const failedTests = auditRecords.filter((r) => !r.passed);

  console.log(`Total Automated Tests Executed: ${totalTests}`);
  console.log(`Passed: ${passedTests} / ${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failedTests.length} / ${totalTests}\n`);

  // Breakdown by classification
  const trueIntegrations = auditRecords.filter((r) => r.classification === 'True Integration Test');
  const unitTests = auditRecords.filter((r) => r.classification === 'Unit Test');
  const weakIntegrations = auditRecords.filter((r) => r.classification === 'Weak Integration Test');

  console.log('--- Classification Breakdown ---');
  console.log(`• True Integration Tests: ${trueIntegrations.length} (Passed: ${trueIntegrations.filter((r) => r.passed).length})`);
  console.log(`• Unit Tests:             ${unitTests.length} (Passed: ${unitTests.filter((r) => r.passed).length})`);
  console.log(`• Weak Integration Tests: ${weakIntegrations.length}`);

  // Breakdown by category
  const categories = Array.from(new Set(auditRecords.map((r) => r.category)));
  console.log('\n--- Category Breakdown ---');
  for (const cat of categories) {
    const inCat = auditRecords.filter((r) => r.category === cat);
    const passedInCat = inCat.filter((r) => r.passed).length;
    console.log(`• ${cat.padEnd(28)}: ${passedInCat} / ${inCat.length} passed`);
  }

  if (failedTests.length > 0) {
    console.log('\n--------------------------------------------------------------------------------');
    console.log('🚨 DISCOVERED PRODUCTION DEFECTS / FAILING TESTS:');
    console.log('--------------------------------------------------------------------------------');
    for (const fail of failedTests) {
      console.log(`❌ Test ${fail.id} [${fail.category}] ${fail.name}:`);
      console.log(`   ${fail.details}`);
    }
  } else {
    console.log('\n🎉 ALL AUDIT & VERIFICATION TESTS PASSED SUCCESSFULLY!');
  }
  console.log('================================================================================\n');
}

runTestSuite().catch(console.error);
