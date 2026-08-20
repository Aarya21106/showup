// Curated reference knowledge base for workout guidance.
//
// gym / home_workout are structured by DAYS-PER-WEEK first (1-6), not experience
// level — each day-count has an explicit, movement-pattern-balanced exercise split
// (squat, hinge, horizontal/vertical push, horizontal/vertical pull, core), the same
// approach used for a proper 2-day full-body A/B program. Experience level and goal
// only affect sets/reps/rest and progression pacing, layered on top separately — this
// is what prevents beginners from being forced into a fixed "3x10-12 for everyone"
// prescription, and prevents a day count from ever producing an unbalanced split
// (e.g. all squat/hinge work on Day 1, none on Day 2).
//
// running / walking / cycling remain organized by experience level, since those are
// single session-type progressions rather than a multi-day muscle-group split.
//
// Gemini is instructed to ground its answers in this data first; callers fall back to
// live Google Search grounding only when no entry matches (see gemini.js's `useSearch`
// param on callGemini).

const LEVEL_ALIASES = {
  beginner: 'beginner',
  some_experience: 'intermediate',
  experienced: 'advanced',
  beginners: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

function normalizeLevel(rawLevel) {
  if (!rawLevel) return 'beginner';
  const key = String(rawLevel).toLowerCase().trim();
  return LEVEL_ALIASES[key] || 'beginner';
}

function normalizeGoal(rawGoal) {
  const g = String(rawGoal || '').toLowerCase();
  if (/(lose|fat.?loss|cut|shred|lean|weight.?loss|slim)/.test(g)) return 'weight_loss';
  if (/(muscle|bulk|mass|hypertroph|strength|bigger|size|gain)/.test(g)) return 'muscle_gain';
  return 'general';
}

function normalizeActivity(rawActivity) {
  if (!rawActivity) return null;
  const key = String(rawActivity).toLowerCase().trim();
  if (['gym', 'weights', 'weight_training', 'strength'].includes(key)) return 'gym';
  if (['home_workout', 'home', 'bodyweight', 'calisthenics'].includes(key)) return 'home_workout';
  if (['running', 'run', 'jogging'].includes(key)) return 'running';
  if (['walking', 'walk'].includes(key)) return 'walking';
  if (['cycling', 'cycle', 'biking'].includes(key)) return 'cycling';
  return null;
}

// ── Day-count-driven, movement-pattern-balanced splits for gym & home_workout ──
// Every day lists which movement patterns it covers, with a concrete exercise example
// for each. Rep/set numbers are deliberately NOT baked in here — see getRepScheme().

const GYM_SPLITS = {
  1: [
    { focus: 'Full Body', patterns: ['Squat', 'Horizontal Push', 'Horizontal Pull', 'Hinge', 'Core'],
      exercises: ['Goblet Squat', 'Flat Dumbbell Press', 'Seated Cable Row', 'Romanian Deadlift', 'Plank'] },
  ],
  2: [
    { focus: 'Full Body A', patterns: ['Squat', 'Horizontal Push', 'Horizontal Pull', 'Core'],
      exercises: ['Goblet Squat', 'Flat Dumbbell Press', 'Seated Cable Row', 'Plank'] },
    { focus: 'Full Body B', patterns: ['Hinge', 'Vertical Push', 'Vertical Pull', 'Core'],
      exercises: ['Dumbbell Romanian Deadlift', 'Dumbbell Shoulder Press', 'Lat Pulldown', 'Dead Bug'] },
  ],
  3: [
    { focus: 'Full Body A', patterns: ['Squat', 'Horizontal Push', 'Horizontal Pull', 'Core'],
      exercises: ['Goblet Squat', 'Flat Dumbbell Press', 'Seated Cable Row', 'Plank'] },
    { focus: 'Full Body B', patterns: ['Hinge', 'Vertical Push', 'Vertical Pull', 'Core'],
      exercises: ['Romanian Deadlift', 'Dumbbell Shoulder Press', 'Lat Pulldown', 'Dead Bug'] },
    { focus: 'Full Body C', patterns: ['Single-Leg/Lunge', 'Horizontal Push (variant)', 'Horizontal Pull (variant)', 'Core'],
      exercises: ['Reverse Lunge', 'Incline Dumbbell Press', 'Bent-Over Row', 'Hanging Knee Raise'] },
  ],
  4: [
    { focus: 'Upper Body A', patterns: ['Horizontal Push', 'Horizontal Pull', 'Vertical Push', 'Arms'],
      exercises: ['Barbell Bench Press', 'Bent-Over Row', 'Overhead Press', 'Tricep Pushdown'] },
    { focus: 'Lower Body A', patterns: ['Squat', 'Single-Leg/Lunge', 'Core'],
      exercises: ['Barbell Back Squat', 'Walking Lunge', 'Hanging Leg Raise'] },
    { focus: 'Upper Body B', patterns: ['Vertical Pull', 'Vertical Push (variant)', 'Horizontal Push (variant)', 'Arms'],
      exercises: ['Lat Pulldown', 'Lateral Raise', 'Incline Dumbbell Press', 'Bicep Curl'] },
    { focus: 'Lower Body B', patterns: ['Hinge', 'Single-Leg/Lunge (variant)', 'Core'],
      exercises: ['Romanian Deadlift', 'Bulgarian Split Squat', 'Weighted Plank'] },
  ],
  5: [
    { focus: 'Chest & Triceps', patterns: ['Horizontal Push', 'Horizontal Push (variant)', 'Triceps'],
      exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Tricep Pushdown'] },
    { focus: 'Back & Biceps', patterns: ['Horizontal Pull', 'Vertical Pull', 'Biceps'],
      exercises: ['Bent-Over Row', 'Lat Pulldown', 'Bicep Curl'] },
    { focus: 'Legs', patterns: ['Squat', 'Hinge', 'Single-Leg/Lunge', 'Core'],
      exercises: ['Barbell Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Plank'] },
    { focus: 'Shoulders & Arms', patterns: ['Vertical Push', 'Lateral Delts', 'Arms'],
      exercises: ['Overhead Press', 'Lateral Raise', 'Hammer Curl'] },
    { focus: 'Full Body / Weak Point', patterns: ['Squat (variant)', 'Horizontal Pull (variant)', 'Core'],
      exercises: ['Goblet Squat', 'Seated Cable Row', 'Hanging Leg Raise'] },
  ],
  6: [
    { focus: 'Push A', patterns: ['Horizontal Push', 'Vertical Push', 'Triceps'],
      exercises: ['Barbell Bench Press', 'Overhead Press', 'Tricep Pushdown'] },
    { focus: 'Pull A', patterns: ['Horizontal Pull', 'Vertical Pull', 'Biceps'],
      exercises: ['Bent-Over Row', 'Lat Pulldown', 'Bicep Curl'] },
    { focus: 'Legs A', patterns: ['Squat', 'Hinge', 'Core'],
      exercises: ['Barbell Back Squat', 'Romanian Deadlift', 'Plank'] },
    { focus: 'Push B', patterns: ['Horizontal Push (variant)', 'Vertical Push (variant)', 'Triceps'],
      exercises: ['Incline Dumbbell Press', 'Lateral Raise', 'Overhead Tricep Extension'] },
    { focus: 'Pull B', patterns: ['Horizontal Pull (variant)', 'Vertical Pull (variant)', 'Biceps'],
      exercises: ['Seated Cable Row', 'Pull-Up', 'Hammer Curl'] },
    { focus: 'Legs B', patterns: ['Hinge (variant)', 'Single-Leg/Lunge', 'Core'],
      exercises: ['Romanian Deadlift', 'Bulgarian Split Squat', 'Hanging Leg Raise'] },
  ],
};

const HOME_SPLITS = {
  1: [
    { focus: 'Full Body', patterns: ['Squat', 'Push', 'Pull-Substitute', 'Hinge', 'Core'],
      exercises: ['Bodyweight Squat', 'Push-Up', 'Bent-Over Dumbbell Row (or band row)', 'Glute Bridge', 'Plank'] },
  ],
  2: [
    { focus: 'Full Body A', patterns: ['Squat', 'Push', 'Core'],
      exercises: ['Bodyweight Squat', 'Push-Up', 'Plank'] },
    { focus: 'Full Body B', patterns: ['Hinge', 'Pull-Substitute', 'Core'],
      exercises: ['Glute Bridge', 'Bent-Over Row (band/dumbbell)', 'Dead Bug'] },
  ],
  3: [
    { focus: 'Full Body A', patterns: ['Squat', 'Push', 'Core'],
      exercises: ['Bodyweight Squat', 'Incline or Knee Push-Up', 'Plank'] },
    { focus: 'Full Body B', patterns: ['Hinge', 'Pull-Substitute', 'Core'],
      exercises: ['Glute Bridge', 'Bent-Over Row (band/dumbbell)', 'Bird Dog'] },
    { focus: 'Full Body C', patterns: ['Single-Leg/Lunge', 'Push (variant)', 'Core'],
      exercises: ['Reverse Lunge', 'Pike Push-Up', 'Hollow Body Hold'] },
  ],
  4: [
    { focus: 'Upper Body A', patterns: ['Push', 'Pull-Substitute', 'Core'],
      exercises: ['Push-Up', 'Bent-Over Row (band/dumbbell)', 'Plank'] },
    { focus: 'Lower Body A', patterns: ['Squat', 'Single-Leg/Lunge'],
      exercises: ['Bodyweight Squat', 'Walking Lunge'] },
    { focus: 'Upper Body B', patterns: ['Push (variant)', 'Pull-Substitute (variant)', 'Core'],
      exercises: ['Diamond Push-Up', 'Pike Push-Up', 'Hollow Body Hold'] },
    { focus: 'Lower Body B', patterns: ['Hinge', 'Single-Leg/Lunge (variant)'],
      exercises: ['Glute Bridge', 'Bulgarian Split Squat'] },
  ],
  5: [
    { focus: 'Push Focus', patterns: ['Push', 'Push (variant)'], exercises: ['Push-Up', 'Pike Push-Up'] },
    { focus: 'Pull Focus', patterns: ['Pull-Substitute', 'Core'], exercises: ['Bent-Over Row (band/dumbbell)', 'Bird Dog'] },
    { focus: 'Legs', patterns: ['Squat', 'Hinge', 'Single-Leg/Lunge'], exercises: ['Bodyweight Squat', 'Glute Bridge', 'Reverse Lunge'] },
    { focus: 'Core & Stability', patterns: ['Core', 'Anti-Rotation'], exercises: ['Plank', 'Dead Bug', 'Hollow Body Hold'] },
    { focus: 'Full Body Conditioning', patterns: ['Squat (variant)', 'Push (variant)', 'Core'],
      exercises: ['Jump Squat (or slow squat)', 'Diamond Push-Up', 'Mountain Climbers'] },
  ],
  6: [
    { focus: 'Push A', patterns: ['Push'], exercises: ['Push-Up'] },
    { focus: 'Pull A', patterns: ['Pull-Substitute'], exercises: ['Bent-Over Row (band/dumbbell)'] },
    { focus: 'Legs A', patterns: ['Squat', 'Core'], exercises: ['Bodyweight Squat', 'Plank'] },
    { focus: 'Push B', patterns: ['Push (variant)'], exercises: ['Pike Push-Up'] },
    { focus: 'Pull B', patterns: ['Pull-Substitute (variant)', 'Core'], exercises: ['Renegade Row (or band row)', 'Dead Bug'] },
    { focus: 'Legs B', patterns: ['Hinge', 'Single-Leg/Lunge'], exercises: ['Glute Bridge', 'Bulgarian Split Squat'] },
  ],
};

// ── Rep/set scheme + progression pacing, layered on top of the day structure above ──
// This is what stops the KB from ever hard-coding "3x10-12" for every user regardless
// of experience — a genuine beginner starts lighter/lower-volume and progresses.

function getRepScheme(rawGoal, rawLevel) {
  const goal = normalizeGoal(rawGoal);
  const level = normalizeLevel(rawLevel);

  if (goal === 'weight_loss') {
    return {
      setsReps: '2-3 sets x 12-15 reps per exercise, circuit-style with 30-45s rest between exercises',
      progression: level === 'beginner'
        ? 'Weeks 1-2: 2 sets per exercise, moderate pace, focus on form. From Week 3: move to 3 sets and tighten rest periods as conditioning improves.'
        : 'Increase pace/reduce rest before increasing load; add a finisher circuit once the base sets feel manageable.',
    };
  }
  if (goal === 'muscle_gain') {
    return {
      setsReps: level === 'advanced' ? '3-4 sets x 6-10 reps per exercise' : '2-3 sets x 8-12 reps per exercise',
      progression: level === 'beginner'
        ? 'Weeks 1-2: 2 sets per exercise, moderate loads, technique-first, leave 2-3 reps in reserve on every set (never train to failure). From Week 3 onward: progress to the full 3 sets, and only increase load once every prescribed rep is completed with good form across all sets.'
        : 'Double progression: work up to the top of the rep range on every set, then increase load ~2.5-5% and drop back to the bottom of the range. Track working weights weekly to guide this.',
    };
  }
  return {
    setsReps: '2-3 sets x 10-15 reps per exercise',
    progression: level === 'beginner'
      ? 'Weeks 1-2: 2 sets per exercise, prioritize consistent form over load. From Week 3: progress to 3 sets and add load gradually.'
      : 'Increase reps first within the range, then increase load and reset toward the bottom of the range.',
  };
}

// ── Cardio (running/walking/cycling): unchanged, level-based session-type progressions ──

const CARDIO_KB = {
  running: {
    beginner: {
      split: 'Run/Walk intervals x3', focus: 'Aerobic base without injury, building consistency', sessionsPerWeek: 3,
      structure: ['Easy run/walk intervals, all Zone 2 (conversational pace)'],
      sampleExercises: [
        'Week 1-2: 5x (2 min run / 3 min walk), total 25 min',
        'Week 3-4: 5x (4 min run / 2 min walk), total 30 min',
        'Week 5-6: Continuous 20-25 min easy run',
      ],
      progression: '10% weekly volume increase max. Add a 4th day only after 6 weeks of pain-free running.',
      notes: 'Stop if sharp joint pain occurs. Invest in proper running shoes — the single highest-leverage injury-prevention step.',
    },
    intermediate: {
      split: 'Easy/Tempo/Long x4', focus: 'Building aerobic capacity and race-pace comfort', sessionsPerWeek: 4,
      structure: ['2 easy runs (Zone 2)', '1 tempo run (comfortably hard)', '1 long run (distance progression)'],
      sampleExercises: [
        'Easy Run - 30-40 min Zone 2',
        'Tempo Run - 20 min at threshold pace (bookended by 10 min warm-up/cool-down)',
        'Long Run - 60-75 min, +5-10% distance weekly',
      ],
      progression: 'Increase long-run distance 5-10% weekly; every 4th week is a cutback week (-20% volume) to absorb adaptation.',
      notes: 'Add strides (4x20s fast, full recovery) after easy runs 1-2x/week to build turnover without added fatigue.',
    },
    advanced: {
      split: 'Polarized training x5-6', focus: 'Race-specific performance (5K to marathon)', sessionsPerWeek: 6,
      structure: ['80% easy/Zone 2 volume', '20% hard: intervals, tempo, race-pace work'],
      sampleExercises: [
        'VO2max Intervals - 6x800m at 5K pace, 2-3 min jog recovery',
        'Threshold Run - 30-40 min at lactate threshold',
        'Long Run with race-pace surges - 90-120 min',
      ],
      progression: 'Periodize in 3-4 week blocks: base -> build -> peak -> taper before a target race.',
      notes: 'Monitor resting heart rate for overtraining signs; deload every 4th week.',
    },
  },
  walking: {
    beginner: {
      split: 'Daily brisk walks x5-6', focus: 'Building the movement habit and base cardiovascular fitness', sessionsPerWeek: 5,
      structure: ['Flat-terrain brisk walking, conversational pace'],
      sampleExercises: [
        'Week 1-2: 20 min brisk walk, 5x/week',
        'Week 3-4: 30 min brisk walk, 5x/week',
        'Week 5-6: 35-40 min, add light incline if available',
      ],
      progression: 'Increase duration before intensity. Add incline or light hand weights only after 4-6 weeks.',
      notes: 'Good starting point for any fitness level, especially those returning from injury or new to structured activity.',
    },
    intermediate: {
      split: 'Power walking + incline x5', focus: 'Increasing intensity and caloric expenditure', sessionsPerWeek: 5,
      structure: ['Mix of steady-pace and interval power walks'],
      sampleExercises: [
        'Power Walk - 40-45 min at brisk pace (~6 km/h)',
        'Incline Walk - 30 min at 5-8% incline',
        'Interval Walk - 5x (3 min fast pace / 2 min moderate)',
      ],
      progression: 'Increase pace or incline, not just duration, once 45 min feels comfortable.',
      notes: 'Add arm swing and posture cues to raise intensity without joint stress.',
    },
    advanced: {
      split: 'Weighted/incline walking x5-6', focus: 'Maximizing walking as a serious conditioning tool (rucking-style)', sessionsPerWeek: 6,
      structure: ['Long steady walks plus weighted or high-incline sessions'],
      sampleExercises: [
        'Rucking (weighted vest/backpack 8-12kg) - 45-60 min',
        'Steep Incline Treadmill Walk - 30-40 min at 10-12%',
        'Long Walk - 90+ min flat terrain',
      ],
      progression: 'Add load in 2-3kg increments every 2-3 weeks; monitor knee/hip response closely.',
      notes: 'Excellent low-impact alternative to running for building conditioning without joint stress.',
    },
  },
  cycling: {
    beginner: {
      split: 'Easy rides x3', focus: 'Building saddle time and aerobic base', sessionsPerWeek: 3,
      structure: ['Flat, steady-pace rides at conversational effort'],
      sampleExercises: [
        'Week 1-2: 20-25 min easy ride',
        'Week 3-4: 30-35 min easy ride',
        'Week 5-6: 40 min, introduce gentle rolling terrain',
      ],
      progression: 'Increase duration 10% weekly. Get a proper bike fit early to prevent knee and back pain.',
      notes: 'Cadence 80-90 RPM is a good target for new riders — easier on the knees than pushing high gears slowly.',
    },
    intermediate: {
      split: 'Endurance + Tempo x4', focus: 'Building sustained power and endurance', sessionsPerWeek: 4,
      structure: ['2 endurance rides (Zone 2)', '1 tempo/sweet-spot ride', '1 longer weekend ride'],
      sampleExercises: [
        'Endurance Ride - 45-60 min Zone 2',
        'Sweet Spot Intervals - 3x10 min at 88-94% FTP, 5 min recovery',
        'Long Ride - 90 min steady with rolling terrain',
      ],
      progression: 'Increase interval duration or reduce recovery before increasing intensity.',
      notes: 'Consider a basic power meter or heart rate monitor once training past 3-4x/week for accurate zones.',
    },
    advanced: {
      split: 'Structured periodized training x5-6', focus: 'Performance/FTP improvement, event preparation', sessionsPerWeek: 6,
      structure: ['Polarized mix: easy volume + high-intensity intervals + long rides'],
      sampleExercises: [
        'VO2max Intervals - 5x3 min at 110-120% FTP, 3 min recovery',
        'Threshold Ride - 2x20 min at FTP, 10 min recovery',
        'Long Endurance Ride - 2.5-3.5 hrs Zone 2 with race-pace surges',
      ],
      progression: 'Periodize in base -> build -> peak -> taper blocks aligned to target events; retest FTP every 6-8 weeks.',
      notes: 'Recovery rides (very easy, <65% FTP) between hard sessions are essential to absorb training load.',
    },
  },
};

/**
 * Looks up the reference plan for a given activity, goal, experience level, and
 * (for gym/home_workout) days-per-week. Returns null if the activity isn't modeled —
 * the caller should fall back to live Google Search grounding in that case.
 */
function lookupWorkoutKnowledge(rawActivity, rawLevel, rawDaysPerWeek, rawGoal) {
  const activity = normalizeActivity(rawActivity);
  if (!activity) return null;
  const level = normalizeLevel(rawLevel);

  if (activity === 'gym' || activity === 'home_workout') {
    // Default day count by level only when the user's actual days_per_week isn't known yet.
    const fallbackDays = level === 'beginner' ? 2 : level === 'intermediate' ? 3 : 5;
    const n = Math.min(6, Math.max(1, Number(rawDaysPerWeek) || fallbackDays));
    const table = activity === 'gym' ? GYM_SPLITS : HOME_SPLITS;
    const days = table[n];
    if (!days) return null;
    const repScheme = getRepScheme(rawGoal, level);
    return { activity, level, daysPerWeek: n, days, repScheme, kind: 'strength' };
  }

  const entry = CARDIO_KB[activity] && CARDIO_KB[activity][level];
  if (!entry) return null;
  return { activity, level, kind: 'cardio', ...entry };
}

/**
 * Renders a KB entry into a compact text block suitable for grounding a Gemini prompt.
 */
function formatKnowledgeForPrompt(entry) {
  if (!entry) return '';

  if (entry.kind === 'strength') {
    const daysBlock = entry.days.map((d, i) =>
      `  Day ${i + 1} — ${d.focus} (${d.patterns.join(', ')}):\n` +
      d.exercises.map((e) => `    - ${e}`).join('\n')
    ).join('\n');

    return `
== REFERENCE KNOWLEDGE BASE (${entry.activity}, ${entry.daysPerWeek} day(s)/week, ${entry.level}) ==
This exact ${entry.daysPerWeek}-day split covers all major movement patterns in a balanced way — use it as the exercise selection for each day, in this order:
${daysBlock}
Sets/Reps: ${entry.repScheme.setsReps}
Progression: ${entry.repScheme.progression}
== END KNOWLEDGE BASE ==
Ground your answer in the above reference data. Do not invent a different day count or drop a movement pattern from any day. You may substitute an equivalent exercise for the same pattern if the user's equipment or a stated injury requires it, and adapt wording/formatting to what they actually asked — but keep every day balanced across its listed patterns.
`.trim();
  }

  // Cardio (unchanged shape)
  return `
== REFERENCE KNOWLEDGE BASE (${entry.activity}, ${entry.level}) ==
Split: ${entry.split}
Focus: ${entry.focus}
Sessions/week: ${entry.sessionsPerWeek}
Structure: ${entry.structure.join(' | ')}
Sample exercises/sessions:
${entry.sampleExercises.map((e) => `  - ${e}`).join('\n')}
Progression rule: ${entry.progression}
Coaching notes: ${entry.notes}
== END KNOWLEDGE BASE ==
Ground your answer in the above reference data, adapting it to the user's specific question. Do not just copy it verbatim — tailor exercise selection/muscle focus to what they actually asked.
`.trim();
}

module.exports = {
  GYM_SPLITS, HOME_SPLITS, CARDIO_KB,
  lookupWorkoutKnowledge, formatKnowledgeForPrompt,
  normalizeActivity, normalizeLevel, normalizeGoal, getRepScheme,
};
