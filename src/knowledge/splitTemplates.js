// Deterministic weekly-split templates by activity, goal, and days-per-week.
// This exists because leaving split assignment purely to freeform LLM improvisation
// produced inconsistent results at low day counts (e.g. 2 days/week) — the model had
// no concrete structure to follow, only prose like "match their goal & activity".
// These templates give Gemini (and a client-side validator/repair step) an exact,
// goal-appropriate structure to follow for any day count from 1 to 6.

function normalizeGoal(rawGoal) {
  const g = String(rawGoal || '').toLowerCase();
  if (/(lose|fat.?loss|cut|shred|lean|weight.?loss|slim)/.test(g)) return 'weight_loss';
  if (/(muscle|bulk|mass|hypertroph|strength|bigger|size|gain)/.test(g)) return 'muscle_gain';
  return 'general';
}

function normalizeActivityForSplit(rawActivity) {
  const a = String(rawActivity || '').toLowerCase();
  if (a === 'gym' || a === 'home_workout') return a;
  if (['running', 'walking', 'cycling'].includes(a)) return 'cardio';
  return 'gym';
}

// Muscle-group split day-labels for gym/home_workout, by days/week and goal category.
// Chosen so every day count gets a split that actually makes sense for that frequency —
// e.g. 2 days is Upper/Lower (not a compressed 3-way split), 3 days can be full-body
// or push/pull/legs, etc.
const STRENGTH_SPLITS = {
  1: {
    muscle_gain: ['Full Body Hypertrophy'],
    weight_loss: ['Full Body Fat-Burn Circuit'],
    general: ['Full Body Conditioning'],
  },
  2: {
    muscle_gain: ['Upper Body Hypertrophy', 'Lower Body Hypertrophy'],
    weight_loss: ['Full Body Fat-Burn Circuit A', 'Full Body Fat-Burn Circuit B'],
    general: ['Full Body Strength A', 'Full Body Strength B'],
  },
  3: {
    muscle_gain: ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps)', 'Legs & Core'],
    weight_loss: ['Full Body Circuit A', 'Full Body Circuit B', 'Full Body Circuit C'],
    general: ['Full Body A', 'Full Body B', 'Full Body C'],
  },
  4: {
    muscle_gain: ['Upper Body A (Chest & Triceps)', 'Lower Body A (Quads & Glutes)', 'Upper Body B (Back & Biceps)', 'Lower Body B (Hamstrings & Calves)'],
    weight_loss: ['Upper Body Fat-Burn', 'Lower Body Fat-Burn', 'Full Body HIIT', 'Core & Conditioning'],
    general: ['Upper Body', 'Lower Body', 'Full Body', 'Core & Mobility'],
  },
  5: {
    muscle_gain: ['Chest & Triceps', 'Back & Biceps', 'Legs & Glutes', 'Shoulders & Arms', 'Core & Weak Point Focus'],
    weight_loss: ['Full Body Circuit', 'Upper Body Fat-Burn', 'Lower Body Fat-Burn', 'HIIT Cardio & Core', 'Full Body Conditioning'],
    general: ['Push', 'Pull', 'Legs', 'Upper Body', 'Full Body'],
  },
  6: {
    muscle_gain: ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps)', 'Legs & Glutes', 'Push', 'Pull', 'Legs'],
    weight_loss: ['Full Body Circuit A', 'Upper Body Fat-Burn', 'Lower Body Fat-Burn', 'Full Body Circuit B', 'HIIT Cardio & Core', 'Active Recovery Circuit'],
    general: ['Push', 'Pull', 'Legs', 'Upper Body', 'Lower Body', 'Full Body'],
  },
};

