const db = require('../src/db/db');
const router = require('../src/conversation/router');

const messaging = require('../src/services/messaging');
let capturedMessages = [];
messaging.sendText = async (phone, text) => {
  capturedMessages.push({ phone, text });
  return { sid: 'sim_' + Date.now() };
};

function popLastMessage() {
  if (capturedMessages.length === 0) return '(no message sent)';
  const last = capturedMessages[capturedMessages.length - 1];
  return last.text;
}

async function testDietOffTrackScenarios() {
  console.log('TESTING USER DIET DEVIATION / OFF-PLAN / MISSED MEAL SCENARIOS\n');
  const testPhone = 'whatsapp:+919777777777';

  // Setup user
  const dbInstance = db.db;
  dbInstance.pragma('foreign_keys = OFF');
  const existing = db.getUserByPhone(testPhone);
  if (existing) {
    dbInstance.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
  }

  let { user } = db.getOrCreateUser(testPhone);
  db.updateUser(user.id, {
    name: 'Tharun',
    language: 'en',
    activity: 'gym',
    days_per_week: 4,
    checkin_time: '08:00',
    state: 'ACTIVE',
    deposit_status: 'paid',
    tier: 'pro_350',
    height: 178,
    weight: 75,
    goal: 'muscle_gain',
    target_calories: 2500,
    cuisine_region: 'South Indian',
  });

  const testMessages = [
    "I couldn't eat my planned meals today because I was traveling. I only ate some snacks.",
    "I skipped lunch today and only had a tea. What should I do for dinner?",
    "Bro I messed up and ate pizza and sweets instead of my diet plan today.",
  ];

  for (const msg of testMessages) {
    console.log(`\n==================================================================`);
    console.log(`👤 User: "${msg}"`);
    console.log(`==================================================================`);
    capturedMessages = [];
    await router.handleIncomingMessage({
      phone: testPhone,
      body: msg,
    });
    console.log(`🤖 ShowUp Response:\n${popLastMessage()}`);
  }

  // Cleanup
  dbInstance.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  dbInstance.pragma('foreign_keys = ON');
}

testDietOffTrackScenarios().catch(e => console.error(e));
