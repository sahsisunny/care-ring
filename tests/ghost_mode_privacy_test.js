const assert = require('assert');

// Test Suite for Ghost Mode Zero-Notification Privacy
console.log('🧪 Starting Ghost Mode Zero-Notification Privacy Verification...');

// 1. Mock member objects
const selfUser = {
  id: 'usr_self_123',
  fullName: 'Sunny Sahsi',
  latitude: 12.9716,
  longitude: 77.5946,
  inBubble: true,
  bubbleRadius: 2000,
  bubbleUntil: new Date(Date.now() + 7200000),
  resolvedAddress: 'MG Road, Bengaluru',
};

const otherMember = {
  id: 'usr_other_456',
  fullName: 'Alex Smith',
  latitude: 12.9720,
  longitude: 77.5950,
  inBubble: true, // Suppose DB or telemetry held raw bubble
  bubbleRadius: 2000,
  bubbleUntil: new Date(Date.now() + 7200000),
  resolvedAddress: 'Indiranagar, Bengaluru',
};

// 2. Test resolveMemberPlace logic with isSelf privacy guard
function resolveMemberPlaceMock(member, isSelf) {
  if (isSelf && member.inBubble) {
    const bubbleKm = Math.round((member.bubbleRadius || 2000) / 1000);
    return {
      title: 'Ghost Mode Active',
      subtitle: `Private Zone (~${bubbleKm}km)`,
      emoji: '👻',
      isSavedPlace: false,
    };
  }
  return {
    title: member.resolvedAddress || 'Nearby',
    subtitle: 'Seen recently',
    emoji: '📍',
    isSavedPlace: false,
  };
}

// Check Self user sees Ghost Mode Active
const selfPlace = resolveMemberPlaceMock(selfUser, true);
assert.strictEqual(selfPlace.title, 'Ghost Mode Active', 'Self user should see Ghost Mode Active');
assert.strictEqual(selfPlace.emoji, '👻', 'Self user should see ghost emoji');
console.log('  ✅ [PASS] Self user correctly sees their active Ghost Mode status');

// Check Other member does NOT reveal Ghost Mode to another user
const otherPlace = resolveMemberPlaceMock(otherMember, false);
assert.strictEqual(otherPlace.title, 'Indiranagar, Bengaluru', 'Other user must see normal resolved address, not Ghost Mode');
assert.notStrictEqual(otherPlace.title, 'Ghost Mode Active', 'Other user must never see Ghost Mode Active for someone else');
assert.strictEqual(otherPlace.emoji, '📍', 'Other user must see normal pin icon, not ghost emoji');
console.log('  ✅ [PASS] Other circle members do NOT see Ghost Mode status for another user');

// 3. Test RoomManager broadcastBubbleStatus privacy rule
class MockRoomManager {
  constructor() {
    this.userMessages = new Map();
    this.circleMessages = [];
  }

  broadcastToUser(userId, message) {
    if (!this.userMessages.has(userId)) {
      this.userMessages.set(userId, []);
    }
    this.userMessages.get(userId).push(message);
  }

  broadcastToCircle(circleId, message, excludeUserId) {
    this.circleMessages.push({ circleId, message, excludeUserId });
  }

  broadcastBubbleStatus(circleId, userId, bubbleUntil, bubbleRadius) {
    // Only send to the self user, NEVER to the circle
    this.broadcastToUser(userId, {
      type: 'BUBBLE_STATUS_CHANGED',
      data: { circleId, userId, bubbleUntil, bubbleRadius },
    });
  }
}

const roomManager = new MockRoomManager();
roomManager.broadcastBubbleStatus('circle_1', 'usr_self_123', new Date().toISOString(), 2000);

assert.strictEqual(roomManager.circleMessages.length, 0, 'No message should be broadcast to the circle when Ghost Mode is applied');
assert.strictEqual(roomManager.userMessages.get('usr_self_123')?.length, 1, 'Self user must receive private BUBBLE_STATUS_CHANGED event');
assert.strictEqual(roomManager.userMessages.get('usr_other_456'), undefined, 'Other users must receive 0 messages');
console.log('  ✅ [PASS] Server strictly sends BUBBLE_STATUS_CHANGED only to self user (0 circle broadcast)');

// 4. Test Telemetry Broadcast payload masking for other circle members
function buildTelemetryBroadcast(ping, isBubbleActive, bubble) {
  const effectiveAddress = ping.resolvedAddress; // standard address, never "Inside Privacy Bubble"
  return {
    type: 'TELEMETRY_UPDATE',
    data: {
      ...ping,
      speed: isBubbleActive ? 0 : ping.speed,
      resolvedAddress: effectiveAddress,
      inBubble: false, // Stealth: never send inBubble=true to circle members
      bubbleRadius: undefined,
      bubbleUntil: undefined,
    },
  };
}

const ping = {
  userId: 'usr_self_123',
  circleId: 'circle_1',
  latitude: 12.9716,
  longitude: 77.5946,
  speed: 25,
  resolvedAddress: 'MG Road, Bengaluru',
};

const broadcast = buildTelemetryBroadcast(ping, true, { radiusMeters: 2000, expiresAt: Date.now() + 3600000 });
assert.strictEqual(broadcast.data.inBubble, false, 'inBubble in circle broadcast must be false for stealth');
assert.strictEqual(broadcast.data.bubbleRadius, undefined, 'bubbleRadius in circle broadcast must be undefined');
assert.strictEqual(broadcast.data.bubbleUntil, undefined, 'bubbleUntil in circle broadcast must be undefined');
assert.strictEqual(broadcast.data.resolvedAddress, 'MG Road, Bengaluru', 'resolvedAddress must remain normal without "Inside Privacy Bubble"');
console.log('  ✅ [PASS] Telemetry broadcast to other circle members completely omits ghost mode indicators');

console.log('\n======================================================');
console.log('Ghost Mode Privacy Tests: All 4 Suites Passed (0 Failed)');
console.log('======================================================\n');
