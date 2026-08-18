process.env.MOCK_WHATSAPP = 'true';

const db = require('../src/db/db');
const router = require('../src/conversation/router');
const gemini = require('../src/services/gemini');
const states = require('../src/conversation/states');

async function testTanglishPureLatin() {
  console.log('--- Testing Pure Latin Alphabet for Tanglish (No Tamil Script) ---');
  const phone = 'whatsapp:+919999900077';

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
    name: 'Karthik',
    language: 'tl',
    language_locked: 'tl',
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

  console.log('\n[Test 1] User asks in Tanglish: "Bro iniku leg workout panalama?"');
  const res1 = await gemini.handleGeneralQuery(user, 'Bro iniku leg workout panalama?');
  console.log('Coach Reply in Tanglish:\n', res1);
  
  const hasTamilScript1 = /[\u0B80-\u0BFF]/.test(res1);
  console.log('Contains Tamil script characters:', hasTamilScript1, '(Expected: false)');

  if (hasTamilScript1) {
    throw new Error('FAIL: Tanglish output contains Tamil script characters!');
  }

  console.log('\n[Test 2] User asks for breakfast advice: "Breakfast ku enna saapdalum?"');
  const res2 = await gemini.handleGeneralQuery(user, 'Breakfast ku enna saapdalum?');
  console.log('Coach Reply in Tanglish:\n', res2);

  const hasTamilScript2 = /[\u0B80-\u0BFF]/.test(res2);
  console.log('Contains Tamil script characters:', hasTamilScript2, '(Expected: false)');

  if (hasTamilScript2) {
    throw new Error('FAIL: Tanglish output contains Tamil script characters!');
  }

  console.log('\n[Test 3] Day 1 Kickoff generation for Tanglish user:');
  const res3 = await gemini.generateDay1Workout(user);
  console.log('Day 1 Kickoff in Tanglish:\n', res3);

  const hasTamilScript3 = /[\u0B80-\u0BFF]/.test(res3);
  console.log('Contains Tamil script characters:', hasTamilScript3, '(Expected: false)');

  if (hasTamilScript3) {
    throw new Error('FAIL: Tanglish Day 1 contains Tamil script characters!');
  }

  console.log('\nAll Tanglish pure Latin script tests passed successfully!');
  process.exit(0);
}

testTanglishPureLatin().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
