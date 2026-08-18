const db = require('../db/db');
const gemini = require('./gemini');
const config = require('../config');
const { todayStr, addDaysStr } = require('../utils/date');

function getDayName(dateStr, timezone = config.timezone) {
  try {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', weekday: 'long'
    }).format(d);
  } catch (err) {
    return 'Monday';
  }
}

function getWeekBounds(dateStr, timezone = config.timezone) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  const mondayOffset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) => dt.toISOString().split('T')[0];
  return {
    weekStart: fmt(monday),
    weekEnd: fmt(sunday),
  };
}

/**
 * Returns the effective workout for any date by combining base timetable + schedule overrides.
 */
function getEffectiveWorkoutForDate(user, dateStr, timezone = config.timezone) {
  const weekday = getDayName(dateStr, timezone);
  const { weekStart, weekEnd } = getWeekBounds(dateStr, timezone);
  const overrides = db.getScheduleOverridesForWeek(user.id, weekStart, weekEnd);

  // Check if a session was moved TO this date
  const movedToDate = overrides.find(o => o.rescheduled_date === dateStr && o.status !== 'cancelled_valid');
  if (movedToDate) {
    return {
      isWorkout: true,
      focus: movedToDate.session_name,
      isRescheduled: true,
      override: movedToDate,
    };
  }

  // Check if today's base session was moved AWAY
  const movedAway = overrides.find(o => o.original_date === dateStr && o.rescheduled_date !== dateStr);
  if (movedAway) {
    return {
      isWorkout: false,
      focus: `Rest (Session moved to ${getDayName(movedAway.rescheduled_date, timezone)})`,
      isRescheduled: true,
      override: movedAway,
    };
  }

  // Fallback to base timetable
  if (user.timetable) {
    try {
      const tt = JSON.parse(user.timetable);
      const focus = tt[weekday];
      if (focus && focus.toLowerCase() !== 'rest') {
        return {
          isWorkout: true,
          focus,
          isRescheduled: false,
        };
      }
    } catch (e) {
      // ignore
    }
  }

  return {
    isWorkout: false,
    focus: 'Rest Day',
    isRescheduled: false,
  };
}

/**
 * Intelligent, recovery-aware natural language reschedule handler.
 */
async function handleNaturalReschedule(user, text, timezone = config.timezone) {
  const today = todayStr(timezone);
  const todayWeekday = getDayName(today, timezone);
  const { weekStart, weekEnd } = getWeekBounds(today, timezone);
  const overrides = db.getScheduleOverridesForWeek(user.id, weekStart, weekEnd);

  let timetable = {};
  try {
    timetable = user.timetable ? JSON.parse(user.timetable) : {};
  } catch (e) {
    timetable = {};
  }

  const effectiveToday = getEffectiveWorkoutForDate(user, today, timezone);

  const prompt = `You are the schedule intelligence engine for ShowUp fitness coach.
User: ${user.name}
Today's Date: ${today} (${todayWeekday})
Week: ${weekStart} to ${weekEnd}
Base Timetable:
${JSON.stringify(timetable, null, 2)}

Active Schedule Overrides this week:
${JSON.stringify(overrides, null, 2)}

Today's Effective Session: ${effectiveToday.isWorkout ? effectiveToday.focus : 'Rest'}
User Message: "${text}"

Task:
1. Parse the user's scheduling or rescheduling request.
2. Determine:
   - "source_date": YYYY-MM-DD (e.g. today ${today} or specific day they want to move)
   - "target_date": YYYY-MM-DD (e.g. tomorrow or specific day they want to move to)
   - "session_name": The workout name/focus being moved
   - "reason": Why they are moving it (e.g. college, tired, work, illness)
3. Recovery & Conflict Evaluation:
   - Check what is scheduled on the target date.
   - If the target date already has a heavy workout or creates consecutive muscle clashes (e.g. Legs on Monday and Legs on Tuesday), suggest moving to an open rest day (e.g. Wednesday or Saturday) instead.
   - Preserves program sequence.
4. Output concise coach reply:
   - Acknowledge rescheduling without penalties.
   - Include:
     Original:
     [Source Day] → [Session Name]

     Updated:
     [Target Day] → [Session Name]

     Your weekly target remains ${user.days_per_week || 5} workouts.

Respond ONLY with strict JSON, no markdown fences:
{
  "is_reschedule": true,
  "source_date": "YYYY-MM-DD",
  "target_date": "YYYY-MM-DD",
  "session_name": "string",
  "reason": "string",
  "reply": "string (formatted coach response with Original vs Updated and weekly target preserved)"
}`;

  try {
    const result = await gemini.callGeminiRaw({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.2 });
    const cleaned = result.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);

    if (parsed.is_reschedule && parsed.target_date) {
      const sessionName = parsed.session_name || (effectiveToday.isWorkout ? effectiveToday.focus : 'Workout Session');
      db.createScheduleOverride(user.id, {
        originalDate: parsed.source_date || today,
        rescheduledDate: parsed.target_date,
        sessionName,
        reason: parsed.reason || 'User rescheduled',
        status: 'rescheduled',
      });
      return parsed.reply;
    }
  } catch (err) {
    console.error('[ScheduleService] Error during natural reschedule:', err.message);
  }

  // Fallback direct tomorrow reschedule if parse failed
  const tomorrow = addDaysStr(today, 1);
  const tomorrowWeekday = getDayName(tomorrow, timezone);
  const sessionName = effectiveToday.isWorkout ? effectiveToday.focus : 'Workout Session';

  db.createScheduleOverride(user.id, {
    originalDate: today,
    rescheduledDate: tomorrow,
    sessionName,
    reason: 'User requested reschedule',
    status: 'rescheduled',
  });

  return `Yes. I'll move today's session to tomorrow (${tomorrowWeekday}).\n\nOriginal:\n${todayWeekday} → ${sessionName}\n\nUpdated:\n${tomorrowWeekday} → ${sessionName}\n\nYour weekly target remains ${user.days_per_week || 5} workouts.`;
}

/**
 * Evaluates weekly training adherence considering completed, rescheduled, and missed sessions.
 */
function getWeeklyAdherence(user, dateStr, timezone = config.timezone) {
  const { weekStart, weekEnd } = getWeekBounds(dateStr, timezone);
  const checkins = db.getCheckinsForWeek(user.id, weekStart, weekEnd);
  const overrides = db.getScheduleOverridesForWeek(user.id, weekStart, weekEnd);

  const completed = checkins.filter(c => c.status === 'accepted').length;
  const target = user.days_per_week || 5;
  const missed = checkins.filter(c => c.status === 'missed').length;
  const rescheduled = overrides.filter(o => o.status === 'rescheduled').length;

  return {
    weekStart,
    weekEnd,
    target,
    completed,
    missed,
    rescheduled,
    isTargetMet: completed >= target,
  };
}

module.exports = {
  getDayName,
  getWeekBounds,
  getEffectiveWorkoutForDate,
  handleNaturalReschedule,
  getWeeklyAdherence,
};
