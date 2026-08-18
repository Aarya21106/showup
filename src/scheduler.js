const cron = require('node-cron');
const config = require('./config');
const db = require('./db/db');
const states = require('./conversation/states');
const messages = require('./conversation/messages');
const messaging = require('./services/messaging');
const poster = require('./services/poster');
const { todayStr, nowHHMM, addDaysStr } = require('./utils/date');

const GESTURES = [
  'one-finger',
  'two-fingers',
  'three-fingers',
  'four-fingers',
  'open-palm',
  'thumbs-up',
  'fist',
  'yo-yo',
  'spiderman',
  'peace-sign',
  'ok-sign',
  'rock-on',
  'gun-finger',
  'crossed-fingers',
  'l-shape',
];
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

function isTimeOneHourBefore(checkinTime, currentTime) {
  if (!checkinTime || !currentTime) return false;
  const [cHour, cMin] = checkinTime.split(':').map(Number);
  const [currHour, currMin] = currentTime.split(':').map(Number);
  const targetHour = (cHour - 1 + 24) % 24;
  return targetHour === currHour && cMin === currMin;
}

function isTimeTwoHoursLater(checkinTime, currentTime) {
  if (!checkinTime || !currentTime) return false;
  const [cHour, cMin] = checkinTime.split(':').map(Number);
  const [currHour, currMin] = currentTime.split(':').map(Number);
  const targetHour = (cHour + 2) % 24;
  return targetHour === currHour && cMin === currMin;
}

/**
 * Runs once per user per day, right before that day's check-in prompt:
 * 1. Sweeps yesterday's program day - if there's no accepted check-in for it
 *    and it wasn't legitimately rescheduled, it counts as an unexcused miss.
 * 2. Either sends today's prompt, or closes the pledge window.
 */
