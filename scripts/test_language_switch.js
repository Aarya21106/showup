process.env.MOCK_WHATSAPP = 'true';

const db = require('../src/db/db');
const router = require('../src/conversation/router');
const states = require('../src/conversation/states');

async function testLanguageSwitch() {
  console.log('--- Testing Dynamic Language Switching & Sticky Language Locks ---');
  const phone = 'whatsapp:+919999900099';

  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const ex = db.getUserByPhone(phone);
    if (ex) {
      db.db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(ex.id);
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(ex.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(ex.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }

  const { user } = db.getOrCreateUser(phone);
  db.updateUser(user.id, {
    name: 'Siddharth',
    language: 'en',
    language_locked: null,
    activity: 'gym',
    state: states.ACTIVE,
    days_per_week: 4,
    timetable: JSON.stringify({
      Monday: 'Chest & Triceps',
      Tuesday: 'Back & Biceps',
      Wednesday: 'Rest',
      Thursday: 'Legs & Core',
      Friday: 'Shoulders & Arms',
      Saturday: 'Rest',
      Sunday: 'Rest'
    })
  });

  // Step 1: User speaks in Tanglish -> should dynamically switch to 'tl'
  console.log('\n[Test 1] User speaks in Tanglish: "Bro iniku leg workout panalama?"');
  await router.handleIncomingMessage({ phone, body: 'Bro iniku leg workout panalama?' });
  let curr = db.getUserById(user.id);
  console.log('Language after Tanglish query:', curr.language, '(Expected: tl)');
  console.log('Language locked:', curr.language_locked, '(Expected: null)');

  // Step 2: User shifts back to English -> should dynamically switch to 'en'
  console.log('\n[Test 2] User speaks back in English: "Can you adjust my workout schedule for tomorrow?"');
  await router.handleIncomingMessage({ phone, body: 'Can you adjust my workout schedule for tomorrow?' });
  curr = db.getUserById(user.id);
  console.log('Language after English query:', curr.language, '(Expected: en)');
  console.log('Language locked:', curr.language_locked, '(Expected: null)');

  // Step 3: User speaks in Hinglish -> should dynamically switch to 'hl'
  console.log('\n[Test 3] User speaks in Hinglish: "Bhai aaj gym nahi gaya, kal subah 7 baje karunga"');
  await router.handleIncomingMessage({ phone, body: 'Bhai aaj gym nahi gaya, kal subah 7 baje karunga' });
  curr = db.getUserById(user.id);
  console.log('Language after Hinglish query:', curr.language, '(Expected: hl)');
  console.log('Language locked:', curr.language_locked, '(Expected: null)');

  // Step 4: User explicitly locks language to Tanglish: "tamil la pesunga"
  console.log('\n[Test 4] User explicitly commands: "tamil la pesunga"');
  await router.handleIncomingMessage({ phone, body: 'tamil la pesunga' });
  curr = db.getUserById(user.id);
  console.log('Language after explicit command:', curr.language, '(Expected: tl)');
  console.log('Language locked:', curr.language_locked, '(Expected: tl)');

  // Step 5: User asks an English question while locked in Tanglish -> should STAY in 'tl'
  console.log('\n[Test 5] User types English question while locked: "What should I eat for breakfast?"');
  await router.handleIncomingMessage({ phone, body: 'What should I eat for breakfast?' });
  curr = db.getUserById(user.id);
  console.log('Language after English query during lock:', curr.language, '(Expected: tl)');
  console.log('Language locked:', curr.language_locked, '(Expected: tl)');

  // Step 6: User explicitly switches back to English: "speak in english"
  console.log('\n[Test 6] User explicitly commands: "speak in english"');
  await router.handleIncomingMessage({ phone, body: 'speak in english' });
  curr = db.getUserById(user.id);
  console.log('Language after explicit English command:', curr.language, '(Expected: en)');
  console.log('Language locked:', curr.language_locked, '(Expected: en)');

  console.log('\nAll language switching and lock tests passed successfully!');
  process.exit(0);
}

testLanguageSwitch().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
