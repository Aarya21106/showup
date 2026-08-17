const cron = require('node-cron');
const config = require('./config');
const db = require('./db/db');
const states = require('./conversation/states');
const messages = require('./conversation/messages');
const messaging = require('./services/messaging');
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
    await messaging.sendText(user.phone, messages.t(user.language, 'missedYesterday'));
  }

  if (dayCount > config.pledgeDays) {
    const { calculatePledgePayout } = require('./utils/payout');
    const { payout } = calculatePledgePayout(user, missed);
    const completedDays = config.pledgeDays - missed;

    db.updateUser(user.id, {
      state: states.COMPLETED, streak, missed_count: missed, day_count: dayCount,
      pending_checkin_id: pendingCheckinId, last_prompted_date: today, current_gesture: null,
      workout_reminded_date: null, workout_acknowledged_date: null,
    });

    const { publicUrl } = await poster.renderFinalPoster({
      userId: user.id, name: user.name, activity: user.activity, completedDays, payout,
    });
    await messaging.sendMedia(user.phone, `${user.name} — final tally.`, publicUrl);
    const msg = missed === 0
      ? messages.t(user.language, 'finalComplete', payout)
      : messages.t(user.language, 'finalPartial', completedDays, payout);
    await messaging.sendText(user.phone, msg);
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
    await messaging.sendText(user.phone, reminderText);
  } else {
    db.updateUser(user.id, {
      streak, missed_count: missed, day_count: dayCount, last_prompted_date: today,
      state: states.ACTIVE, pending_checkin_id: pendingCheckinId, current_gesture: null,
      workout_reminded_date: null, workout_acknowledged_date: null,
    });
    const restMsg = `Today is a Rest Day in your schedule. Recover well! Drink plenty of water and eat clean. Day ${dayCount}/${config.pledgeDays}.`;
    await messaging.sendText(user.phone, restMsg);
  }
}

async function triggerUserReminder(user, reminderType = 'workout') {
  const gemini = require('./services/gemini');
  const today = todayStr(config.timezone);
  const todayDayName = getDayName(today, config.timezone);
  const focusToday = getTodayWorkoutFocus(user, todayDayName);

  if (reminderType === 'workout') {
    if (focusToday) {
      let gesture = user.current_gesture;
      if (!gesture) {
        gesture = getRandomGesture();
        db.updateUser(user.id, { current_gesture: gesture, workout_reminded_date: today });
        user.current_gesture = gesture;
        user.workout_reminded_date = today;
      }
      let reminderText;
      try {
        reminderText = await gemini.generateWorkoutReminder(user, focusToday);
      } catch (err) {
        const gestureText = messages.t(user.language, `gesture_${gesture}`);
        reminderText = messages.t(user.language, 'dailyPrompt', user.activity, gestureText);
      }
      await messaging.sendText(user.phone, reminderText);
    } else {
      const restMsg = `Today is a Rest Day in your schedule. Recover well! Rest is when your muscles rebuild and grow. Stay hydrated and eat clean. Day ${user.day_count}/${config.pledgeDays}.`;
      await messaging.sendText(user.phone, restMsg);
    }
    return;
  }

  if (reminderType === 'nudge') {
    const focus = focusToday || user.target_muscle || 'today\'s session';
    const msg = `Hey ${user.name}! Just checking in on your ${focus} workout. Have you laced up or are you slipping? Send your photo proof to lock in your check-in!`;
    await messaging.sendText(user.phone, msg);
    return;
  }

  if (reminderType === 'hydration' || reminderType === 'water') {
    let msg;
    try {
      msg = await gemini.generateHydrationReminder(user);
    } catch (e) {
      msg = `Hydration check, ${user.name}! Drink a large glass of water now. Aim for 3 to 4 liters today to keep muscle recovery and energy high.`;
    }
    await messaging.sendText(user.phone, msg);
    return;
  }

  if (reminderType.startsWith('meal') || reminderType === 'breakfast' || reminderType === 'lunch' || reminderType === 'dinner') {
    const mealName = reminderType.includes('breakfast') ? 'breakfast' : reminderType.includes('dinner') ? 'dinner' : 'lunch';
    let msg;
    try {
      msg = await gemini.generateMealReminder(user, mealName);
    } catch (e) {
      msg = `Meal check, ${user.name}! Ensure your ${mealName} has enough protein. Reply with what you ate to log your calories!`;
    }
    await messaging.sendText(user.phone, msg);
    return;
  }

  if (reminderType === 'sleep' || reminderType === 'recovery') {
    let msg;
    try {
      msg = await gemini.generateSleepRecoveryReminder(user);
    } catch (e) {
      msg = `Night check, ${user.name}! 7-8 hours of quality sleep tonight is when your muscles repair and rebuild. Wind down and sleep well!`;
    }
    await messaging.sendText(user.phone, msg);
    return;
  }

  if (reminderType === 'rest') {
    const restMsg = `Today is a Rest Day in your schedule. Rest and recovery is essential for muscle hypertrophy and joint health. Hydrate well and relax!`;
    await messaging.sendText(user.phone, restMsg);
    return;
  }
}

