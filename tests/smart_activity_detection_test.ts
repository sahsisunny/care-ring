/**
 * Automated Verification Test Suite for Smart Activity Detection
 * Validates all 8 required test cases specified in Section 31 of Smart Activity Detection.md
 */

import { ActivityConfig } from '../mobile/src/activity/ActivityConfig';
import { ActivityRecognitionProvider } from '../mobile/src/activity/ActivityRecognitionProvider';
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

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`📊 Test Summary: ${passedCount}/${results.length} Tests Passed`);
  console.log('================================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
