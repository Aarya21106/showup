process.env.MOCK_WHATSAPP = 'true';

// Mock date helpers to allow controlling "currentTime"
const dateUtils = require('../src/utils/date');
let mockTime = null;
let mockDate = null;

const originalNowHHMM = dateUtils.nowHHMM;
const originalTodayStr = dateUtils.todayStr;

dateUtils.nowHHMM = (tz) => mockTime || originalNowHHMM(tz);
dateUtils.todayStr = (tz) => mockDate || originalTodayStr(tz);

// Now load DB and scheduler
const db = require('../src/db/db');
const scheduler = require('../src/scheduler');
const config = require('../src/config');

// Helper to calculate weekday name from Date
function getDayNameForMockDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long'
  }).format(d);
}

async function runReminderTests() {
  console.log('Starting Schedule and Reminder Tests...');
  const phone = 'whatsapp:+917777777777';

  // Wipe user
  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const existing = db.getUserByPhone(phone);
    if (existing) {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM nutrition_logs WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }

  // Create active user
  const { user } = db.getOrCreateUser(phone);
  console.log(`Created test user with ID: ${user.id}`);

  // Setup timetable: workout on Monday, Wednesday, Friday. Rest on other days.
  const timetable = {
    Monday: 'Legs Day (Squats focus)',
    Tuesday: 'Rest',
    Wednesday: 'Push Day (Chest focus)',
    Thursday: 'Rest',
    Friday: 'Pull Day (Back focus)',
    Saturday: 'Rest',
    Sunday: 'Rest'
  };

  db.updateUser(user.id, {
    name: 'ReminderTester',
    tier: 'pro_120',
    activity: 'gym',
    checkin_time: '07:00',
    timetable: JSON.stringify(timetable),
    goal: 'muscle_gain',
    state: 'ACTIVE'
  });

  const today = dateUtils.todayStr(config.timezone);
  const todayDayName = getDayNameForMockDate(today);
  console.log(`Today is: ${today} (${todayDayName})`);

  // Let's force today to be a Monday so it's a workout day (Monday focus: Legs Day)
  mockDate = '2026-08-03'; // 2026-08-03 is a Monday
  const mockDayName = getDayNameForMockDate(mockDate);
  console.log(`Mocked date to: ${mockDate} (${mockDayName})`);

  // -------------------------------------------------------------
  // Test Case 1: Daily gym workout start reminder trigger (07:00)
  // -------------------------------------------------------------
  console.log('\n--- Test Case 1: Workout Start Reminder at 07:00 ---');
  mockTime = '07:00';
  scheduler.tick();
  
  // Wait a moment for async twilio/Gemini operations
  await new Promise((resolve) => setTimeout(resolve, 5000));

  let updatedUser = db.getUserById(user.id);
  console.log(`workout_reminded_date: ${updatedUser.workout_reminded_date}`);
  console.log(`workout_acknowledged_date: ${updatedUser.workout_acknowledged_date}`);

  // -------------------------------------------------------------
  // Test Case 2: Water Reminder for Pro tier (10:00)
  // -------------------------------------------------------------
  console.log('\n--- Test Case 2: Pro Water Reminder at 10:00 ---');
  mockTime = '10:00';
  scheduler.tick();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  updatedUser = db.getUserById(user.id);
  console.log(`water_reminders_sent: ${updatedUser.water_reminders_sent}`);

  // -------------------------------------------------------------
  // Test Case 3: 2-hour missing warning (didn't reply/acknowledge)
  // -------------------------------------------------------------
  console.log('\n--- Test Case 3: 2-Hour Missed Workout Alert (No Acknowledgment) at 09:00 ---');
  // Mock time to 09:00 (2 hours after 07:00 checkin_time)
  mockTime = '09:00';
  
  // Make sure acknowledged date is empty/null for today
  db.updateUser(user.id, { workout_acknowledged_date: null });

  scheduler.tick();
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // -------------------------------------------------------------
  // Test Case 4: 2-hour missing warning (acknowledged, but no proof yet)
  // -------------------------------------------------------------
  console.log('\n--- Test Case 4: 2-Hour Missed Workout Alert (Acknowledged but no proof) at 09:00 ---');
  // Set acknowledged to today
  db.updateUser(user.id, { workout_acknowledged_date: '2026-08-03' });

  scheduler.tick();
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // -------------------------------------------------------------
  // Test Case 5: Rest Day behavior
  // -------------------------------------------------------------
  console.log('\n--- Test Case 5: Rest Day Transition (Tuesday) ---');
  mockDate = '2026-08-04'; // 2026-08-04 is Tuesday (Rest)
  mockTime = '07:00';
  
  // Reset prompted date to test transition
  db.updateUser(user.id, { last_prompted_date: '2026-08-03' });

  scheduler.tick();
  await new Promise((resolve) => setTimeout(resolve, 3000));

  updatedUser = db.getUserById(user.id);
  console.log(`Tuesday Gesture: ${updatedUser.current_gesture} (Expected: null for Rest Day)`);

  console.log('\nSchedule & Reminder Tests Completed!');
  process.exit(0);
}

runReminderTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