function tick() {
  const currentTime = nowHHMM(config.timezone);
  const today = todayStr(config.timezone);
  const yesterday = addDaysStr(today, -1);
  const gemini = require('./services/gemini');

  for (const user of db.getActiveUsers()) {
    // 1. Daily scheduled workout or rest prompt
    if (user.checkin_time === currentTime && user.last_prompted_date !== today) {
      sweepAndPrompt(user, today, yesterday).catch((err) => {
        console.error(`Scheduler error (daily prompt) for user ${user.id}:`, err.message);
      });
    }

    const todayDayName = getDayName(today, config.timezone);
    const focusToday = getTodayWorkoutFocus(user, todayDayName);

    // 2. 2-Hour post check-in reminder nudge
    if (focusToday && user.workout_reminded_date === today) {
      if (isTimeTwoHoursLater(user.checkin_time, currentTime)) {
        const checkinToday = db.getCheckinByUserDate(user.id, today);
        const hasCheckedIn = checkinToday && checkinToday.status !== 'missed' && checkinToday.status !== 'failed';
        if (!hasCheckedIn) {
          if (user.workout_acknowledged_date !== today) {
            const msg = `Hey ${user.name}! You missed your workout reminder for ${focusToday} at ${user.checkin_time} and didn't reply. Are you lacing up or slipping? Get moving!`;
            messaging.sendText(user.phone, msg).catch((err) => console.error(err));
          } else {
            const msg = `Hey ${user.name}! You mentioned you were heading out for ${focusToday}, but I haven't received your check-in proof yet. Send your photo + text proof now to log it!`;
            messaging.sendText(user.phone, msg).catch((err) => console.error(err));
          }
        }
      }
    }

    // 3. 3-Hour post check-in gesture reminder
    if (focusToday && user.current_gesture && user.last_prompted_date === today) {
      if (isTimeThreeHoursLater(user.checkin_time, currentTime)) {
        const checkinToday = db.getCheckinByUserDate(user.id, today);
        const hasCheckedIn = checkinToday && checkinToday.status !== 'missed' && checkinToday.status !== 'failed';
        if (!hasCheckedIn) {
          const gestureText = messages.t(user.language, `gesture_${user.current_gesture}`);
          messaging.sendText(user.phone, messages.t(user.language, 'reminder', gestureText, user.activity)).catch((err) => {
            console.error(`Scheduler error (reminder nudge) for user ${user.id}:`, err.message);
          });
        }
      }
    }

    // 4. Hydration alerts (10:00, 14:00, 18:00, 21:00)
    const waterHours = ['10:00', '14:00', '18:00', '21:00'];
    if (waterHours.includes(currentTime)) {
      const [lastDate, sentHoursStr] = (user.water_reminders_sent || '').split(':');
      const sentHours = lastDate === today ? (sentHoursStr || '').split(',') : [];
      const hourOnly = currentTime.split(':')[0];

      if (!sentHours.includes(hourOnly)) {
        gemini.generateHydrationReminder(user).then((msg) => {
          return messaging.sendText(user.phone, msg);
        }).catch((err) => {
          console.error(`Scheduler error (water reminder) for user ${user.id}:`, err.message);
        });
        const newSentHours = sentHours.concat(hourOnly).join(',');
        db.updateUser(user.id, { water_reminders_sent: `${today}:${newSentHours}` });
      }
    }

    // 5. Meal & Nutrition Check-in (09:00 Breakfast, 13:30 Lunch, 20:30 Dinner)
    const mealSchedule = { '09:00': 'breakfast', '13:30': 'lunch', '20:30': 'dinner' };
    if (mealSchedule[currentTime]) {
      const mealType = mealSchedule[currentTime];
      let remindersLog = {};
      try { remindersLog = JSON.parse(user.reminders_sent_log || '{}'); } catch (e) {}
      const todayLogs = remindersLog[today] || [];
      const reminderKey = `meal_${mealType}`;

      if (!todayLogs.includes(reminderKey)) {
        gemini.generateMealReminder(user, mealType).then((msg) => {
          return messaging.sendText(user.phone, msg);
        }).catch((err) => {
          console.error(`Scheduler error (${mealType} reminder) for user ${user.id}:`, err.message);
        });
        todayLogs.push(reminderKey);
        remindersLog[today] = todayLogs;
        db.updateUser(user.id, { reminders_sent_log: JSON.stringify(remindersLog) });
      }
    }

    // 6. Sleep & Nightly Recovery Reminder (22:30)
    if (currentTime === '22:30') {
      let remindersLog = {};
      try { remindersLog = JSON.parse(user.reminders_sent_log || '{}'); } catch (e) {}
      const todayLogs = remindersLog[today] || [];

      if (!todayLogs.includes('sleep_recovery')) {
        gemini.generateSleepRecoveryReminder(user).then((msg) => {
          return messaging.sendText(user.phone, msg);
        }).catch((err) => {
          console.error(`Scheduler error (sleep reminder) for user ${user.id}:`, err.message);
        });
        todayLogs.push('sleep_recovery');
        remindersLog[today] = todayLogs;
        db.updateUser(user.id, { reminders_sent_log: JSON.stringify(remindersLog) });
      }
    }
  }
}