async function sweepAndPrompt(user, today, yesterday) {
  const scheduleService = require('./services/scheduleService');
  let missedIncrement = 0;
  let streakReset = false;
  let clearedPending = false;

  const yesterdayEffective = scheduleService.getEffectiveWorkoutForDate(user, yesterday, config.timezone);
  
  if (user.day_count >= 1 && yesterdayEffective.isWorkout && !yesterdayEffective.isRescheduled) {
    // Check if there was an active override that moved yesterday's session
    const overrides = db.getScheduleOverridesForWeek(user.id, yesterday, today);
    const movedAway = overrides.find(o => o.original_date === yesterday && o.rescheduled_date > yesterday);
    
    if (!movedAway) {
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
  }

  const missed = user.missed_count + missedIncrement;
  const streak = streakReset ? 0 : user.streak;
  const dayCount = user.day_count + 1;
  const pendingCheckinId = clearedPending ? null : user.pending_checkin_id;

  if (missedIncrement) {
    const missedMsg =
      `You missed yesterday's session.\n\n` +
      `One missed workout does not break progress. Repeated misses do.\n\n` +
      `What got in the way?\n` +
      `• Time / Schedule\n` +
      `• Energy / Fatigue\n` +
      `• Motivation\n` +
      `• Something came up\n` +
      `• Other`;
    await messaging.sendText(user.phone, missedMsg);
  }

  if (dayCount > config.pledgeDays) {
    const { calculatePledgePayout, calculateSubscriptionDiscount } = require('./utils/payout');
    const { payout } = calculatePledgePayout(user, missed);
    const completedDays = config.pledgeDays - missed;
    const cleanWeeks = Math.floor(completedDays / 7);
    const discount = calculateSubscriptionDiscount(cleanWeeks, user.tier === 'pro_350' || user.tier === 'pro_120');

    let discountText = '';
    if (missed === 0) {
      discountText = `Unlocked maximum ₹40/mo discount on your Month-2 subscription! (Standard: ₹79/mo down from ₹119 | Pro: ₹199/mo down from ₹239)`;
    } else if (cleanWeeks > 0) {
      discountText = `Unlocked ₹${discount.totalDiscount}/mo discount on your Month-2 subscription (Standard: ₹${119 - discount.totalDiscount}/mo | Pro: ₹${239 - discount.totalDiscount}/mo)`;
    }

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
      ? messages.t(user.language, 'finalComplete', payout, discountText)
      : messages.t(user.language, 'finalPartial', completedDays, payout);
    await messaging.sendText(user.phone, msg);
    return;
  }

  const effectiveToday = scheduleService.getEffectiveWorkoutForDate(user, today, config.timezone);

  if (effectiveToday.isWorkout) {
    const gesture = getRandomGesture();
    db.updateUser(user.id, {
      streak, missed_count: missed, day_count: dayCount, last_prompted_date: today,
      state: states.ACTIVE, pending_checkin_id: pendingCheckinId, current_gesture: gesture,
      workout_reminded_date: today, workout_acknowledged_date: null,
    });

    let reminderText;
    try {
      const gemini = require('./services/gemini');
      reminderText = await gemini.generateWorkoutReminder(user, effectiveToday.focus);
    } catch (err) {
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
    const restMsg = `Today is a Rest Day in your schedule (${effectiveToday.focus}). Recover well! Drink plenty of water and eat clean. Day ${dayCount}/${config.pledgeDays}.`;
    await messaging.sendText(user.phone, restMsg);
  }
}

async function triggerUserReminder(user, reminderType = 'workout') {
  const gemini = require('./services/gemini');
  const scheduleService = require('./services/scheduleService');
  const today = todayStr(config.timezone);
  const effectiveToday = scheduleService.getEffectiveWorkoutForDate(user, today, config.timezone);

  if (reminderType === 'workout') {
    if (effectiveToday.isWorkout) {
      let gesture = user.current_gesture;
      if (!gesture) {
        gesture = getRandomGesture();
        db.updateUser(user.id, { current_gesture: gesture, workout_reminded_date: today });
        user.current_gesture = gesture;
        user.workout_reminded_date = today;
      }
      let reminderText;
      try {
        reminderText = await gemini.generateWorkoutReminder(user, effectiveToday.focus);
      } catch (err) {
        const gestureText = messages.t(user.language, `gesture_${gesture}`);
        reminderText = messages.t(user.language, 'dailyPrompt', user.activity, gestureText);
      }
      await messaging.sendText(user.phone, reminderText);
    } else {
      const restMsg = `Today is a Rest Day in your schedule (${effectiveToday.focus}). Recover well! Rest is when your muscles rebuild and grow. Stay hydrated and eat clean. Day ${user.day_count}/${config.pledgeDays}.`;
      await messaging.sendText(user.phone, restMsg);
    }
    return;
  }

  if (reminderType === 'water') {
    let msg;
    try {
      msg = await gemini.generateHydrationReminder(user);
    } catch (e) {
      msg = `Hydration check, ${user.name}! Keep a bottle near you and drink 500ml water now. Consistent hydration keeps performance and recovery high!`;
    }
    await messaging.sendText(user.phone, msg);
    return;
  }

  if (reminderType === 'meal_breakfast' || reminderType === 'meal_lunch' || reminderType === 'meal_dinner') {
    const mealType = reminderType.replace('meal_', '');
    let msg;
    try {
      msg = await gemini.generateMealReminder(user, mealType);
    } catch (e) {
      msg = `Meal check-in (${mealType}), ${user.name}! Remember your daily protein target (~${user.weight ? Math.round(user.weight * 1.8) : 130}g). Log what you ate!`;
    }
    await messaging.sendText(user.phone, msg);
    return;
  }

  if (reminderType === 'sleep') {
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
  const tomorrow = addDaysStr(today, 1);
  const gemini = require('./services/gemini');
  const scheduleService = require('./services/scheduleService');

  for (const user of db.getActiveUsers()) {
    // 1. Daily scheduled workout or rest prompt
    if (user.checkin_time === currentTime && user.last_prompted_date !== today) {
      sweepAndPrompt(user, today, yesterday).catch((err) => {
        console.error(`Scheduler error (daily prompt) for user ${user.id}:`, err.message);
      });
    }

    const effectiveToday = scheduleService.getEffectiveWorkoutForDate(user, today, config.timezone);
    const effectiveTomorrow = scheduleService.getEffectiveWorkoutForDate(user, tomorrow, config.timezone);

    // 2. Day-Before Workout Reminder (at 20:00)
    if (currentTime === '20:00') {
      if (effectiveTomorrow.isWorkout && user.last_day_before_reminder_date !== tomorrow) {
        const timeStr = user.checkin_time || '07:00';
        const msg =
          `Tomorrow is a training day.\n\n` +
          `You have your ${effectiveTomorrow.focus} workout scheduled for ${timeStr}.\n\n` +
          `Plan your day around it.`;
        messaging.sendText(user.phone, msg).catch(e => console.error(e));
        db.updateUser(user.id, { last_day_before_reminder_date: tomorrow });
      }
    }

    // 3. Same-Day Pre-Workout Reminder (1 hour before training time)
    if (effectiveToday.isWorkout && isTimeOneHourBefore(user.checkin_time, currentTime)) {
      if (user.last_same_day_reminder_date !== today) {
        const timeStr = user.checkin_time || '07:00';
        const msg =
          `Training today — ${timeStr}.\n\n` +
          `${effectiveToday.focus}.\n\n` +
          `Your session is ready. I'll check in after your workout.`;
        messaging.sendText(user.phone, msg).catch(e => console.error(e));
        db.updateUser(user.id, { last_same_day_reminder_date: today });
      }
    }

    // 4. Post-Workout Check-in (2 hours after scheduled time)
    if (effectiveToday.isWorkout && isTimeTwoHoursLater(user.checkin_time, currentTime)) {
      const checkinToday = db.getCheckinByUserDate(user.id, today);
      const hasCheckedIn = checkinToday && checkinToday.status === 'accepted';
      if (!hasCheckedIn && user.post_workout_prompt_date !== today) {
        const msg =
          `How did today's workout go?\n\n` +
          `1. Completed\n` +
          `2. Modified\n` +
          `3. Couldn't train\n` +
          `4. Rescheduled\n\n` +
          `Reply with your choice or send your check-in proof!`;
        messaging.sendText(user.phone, msg).catch(e => console.error(e));
        db.updateUser(user.id, { post_workout_prompt_date: today });
      }
    }

    // 5. 3-Hour post check-in gesture reminder
    if (effectiveToday.isWorkout && user.current_gesture && user.last_prompted_date === today) {
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

    // 6. Hydration alerts (10:00, 14:00, 18:00, 21:00)
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

    // 7. Meal & Nutrition Check-in (09:00 Breakfast, 13:30 Lunch, 20:30 Dinner)
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

    // 8. Sleep & Nightly Recovery Reminder (22:30)
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

    // 9. Weekly Structured Review (Sunday at 18:00)
    const weekday = scheduleService.getDayName(today, config.timezone);
    if (weekday === 'Sunday' && currentTime === '18:00' && user.last_weekly_summary_date !== today) {
      const adherence = scheduleService.getWeeklyAdherence(user, today, config.timezone);
      const msg =
        `Weekly Check-In\n\n` +
        `This week's progress: ${adherence.completed}/${adherence.target} workouts completed (${adherence.rescheduled} rescheduled, ${adherence.missed} missed).\n\n` +
        `1. How much do you weigh this morning?\n` +
        `2. How did your training go this week? (Completed as planned / Mostly completed / Struggled)\n` +
        `3. How was your average sleep & recovery?\n` +
        `4. Any noticeable changes in strength, measurements, appearance, energy, or appetite?`;
      messaging.sendText(user.phone, msg).catch(e => console.error(e));
      db.updateUser(user.id, { last_weekly_summary_date: today });
    }
  }
}

async function sendWeeklySummaries() {
  const { calculatePledgePayout, calculateSubscriptionDiscount } = require('./utils/payout');
  const today = todayStr(config.timezone);
  for (const user of db.getActiveUsers()) {
    if (user.last_weekly_summary_date === today) continue;
    try {
      const missed = user.missed_count;
      const { payout } = calculatePledgePayout(user, missed);
      const daysLeft = Math.max(config.pledgeDays - user.day_count, 0);
      const cleanWeeks = Math.floor(user.day_count / 7);
      const discount = calculateSubscriptionDiscount(cleanWeeks, user.tier === 'pro_350' || user.tier === 'pro_120');

      let discountText = '';
      if (missed === 0 && cleanWeeks > 0) {
        discountText = `Unlocked ₹${discount.totalDiscount}/mo off Month-2 subscription (Standard: ₹${119 - discount.totalDiscount}/mo | Pro: ₹${239 - discount.totalDiscount}/mo)`;
      }

      db.updateUser(user.id, { last_weekly_summary_date: today });
      const msg = missed === 0
        ? messages.t(user.language, 'weeklyOnTrack', user.streak, daysLeft, payout, discountText)
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

module.exports = { startScheduler, tick, triggerUserReminder, sendWeeklySummaries, runNightlySummaries, checkFollowUpNudges, runWeeklyPersonalization, sweepAndPrompt };

