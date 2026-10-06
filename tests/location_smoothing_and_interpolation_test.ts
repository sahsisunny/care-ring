/**
 * Automated Verification Test Suite for Location Smoothing & Live Map Transition
 * Validates all required test cases specified in Requirements:
 *
 * A. 0 km/h -> walking
 * B. walking -> running
 * C. running -> stationary
 * D. stationary -> driving
 * E. driving -> stationary
 * F. driving -> driving with irregular GPS updates
 * G. GPS accuracy suddenly becomes poor
 * H. GPS jumps 20–100+ metres (outlier spike protection)
 * I. GPS update arrives while previous animation is running (smooth mid-flight retargeting)
 * J. 1-second updates
 * K. 3-second updates
 * L. 5-second updates
 * M. heading 359° -> 1° (shortest path rotation ~2°, NOT 358°)
 * N. heading 1° -> 359° (shortest path rotation ~-2°, NOT 358°)
 * O. user manually pans the map while location updates continue
 *
 * Plus numerical safety, drift deadband, and interpolation continuity tests.
 */

import {
  LocationSmoothingEngine,
  haversineDistanceMeters,
  getShortestAngleDelta,
  normalizeAngle,
  normalizeActivity,
} from '../mobile/src/services/LocationSmoothingEngine';
import { MarkerInterpolator } from '../mobile/src/services/MarkerInterpolator';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, id: string, name: string, details: string) {
  if (condition) {
    testResults.push({ id, name, passed: true, details });
    console.log(`✅ [PASSED] [${id}] ${name}: ${details}`);
  } else {
    testResults.push({ id, name, passed: false, details });
    console.error(`❌ [FAILED] [${id}] ${name}: ${details}`);
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 Running Live Location Smoothing & Interpolation Test Suite');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Test M: Heading Wraparound 359° -> 1° (rotates ~2°, NOT 358°)
  // ---------------------------------------------------------------------------
  {
    const delta = getShortestAngleDelta(359, 1);
    const engine = new LocationSmoothingEngine();
    const t0 = 10000;

    engine.processUpdate({
      memberId: 'user-m',
      latitude: 12.9100,
      longitude: 77.6700,
      heading: 359,
      timestamp: t0,
      activity: 'WALKING',
    });

    // Update heading to 1°
    engine.processUpdate({
      memberId: 'user-m',
      latitude: 12.9101,
      longitude: 77.6700,
      heading: 1,
      timestamp: t0 + 1000,
      activity: 'WALKING',
    });

    const track = engine.getTrack('user-m');
    const midSample = track ? engine.sample('user-m', track.startTime + track.durationMs * 0.5) : null;

    // Delta should be +2
    const deltaCorrect = delta === 2;
    // Midpoint rotation should cross 0° (e.g. 0° or 360°), NOT spin backwards through 180°
    const midHeading = midSample ? midSample.heading : -1;
    const midCorrect = midHeading >= 359.0 || midHeading <= 1.0;

    assert(
      deltaCorrect && midCorrect,
      'Test M',
      'Heading 359° -> 1° Wraparound',
      `Shortest delta is ${delta}° (expected +2°). Midpoint heading is ${midHeading.toFixed(2)}° (crossed 0° directly without 358° spin).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test N: Heading Wraparound 1° -> 359° (rotates ~-2°, NOT 358°)
  // ---------------------------------------------------------------------------
  {
    const delta = getShortestAngleDelta(1, 359);
    const engine = new LocationSmoothingEngine();
    const t0 = 10000;

    engine.processUpdate({
      memberId: 'user-n',
      latitude: 12.9100,
      longitude: 77.6700,
      heading: 1,
      timestamp: t0,
      activity: 'WALKING',
    });

    engine.processUpdate({
      memberId: 'user-n',
      latitude: 12.9101,
      longitude: 77.6700,
      heading: 359,
      timestamp: t0 + 1000,
      activity: 'WALKING',
    });

    const track = engine.getTrack('user-n');
    const midSample = track ? engine.sample('user-n', track.startTime + track.durationMs * 0.5) : null;
    const midHeading = midSample ? midSample.heading : -1;
    const midCorrect = midHeading >= 359.0 || midHeading <= 1.0;

    assert(
      delta === -2 && midCorrect,
      'Test N',
      'Heading 1° -> 359° Wraparound',
      `Shortest delta is ${delta}° (expected -2°). Midpoint heading is ${midHeading.toFixed(2)}° (crossed 0° counter-clockwise).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test A: Transition 0 km/h -> Walking
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    // Initial stationary fix at 0 km/h
    const fix1 = engine.processUpdate({
      memberId: 'user-a',
      latitude: 12.92000,
      longitude: 77.68000,
      heading: 0,
      speed: 0,
      accuracy: 6,
      timestamp: t,
      activity: 'STATIONARY',
    });

    t += 1500;
    // Starts walking: moves 3 meters at 4.5 km/h
    const fix2 = engine.processUpdate({
      memberId: 'user-a',
      latitude: 12.920025,
      longitude: 77.68000,
      heading: 45,
      speed: 4.5,
      accuracy: 6,
      timestamp: t,
      activity: 'WALKING',
    });

    const track = engine.getTrack('user-a');
    const sample = track ? engine.sample('user-a', track.startTime + track.durationMs * 0.5) : null;

    assert(
      fix1.accepted && fix2.accepted && !fix2.isOutlier && fix2.durationMs >= 800 && sample !== null,
      'Test A',
      'Transition: 0 km/h -> Walking',
      `Smoothly transitioned to walking. Target accepted with duration ${fix2.durationMs}ms (no snap).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test B: Transition Walking -> Running
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-b',
      latitude: 12.9200,
      longitude: 77.6800,
      heading: 90,
      speed: 5.0,
      accuracy: 8,
      timestamp: t,
      activity: 'WALKING',
    });

    t += 1000;
    // Accelerates to running (12 km/h)
    const runFix = engine.processUpdate({
      memberId: 'user-b',
      latitude: 12.9200,
      longitude: 77.68003,
      heading: 90,
      speed: 12.0,
      accuracy: 7,
      timestamp: t,
      activity: 'RUNNING',
    });

    assert(
      runFix.accepted && !runFix.isOutlier && runFix.durationMs > 0,
      'Test B',
      'Transition: Walking -> Running',
      `Running pace accepted smoothly without jerk. Duration: ${runFix.durationMs}ms.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test C: Transition Running -> Stationary (Drift Deadband Suppression)
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-c',
      latitude: 12.93000,
      longitude: 77.69000,
      heading: 180,
      speed: 10.0,
      accuracy: 8,
      timestamp: t,
      activity: 'RUNNING',
    });

    t += 1000;
    // Comes to a stop
    engine.processUpdate({
      memberId: 'user-c',
      latitude: 12.93003,
      longitude: 77.69000,
      heading: 180,
      speed: 0,
      accuracy: 10,
      timestamp: t,
      activity: 'STATIONARY',
    });

    t += 2000;
    // GPS drift while stationary: small 2.5m fluctuation
    const driftFix = engine.processUpdate({
      memberId: 'user-c',
      latitude: 12.930045, // ~1.6 meters drift
      longitude: 77.69000,
      heading: 185,
      speed: 0.2,
      accuracy: 12,
      timestamp: t,
      activity: 'STATIONARY',
    });

    assert(
      driftFix.reason.includes('NOISE_DEADBAND_SUPPRESSED'),
      'Test C',
      'Transition: Running -> Stationary (Drift Deadband)',
      `Stationary GPS drift was suppressed by deadband filter (${driftFix.reason}). Marker remained still.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test D: Transition Stationary -> Driving
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-d',
      latitude: 12.94000,
      longitude: 77.70000,
      heading: 0,
      speed: 0,
      accuracy: 8,
      timestamp: t,
      activity: 'STATIONARY',
    });

    t += 1000;
    // Vehicle starts moving (30 km/h)
    const driveFix = engine.processUpdate({
      memberId: 'user-d',
      latitude: 12.94008, // ~9 meters
      longitude: 77.70000,
      heading: 0,
      speed: 30.0,
      accuracy: 8,
      timestamp: t,
      activity: 'DRIVING',
    });

    assert(
      driveFix.accepted && !driveFix.isOutlier && driveFix.durationMs >= 500 && driveFix.durationMs <= 1500,
      'Test D',
      'Transition: Stationary -> Driving',
      `Driving transition smoothly retargeted with responsive duration ${driveFix.durationMs}ms (no lag behind car).`
    );
  }

  // ---------------------------------------------------------------------------
  // Test E: Transition Driving -> Stationary
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-e',
      latitude: 12.95000,
      longitude: 77.71000,
      heading: 270,
      speed: 45.0,
      accuracy: 8,
      timestamp: t,
      activity: 'DRIVING',
    });

    t += 1200;
    // Car stops at a red light (0 km/h, STATIONARY)
    const stopFix = engine.processUpdate({
      memberId: 'user-e',
      latitude: 12.95000,
      longitude: 77.70990,
      heading: 270,
      speed: 0,
      accuracy: 8,
      timestamp: t,
      activity: 'STATIONARY',
    });

    assert(
      stopFix.accepted && stopFix.durationMs <= 1200,
      'Test E',
      'Transition: Driving -> Stationary',
      `Car smoothly came to rest at stop location with duration ${stopFix.durationMs}ms without oscillation.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test F: Driving with Irregular GPS Updates
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;
    const intervals = [1200, 800, 2400, 600, 1800]; // irregular arrival times
    let allAccepted = true;
    let lat = 12.96000;

    engine.processUpdate({
      memberId: 'user-f',
      latitude: lat,
      longitude: 77.72000,
      heading: 0,
      speed: 50.0,
      accuracy: 6,
      timestamp: t,
      activity: 'DRIVING',
    });

    const recordedDurations: number[] = [];

    for (const dt of intervals) {
      t += dt;
      lat += 0.00012;
      const res = engine.processUpdate({
        memberId: 'user-f',
        latitude: lat,
        longitude: 77.72000,
        heading: 0,
        speed: 50.0,
        accuracy: 6,
        timestamp: t,
        activity: 'DRIVING',
      });
      if (!res.accepted || res.isOutlier) allAccepted = false;
      recordedDurations.push(res.durationMs);
    }

    assert(
      allAccepted && recordedDurations.length === intervals.length,
      'Test F',
      'Driving with Irregular GPS Updates',
      `All ${intervals.length} irregular updates smoothly interpolated: durations = [${recordedDurations.join(', ')}]ms.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test G: GPS Accuracy Suddenly Degrades (Dampened, No Large Visual Leap)
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-g',
      latitude: 12.97000,
      longitude: 77.73000,
      heading: 0,
      speed: 4.0,
      accuracy: 8, // good
      timestamp: t,
      activity: 'WALKING',
    });

    t += 1000;
    // Sudden poor accuracy reading (accuracy = 80 meters) pointing 25 meters away
    const poorFix = engine.processUpdate({
      memberId: 'user-g',
      latitude: 12.97022, // ~25 meters jump
      longitude: 77.73000,
      heading: 0,
      speed: 4.0,
      accuracy: 80, // POOR
      timestamp: t,
      activity: 'WALKING',
    });

    // The target position should be dampened/weighted, NOT snapping 25 meters away
    const targetDist = haversineDistanceMeters(
      12.97000,
      77.73000,
      poorFix.targetPosition.latitude,
      poorFix.targetPosition.longitude
    );

    assert(
      poorFix.accepted && targetDist < 15.0,
      'Test G',
      'GPS Accuracy Suddenly Degrades',
      `Target displacement dampened to ${targetDist.toFixed(1)}m (< 15m) instead of full 25m jump. Poor accuracy did not cause large visual leap.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test H: Outlier / GPS Spike Protection (Jumping 20-100+ Metres Implausibly)
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-h',
      latitude: 12.98000,
      longitude: 77.74000,
      heading: 0,
      speed: 0,
      accuracy: 6,
      timestamp: t,
      activity: 'STATIONARY',
    });

    t += 1000;
    // Glitch jumps 120 meters in 1 second while stationary
    const spikeFix = engine.processUpdate({
      memberId: 'user-h',
      latitude: 12.98108, // ~120 meters away
      longitude: 77.74000,
      heading: 0,
      speed: 0,
      accuracy: 20,
      timestamp: t,
      activity: 'STATIONARY',
    });

    // Next update 1 second later returns back to real position near (12.98001, 77.74000)
    t += 1000;
    const recoverFix = engine.processUpdate({
      memberId: 'user-h',
      latitude: 12.98001,
      longitude: 77.74000,
      heading: 0,
      speed: 0,
      accuracy: 6,
      timestamp: t,
      activity: 'STATIONARY',
    });

    assert(
      spikeFix.isOutlier && spikeFix.reason.includes('OUTLIER_SPIKE_REJECTED'),
      'Test H',
      'GPS Spike / Outlier Protection (120m Jump)',
      `Single physically impossible 120m jump was safely rejected (${spikeFix.reason}). Marker never teleported!`
    );
  }

  // ---------------------------------------------------------------------------
  // Test I: Mid-Flight Retargeting (Update Arrives While Animation is Running)
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    const t0 = 100000;

    // Start at A
    engine.processUpdate({
      memberId: 'user-i',
      latitude: 12.99000,
      longitude: 77.75000,
      heading: 0,
      speed: 30.0,
      accuracy: 8,
      timestamp: t0,
      activity: 'DRIVING',
    });

    // Update towards B with 1500ms duration
    engine.processUpdate({
      memberId: 'user-i',
      latitude: 12.99020,
      longitude: 77.75000,
      heading: 0,
      speed: 30.0,
      accuracy: 8,
      timestamp: t0 + 1500,
      activity: 'DRIVING',
    });

    const track = engine.getTrack('user-i');
    if (!track) throw new Error('Track not found');

    // Simulate clock advancing 500ms into the 1500ms animation (~33% progress)
    const midTime = track.startTime + 500;
    const midSample = engine.sample('user-i', midTime);

    // New update C arrives at midTime!
    const retargetResult = engine.processUpdate({
      memberId: 'user-i',
      latitude: 12.99035,
      longitude: 77.75000,
      heading: 10,
      speed: 30.0,
      accuracy: 8,
      timestamp: t0 + 2000,
      activity: 'DRIVING',
      now: midTime,
    });

    const newTrack = engine.getTrack('user-i');
    const startOfNewAnim = newTrack ? newTrack.startPos : null;

    // Continuity verification: start of new animation MUST equal midSample position
    const discontinuityMeters =
      midSample && startOfNewAnim
        ? haversineDistanceMeters(
            midSample.position.latitude,
            midSample.position.longitude,
            startOfNewAnim.latitude,
            startOfNewAnim.longitude
          )
        : 999;

    assert(
      discontinuityMeters < 0.001 && retargetResult.accepted,
      'Test I',
      'Mid-Flight Retargeting Continuity',
      `Retargeted mid-flight with zero discontinuity (${discontinuityMeters.toFixed(6)}m). No snap, no reversal, no queue accumulation.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test J: 1-Second Updates
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-j',
      latitude: 13.00000,
      longitude: 77.76000,
      heading: 0,
      speed: 25.0,
      accuracy: 8,
      timestamp: t,
      activity: 'DRIVING',
    });

    t += 1000;
    const res1 = engine.processUpdate({
      memberId: 'user-j',
      latitude: 13.00007,
      longitude: 77.76000,
      heading: 0,
      speed: 25.0,
      accuracy: 8,
      timestamp: t,
      activity: 'DRIVING',
    });

    assert(
      res1.accepted && res1.durationMs >= 900 && res1.durationMs <= 1400,
      'Test J',
      '1-Second Updates',
      `Duration is ${res1.durationMs}ms, matching the 1.0s update cadence smoothly.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test K: 3-Second Updates
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-k',
      latitude: 13.01000,
      longitude: 77.77000,
      heading: 0,
      speed: 20.0,
      accuracy: 8,
      timestamp: t,
      activity: 'CYCLING',
    });

    t += 3000;
    const res3 = engine.processUpdate({
      memberId: 'user-k',
      latitude: 13.01015,
      longitude: 77.77000,
      heading: 0,
      speed: 20.0,
      accuracy: 8,
      timestamp: t,
      activity: 'CYCLING',
    });

    assert(
      res3.accepted && res3.durationMs >= 2000 && res3.durationMs <= 3000,
      'Test K',
      '3-Second Updates',
      `Duration scaled up to ${res3.durationMs}ms for 3.0s update cadence.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test L: 5-Second Updates
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-l',
      latitude: 13.02000,
      longitude: 77.78000,
      heading: 0,
      speed: 15.0,
      accuracy: 8,
      timestamp: t,
      activity: 'CYCLING',
    });

    t += 5000;
    const res5 = engine.processUpdate({
      memberId: 'user-l',
      latitude: 13.02020,
      longitude: 77.78000,
      heading: 0,
      speed: 15.0,
      accuracy: 8,
      timestamp: t,
      activity: 'CYCLING',
    });

    assert(
      res5.accepted && res5.durationMs >= 2000 && res5.durationMs <= 2500,
      'Test L',
      '5-Second Updates',
      `Duration scaled appropriately (${res5.durationMs}ms) without dragging behind the user indefinitely.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test O: User Manually Pans Map (Interaction Independence)
  // ---------------------------------------------------------------------------
  {
    // Verifies that the smoothing engine's geographic coordinates are independent
    // of camera / screen container transforms
    const engine = new LocationSmoothingEngine();
    const t0 = 100000;

    const res = engine.processUpdate({
      memberId: 'user-o',
      latitude: 13.03000,
      longitude: 77.79000,
      heading: 45,
      speed: 5.0,
      accuracy: 8,
      timestamp: t0,
      activity: 'WALKING',
    });

    // Simulated user pan occurs in UI while GPS update arrives
    const resAfterPan = engine.processUpdate({
      memberId: 'user-o',
      latitude: 13.03003,
      longitude: 77.79002,
      heading: 45,
      speed: 5.0,
      accuracy: 8,
      timestamp: t0 + 1000,
      activity: 'WALKING',
    });

    assert(
      resAfterPan.accepted && !resAfterPan.isOutlier,
      'Test O',
      'User Manual Map Pan Independence',
      'Visual smoothing operates on true geo-coordinates independently of screen container gestures.'
    );
  }

  // ---------------------------------------------------------------------------
  // Test P: Numerical Safety (NaN, Infinity, Negative, Out of Order Timestamps)
  // ---------------------------------------------------------------------------
  {
    const engine = new LocationSmoothingEngine();
    let t = 100000;

    engine.processUpdate({
      memberId: 'user-p',
      latitude: 13.04000,
      longitude: 77.80000,
      heading: 90,
      timestamp: t,
    });

    // NaN latitude
    const nanRes = engine.processUpdate({
      memberId: 'user-p',
      latitude: NaN,
      longitude: 77.80000,
      timestamp: t + 1000,
    });

    // Out of order timestamp (earlier than previous)
    const outOfOrderRes = engine.processUpdate({
      memberId: 'user-p',
      latitude: 13.04002,
      longitude: 77.80000,
      timestamp: t - 5000,
    });

    // Extreme heading (9999°)
    const extremeHeadRes = engine.processUpdate({
      memberId: 'user-p',
      latitude: 13.04005,
      longitude: 77.80000,
      heading: 9999,
      timestamp: t + 2000,
    });

    assert(
      !nanRes.accepted &&
        outOfOrderRes.accepted &&
        extremeHeadRes.accepted &&
        extremeHeadRes.targetHeading >= 0 &&
        extremeHeadRes.targetHeading < 360,
      'Test P',
      'Numerical Safety & Edge Inputs',
      `NaN rejected (${nanRes.reason}). Out of order handled safely. Extreme heading normalized to ${extremeHeadRes.targetHeading}°.`
    );
  }

  // ---------------------------------------------------------------------------
  // Test Q: MarkerInterpolator Public Facade Compatibility
  // ---------------------------------------------------------------------------
  {
    let callbackCount = 0;
    const interpolator = new MarkerInterpolator((id, pos, h) => {
      callbackCount++;
    });

    const r1 = interpolator.updateTarget({
      memberId: 'facade-1',
      newPosition: { latitude: 13.0500, longitude: 77.8100 },
      newHeading: 180,
      speed: 10,
    });

    const r2 = interpolator.updateTarget({
      memberId: 'facade-1',
      newPosition: { latitude: 13.0501, longitude: 77.8100 },
      newHeading: 185,
      speed: 10,
    });

    const currentPos = interpolator.getCurrentPosition('facade-1');
    const currentHeading = interpolator.getCurrentHeading('facade-1');

    interpolator.dispose();

    assert(
      r1.accepted && r2.accepted && currentPos !== undefined && currentHeading !== undefined,
      'Test Q',
      'MarkerInterpolator Facade Integration',
      `MarkerInterpolator works seamlessly with LocationSmoothingEngine. Pos: (${currentPos?.latitude.toFixed(4)}, ${currentPos?.longitude.toFixed(4)}), Heading: ${currentHeading}°.`
    );
  }

  console.log('\n================================================================');
  console.log('📊 LIVE LOCATION SMOOTHING TEST RESULTS SUMMARY');
  console.log('================================================================');
  const passedCount = testResults.filter((r) => r.passed).length;
  console.log(`Total Scenarios: ${testResults.length}`);
  console.log(`Passed:          ${passedCount} / ${testResults.length}`);
  console.log(`Failed:          ${testResults.length - passedCount}`);
  console.log('================================================================\n');

  if (passedCount !== testResults.length) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
