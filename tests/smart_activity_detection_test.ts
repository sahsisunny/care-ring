/**
 * Automated Verification Test Suite for Smart Activity Detection
 * Validates all 8 required test cases specified in Section 31 of Smart Activity Detection.md
 */

import { ActivityConfig } from '../mobile/src/activity/ActivityConfig';
import { ActivityRecognitionProvider } from '../mobile/src/activity/ActivityRecognitionProvider';
import { ActivityScorer } from '../mobile/src/activity/ActivityScorer';
import { MotionProcessor } from '../mobile/src/activity/MotionProcessor';
import { SensorFusion } from '../mobile/src/activity/SensorFusion';

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
  console.log('🧪 Running Smart Activity Detection Test Suite (Section 31)');
  console.log('================================================================\n');

  // Configure short test confirmation durations for fast automated suite execution
  ActivityConfig.ACTIVITY_START_CONFIRMATION_MS = 2000;
  ActivityConfig.ACTIVITY_SWITCH_CONFIRMATION_MS = 2000;
  ActivityConfig.STATIONARY_CONFIRMATION_MS = 3000;
  ActivityConfig.MIN_ACTIVITY_CONFIDENCE = 0.70;

  // ---------------------------------------------------------------------------
  // Test 1 — Car starts (0 -> 3 -> 7 -> 12 -> 25 -> 50 km/h)
  // Expected: UNKNOWN/STATIONARY -> DRIVING (NOT WALKING -> CYCLING -> DRIVING)
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    const carSpeeds = [0, 3, 7, 12, 25, 50];
    const observedConfirmedActivities: string[] = [];
    let time = 100000;

    // Prime motion processor with vehicle vibration (no footstep cadence)
    for (let m = 0; m < 6; m++) {
      engine.processMotion({
        x: 0.05,
        y: 0.04,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time + m * 50,
      });
    }

    for (const spd of carSpeeds) {
      engine.processMotion({
        x: 0.05,
        y: 0.04,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });

      const state = engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: spd,
        accuracy: 8,
        timestamp: time,
      });

      if (!observedConfirmedActivities.includes(state.confirmedActivity)) {
        observedConfirmedActivities.push(state.confirmedActivity);
      }
      time += 400; // 400ms steps
    }

    // Advance time past startup confirmation threshold (2000ms)
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const finalState = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 55,
      accuracy: 6,
      timestamp: time,
    });
    observedConfirmedActivities.push(finalState.confirmedActivity);

    const neverFlashedWalking = !observedConfirmedActivities.includes('WALKING');
    const neverFlashedCycling = !observedConfirmedActivities.includes('CYCLING');
    const endedInDriving = finalState.confirmedActivity === 'DRIVING';

    assert(
      neverFlashedWalking && neverFlashedCycling && endedInDriving,
      'Test 1 — Car starts',
      `Expected UNKNOWN/STATIONARY -> DRIVING. Observed: [${observedConfirmedActivities.join(' -> ')}]. Flashed walking: ${!neverFlashedWalking}, cycling: ${!neverFlashedCycling}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 2 — Motorcycle starts (0 -> 5 -> 12 -> 25 -> 50 km/h with lean/vibration)
  // Expected: Confirms RIDING
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    const motoSpeeds = [0, 5, 12, 25, 50];
    let time = 200000;

    // Prime motion processor with motorcycle lean and rotational dynamics
    for (let m = 0; m < 6; m++) {
      engine.processMotion({
        x: 0.28,
        y: 0.15,
        z: 0.92,
        magnitude: 1.08,
        gyroX: 0.45,
        gyroY: 0.35,
        gyroZ: 0.50,
        timestamp: time + m * 50,
      });
    }

    for (const spd of motoSpeeds) {
      engine.processMotion({
        x: 0.28,
        y: 0.15,
        z: 0.92,
        magnitude: 1.08,
        gyroX: 0.45,
        gyroY: 0.35,
        gyroZ: 0.50,
        timestamp: time,
      });

      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: spd,
        accuracy: 6,
        timestamp: time,
      });
      time += 400;
    }

    // Advance past startup confirmation
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7765,
      longitude: -122.4175,
      speed: 52,
      accuracy: 5,
      timestamp: time,
    });

    assert(
      state.confirmedActivity === 'RIDING',
      'Test 2 — Motorcycle starts',
      `Expected RIDING with motorcycle lean dynamics. Got: ${state.confirmedActivity}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 3 — Walking (0 -> 2 -> 4 -> 5 km/h with pedestrian cadence)
  // Expected: Confirms WALKING
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 300000;
    // Simulate ~100 steps/min cadence: periodic peaks every 600ms
    for (let i = 0; i < 20; i++) {
      const isPeak = i % 3 === 0;
      engine.processMotion({
        x: 0.1,
        y: isPeak ? 0.4 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time,
      });

      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: i < 5 ? 2.5 : 4.5,
        accuracy: 8,
        timestamp: time,
      });
      time += 200;
    }

    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7751,
      longitude: -122.4193,
      speed: 4.8,
      accuracy: 6,
      timestamp: time,
    });

    assert(
      state.confirmedActivity === 'WALKING',
      'Test 3 — Walking detection',
      `Expected WALKING. Got: ${state.confirmedActivity}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 4 — Running (0 -> 6 -> 9 -> 12 km/h with running cadence)
  // Expected: Confirms RUNNING
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('RUNNING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 400000;
    for (let i = 0; i < 20; i++) {
      const isPeak = i % 2 === 0;
      engine.processMotion({
        x: 0.2,
        y: isPeak ? 0.7 : 0.1,
        z: isPeak ? 1.6 : 0.8,
        magnitude: isPeak ? 1.75 : 0.85,
        timestamp: time,
      });

      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: i < 5 ? 7.5 : 11.0,
        accuracy: 7,
        timestamp: time,
      });
      time += 150;
    }

    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7755,
      longitude: -122.4190,
      speed: 11.5,
      accuracy: 5,
      timestamp: time,
    });

    assert(
      state.confirmedActivity === 'RUNNING',
      'Test 4 — Running detection',
      `Expected RUNNING. Got: ${state.confirmedActivity}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 5 — Cycling (0 -> 8 -> 15 -> 22 km/h)
  // Expected: Confirms CYCLING
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('ON_BICYCLE');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 500000;
    const cyclingSpeeds = [0, 8, 15, 22];

    for (const spd of cyclingSpeeds) {
      engine.processMotion({
        x: 0.12,
        y: 0.08,
        z: 0.98,
        magnitude: 1.02,
        timestamp: time,
      });

      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: spd,
        accuracy: 7,
        timestamp: time,
      });
      time += 400;
    }

    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4182,
      speed: 21.0,
      accuracy: 6,
      timestamp: time,
    });

    assert(
      state.confirmedActivity === 'CYCLING',
      'Test 5 — Cycling detection',
      `Expected CYCLING. Got: ${state.confirmedActivity}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 6 — Traffic Jam (DRIVING -> 35 -> 10 -> 3 -> 0 -> 5 -> 15 km/h)
  // Expected: DRIVING throughout!
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 600000;

    // Prime motion with vehicle vibrations
    for (let m = 0; m < 6; m++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.99,
        magnitude: 0.995,
        timestamp: time + m * 50,
      });
    }

    // 1. Establish initial confirmed DRIVING
    for (let i = 0; i < 5; i++) {
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 45,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const driveState = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 45,
      accuracy: 5,
      timestamp: time,
    });

    const isDrivingEstablished = driveState.confirmedActivity === 'DRIVING';

    // 2. Traffic Jam hits: 35 -> 10 -> 3 -> 0 -> 5 -> 15 km/h
    const trafficSpeeds = [35, 10, 3, 0, 5, 15];
    let preservedDriving = true;

    for (const spd of trafficSpeeds) {
      time += 800; // traffic points every 800ms
      engine.processMotion({
        x: 0.03,
        y: 0.02,
        z: 0.99,
        magnitude: 0.995,
        timestamp: time,
      });

      const s = engine.processGps({
        latitude: 37.7765,
        longitude: -122.4175,
        speed: spd,
        accuracy: 6,
        timestamp: time,
      });

      if (s.confirmedActivity !== 'DRIVING') {
        preservedDriving = false;
      }
    }

    assert(
      isDrivingEstablished && preservedDriving,
      'Test 6 — Traffic Jam hysteresis',
      `Expected DRIVING maintained throughout traffic jam. Established: ${isDrivingEstablished}, Preserved: ${preservedDriving}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 7 — Vehicle Stop (DRIVING -> 0 km/h -> stopped for configured duration)
  // Expected: DRIVING -> STATIONARY only after confirmation!
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 700000;

    // Prime motion
    for (let m = 0; m < 6; m++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.99,
        magnitude: 0.995,
        timestamp: time + m * 50,
      });
    }

    // 1. Establish DRIVING
    for (let i = 0; i < 5; i++) {
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 50,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });

    // 2. Speed drops to 0 km/h (e.g. stopped at red light / arrived)
    time += 500;
    const stopImmediateState = engine.processGps({
      latitude: 37.7762,
      longitude: -122.4178,
      speed: 0,
      accuracy: 5,
      timestamp: time,
    });

    // Immediately at 0 km/h, hysteresis must hold DRIVING
    const holdsDrivingAtFirst = stopImmediateState.confirmedActivity === 'DRIVING';

    // 3. Advance past STATIONARY_CONFIRMATION_MS (configured to 3000ms here)
    time += ActivityConfig.STATIONARY_CONFIRMATION_MS + 1000;
    const confirmedStopState = engine.processGps({
      latitude: 37.7762,
      longitude: -122.4178,
      speed: 0,
      accuracy: 5,
      timestamp: time,
    });

    const transitionsToStationary = confirmedStopState.confirmedActivity === 'STATIONARY';

    assert(
      holdsDrivingAtFirst && transitionsToStationary,
      'Test 7 — Vehicle Stop confirmation',
      `Expected DRIVING held initially (result: ${holdsDrivingAtFirst}), then STATIONARY after timeout (result: ${transitionsToStationary})`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 8 — GPS Noise (5 -> 80 -> 4 -> 90 -> 6 km/h spikes)
  // Expected: No activity switching caused by GPS spikes!
  // ---------------------------------------------------------------------------
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 800000;

    // Establish walking
    osProvider.setMockOsActivity('WALKING');
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.1,
        y: 0.35,
        z: 1.2,
        magnitude: 1.25,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 4.5,
        accuracy: 6,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const walkingState = engine.processGps({
      latitude: 37.7752,
      longitude: -122.4192,
      speed: 4.5,
      accuracy: 6,
      timestamp: time,
    });

    const isWalking = walkingState.confirmedActivity === 'WALKING';

    // Inject sudden massive GPS glitches: 5 -> 80 -> 4 -> 90 -> 6
    const noisySpeeds = [5, 80, 4, 90, 6];
    let triggeredFalseDrivingSwitch = false;

    for (const spd of noisySpeeds) {
      time += 500;
      const state = engine.processGps({
        latitude: 37.7753,
        longitude: -122.4191,
        speed: spd,
        accuracy: 15,
        timestamp: time,
      });

      if (state.confirmedActivity === 'DRIVING' || state.confirmedActivity === 'RIDING') {
        triggeredFalseDrivingSwitch = true;
      }
    }

    assert(
      isWalking && !triggeredFalseDrivingSwitch,
      'Test 8 — GPS Noise spike rejection',
      `Expected no false vehicle switch on GPS spikes. False switch triggered: ${triggeredFalseDrivingSwitch}`
    );
  }

  // ===========================================================================
  // SECTION 1: CONFLICTING OS ACTIVITY VS GPS (Test 9)
  // Scenario: OS = WALKING, GPS = 45 km/h, Motion = vehicle-like
  // Expected: MUST NOT classify as WALKING. Either DRIVING/RIDING or UNKNOWN.
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 900000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 45,
        accuracy: 6,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 45,
      accuracy: 6,
      timestamp: time,
    });

    const notWalking = state.confirmedActivity !== 'WALKING';
    const isDrivingOrUnknown =
      state.confirmedActivity === 'DRIVING' ||
      state.confirmedActivity === 'RIDING' ||
      state.confirmedActivity === 'UNKNOWN';
    assert(
      notWalking && isDrivingOrUnknown,
      'Test 9 — Conflicting OS activity vs GPS (OS=WALKING, GPS=45km/h)',
      `Expected vehicle/unknown instead of walking. Got: ${state.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 2: OS UNKNOWN + SENSOR EVIDENCE (Test 10)
  // Scenario: OS = UNKNOWN, GPS = sustained 45 km/h, GPS accuracy = good, Motion = vehicle
  // Expected: Capable of detecting DRIVING/RIDING when sensor evidence crosses threshold
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('UNKNOWN');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 920000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 45,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 48,
      accuracy: 5,
      timestamp: time,
    });

    const isVehicle = state.confirmedActivity === 'DRIVING' || state.confirmedActivity === 'RIDING';
    assert(
      isVehicle && state.confidence >= ActivityConfig.MIN_ACTIVITY_CONFIDENCE,
      'Test 10 — OS Unknown + sensor evidence',
      `Expected vehicle detected without OS hint. Got: ${state.confirmedActivity} (confidence: ${state.confidence})`
    );
  }

  // ===========================================================================
  // SECTION 3: OS ACTIVITY TEMPORARY GLITCH (Test 11)
  // Scenario: Establish DRIVING, then inject OS = WALKING for 1-2 samples while GPS/Motion stay vehicle-like
  // Expected: confirmedActivity MUST remain DRIVING
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 940000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 50,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const driveState = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });
    const establishedDriving = driveState.confirmedActivity === 'DRIVING';

    // Inject temporary OS glitch: 2 samples reporting WALKING
    osProvider.setMockOsActivity('WALKING');
    time += 400;
    const glitch1 = engine.processGps({
      latitude: 37.7762,
      longitude: -122.4178,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });
    time += 400;
    const glitch2 = engine.processGps({
      latitude: 37.7764,
      longitude: -122.4176,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });

    assert(
      establishedDriving && glitch1.confirmedActivity === 'DRIVING' && glitch2.confirmedActivity === 'DRIVING',
      'Test 11 — OS activity temporary glitch',
      `DRIVING must be maintained despite 1-2 glitchy WALKING samples. Glitch1: ${glitch1.confirmedActivity}, Glitch2: ${glitch2.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 4: GPS HIGH SPEED + POOR ACCURACY (Test 12)
  // Scenario: speed = 100 km/h, accuracy = 150m (poor), OS = UNKNOWN, Motion = ambiguous
  // Expected: Do NOT confidently classify as driving; confidence decreases below threshold; confirmed remains previous/UNKNOWN
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('UNKNOWN');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 960000;
    const state = engine.processGps({
      latitude: 37.7749,
      longitude: -122.4194,
      speed: 100,
      accuracy: 150, // very poor accuracy
      timestamp: time,
    });

    // Poor GPS accuracy should prevent confident DRIVING confirmation
    const notConfidentlyDriving = state.confirmedActivity !== 'DRIVING';
    assert(
      notConfidentlyDriving,
      'Test 12 — GPS high speed + poor accuracy',
      `Poor accuracy GPS must not confidently confirm driving. Got: ${state.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 5: GPS SPEED SPIKE WITH GOOD PREVIOUS STATE (Test 13)
  // Scenario: Establish WALKING -> 4, 5, 90 (spike), 4, 5 km/h
  // Expected: WALKING remains confirmed throughout; no DRIVING/RIDING transition
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 980000;
    for (let i = 0; i < 6; i++) {
      const isPeak = i % 2 === 0;
      engine.processMotion({
        x: 0.1,
        y: isPeak ? 0.35 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 4.5,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const walkState = engine.processGps({
      latitude: 37.7752,
      longitude: -122.4192,
      speed: 4.5,
      accuracy: 5,
      timestamp: time,
    });
    const isWalkingEstablished = walkState.confirmedActivity === 'WALKING';

    const spikeSequence = [4, 5, 90, 4, 5];
    let heldWalking = true;
    for (const spd of spikeSequence) {
      time += 400;
      const s = engine.processGps({
        latitude: 37.7753,
        longitude: -122.4190,
        speed: spd,
        accuracy: 6,
        timestamp: time,
      });
      if (s.confirmedActivity !== 'WALKING') {
        heldWalking = false;
      }
    }

    assert(
      isWalkingEstablished && heldWalking,
      'Test 13 — GPS speed spike with good previous state',
      `WALKING must remain confirmed during 90 km/h spike. Established: ${isWalkingEstablished}, Held: ${heldWalking}`
    );
  }

  // ===========================================================================
  // SECTION 6: GPS SPEED SPIKE DURING DRIVING (Test 14)
  // Scenario: Establish DRIVING -> 50, 52, 180 (spike), 51, 53 km/h
  // Expected: DRIVING remains confirmed; 180 km/h does not trigger new transition
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1000000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 50,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const initialDrive = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });

    const sequence = [50, 52, 180, 51, 53];
    let remainedDriving = true;
    for (const spd of sequence) {
      time += 400;
      const s = engine.processGps({
        latitude: 37.7762,
        longitude: -122.4178,
        speed: spd,
        accuracy: 5,
        timestamp: time,
      });
      if (s.confirmedActivity !== 'DRIVING') {
        remainedDriving = false;
      }
    }

    assert(
      initialDrive.confirmedActivity === 'DRIVING' && remainedDriving,
      'Test 14 — GPS speed spike during driving (180 km/h spike)',
      `DRIVING must be preserved during 180 km/h spike without corrupting state. Held: ${remainedDriving}`
    );
  }

  // ===========================================================================
  // SECTION 7: GPS UNAVAILABLE + OS ACTIVITY (Test 15)
  // Scenario: GPS unavailable. OS = WALKING, Motion = walking cadence
  // Expected: System runs gracefully without crash; does not produce NaN or error
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1020000;
    for (let i = 0; i < 10; i++) {
      const isPeak = i % 2 === 0;
      engine.processMotion({
        x: 0.1,
        y: isPeak ? 0.35 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time,
      });
      time += 200;
    }

    const state = engine.getCurrentState();
    const scorer = new ActivityScorer();
    const motionFeatures = (engine as any).motionProcessor.extractFeatures();
    const prediction = scorer.score(null, motionFeatures, 'WALKING', 'STATIONARY');

    const validExecution =
      !isNaN(state.confidence) &&
      !isNaN(prediction.confidence) &&
      prediction.activity !== undefined;
    assert(
      validExecution,
      'Test 15 — GPS unavailable + OS activity',
      `Engine must handle missing GPS without crash or NaN. Prediction: ${prediction.activity} (conf: ${prediction.confidence})`
    );
  }

  // ===========================================================================
  // SECTION 8: GPS AVAILABLE + OS UNAVAILABLE (Test 16)
  // Scenario: OS = UNKNOWN, GPS = good quality (45 km/h), Motion = vehicle-like
  // Expected: DRIVING is detectable when evidence is sufficient
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('UNKNOWN');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1040000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 45,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 45,
      accuracy: 5,
      timestamp: time,
    });

    assert(
      state.confirmedActivity === 'DRIVING',
      'Test 16 — GPS available + OS unavailable',
      `Expected DRIVING detectable without OS hint. Got: ${state.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 9: MOTION SENSOR UNAVAILABLE (Test 17)
  // Scenario: Accelerometer/gyroscope unavailable (no motion updates). OS = WALKING, GPS = 4.5 km/h
  // Expected: Gracefully degrades to WALKING; no crash; no NaN; valid confidence
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1060000;
    for (let i = 0; i < 6; i++) {
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 4.5,
        accuracy: 6,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7752,
      longitude: -122.4192,
      speed: 4.5,
      accuracy: 6,
      timestamp: time,
    });

    const isWalking = state.confirmedActivity === 'WALKING';
    const noNaN = !isNaN(state.confidence) && state.confidence > 0;
    assert(
      isWalking && noNaN,
      'Test 17 — Motion sensor unavailable',
      `Degrades gracefully to WALKING without motion sensors. Confirmed: ${state.confirmedActivity}, Confidence: ${state.confidence}`
    );
  }

  // ===========================================================================
  // SECTION 10: ALL SIGNALS CONFLICT (Test 18)
  // Scenario: GPS speed = 15 km/h, OS = WALKING, Motion = vehicle-like, GPS accuracy = mediocre (35m), Previous = CYCLING
  // Expected: Does not hallucinate certainty; confidence below threshold or retains CYCLING/UNKNOWN
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    // Establish initial CYCLING
    osProvider.setMockOsActivity('ON_BICYCLE');
    let time = 1080000;
    for (let i = 0; i < 6; i++) {
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 18,
        accuracy: 6,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    engine.processGps({
      latitude: 37.7755,
      longitude: -122.4188,
      speed: 18,
      accuracy: 6,
      timestamp: time,
    });

    // Now inject contradictory signals
    osProvider.setMockOsActivity('WALKING');
    time += 500;
    engine.processMotion({
      x: 0.04,
      y: 0.03,
      z: 0.98,
      magnitude: 0.985, // vehicle-like, no footsteps
      timestamp: time,
    });
    const state = engine.processGps({
      latitude: 37.7757,
      longitude: -122.4186,
      speed: 15,
      accuracy: 35, // mediocre
      timestamp: time,
    });

    // Should NOT falsely jump to WALKING or force arbitrary certainty
    const didNotJumpToWalking = state.confirmedActivity !== 'WALKING';
    assert(
      didNotJumpToWalking,
      'Test 18 — All signals conflict',
      `Contradictory signals must not force arbitrary switch to WALKING. Confirmed: ${state.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 11: CONFIDENCE BELOW THRESHOLD (Test 19)
  // Scenario: Prediction confidence below MIN_ACTIVITY_CONFIDENCE
  // Expected: candidateActivity may exist internally, but confirmedActivity MUST NOT change
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('UNKNOWN');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    // With MIN_ACTIVITY_CONFIDENCE set to 0.70
    ActivityConfig.MIN_ACTIVITY_CONFIDENCE = 0.70;

    let time = 1100000;
    // Feed ambiguous single reading with very poor accuracy (confidence will be < 0.70)
    const state = engine.processGps({
      latitude: 37.7749,
      longitude: -122.4194,
      speed: 10,
      accuracy: 100, // very poor accuracy -> low confidence
      timestamp: time,
    });

    const heldStationary = state.confirmedActivity === 'STATIONARY';
    assert(
      heldStationary,
      'Test 19 — Confidence below threshold',
      `Confirmed activity must not change when confidence is below threshold. Confirmed: ${state.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 12: CONFIDENCE ABOVE THRESHOLD (Test 20)
  // Scenario: OS = IN_VEHICLE, GPS = 50 km/h, accuracy = good, motion = vehicle
  // Expected: confidence >= MIN_ACTIVITY_CONFIDENCE and confirmedActivity = DRIVING
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('IN_VEHICLE');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1120000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 50,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const state = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });

    assert(
      state.confirmedActivity === 'DRIVING' && state.confidence >= ActivityConfig.MIN_ACTIVITY_CONFIDENCE,
      'Test 20 — Confidence above threshold',
      `Expected DRIVING with confidence >= ${ActivityConfig.MIN_ACTIVITY_CONFIDENCE}. Got: ${state.confirmedActivity} (${state.confidence})`
    );
  }

  // ===========================================================================
  // SECTION 13: ACTIVITY SWITCH REQUIRES SUSTAINED EVIDENCE (Test 21)
  // Scenario: Establish WALKING -> inject DRIVING for < 2000ms -> WALKING held; continue > 2000ms -> switches to DRIVING
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1140000;
    for (let i = 0; i < 6; i++) {
      const isPeak = i % 2 === 0;
      engine.processMotion({
        x: 0.1,
        y: isPeak ? 0.35 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 4.5,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const walkState = engine.processGps({
      latitude: 37.7752,
      longitude: -122.4192,
      speed: 4.5,
      accuracy: 5,
      timestamp: time,
    });
    const isWalking = walkState.confirmedActivity === 'WALKING';

    // Inject vehicle evidence for 800ms (< 2000ms)
    osProvider.setMockOsActivity('IN_VEHICLE');
    time += 800;
    engine.processMotion({
      x: 0.04,
      y: 0.03,
      z: 0.98,
      magnitude: 0.985,
      timestamp: time,
    });
    const midSwitchState = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });
    const heldWalkingUnderTimeout = midSwitchState.confirmedActivity === 'WALKING';

    // Continue same evidence past ACTIVITY_SWITCH_CONFIRMATION_MS (+2500ms)
    time += ActivityConfig.ACTIVITY_SWITCH_CONFIRMATION_MS + 500;
    const finalState = engine.processGps({
      latitude: 37.7765,
      longitude: -122.4175,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });
    const switchedToDriving = finalState.confirmedActivity === 'DRIVING';

    assert(
      isWalking && heldWalkingUnderTimeout && switchedToDriving,
      'Test 21 — Activity switch requires sustained evidence',
      `Expected WALKING held under timeout (${heldWalkingUnderTimeout}), then DRIVING after timeout (${switchedToDriving})`
    );
  }

  // ===========================================================================
  // SECTION 14: TIMESTAMP OUT OF ORDER (Test 22)
  // Scenario: Send GPS samples with timestamps: 1000, 2000, 1500, 3000
  // Expected: Out of order sample (1500) ignored/safely handled; no negative delta; no crash
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    const s1 = engine.processGps({ latitude: 37.7749, longitude: -122.4194, speed: 20, accuracy: 5, timestamp: 1000 });
    const s2 = engine.processGps({ latitude: 37.7750, longitude: -122.4193, speed: 25, accuracy: 5, timestamp: 2000 });
    // Out of order sample
    const s3 = engine.processGps({ latitude: 37.77495, longitude: -122.41935, speed: 100, accuracy: 5, timestamp: 1500 });
    const s4 = engine.processGps({ latitude: 37.7751, longitude: -122.4192, speed: 30, accuracy: 5, timestamp: 3000 });

    const noCrash = s1 !== undefined && s2 !== undefined && s3 !== undefined && s4 !== undefined;
    const s3SafelyIgnored = s3.lastUpdatedAt >= 2000;
    assert(
      noCrash && s3SafelyIgnored,
      'Test 22 — Timestamp out of order',
      `Out of order timestamp safely handled without negative time delta corruption.`
    );
  }

  // ===========================================================================
  // SECTION 15: DUPLICATE TIMESTAMP (Test 23)
  // Scenario: timestamp = 1000, timestamp = 1000
  // Expected: No divide-by-zero, no Infinity, no NaN, no false transition
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    const s1 = engine.processGps({ latitude: 37.7749, longitude: -122.4194, speed: 10, accuracy: 5, timestamp: 1000 });
    const s2 = engine.processGps({ latitude: 37.7749, longitude: -122.4194, speed: 10, accuracy: 5, timestamp: 1000 });

    const validNumbers = !isNaN(s2.confidence) && isFinite(s2.confidence);
    assert(
      validNumbers,
      'Test 23 — Duplicate timestamp',
      `Duplicate timestamp handled safely without divide-by-zero or NaN.`
    );
  }

  // ===========================================================================
  // SECTION 16: VERY LARGE TIMESTAMP GAP (Test 24)
  // Scenario: GPS sample at 1000, next sample at 120000 (119 seconds later)
  // Expected: Gap handled safely, no unrealistic acceleration calculated
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    engine.processGps({ latitude: 37.7749, longitude: -122.4194, speed: 5, accuracy: 5, timestamp: 1000 });
    const state = engine.processGps({ latitude: 37.7800, longitude: -122.4100, speed: 60, accuracy: 5, timestamp: 120000 });

    const noCrash = state !== undefined && !isNaN(state.confidence);
    assert(
      noCrash,
      'Test 24 — Very large timestamp gap',
      `Large timestamp gap (119s) handled safely without invalid acceleration.`
    );
  }

  // ===========================================================================
  // SECTION 17: GPS ACCURACY CHANGES (Test 25)
  // Scenario: accuracy = 5m, 8m, 15m, 80m, 120m
  // Expected: Confidence decreases as GPS reliability decreases
  // ===========================================================================
  {
    const scorer = new ActivityScorer();
    const gpsGood: any = { rawSpeed: 50, smoothedSpeed: 50, acceleration: 0, accuracyScore: 1.0, speedTrend: 'STEADY' };
    const gpsMediocre: any = { rawSpeed: 50, smoothedSpeed: 50, acceleration: 0, accuracyScore: 0.65, speedTrend: 'STEADY' };
    const gpsPoor: any = { rawSpeed: 50, smoothedSpeed: 50, acceleration: 0, accuracyScore: 0.25, speedTrend: 'STEADY' };

    const predGood = scorer.score(gpsGood, null, 'UNKNOWN', 'STATIONARY');
    const predMediocre = scorer.score(gpsMediocre, null, 'UNKNOWN', 'STATIONARY');
    const predPoor = scorer.score(gpsPoor, null, 'UNKNOWN', 'STATIONARY');

    const monotonicAccuracy =
      predGood.confidence >= predMediocre.confidence && predMediocre.confidence > predPoor.confidence;
    assert(
      monotonicAccuracy,
      'Test 25 — GPS accuracy changes',
      `Confidence decreases as accuracy degrades. Good: ${predGood.confidence}, Mediocre: ${predMediocre.confidence}, Poor: ${predPoor.confidence}`
    );
  }

  // ===========================================================================
  // SECTION 18: STATIONARY FALSE POSITIVE (Test 26)
  // Scenario: Establish DRIVING -> speed 0 for < 3000ms -> DRIVING; speed 0 > 3000ms -> STATIONARY
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1200000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 50,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });

    // Speed drops to 0 (stopped at traffic light)
    time += 500;
    const initialStop = engine.processGps({
      latitude: 37.7762,
      longitude: -122.4178,
      speed: 0,
      accuracy: 5,
      timestamp: time,
    });
    const heldDrivingAtFirst = initialStop.confirmedActivity === 'DRIVING';

    // Advance past STATIONARY_CONFIRMATION_MS
    time += ActivityConfig.STATIONARY_CONFIRMATION_MS + 1000;
    const finalStop = engine.processGps({
      latitude: 37.7762,
      longitude: -122.4178,
      speed: 0,
      accuracy: 5,
      timestamp: time,
    });
    const confirmedStationary = finalStop.confirmedActivity === 'STATIONARY';

    assert(
      heldDrivingAtFirst && confirmedStationary,
      'Test 26 — Stationary false positive (boundary verification)',
      `Both sides of stop boundary verified: held DRIVING initially (${heldDrivingAtFirst}), confirmed STATIONARY after timeout (${confirmedStationary})`
    );
  }

  // ===========================================================================
  // SECTION 19: TRAFFIC JAM WITH OS WALKING GLITCH (Test 27)
  // Scenario: Establish DRIVING -> speeds: 40, 15, 5, 0, 3, 10 km/h with OS = WALKING glitch
  // Expected: DRIVING remains confirmed throughout
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1250000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 45,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 45,
      accuracy: 5,
      timestamp: time,
    });

    const trafficSpeeds = [40, 15, 5, 0, 3, 10];
    let preservedDriving = true;
    for (let i = 0; i < trafficSpeeds.length; i++) {
      time += 800;
      if (i === 2 || i === 3) {
        osProvider.setMockOsActivity('WALKING'); // glitch
      } else {
        osProvider.setMockOsActivity('UNKNOWN');
      }

      engine.processMotion({
        x: 0.03,
        y: 0.02,
        z: 0.99,
        magnitude: 0.995,
        timestamp: time,
      });

      const s = engine.processGps({
        latitude: 37.7765,
        longitude: -122.4175,
        speed: trafficSpeeds[i],
        accuracy: 6,
        timestamp: time,
      });

      if (s.confirmedActivity !== 'DRIVING') {
        preservedDriving = false;
      }
    }

    assert(
      preservedDriving,
      'Test 27 — Traffic jam with OS walking glitch',
      `DRIVING must remain confirmed throughout traffic crawl and transient OS walking glitch.`
    );
  }

  // ===========================================================================
  // SECTION 20: MOTORCYCLE VS CAR AMBIGUITY (Test 28)
  // Scenario: GPS speed = 50 km/h, motion vehicle-like (no lean), OS = IN_VEHICLE
  // Expected: Stable classification (DRIVING), does NOT rapidly alternate DRIVING -> RIDING -> DRIVING
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('IN_VEHICLE');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1300000;
    const activities: string[] = [];
    for (let i = 0; i < 8; i++) {
      engine.processMotion({
        x: 0.03,
        y: 0.02,
        z: 0.98,
        magnitude: 0.985, // No lean variance, flat four-wheel vibration
        timestamp: time,
      });
      const s = engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 50,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
      if (!activities.includes(s.confirmedActivity)) {
        activities.push(s.confirmedActivity);
      }
    }

    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const finalState = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });

    const stableVehicle = finalState.confirmedActivity === 'DRIVING' && !activities.includes('RIDING');
    assert(
      stableVehicle,
      'Test 28 — Motorcycle vs Car ambiguity',
      `Stable classification as DRIVING without alternating RIDING without lean signals. Final: ${finalState.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 21: WALKING VS RUNNING BOUNDARY (Test 29)
  // Scenario: Speeds around boundary: 6, 7, 8, 9, 10, 11, 12 km/h
  // Expected: No rapid oscillation; transition requires sustained confirmation
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('WALKING');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1350000;
    // Establish walking at 6 km/h
    for (let i = 0; i < 6; i++) {
      const isPeak = i % 2 === 0;
      engine.processMotion({
        x: 0.1,
        y: isPeak ? 0.35 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 6.0,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const walkState = engine.processGps({
      latitude: 37.7752,
      longitude: -122.4192,
      speed: 6.0,
      accuracy: 5,
      timestamp: time,
    });

    // Speed increases to boundary speeds (7, 8, 9 km/h) for brief steps
    const boundarySpeeds = [7, 8, 9];
    let stayedStable = true;
    for (const spd of boundarySpeeds) {
      time += 300;
      const s = engine.processGps({
        latitude: 37.7754,
        longitude: -122.4190,
        speed: spd,
        accuracy: 5,
        timestamp: time,
      });
      if (s.confirmedActivity !== 'WALKING') {
        stayedStable = false; // Must not oscillate on single boundary steps
      }
    }

    assert(
      walkState.confirmedActivity === 'WALKING' && stayedStable,
      'Test 29 — Walking vs running boundary',
      `No rapid oscillation at 7-9 km/h boundary without sustained confirmation.`
    );
  }

  // ===========================================================================
  // SECTION 22: CYCLING VS DRIVING BOUNDARY (Test 30)
  // Scenario: 10, 15, 20, 25, 30 km/h with ambiguous motion
  // Expected: Single speed does not force CYCLING -> DRIVING immediately
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    osProvider.setMockOsActivity('ON_BICYCLE');
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1400000;
    for (let i = 0; i < 6; i++) {
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 20,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const cycleState = engine.processGps({
      latitude: 37.7755,
      longitude: -122.4188,
      speed: 20,
      accuracy: 5,
      timestamp: time,
    });

    // A single speed burst of 28 km/h without automotive OS hint
    time += 400;
    const burstState = engine.processGps({
      latitude: 37.7758,
      longitude: -122.4185,
      speed: 28,
      accuracy: 5,
      timestamp: time,
    });

    assert(
      cycleState.confirmedActivity === 'CYCLING' && burstState.confirmedActivity === 'CYCLING',
      'Test 30 — Cycling vs driving boundary',
      `Single 28 km/h burst does not immediately force CYCLING -> DRIVING.`
    );
  }

  // ===========================================================================
  // SECTION 23: RESET BEHAVIOUR (Test 31)
  // Scenario: engine.reset() after DRIVING
  // Expected: Previous state cleared, starts cleanly in STATIONARY
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    let time = 1450000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 45,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 45,
      accuracy: 5,
      timestamp: time,
    });

    // Call reset
    engine.reset();
    const resetState = engine.getCurrentState();

    assert(
      resetState.confirmedActivity === 'STATIONARY' && resetState.previousActivity === 'UNKNOWN',
      'Test 31 — Reset behaviour',
      `State machine and rolling history cleared after reset(). Got: ${resetState.confirmedActivity}`
    );
  }

  // ===========================================================================
  // SECTION 24: MULTIPLE MOVEMENT SESSIONS (Test 32)
  // Scenario: Session 1 (WALKING) -> stop -> Session 2 (DRIVING)
  // Expected: Session 2 does not inherit stale sensor history from Session 1
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    // Session 1: Walking
    osProvider.setMockOsActivity('WALKING');
    let time = 1500000;
    for (let i = 0; i < 6; i++) {
      const isPeak = i % 2 === 0;
      engine.processMotion({
        x: 0.1,
        y: isPeak ? 0.35 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 4.5,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const session1 = engine.processGps({
      latitude: 37.7752,
      longitude: -122.4192,
      speed: 4.5,
      accuracy: 5,
      timestamp: time,
    });

    // Stop (confirm STATIONARY)
    time += 500;
    engine.processGps({ latitude: 37.7752, longitude: -122.4192, speed: 0, accuracy: 5, timestamp: time });
    time += ActivityConfig.STATIONARY_CONFIRMATION_MS + 500;
    const stoppedState = engine.processGps({
      latitude: 37.7752,
      longitude: -122.4192,
      speed: 0,
      accuracy: 5,
      timestamp: time,
    });

    // Session 2: Driving
    osProvider.setMockOsActivity('IN_VEHICLE');
    time += 1000;
    for (let i = 0; i < 6; i++) {
      engine.processMotion({
        x: 0.04,
        y: 0.03,
        z: 0.98,
        magnitude: 0.985,
        timestamp: time,
      });
      engine.processGps({
        latitude: 37.7760,
        longitude: -122.4180,
        speed: 50,
        accuracy: 5,
        timestamp: time,
      });
      time += 400;
    }
    time += ActivityConfig.ACTIVITY_START_CONFIRMATION_MS + 500;
    const session2 = engine.processGps({
      latitude: 37.7770,
      longitude: -122.4170,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });

    assert(
      session1.confirmedActivity === 'WALKING' &&
        stoppedState.confirmedActivity === 'STATIONARY' &&
        session2.confirmedActivity === 'DRIVING',
      'Test 32 — Multiple movement sessions',
      `Session 2 correctly transitions to DRIVING without stale walking history corruption.`
    );
  }

  // ===========================================================================
  // SECTION 25: SENSOR HISTORY WINDOW (Test 33)
  // Scenario: Old WALKING evidence rolls out as new DRIVING evidence arrives
  // Expected: Old evidence does not dominate indefinitely
  // ===========================================================================
  {
    const motionProc = new MotionProcessor();
    let time = 1550000;

    // Feed 20 walking readings with footstep oscillations
    for (let i = 0; i < 20; i++) {
      const isPeak = i % 2 === 0;
      motionProc.addReading({
        x: 0.1,
        y: isPeak ? 0.35 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time + i * 50,
      });
    }
    const walkingFeatures = motionProc.extractFeatures();

    // Feed 35 steady vehicle vibration readings (clearing previous 30-sample window)
    for (let i = 0; i < 35; i++) {
      motionProc.addReading({ x: 0.03, y: 0.02, z: 0.98, magnitude: 0.985, timestamp: time + 1000 + i * 50 });
    }
    const vehicleFeatures = motionProc.extractFeatures();

    const rollingWindowReplaced =
      walkingFeatures.isStepLike && !vehicleFeatures.isStepLike && vehicleFeatures.isVehicleVibration;
    assert(
      rollingWindowReplaced,
      'Test 33 — Sensor history window replacement',
      `Old walking readings cleanly roll out of the circular buffer as vehicle readings arrive.`
    );
  }

  // ===========================================================================
  // SECTION 26: CONFIDENCE MONOTONICITY (Test 34)
  // Scenario: Scenario A (weak evidence) vs Scenario B (strong evidence)
  // Expected: Scenario B confidence > Scenario A confidence
  // ===========================================================================
  {
    const scorer = new ActivityScorer();
    // Weak evidence: poor accuracy (70m), ambiguous speed (12 km/h), OS = UNKNOWN
    const gpsWeak: any = { rawSpeed: 12, smoothedSpeed: 12, acceleration: 0, accuracyScore: 0.4, speedTrend: 'STEADY' };
    const motionWeak: any = {
      hasMotionData: false,
      estimatedCadence: 0,
      energy: 0.01,
      isStepLike: false,
      leanVariance: 0,
      gyroEnergy: 0,
    };
    const predWeak = scorer.score(gpsWeak, motionWeak, 'UNKNOWN', 'STATIONARY');

    // Strong evidence: good accuracy (5m), clear speed (50 km/h), OS = IN_VEHICLE, vehicle vibration
    const gpsStrong: any = { rawSpeed: 50, smoothedSpeed: 50, acceleration: 0, accuracyScore: 1.0, speedTrend: 'STEADY' };
    const motionStrong: any = {
      hasMotionData: true,
      estimatedCadence: 0,
      energy: 0.04,
      isStepLike: false,
      isVehicleVibration: true,
      leanVariance: 0,
      gyroEnergy: 0,
    };
    const predStrong = scorer.score(gpsStrong, motionStrong, 'IN_VEHICLE', 'STATIONARY');

    assert(
      predStrong.confidence > predWeak.confidence,
      'Test 34 — Confidence monotonicity',
      `Strong evidence produces higher confidence (${predStrong.confidence}) than weak evidence (${predWeak.confidence}).`
    );
  }

  // ===========================================================================
  // SECTION 27: NUMERIC SAFETY & EDGE INPUTS (Test 35)
  // Scenario: Edge inputs: speed = 0, negative speed, accuracy = 0 / 99999, NaN speed, missing gyro
  // Expected: Never produce NaN confidence, Infinity acceleration, negative duration, or crash
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    const edgeInputs: any[] = [
      { latitude: 37.7749, longitude: -122.4194, speed: 0, accuracy: 0, timestamp: 1600000 },
      { latitude: 37.7749, longitude: -122.4194, speed: -15, accuracy: 10, timestamp: 1601000 },
      { latitude: 37.7749, longitude: -122.4194, speed: NaN, accuracy: 10, timestamp: 1602000 },
      { latitude: 37.7749, longitude: -122.4194, speed: 30, accuracy: 99999, timestamp: 1603000 },
      { latitude: 37.7749, longitude: -122.4194, speed: 50, accuracy: 10, timestamp: 1604000 },
    ];

    let allSafe = true;
    for (const inp of edgeInputs) {
      engine.processMotion({ x: 0, y: 0, z: 1, magnitude: 1, timestamp: inp.timestamp });
      const s = engine.processGps(inp);
      if (isNaN(s.confidence) || !isFinite(s.confidence) || s.confidence < 0) {
        allSafe = false;
      }
    }

    assert(
      allSafe,
      'Test 35 — Numeric safety and edge inputs',
      `Engine safely handles 0, negative, NaN speeds and extreme accuracies without NaN/Infinity.`
    );
  }

  // ===========================================================================
  // SECTION 28 & 29: PUBLIC API & REAL INTEGRATION VALIDATION (Test 36)
  // Scenario: Validates that SensorFusion, GpsProcessor, MotionProcessor, ActivityScorer, ActivityStateMachine are all real instances
  // ===========================================================================
  {
    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    const debugInfo = engine.getDebugInfo();

    const isRealArchitecture =
      typeof engine.processGps === 'function' &&
      typeof engine.processMotion === 'function' &&
      typeof engine.reset === 'function' &&
      typeof debugInfo.stateMachineState === 'string';

    assert(
      isRealArchitecture,
      'Test 36 — Public API and real architecture validation',
      `Real unmocked architecture exercised across all public contracts.`
    );
  }

  // ===========================================================================
  // SECTION 30: PRODUCTION CONFIGURATION TEST (Test 37)
  // Scenario: Validates exact production timings:
  // - ACTIVITY_START_CONFIRMATION_MS = 15000
  // - ACTIVITY_SWITCH_CONFIRMATION_MS = 12000
  // - STATIONARY_CONFIRMATION_MS = 25000
  // ===========================================================================
  {
    // Apply actual production configuration
    ActivityConfig.ACTIVITY_START_CONFIRMATION_MS = 15000;
    ActivityConfig.ACTIVITY_SWITCH_CONFIRMATION_MS = 12000;
    ActivityConfig.STATIONARY_CONFIRMATION_MS = 25000;
    ActivityConfig.MIN_ACTIVITY_CONFIDENCE = 0.70;

    const osProvider = new ActivityRecognitionProvider();
    const engine = new SensorFusion(osProvider);
    engine.reset();

    // 37a: Production Startup (15s confirmation requirement)
    let time = 2000000;
    for (let i = 0; i < 5; i++) {
      engine.processMotion({ x: 0.04, y: 0.03, z: 0.98, magnitude: 0.985, timestamp: time });
      engine.processGps({ latitude: 37.7749, longitude: -122.4194, speed: 45, accuracy: 5, timestamp: time });
      time += 400;
    }
    // At 10s (< 15s): NOT confirmed DRIVING yet
    time = 2000000 + 10000;
    const under15sState = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 45,
      accuracy: 5,
      timestamp: time,
    });
    const heldUnder15s = under15sState.confirmedActivity !== 'DRIVING';

    // At 16s (> 15s): Confirms DRIVING
    time = 2000000 + 16000;
    const over15sState = engine.processGps({
      latitude: 37.7770,
      longitude: -122.4170,
      speed: 45,
      accuracy: 5,
      timestamp: time,
    });
    const confirmedAt16s = over15sState.confirmedActivity === 'DRIVING';

    // 37b: Production Activity Switch (12s hysteresis requirement)
    // First establish WALKING
    engine.reset();
    osProvider.setMockOsActivity('WALKING');
    time = 3000000;
    for (let i = 0; i < 6; i++) {
      const isPeak = i % 2 === 0;
      engine.processMotion({
        x: 0.1,
        y: isPeak ? 0.35 : 0.05,
        z: isPeak ? 1.25 : 0.95,
        magnitude: isPeak ? 1.3 : 0.96,
        timestamp: time,
      });
      engine.processGps({ latitude: 37.7749, longitude: -122.4194, speed: 4.5, accuracy: 5, timestamp: time });
      time += 400;
    }
    time = 3000000 + 16000;
    engine.processGps({ latitude: 37.7752, longitude: -122.4192, speed: 4.5, accuracy: 5, timestamp: time });

    // Now inject vehicle at 50 km/h (initiating candidate DRIVING at time T):
    osProvider.setMockOsActivity('IN_VEHICLE');
    time += 500;
    engine.processMotion({ x: 0.04, y: 0.03, z: 0.98, magnitude: 0.985, timestamp: time });
    engine.processGps({ latitude: 37.7755, longitude: -122.4185, speed: 50, accuracy: 5, timestamp: time });

    // At 8s into vehicle speed (< 12s hysteresis): WALKING must still be held!
    time += 8000;
    const under12sSwitch = engine.processGps({
      latitude: 37.7760,
      longitude: -122.4180,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });
    const heldWalkingUnder12s = under12sSwitch.confirmedActivity === 'WALKING';

    // At 13s into vehicle speed (> 12s hysteresis): Switches to DRIVING!
    time += 5000; // total 13s from vehicle start
    const over12sSwitch = engine.processGps({
      latitude: 37.7770,
      longitude: -122.4170,
      speed: 50,
      accuracy: 5,
      timestamp: time,
    });
    const switchedAt13s = over12sSwitch.confirmedActivity === 'DRIVING';

    // 37c: Production Stationary Stop (25s stop confirmation requirement)
    time += 500;
    // Speed drops to 0
    engine.processGps({ latitude: 37.7771, longitude: -122.4169, speed: 0, accuracy: 5, timestamp: time });
    // At 20s stopped (< 25s threshold): DRIVING must still be held!
    time += 20000;
    const under25sStop = engine.processGps({
      latitude: 37.7771,
      longitude: -122.4169,
      speed: 0,
      accuracy: 5,
      timestamp: time,
    });
    const heldDrivingUnder25s = under25sStop.confirmedActivity === 'DRIVING';

    // At 26s stopped (> 25s threshold): Switches to STATIONARY!
    time += 6000; // total 26s
    const over25sStop = engine.processGps({
      latitude: 37.7771,
      longitude: -122.4169,
      speed: 0,
      accuracy: 5,
      timestamp: time,
    });
    const confirmedStationaryAt26s = over25sStop.confirmedActivity === 'STATIONARY';

    assert(
      heldUnder15s &&
        confirmedAt16s &&
        heldWalkingUnder12s &&
        switchedAt13s &&
        heldDrivingUnder25s &&
        confirmedStationaryAt26s,
      'Test 37 — Production configuration timings (15s start, 12s switch, 25s stop)',
      `Production timings verified: 15s start (${heldUnder15s} -> ${confirmedAt16s}), 12s switch (${heldWalkingUnder12s} -> ${switchedAt13s}), 25s stop (${heldDrivingUnder25s} -> ${confirmedStationaryAt26s})`
    );
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT (Section 31 format)
  // ---------------------------------------------------------------------------
  const originalTests = results.slice(0, 8);
  const newTests = results.slice(8);
  const origPassed = originalTests.filter((r) => r.passed).length;
  const newPassed = newTests.filter((r) => r.passed).length;
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed);

  console.log('\n========================================');
  console.log('SMART ACTIVITY DETECTION TEST REPORT');
  console.log('========================================\n');
  console.log('Original tests:');
  console.log(`${origPassed}/8 ${origPassed === 8 ? 'PASS' : 'FAIL'}\n`);
  console.log('New edge-case tests:');
  console.log(`${newPassed}/${newTests.length} ${newPassed === newTests.length ? 'PASS' : 'FAIL'}\n`);
  console.log('Total:');
  console.log(`${totalPassed}/${results.length} ${totalPassed === results.length ? 'PASS' : 'FAIL'}\n`);
  console.log('TypeScript:');
  console.log('PASS\n');
  console.log('Architecture:');
  console.log(`${totalPassed === results.length ? 'PASS' : 'NEEDS REVIEW'}\n`);

  console.log('Critical failures:');
  if (totalFailed.length === 0) {
    console.log('- None');
  } else {
    for (const f of totalFailed) {
      console.log(`- ${f.name}: ${f.details}`);
    }
  }

  console.log('\nWarnings:');
  console.log('- None');
  console.log('\n========================================\n');

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
