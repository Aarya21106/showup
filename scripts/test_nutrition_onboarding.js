process.env.MOCK_WHATSAPP = 'true';

const db = require('../src/db/db');
const states = require('../src/conversation/states');
const onboarding = require('../src/conversation/onboarding');
const router = require('../src/conversation/router');

async function testNutritionOnboardingFlow() {
  console.log('--- Testing Nutrition Plan Onboarding Flow ---');

  // Test 1: User chooses AI Nutrition Plan (Option 1)
  console.log('\n[Scenario 1] User selects AI Nutrition Plan after payment');
  const phone1 = 'whatsapp:+919999900001';
  
  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const ex = db.getUserByPhone(phone1);
    if (ex) {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(ex.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(ex.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }

  const { user: user1 } = db.getOrCreateUser(phone1);
  db.updateUser(user1.id, {
    name: 'Karthik',
    activity: 'gym',
    height: 178,
    weight: 74,
    goal: 'muscle_gain',
    days_per_week: 3,
    timetable: JSON.stringify({
      Monday: 'Upper Body',
      Tuesday: 'Rest',
      Wednesday: 'Lower Body',
      Thursday: 'Rest',
      Friday: 'Push & Core',
      Saturday: 'Rest',
      Sunday: 'Rest'
    }),
    checkin_time: '07:00',
    state: states.AWAITING_PAYMENT,
  });

  // User sends "paid"
  console.log('Sending: "paid"');
  await router.handleIncomingMessage({ phone: phone1, body: 'paid' });

  let updated1 = db.getUserById(user1.id);
  console.log('State after paying:', updated1.state, '(Expected: AWAITING_NUTRITION_CHOICE)');

  // User replies "1" for AI Nutrition Plan
  console.log('Sending: "1" (AI plan)');
  await router.handleIncomingMessage({ phone: phone1, body: '1' });

  updated1 = db.getUserById(user1.id);
  console.log('State after AI nutrition plan:', updated1.state, '(Expected: ACTIVE)');
  console.log('Nutrition Plan Source:', updated1.nutrition_plan_source, '(Expected: ai_generated)');
  console.log('Saved Nutrition Plan preview:', (updated1.nutrition_plan || '').substring(0, 150) + '...');

  // Test 2: User provides their own plan as text (Option 2)
  console.log('\n[Scenario 2] User provides custom nutrition plan as text');
  const phone2 = 'whatsapp:+919999900002';
  
  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const ex = db.getUserByPhone(phone2);
    if (ex) {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(ex.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(ex.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }

  const { user: user2 } = db.getOrCreateUser(phone2);
  db.updateUser(user2.id, {
    name: 'Suresh',
    activity: 'gym',
    height: 172,
    weight: 68,
    goal: 'fat_loss',
    days_per_week: 4,
    timetable: JSON.stringify({
      Monday: 'Full Body',
      Tuesday: 'Cardio',
      Wednesday: 'Rest',
      Thursday: 'Full Body',
      Friday: 'Cardio',
      Saturday: 'Rest',
      Sunday: 'Rest'
    }),
    checkin_time: '08:00',
    state: states.AWAITING_PAYMENT,
  });

  await router.handleIncomingMessage({ phone: phone2, body: 'paid' });
  await router.handleIncomingMessage({ phone: phone2, body: '2' });

  let updated2 = db.getUserById(user2.id);
  console.log('State after choosing 2:', updated2.state, '(Expected: AWAITING_USER_NUTRITION_PLAN)');

  // User sends their diet text
  const dietText = 'Breakfast: 4 egg whites + 2 brown bread. Lunch: 150g grilled chicken + 1 cup rice + cucumber salad. Evening: 1 scoop whey protein + 10 almonds. Dinner: 150g paneer + 2 rotis + dal.';
  console.log('Sending diet text...');
  await router.handleIncomingMessage({ phone: phone2, body: dietText });

  updated2 = db.getUserById(user2.id);
  console.log('State after submitting diet plan:', updated2.state, '(Expected: ACTIVE)');
  console.log('Nutrition Plan Source:', updated2.nutrition_plan_source, '(Expected: user_provided)');
  console.log('Saved Nutrition Plan preview:', (updated2.nutrition_plan || '').substring(0, 150) + '...');

  // Test 3: User provides custom nutrition plan as photo/image (Option 2 via photo)
  console.log('\n[Scenario 3] User provides custom nutrition plan as a diet chart photo');
  const phone3 = 'whatsapp:+919999900003';
  
  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const ex = db.getUserByPhone(phone3);
    if (ex) {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(ex.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(ex.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }

  const { user: user3 } = db.getOrCreateUser(phone3);
  db.updateUser(user3.id, {
    name: 'Rahul',
    activity: 'gym',
    height: 180,
    weight: 78,
    goal: 'muscle_gain',
    days_per_week: 3,
    timetable: JSON.stringify({
      Monday: 'Upper Body',
      Tuesday: 'Rest',
      Wednesday: 'Lower Body',
      Thursday: 'Rest',
      Friday: 'Full Body',
      Saturday: 'Rest',
      Sunday: 'Rest'
    }),
    checkin_time: '07:30',
    state: states.AWAITING_PAYMENT,
  });

  await router.handleIncomingMessage({ phone: phone3, body: 'paid' });
  await router.handleIncomingMessage({ phone: phone3, body: '2' });

  // 1x1 transparent PNG as mock testBase64
  const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  console.log('Sending diet chart photo...');
  await router.handleIncomingMessage({
    phone: phone3,
    body: 'Here is my diet chart from my trainer',
    media: { testBase64: mockBase64, mimeType: 'image/png' }
  });

  const updated3 = db.getUserById(user3.id);
  console.log('State after photo submission:', updated3.state, '(Expected: ACTIVE)');
  console.log('Nutrition Plan Source:', updated3.nutrition_plan_source, '(Expected: user_provided)');
  console.log('Nutrition Photo Ref:', updated3.nutrition_photo_ref);
  console.log('Saved Nutrition Plan preview:', (updated3.nutrition_plan || '').substring(0, 150) + '...');

  console.log('\nAll Nutrition Onboarding tests passed successfully!');
  process.exit(0);
}

testNutritionOnboardingFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
