/**
 * Automated Verification Test Suite for Driving Safety Detection Engine
 * Validates all 12 test cases specified in Section 27, plus Replay & Scoring tests.
 */

import { SafetyConfig } from '../mobile/src/safety/SafetyConfig';
import { SafetyDetectionEngine } from '../mobile/src/safety/SafetyDetectionEngine';
import { SafetyEventScorer } from '../mobile/src/safety/SafetyEventScorer';
import { SensorReplay } from '../mobile/src/safety/SensorReplay';
import { SafetyEvent } from '../mobile/src/safety/types';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, message: string) {
  if (!condition) {
    results.push({ name: testName, passed: false, details: message });
    console.error(`❌ [FAILED] ${testName}: ${message}`);
  } else {
    results.push({ name: testName, passed: true, details: message });
    console.log(`✅ [PASSED] ${testName}: ${message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🛡️ Running Driving Safety Detection Test Suite (Section 27 & 29)');
  console.log('================================================================\n');

  const engine = new SafetyDetectionEngine();

  // ---------------------------------------------------------------------------
  // TEST 1 — Rapid Acceleration
  // 20 km/h -> 30 -> 45 -> 60 km/h with high acceleration
  // Expected: RAPID_ACCELERATION
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // Initial vehicle cruising point
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;

    // Rapid acceleration surges
    engine.feedMotion({ x: 0.1, y: 0.45, z: 0.95, magnitude: 1.05, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7702, longitude: -122.41, speed: 32, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;

    engine.feedMotion({ x: 0.1, y: 0.5, z: 0.95, magnitude: 1.08, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 46, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 800;

    engine.feedMotion({ x: 0.1, y: 0.52, z: 0.95, magnitude: 1.1, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7709, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    unsub();

    const hasRapidAccel = events.some((e) => e.type === 'RAPID_ACCELERATION');
    assert(
      hasRapidAccel,
      'TEST 1 — Rapid Acceleration',
      `Acceleration exceeds threshold (got ${events.filter((e) => e.type === 'RAPID_ACCELERATION').length} event(s)).`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 2 — Normal Acceleration
  // 20 -> 25 -> 30 -> 35 km/h over normal duration
  // Expected: No event
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const normalSpeeds = [20, 25, 30, 35];
    for (const spd of normalSpeeds) {
      engine.feedMotion({ x: 0.02, y: 0.08, z: 0.98, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1500; // 1.5s step -> dv/dt ~ 0.9 m/s^2 (< 3.0 m/s^2 threshold)
    }

    unsub();
    const hasEvent = events.some((e) => e.type === 'RAPID_ACCELERATION');
    assert(
      !hasEvent,
      'TEST 2 — Normal Acceleration',
      `Normal acceleration (20 -> 35 km/h over 4.5s) correctly produces no safety event.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 3 — Hard Braking
  // 80 -> 65 -> 45 -> 25 -> 10 km/h within short duration
  // Expected: HARD_BRAKING
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 300000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // High initial speed
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 80, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);
    time += 700;

    // Hard braking steps
    engine.feedMotion({ x: 0.05, y: -0.45, z: 0.92, magnitude: 1.05, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7705, longitude: -122.41, speed: 65, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);
    time += 700;

    engine.feedMotion({ x: 0.05, y: -0.55, z: 0.90, magnitude: 1.1, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7708, longitude: -122.41, speed: 45, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);
    time += 700;

    engine.feedMotion({ x: 0.05, y: -0.58, z: 0.88, magnitude: 1.15, timestamp: time });
    engine.feedGpsLocation({ latitude: 37.7710, longitude: -122.41, speed: 20, accuracy: 6, timestamp: time }, 'DRIVING', 0.95);

    unsub();
    const hasHardBraking = events.some((e) => e.type === 'HARD_BRAKING');
    assert(
      hasHardBraking,
      'TEST 3 — Hard Braking',
      `Severe deceleration (80 -> 20 km/h in 2.1s) correctly triggers HARD_BRAKING.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 4 — Normal Braking
  // 50 -> 45 -> 40 -> 35 km/h over gentle steps
  // Expected: No hard-braking event
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 400000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const gentleBrakes = [50, 45, 40, 35];
    for (const spd of gentleBrakes) {
      engine.feedMotion({ x: 0.02, y: -0.05, z: 0.98, magnitude: 0.99, timestamp: time });
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: spd, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 1500; // gentle braking
    }

    unsub();
    const hasHardBrake = events.some((e) => e.type === 'HARD_BRAKING');
    assert(
      !hasHardBrake,
      'TEST 4 — Normal Braking',
      `Normal gentle braking correctly produces no hard-braking event.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 5 — Harsh Cornering
  // High speed (50 km/h) + large heading change (120° -> 140° -> 170° -> 190°) + lateral acceleration
  // Expected: HARSH_CORNERING
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 500000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    const headings = [120, 142, 168, 190];
    for (const h of headings) {
      engine.feedMotion({ x: 0.42, y: 0.05, z: 0.92, gyroZ: 0.65, gyroEnergy: 0.45, magnitude: 1.02, timestamp: time });
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: 48, heading: h, accuracy: 5, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 600;
    }

    unsub();
    const hasHarshCorner = events.some((e) => e.type === 'HARSH_CORNERING');
    assert(
      hasHarshCorner,
      'TEST 5 — Harsh Cornering',
      `Fast turn at 48 km/h with 70° heading swing and lateral acceleration correctly triggers HARSH_CORNERING.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 6 — Normal Corner
  // Low speed (10 km/h) + normal turn
  // Expected: No event
  // ---------------------------------------------------------------------------
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
    assert(
      !hasHarshCorner,
      'TEST 6 — Normal Corner',
      `Slow cornering at 10 km/h correctly rejected from harsh cornering classification.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 7 — Overspeeding
  // Road limit: 60 km/h. Speed: 70 -> 72 -> 74 -> 76 -> 75 km/h sustained for configured duration
  // Expected: OVERSPEEDING
  // ---------------------------------------------------------------------------
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
      time += 1000; // 1s steps over 6 seconds total (> 5000ms OVERSPEED_CONFIRMATION_MS)
    }

    unsub();
    const hasOverspeed = events.some((e) => e.type === 'OVERSPEEDING');
    assert(
      hasOverspeed,
      'TEST 7 — Overspeeding',
      `Sustained driving above speed limit + tolerance for >5s successfully triggers OVERSPEEDING.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 8 — GPS Spike
  // Speed: 50 -> 150 -> 48 -> 52 km/h (instantaneous jump)
  // Expected: No overspeeding event
  // ---------------------------------------------------------------------------
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
      time += 500; // fast single spike
    }

    unsub();
    const hasOverspeed = events.some((e) => e.type === 'OVERSPEEDING');
    assert(
      !hasOverspeed,
      'TEST 8 — GPS Spike',
      `Single noisy GPS spike (50 -> 150 -> 48) correctly rejected without false overspeeding.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 9 — Traffic
  // DRIVING: 35 -> 10 -> 3 -> 0 -> 5 -> 15 km/h over natural traffic stops
  // Expected: No hard braking event
  // ---------------------------------------------------------------------------
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
      time += 2000; // 2s steps in stop-and-go traffic
    }

    unsub();
    const hasHardBrake = events.some((e) => e.type === 'HARD_BRAKING');
    assert(
      !hasHardBrake,
      'TEST 9 — Traffic',
      `Stop-and-go traffic deceleration safely processed without false hard-braking alert.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 10 — Phone Interaction (Distraction)
  // DRIVING + repeated phone interaction + sustained movement
  // Expected: POSSIBLE_DISTRACTED_DRIVING
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 1000000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // Vehicle moving at 45 km/h with high driving confidence (0.95)
    for (let i = 0; i < 9; i++) {
      // User repeatedly tapping screen while vehicle is moving
      engine.registerUserInteraction(time);
      engine.feedMotion({ x: 0.15, y: 0.12, z: 0.95, magnitude: 1.08, timestamp: time }); // unmounted handheld movement
      engine.feedGpsLocation(
        { latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time },
        'DRIVING',
        0.95
      );
      time += 1000; // 9 seconds continuous interaction while moving (> 7000ms threshold)
    }

    unsub();
    const hasDistraction = events.some((e) => e.type === 'POSSIBLE_DISTRACTED_DRIVING');
    assert(
      hasDistraction,
      'TEST 10 — Phone Interaction',
      `Active screen interactions while travelling at speed triggers POSSIBLE_DISTRACTED_DRIVING.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 11 — Walking (Vehicle Context Guard)
  // WALKING + large acceleration
  // Expected: No driving safety event
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 1100000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // Walker sprints or trips, producing high acceleration spike
    engine.feedMotion({ x: 0.3, y: 0.8, z: 1.3, magnitude: 1.5, timestamp: time });
    engine.feedGpsLocation(
      { latitude: 37.77, longitude: -122.41, speed: 6, accuracy: 5, timestamp: time },
      'WALKING',
      0.95
    );
    time += 800;

    engine.feedMotion({ x: 0.3, y: 0.9, z: 1.4, magnitude: 1.6, timestamp: time });
    engine.feedGpsLocation(
      { latitude: 37.77, longitude: -122.41, speed: 14, accuracy: 5, timestamp: time },
      'WALKING',
      0.95
    );

    unsub();
    assert(
      events.length === 0,
      'TEST 11 — Walking',
      `Non-vehicle activity (WALKING) correctly ignores driving safety detectors.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 12 — Event Deduplication & Cooldown
  // One hard braking event, followed immediately by continuous braking
  // Expected: Only ONE event generated (cooldown enforced)
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    let time = 1200000;
    const events: SafetyEvent[] = [];
    const unsub = engine.subscribeEvents((e) => events.push(e));

    // First hard brake
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 70, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 500;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 45, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    time += 500;
    engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 15, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);

    // Continuous braking attempts within the 15s cooldown period
    for (let i = 0; i < 5; i++) {
      time += 1000; // 1s steps (< 15000ms cooldown)
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 60, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
      time += 500;
      engine.feedGpsLocation({ latitude: 37.77, longitude: -122.41, speed: 20, accuracy: 5, timestamp: time }, 'DRIVING', 0.95);
    }

    unsub();
    const hardBrakingCount = events.filter((e) => e.type === 'HARD_BRAKING').length;
    assert(
      hardBrakingCount === 1,
      'TEST 12 — Event Deduplication',
      `Cooldown correctly prevented repeated duplicate events (expected 1, got ${hardBrakingCount}).`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 13 — Sensor Replay Harness (Section 29)
  // Replaying recorded dataset through SensorReplay
  // ---------------------------------------------------------------------------
  {
    engine.reset();
    const replay = new SensorReplay(engine);
    let time = 1300000;

    const recordedData = [
      { latitude: 37.77, longitude: -122.41, speed: 75, timestamp: time, activity: 'DRIVING' as const },
      { latitude: 37.7705, longitude: -122.41, speed: 78, timestamp: time + 1000, activity: 'DRIVING' as const },
      { latitude: 37.7710, longitude: -122.41, speed: 82, timestamp: time + 2000, activity: 'DRIVING' as const },
      { latitude: 37.7715, longitude: -122.41, speed: 80, timestamp: time + 3000, activity: 'DRIVING' as const },
      { latitude: 37.7720, longitude: -122.41, speed: 85, timestamp: time + 4000, activity: 'DRIVING' as const },
      { latitude: 37.7725, longitude: -122.41, speed: 84, timestamp: time + 5500, activity: 'DRIVING' as const },
    ];

    engine.setContextualSpeedLimit(60);
    const replayedEvents = replay.replaySequence(recordedData);

    assert(
      replayedEvents.length > 0 && replayedEvents[0].type === 'OVERSPEEDING',
      'TEST 13 — Sensor Replay Harness',
      `SensorReplay successfully executed recorded sequence without live hardware dependencies.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 14 — Safety Score Deduction (Section 23)
  // Base 100 minus events penalties
  // ---------------------------------------------------------------------------
  {
    const mockEvents: SafetyEvent[] = [
      { id: '1', type: 'HARD_BRAKING', severity: 'HIGH', confidence: 0.9, timestamp: 1, duration: 2, evidence: [], sourceSignals: ['GPS'] },
      { id: '2', type: 'RAPID_ACCELERATION', severity: 'MEDIUM', confidence: 0.85, timestamp: 2, duration: 1.5, evidence: [], sourceSignals: ['GPS'] },
      { id: '3', type: 'HARSH_CORNERING', severity: 'MEDIUM', confidence: 0.88, timestamp: 3, duration: 1.8, evidence: [], sourceSignals: ['GPS'] },
      { id: '4', type: 'OVERSPEEDING', severity: 'HIGH', confidence: 0.92, timestamp: 4, duration: 15, evidence: [], sourceSignals: ['GPS'] },
      { id: '5', type: 'POSSIBLE_DISTRACTED_DRIVING', severity: 'HIGH', confidence: 0.9, timestamp: 5, duration: 20, evidence: [], sourceSignals: ['GPS'] },
    ];

    const score = SafetyEventScorer.calculateSafetyScore(mockEvents);
    // 100 - (5+2) - 3 - 4 - 8 - 10 = 68
    assert(
      score === 68,
      'TEST 14 — Safety Score Calculation',
      `Rule-based scoring calculation accurately deduced penalties (expected 68, got ${score}).`
    );
  }

  // Summary
  console.log('\n========================================');
  console.log('DRIVING SAFETY DETECTION TEST REPORT');
  console.log('========================================');
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`Results: ${totalPassed} / ${results.length} PASSED`);
  if (totalPassed === results.length) {
    console.log('🎉 ALL SAFETY TESTS PASSED SUCCESSFULLY!');
  } else {
    console.log(`⚠️ ${results.length - totalPassed} tests failed.`);
  }
  console.log('========================================\n');
}

runTestSuite().catch(console.error);
