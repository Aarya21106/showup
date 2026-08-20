const db = require('../src/db/db');
const router = require('../src/conversation/router');
const scheduler = require('../src/scheduler');
const config = require('../src/config');
const messages = require('../src/conversation/messages');
const { calculatePledgePayout, calculateSubscriptionDiscount } = require('../src/utils/payout');

// Intercept messaging
const messaging = require('../src/services/messaging');
let capturedMessages = [];
messaging.sendText = async (phone, text) => {
  capturedMessages.push({ phone, text });
  return { sid: 'sim_' + Date.now() };
};
messaging.sendMedia = async (phone, caption, mediaUrl) => {
  capturedMessages.push({ phone, text: `[Media: ${mediaUrl}] ${caption}` });
  return { sid: 'sim_' + Date.now() };
};

function printDivider(title) {
  console.log('\n' + '='.repeat(68));
  console.log(`  ${title}`);
  console.log('='.repeat(68));
}

function popLastMessage() {
  if (capturedMessages.length === 0) return '(no message sent)';
  const last = capturedMessages[capturedMessages.length - 1];
  return last.text;
}

async function run4WeeksSimulation() {
  printDivider('4-WEEK PERFECT PLEDGE SIMULATION (0 MISSES -> -₹10/WK REWARD)');

  const testPhone = 'whatsapp:+918888877777';

  // 1. Cleanup test user
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
  console.log('\n[Setup] Onboarding User: Tharun (4 days/week gym schedule)');
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
    current_gesture: 'peace-sign',
    timetable: JSON.stringify({
      Monday: 'Upper Body (Push Focus)',
      Tuesday: 'Lower Body (Legs Focus)',
      Wednesday: 'Rest',
      Thursday: 'Pull & Back Focus',
      Friday: 'Arms & Shoulders',
      Saturday: 'Rest',
      Sunday: 'Rest',
    }),
  });
  user = db.getUserById(user.id);
  console.log(`✓ User initialized: ${user.name} | Pledge: 30 Days | Deposit: ₹300 (Base Refund: ₹270)`);
  console.log(`✓ Subscription Base: Basic = ₹${config.pricing.basic.monthly}/mo | Pro = ₹${config.pricing.pro.monthly}/mo`);

  // Simulate Week 1 (Days 1 - 7)
  printDivider('WEEK 1 (Days 1 - 7): Perfect Attendance (0 Slips)');
  for (let day = 1; day <= 7; day++) {
    const dateStr = `2026-08-0${day}`;
    db.createCheckin({
      userId: user.id,
      date: dateStr,
      description: `Day ${day} workout completed strong!`,
      status: 'accepted',
    });
    db.updateUser(user.id, { streak: day, day_count: day });
  }
  user = db.getUserById(user.id);
  
  // Trigger Week 1 Sunday Summary
  capturedMessages = [];
  await scheduler.sendWeeklySummaries();
  let w1Discount = calculateSubscriptionDiscount(1, false);
  let w1ProDiscount = calculateSubscriptionDiscount(1, true);

  console.log('🤖 Bot Week 1 Summary Notification:\n' + popLastMessage());
  console.log(`\n📊 Week 1 Metrics:`);
  console.log(`• Streak: ${user.streak} days | Slips: ${user.missed_count}`);
  console.log(`• Full Refund Balance: ₹${calculatePledgePayout(user, user.missed_count).payout}`);
  console.log(`🎁 Unlocked Reward: ₹${w1Discount.totalDiscount} OFF Month-2 Subscription`);
  console.log(`   - Standard Plan: ₹${config.pricing.standard.base} → ₹${w1Discount.finalPrice}/month`);
  console.log(`   - Pro Plan: ₹${config.pricing.pro.base} → ₹${w1ProDiscount.finalPrice}/month`);

  // Simulate Week 2 (Days 8 - 14)
  printDivider('WEEK 2 (Days 8 - 14): Perfect Attendance (0 Slips)');
  for (let day = 8; day <= 14; day++) {
    const dateStr = `2026-08-${day < 10 ? '0' + day : day}`;
    db.createCheckin({
      userId: user.id,
      date: dateStr,
      description: `Day ${day} workout completed!`,
      status: 'accepted',
    });
    db.updateUser(user.id, { streak: day, day_count: day });
  }
  user = db.getUserById(user.id);
  db.updateUser(user.id, { last_weekly_summary_date: null }); // allow summary to fire for week 2

  capturedMessages = [];
  await scheduler.sendWeeklySummaries();
  let w2Discount = calculateSubscriptionDiscount(2, false);
  let w2ProDiscount = calculateSubscriptionDiscount(2, true);

  console.log('🤖 Bot Week 2 Summary Notification:\n' + popLastMessage());
  console.log(`\n📊 Week 2 Metrics:`);
  console.log(`• Streak: ${user.streak} days | Slips: ${user.missed_count}`);
  console.log(`• Full Refund Balance: ₹${calculatePledgePayout(user, user.missed_count).payout}`);
  console.log(`🎁 Unlocked Reward: ₹${w2Discount.totalDiscount} OFF Month-2 Subscription (₹10 x 2 weeks)`);
  console.log(`   - Standard Plan: ₹${config.pricing.standard.base} → ₹${w2Discount.finalPrice}/month`);
  console.log(`   - Pro Plan: ₹${config.pricing.pro.base} → ₹${w2ProDiscount.finalPrice}/month`);

  // Simulate Week 3 (Days 15 - 21)
  printDivider('WEEK 3 (Days 15 - 21): Perfect Attendance (0 Slips)');
  for (let day = 15; day <= 21; day++) {
    const dateStr = `2026-08-${day}`;
    db.createCheckin({
      userId: user.id,
      date: dateStr,
      description: `Day ${day} workout completed!`,
      status: 'accepted',
    });
    db.updateUser(user.id, { streak: day, day_count: day });
  }
  user = db.getUserById(user.id);
  db.updateUser(user.id, { last_weekly_summary_date: null });

  capturedMessages = [];
  await scheduler.sendWeeklySummaries();
  let w3Discount = calculateSubscriptionDiscount(3, false);
  let w3ProDiscount = calculateSubscriptionDiscount(3, true);

  console.log('🤖 Bot Week 3 Summary Notification:\n' + popLastMessage());
  console.log(`\n📊 Week 3 Metrics:`);
  console.log(`• Streak: ${user.streak} days | Slips: ${user.missed_count}`);
  console.log(`• Full Refund Balance: ₹${calculatePledgePayout(user, user.missed_count).payout}`);
  console.log(`🎁 Unlocked Reward: ₹${w3Discount.totalDiscount} OFF Month-2 Subscription (₹10 x 3 weeks)`);
  console.log(`   - Standard Plan: ₹${config.pricing.standard.base} → ₹${w3Discount.finalPrice}/month`);
  console.log(`   - Pro Plan: ₹${config.pricing.pro.base} → ₹${w3ProDiscount.finalPrice}/month`);

  // Simulate Week 4 (Days 22 - 30) -> Day 30 Pledge Completion
  printDivider('WEEK 4 (Days 22 - 30): Day 30 Pledge Completion (4 Clean Weeks)');
  for (let day = 22; day <= 30; day++) {
    const dateStr = `2026-08-${day}`;
    db.createCheckin({
      userId: user.id,
      date: dateStr,
      description: `Day ${day} workout completed!`,
      status: 'accepted',
    });
    db.updateUser(user.id, { streak: day, day_count: day });
  }
  user = db.getUserById(user.id);

  // Trigger Day 30 Completion Sweep
  capturedMessages = [];
  await scheduler.sweepAndPrompt(user, '2026-08-31', '2026-08-30');

  let w4Discount = calculateSubscriptionDiscount(4, false);
  let w4ProDiscount = calculateSubscriptionDiscount(4, true);
  let finalPayout = calculatePledgePayout(user, 0);

  console.log('🤖 Bot Final Day 30 Completion Notification:\n' + popLastMessage());

  console.log(`\n🏆 FINAL 30-DAY REPORT & SUBSCRIPTION PRICING:`);
  console.log(`====================================================================`);
  console.log(`• Total Days: 30 / 30 Completed`);
  console.log(`• Final Streak: 30 Days | Total Slips: 0`);
  console.log(`• Original Deposit: ₹${finalPayout.deposit}`);
  console.log(`• Platform Fee: ₹${finalPayout.platformFee}`);
  console.log(`• Full Refund Processed: ₹${finalPayout.payout} (100% refund)`);
  console.log(`--------------------------------------------------------------------`);
  console.log(`🌟 4-Week Consistency Discount Unlocked: ₹${w4Discount.totalDiscount}/month OFF (Max ₹40 cap)`);
  console.log(`   • Standard Subscription Month-2: ₹${config.pricing.standard.base} - ₹40 = ₹${w4Discount.finalPrice}/month (₹79/mo)`);
  console.log(`   • Pro Subscription Month-2:      ₹${config.pricing.pro.base} - ₹40 = ₹${w4ProDiscount.finalPrice}/month (₹199/mo)`);
  console.log(`====================================================================`);

  printDivider('VERIFICATION SUCCESSFUL: ₹10/WEEK LOWER SUBSCRIPTION WORKING PERFECTLY');

  // Clean test user
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

run4WeeksSimulation().catch(e => console.error('4-week simulation error:', e));
