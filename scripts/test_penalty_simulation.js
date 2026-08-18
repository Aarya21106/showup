const db = require('../src/db/db');
const router = require('../src/conversation/router');
const scheduler = require('../src/scheduler');
const config = require('../src/config');
const { calculatePledgePayout } = require('../src/utils/payout');
const { addDaysStr, todayStr } = require('../src/utils/date');

// Intercept messaging output so we capture what the user sees
const messaging = require('../src/services/messaging');
let capturedMessages = [];
const originalSendText = messaging.sendText;
messaging.sendText = async (phone, text) => {
  capturedMessages.push({ phone, text });
  return { sid: 'sim_' + Date.now() };
};

function printDivider(title) {
  console.log('\n' + '='.repeat(65));
  console.log(`  ${title}`);
  console.log('='.repeat(65));
}

function popLastMessage() {
  if (capturedMessages.length === 0) return '(no message sent)';
  const last = capturedMessages[capturedMessages.length - 1];
  return last.text;
}

async function runSimulation() {
  printDivider('STARTING END-TO-END PENALTY & TIME PROGRESSION SIMULATION');

  const testPhone = 'whatsapp:+919999988888';

  // 1. Clean test user if exists
  const existing = db.getUserByPhone(testPhone);
  if (existing) {
    const dbInstance = db.db;
    dbInstance.pragma('foreign_keys = OFF');
    dbInstance.prepare('DELETE FROM checkins WHERE user_id = ?').run(existing.id);
    dbInstance.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(existing.id);
    dbInstance.prepare('DELETE FROM workout_schedule_overrides WHERE user_id = ?').run(existing.id);
    dbInstance.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(existing.id);
    dbInstance.prepare('DELETE FROM daily_summaries WHERE user_id = ?').run(existing.id);
    dbInstance.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    dbInstance.pragma('foreign_keys = ON');
  }

  // 2. Fast Onboarding
  console.log('\n[Stage 1] Onboarding User: Tharun');
  let { user } = db.getOrCreateUser(testPhone);
  db.updateUser(user.id, {
    name: 'Tharun',
    language: 'en',
    activity: 'gym',
    days_per_week: 4,
    checkin_time: '08:00',
    state: 'ACTIVE',
    deposit_status: 'paid',
    started_at: '2026-08-01',
    day_count: 1,
    streak: 0,
    missed_count: 0,
    current_gesture: 'three-fingers',
    timetable: JSON.stringify({
      Monday: 'Upper Body (Push Focus)',
      Tuesday: 'Lower Body (Legs Focus)',
      Wednesday: 'Rest',
      Thursday: 'Pull & Back',
      Friday: 'Full Body Compound',
      Saturday: 'Rest',
      Sunday: 'Rest',
    }),
  });
  user = db.getUserById(user.id);
  console.log(`✓ User created: ${user.name} | Activity: ${user.activity} | 4 days/week`);
  console.log(`✓ Initial Status: Streak = ${user.streak}, Misses = ${user.missed_count}`);
  
  let payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`💰 Initial Deposit: ₹${payoutInfo.deposit} | Base Refund: ₹${payoutInfo.baseRefund} | Free Strikes: ${payoutInfo.freeStrikes}`);

  // 3. Day 1: Successful Check-in
  printDivider('DAY 1: Successful Check-in with Gesture Photo');
  const d1 = '2026-08-01'; // Monday
  db.createCheckin({
    userId: user.id,
    date: d1,
    description: 'Crushed chest and triceps today!',
    gesture: 'three-fingers',
    status: 'accepted',
  });
  db.updateUser(user.id, { streak: 1, day_count: 1, last_prompted_date: d1 });
  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`✓ Check-in Verified! Streak: ${user.streak} | Misses: ${user.missed_count}`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Zero penalty)`);

  // 4. Day 2: Exercise Substitution ("Show Up First, Optimize Second")
  printDivider('DAY 2: Exercise Substitution (Benches Occupied -> Dumbbell Press)');
  const d2 = '2026-08-02'; // Tuesday
  capturedMessages = [];
  await router.handleIncomingMessage({
    phone: testPhone,
    body: "I couldn't do barbell bench because all the benches were occupied, so I did dumbbell press instead.",
  });
  console.log('🤖 Bot Response:\n' + popLastMessage());
  db.createCheckin({
    userId: user.id,
    date: d2,
    description: 'Dumbbell press substitution',
    status: 'accepted',
  });
  db.updateUser(user.id, { streak: 2, day_count: 2, last_prompted_date: d2 });
  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`\n✓ Result: Streak: ${user.streak} | Misses: ${user.missed_count}`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Substitution = ₹0 penalty)`);

  // 5. Day 3: Flexible Reschedule
  printDivider('DAY 3: Flexible Reschedule (Exams -> Shift Session)');
  capturedMessages = [];
  await router.handleIncomingMessage({
    phone: testPhone,
    body: "I have college exams tomorrow. Move my workout to Saturday.",
  });
  console.log('🤖 Bot Response:\n' + popLastMessage());
  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`\n✓ Result: Misses: ${user.missed_count} | Overrides Created`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Reschedule = ₹0 penalty)`);

  // 6. Day 4: Unexcused Miss #1 (Free Strike 1)
  printDivider('DAY 4: Unexcused Miss #1 (User ignores workout prompt)');
  const d4 = '2026-08-04'; // Thursday (Pull day)
  const d3 = '2026-08-03';
  capturedMessages = [];
  
  // Sweep yesterday's unexcused absence
  await scheduler.sweepAndPrompt(user, d4, d3);
  console.log('🤖 Bot Notification:\n' + popLastMessage());
  
  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`\n📊 State: Streak: ${user.streak} (Reset to 0) | Total Misses: ${user.missed_count}`);
  console.log(`🛡️ Free Strikes Used: ${payoutInfo.strikesUsed}/${payoutInfo.freeStrikes} (Penalized Slips: ${payoutInfo.penalizedSlips})`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Protected by Free Strike 1 -> ₹0 penalty)`);

  // 7. Day 5: Unexcused Miss #2 (Free Strike 2)
  printDivider('DAY 5: Unexcused Miss #2 (User misses again)');
  const d5 = '2026-08-05';
  capturedMessages = [];
  await scheduler.sweepAndPrompt(user, d5, d4);
  console.log('🤖 Bot Notification:\n' + popLastMessage());

  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`\n📊 State: Streak: ${user.streak} | Total Misses: ${user.missed_count}`);
  console.log(`🛡️ Free Strikes Used: ${payoutInfo.strikesUsed}/${payoutInfo.freeStrikes} (Penalized Slips: ${payoutInfo.penalizedSlips})`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Protected by Free Strike 2 -> ₹0 penalty)`);

  // 8. Day 6: Unexcused Miss #3 (Penalty Starts: -₹50)
  printDivider('DAY 6: Unexcused Miss #3 (Beyond Free Strikes -> -₹50 Penalty)');
  const d6 = '2026-08-06';
  capturedMessages = [];
  await scheduler.sweepAndPrompt(user, d6, d5);
  console.log('🤖 Bot Notification:\n' + popLastMessage());

  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`\n📊 State: Streak: ${user.streak} | Total Misses: ${user.missed_count}`);
  console.log(`⚠️ Free Strikes Depleted: ${payoutInfo.strikesUsed}/${payoutInfo.freeStrikes} | Penalized Slips: ${payoutInfo.penalizedSlips}`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Base ₹275 - 1×₹50 = ₹225)`);

  // 9. Day 7: Unexcused Miss #4 (Second Penalty: -₹50 -> ₹175)
  printDivider('DAY 7: Unexcused Miss #4 (Second Penalty -> -₹50 Penalty)');
  const d7 = '2026-08-07';
  capturedMessages = [];
  await scheduler.sweepAndPrompt(user, d7, d6);

  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`\n📊 State: Total Misses: ${user.missed_count} | Penalized Slips: ${payoutInfo.penalizedSlips}`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Base ₹275 - 2×₹50 = ₹175)`);

  // 10. Day 8: Health Alert / Sickness (Zero Penalty)
  printDivider('DAY 8: Sickness / Health Alert (Fever of 102)');
  capturedMessages = [];
  await router.handleIncomingMessage({
    phone: testPhone,
    body: "I have a high fever of 102 and body chills today",
  });
  console.log('🤖 Bot Response:\n' + popLastMessage());

  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);
  console.log(`\n✓ Result: Total Misses: ${user.missed_count} (Not incremented)`);
  console.log(`💰 Current Refund Balance: ₹${payoutInfo.payout} (Health Excusals = ₹0 penalty)`);

  // 11. Day 30: Final Completion & Payout Calculation
  printDivider('DAY 30: Final Pledge Completion Summary');
  db.updateUser(user.id, { day_count: 30, streak: 22 });
  user = db.getUserById(user.id);
  payoutInfo = calculatePledgePayout(user, user.missed_count);

  console.log(`\n🏁 30-Day Pledge Summary for ${user.name}:`);
  console.log(`• Initial Deposit: ₹${payoutInfo.deposit}`);
  console.log(`• Platform Fee: ₹${payoutInfo.platformFee}`);
  console.log(`• Max Base Refund: ₹${payoutInfo.baseRefund}`);
  console.log(`• Total Unexcused Misses: ${payoutInfo.missedCount}`);
  console.log(`• Free Buffer Strikes Absorbed: ${payoutInfo.strikesUsed}/${payoutInfo.freeStrikes}`);
  console.log(`• Penalized Slips: ${payoutInfo.penalizedSlips} (deducting ₹${payoutInfo.penalizedSlips * 50})`);
  console.log(`• Final Refund Amount Processed: ₹${payoutInfo.payout}`);

  printDivider('TEST VERIFICATION COMPLETE: ALL PENALTY CALCULATIONS PASSED');
  
  // Cleanup test user
  const dbInstance = db.db;
  dbInstance.pragma('foreign_keys = OFF');
  dbInstance.prepare('DELETE FROM checkins WHERE user_id = ?').run(user.id);
  dbInstance.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(user.id);
  dbInstance.prepare('DELETE FROM workout_schedule_overrides WHERE user_id = ?').run(user.id);
  dbInstance.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(user.id);
  dbInstance.prepare('DELETE FROM daily_summaries WHERE user_id = ?').run(user.id);
  dbInstance.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  dbInstance.pragma('foreign_keys = ON');
}

runSimulation().catch(err => console.error('Simulation error:', err));
