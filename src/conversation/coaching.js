const db = require('../db/db');
const gemini = require('../services/gemini');
const messaging = require('../services/messaging');
const scheduleService = require('../services/scheduleService');
const config = require('../config');
const { todayStr, addDaysStr } = require('../utils/date');

// Bug 5 fix: langMap was defined inside handleSubstitutionOrModification but
// referenced in handleHealthAlert where it was undeclared → ReferenceError crash.
// Moved to module scope so both functions share the same definition.
const langMap = (gemini && gemini.LANGUAGE_NAMES) || { en: 'English', ta: 'Tamil', hi: 'Hindi', tl: 'Tanglish', hl: 'Hinglish' };

/**
 * Parses and logs exercise performance (sets, reps, weights, RPE).
 */
async function handlePerformanceLog(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);

  const prompt = `You are the performance data extraction engine for ShowUp fitness coach.
User: ${user.name}
Text: "${text}"

Task: Extract structured workout performance records.
Return strict JSON array:
[
  {
    "exercise_name": "string (e.g. Bench Press)",
    "sets": number|null,
    "reps": number|null,
    "weight_kg": number|null,
    "rpe": number|null,
    "notes": "string|null"
  }
]`;

  try {
    const res = await gemini.callGeminiRaw({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.1 });
    const cleaned = res.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const exercises = JSON.parse(cleaned);

    if (Array.isArray(exercises) && exercises.length > 0) {
      for (const ex of exercises) {
        if (ex.exercise_name) {
          db.logWorkout(user.id, {
            date: today,
            exerciseName: ex.exercise_name,
            sets: ex.sets,
            reps: ex.reps,
            weightKg: ex.weight_kg,
            rpe: ex.rpe,
            status: 'completed',
            notes: ex.notes,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Coaching] Error logging performance:', err.message);
  }

  const coachReply = await gemini.handleGeneralQuery(user, text);
  await messaging.sendText(phone, coachReply);
}

/**
 * Handles bodyweight updates from natural conversation.
 */
async function handleWeightUpdate(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);

  const match = text.match(/(?:weighed|weight(?:\s+is)?(?:\s*:)?|i am|scale(?: says)?)\s*(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)?/i) ||
                text.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)$/i) ||
                text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos)\s*(?:today|this morning)/i);
  if (match) {
    const newWeight = parseFloat(match[1]);
    if (newWeight >= 30 && newWeight <= 250) {
      const prevWeight = user.weight;
      db.logWeight(user.id, newWeight, today);
      
      let diffStr = '';
      if (prevWeight && Math.abs(newWeight - prevWeight) <= 15) {
        const diff = (newWeight - prevWeight).toFixed(1);
        if (diff > 0) diffStr = ` (+${diff} kg from previous baseline)`;
        else if (diff < 0) diffStr = ` (${diff} kg from previous baseline)`;
      }

      const reply = `Weight logged: ${newWeight} kg${diffStr}.\n\nI have updated your metrics profile and will factor this trend into your nutrition and progression targets.`;
      await messaging.sendText(phone, reply);
      return;
    }
  }

  const coachReply = await gemini.handleGeneralQuery(user, text);
  await messaging.sendText(phone, coachReply);
}

/**
 * Handles responses to the post-workout check-in options:
 * 1. Completed
 * 2. Modified
 * 3. Couldn't train
 * 4. Rescheduled
 */
async function handlePostWorkoutResponse(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);
  const lower = text.toLowerCase().trim();

  // Option 1: Completed
  if (lower === '1' || lower.includes('completed') || lower.includes('done') || lower.includes('finished')) {
    const effective = scheduleService.getEffectiveWorkoutForDate(user, today);
    await messaging.sendText(phone, `Awesome work on completing ${effective.focus}!\n\nSend your photo + daily gesture proof or log your lifts to lock in your streak and progress!`);
    return;
  }

  // Option 2: Modified
  if (lower === '2' || lower.includes('modified') || lower.includes('adjusted') || lower.includes('lighter')) {
    const effective = scheduleService.getEffectiveWorkoutForDate(user, today);
    db.logWorkout(user.id, {
      date: today,
      exerciseName: effective.focus,
      status: 'modified',
      notes: text,
    });
    await messaging.sendText(phone, `Modified session logged for ${effective.focus}.\n\nConsistency and listening to your body always beats forced exhaustion. Send your check-in proof whenever you're ready!`);
    return;
  }

  // Option 3: Couldn't train
  if (lower === '3' || lower.includes("couldn't train") || lower.includes('could not') || lower.includes('missed') || lower.includes('skip')) {
    const tomorrow = addDaysStr(today, 1);
    const tomorrowDay = scheduleService.getDayName(tomorrow, config.timezone);
    const reply =
      `Understood. One missed session does not break progress — repeated misses do.\n\n` +
      `Would you like to move today's session to tomorrow (${tomorrowDay}) or another open day this week so your weekly target stays intact?`;
    await messaging.sendText(phone, reply);
    return;
  }

  // Option 4: Rescheduled
  if (lower === '4' || lower.includes('rescheduled') || lower.includes('reschedule') || lower.includes('tomorrow')) {
    const reply = await scheduleService.handleNaturalReschedule(user, text);
    await messaging.sendText(phone, reply);
    return;
  }

  // Fallback to natural language rescheduling or general query
  const reply = await scheduleService.handleNaturalReschedule(user, text);
  await messaging.sendText(phone, reply);
}

