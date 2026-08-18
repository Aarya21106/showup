const db = require('../src/db/db');
const onboarding = require('../src/conversation/onboarding');
const gemini = require('../src/services/gemini');

async function testOnboardingDays() {
  console.log('Testing Onboarding Days & Timetable extraction...');
  
  // Test case 1: User says "2 days a week" -> coach should ask which 2 days
  const profile1 = {
    name: 'Alex',
    goal: 'Build muscle',
    experience_level: 'beginner',
    activity: 'gym',
    height: 175,
    weight: 70,
    days_per_week: null,
    timetable: null,
    checkin_time: null,
    diet_summary: null,
    allergy: null,
    diet_restrictions: null,
    blocker_text: null,
    sleep_hours: null,
    injuries: null
  };

  console.log('\n--- Step 1: User provides days count only ("2 days") ---');
  const res1 = await gemini.conductOnboardingInterview({
    currentProfile: profile1,
    message: '2 days a week',
    history: [{ role: 'model', text: 'How many and which days of the week can you train?' }],
    user: { name: 'Alex' }
  });

  console.log('Extracted days_per_week:', res1.extracted.days_per_week);
  console.log('Extracted timetable:', res1.extracted.timetable);
  console.log('Coach Reply:\n', res1.reply);

  console.log('\n--- Step 2: User provides specific days ("Saturday and Sunday") ---');
  const profile2 = {
    ...profile1,
    days_per_week: res1.extracted.days_per_week || 2,
    timetable: res1.extracted.timetable || null
  };

  const res2 = await gemini.conductOnboardingInterview({
    currentProfile: profile2,
    message: 'Saturday and Sunday',
    history: [
      { role: 'user', text: '2 days a week' },
      { role: 'model', text: res1.reply }
    ],
    user: { name: 'Alex' }
  });

  console.log('Extracted days_per_week:', res2.extracted.days_per_week);
  console.log('Extracted timetable:', JSON.stringify(res2.extracted.timetable, null, 2));
  console.log('Coach Reply:\n', res2.reply);

  console.log('\n--- Step 3: Day 1 Generation with Saturday/Sunday schedule on a weekday ---');
  const user = {
    id: 999,
    name: 'Alex',
    language: 'en',
    activity: 'gym',
    goal: 'build muscle',
    experience_level: 'beginner',
    workout_location: 'gym',
    home_equipment: 'free weights',
    checkin_time: '07:00',
    days_per_week: 2,
    timetable: JSON.stringify(res2.extracted.timetable)
  };

  const day1Msg = await gemini.generateDay1Workout(user);
  console.log('Day 1 Kickoff Message:\n', day1Msg);

  console.log('\nTest completed successfully!');
}

testOnboardingDays().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
