const cron = require('node-cron');
const config = require('./config');
const db = require('./db/db');
const states = require('./conversation/states');
const messages = require('./conversation/messages');
const twilio = require('./services/twilio');
const poster = require('./services/poster');
const { todayStr, nowHHMM, addDaysStr } = require('./utils/date');

/**
 * Runs once per user per day, right before that day's check-in prompt:
 * 1. Sweeps yesterday's program day - if there's no accepted check-in for it
 *    (missing entirely, or stuck 'pending' in an unresolved follow-up), it's a slip.
 * 2. Either sends today's prompt, or - if the pledge window has elapsed - closes
 *    the pledge out with a final tally (covers the case where day 30 itself was missed).
 */
async function sweepAndPrompt(user, today, yesterday) {
  let missedIncrement = 0;
  let streakReset = false;
  let clearedPending = false;

  if (user.day_count >= 1) {
    const existing = db.getCheckinByUserDate(user.id, yesterday);
    if (!existing) {
      db.createCheckin({ userId: user.id, date: yesterday, status: 'missed' });
      missedIncrement = 1;
      streakReset = true;
    } else if (existing.status === 'pending') {
      db.updateCheckin(existing.id, { status: 'missed' });
      missedIncrement = 1;
      streakReset = true;
      if (user.pending_checkin_id === existing.id) clearedPending = true;
    }
  }

  const missed = user.missed_count + missedIncrement;
  const streak = streakReset ? 0 : user.streak;
  const dayCount = user.day_count + 1;
  const pendingCheckinId = clearedPending ? null : user.pending_checkin_id;

  if (missedIncrement) {
    await twilio.sendText(user.phone, messages.t(user.language, 'missedYesterday'));
  }

  if (dayCount > config.pledgeDays) {
    const payout = missed === 0
      ? config.fullPayoutInr
      : Math.max(config.depositAmountInr - config.slipPenaltyInr * missed, 0);
    const completedDays = config.pledgeDays - missed;

    db.updateUser(user.id, {
      state: states.COMPLETED, streak, missed_count: missed, day_count: dayCount,
      pending_checkin_id: pendingCheckinId, last_prompted_date: today,
    });

    const { publicUrl } = await poster.renderFinalPoster({
      userId: user.id, name: user.name, activity: user.activity, completedDays, payout,
    });
    await twilio.sendMedia(user.phone, `${user.name} — final tally.`, publicUrl);
    const msg = missed === 0
      ? messages.t(user.language, 'finalComplete', payout)
      : messages.t(user.language, 'finalPartial', completedDays, payout);
    await twilio.sendText(user.phone, msg);
    return;
  }

  db.updateUser(user.id, {
    streak, missed_count: missed, day_count: dayCount, last_prompted_date: today,
    state: states.ACTIVE, pending_checkin_id: pendingCheckinId,
  });
  await twilio.sendText(user.phone, messages.t(user.language, 'dailyPrompt', user.activity));
}

function tick() {
  const currentTime = nowHHMM(config.timezone);
  const today = todayStr(config.timezone);
  const yesterday = addDaysStr(today, -1);

  for (const user of db.getActiveUsers()) {
    if (user.checkin_time === currentTime && user.last_prompted_date !== today) {
      sweepAndPrompt(user, today, yesterday).catch((err) => {
        console.error(`Scheduler error (daily prompt) for user ${user.id}:`, err.message);
      });
    }
  }
}

async function sendWeeklySummaries() {
  const today = todayStr(config.timezone);
  for (const user of db.getActiveUsers()) {
    if (user.last_weekly_summary_date === today) continue;
    try {
      const missed = user.missed_count;
      const payout = missed === 0
        ? config.fullPayoutInr
        : Math.max(config.depositAmountInr - config.slipPenaltyInr * missed, 0);
      const daysLeft = Math.max(config.pledgeDays - user.day_count, 0);

      db.updateUser(user.id, { last_weekly_summary_date: today });
      const msg = missed === 0
        ? messages.t(user.language, 'weeklyOnTrack', user.streak, daysLeft, payout)
        : messages.t(user.language, 'weeklySlipped', missed, payout);
      await twilio.sendText(user.phone, msg);
    } catch (err) {
      console.error(`Scheduler error (weekly summary) for user ${user.id}:`, err.message);
    }
  }
}

function startScheduler() {
  // Checked every minute; each user only actually fires once/day thanks to last_prompted_date.
  cron.schedule('* * * * *', tick, { timezone: config.timezone });
  // Sundays at 18:00 in the program timezone.
  cron.schedule('0 18 * * 0', () => { sendWeeklySummaries(); }, { timezone: config.timezone });
  console.log(`Scheduler started (timezone: ${config.timezone})`);
}

module.exports = { startScheduler, tick, sendWeeklySummaries };
