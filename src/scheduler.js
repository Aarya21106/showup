const cron = require('node-cron');
const config = require('./config');
const db = require('./db/db');
const states = require('./conversation/states');
const messages = require('./conversation/messages');
const whatsapp = require('./services/whatsapp');
const poster = require('./services/poster');
const { todayStr, nowHHMM, addDaysStr } = require('./utils/date');

const GESTURES = ['thumbs-up', 'peace-sign', 'three-fingers', 'fist', 'ok-sign'];
function getRandomGesture() {
  return GESTURES[Math.floor(Math.random() * GESTURES.length)];
}

function isTimeThreeHoursLater(checkinTime, currentTime) {
  const [cHour, cMin] = checkinTime.split(':').map(Number);
  const [currHour, currMin] = currentTime.split(':').map(Number);
  const targetHour = (cHour + 3) % 24;
  return targetHour === currHour && cMin === currMin;
}

function getDayName(dateStr, timezone) {
  try {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', weekday: 'long'
    }).format(d);
  } catch (err) {
    return 'Monday';
  }
}

function isWorkoutDay(user, dateStr, timezone) {
  if (!user.timetable) return true;
  try {
    const weekday = getDayName(dateStr, timezone);
    const timetable = JSON.parse(user.timetable);
    const focus = timetable[weekday];
    return focus && focus.toLowerCase() !== 'rest';
  } catch (err) {
    return true;
  }
}

function getTodayWorkoutFocus(user, todayDayName) {
  if (!user.timetable) return null;
  try {
    const timetable = JSON.parse(user.timetable);
    const focus = timetable[todayDayName];
    if (focus && focus.toLowerCase() !== 'rest') {
      return focus;
    }
  } catch (err) {
    return null;
  }
  return null;
}

function isTimeTwoHoursLater(checkinTime, currentTime) {
  const [cHour, cMin] = checkinTime.split(':').map(Number);
  const [currHour, currMin] = currentTime.split(':').map(Number);
  const targetHour = (cHour + 2) % 24;
  return targetHour === currHour && cMin === currMin;
}

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

  const yesterdayWasWorkout = isWorkoutDay(user, yesterday, config.timezone);
  if (user.day_count >= 1 && yesterdayWasWorkout) {
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
    await whatsapp.sendText(user.phone, messages.t(user.language, 'missedYesterday'));
  }

  if (dayCount > config.pledgeDays) {
    const payout = missed === 0
      ? config.fullPayoutInr
      : Math.max(config.depositAmountInr - config.slipPenaltyInr * missed, 0);
    const completedDays = config.pledgeDays - missed;

    db.updateUser(user.id, {
      state: states.COMPLETED, streak, missed_count: missed, day_count: dayCount,
      pending_checkin_id: pendingCheckinId, last_prompted_date: today, current_gesture: null,
      workout_reminded_date: null, workout_acknowledged_date: null,
    });

    const { publicUrl } = await poster.renderFinalPoster({
      userId: user.id, name: user.name, activity: user.activity, completedDays, payout,
    });
    await whatsapp.sendMedia(user.phone, `${user.name} — final tally.`, publicUrl);
    const msg = missed === 0
      ? messages.t(user.language, 'finalComplete', payout)
      : messages.t(user.language, 'finalPartial', completedDays, payout);
    await whatsapp.sendText(user.phone, msg);
    return;
  }

  const todayDayName = getDayName(today, config.timezone);
  const focusToday = getTodayWorkoutFocus(user, todayDayName);

  if (focusToday) {
    const gesture = getRandomGesture();
    db.updateUser(user.id, {
      streak, missed_count: missed, day_count: dayCount, last_prompted_date: today,
      state: states.ACTIVE, pending_checkin_id: pendingCheckinId, current_gesture: gesture,
      workout_reminded_date: today, workout_acknowledged_date: null,
    });

    let reminderText;
    try {
      const gemini = require('./services/gemini');
      reminderText = await gemini.generateWorkoutReminder(user, focusToday);
    } catch (err) {
      console.error('Error generating workout reminder:', err);
      const gestureText = messages.t(user.language, `gesture_${gesture}`);
      reminderText = messages.t(user.language, 'dailyPrompt', user.activity, gestureText);
    }
    await whatsapp.sendText(user.phone, reminderText);
  } else {
    db.updateUser(user.id, {
      streak, missed_count: missed, day_count: dayCount, last_prompted_date: today,
      state: states.ACTIVE, pending_checkin_id: pendingCheckinId, current_gesture: null,
      workout_reminded_date: null, workout_acknowledged_date: null,
    });
    const restMsg = `Today is a Rest Day in your schedule. Recover well! Drink plenty of water and eat clean. Day ${dayCount}/${config.pledgeDays}.`;
    await whatsapp.sendText(user.phone, restMsg);
  }
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

    const todayDayName = getDayName(today, config.timezone);
    const focusToday = getTodayWorkoutFocus(user, todayDayName);

    if (focusToday && user.workout_reminded_date === today) {
      if (isTimeTwoHoursLater(user.checkin_time, currentTime)) {
        const checkinToday = db.getCheckinByUserDate(user.id, today);
        const hasCheckedIn = checkinToday && checkinToday.status !== 'missed' && checkinToday.status !== 'failed';
        if (!hasCheckedIn) {
          if (user.workout_acknowledged_date !== today) {
            const msg = `Hey ${user.name}! You missed your workout reminder for ${focusToday} at ${user.checkin_time} and didn't reply. Are you lacing up or slipping? Get moving! 👊`;
            whatsapp.sendText(user.phone, msg).catch((err) => console.error(err));
          } else {
            const msg = `Hey ${user.name}! You mentioned you were going for ${focusToday}, but I haven't received your check-in proof yet. Send your photo + text proof now to log it!`;
            whatsapp.sendText(user.phone, msg).catch((err) => console.error(err));
          }
        }
      }
    }

    if (focusToday && user.current_gesture && user.last_prompted_date === today) {
      if (isTimeThreeHoursLater(user.checkin_time, currentTime)) {
        const checkinToday = db.getCheckinByUserDate(user.id, today);
        const hasCheckedIn = checkinToday && checkinToday.status !== 'missed' && checkinToday.status !== 'failed';
        if (!hasCheckedIn) {
          const gestureText = messages.t(user.language, `gesture_${user.current_gesture}`);
          whatsapp.sendText(user.phone, messages.t(user.language, 'reminder', gestureText, user.activity)).catch((err) => {
            console.error(`Scheduler error (reminder nudge) for user ${user.id}:`, err.message);
          });
        }
      }
    }

    const isPro = user.tier && user.tier.startsWith('pro');
    if (isPro) {
      const waterHours = ['10:00', '14:00', '18:00'];
      if (waterHours.includes(currentTime)) {
        const [lastDate, sentHoursStr] = (user.water_reminders_sent || '').split(':');
        const sentHours = lastDate === today ? (sentHoursStr || '').split(',') : [];
        const hourOnly = currentTime.split(':')[0];

        if (!sentHours.includes(hourOnly)) {
          const msg = `💧 *ShowUp Hydration Alert!* Time to drink a glass of water, ${user.name}. Keep your performance high and stay on track!`;
          whatsapp.sendText(user.phone, msg).catch((err) => {
            console.error(`Scheduler error (water reminder) for user ${user.id}:`, err.message);
          });
          const newSentHours = sentHours.concat(hourOnly).join(',');
          db.updateUser(user.id, { water_reminders_sent: `${today}:${newSentHours}` });
        }
      }
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
      await whatsapp.sendText(user.phone, msg);
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