async function sendWeeklySummaries() {
  const { calculatePledgePayout } = require('./utils/payout');
  const today = todayStr(config.timezone);
  for (const user of db.getActiveUsers()) {
    if (user.last_weekly_summary_date === today) continue;
    try {
      const missed = user.missed_count;
      const { payout } = calculatePledgePayout(user, missed);
      const daysLeft = Math.max(config.pledgeDays - user.day_count, 0);

      db.updateUser(user.id, { last_weekly_summary_date: today });
      const msg = missed === 0
        ? messages.t(user.language, 'weeklyOnTrack', user.streak, daysLeft, payout)
        : messages.t(user.language, 'weeklySlipped', missed, payout);
      await messaging.sendText(user.phone, msg);
    } catch (err) {
      console.error(`Scheduler error (weekly summary) for user ${user.id}:`, err.message);
    }
  }
}

// ── Memory layer: Nightly summary cron ──

async function runNightlySummaries() {
  const gemini = require('./services/gemini');
  const today = todayStr(config.timezone);
  console.log(`[Memory] Running nightly summaries for ${today}...`);

  for (const user of db.getActiveUsers()) {
    try {
      const dayMessages = db.getChatMessagesByDate(user.id, today);
      if (dayMessages.length === 0) continue; // no conversation today

      const profileJson = db.getProfileJson(user.id);
      const result = await gemini.generateDailySummary(user.id, today, dayMessages, profileJson);
      if (!result) continue;

      // Store the daily summary
      db.createDailySummary({
        userId: user.id,
        date: today,
        summary: result.summary,
        followUpWorthy: result.follow_up_worthy,
        followUpDate: result.follow_up_date || null,
      });

      // Merge any profile updates
      if (result.profile_updates && Object.keys(result.profile_updates).length > 0) {
        db.updateProfileJson(user.id, result.profile_updates);
      }

      console.log(`[Memory] Summary for user ${user.id}: "${result.summary}" | follow_up=${result.follow_up_worthy}`);
    } catch (err) {
      console.error(`[Memory] Nightly summary error for user ${user.id}:`, err.message);
    }
  }
}

