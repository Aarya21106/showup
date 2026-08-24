/**
 * Computes today's remaining reminders for one user as a flat list of
 * {id, fireAt, title, body} — used to schedule LOCAL notifications on the
 * device (see mobile/src/utils/reminderSync.ts), so reminders still fire
 * even when this server is asleep (Render's free tier) or the app has no
 * connection at the moment they're due.
 *
 * This mirrors scheduler.js's tick() decision logic (same "has this already
 * fired / already been done" checks) but as a one-shot "list what's still
 * due today" instead of a per-minute live check — the two are deliberately
 * kept as separate functions rather than sharing one, since tick() sends the
 * message itself (AI-generated, rich content) while this only decides
 * WHEN + a short static alert (the on-device notification is an alarm, not
 * the actual coaching message — that still arrives via chat/push same as
 * always). Whenever the device calls /api/reminder-plan (on app foreground,
 * and after actions that could invalidate a pending reminder), it gets a
 * fresh plan and reschedules its local alarms to match — so a completed
 * check-in or a logged meal correctly drops the now-pointless reminder
 * instead of an alarm firing for something already done.
 */

const db = require('../db/db');
const config = require('../config');
const { todayStr, nowHHMM, addDaysStr, addMinutesToHHMM, localTimeToUTCISOString } = require('../utils/date');
const scheduleService = require('./scheduleService');

function fireAtOrNull(dateStr, hhmm, timezone, currentTime) {
  if (!hhmm || hhmm <= currentTime) return null; // already passed today — nothing to schedule
  return localTimeToUTCISOString(dateStr, hhmm, timezone);
}

function computeTodayReminderPlan(user) {
  const timezone = config.timezone;
  const today = todayStr(timezone);
  const currentTime = nowHHMM(timezone);
  const reminders = [];

  const effectiveToday = scheduleService.getEffectiveWorkoutForDate(user, today, timezone);

  // ── Workout: 1hr-before, at check-in time, 2hr-after check, 3hr-after gesture nudge ──
  if (effectiveToday.isWorkout && user.checkin_time) {
    const oneHourBefore = addMinutesToHHMM(user.checkin_time, -60);
    const twoHoursAfter = addMinutesToHHMM(user.checkin_time, 120);
    const threeHoursAfter = addMinutesToHHMM(user.checkin_time, 180);

    if (user.last_same_day_reminder_date !== today) {
      const fireAt = fireAtOrNull(today, oneHourBefore, timezone, currentTime);
      if (fireAt) reminders.push({ id: 'workout-1hr-before', fireAt, title: 'Training today', body: `${effectiveToday.focus} — get ready.` });
    }

    if (user.last_prompted_date !== today) {
      const fireAt = fireAtOrNull(today, user.checkin_time, timezone, currentTime);
      if (fireAt) reminders.push({ id: 'workout-checkin', fireAt, title: 'Time to train', body: `${effectiveToday.focus} — let's go.` });
    }

    const checkinToday = db.getCheckinByUserDate(user.id, today);
    const hasCheckedIn = checkinToday && checkinToday.status === 'accepted';
    if (!hasCheckedIn) {
      if (user.post_workout_prompt_date !== today) {
        const fireAt = fireAtOrNull(today, twoHoursAfter, timezone, currentTime);
        if (fireAt) reminders.push({ id: 'workout-post-checkin', fireAt, title: 'How did it go?', body: 'Log your workout check-in.' });
      }
      if (user.current_gesture) {
        const hasAnyStatus = checkinToday && checkinToday.status !== 'missed' && checkinToday.status !== 'failed';
        if (!hasAnyStatus) {
          const fireAt = fireAtOrNull(today, threeHoursAfter, timezone, currentTime);
          if (fireAt) reminders.push({ id: 'workout-gesture-nudge', fireAt, title: 'Still waiting on your proof', body: 'Send your check-in photo to lock in today.' });
        }
      }
    }
  }

  // ── Water: 10:00, 14:00, 18:00, 21:00, minus already-sent ──
  const waterHours = ['10:00', '14:00', '18:00', '21:00'];
  const [lastWaterDate, sentHoursStr] = (user.water_reminders_sent || '').split(':');
  const sentWaterHours = lastWaterDate === today ? (sentHoursStr || '').split(',') : [];
  for (const hhmm of waterHours) {
    const hourOnly = hhmm.split(':')[0];
    if (sentWaterHours.includes(hourOnly)) continue;
    const fireAt = fireAtOrNull(today, hhmm, timezone, currentTime);
    if (fireAt) reminders.push({ id: `water-${hourOnly}`, fireAt, title: 'Hydration check', body: 'Grab a glass of water now.' });
  }

  // ── Meals: opt-in only, at the user's own configured times, plus a 1hr follow-up ──
  let remindersLog = {};
  try { remindersLog = JSON.parse(user.reminders_sent_log || '{}'); } catch (e) {}
  const todayLogs = remindersLog[today] || [];

  if (user.meal_reminder_optin === 'yes' && user.meal_reminder_times) {
    let mealTimes = null;
    try { mealTimes = JSON.parse(user.meal_reminder_times); } catch (e) { mealTimes = null; }

    if (mealTimes) {
      const configuredMeals = [];
      if (mealTimes.breakfast) configuredMeals.push({ key: 'meal_breakfast', mealType: 'breakfast', time: mealTimes.breakfast });
      if (mealTimes.lunch) configuredMeals.push({ key: 'meal_lunch', mealType: 'lunch', time: mealTimes.lunch });
      if (mealTimes.dinner) configuredMeals.push({ key: 'meal_dinner', mealType: 'dinner', time: mealTimes.dinner });
      if (Array.isArray(mealTimes.snacks)) {
        mealTimes.snacks.forEach((snackTime, idx) => {
          if (snackTime) configuredMeals.push({ key: `meal_snack_${idx}`, mealType: 'snack', time: snackTime });
        });
      }

      for (const meal of configuredMeals) {
        if (!todayLogs.includes(meal.key)) {
          const fireAt = fireAtOrNull(today, meal.time, timezone, currentTime);
          if (fireAt) reminders.push({ id: meal.key, fireAt, title: `${meal.mealType[0].toUpperCase()}${meal.mealType.slice(1)} time`, body: 'Log what you eat to track calories and protein.' });
        }
        const followUpKey = `${meal.key}_followup`;
        if (todayLogs.includes(meal.key) && !todayLogs.includes(followUpKey) && db.getNutritionLogsToday(user.id, today).length === 0) {
          const followUpTime = addMinutesToHHMM(meal.time, 60);
          const fireAt = fireAtOrNull(today, followUpTime, timezone, currentTime);
          if (fireAt) reminders.push({ id: followUpKey, fireAt, title: 'Did you eat yet?', body: `Log your ${meal.mealType} — it only takes a second.` });
        }
      }
    }
  } else if (!todayLogs.includes('nightly_food_nudge') && db.getNutritionLogsToday(user.id, today).length === 0) {
    const fireAt = fireAtOrNull(today, '21:00', timezone, currentTime);
    if (fireAt) reminders.push({ id: 'nightly-food-nudge', fireAt, title: "Haven't logged food today", body: 'Reply with what you ate to keep tracking.' });
  }

  // ── Sleep reminder (22:30) ──
  if (!todayLogs.includes('sleep_recovery')) {
    const fireAt = fireAtOrNull(today, '22:30', timezone, currentTime);
    if (fireAt) reminders.push({ id: 'sleep-recovery', fireAt, title: 'Wind down', body: '7-8 hours tonight is when your body actually recovers.' });
  }

  return reminders;
}

module.exports = { computeTodayReminderPlan };
