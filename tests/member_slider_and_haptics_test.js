/**
 * Automated Verification Test for Member Carousel Sliding, Down-to-Top Animation, Map Stability & Haptics
 */

// 1. Slider member computation logic from BottomDraggableSheet
function computeSliderMembers(members, selectedMember) {
  if (!Array.isArray(members) || members.length === 0) {
    return selectedMember ? [selectedMember] : [];
  }
  const exists = members.some((m) => m.id === selectedMember?.id);
  if (selectedMember && !exists) {
    return [selectedMember, ...members];
  }
  return members;
}

function getMemberIndex(sliderMembers, selectedMember) {
  if (!selectedMember || sliderMembers.length === 0) return 0;
  const idx = sliderMembers.findIndex((m) => m.id === selectedMember.id);
  return idx >= 0 ? idx : 0;
}

function computeNextMemberIndex(currentIndex, totalMembers) {
  if (currentIndex < totalMembers - 1) {
    return currentIndex + 1;
  }
  return currentIndex;
}

function computePrevMemberIndex(currentIndex) {
  if (currentIndex > 0) {
    return currentIndex - 1;
  }
  return 0;
}

function formatMemberIndicator(currentIndex, totalMembers) {
  return `${currentIndex + 1} of ${totalMembers}`;
}

// 2. Down-to-Top Card Animation Interpolator simulation
function interpolateCardDownToTop(scrollX, cardIndex, screenWidth, maxDrop = 75) {
  const cardCenter = cardIndex * screenWidth;
  const leftNeighbor = (cardIndex - 1) * screenWidth;
  const rightNeighbor = (cardIndex + 1) * screenWidth;

  let translateY = maxDrop;
  let opacity = 0.35;
  let scale = 0.93;

  if (scrollX <= leftNeighbor) {
    translateY = maxDrop;
    opacity = 0.35;
    scale = 0.93;
  } else if (scrollX < cardCenter) {
    const progress = (scrollX - leftNeighbor) / screenWidth;
    translateY = maxDrop * (1 - progress);
    opacity = 0.35 + 0.65 * progress;
    scale = 0.93 + 0.07 * progress;
  } else if (scrollX === cardCenter) {
    translateY = 0;
    opacity = 1.0;
    scale = 1.0;
  } else if (scrollX < rightNeighbor) {
    const progress = (scrollX - cardCenter) / screenWidth;
    translateY = maxDrop * progress;
    opacity = 1.0 - 0.65 * progress;
    scale = 1.0 - 0.07 * progress;
  } else {
    translateY = maxDrop;
    opacity = 0.35;
    scale = 0.93;
  }

  return { translateY, opacity, scale };
}