// ── Memory layer: Follow-up nudge check (runs inside tick()) ──

async function checkFollowUpNudges() {
  const gemini = require('./services/gemini');
  const today = todayStr(config.timezone);
  const dueFollowUps = db.getDueFollowUps(today);

  for (const followUp of dueFollowUps) {
    try {
      const user = db.getUserById(followUp.user_id);
      if (!user) {
        db.resolveFollowUp(followUp.id);
        continue;
      }

      const profileJson = db.getProfileJson(user.id);
      const nudge = await gemini.generateFollowUpNudge(user, followUp.summary, profileJson);

      if (nudge) {
        await messaging.sendText(user.phone, nudge);
        console.log(`[Memory] Sent follow-up nudge to user ${user.id}: "${nudge}"`);
      }

      db.resolveFollowUp(followUp.id);
    } catch (err) {
      console.error(`[Memory] Follow-up nudge error for summary ${followUp.id}:`, err.message);
    }
  }
}

// ── Memory layer: Weekly personalization signal extraction ──

async function runWeeklyPersonalization() {
  const gemini = require('./services/gemini');
  const today = todayStr(config.timezone);
  const weekAgo = addDaysStr(today, -7);
  console.log(`[Memory] Running weekly personalization for ${weekAgo} to ${today}...`);

  for (const user of db.getActiveUsers()) {
    try {
      const weekMessages = db.getChatMessagesForWeek(user.id, weekAgo, today);
      const weekCheckins = db.getCheckinsForWeek(user.id, weekAgo, today);
      if (weekMessages.length === 0) continue;

      const profileJson = db.getProfileJson(user.id);
      const existingPrefs = profileJson.preferences || {};

      const updatedPrefs = await gemini.extractPersonalizationSignals(
        user.id, weekMessages, weekCheckins, existingPrefs
      );

      if (updatedPrefs) {
        profileJson.preferences = updatedPrefs;
        db.updateProfileJson(user.id, profileJson);
        console.log(`[Memory] Updated preferences for user ${user.id}:`, JSON.stringify(updatedPrefs));
      }
    } catch (err) {
      console.error(`[Memory] Weekly personalization error for user ${user.id}:`, err.message);
    }
  }
}

// Track whether follow-up nudges have been sent today to avoid duplicates
let lastFollowUpCheckDate = null;

function startScheduler() {
  // Checked every minute; each user only actually fires once/day thanks to last_prompted_date.
  cron.schedule('* * * * *', () => {
    tick();

    // Check follow-up nudges once per day (at the first tick of the day)
    const today = todayStr(config.timezone);
    if (lastFollowUpCheckDate !== today) {
      lastFollowUpCheckDate = today;
      checkFollowUpNudges().catch(err => {
        console.error('[Memory] Follow-up nudge check failed:', err.message);
      });
    }
  }, { timezone: config.timezone });

  // Sundays at 18:00 in the program timezone.
  cron.schedule('0 18 * * 0', () => { sendWeeklySummaries(); }, { timezone: config.timezone });

  // Nightly summary at 23:30 every day.
  cron.schedule('30 23 * * *', () => { runNightlySummaries(); }, { timezone: config.timezone });

  // Weekly personalization at 22:00 on Sundays.
  cron.schedule('0 22 * * 0', () => { runWeeklyPersonalization(); }, { timezone: config.timezone });

  console.log(`Scheduler started (timezone: ${config.timezone}) [memory layer: nightly 23:30, weekly-prefs Sun 22:00]`);
}

module.exports = { startScheduler, tick, triggerUserReminder, sendWeeklySummaries, runNightlySummaries, checkFollowUpNudges, runWeeklyPersonalization };

