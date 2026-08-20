const db = require('../src/db/db');
const router = require('../src/conversation/router');

const messaging = require('../src/services/messaging');
let capturedMessages = [];
messaging.sendText = async (phone, text) => {
  capturedMessages.push({ phone, text });
  return { sid: 'sim_' + Date.now() };
};

async function testWeeklyNutritionPlan() {
  console.log('Testing Weekly Varied Nutrition Plan Request...\n');
  const testPhone = 'whatsapp:+919999911111';

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
    tier: 'pro',
    height: 178,
    weight: 75,
    goal: 'muscle_gain',
    target_calories: 2400,
    cuisine_region: 'South Indian',
    diet_restrictions: 'Non-Vegetarian (Chicken, Fish, Eggs, Paneer, Rice, Oats)',
    allergy: 'none',
  });

  capturedMessages = [];
  console.log('User asks: "i need weekly nutrition plan i can\'t eat the same thing every day"');
  await router.handleIncomingMessage({
    phone: testPhone,
    body: "i need weekly nutrition plan i can't eat the same thing every day",
  });

  const reply = capturedMessages[capturedMessages.length - 1]?.text;
  console.log('\n🤖 ShowUp Response:\n' + '='.repeat(65) + '\n' + reply + '\n' + '='.repeat(65));

  // Cleanup
  dbInstance.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  dbInstance.pragma('foreign_keys = ON');
}

testWeeklyNutritionPlan().catch(e => console.error(e));
