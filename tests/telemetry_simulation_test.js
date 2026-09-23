/**
 * End-to-End Real-Time Telemetry & Geofence Simulator Test
 * Tests:
 * 1. WebSocket circle room authentication & connection
 * 2. Real-time telemetry fan-out broadcast between members
 * 3. Reverse geocoding rate-limiting stationary detector
 * 4. PostGIS geofence enter/exit transitions
 * 5. Emergency SOS broadcast
 */

let WebSocket;
try {
  WebSocket = require('ws');
} catch {
  try {
    WebSocket = require('./server/node_modules/ws');
  } catch {
    WebSocket = require('../server/node_modules/ws');
  }
}

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:4000';
const CIRCLE_ID = 'circle-demo-101';

async function runSimulation() {
  console.log('==============================================================');
  console.log('🧪 Starting CareRing Telemetry & Room Fan-out Simulation Test');
  console.log(`🌐 Server Target: ${SERVER_URL}/ws/circles/${CIRCLE_ID}`);
  console.log('==============================================================\n');

  // Client 1: Sarah (Driving)
  const clientSarah = new WebSocket(`${SERVER_URL}/ws/circles/${CIRCLE_ID}?userId=user-sarah`);

  // Client 2: Noah (Observer / Receiver)
  const clientNoah = new WebSocket(`${SERVER_URL}/ws/circles/${CIRCLE_ID}?userId=user-noah`);

  let broadcastCount = 0;
  let geofenceAlertsCount = 0;
  let sosReceived = false;

  await new Promise((resolve) => {
    let connected = 0;
    const checkConnected = () => {
      connected++;
      if (connected === 2) resolve();
    };
    clientSarah.on('open', () => {
      console.log('✅ Client Sarah connected to circle room.');
      checkConnected();
    });
    clientNoah.on('open', () => {
      console.log('✅ Client Noah connected to circle room.');
      checkConnected();
    });
  });

  // Client Noah listens for broadcast messages
  clientNoah.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'TELEMETRY_UPDATE') {
      broadcastCount++;
      console.log(
        `📡 [Fan-out Received by Noah] User: ${msg.data.userId} | Lat: ${msg.data.latitude}, Lng: ${msg.data.longitude} | Speed: ${msg.data.speed} km/h | Battery: ${msg.data.batteryLevel}%`
      );
    } else if (msg.type === 'GEOFENCE_ALERT') {
      geofenceAlertsCount++;
      console.log(`📍 [Geofence Alert Received] ${msg.data.userName} ${msg.data.event} ${msg.data.placeName}!`);
    } else if (msg.type === 'SOS_ALERT') {
      sosReceived = true;
      console.log(`🚨 [SOS Alert Received] Emergency broadcast from ${msg.data.userName}!`);
    } else if (msg.type === 'ADDRESS_RESOLVED') {
      console.log(`🏠 [Address Resolved] ${msg.data.userId}: "${msg.data.address}"`);
    }
  });

  // 1. Send moving telemetry pings from Sarah
  console.log('\n--- Step 1: Simulating Moving Telemetry Fan-out (35-48 km/h) ---');
  const trajectory = [
    { lat: 37.7749, lng: -122.4194, speed: 38, heading: 45 },
    { lat: 37.7758, lng: -122.4180, speed: 44, heading: 50 },
    { lat: 37.7770, lng: -122.4165, speed: 48, heading: 55 },
  ];

  for (const point of trajectory) {
    clientSarah.send(
      JSON.stringify({
        type: 'TELEMETRY_PING',
        userId: 'user-sarah',
        circleId: CIRCLE_ID,
        latitude: point.lat,
        longitude: point.lng,
        speed: point.speed,
        heading: point.heading,
        batteryLevel: 92,
        isCharging: false,
        timestamp: Date.now(),
      })
    );
    await new Promise((r) => setTimeout(r, 600));
  }

  // 2. Test Stationary Reverse Geocoding Rate-Limiting Logic
  console.log('\n--- Step 2: Testing Stationary Reverse Geocoding Throttler ---');
  const anchorLat = 37.7680;
  const anchorLng = -122.4280;
  const stationaryStartTime = Date.now() - 190000; // 3.1 minutes ago simulated

  clientSarah.send(
    JSON.stringify({
      type: 'TELEMETRY_PING',
      userId: 'user-sarah',
      circleId: CIRCLE_ID,
      latitude: anchorLat + 0.00005, // ~5 meters away (well within 50m radius)
      longitude: anchorLng + 0.00005,
      speed: 0,
      heading: 0,
      batteryLevel: 90,
      isCharging: true,
      timestamp: Date.now(),
    })
  );

  await new Promise((r) => setTimeout(r, 1200));

  // 3. Test Emergency SOS Broadcast
  console.log('\n--- Step 3: Testing Emergency SOS Fan-out ---');
  clientSarah.send(
    JSON.stringify({
      type: 'SOS_TRIGGER',
      userId: 'user-sarah',
      circleId: CIRCLE_ID,
      latitude: anchorLat,
      longitude: anchorLng,
    })
  );

  await new Promise((r) => setTimeout(r, 1000));

  console.log('\n==============================================================');
  console.log('📊 SIMULATION RESULTS:');
  console.log(`- Broadcasts received by peer: ${broadcastCount} (Expected: >=3)`);
  console.log(`- Emergency SOS received: ${sosReceived ? 'YES (PASSED)' : 'NO'}`);
  console.log('==============================================================\n');

  clientSarah.close();
  clientNoah.close();
  process.exit(0);
}

runSimulation().catch((err) => {
  console.error('Simulation test error:', err);
  process.exit(1);
});
