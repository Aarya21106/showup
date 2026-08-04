const path = require('path');

// 1. Mock whatsapp.js in require.cache BEFORE any code runs to prevent it from loading Baileys / QR codes
const whatsappMock = {
  sendText: async (to, body) => {
    console.log(`\n=================== WHATSAPP OUTBOX ===================`);
    console.log(`Recipient: ${to}`);
    console.log(`Message:\n${body}`);
    console.log(`=======================================================\n`);
    try {
      const db = require('../src/db/db');
      const user = db.getUserByPhone(to);
      if (user) {
        db.saveChatMessage(user.id, 'model', body);
      }
    } catch (err) {
      console.error(err);
    }
    return { success: true };
  }
};

const whatsappPath = path.resolve(__dirname, '../src/services/whatsapp.js');
require.cache[whatsappPath] = {
  id: whatsappPath,
  filename: whatsappPath,
  loaded: true,
  exports: whatsappMock
};

// 2. Now import db and router safely
const db = require('../src/db/db');
const router = require('../src/conversation/router');

async function testProFeatures() {
  console.log('Starting Pro Features Test...');

  const phone = 'whatsapp:+919999999999';
  
  // Wipe any existing test user first to start clean
  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const existing = db.getUserByPhone(phone);
    if (existing) {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM nutrition_logs WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM burned_calories_logs WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }
  
  const { user } = db.getOrCreateUser(phone);
  console.log(`Created test user with ID: ${user.id}`);

  // Upgrade test user to Pro tier
  console.log('Upgrading test user to Pro tier...');
  const updatedUser = db.updateUser(user.id, {
    name: 'ProTester',
    tier: 'pro_120',
    height: 180,
    weight: 75,
    target_muscle: 'chest',
    allergy: 'peanut',
    state: 'ACTIVE'
  });
  console.log('Updated profile:', updatedUser);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Test Case 1: Diet Log
  console.log('\n--- Test Case 1: Diet Log ---');
  await router.handleIncomingMessage({
    phone,
    body: 'I ate 150g chicken breast and 2 eggs for lunch'
  });
  await sleep(6000);

  // Test Case 2: Burned Calories Log
  console.log('\n--- Test Case 2: Burned Calories Log ---');
  await router.handleIncomingMessage({
    phone,
    body: 'Just completed a 45 minute run, burned 500 calories'
  });
  await sleep(6000);

  // Test Case 3: Exercise Query
  console.log('\n--- Test Case 3: Exercise Query ---');
  await router.handleIncomingMessage({
    phone,
    body: 'what exercises can I do to improve chest?'
  });
  await sleep(6000);

  // Test Case 4: Diet Query
  console.log('\n--- Test Case 4: Diet Query ---');
  await router.handleIncomingMessage({
    phone,
    body: 'okay i need diet plan for me'
  });

  console.log('Pro Features Test Complete!');
  process.exit(0); // Exit process successfully
}

testProFeatures().catch((err) => {
  console.error(err);
  process.exit(1);
});
