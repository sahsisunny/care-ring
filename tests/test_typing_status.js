const WebSocket = require('ws');

const CIRCLE_ID = '3f2925fd-074a-4ab3-b142-bf59f5dd532e';
const USER_SUNNY = '1f877edd-6e20-4cba-9aa0-45ef98c8db6c';
const USER_RAVI = '3fa25cbc-ab29-491f-8ec7-cb51ae05cc5c';
const USER_NEHA = '141c876f-3aa5-482e-a7b3-b259851b131e';

async function runTest() {
  console.log('--- Starting Real-Time Typing Indicators Test ---');

  const wsSunny = new WebSocket(`ws://localhost:4000/ws/circles/${CIRCLE_ID}?userId=${USER_SUNNY}`);
  const wsRavi = new WebSocket(`ws://localhost:4000/ws/circles/${CIRCLE_ID}?userId=${USER_RAVI}`);
  const wsNeha = new WebSocket(`ws://localhost:4000/ws/circles/${CIRCLE_ID}?userId=${USER_NEHA}`);

  await Promise.all([
    new Promise((resolve) => wsSunny.on('open', resolve)),
    new Promise((resolve) => wsRavi.on('open', resolve)),
    new Promise((resolve) => wsNeha.on('open', resolve)),
  ]);

  console.log('✅ Connected Sunny, Ravi, and Neha sockets');

  // Test 1: Group Chat Typing Broadcast
  const sunnyGroupTypingPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout on group typing')), 3000);
    wsSunny.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'TYPING_STATUS' && msg.data.userName === 'Ravi Kumar') {
        clearTimeout(timer);
        resolve(msg.data);
      }
    });
  });

  console.log('📤 Ravi starts typing in Group Chat...');
  wsRavi.send(
    JSON.stringify({
      type: 'TYPING_STATUS',
      circleId: CIRCLE_ID,
      userId: USER_RAVI,
      userName: 'Ravi Kumar',
      isTyping: true,
    })
  );

  const groupTypingData = await sunnyGroupTypingPromise;
  console.log('✅ Sunny received Ravi typing in Group Chat:', groupTypingData);

  // Test 2: Multi-user Typing (Neha also starts typing)
  const sunnyNehaTypingPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout on Neha typing')), 3000);
    wsSunny.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'TYPING_STATUS' && msg.data.userName === 'Neha Sahsi') {
        clearTimeout(timer);
        resolve(msg.data);
      }
    });
  });

  console.log('📤 Neha also starts typing in Group Chat (multi-user typing)...');
  wsNeha.send(
    JSON.stringify({
      type: 'TYPING_STATUS',
      circleId: CIRCLE_ID,
      userId: USER_NEHA,
      userName: 'Neha Sahsi',
      isTyping: true,
    })
  );

  const nehaTypingData = await sunnyNehaTypingPromise;
  console.log('✅ Sunny received Neha typing in Group Chat:', nehaTypingData);

  // Test 3: 1-on-1 Direct Typing Status (Sunny -> Ravi)
  const raviDirectTypingPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout on direct typing')), 3000);
    wsRavi.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'DIRECT_TYPING_STATUS') {
        clearTimeout(timer);
        resolve(msg.data);
      }
    });
  });

  let nehaReceivedDirectTyping = false;
  wsNeha.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'DIRECT_TYPING_STATUS') {
      nehaReceivedDirectTyping = true;
    }
  });

  console.log('📤 Sunny starts typing in 1-on-1 Direct Chat with Ravi...');
  wsSunny.send(
    JSON.stringify({
      type: 'DIRECT_TYPING_STATUS',
      circleId: CIRCLE_ID,
      senderId: USER_SUNNY,
      recipientId: USER_RAVI,
      senderName: 'Sunny Sahsi',
      isTyping: true,
    })
  );

  const directTypingData = await raviDirectTypingPromise;
  console.log('✅ Ravi received direct typing status from Sunny:', directTypingData);

  // Give 500ms to ensure Neha did not receive the private direct typing
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (nehaReceivedDirectTyping) {
    throw new Error('Privacy breach: Neha received private 1-on-1 direct typing event!');
  }
  console.log('🔒 Direct Typing Privacy Verified: Neha did NOT receive private direct typing event.');

  console.log('🎉 ALL TYPING INDICATOR TESTS PASSED SUCCESSFULLY!');

  wsSunny.close();
  wsRavi.close();
  wsNeha.close();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