// 3. Map Camera Stability Logic Simulation (Testing panToPosition logic)
function simulateCameraMovement(currentCenter, currentZoom, targetLat, targetLng, targetZoom) {
  const R = 6371000; // meters
  const dLat = (targetLat - currentCenter.lat) * Math.PI / 180;
  const dLng = (targetLng - currentCenter.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(currentCenter.lat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distMeters = R * c;

  if (distMeters < 25 && Math.abs(currentZoom - targetZoom) < 0.3) {
    return { action: 'NO_MOVE', reason: 'already_focused_or_same_cluster', distMeters };
  }
  if (distMeters < 4500 && Math.abs(currentZoom - targetZoom) <= 1.2) {
    return { action: 'SMOOTH_PAN', reason: 'nearby_glide_without_zoom_shake', distMeters };
  }
  return { action: 'FLY_TO', reason: 'distant_target', distMeters };
}

// 4. Haptic feedback contract simulation
class HapticSimulator {
  constructor() {
    this.history = [];
  }

  light() {
    this.history.push({ type: 'light', duration: 10 });
    this.fallbackVibrate(10);
  }

  selection() {
    this.history.push({ type: 'selection', duration: 8 });
    this.fallbackVibrate(8);
  }

  medium() {
    this.history.push({ type: 'medium', duration: 20 });
    this.fallbackVibrate(20);
  }

  heavy() {
    this.history.push({ type: 'heavy', duration: 35 });
    this.fallbackVibrate(35);
  }

  fallbackVibrate(ms) {
    if (typeof global !== 'undefined' && global.window && global.window.navigator && global.window.navigator.vibrate) {
      global.window.navigator.vibrate(ms);
    }
  }
}

function runTests() {
  console.log('🧪 Starting Member Carousel, Down-To-Top Animation, Map Stability & Haptics Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}: ${detail}`);
      failed++;
    }
  }

  // Suite 1: Multi-member Carousel Sliding
  console.log('--- Suite 1: Multi-member Carousel Track & Navigation ---');
  const members = [
    { id: 'user-1', fullName: 'Alice Johnson', latitude: 37.7749, longitude: -122.4194 },
    { id: 'user-2', fullName: 'Bob Smith', latitude: 37.77495, longitude: -122.41945 }, // Same cluster (< 10m)
    { id: 'user-3', fullName: 'Charlie Davis', latitude: 37.7850, longitude: -122.4100 }, // 1.2km away
  ];

  const slider = computeSliderMembers(members, members[0]);
  assert(slider.length === 3, 'All members included in carousel slider (not just one)');
  assert(slider[0].id === 'user-1' && slider[2].id === 'user-3', 'Member sequence intact');

  assert(getMemberIndex(slider, members[0]) === 0, 'Current index is 0 for Alice');
  assert(getMemberIndex(slider, members[1]) === 1, 'Current index is 1 for Bob');
  assert(getMemberIndex(slider, members[2]) === 2, 'Current index is 2 for Charlie');

  assert(computeNextMemberIndex(0, 3) === 1, 'Slide next moves 0 -> 1');
  assert(computeNextMemberIndex(1, 3) === 2, 'Slide next moves 1 -> 2');
  assert(computeNextMemberIndex(2, 3) === 2, 'Slide next clamps at end');

  assert(computePrevMemberIndex(2) === 1, 'Slide prev moves 2 -> 1');
  assert(computePrevMemberIndex(1) === 0, 'Slide prev moves 1 -> 0');
  assert(computePrevMemberIndex(0) === 0, 'Slide prev clamps at start');

  assert(formatMemberIndicator(0, 3) === '1 of 3', 'Indicator formats 1 of 3');
  assert(formatMemberIndicator(1, 3) === '2 of 3', 'Indicator formats 2 of 3');
  assert(formatMemberIndicator(2, 3) === '3 of 3', 'Indicator formats 3 of 3');

  // Suite 2: Down-to-Top Animation Verification
  console.log('\n--- Suite 2: Down-to-Top Entrance Animation on Swipe ---');
  const SCREEN_WIDTH = 390;

  const card0AtStart = interpolateCardDownToTop(0, 0, SCREEN_WIDTH);
  const card1AtStart = interpolateCardDownToTop(0, 1, SCREEN_WIDTH);
  assert(card0AtStart.translateY === 0, 'Card 0 translateY is 0 at center (fully visible)');
  assert(card1AtStart.translateY === 75, 'Card 1 starts down (+75px translateY) before entering');

  // Left swipe
  const card1HalfwaySwipe = interpolateCardDownToTop(SCREEN_WIDTH * 0.5, 1, SCREEN_WIDTH);
  assert(
    card1HalfwaySwipe.translateY < 75 && card1HalfwaySwipe.translateY > 0,
    `Card 1 smoothly rises upwards on left swipe (translateY = ${card1HalfwaySwipe.translateY.toFixed(1)}px)`
  );

  const card1AtCenter = interpolateCardDownToTop(SCREEN_WIDTH, 1, SCREEN_WIDTH);
  assert(card1AtCenter.translateY === 0, 'Card 1 completes rise to 0px at center (appeared down-to-top)');

  // Right swipe
  const card0HalfwayRightSwipe = interpolateCardDownToTop(SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH);
  assert(
    card0HalfwayRightSwipe.translateY < 75 && card0HalfwayRightSwipe.translateY > 0,
    `Card 0 smoothly rises upwards on right swipe (translateY = ${card0HalfwayRightSwipe.translateY.toFixed(1)}px)`
  );
  assert(
    card0HalfwayRightSwipe.opacity > 0.35 && card0HalfwayRightSwipe.opacity < 1.0,
    'Card fades in concurrently with bottom-up rise'
  );

  // Suite 3: Map Camera Stability (Fixes shaking)
  console.log('\n--- Suite 3: Map Camera Stability (Eliminating Shaking) ---');

  // Case 3.1: Alice and Bob are together in the same cluster (< 10 meters apart)
  const currentCameraAtAlice = { lat: 37.7749, lng: -122.4194 };
  const cameraMoveToBob = simulateCameraMovement(
    currentCameraAtAlice, 16.5,
    members[1].latitude, members[1].longitude, 16.5
  );
  assert(
    cameraMoveToBob.action === 'NO_MOVE',
    `Switching between people together in same cluster triggers NO camera move (distance: ${cameraMoveToBob.distMeters.toFixed(1)}m, eliminates shaking)`
  );

  // Case 3.2: Switching to Charlie who is 1.2km away in the same city
  const cameraMoveToCharlie = simulateCameraMovement(
    currentCameraAtAlice, 16.5,
    members[2].latitude, members[2].longitude, 16.5
  );
  assert(
    cameraMoveToCharlie.action === 'SMOOTH_PAN',
    `Switching to Charlie uses smooth panTo without parabolic zoom-out shake (distance: ${cameraMoveToCharlie.distMeters.toFixed(1)}m)`
  );

  // Suite 4: Haptic Feedback Service
  console.log('\n--- Suite 4: Haptic Feedback Service ---');
  const haptics = new HapticSimulator();

  let webVibratedMs = null;
  global.window = {
    navigator: {
      vibrate: (ms) => {
        webVibratedMs = ms;
      },
    },
  };

  haptics.selection();
  assert(haptics.history.length === 1 && haptics.history[0].type === 'selection', 'Haptic selection event recorded for profile slide');
  assert(webVibratedMs === 8, 'Web vibrate fallback fired with 8ms for selection tick');

  haptics.light();
  assert(haptics.history[1].type === 'light', 'Haptic light event recorded for tab switch and arrow navigation');
  assert(webVibratedMs === 10, 'Web vibrate fallback fired with 10ms for light tap');

  haptics.medium();
  assert(haptics.history[2].type === 'medium', 'Haptic medium event recorded for action buttons (Check in / Ghost)');

  haptics.heavy();
  assert(haptics.history[3].type === 'heavy', 'Haptic heavy event recorded for SOS button');

  delete global.window;

  console.log(`\n======================================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
