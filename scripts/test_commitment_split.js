process.env.MOCK_WHATSAPP = 'true';

const db = require('../src/db/db');
const states = require('../src/conversation/states');
const onboarding = require('../src/conversation/onboarding');
const router = require('../src/conversation/router');

async function testCommitmentSplit() {
  console.log('--- Testing Plan & Commitment Message Separation ---');
  const phone = 'whatsapp:+919999900088';

  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const ex = db.getUserByPhone(phone);
    if (ex) {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(ex.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(ex.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }

  const { user } = db.getOrCreateUser(phone);
  db.updateUser(user.id, {
    name: 'Vikram',
    language: 'en',
    goal: 'muscle_gain',
    experience_level: 'beginner',
    activity: 'gym',
    height: 176,
    weight: 72,
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
    diet_summary: 'Normal South Indian food, 3 idlis breakfast, rice and chicken lunch, 2 rotis dinner',
    allergy: 'none',
    diet_restrictions: 'none',
    blocker_text: 'Time and consistency',
    sleep_hours: 7,
    injuries: null, // this will be the last missing field
    state: states.ONBOARD_NAME,
  });

  console.log('\nSending final missing field (injuries: "none") to complete onboarding...');
  await router.handleIncomingMessage({ phone, body: 'none' });

  const updatedUser = db.getUserById(user.id);
  console.log('\nUser state after completing onboarding:', updatedUser.state, '(Expected: AWAITING_COMMITMENT)');

  // Now user provides commitment
  console.log('\nSending commitment statement: "I will hit my 3 workouts every week without skipping."');
  await router.handleIncomingMessage({ phone, body: 'I will hit my 3 workouts every week without skipping.' });

  const finalUser = db.getUserById(user.id);
  console.log('User state after commitment:', finalUser.state, '(Expected: AWAITING_MODE_SELECTION)');
  console.log('Saved commitment text:', finalUser.commitment_text);

  console.log('\nPlan & Commitment separation test passed successfully!');
  process.exit(0);
}

testCommitmentSplit().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