// Session-type templates for cardio activities.
const CARDIO_SPLITS = {
  1: { muscle_gain: ['Steady Endurance Session'], weight_loss: ['Fat-Burn Steady Session'], general: ['Easy Aerobic Session'] },
  2: {
    muscle_gain: ['Steady Endurance Session', 'Tempo/Interval Session'],
    weight_loss: ['Fat-Burn Steady Session', 'Interval Fat-Burn Session'],
    general: ['Easy Session', 'Moderate Session'],
  },
  3: {
    muscle_gain: ['Easy Aerobic Session', 'Tempo Session', 'Long Endurance Session'],
    weight_loss: ['Easy Fat-Burn Session', 'Interval Session', 'Long Steady Session'],
    general: ['Easy Session', 'Moderate Session', 'Long Session'],
  },
  4: {
    muscle_gain: ['Easy Aerobic', 'Tempo', 'Easy Aerobic', 'Long Endurance'],
    weight_loss: ['Easy Fat-Burn', 'Interval', 'Easy Fat-Burn', 'Long Steady'],
    general: ['Easy', 'Moderate', 'Easy', 'Long'],
  },
  5: {
    muscle_gain: ['Easy Aerobic', 'Tempo', 'Easy Aerobic', 'Interval', 'Long Endurance'],
    weight_loss: ['Easy Fat-Burn', 'Interval', 'Easy Fat-Burn', 'Interval', 'Long Steady'],
    general: ['Easy', 'Moderate', 'Easy', 'Moderate', 'Long'],
  },
  6: {
    muscle_gain: ['Easy Aerobic', 'Tempo', 'Easy Aerobic', 'Interval', 'Easy Aerobic', 'Long Endurance'],
    weight_loss: ['Easy Fat-Burn', 'Interval', 'Easy Fat-Burn', 'Interval', 'Easy Fat-Burn', 'Long Steady'],
    general: ['Easy', 'Moderate', 'Easy', 'Moderate', 'Easy', 'Long'],
  },
};

// Default day-of-week slots used only to repair a timetable whose workout-day COUNT
// doesn't match days_per_week — spreads sessions evenly with rest days between where possible.
const DEFAULT_DAY_SLOTS = {
  1: ['Wednesday'],
  2: ['Monday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Returns the ordered list of day-focus labels for the given activity/goal/day-count,
 * or null if daysPerWeek is out of the supported 1-6 range (7 days has no rest day,
 * which the app deliberately never prescribes).
 */
function getSplitTemplate(rawActivity, rawGoal, daysPerWeek) {
  const n = Number(daysPerWeek);
  if (!n || n < 1 || n > 6) return null;
  const goal = normalizeGoal(rawGoal);
  const activity = normalizeActivityForSplit(rawActivity);
  const table = activity === 'cardio' ? CARDIO_SPLITS : STRENGTH_SPLITS;
  return table[n][goal];
}

/** Renders the template as a compact instruction block to inject into a Gemini prompt. */
function formatSplitTemplateForPrompt(rawActivity, rawGoal, daysPerWeek) {
  const template = getSplitTemplate(rawActivity, rawGoal, daysPerWeek);
  if (!template) return '';
  return `
== REQUIRED SPLIT STRUCTURE (${daysPerWeek} day(s)/week, goal: ${normalizeGoal(rawGoal)}) ==
This exact sequence of ${template.length} session focus(es) MUST be used for the ${template.length} workout day(s) you assign in "timetable" — in this order, one per chosen workout day:
${template.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}
All remaining days of the week MUST be "Rest". Do not invent a different split structure or add/remove workout days from this count.
== END REQUIRED SPLIT STRUCTURE ==
`.trim();
}

/**
 * Validates that a generated timetable has exactly daysPerWeek non-Rest days.
 * If it doesn't (or the timetable is missing/malformed), builds a correct one
 * deterministically from the template so the user always gets a properly split,
 * goal-appropriate schedule matching their stated day count.
 */
function ensureValidTimetable(timetable, rawActivity, rawGoal, daysPerWeek) {
  const template = getSplitTemplate(rawActivity, rawGoal, daysPerWeek);
  if (!template) return timetable; // out of supported range — leave whatever was generated

  const isValidShape = timetable && typeof timetable === 'object' &&
    ALL_DAYS.every((d) => typeof timetable[d] === 'string');
  const workoutDayCount = isValidShape
    ? ALL_DAYS.filter((d) => timetable[d].toLowerCase() !== 'rest').length
    : -1;

  if (isValidShape && workoutDayCount === Number(daysPerWeek)) {
    return timetable; // already correct — trust the LLM's day choices and wording
  }

  // Repair: build a clean, correctly-sized timetable from the template.
  const slots = DEFAULT_DAY_SLOTS[Number(daysPerWeek)] || DEFAULT_DAY_SLOTS[3];
  const repaired = {};
  for (const day of ALL_DAYS) repaired[day] = 'Rest';
  slots.forEach((day, i) => {
    repaired[day] = template[i] || template[template.length - 1];
  });
  return repaired;
}

module.exports = {
  normalizeGoal,
  normalizeActivityForSplit,
  getSplitTemplate,
  formatSplitTemplateForPrompt,
  ensureValidTimetable,
};
