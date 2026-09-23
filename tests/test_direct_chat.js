const WebSocket = require('ws');

const CIRCLE_ID = '3f2925fd-074a-4ab3-b142-bf59f5dd532e';
const USER_A = '1f877edd-6e20-4cba-9aa0-45ef98c8db6c'; // Sunny
const USER_B = '3fa25cbc-ab29-491f-8ec7-cb51ae05cc5c'; // Ravi

async function runTest() {
  console.log('--- Starting Multi-Socket Real-Time Direct Chat Test ---');

  const wsA1 = new WebSocket(`ws://localhost:4000/ws/circles/${CIRCLE_ID}?userId=${USER_A}`);
  const wsB = new WebSocket(`ws://localhost:4000/ws/circles/${CIRCLE_ID}?userId=${USER_B}`);

  await Promise.all([
    new Promise((resolve) => wsA1.on('open', resolve)),
    new Promise((resolve) => wsB.on('open', resolve)),
  ]);

  console.log('✅ Connected Socket A1 (Sunny) and Socket B (Ravi)');

  // Connect a second socket for User A (simulating Expo fast-refresh or second device)
  const wsA2 = new WebSocket(`ws://localhost:4000/ws/circles/${CIRCLE_ID}?userId=${USER_A}`);
  await new Promise((resolve) => wsA2.on('open', resolve));
  console.log('✅ Connected Socket A2 (Sunny reconnected / second socket)');

  // Now close Socket A1 (old socket disconnects)
  wsA1.close();
  console.log('ℹ️ Closed Socket A1 (simulating old socket cleanup)');
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Now Ravi (B) sends a direct message to Sunny (A)
  const receivedByA2 = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for DM on A2')), 4000);
    wsA2.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'DIRECT_MESSAGE') {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });

  const receivedByB_echo = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for DM echo on B')), 4000);
    wsB.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'DIRECT_MESSAGE') {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });

  const dmPayload = {
    type: 'DIRECT_MESSAGE',
    senderId: USER_B,
    recipientId: USER_A,
    circleId: CIRCLE_ID,
    content: 'Testing real-time delivery after reconnect: ' + Date.now(),
    messageType: 'text',
  };

  console.log('📤 Sending DIRECT_MESSAGE from Ravi to Sunny...');
  wsB.send(JSON.stringify(dmPayload));

  const [msgA2, msgEchoB] = await Promise.all([receivedByA2, receivedByB_echo]);

  console.log('✅ Received on Sunny Socket A2:', msgA2.data.content);
  console.log('✅ Received on Ravi Socket B (confirmed echo):', msgEchoB.data.content);
  console.log('🎉 REAL-TIME DIRECT CHAT MULTI-SOCKET VERIFICATION PASSED!');

  wsA2.close();
  wsB.close();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