/**
 * Handles exercise substitutions, machine swaps, shortened workouts, and low-energy sessions.
 * Implements "Show Up First, Optimize Second".
 */
async function handleSubstitutionOrModification(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);
  const effective = scheduleService.getEffectiveWorkoutForDate(user, today);

  db.logWorkout(user.id, {
    date: today,
    exerciseName: effective.focus,
    status: 'modified',
    notes: text,
  });

  const langName = langMap[user.language] || 'English';
  const prompt = `You are ShowUp, an elite AI fitness coach living by the core principle: "Show Up First, Optimize Second".
User: ${user.name}
Language Preference: ${langName}
Today's Scheduled Session: ${effective.focus}
User Message: "${text}"

Rules:
1. Praise the user for showing up and getting the work done.
2. Acknowledge their substitution or modification cleanly without any criticism in their language (${langName}).
3. NEVER say "You failed to complete the workout".
4. Clarify that their attendance is recorded as completed, workout as modified, and penalty is none.
5. STRICT NO-EMOJIS RULE.
6. Keep reply concise (max 35-50 words).

Generate a warm, empowering coach response in ${langName}.`;

  try {
    const reply = await gemini.callGeminiRaw({ parts: [{ text: prompt }], temperature: 0.3 });
    await messaging.sendText(phone, reply.trim());
  } catch (err) {
    const fallback = `That's fine, ${user.name}. You still showed up and trained.\n\nI'll record this substitution and use it when evaluating your session.\n\nAttendance: Completed\nWorkout: Modified\nPenalty: None`;
    await messaging.sendText(phone, fallback);
  }
}

/**
 * Handles severe health concerns, injury, or sickness.
 * Prioritizes safety and excuses the session without penalty.
 */
async function handleHealthAlert(user, text) {
  const phone = user.phone;
  const today = todayStr(config.timezone);
  const effective = scheduleService.getEffectiveWorkoutForDate(user, today);

  db.createScheduleOverride(user.id, {
    originalDate: today,
    rescheduledDate: today,
    sessionName: effective.focus,
    reason: text,
    status: 'cancelled_valid',
  });

  const langName = langMap[user.language] || 'English';
  const prompt = `You are ShowUp, a responsible AI fitness coach who prioritizes safety and health above all else ("Consistency without unnecessary risk").
User: ${user.name}
Language Preference: ${langName}
User Message: "${text}"

Rules:
1. Prioritize their safety, rest, and medical care in their language (${langName}).
2. Reassure them that their session today is excused with ZERO penalty.
3. NEVER push them to train through injury, sharp pain, or serious illness.
4. STRICT NO-EMOJIS RULE.
5. Keep reply concise (max 35-50 words).

Generate a caring, professional coach response in ${langName}.`;

  try {
    const reply = await gemini.callGeminiRaw({ parts: [{ text: prompt }], temperature: 0.2 });
    await messaging.sendText(phone, reply.trim());
  } catch (err) {
    const fallback = `Your safety and health come first, ${user.name}. Please take today to rest and recover, and seek medical advice if needed.\n\nToday's session is excused with zero penalty. We will resume your training once you are fully recovered.`;
    await messaging.sendText(phone, fallback);
  }
}

/**
 * Handles a conversational request to change one meal reminder's time
 * (e.g. "remind me lunch at 1:22pm actually"), post-onboarding.
 * Bug fix: previously this class of message had no handler at all — it fell
 * through to handleGeneralQuery, which produced a confident "Got it, noted!"
 * reply without ever touching the database, so the reminder never changed.
 */
async function handleMealReminderUpdate(user, text) {
  const phone = user.phone;
  const parsed = await gemini.parseMealReminderUpdate({ user, text });

  if (!parsed.meal || !parsed.time) {
    // Didn't actually resolve to a specific meal + time — fall back to a normal
    // conversational reply rather than claiming a change that didn't happen.
    const reply = await gemini.handleGeneralQuery(user, text);
    await messaging.sendText(phone, reply);
    return;
  }

  let times;
  try { times = JSON.parse(user.meal_reminder_times || '{}'); } catch (e) { times = {}; }
  if (!times.breakfast) times.breakfast = '09:00';
  if (!times.lunch) times.lunch = '13:30';
  if (!times.dinner) times.dinner = '20:30';
  if (!Array.isArray(times.snacks)) times.snacks = [];

  if (parsed.meal === 'snack') {
    if (times.snacks.length > 0) {
      times.snacks[0] = parsed.time;
    } else {
      times.snacks.push(parsed.time);
    }
  } else {
    times[parsed.meal] = parsed.time;
  }

  db.updateUser(user.id, {
    meal_reminder_times: JSON.stringify(times),
    meal_reminder_optin: 'yes',
  });

  const mealLabel = parsed.meal.charAt(0).toUpperCase() + parsed.meal.slice(1);
  await messaging.sendText(phone, `Got it — ${mealLabel} reminder updated to ${parsed.time}. I'll remind you then.`);
}

module.exports = {
  handlePerformanceLog,
  handleWeightUpdate,
  handlePostWorkoutResponse,
  handleSubstitutionOrModification,
  handleHealthAlert,
  handleMealReminderUpdate,
};
