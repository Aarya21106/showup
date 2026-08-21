const axios = require('axios');
const config = require('../config');

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

class GeminiError extends Error {}

async function callGemini({ parts, jsonMode, temperature, maxTokens, useSearch }) {
  if (!config.geminiConfigured) {
    throw new GeminiError('GEMINI_API_KEY is not set');
  }

  const generationConfig = {
    temperature: temperature ?? 0.6,
    maxOutputTokens: maxTokens ?? 800,
  };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';

  // Google Search grounding lets Gemini pull live web results into its answer.
  // Not supported together with forced JSON output, so jsonMode wins if both are requested.
  const enableSearch = Boolean(useSearch) && !jsonMode;
  if (useSearch && jsonMode) {
    console.warn('[Gemini] useSearch requested alongside jsonMode — ignoring useSearch (mutually exclusive).');
  }

  const requestBody = {
    contents: [{ role: 'user', parts }],
    generationConfig,
  };
  if (enableSearch) {
    requestBody.tools = [{ google_search: {} }];
  }

  let retries = 3;
  let delay = 2000;

  while (retries > 0) {
    try {
      const res = await axios.post(
        ENDPOINT(config.gemini.model),
        requestBody,
        {
          params: { key: config.gemini.apiKey },
          headers: { 'Content-Type': 'application/json' },
          timeout: 180000,
        }
      );

      const candidate = res.data?.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
      if (!text) {
        throw new GeminiError(`Empty Gemini response (finishReason: ${candidate?.finishReason || 'unknown'})`);
      }
      return text;
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.message;
      const detailLower = detail.toLowerCase();
      const isRateLimit = detailLower.includes('high demand') ||
                          detailLower.includes('rate limit') ||
                          detailLower.includes('resource exhausted') ||
                          err.response?.status === 429 ||
                          err.response?.status === 503;

      if (isRateLimit && retries > 1) {
        console.warn(`[Gemini] Model busy or rate limited. Retrying in ${delay}ms... (Retries left: ${retries - 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        retries--;
        delay *= 2; // exponential backoff
      } else {
        if (err instanceof GeminiError) throw err;
        throw new GeminiError(`Gemini call failed: ${detail}`);
      }
    }
  }
}

const LANGUAGE_NAMES = {
  en: 'English',
  ta: 'Tamil (written strictly in pure Tamil script)',
  hi: 'Hindi (written strictly in Devanagari script)',
  tl: 'Tanglish (Tamil spoken language written 100% using the English/Latin alphabet ONLY - STRICTLY FORBIDDEN from using any Tamil script characters because the user CANNOT read Tamil script)',
  hl: 'Hinglish (Hindi spoken language written 100% using the English/Latin alphabet ONLY - STRICTLY FORBIDDEN from using any Devanagari characters)'
};

const RESPECT_AND_TONE_RULES = `
=== MANDATORY RESPECT, CLARITY & TONE RULES (CRITICAL) ===
1. STRICT ZERO-EMOJIS RULE: You are strictly FORBIDDEN from using emojis anywhere in your response. No emojis of any kind under any circumstance. Keep all responses 100% clean, professional, and emoji-free.
2. ULTRA-SHORT, FRIENDLY & CRISP (CRITICAL): Keep all conversational replies very short, friendly, punchy, and natural (max 25-45 words for conversational replies). Never write giant essays or long paragraphs. 1 to 2 short sentences per thought is ideal. Sound like a knowledgeable, supportive friend texting on WhatsApp.
3. CLEAN LINE SPACING & FORMATTING:
   - Always use clean vertical spacing (\`\\n\\n\`) between distinct sections, headers, bullet points, and questions.
   - Use clean, pointed bullet points ('• ' or '- ') or bracket numbers ('[1]', '[2]') for instructions and lists.
4. NOTEBOOK EXERCISE FORMAT RULE (MANDATORY FOR ALL WORKOUTS & EXERCISES):
   - Whenever providing an exercise list or routine, format it EXACTLY as a clean handwritten notebook split:
     Day X - [Split / Muscle Focus]

     [Muscle Subheading if applicable, e.g. Shoulders]
     [1] Exercise Name - Sets×Reps
     [2] Exercise Name - Sets×Reps
     [3] Exercise Name - Sets×Reps

     [Muscle Subheading if applicable, e.g. Biceps]
     [4] Exercise Name - Sets×Reps
     [5] Exercise Name - Sets×Reps
   - EXERCISE CALIBRATION BASED ON GOAL, REALITY & POSSIBILITY:
     * Goal: Hypertrophy (muscle gain) -> heavy compounds, 6-12 reps. Fat loss -> strength maintenance + circuits. General -> functional endurance.
     * Reality (Diet/Fuel): Consider their food, calorie budget, and protein intake. If eating in a deficit or low protein, keep volume sustainable (3-4 high-yield exercises) to prevent injury and burnout.
     * Possibility (Location & Equipment): Gym -> barbells, cables, dumbbells, machines. Home (no equipment) -> progressive calisthenics (pike pushups, squats, lunges, diamond pushups). Home (dumbbells) -> dumbbell variations.
     * Possibility (Time Limit): If user has 30 mins -> 3-4 exercises. If 45-60 mins -> 5-7 exercises.
5. OVERTRAINING & REST DAY REALITY CHECK (CRITICAL):
   - If the user says hardcore/extreme things like "I want to train 7 days a week", "2 hours daily hardcore", "no rest days", "daily workout without break":
   - The coach MUST give a firm, friendly reality check:
     * Explain clearly: Muscles are broken down in the gym, but they GROW during REST when muscle protein synthesis and glycogen reload occur.
     * Working out daily with no rest or 2 hours every day leads to central nervous system burnout, high cortisol, joint strain, and muscle breakdown.
     * Prescribe a proven 4-day or 5-day split with at least 2 full rest/active recovery days.
     * Remind them: Consistency for 12 months beats killing yourself for 7 days.
6. CLEAN DIET & NUTRITION SPACING (MANDATORY):
   - Whenever diet suggestions or meal breakdowns are given, format with clean line spacing and sections:
     Target: [Calories] kcal | ~[Protein]g Protein

     Breakfast (~[Cals] kcal | [Protein]g P):
     • [Item with exact grams / servings]

     Lunch (~[Cals] kcal | [Protein]g P):
     • [Item with exact grams / servings]

     Evening Snack (~[Cals] kcal | [Protein]g P):
     • [Item with exact grams / servings]

     Dinner (~[Cals] kcal | [Protein]g P):
     • [Item with exact grams / servings]

     Allergy Check: [Note on registered allergies / safe alternatives]
7. ALWAYS treat the user with utmost respect, warmth, encouragement, and high regard.
8. ABSOLUTELY FORBIDDEN IN TAMIL & TANGLISH:
   - NEVER EVER use disrespectful, casual, or rude call words like "Dei", "Dey", "Da", "Di", "Elay".
   - NEVER EVER use singular/informal pronouns or verbs: "nee" / "நீ", "unakku" / "உனக்கு", "unoda" / "un" / "உன்னுடைய", "yosi", "sollu", "pannu", "podu", "vaa".
9. ALWAYS USE RESPECTFUL FORMS IN TAMIL & TANGLISH:
   - Pronouns: ALWAYS use "neenga" / "நீங்கள்" (or "[Name] bro" / "Bro" / "Ji").
   - Possessive: ALWAYS use "unga" / "ungaloda" / "உங்கள்".
   - Objective: ALWAYS use "ungalukku" / "உங்களுக்கு".
   - Verbs: ALWAYS use polite respectful endings: "yosinga", "sollunga", "pannunga", "podunga", "vaanga", "paarkalaam", "mudiyum".
10. IN ENGLISH / HINDI / HINGLISH:
   - Maintain a respectful, crisp, clean, short, friendly, and motivating tone. Zero emojis.
11. CRITICAL TANGLISH ('tl') ZERO-TAMIL-SCRIPT RULE:
   - The user speaks Tamil and reads TANGLISH, but CANNOT READ TAMIL SCRIPT.
   - When language is Tanglish ('tl'): You MUST write 100% in the English/Latin alphabet ONLY.
   - NEVER include ANY Tamil Unicode/script characters (e.g. absolutely no 'நாளை', 'மணிக்கு', 'உடற்பயிற்சி', 'வணக்கம்', 'நீங்கள்').
   - Transliterate all Tamil words phonetically using English letters: "Vanakkam bro", "Naalaiku morning 7 AM ku workout irukku", "Unga height and weight sollunga", "Nalla rest edunga".
12. CRITICAL HINGLISH ('hl') ZERO-DEVANAGARI RULE:
   - When language is Hinglish ('hl'): Write 100% using the English/Latin alphabet ONLY.
   - NEVER use ANY Devanagari characters (e.g. no 'नमस्ते', 'कसरत').
   - Transliterate all Hindi words phonetically using English letters: "Namaste bhai", "Kal subah workout karenge".
`;

const TAMIL_SCRIPT_MAP = {
  'நாளை': 'naalaiku',
  'காலை': 'kaalai',
  'மாலை': 'maalai',
  'இரவு': 'iravu',
  'வணக்கம்': 'vanakkam',
  'மணிக்கு': 'ku',
  'மணி': 'mani',
  'உடற்பயிற்சி': 'workout',
  'பயிற்சி': 'workout',
  'நீங்கள்': 'neenga',
  'உங்களுக்கு': 'ungalukku',
  'உங்கள்': 'unga',
  'உணவு': 'food',
  'சாப்பாடு': 'saappadu',
  'தண்ணீர்': 'thanni',
  'சரி': 'seri',
  'நன்றி': 'nandri',
  'ஆம்': 'aama',
  'இல்லை': 'illa',
};

function sanitizeScriptForLanguage(text, language) {
  if (!text) return text;
  if (language === 'tl') {
    let cleaned = text;
    for (const [tamilWord, tanglishWord] of Object.entries(TAMIL_SCRIPT_MAP)) {
      cleaned = cleaned.split(tamilWord).join(tanglishWord);
    }
    // Remove any remaining stray Tamil script characters
    cleaned = cleaned.replace(/[\u0B80-\u0BFF]+/g, '');
    // Clean potential leftover duplicate spaces
    return cleaned.replace(/\s{2,}/g, ' ').trim();
  }
  if (language === 'hl') {
    // Remove any stray Devanagari script characters
    return text.replace(/[\u0900-\u097F]+/g, '').replace(/\s{2,}/g, ' ').trim();
  }
  return text;
}

/**
 * Builds a compact coach context block from the user's profile_json,
 * recent daily summaries, and any due follow-ups.
 * Injected into the system prompt of every conversational Gemini call.
 */
function buildCoachContext(user) {
  let ctx = '';
  if (user) {
    const db = require('../db/db');
    const fitness = require('../utils/fitness');
    const profileJson = db.getProfileJson(user.id);
    const summaries = db.getRecentDailySummaries(user.id, 3);
    const today = require('../utils/date').todayStr(require('../config').timezone);
    const dueFollowUps = db.getDueFollowUps(today).filter(f => f.user_id === user.id);

    const isCardio = ['running', 'walking', 'cycling'].includes(user.activity);

    if (isCardio) {
      ctx += `\n== CARDIO PLAN & WEEKLY PROGRESS ==\n`;
      ctx += `- Fitness App: ${user.fitness_app || 'Not set'}\n`;

      try {
        // Parse weekly plan (multi-activity aware)
        let activities = [];
        if (user.weekly_plan) {
          try { activities = JSON.parse(user.weekly_plan); } catch (e) { /* ignore */ }
        }
        if (activities.length === 0 && user.activity) {
          activities = [{ activity: user.activity, days_per_week: user.days_per_week || 3, goal_distance_km: user.weekly_goal_distance_km || 3.0 }];
        }

        // Current week bounds (Mon–Sun)
        const nowStr = new Intl.DateTimeFormat('en-CA', { timeZone: require('../config').timezone }).format(new Date());
        const d = new Date(nowStr + 'T00:00:00');
        const dayOfWeek = d.getDay();
        const mondayOffset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const fmt = (dt) => dt.toISOString().split('T')[0];
        const weekStart = fmt(monday);
        const weekEnd = fmt(sunday);

        for (const plan of activities) {
          const weekSessions = db.getWeekCardioCheckinsByActivity(user.id, weekStart, weekEnd, plan.activity);
          const recentSessions = db.getRecentCardioCheckinsByActivity(user.id, plan.activity, 5);
          ctx += `\n[${plan.activity.toUpperCase()}] Goal: ${plan.goal_distance_km}km/session × ${plan.days_per_week} days/week\n`;
          ctx += `  This week: ${weekSessions.length}/${plan.days_per_week} sessions\n`;
          if (weekSessions.length > 0) {
            for (const s of weekSessions) {
              ctx += `    • ${s.date}: ${s.distance_km ? s.distance_km.toFixed(2) + 'km' : '?km'}${s.pace_min_per_km ? ` @ ${s.pace_min_per_km.toFixed(1)} min/km` : ''}${s.activity_calories ? ` (${s.activity_calories} kcal)` : ''}\n`;
            }
          }
          if (recentSessions.length >= 2) {
            const paces = recentSessions.filter(s => s.pace_min_per_km).map(s => s.pace_min_per_km);
            if (paces.length >= 2) {
              const trend = paces[0] < paces[paces.length - 1] ? 'improving' : paces[0] > paces[paces.length - 1] ? 'slowing' : 'steady';
              ctx += `  Pace trend: ${trend} (latest ${paces[0].toFixed(1)} min/km)\n`;
            }
          }
        }
      } catch (e) {
        // silently ignore
      }
    } else {
      const bmiData = fitness.calculateBMI(user.height, user.weight);
      const targetCals = user.target_calories || fitness.calculateTargetCalories(user.height, user.weight, user.days_per_week, user.goal);
      const macros = fitness.calculateMacros(targetCals, user.weight);

      ctx += `\n== USER HEALTH & METRICS PROFILE ==\n`;
      ctx += `- Height: ${user.height ? `${user.height} cm` : 'Not set yet'}\n`;
      ctx += `- Weight: ${user.weight ? `${user.weight} kg` : 'Not set yet'}\n`;
      ctx += `- Workout Location: ${user.workout_location || 'gym'}\n`;
      ctx += `- Home Equipment: ${user.home_equipment || 'none'}\n`;
      ctx += `- Experience Level: ${user.experience_level || 'beginner'}\n`;
      if (bmiData) ctx += `- BMI: ${bmiData.bmi} (${bmiData.category})\n`;
      ctx += `- Daily Target Calories: ${targetCals} kcal/day (${user.goal === 'weight_loss' ? 'Deficit' : 'Surplus/Hypertrophy'})\n`;
      ctx += `- Recommended Daily Macros: Protein ~${macros.proteinGrams}g, Carbs ~${macros.carbsGrams}g, Fat ~${macros.fatGrams}g\n`;
      ctx += `- Preferred Cuisine / Region: ${user.cuisine_region || 'South Indian / Tamil Nadu'}\n`;
      ctx += `- Registered Food Allergies: ${user.allergy || 'None recorded'}\n`;
      ctx += `- Target Muscle Focus: ${user.target_muscle || 'General / Full Body'}\n`;
      ctx += `- Current Diet Summary: ${user.diet_summary || 'Not provided yet'}\n`;
      ctx += `- Supplements: ${user.supplements || 'None'}\n`;
    }

    // Weight history trend
    try {
      const weights = db.getWeightLogs(user.id, 4);
      if (weights.length >= 2) {
        const trendStr = weights.map(w => `${w.date}: ${w.weight}kg`).reverse().join(' -> ');
        ctx += `\n== WEIGHT HISTORY & TREND ==\n${trendStr}\n`;
      }
    } catch (e) { /* ignore */ }

    // Schedule & Effective Sessions (today and tomorrow)
    try {
      const scheduleService = require('./scheduleService');
      const today = require('../utils/date').todayStr(require('../config').timezone);
      const tomorrow = require('../utils/date').addDaysStr(today, 1);
      const effectiveToday = scheduleService.getEffectiveWorkoutForDate(user, today);
      const effectiveTomorrow = scheduleService.getEffectiveWorkoutForDate(user, tomorrow);
      const adherence = scheduleService.getWeeklyAdherence(user, today);

      ctx += `\n== TRAINING SCHEDULE & ADHERENCE ==\n`;
      ctx += `- Weekly Target: ${adherence.target} workouts/week (Completed this week: ${adherence.completed}/${adherence.target}, Rescheduled: ${adherence.rescheduled})\n`;
      ctx += `- Preferred Training Time: ${user.checkin_time || '07:00'}\n`;
      ctx += `- Today (${today}): ${effectiveToday.isWorkout ? `TRAINING DAY (${effectiveToday.focus}${effectiveToday.isRescheduled ? ' [Rescheduled]' : ''})` : effectiveToday.focus}\n`;
      ctx += `- Tomorrow (${tomorrow}): ${effectiveTomorrow.isWorkout ? `TRAINING DAY (${effectiveTomorrow.focus}${effectiveTomorrow.isRescheduled ? ' [Rescheduled]' : ''})` : effectiveTomorrow.focus}\n`;
    } catch (e) { /* ignore */ }

    // Structured Workout Memory (Lifts, weights, reps, sets)
    try {
      const recentWorkouts = db.getRecentWorkoutLogs(user.id, 8);
      if (recentWorkouts.length > 0) {
        ctx += `\n== RECENT STRUCTURED WORKOUT HISTORY ==\n`;
        for (const w of recentWorkouts) {
          ctx += `• ${w.date} [${w.status}]: ${w.exercise_name} ${w.weight_kg ? `${w.weight_kg}kg × ` : ''}${w.reps ? `${w.reps} reps ` : ''}${w.sets ? `× ${w.sets} sets` : ''}${w.rpe ? ` (RPE ${w.rpe})` : ''}${w.notes ? ` - ${w.notes}` : ''}\n`;
        }
      }
    } catch (e) { /* ignore */ }

    // Health Constraints, Sleep, and Injuries
    ctx += `\n== HEALTH, RECOVERY & CONSTRAINTS ==\n`;
    ctx += `- Sleep Baseline: ${user.sleep_hours ? `${user.sleep_hours} hrs/night` : '7 hrs/night'}\n`;
    ctx += `- Active Injuries / Pain: ${user.injuries || 'None recorded'}\n`;
    ctx += `- Dietary Restrictions: ${user.diet_restrictions || user.allergy || 'None recorded'}\n`;
    ctx += `- Consistency Blocker: ${user.blocker_text || 'None'}\n`;
    if (user.commitment_text) ctx += `- Self-Commitment: "${user.commitment_text}"\n`;

    // Profile memory
    if (profileJson && Object.keys(profileJson).length > 0) {
      ctx += `\n== USER MEMORY (durable facts) ==\n${JSON.stringify(profileJson)}\n`;
    }

    // Recent daily summaries
    if (summaries.length > 0) {
      ctx += `\n== RECENT DAYS ==\n`;
      for (const s of summaries) {
        ctx += `${s.date}: ${s.summary}\n`;
      }
    }

    // Due follow-ups
    if (dueFollowUps.length > 0) {
      ctx += `\n== FOLLOW-UPS DUE TODAY ==\n`;
      for (const f of dueFollowUps) {
        ctx += `- From ${f.date}: ${f.summary}\n`;
      }
    }
  }

  return `\n--- COACH MEMORY & HEALTH METRICS ---${ctx}\n${RESPECT_AND_TONE_RULES}\n--- END MEMORY & METRICS ---\n`;
}

/**
 * Produces a short, warm one-line acknowledgment of the user's onboarding answer,
 * in their chosen language. Falls back to a generic line if Gemini is unavailable.
 */
async function acknowledgeAnswer({ question, answer, language, name }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const prompt = `You are ShowUp - part hype coach, part no-BS best friend, texting on WhatsApp.
You genuinely believe this person can pull this off, and you're not shy about saying so.
The user${name ? ` (${name})` : ''} was just asked: "${question}"
They answered: "${answer}"

Write ONE short, punchy sentence (max 20 words) reacting to their answer like a friend who's
actually listening and genuinely hyped for them - specific to what they said, not generic filler.
Confident and warm, never cheesy or salesy. Reply ONLY in ${langName}. No greeting, at most one emoji, no next question.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.8 });
    return text.trim();
  } catch (err) {
    return null; // caller falls back to a static acknowledgment
  }
}

/**
 * Multimodal check-in verification: does the photo plausibly match the described activity,
 * and is the description vague/suspiciously repetitive vs their check-in history?
 * Returns { matches, suspicious, reason, followupQuestion } - or throws GeminiError.
 */
async function verifyCheckin({ description, imageBase64, mimeType, activity, language, recentCheckins, todayDate, expectedGesture, lastAcceptedBase64, lastAcceptedMimeType }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const history = (recentCheckins || []).map((c, i) => 
    `${i + 1}. Date: ${c.date} | Description: "${c.description || '(none)'}" | Status: ${c.status} | Reason: ${c.reason || '(none)'}`
  ).join('\n') || '(no prior check-ins)';

  let gestureRule = '';
  if (expectedGesture) {
    gestureRule = `\n   - CRITICAL - DAILY GESTURE REQUIREMENT: The user's photo MUST include their hand displaying the expected gesture: "${expectedGesture}".
     * Expected gesture details:
       - "one-finger": hand holding up 1 finger (index finger pointing up ☝️).
       - "two-fingers": hand holding up 2 fingers.
       - "three-fingers": hand holding up 3 fingers.
       - "four-fingers": hand holding up 4 fingers.
       - "open-palm": hand showing 5 fingers with an open palm ✋.
       - "thumbs-up": a hand making a thumbs-up sign 👍.
       - "fist": a hand making a closed fist ✊.
       - "yo-yo": yo-yo / call-me hand sign (thumb and pinky finger extended, middle three fingers folded 🤙).
       - "spiderman": spiderman / web-shooter sign (thumb, index finger, and pinky finger extended, middle and ring fingers folded 🤟).
       - "peace-sign": peace sign (index and middle fingers extended in a V shape ✌️).
       - "ok-sign": OK sign (circle made of thumb and index finger touching 👌).
       - "rock-on": rock-on / horns sign (index finger and pinky finger extended up, thumb holding middle and ring fingers down 🤘).
       - "gun-finger": gun finger sign (thumb pointing up and index finger pointing forward 🔫).
       - "crossed-fingers": crossed fingers (index finger and middle finger crossed over each other 🤞).
       - "l-shape": L-shape finger sign (thumb and index finger forming a 90-degree L shape).
     * Inspect the photo extremely closely for the user's hand showing the expected gesture.
     * If the hand or expected gesture "${expectedGesture}" is missing, unclear, or different, you MUST reject the check-in ("matches": false) and explain in the reason that the daily gesture was missing or incorrect.`;
  }

  let consistencyRule = '';
  if (lastAcceptedBase64 && activity === 'gym') {
    consistencyRule = `\n   - CRITICAL - GYM BACKGROUND CONSISTENCY CHECK: You are provided with a second image: "Previous Session Image" (representing their last successful gym check-in).
     * Compare the gym environment (flooring texture/color, wall paint, style of workout machines, weights, ceiling layout, lighting) in today's check-in image with the "Previous Session Image".
     * Since they workout at the same local gym, the background should remain consistent.
     * If the background space/equipment in today's photo is completely different from the "Previous Session Image" (e.g. they usually work out in a home gym but today's photo shows a commercial gym, or they are using entirely different colored weight plates/dumbbells), you must flag it or reject it ("matches": false) unless they explicitly explained in their text description that they are traveling, at a new gym, or visiting a friend.`;
  }

  let activityRules = '';
  if (activity === 'gym') {
    activityRules = `
     * ACCEPTABLE proof: A gym selfie, a picture of weights/dumbbells/barbells, workout benches/machines, weightlifting gloves, a workout log/notebook page showing weight training, or a fitness tracker/app summary explicitly showing a "strength training", "weightlifting", or "gym workout" session.
     * REJECT other activities: Reject running maps, pace screenshots, outdoor running paths, or road cycling screenshots unless they explicitly log strength training.`;
  } else if (activity === 'running' || activity === 'walking') {
    activityRules = `
     * ACCEPTABLE proof: A selfie while running/walking, pictures of running shoes on roads/tracks, running routes/tracks, or screenshots of fitness apps (e.g. Strava, Nike Run Club, Garmin, Apple Health, Fitbit) showing running/walking map routes, duration, steps, or pace.
     * REJECT other activities: Reject gym weightlifting pictures, weight racks, or stationary gym cycling screens unless they explicitly accompany running/walking.`;
  } else if (activity === 'cycling') {
    activityRules = `
     * ACCEPTABLE proof: A picture of a bicycle, road/path while cycling, stationary gym bicycle, or screenshots of cycling tracking apps (e.g. Strava, Garmin) showing cycling map routes, speed, or distance.
     * REJECT other activities: Reject gym weightlifting pictures, walking steps, or running-only screenshots.`;
  } else {
    activityRules = `
     * ACCEPTABLE proof: A photo of the workout environment, equipment, fitness tracker app summary, or selfie showing the activity "${activity}".`;
  }

  const prompt = `You are ShowUp, a fitness accountability bot verifying a user's daily check-in on WhatsApp.
The user's pledged activity category is: "${activity || 'fitness exercise'}".
Their check-in message today: "${description || '(no text provided)'}"
Their last few check-in entries, for comparison:
${history}

Today's date is: ${todayDate || 'not provided'}

You are given check-in photos attached to this message. Look at them carefully.

Decide:
1. "matches": does the photo plausibly show evidence of the committed activity: "${activity || 'fitness exercise'}"?
   Follow these rules for verifying "${activity || 'fitness exercise'}":
   ${activityRules}
   - REJECT Stock/Web Photos: Reject if the photo is a professional stock image, downloaded from Google/Pinterest/websites, or contains watermarks, generic fitness models, or studio staging. Real check-in photos are imperfect mobile pictures of personal spaces, equipment, or selfies.
   - REJECT AI-Generated Images: Reject if the photo is AI-generated (e.g., from ChatGPT, DALL-E, Midjourney, etc.). Be extremely paranoid, critical, and hyper-vigilant. A common cheat is to generate realistic photos. Look very closely:
     * DALL-E 3 / Midjourney signature styles: Overly perfect, clean, glossy, or stylized 3D render/digital painting appearance.
     * Check skin texture: If the skin looks airbrushed, plastic, or perfectly smooth with no blemishes, pores, or sweat details, reject it.
     * Check background details: Look at objects, lines, and text. If there are weirdly warped lines, impossible lighting reflections, or distorted lettering, reject it.
     * Deformed details: Deformed hands, limbs, or impossible angles/joints.
     * If there is even a slight suspicion (e.g., looks slightly cartoonish, digital, or artificial), you MUST mark "matches" as false and reject it. Real check-in photos are raw, imperfect, and shot with actual mobile cameras in standard, non-perfect real-world lighting.
   - REJECT Past Workout Screenshots: If they upload a fitness log showing a past date or day of the week (e.g. "Wednesday" when today is Saturday) compared to today's date ("${todayDate}"), reject it.${gestureRule}${consistencyRule}
2. "suspicious": is the text description vague ("did it", "done") AND/OR nearly word-for-word identical to several recent entries in a way that suggests copy-pasting rather than genuine variation?
3. "reason": one short sentence explaining your call, in ${langName}. If rejected, clearly state why (e.g. "That photo is a stock image" or "You submitted a gym workout, but your pledged activity is running").
4. "followupQuestion": if matches is false OR suspicious is true, write ONE short, direct follow-up question in ${langName} asking them to clarify or provide today's activity proof. Otherwise null.

Respond ONLY with strict JSON, no markdown fences:
{"matches": boolean, "suspicious": boolean, "reason": string, "followupQuestion": string|null}`;

  const parts = [];
  if (lastAcceptedBase64) {
    parts.push({ text: "=== Previous Session Image (For background consistency comparison only) ===" });
    parts.push({ inline_data: { mime_type: lastAcceptedMimeType || 'image/jpeg', data: lastAcceptedBase64 } });
  }
  
  parts.push({ text: "=== Today's Check-in Image (To verify today's session, gesture, and consistency) ===" });
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
  }

  parts.push({ text: prompt });

  const text = await callGemini({ parts, jsonMode: true, temperature: 0.3 });

  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      matches: Boolean(parsed.matches),
      suspicious: Boolean(parsed.suspicious),
      reason: parsed.reason || '',
      followupQuestion: parsed.followupQuestion || null,
    };
  } catch (err) {
    throw new GeminiError(`Could not parse Gemini JSON response: ${text}`);
  }
}

/**
 * Evaluate a clarification the user sent after a flagged check-in, combined with the
 * original description and photo, and decide the final verdict (no further follow-up loop).
 */
async function evaluateFollowup({ originalDescription, followupAnswer, imageBase64, mimeType, activity, language }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const prompt = `You are ShowUp, a fitness accountability bot. A user's check-in for "${activity}" was flagged for review.
Original message: "${originalDescription || '(none)'}"
Their clarification just now: "${followupAnswer}"

You are given the original photo attached. Make a FINAL decision - no more follow-ups after this.
Be reasonably lenient: if their clarification is a plausible, specific human explanation, accept it.
Only reject if the clarification is evasive, contradictory, or still clearly doesn't match the photo/activity.

Respond ONLY with strict JSON, no markdown fences:
{"accepted": boolean, "reason": string /* one short sentence in ${langName} */}`;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
  }

  const text = await callGemini({ parts, jsonMode: true, temperature: 0.3 });
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return { accepted: Boolean(parsed.accepted), reason: parsed.reason || '' };
  } catch (err) {
    throw new GeminiError(`Could not parse Gemini JSON response: ${text}`);
  }
}

/**
 * Runs the single-turn Gemini call during the psychological onboarding interview.
 * Follows the 10-stage architecture:
 * 1. Identity
 * 2. Diagnosis (Goal -> Experience -> Current Training context)
 * 3. Baseline Metrics (Height/Weight -> Days -> Time -> Equipment/Environment -> Eating Day -> Diet Restrictions/Non-negotiables)
 * 4. Constraints (Obstacles -> Sleep hours -> Injuries/Limitations)
 * 5. Value Delivery (Personalized starting plan + tailored strategy + first target checklist)
 * 6. Ownership (Prompts user for their self-written commitment statement)
 */
async function conductOnboardingInterview({ currentProfile, message, history, user }) {
  const profileString = JSON.stringify(currentProfile, null, 2);
  const historyString = (history || []).map(h => `${h.role === 'user' ? 'User' : 'ShowUp'}: ${h.text}`).join('\n') || '(no prior history)';
  const coachCtx = user ? buildCoachContext(user) : '';

  // Once goal + activity + a day count are known, ground the timetable assignment in a
  // concrete, goal-appropriate split template rather than leaving it to pure improvisation —
  // this is what keeps low day counts (e.g. 2 days/week) from producing a mismatched split.
  const { formatSplitTemplateForPrompt } = require('../knowledge/splitTemplates');
  const splitBlock = currentProfile.days_per_week
    ? formatSplitTemplateForPrompt(currentProfile.activity, currentProfile.goal, currentProfile.days_per_week)
    : '';

  const prompt = `You are ShowUp, an elite, direct, empathetic, and highly competent AI fitness coach texting on WhatsApp.
${coachCtx}
${splitBlock ? '\n' + splitBlock + '\n' : ''}

=== MANDATORY INSTRUCTIONS ===
1. FIRST, analyze the user's latest incoming message ("${message}") and extract/update all fields into "extracted":
   - "name": User's name (e.g. "Tharun", "I am Alex", "call me Rahul"). Preserve existing name if already known.
   - "goal": User's primary goal (e.g. "build muscle", "lose fat", "get stronger", "improve fitness", "endurance", "lean definition").
   - "experience_level": "beginner", "some_experience", or "experienced".
   - "activity": Main activity strictly as "gym", "home_workout", "running", "walking", or "cycling". (e.g. "lifting at gym" -> "gym", "home workouts" -> "home_workout", "run outdoors" -> "running", "cycling" -> "cycling", "brisk walking" -> "walking").
   - "workout_location": "gym", "home", or "outdoor".
   - "home_equipment": Any equipment/setup described (e.g. "dumbbells, pull-up bar", "bodyweight only / zero equipment", "treadmill", "road bicycle", "gym with free weights & machines").
   - "height": Number in centimeters. Accept ANY format, with or without units: "175 cm", "5ft 9" -> 175, "5'9\"" -> 175, or a bare number like "175" with no unit at all. If the user gives height and weight together as two bare numbers (e.g. "175 70", "175, 70", "175 and 70"), the number in the 120-220 range is the height and the other is the weight. Convert feet/inches to cm.
   - "weight": Number in kilograms. Accept ANY format, with or without units: "72 kg", "70kg", or a bare number like "70" with no unit at all — do not require "kg" to be present. If given in pounds/lbs, convert to kg (divide by 2.205). When height and weight are given together as a bare number pair (see above), the number in the 30-200 range is the weight.
   - "days_per_week": Integer 1-7 (e.g. "4 days", "5 days a week", "weekends only" -> 2).
   - "goal_timeframe": The user's own stated target timeframe for their goal, as free text (e.g. "3 months", "12 weeks", "6 months", "no rush"). Only set this from the user's reply to the Step 6.5 timeframe question below — do not infer it from anything else.
   - "timetable": JSON object with all 7 days ("Monday" through "Sunday"). If the user specifies their preferred workout days (e.g. "Monday and Thursday", "weekends only" -> Saturday & Sunday, or "Mon, Wed, Fri, Sat"), populate each chosen workout day using the REQUIRED SPLIT STRUCTURE above (if provided) — assign its session focuses in order, one per chosen workout day — and set all non-workout days to "Rest". If no REQUIRED SPLIT STRUCTURE was provided above, match the split to their goal & activity yourself. If the user has NOT specified the exact days yet, set "timetable" to null. CRITICAL: the number of non-Rest days MUST exactly equal days_per_week — never more, never fewer.
   - "checkin_time": Workout/checkin time in 24-hour "HH:MM" format (e.g. "7:00 AM" -> "07:00", "7 PM" -> "19:00", "18:30").
   - "diet_summary": Normal day of eating summary.
   - "allergy": Food allergies (e.g. "peanuts", "dairy", "eggs", "none").
   - "diet_restrictions": Non-negotiables or restricted meals (e.g. "vegetarian", "no seafood", "don't change my morning coffee").
   - "blocker_text": Key obstacle/blocker to consistency (e.g. "time", "motivation", "consistency", "diet", "recovery", "nothing major").
   - "sleep_hours": Number of hours slept per night (e.g. 6, 7, 8).
   - "injuries": Physical limitations, pain, or injuries (e.g. "lower back pain", "shoulder impingement", "none").
   - Preserve all previously extracted values from currentProfile unless the user explicitly updates them.

2. SECOND, evaluate what information is missing and ask for the NEXT single missing piece in logical sequence:
   - STRICT NO-EMOJIS RULE: Zero emojis anywhere in your response. No emojis of any kind.
   - ONE QUESTION AT A TIME. Do not overwhelm the user.

   COACHING TONE RULE — CRITICAL:
   Every reply MUST follow this two-part structure:
   PART 1 — Acknowledge: One short, specific sentence that affirms what the user just said. Make it feel personal and coach-like. Use their name occasionally. Draw on motivational psychology — validate their choice, build belief, create momentum.
   PART 2 — Ask: The next question, naturally flowing from the acknowledgment.
   Never output a bare question with no acknowledgment (except for Step 1, which is the opening).

   ACKNOWLEDGMENT EXAMPLES BY STEP:
   - After user gives name → "Good to meet you, [Name]." then ask activity.
   - After user says "gym" → "Gym training — that's where real strength is built, [Name]." then ask goal.
   - After user says "home workout" → "Home workouts — no commute, no excuses. Smart call." then ask goal.
   - After user says "running" → "Running builds more than just fitness — it builds mental toughness. Good choice." then ask goal.
   - After user says "cycling" → "Cycling is one of the best full-body cardio disciplines out there. Let's make it count." then ask goal.
   - After user says "walking" → "Walking is underrated. Daily movement compounds faster than people think." then ask goal.
   - After user gives goal (e.g. "build muscle") → "Building muscle — a concrete, measurable goal. I can work with that." then ask experience.
   - After user gives goal (e.g. "lose fat") → "Fat loss is about consistent effort over time — and that's exactly what I'm here to hold you to." then ask experience.
   - After user says "beginner" → "Starting from scratch is actually an advantage — no bad habits to fix. We build it right from day one." then ask height/weight.
   - After user says "experienced" → "Experienced is good — means we skip the basics and get into real programming." then ask height/weight.
   - After user gives height/weight → "Got it. Those numbers give me everything I need to calibrate your targets precisely." then ask days/schedule.
   - After user gives training days → "Locked in. [N] days a week is a [comment on the frequency — e.g. 'solid commitment' / 'great foundation to build on']." then ask goal timeframe (with the realistic estimate — see Step 6.5).
   - After user gives their target timeframe → "Got it — [X] noted as your target." then ask time.
   - After user gives time → "Training at [time] — [comment, e.g. 'early sessions before the world wakes up build discipline' / 'evening sessions after work are proven for strength output']." then ask equipment.
   - After user gives equipment → "Noted. I'll build your plan around exactly what you have access to." then ask diet.
   - After user gives diet → "Good. Your nutrition baseline tells me a lot about where the gaps are." then ask restrictions.
   - After user gives restrictions → "Understood — those are non-negotiables and I'll respect them in every plan I build." then ask blocker.
   - After user gives blocker → "Knowing your blocker upfront means we plan around it, not through it." then ask sleep.
   - After user gives sleep hours → "Sleep is where the adaptation actually happens — [comment on their hours, e.g. '7 hours is solid' / '5 hours is a gap we need to work around']." then ask injuries.
   - After user gives injuries → "Noted. [comment, e.g. 'We train around it, never through it' / 'No limitations — full program unlocked']." then deliver plan.

   SEQUENTIAL ORDER OF QUESTIONS:
   • Step 1 (Name missing):
     Ask: "Hey, I'm ShowUp — your AI fitness coach.\n\nWhat should I call you?"

   • Step 2 (Activity / training type missing):
     Acknowledge name, then ask:
     "Good to meet you, [Name].\n\nWhat does your training look like right now?\n\n• Gym\n• Home workout\n• Running\n• Cycling\n• Walking\n• Starting fresh / not sure yet"

   • Step 3 (Goal missing):
     Acknowledge their activity choice with a specific 1-line coach comment, then ask goal.
     Adapt the goal options based on activity:
     - activity = "gym" or "home_workout":
       Goal options: "• Build muscle\n• Lose fat\n• Get stronger\n• Improve overall fitness\n• Something else"
       Lead-in: "Now tell me — what are you training for?"
     - activity = "running":
       Goal options: "• Build endurance / run longer\n• Lose fat / improve body composition\n• Improve pace and speed\n• Build a consistent habit\n• Something else"
       Lead-in: "What are you running towards?"
     - activity = "cycling":
       Goal options: "• Build distance and endurance\n• Lose fat / improve body composition\n• Improve speed and performance\n• Build a consistent habit\n• Something else"
       Lead-in: "What's the target with your cycling?"
     - activity = "walking":
       Goal options: "• Lose fat / improve body composition\n• Build daily step count and stamina\n• Build a consistent active habit\n• Improve general health and energy\n• Something else"
       Lead-in: "What are you aiming for?"
     - activity = null:
       Goal options: "• Build muscle\n• Lose fat\n• Get stronger\n• Improve fitness / endurance\n• Something else"
       Lead-in: "What are you trying to achieve?"

   • Step 4 (Experience missing):
     Acknowledge their goal with a specific 1-line coach validation, then ask:
     "How long have you been training?\n\n• Beginner — just getting started\n• Some experience — trained on and off\n• Experienced — consistent training background"

   • Step 5 (Height & Weight missing):
     Acknowledge experience level, then ask:
     "To calibrate your targets precisely — what's your height and current weight? (e.g. 175 cm, 70 kg)"

   • Step 6 (Days per week / Specific workout days missing or incomplete):
     Acknowledge their metrics, then ask:
     - If neither days count nor specific days are known:
       "How many days a week do you want to train, and which days work best for you? (e.g. 4 days — Mon, Tue, Thu, Sat)"
     - If days_per_week is known but specific days are not:
       "Which specific [N] days of the week work best for you? (e.g. Monday and Thursday, or Saturday and Sunday)"

   • Step 6.5 (Goal timeframe missing — only ask once days_per_week is known):
     Acknowledge their training days, then in the SAME message:
     (a) State a realistic, honest ballpark estimate for their goal given their ACTUAL setup (activity + days_per_week + experience_level). Use this guidance to compute it:
         - Muscle gain: at 1-2 days/week, expect visible initial changes in ~10-14 weeks and meaningful gains over ~6-9 months. At 3-4 days/week, visible changes in ~6-8 weeks, meaningful gains in ~4-6 months. At 5-6 days/week, visible changes in ~4-6 weeks, meaningful gains in ~3-5 months (experienced lifters gain slower than beginners despite more volume — mention this if experience_level is "experienced").
         - Fat loss: sustainable, healthy fat loss is roughly 0.5-1% of bodyweight per week; visible changes typically appear in ~4-8 weeks regardless of days/week (diet matters more than training frequency here), with meaningful transformation in ~3-6 months.
         - General fitness / strength / endurance: noticeable improvement in ~4-6 weeks, a settled habit and clear progress by ~8-12 weeks.
         - Running/cycling/walking endurance goals: base fitness improves in ~4-6 weeks; a specific distance/pace target realistically takes ~8-16 weeks depending on the gap from their current level.
         Always hedge honestly — say "roughly" / "typically" / "with consistency" and note that fewer training days means slower progress, not impossible progress.
     (b) Then ask: "How many weeks or months would you like to set as your own target to work towards this?"
     Do NOT skip part (a) — the estimate must come BEFORE asking their target, on the same message.

   • Step 7 (Checkin time missing):
     Acknowledge their schedule commitment, then ask:
     "What time do you usually train? (e.g. 6:30 AM, 7:00 PM)"

   • Step 8 (Equipment / Setup context missing):
     Acknowledge their training time, then ask based on activity:
     - gym: "What's your gym setup like — free weights, machines, or a mix of both?"
     - home_workout: "What do you have at home to train with? (e.g. dumbbells, resistance bands, pull-up bar, or just bodyweight)"
     - running: "Where do you run — roads, trails, treadmill? And do you use any tracking app like Strava or Nike Run Club?"
     - cycling: "What's your cycling setup — outdoor road bike, stationary gym cycle, or a smart trainer?"
     - walking: "Where do you walk — outdoors, park, treadmill? And do you track your steps with a watch or phone?"

   • Step 9 (Normal Day of Eating missing):
     Acknowledge their setup, then ask:
     "Walk me through what a normal day of eating looks like for you — breakfast, lunch, dinner, any snacks."

   • Step 10 (Diet Restrictions & Non-negotiables missing):
     Ask: "Any foods you avoid, allergies, dietary restrictions, or meals you absolutely don't want to change?"

   • Step 11 (Obstacles / Consistency blocker missing):
     Acknowledge their diet restrictions, then ask:
     "What usually gets in the way of your training consistency?\n\n• Time\n• Motivation\n• I forget to go / lose track\n• Consistency / Routine\n• Diet\n• Recovery / Fatigue\n• Nothing major / Something else"

   • Step 12 (Sleep hours missing):
     Ask: "How many hours do you normally sleep each night?"

   • Step 13 (Injuries / Limitations missing):
     Ask: "Any current injuries, pain, or physical limitations that affect your training? (If none, just say 'none')"

   • Step 15 (ALL 15 COLLECTED -> STAGE 5 VALUE DELIVERY & TAILORED STARTING PLAN + STAGE 6 COMMITMENT PROMPT):
     If name, goal, experience_level, activity, height, weight, days_per_week, timetable, goal_timeframe, checkin_time, equipment, diet, restrictions, obstacles, sleep, and injuries are ALL known:
     Deliver the complete, psychologically powerful initial diagnosis & tailored starting plan:

     Structure:
     I have enough to build your starting plan.

     Your current setup
     • Goal: [Goal]
     • Activity: [Activity & Equipment]
     • Training: [N] days/week ([List chosen workout days, e.g. Saturday, Sunday]) at [Time]
     • Experience: [Level]
     • Target Timeframe: [Their stated goal_timeframe]
     • Baseline Metrics: [Weight] kg | [Height] cm (Target Calories: ~[Cals] kcal | ~[Protein]g Protein)
     • Recovery: [Hours] hrs sleep/night
     • Health & Dietary Notes: [Restrictions / Allergy-safe / Limitations]

     [Activity-Specific Strategy & Philosophy]:
     - Gym: "Based on this, I would structure your training around progressive overload on foundational compounds and structured recovery rather than adding unnecessary volume."
     - Home Workout: "Based on this, I would structure your workouts around progressive calisthenics leverage, time-under-tension circuits, and core stability to maximize progression safely."
     - Running: "Based on this, I would structure your training around aerobic base building (Zone 2 easy-effort runs) with gradual weekly distance progression to protect joints and build sustainable stamina."
     - Cycling: "Based on this, I would structure your sessions around steady cadence pacing and progressive distance endurance."
     - Walking: "Based on this, I would structure your routine around daily step volume progression, active recovery, and metabolic health."

     Your Weekly Schedule Split:
     • Monday: [Focus or Rest]
     • Tuesday: [Focus or Rest]
     • Wednesday: [Focus or Rest]
     • Thursday: [Focus or Rest]
     • Friday: [Focus or Rest]
     • Saturday: [Focus or Rest]
     • Sunday: [Focus or Rest]

     Your First Targets:
     • Train [N]×/week at [Time] on [List workout days].
     • [Activity-specific main target].
     • Hit your daily protein target (~[Protein]g) through your normal meals.
     • Record each completed workout with photo proof and the daily gesture.
     • Review progress every 7 days.

     ---
     Your plan is ready.

     One thing I need from you: what are you committing to consistently?

     Example: "I will complete my scheduled workouts and log them honestly."

3. RESPECT & TONE RULES:
   - In Tamil/Tanglish: ALWAYS use "neenga", "unga", "ungalukku", "sollunga", "bro" / "Ji". NEVER use "dei", "da", "di", "nee", "unakku".
   - Keep each conversational prompt crisp, professional, clean, and motivating.

Here is the current profile state:
${profileString}

Here is the recent conversation history:
${historyString}

The user's latest message:
"${message}"

Respond strictly with a JSON object, no markdown fences:
{
  "extracted": {
    "name": string|null,
    "language": "en"|"ta"|"hi"|"tl"|"hl"|null,
    "goal": string|null,
    "experience_level": "beginner"|"some_experience"|"experienced"|null,
    "activity": "gym"|"home_workout"|"running"|"walking"|"cycling"|null,
    "workout_location": "gym"|"home"|"outdoor"|null,
    "home_equipment": string|null,
    "height": number|null,
    "weight": number|null,
    "days_per_week": number|null,
    "goal_timeframe": string|null,
    "timetable": {
      "Monday": string,
      "Tuesday": string,
      "Wednesday": string,
      "Thursday": string,
      "Friday": string,
      "Saturday": string,
      "Sunday": string
    }|null,
    "checkin_time": string|null,
    "diet_summary": string|null,
    "allergy": string|null,
    "diet_restrictions": string|null,
    "blocker_text": string|null,
    "sleep_hours": number|null,
    "injuries": string|null
  },
  "is_profile_complete": boolean,
  "reply": "string (your conversational response with zero emojis and clean formatting)"
}`;

  const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.2, maxTokens: 2500 });

  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    const targetLang = (parsed.extracted && parsed.extracted.language) || (user && user.language) || 'en';
    return {
      extracted: parsed.extracted || {},
      is_profile_complete: Boolean(parsed.is_profile_complete),
      reply: sanitizeScriptForLanguage(parsed.reply || '', targetLang),
    };
  } catch (err) {
    throw new GeminiError(`Could not parse Gemini JSON response: ${text}`);
  }
}

async function classifyIntent(message) {
  const msg = (message || '').trim().toLowerCase();

  // Fast-path heuristic classification (instant & zero API latency)
  if (/^(1|2|3|4)$/.test(msg) || /^(completed|modified|couldn't train|rescheduled)$/i.test(msg)) {
    return 'POST_WORKOUT_RESPONSE';
  }
  if (/(?:severe pain|sharp pain|injured|fever|sick today|doctor told|sprained|fracture|threw up|high fever|cannot walk|cannot stand)/i.test(msg)) {
    return 'HEALTH_ALERT';
  }
  if (/(?:couldn't eat|could not eat|didn't eat|did not eat|skipped lunch|skipped dinner|skipped breakfast|missed meal|missed my food|ate junk|ate pizza|ate sweets|ate biryani|messed up my diet|off plan|off diet|cheat meal|ate fast food|struggling to eat|lost appetite|no appetite)/i.test(msg)) {
    return 'DIET_DEVIATION';
  }
  if (/(?:couldn't do|could not do|instead of|substituted|swapped|bench was occupied|machine was taken|machine was occupied|shortened workout|quick workout|low energy today|did dumbbells instead|did cable instead|did bodyweight instead)/i.test(msg)) {
    return 'SUBSTITUTION_OR_MODIFICATION';
  }
  if (/(?:can't train|cant train|reschedule|move today|move monday|move tuesday|move wednesday|move thursday|move friday|move saturday|move sunday|train tomorrow|missed yesterday|postpone workout|shift workout)/i.test(msg)) {
    return 'RESCHEDULE_REQUEST';
  }
  if (/(?:weighed|weight(?:\s+is)?(?:\s*:)?|scale says|kg this morning|kg today)/i.test(msg) && /\d+/.test(msg)) {
    return 'WEIGHT_UPDATE';
  }
  if (/\b(?:remind|reminde?rs?|remaind(?:er|ers)?)\b/i.test(msg) && /(?:breakfast|lunch|dinner|snack)/i.test(msg) && /\d/.test(msg)) {
    return 'MEAL_REMINDER_UPDATE';
  }
  if (/(?:benched|squatted|deadlifted|overhead press|lat pulldown|dumbbell press|curls|\bsquat\b|\brow\b|\bdeadlift\b|\bbench\b|\bpress\b|\bpull.?down\b|\bpull.?up\b)/i.test(msg) && /\d+\s*(?:kg|reps|x|\*)/i.test(msg)) {
    return 'PERFORMANCE_LOG';
  }
  if (/(?:what should i eat|diet plan|food|protein|nutrition|calories|post workout meal|pre workout meal|eat after|eat before|how much protein|macro)/i.test(msg) && /(?:\?|should|suggest|how|what|can i|recommend)/i.test(msg)) {
    return 'DIET_QUERY';
  }
  if (/(?:exercise|workout|routine|biceps|chest|triceps|abs|glutes|hamstrings|quads|shoulders|bench weight)/i.test(msg) && /(?:\?|should|suggest|how to|what|increase|form)/i.test(msg)) {
    return 'EXERCISE_QUERY';
  }
  if (/(?:pain|hurt|tight|sore|strain|injury|cramp|sprain|discomfort|ache)/i.test(msg)) {
    return 'GENERAL_QUERY';
  }
  if (msg.includes('?') || /^(what|how|why|when|where|who|is it|can i|tell me|explain)/i.test(msg)) {
    return 'GENERAL_QUERY';
  }

  const prompt = `You are an AI intent classifier for ShowUp, a personalized fitness coaching operating system.
Analyze the user's incoming message and determine their primary intent.

Available intents:
- "DIET_DEVIATION": User reports off-plan eating, missed a meal, skipped food, ate junk/fast food/sweets/pizza/biryani, couldn't eat their planned diet, or had an irregular eating day. E.g. "I couldn't eat my planned meals today", "I skipped lunch and only had tea", "I ate pizza and sweets today instead of my diet", "messed up my diet today".
- "SUBSTITUTION_OR_MODIFICATION": User modified exercises, swapped equipment because machines/benches were occupied, shortened their session, or trained with low energy. E.g. "I couldn't do barbell bench because all the benches were occupied, so I did dumbbell press instead", "gym was crowded so did cables", "did a quick 20 min session today".
- "HEALTH_ALERT": User reports severe pain, injury, illness, fever, or doctor restrictions. E.g. "I have severe back pain and cannot train", "I have a 102 fever today", "injured my ankle".
- "RESCHEDULE_REQUEST": User wants to move, postpone, shift, or reschedule a workout. E.g. "I can't train today, can I do it tomorrow?", "move Monday's workout to Tuesday", "I have college tomorrow, can I do it Sunday?", "I missed yesterday, can I train today instead?".
- "POST_WORKOUT_RESPONSE": User is responding to a post-workout checkin status question ("Completed", "Modified", "Couldn't train", "Rescheduled", "1", "2", "3", "4").
- "WEIGHT_UPDATE": User is reporting an updated body weight measurement. E.g. "I weighed 73kg this morning", "my weight is now 72.5kg".
- "MEAL_REMINDER_UPDATE": User wants to change or set the TIME of a meal/calorie-tracking reminder (breakfast, lunch, dinner, or snack). E.g. "remind me lunch at 1pm instead", "change my dinner reminder to 9pm", "move breakfast reminder to 7:30am".
- "PERFORMANCE_LOG": User is reporting specific lifts, sets, reps, or weights lifted. E.g. "Benched 65kg for 8 reps 3 sets", "Squat 100kg 5x5 RPE 8".
- "DIET_LOG": User wants to log food, meals, calories eaten, or diet. E.g., "I ate 2 eggs", "lunch: chicken rice 200g".
- "DIET_QUERY": User is asking for diet plan suggestions, recipes, calorie target details, or general nutrition/diet advice. E.g., "suggest a diet plan", "what should I eat?".
- "WORKOUT_BURN_LOG": User is describing a workout or activity session to log calories burned. E.g., "ran 5k in 30m", "burned 300 calories running".
- "EXERCISE_QUERY": User is asking for advice, routines, or exercises to target a specific muscle group. E.g., "how to build chest?", "suggest a leg workout".
- "GENERAL_QUERY": User is asking a general question, checking schedule, progress, or chatting.
- "CHECKIN": Default. User is sending a daily check-in message about a workout they completed.

User Message: "${message}"

Respond ONLY with a valid JSON object, no markdown fences:
{"intent": "DIET_DEVIATION"|"SUBSTITUTION_OR_MODIFICATION"|"HEALTH_ALERT"|"RESCHEDULE_REQUEST"|"POST_WORKOUT_RESPONSE"|"WEIGHT_UPDATE"|"MEAL_REMINDER_UPDATE"|"PERFORMANCE_LOG"|"DIET_LOG"|"DIET_QUERY"|"WORKOUT_BURN_LOG"|"EXERCISE_QUERY"|"GENERAL_QUERY"|"CHECKIN"}`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.1 });
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return parsed.intent || 'CHECKIN';
  } catch (err) {
    console.error('[Gemini] classifyIntent error:', err);
    return 'CHECKIN';
  }
}

async function parseDietLog(message) {
  const { findFoodMatches, formatFoodMatchesForPrompt } = require('../knowledge/foodKnowledgeBase');
  const kbBlock = formatFoodMatchesForPrompt(findFoodMatches(message));

  const prompt = `You are a nutrition database specialized in Indian food. The user wants to log food they ate.
Analyze the text and extract all food items. For each item, estimate the weight in grams (if not specified, make a reasonable estimate) and calculate the calories, protein (g), carbs (g), and fat (g).
${kbBlock ? '\n' + kbBlock + '\n' : ''}
User message: "${message}"

Respond ONLY with a valid JSON object containing an array of items, no markdown fences:
{
  "items": [
    {
      "food_item": "string",
      "weight_g": number,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ]
}`;

  const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.1 });
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    throw new GeminiError(`Could not parse diet log: ${text}`);
  }
}

async function parseBurnedCalories(message) {
  const prompt = `You are a fitness tracker. Estimate the calories burned for the workout described in the user's message.
If a calorie number is explicitly mentioned, use that. Otherwise, calculate a realistic estimate based on the activity type, intensity, and duration.

User message: "${message}"

Respond ONLY with a valid JSON object, no markdown fences:
{
  "activity_name": "string (e.g. running, cycling, weightlifting)",
  "calories_burned": number (integer)
}`;

  const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.1 });
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    throw new GeminiError(`Could not parse burned calories: ${text}`);
  }
}

/**
 * Parses a user's freeform reply about when they want meal reminders
 * (e.g. "breakfast 8am, lunch 1pm, snack 4pm, dinner 8:30pm") into HH:MM (24h) times.
 * Any meal not mentioned falls back to a sensible program default.
 */
async function parseMealReminderTimes(message, timezone) {
  const prompt = `You are a scheduling assistant for a fitness coaching app in timezone ${timezone || 'Asia/Kolkata'}.
The user was asked what times they want meal/calorie-tracking reminders. Parse their reply into 24-hour HH:MM times.

User reply: "${message}"

Respond ONLY with a valid JSON object, no markdown fences:
{
  "breakfast": "HH:MM"|null,
  "lunch": "HH:MM"|null,
  "dinner": "HH:MM"|null,
  "snacks": ["HH:MM", ...]
}
Rules:
- Only include a time if the user actually specified or clearly implied one for that meal.
- "snacks" can contain zero or more times (any snack/evening-snack/tea-time mentions).
- If the user gave a vague answer with no real times (e.g. "whenever", "you decide"), return sensible defaults: breakfast "09:00", lunch "13:30", dinner "20:30", snacks [].`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.1 });
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      breakfast: parsed.breakfast || '09:00',
      lunch: parsed.lunch || '13:30',
      dinner: parsed.dinner || '20:30',
      snacks: Array.isArray(parsed.snacks) ? parsed.snacks : [],
    };
  } catch (err) {
    console.error('[Gemini] parseMealReminderTimes failed, using defaults:', err.message);
    return { breakfast: '09:00', lunch: '13:30', dinner: '20:30', snacks: [] };
  }
}

/**
 * Parses a request to change ONE existing meal reminder's time (post-onboarding,
 * conversational — e.g. "remind me lunch at 1:22pm actually"). Distinct from
 * parseMealReminderTimes above, which handles the initial "set all your times" turn.
 */
async function parseMealReminderUpdate({ user, text }) {
  let currentTimes = {};
  try { currentTimes = JSON.parse(user.meal_reminder_times || '{}'); } catch (e) { currentTimes = {}; }

  const prompt = `You are a scheduling assistant for a fitness coaching app in timezone ${require('../config').timezone}.
The user wants to change or set the time of ONE of their meal/calorie-tracking reminders.

Current reminder times: ${JSON.stringify(currentTimes)}

User message: "${text}"

Task: Identify which single meal they mean and the new time in 24-hour HH:MM format.

Respond ONLY with a valid JSON object, no markdown fences:
{
  "meal": "breakfast"|"lunch"|"dinner"|"snack"|null,
  "time": "HH:MM"|null
}
If the message isn't actually specifying a meal + a clear time, return {"meal": null, "time": null}.`;

  try {
    const resText = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.1 });
    const cleaned = resText.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Gemini] parseMealReminderUpdate failed:', err.message);
    return { meal: null, time: null };
  }
}

async function getExerciseSuggestions(user, message, muscleGroup) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const db = require('../db/db');
  const chatHistory = db.getChatMessages(user.id, 20);
  const historyString = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  const coachCtx = buildCoachContext(user);

  const { lookupWorkoutKnowledge, formatKnowledgeForPrompt } = require('../knowledge/workoutKnowledgeBase');
  const kbEntry = lookupWorkoutKnowledge(user.activity, user.experience_level, user.days_per_week, user.goal);
  const kbBlock = kbEntry ? formatKnowledgeForPrompt(kbEntry) : '';
  // No local KB entry for this activity (or an unrecognized one) — ground the answer with live web search instead.
  const useSearch = !kbEntry;

  const prompt = `You are ShowUp, an elite, direct, no-BS fitness coach texting on WhatsApp.
${coachCtx}
${kbBlock ? kbBlock + '\n' : ''}The user is asking for exercise suggestions or a routine for: "${muscleGroup}".

User Context:
- Name: ${user.name}
- Goal: ${user.goal || 'lean muscle gain'}
- Workout Location: ${user.workout_location || 'gym'}
- Home Equipment: ${user.home_equipment || 'none'}
- Experience Level: ${user.experience_level || 'beginner'}
- Calorie Budget: ${user.target_calories || 2000} kcal/day
- Registered Food Allergies: ${user.allergy || 'none'}

Recent chat history:
${historyString}

User message: "${message}"

CRITICAL WORKOUT & FORMATTING RULES:
1. NOTEBOOK FORMAT (MANDATORY):
   Format your workout plan EXACTLY like a clean handwritten notebook split:
   [Split Name or Muscle Focus]

   [1] Exercise Name - Sets×Reps
   [2] Exercise Name - Sets×Reps
   [3] Exercise Name - Sets×Reps
   ...
   If multi-muscle (e.g. Chest + Triceps or Back + Biceps or Shoulders + Arms), group them with subheaders (e.g. Shoulders, Biceps, Triceps).
   Keep each line format strictly: "[N] Exercise Name - Sets×Reps" (e.g. "[1] Back Squat - 4×5-8", "[2] Romanian Deadlift - 4×8-10", "[3] Incline Dumbbell Press - 3×10-12", "[4] Walking Lunges - 3×10 each leg").
2. GROUNDED IN REALITY, POSSIBILITY & TIME LIMIT:
   - Location/Equipment: If home with no equipment, use progressive bodyweight variations (pike pushups, squats, lunges, diamond pushups). If gym, use barbells, dumbbells, cables, and machines.
   - Food/Fuel: If user is in a deficit, keep volume tight (4-5 exercises) to prevent injury.
   - Time Limit: If user specified a duration (e.g. 30 min, 45 min), adapt number of exercises accordingly.
3. OVERTRAINING & REST REMINDER:
   - If the user asks or talks about training 7 days a week, 2 hours every day, or no rest days:
   - You MUST add a short, direct reminder: "Rest is when muscles rebuild and grow. 1-2 rest days per week are essential to avoid CNS burnout and keep recovery high."
4. SHORT & CLEAN:
   - Clean double line spacing between sections.
   - Keep total response concise (max 90-120 words). No conversational fluff.
${useSearch ? '5. No local reference data was found for this activity/level — use Google Search to ground your recommendation in real, current exercise science before answering.' : ''}

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6, useSearch });
  return sanitizeScriptForLanguage(text.trim(), user.language);
}

async function getDietSuggestions(user, message) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const targetCalories = user.target_calories || Math.round((user.weight || 70) * 30) || 2000;
  const db = require('../db/db');
  const fitness = require('../utils/fitness');
  const macros = fitness.calculateMacros(targetCalories, user.weight || 70);
  const chatHistory = db.getChatMessages(user.id, 20);
  const historyString = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  const coachCtx = buildCoachContext(user);

  const { findFoodMatches, formatFoodMatchesForPrompt } = require('../knowledge/foodKnowledgeBase');
  const kbBlock = formatFoodMatchesForPrompt(findFoodMatches(message));

  const prompt = `You are ShowUp, a direct, no-BS fitness coach and nutritionist texting on WhatsApp.
${coachCtx}
${kbBlock ? kbBlock + '\n' : ''}The user is asking for diet advice or a meal plan. Here is their profile:
- Name: ${user.name}
- Height: ${user.height} cm | Weight: ${user.weight} kg | Goal: ${user.goal || 'muscle_gain'}
- Calorie Budget: ${targetCalories} kcal/day | Target Protein: ~${macros.proteinGrams}g
- Cuisine Preference: ${user.cuisine_region || 'South Indian / Tamil Nadu'}
- Registered Food Allergies: ${user.allergy || 'none'}
- Supplements: ${user.supplements || 'none'}

Recent chat history:
${historyString}

User message: "${message}"

CRITICAL DIET FORMATTING & LINE SPACING RULES:
1. CLEAN STRUCTURED SECTIONS (MANDATORY):
   Format with clean line spacing and clear meal blocks:

   Target: ${targetCalories} kcal | ~${macros.proteinGrams}g Protein | ~3-4L Water

   If the user asks for a weekly plan, meal rotation, variety, or says they cannot eat the same thing daily:
   Provide 2 to 3 interchangeable, macro-equivalent options per meal (Option A, Option B, Option C) or a Day-by-Day (Mon-Wed-Fri vs Tue-Thu-Sat vs Sun) rotation schedule so they have full variety throughout the week while hitting identical daily calories and protein.

   Example Weekly Rotational Structure:
   Breakfast (~${Math.round(targetCalories * 0.25)} kcal | ~${Math.round(macros.proteinGrams * 0.25)}g P):
   • Option 1: [Exact foods with portion grams/servings]
   • Option 2: [Exact foods with portion grams/servings]
   • Option 3: [Exact foods with portion grams/servings]

   Lunch (~${Math.round(targetCalories * 0.35)} kcal | ~${Math.round(macros.proteinGrams * 0.35)}g P):
   • Option 1: [Exact foods with portion grams/servings]
   • Option 2: [Exact foods with portion grams/servings]
   • Option 3: [Exact foods with portion grams/servings]

   Evening Snack (~${Math.round(targetCalories * 0.15)} kcal | ~${Math.round(macros.proteinGrams * 0.15)}g P):
   • Option 1: [Exact foods with portion grams/servings]
   • Option 2: [Exact foods with portion grams/servings]

   Dinner (~${Math.round(targetCalories * 0.25)} kcal | ~${Math.round(macros.proteinGrams * 0.25)}g P):
   • Option 1: [Exact foods with portion grams/servings]
   • Option 2: [Exact foods with portion grams/servings]
   • Option 3: [Exact foods with portion grams/servings]

   Allergy Check: [Check against user allergies ("${user.allergy || 'none'}") and highlight safe alternatives]

2. REALISTIC & GROUNDED:
   - Align with their preferred cuisine (${user.cuisine_region || 'South Indian / Tamil Nadu'}).
   - State EXACT grams (e.g. 150g Paneer / Chicken breast, 200g Cooked Rice, 3 Boiled Eggs).
3. KEEP IT CONCISE: Clean bullet points, no giant storytelling.

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6 });
  return sanitizeScriptForLanguage(text.trim(), user.language);
}

async function generateDietDeviationGuidance(user, message) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const targetCalories = user.target_calories || Math.round((user.weight || 70) * 30) || 2000;
  const db = require('../db/db');
  const fitness = require('../utils/fitness');
  const macros = fitness.calculateMacros(targetCalories, user.weight || 70);
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, a direct, supportive fitness coach and nutritionist texting on WhatsApp.
${coachCtx}
The user is reporting an off-plan eating day, missed meals, skipped food, or ate junk/fast food/sweets.
User Profile:
- Name: ${user.name}
- Goal: ${user.goal || 'muscle_gain'} | Calorie Target: ${targetCalories} kcal | Protein: ~${macros.proteinGrams}g
- Cuisine: ${user.cuisine_region || 'South Indian'}
- Allergies: ${user.allergy || 'none'}

User Message: "${message}"

CORE PRINCIPLES & GUIDANCE:
1. ZERO MORAL SHAMING & ZERO FINANCIAL PENALTY:
   - Reassure them directly that one off-plan meal, missed meal, or cheat food DOES NOT ruin their fitness progress.
   - Clarify that nutrition variations have ZERO financial penalty on ShowUp (accountability is only tied to showing up to train).
2. IMMEDIATE ACTIONABLE RECOVERY:
   - If they SKIPPED MEALS or UNDER-ATE:
     Give 2-3 quick, high-protein and easy-to-eat catch-up options (e.g. 3-egg omelette, 1 glass milk + peanut butter/whey, 150g curd with banana & nuts) to protect their muscle and energy.
   - If they ATE JUNK / SWEETS / OVER-ATE:
     Tell them to drink 500ml of water, get a good night's sleep, and DO NOT starve or crash diet tomorrow. Return right back to their normal target.
3. TONE: Warm, grounding, empowering, practical. Keep under 110 words.

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6 });
  return sanitizeScriptForLanguage(text.trim(), user.language);
}

/**
 * Generates a full tailored AI Nutrition Plan for the user based on baseline metrics, goal, cuisine & allergies.
 */
async function generateTailoredNutritionPlan(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const targetCalories = user.target_calories || Math.round((user.weight || 70) * 30) || 2000;
  const fitness = require('../utils/fitness');
  const macros = fitness.calculateMacros(targetCalories, user.weight || 70);
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, an elite AI fitness and nutrition coach delivering a personalized nutrition plan.
${coachCtx}

User Profile:
- Name: ${user.name}
- Height: ${user.height || 175} cm | Weight: ${user.weight || 70} kg
- Goal: ${user.goal || 'lean muscle gain'}
- Activity: ${user.activity || 'gym'}
- Calorie Target: ${targetCalories} kcal/day | Protein Target: ~${macros.proteinGrams}g
- Cuisine / Region: ${user.cuisine_region || 'Indian'}
- Dietary Notes & Restrictions: ${user.diet_restrictions || user.diet_summary || 'none'}
- Allergies: ${user.allergy || 'none'}

Task: Generate a clean, complete, highly practical daily nutrition plan.
Rules:
1. STRICT NO-EMOJIS RULE: Zero emojis.
2. Structure:
   Your Tailored Nutrition Plan

   Daily Targets:
   • Calories: ~${targetCalories} kcal
   • Protein: ~${macros.proteinGrams}g
   • Water: 3-4 Liters

   Meal Breakdown:

   Breakfast (~${Math.round(targetCalories * 0.25)} kcal | ~${Math.round(macros.proteinGrams * 0.25)}g P):
   • [Specific foods with exact portions e.g. 3 whole eggs or 100g paneer, 2 slices whole wheat toast/idli]

   Lunch (~${Math.round(targetCalories * 0.35)} kcal | ~${Math.round(macros.proteinGrams * 0.35)}g P):
   • [Specific foods with exact portions e.g. 150g chicken breast / soya chunks / paneer, 1.5 cup cooked rice / 2 rotis, 1 cup dal, salad]

   Evening Snack (~${Math.round(targetCalories * 0.15)} kcal | ~${Math.round(macros.proteinGrams * 0.15)}g P):
   • [Specific foods with exact portions e.g. 1 scoop whey / 1 glass milk + 15g roasted peanuts, 1 fruit]

   Dinner (~${Math.round(targetCalories * 0.25)} kcal | ~${Math.round(macros.proteinGrams * 0.25)}g P):
   • [Specific foods with exact portions e.g. 150g fish / chicken / tofu / paneer, 2 rotis / 1 cup rice, cooked vegetables]

   Key Rules:
   • Hit your protein target (~${macros.proteinGrams}g) consistently each day.
   • Log your meals with ShowUp anytime for instant macro verification.
3. DO NOT ask if this looks good, invite feedback, or ask any question at the end — end the message right after "Key Rules". A separate confirmation step is handled by the app, not by you.

Reply ONLY in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6, maxTokens: 1500 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.warn('Fallback generating nutrition plan:', err.message);
    return `Your Tailored Nutrition Plan\n\nDaily Targets:\n• Calories: ~${targetCalories} kcal\n• Protein: ~${macros.proteinGrams}g\n• Water: 3-4 Liters\n\nMeal Breakdown:\n\nBreakfast:\n• 3 Eggs (or 100g Paneer/Tofu) + 2 slices brown bread or 3 idlis\n\nLunch:\n• 150g Chicken breast / Paneer / Soya chunks + 1.5 cup rice/2 rotis + 1 bowl dal + salad\n\nEvening Snack:\n• 1 glass milk or scoop protein + handful nuts / fruit\n\nDinner:\n• 150g Protein source + 2 rotis or 1 cup rice + veggies\n\nKey Rules:\n• Hit your ~${macros.proteinGrams}g protein target daily.\n• Log your meals anytime for instant tracking.`;
  }
}

/**
 * Parses and structures a user-provided text diet plan.
 */
async function parseUserProvidedDietPlan({ text, user }) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const targetCalories = user.target_calories || Math.round((user.weight || 70) * 30) || 2000;
  const fitness = require('../utils/fitness');
  const macros = fitness.calculateMacros(targetCalories, user.weight || 70);
  const coachCtx = buildCoachContext(user);

  const { findFoodMatches, formatFoodMatchesForPrompt } = require('../knowledge/foodKnowledgeBase');
  const kbBlock = formatFoodMatchesForPrompt(findFoodMatches(text));

  const prompt = `You are ShowUp, an elite AI fitness coach and nutritionist reviewing a user-provided diet plan.
${coachCtx}
${kbBlock ? '\n' + kbBlock + '\n' : ''}
User Profile:
- Name: ${user.name}
- Goal: ${user.goal || 'muscle_gain'}
- Calorie Target: ~${targetCalories} kcal | Protein Target: ~${macros.proteinGrams}g
- User's Provided Diet Plan:
"${text}"

Task:
1. Extract and clean up their provided meal schedule (Breakfast, Lunch, Snacks, Dinner) — use the reference knowledge base values above for any matching foods.
2. Estimate total daily calories and protein from what they described.
3. Compare against their target (~${targetCalories} kcal, ~${macros.proteinGrams}g protein). This person may be eating hostel/mess/canteen food with limited choice, not something they cooked themselves — be practical, not judgmental.
4. If there is a MEANINGFUL gap (protein notably short, mostly carbs/fried food, few vegetables, etc.), you MUST include a "What to Add" and "What to Avoid" section with 2-4 SPECIFIC, easy-to-get items each (e.g. "2 boiled eggs after lunch", "a glass of milk or curd with dinner", "a handful of roasted chana as a snack" to add; "the extra fried side twice a week", "sugary tea between meals" to avoid). Suggestions must be realistic for someone with limited control over what's served (mess/hostel/canteen) — additions on top, not a meal plan overhaul.
5. If their plan is already well-aligned with their target, skip the "What to Add"/"What to Avoid" section entirely — do not invent problems that aren't there.

Rules:
1. STRICT NO-EMOJIS RULE: 0 emojis.
2. Structure:
   Here's your reviewed nutrition plan.

   Your Daily Meals:
   • Breakfast: [Summary of user's breakfast]
   • Lunch: [Summary of user's lunch]
   • Evening Snack: [Summary of user's snack]
   • Dinner: [Summary of user's dinner]

   Estimated: ~[X] kcal | ~[Y]g Protein (Target: ~${targetCalories} kcal | ~${macros.proteinGrams}g)

   [ONLY IF there's a meaningful gap, include this section:]
   What to Add:
   • [specific item]
   • [specific item]

   What to Avoid:
   • [specific item]
   • [specific item]
3. DO NOT say the plan is "locked in", "final", or "saved" — DO NOT ask if this looks good or invite feedback — end the message right after the Add/Avoid section (or the Estimated line if no gap). A separate confirmation step is handled by the app, not by you.

Reply ONLY in ${langName}.`;

  try {
    const reply = await callGemini({ parts: [{ text: prompt }], temperature: 0.5, maxTokens: 1200 });
    return sanitizeScriptForLanguage(reply.trim(), user.language);
  } catch (err) {
    return `Here's your reviewed nutrition plan.\n\nYour Meals:\n${text}\n\nEstimated target: ~${targetCalories} kcal | ~${macros.proteinGrams}g Protein.\n\nHit your daily protein target consistently and log your meals as you eat them!`;
  }
}

/**
 * Revises an existing nutrition plan based on the user's requested change
 * (e.g. "swap chicken for paneer", "less rice, more protein", "I don't eat fish").
 * Used by the AWAITING_NUTRITION_PLAN_CONFIRMATION loop so a plan is never
 * finalized without the user having a real chance to adjust it.
 */
async function refineNutritionPlan({ user, currentPlan, changeRequest }) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const targetCalories = user.target_calories || Math.round((user.weight || 70) * 30) || 2000;
  const fitness = require('../utils/fitness');
  const macros = fitness.calculateMacros(targetCalories, user.weight || 70);
  const coachCtx = buildCoachContext(user);

  const { findFoodMatches, formatFoodMatchesForPrompt } = require('../knowledge/foodKnowledgeBase');
  const kbBlock = formatFoodMatchesForPrompt(findFoodMatches(changeRequest));

  const prompt = `You are ShowUp, an elite AI fitness coach and nutritionist revising a nutrition plan per the user's request.
${coachCtx}
${kbBlock ? '\n' + kbBlock + '\n' : ''}
User Profile:
- Name: ${user.name} | Goal: ${user.goal || 'muscle_gain'}
- Calorie Target: ~${targetCalories} kcal | Protein Target: ~${macros.proteinGrams}g
- Allergies: ${user.allergy || 'none'}

Current Plan:
"${currentPlan}"

User's requested change: "${changeRequest}"

Task: Apply the requested change and return the FULL updated plan (not just the changed part), keeping the same calorie/protein targets and format as the current plan. Respect any allergies.

Rules:
1. STRICT NO-EMOJIS RULE: 0 emojis.
2. Keep the same structural format as the current plan (Daily Targets, Meal Breakdown by meal, exact portions).
3. DO NOT say the plan is "locked in", "final", or ask if this looks good — end after the last meal/rule line. A separate confirmation step is handled by the app.

Reply ONLY in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.5, maxTokens: 1500 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.error('[Gemini] refineNutritionPlan failed:', err.message);
    return currentPlan;
  }
}

/**
 * Analyzes a diet chart / meal sheet image and extracts the structured nutrition plan.
 */
async function parseDietChartImage({ imageBase64, mimeType, user }) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const targetCalories = user.target_calories || Math.round((user.weight || 70) * 30) || 2000;
  const fitness = require('../utils/fitness');
  const macros = fitness.calculateMacros(targetCalories, user.weight || 70);
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, an elite AI fitness coach and nutritionist reviewing an uploaded photo of a user's diet chart, meal sheet, or nutrition plan.
${coachCtx}

User Profile:
- Name: ${user.name}
- Goal: ${user.goal || 'muscle_gain'}
- Calorie Target: ~${targetCalories} kcal | Protein Target: ~${macros.proteinGrams}g

Task:
1. Read and OCR the text/meals from the uploaded image.
2. Structure the meals (Breakfast, Mid-morning, Lunch, Evening Snack, Dinner, Pre/Post workout).
3. Extract portion sizes and key food items.
4. Estimate total calories and protein, and compare against their target (~${targetCalories} kcal, ~${macros.proteinGrams}g). This may be hostel/mess/canteen food with limited choice — be practical, not judgmental.
5. If there is a MEANINGFUL gap (protein notably short, mostly carbs/fried food, few vegetables), include a "What to Add" and "What to Avoid" section with 2-4 specific, easy-to-get items each, realistic for someone with limited control over what's served. If the plan is already well-aligned, skip that section.

Rules:
1. STRICT NO-EMOJIS RULE: 0 emojis.
2. Structure:
   Here's your reviewed diet chart.

   Your Daily Meal Breakdown:
   • Breakfast: [Extracted items and portions]
   • Lunch: [Extracted items and portions]
   • Snack / Pre-Workout: [Extracted items and portions]
   • Dinner: [Extracted items and portions]

   Estimated: ~[X] kcal | ~[Y]g Protein (Target: ~${targetCalories} kcal | ~${macros.proteinGrams}g)

   [ONLY IF there's a meaningful gap:]
   What to Add:
   • [specific item]

   What to Avoid:
   • [specific item]
3. DO NOT say the plan is "saved", "locked in", or "final" — DO NOT ask if this looks good. End after the last section. A separate confirmation step is handled by the app, not by you.

Reply ONLY in ${langName}.`;

  const parts = [
    { text: "=== Uploaded Diet Chart / Meal Sheet Image ===" },
    { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
    { text: prompt },
  ];

  try {
    const reply = await callGemini({ parts, temperature: 0.4, maxTokens: 1500 });
    return sanitizeScriptForLanguage(reply.trim(), user.language);
  } catch (err) {
    console.warn('Fallback OCRing diet chart image:', err.message);
    return `Here's your reviewed diet chart.\n\nEstimated target: ~${targetCalories} kcal | ~${macros.proteinGrams}g Protein.\n\nHit your daily protein target consistently and log your daily meals as you eat them!`;
  }
}

async function conductTimetableInterview({ currentTimetable, message, goal, activity, language, chatHistory, daysPerWeek, checkinTime, user }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const timetableStr = currentTimetable ? JSON.stringify(currentTimetable, null, 2) : 'none';
  const historyString = (chatHistory || []).map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  const coachCtx = user ? buildCoachContext(user) : '';

  const { formatSplitTemplateForPrompt } = require('../knowledge/splitTemplates');
  const splitBlock = daysPerWeek ? formatSplitTemplateForPrompt(activity, goal, daysPerWeek) : '';

  const prompt = `You are ShowUp, an elite, highly proactive human fitness coach and best friend texting on WhatsApp.
${coachCtx}
${splitBlock ? '\n' + splitBlock + '\n' : ''}
We are setting up the user's weekly workout timetable split, target muscle focus, and diet/allergy guidelines.

User's activity: "${activity}"
User's current goal: "${goal || 'not set yet'}"
Target number of workout days per week: ${daysPerWeek || 3}
User's check-in time: ${checkinTime || '08:00'}
User's existing food allergy: "${user?.allergy || 'not checked yet'}"
User's target muscle focus: "${user?.target_muscle || 'not set yet'}"

Current timetable structure:
${timetableStr}

Here is the recent chat history for context:
${historyString}

User message: "${message}"

INSTRUCTIONS (ACT LIKE AN EXPERT PROACTIVE HUMAN COACH):
1. Analyze the user's message and determine their primary goal if mentioned ("muscle_gain", "weight_loss", "cardio", "general").
2. Based on their goal, AUTOMATICALLY prescribe the target muscle focus and diet strategy without waiting for them to ask:
   - If a REQUIRED SPLIT STRUCTURE block is provided above, USE IT EXACTLY — assign its session focuses in order, one per workout day. Do not invent a different split.
   - Otherwise: For Muscle Gain, prescribe heavy compound splits scaled to the day count (never force a 3-way split into fewer days — e.g. 2 days/week is Upper/Lower, not a compressed Push/Pull/Legs). For Weight Loss, prescribe fat-burn cardio + full body muscle preservation splits. For Cardio/General, prescribe stamina & functional strength splits.
   - Prescribe high-protein nutrition guidance for Muscle Gain (e.g. 1.8g protein/kg, calorie surplus) or high-protein calorie deficit nutrition for Weight Loss.
3. Propose a weekly timetable (Monday through Sunday):
   - CRITICAL: Schedule MUST contain EXACTLY ${daysPerWeek || 3} workout days with specific muscle group focus (e.g., Saturday: Upper Body & Chest, Sunday: Lower Body & Glutes). All other days MUST be "Rest". Never more, never fewer than ${daysPerWeek || 3} workout days.
   - ALIGN WITH USER DAYS: If they specified weekends or specific days, place workouts on those exact days.
   - REST IS IMPORTANT RULE: If the user asks for 7 days or zero rest, educate them that muscles rebuild and grow during rest days, and prescribe 4-5 workout days + 2 rest days.
   - If they confirm the schedule (e.g. "looks good", "yes", "confirm", "perfect", "done"), set "confirmed" to true.
4. Check for food allergies or diet restrictions:
   - If user.allergy is not set yet or missing, PROACTIVELY ask in your message: "Do you have any food allergies (peanuts, dairy, gluten, or none) so I can tailor your diet guidance?"
5. RESPECT & TONE RULE (MANDATORY IN TAMIL/TANGLISH):
   - ALWAYS use respectful terms: "neenga", "unga", "ungalukku", "sollunga", "bro" / "Ji".
   - NEVER EVER use "Dei", "Da", "Di", "nee", "unakku", "unoda", or "podu".
6. Write a warm, encouraging, proactive coach response displaying their weekly split (in clean notebook style: Day 1 - Focus, Day 2 - Focus, etc.), target muscle focus, diet tip, and allergy check in ${langName}. Keep under 110 words.

Respond ONLY with strict JSON, no markdown fences:
{
  "goal": "muscle_gain"|"weight_loss"|"cardio"|"general",
  "target_muscle": "string (e.g. Chest & Upper Body, Legs & Glutes, Full Body)",
  "allergy": "string or null",
  "timetable": {
    "Monday": "string or Rest",
    "Tuesday": "string or Rest",
    "Wednesday": "string or Rest",
    "Thursday": "string or Rest",
    "Friday": "string or Rest",
    "Saturday": "string or Rest",
    "Sunday": "string or Rest"
  },
  "confirmed": boolean,
  "reply": "string (proactive human coach response displaying the table split, target muscle advice, diet tip, and allergy check in ${langName})"
}`;

  const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.2 });
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    if (parsed.reply) {
      parsed.reply = sanitizeScriptForLanguage(parsed.reply, language);
    }
    return parsed;
  } catch (err) {
    throw new GeminiError(`Could not parse timetable response: ${text}`);
  }
}

async function generateWorkoutReminder(user, focus) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);
  const timeStr = user.checkin_time || '07:00';
  const prompt = `You are ShowUp, an elite AI fitness coach texting ${user.name} on WhatsApp.
${coachCtx}

Scheduled workout session: "${focus}"
Scheduled time: ${timeStr}

Rules:
1. STRICT NO-EMOJIS RULE: 0 emojis.
2. Structure:
   Training today — ${timeStr}.

   ${focus}.

   [1 line contextual motivation referencing their weekly progress or program]

   Your session is ready. I will check in after your workout.

Reply ONLY in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (e) {
    return `Training today — ${timeStr}.\n\n${focus}.\n\nYour session is ready. I will check in after your workout.`;
  }
}

async function generateHydrationReminder(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const prompt = `You are ShowUp, a direct fitness coach.
Generate a very short, friendly hydration reminder for ${user.name} on WhatsApp (max 25 words) in ${langName}.
Remind them to drink a glass of water now.
STRICT ZERO EMOJIS RULE: Zero emojis.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (e) {
    return `Hydration check, ${user.name}. Grab a glass of water now. Aim for 3 to 4 liters today to keep your muscles hydrated and recovery on point.`;
  }
}

async function generateMealReminder(user, mealType = 'lunch') {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const prompt = `You are ShowUp, a direct fitness coach and nutritionist.
Generate a short, friendly meal reminder for ${user.name} for ${mealType} on WhatsApp (max 35 words) in ${langName}.
Remind them to get adequate protein (~${Math.round((user.weight || 70) * 1.8)}g daily target).
CRITICAL: explicitly tell them to reply with what they eat so it gets logged, so their calories and protein for the day are tracked.
STRICT ZERO EMOJIS RULE: Zero emojis.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (e) {
    return `Meal time, ${user.name}. Make sure your ${mealType} includes a solid protein source. Reply with what you ate so it's logged and your calories and protein for the day stay on track.`;
  }
}

async function generateMealFollowUpNudge(user, mealType = 'lunch') {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const prompt = `You are ShowUp, a direct fitness coach and nutritionist.
It's been an hour since you reminded ${user.name} about ${mealType}, and they still haven't logged what they ate.
Generate a short, friendly follow-up nudge on WhatsApp (max 30 words) in ${langName}.
CRITICAL: explicitly ask them to reply with what they ate for ${mealType} so it gets logged and their calories/protein for the day stay tracked.
STRICT ZERO EMOJIS RULE: Zero emojis.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (e) {
    return `Quick check, ${user.name} — did you have ${mealType} yet? Reply with what you ate so it gets logged and your calories and protein for today stay on track.`;
  }
}

async function generateNightlyFoodLogNudge(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const prompt = `You are ShowUp, a direct fitness coach and nutritionist.
${user.name} has meal reminders turned off and hasn't logged any food today.
Generate a short, friendly end-of-day nudge on WhatsApp (max 30 words) in ${langName}.
CRITICAL: explicitly ask them to reply with what they ate today so it gets logged and their calories/protein for the day are tracked, even though reminders are off.
STRICT ZERO EMOJIS RULE: Zero emojis.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (e) {
    return `Hey ${user.name}, noticed you haven't logged any food today. Reply with what you ate so it gets logged and your calories and protein for today are tracked.`;
  }
}

async function generateSleepRecoveryReminder(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const prompt = `You are ShowUp, a direct fitness coach.
Generate a short, warm nightly sleep reminder for ${user.name} on WhatsApp (max 30 words) in ${langName}.
Remind them to get 7-8 hours of quality sleep tonight for muscle recovery.
STRICT ZERO EMOJIS RULE: Zero emojis.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (e) {
    return `Night check, ${user.name}. 7-8 hours of deep sleep tonight is when your muscles rebuild and grow stronger. Wind down and get great rest.`;
  }
}

async function handleGeneralQuery(user, message) {
  const db = require('../db/db');
  const chatHistory = db.getChatMessages(user.id, 20);
  const historyString = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  
  const timetableStr = user.timetable ? JSON.stringify(JSON.parse(user.timetable), null, 2) : 'No timetable set';
  const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: require('../config').timezone }).format(new Date());
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);

  // Only pull in workout knowledge / search grounding when the question actually looks exercise-related —
  // most general queries (greetings, food, logistics) don't need it.
  const looksLikeWorkoutQuestion = /(exercise|workout|training|gym|muscle|reps|sets|form|routine|split|cardio|run|walk|cycl|strength|weight lift|injur|pain|sore)/i.test(message);
  const { lookupWorkoutKnowledge, formatKnowledgeForPrompt } = require('../knowledge/workoutKnowledgeBase');
  const kbEntry = looksLikeWorkoutQuestion ? lookupWorkoutKnowledge(user.activity, user.experience_level, user.days_per_week, user.goal) : null;
  const kbBlock = kbEntry ? formatKnowledgeForPrompt(kbEntry) : '';
  const useSearch = looksLikeWorkoutQuestion && !kbEntry;

  const prompt = `You are ShowUp, a warm, direct, no-BS fitness coach texting your friend ${user.name} on WhatsApp.
${coachCtx}
${kbBlock ? kbBlock + '\n' : ''}User message: "${message}"

Profile summary for your internal awareness:
- Name: ${user.name} | Activity: ${user.activity} | Goal: ${user.goal || 'general fitness'}
- Today: ${todayName} | Daily check-in time: ${user.checkin_time} | Streak: ${user.streak} days (Day ${user.day_count}/30)
- Location: ${user.workout_location || 'gym'} | Equipment: ${user.home_equipment || 'none'}
- Timetable: ${timetableStr}

INSTRUCTIONS:
1. ULTRA-SHORT, FRIENDLY & CRISP (CRITICAL): Keep answers very concise, friendly, and natural (max 25-45 words). 1-2 short sentences is ideal. ZERO emojis anywhere.
2. ANSWER WHAT THEY ACTUALLY SAID (CRITICAL): Respond directly to the user's message above, using the recent chat history for context. If the message is confused, unclear, or just "what?"/"huh?"/similar, ask them to clarify what they meant — do NOT change the subject to an unrelated rest-day check-in, training reminder, or generic "ready to train?" filler. Only use a generic greeting reply when the message is itself a genuine greeting with no other content (e.g. "hey", "hi").
3. WORKOUT / EXERCISE QUESTIONS: Format strictly in clean notebook style: "[1] Exercise Name - Sets×Reps".
4. OVERTRAINING / 7 DAYS / 2 HOURS / HARDCORE: If user mentions hardcore daily workouts or zero rest days, explain briefly that rest is when muscles grow, and prescribe 4-5 workout days + 2 rest days.
5. FOOD / DIET / CALORIE QUESTIONS: Give exact grams and calories briefly (e.g. 200g Chicken = ~330 kcal, 40g Protein).
6. PROACTIVE COMPLETION: Only if height/weight is missing AND the reply above doesn't already end on an open question, ask for it in 1 short line at the end.
${useSearch ? '7. No local reference data covers this activity/level — use Google Search to ground your answer in real, current exercise science.' : ''}

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7, useSearch });
  return sanitizeScriptForLanguage(text.trim(), user.language);
}

/**
 * Pro-tier voice chat: transcribes a recorded voice message and replies as the coach,
 * in one call. Gemini accepts audio the same way it accepts images — as an inline_data
 * part — so this reuses the same multimodal call shape as the photo-based flows.
 * Returns both the transcription (saved as the user's chat message, since we only
 * ever received audio bytes) and the coach's reply text.
 */
async function transcribeAndRespondToVoice({ user, audioBase64, mimeType }) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);
  const db = require('../db/db');
  const chatHistory = db.getChatMessages(user.id, 20);
  const historyString = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';

  const prompt = `You are ShowUp, a warm, direct, no-BS fitness coach. The user sent you a VOICE MESSAGE instead of typing — listen to the attached audio and respond as if they'd texted it.
${coachCtx}

Recent chat history:
${historyString}

Task:
1. Transcribe exactly what the user said in the audio (their original spoken language — do not translate the transcription itself).
2. Reply to them as their coach, following the same rules as any other message: ultra-short, friendly, max 25-45 words, zero emojis, notebook-style formatting for any workout/exercise content.

Respond ONLY with a valid JSON object, no markdown fences:
{
  "transcription": "exact transcription of what they said",
  "reply": "your coach reply in ${langName}"
}`;

  const parts = [
    { text: "=== Voice Message Audio ===" },
    { inline_data: { mime_type: mimeType || 'audio/aac', data: audioBase64 } },
    { text: prompt },
  ];

  try {
    const text = await callGemini({ parts, jsonMode: true, temperature: 0.5, maxTokens: 600 });
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      transcription: parsed.transcription || '(voice message)',
      reply: sanitizeScriptForLanguage((parsed.reply || '').trim(), user.language),
    };
  } catch (err) {
    console.error('[Gemini] transcribeAndRespondToVoice failed:', err.message);
    return {
      transcription: '(voice message)',
      reply: "Sorry, I couldn't quite catch that — could you try sending it again, or type it instead?",
    };
  }
}

// ── Memory layer Gemini functions ──

async function extractProfileFacts(user, message) {
  const db = require('../db/db');
  const existingProfile = db.getProfileJson(user.id);
  const existingStr = JSON.stringify(existingProfile);

  const prompt = `You are a memory extraction engine for a fitness coaching bot.
The user just sent a message. Extract any durable facts worth remembering long-term.

Existing profile memory:
${existingStr}

User message:
"${message}"

User context: Name=${user.name}, Activity=${user.activity}, Goal=${user.goal || 'not set'}

Rules:
1. Extract facts into these categories: goals, injuries_or_limits, allergies_or_diet_restrictions, past_blockers, milestones, preferences (message_length, tone_that_lands, notes).
2. NEVER silently drop existing facts. Only update/overwrite when the new message clearly contradicts or updates (e.g. "knee's fine now" → mark resolved, don't delete).
3. For injuries that are resolved, set them as { "injury": "...", "status": "resolved", "resolved_date": "today" } rather than removing.
4. If the message contains nothing durable (just "ok", "done", daily noise), return the existing profile unchanged.
5. Keep all values concise (single phrases, not sentences).

Respond ONLY with the complete updated profile JSON, no markdown fences:
{
  "goals": ["..."],
  "injuries_or_limits": ["..."],
  "allergies_or_diet_restrictions": ["..."],
  "past_blockers": ["..."],
  "milestones": ["..."],
  "preferences": {
    "message_length": "short|medium|long",
    "tone_that_lands": "e.g. humor, tough-love, gentle",
    "notes": "free text"
  }
}`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.1 });
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    db.updateProfileJson(user.id, parsed);
    return parsed;
  } catch (err) {
    console.error('[Memory] extractProfileFacts failed:', err.message);
    return existingProfile;
  }
}

async function generateDailySummary(userId, date, chatMessages, existingProfileJson) {
  const db = require('../db/db');
  const user = db.getUserById(userId);
  if (!user) return null;

  const messagesStr = chatMessages.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n');
  const profileStr = JSON.stringify(existingProfileJson);

  const prompt = `You are a summarization engine for a fitness coaching bot.

User: ${user.name} (Activity: ${user.activity}, Goal: ${user.goal || 'general'})
Date: ${date}

Existing profile memory:
${profileStr}

Today's full conversation:
${messagesStr}

Do TWO things:
1. SUMMARIZE today's conversation in 1-2 concise lines capturing what happened (workout done? mood? topics discussed?).
2. FOLLOW-UP JUDGMENT: Did the user mention anything worth checking back on in 2-3 days? Examples: soreness/pain, an upcoming exam or stressful event, a specific goal deadline, trying a new exercise for the first time, emotional struggle. If yes, set follow_up_worthy=true and suggest a follow_up_date (YYYY-MM-DD, typically 2-3 days from ${date}).
3. PROFILE UPDATES: Extract any new durable facts from today's conversation that aren't already in the profile. Same merge rules as profile extraction — never drop existing facts.

Respond ONLY with strict JSON, no markdown fences:
{
  "summary": "string (1-2 lines)",
  "follow_up_worthy": boolean,
  "follow_up_date": "YYYY-MM-DD or null",
  "profile_updates": { ...updated profile JSON or null if no changes }
}`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.2 });
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Memory] generateDailySummary failed:', err.message);
    return null;
  }
}

async function extractPersonalizationSignals(userId, weekMessages, checkinResults, existingPreferences) {
  const db = require('../db/db');
  const user = db.getUserById(userId);
  if (!user) return existingPreferences;

  const messagesStr = weekMessages.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n');
  const checkinsStr = checkinResults.map(c => `${c.date}: status=${c.status}, description="${c.description || ''}"`).join('\n');
  const prefsStr = JSON.stringify(existingPreferences);

  const prompt = `You are a personalization engine for a fitness coaching bot.

User: ${user.name}
This week's conversation:
${messagesStr}

This week's check-in results:
${checkinsStr}

Current preferences:
${prefsStr}

Analyze patterns:
1. Message length that gets engagement: Did short check-in prompts get faster/better replies than long ones?
2. Nudge phrasing that correlates with completed check-ins vs missed ones.
3. Tone that gets warmer responses (humor landing vs falling flat).

Return updated preferences. Only change what the data supports — don't invent signals without evidence.

Respond ONLY with strict JSON, no markdown fences:
{
  "message_length": "short|medium|long",
  "tone_that_lands": "string describing what works",
  "notes": "any other observations worth remembering"
}`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.2 });
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Memory] extractPersonalizationSignals failed:', err.message);
    return existingPreferences;
  }
}

async function generateFollowUpNudge(user, originalSummary, profileJson) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const profileStr = JSON.stringify(profileJson);

  const prompt = `You are ShowUp, a warm, direct fitness coach.
You need to check in on something the user mentioned a few days ago.

User: ${user.name}
Original day summary that triggered this follow-up: "${originalSummary}"
User's profile memory: ${profileStr}

Generate a SHORT, natural, caring follow-up message in ${langName}.
Bring it up warmly mid-conversation style — like a real coach who remembered ("hey, how's that knee doing?"), NOT like a database notification.
Keep it under 30 words. One sentence, maybe two max.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.8 });
    return text.trim();
  } catch (err) {
    console.error('[Memory] generateFollowUpNudge failed:', err.message);
    return null;
  }
}

/**
 * Dynamic Q&A during AWAITING_PAYMENT state:
 * Answers user questions about terms & conditions, refundable deposit, platform fee,
 * 2 free strikes, slip penalties, 14-day free trial, and differences between
 * Standard (₹119/mo) and Pro (₹239/mo) plans.
 */
async function answerPaymentAndTermsQuery({ user, message, history }) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const historyString = (history || []).map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.text}`).join('\n') || '(no prior history)';
  const coachCtx = user ? buildCoachContext(user) : '';

  const prompt = `You are ShowUp, a direct, friendly fitness coach on WhatsApp.
The user is currently at the payment / pledge lock-in step of onboarding. They are asking a question about the plans, terms, deposit, pricing, differences between plans, or where we left off.
${coachCtx}

=== SHOWUP PRICING & TERMS MASTER REFERENCE ===
1. 🎁 14-Day Free Trial: First 14 days have ZERO subscription charges. Users pay only a ₹300 refundable deposit to lock in.
2. 💰 Refundable Deposit: ₹300 (${config.depositAmountInr} INR).
3. ⚙️ Platform Fee: ₹30 (${config.platformFeeInr} INR) charged for platform administration and server infrastructure, leaving a base refund pool of ₹270 (${config.fullPayoutInr} INR).
4. 🛡️ 2 Free Strikes Grace Rule: If the user's committed schedule has >10 workout days in the month (e.g. 3+ days/week), they get 2 FREE STRIKES (first 2 missed workouts incur ₹0 penalty!).
5. ⚠️ Slip Penalty: Beyond free strikes, each missed workout deducts ₹50 (${config.slipPenaltyInr} INR) from their ₹270 refund balance (floored at ₹0).
6. 📋 Basic Plan vs Pro Plan (Starting Month 2):
   - Basic Plan (₹129/month base):
     * Includes daily reminders, check-in verification (photo proof), AI nutrition plan, doubt clearing / general Q&A.
     * Consistency Discount: 0 misses during the pledge earns a ₹10 discount (₹119/month!).
   - Pro Plan (₹239/month base):
     * Includes EVERYTHING in Basic + diet logging, calorie tracking, burn logs, exercise deep-dives, performance tracking, and detailed progress analytics.
     * Consistency Discount: 0 misses during the pledge earns a ₹10 discount (₹229/month!).

=== USER CONTEXT ===
Name: ${user.name || 'Friend'}
Language Preference: ${langName}
Committed Activity: ${user.activity || 'Gym'} (${user.days_per_week || 4} days/week at ${user.checkin_time || '07:00'})
Blocker: "${user.blocker_text || 'laziness'}"
Vision: "${user.vision_text || 'muscle gain'}"
Selected Plan: ${user.tier || 'free'}

Recent Chat History:
${historyString}

User's Latest Message: "${message}"

INSTRUCTIONS:
1. Answer the user's question clearly, accurately, and respectfully in their language (${langName}).
   - STRICT TONAL RULE: ALWAYS treat the user with utmost respect ("neenga", "unga", "ungalukku", "sollunga", "pannunga"). NEVER use "Dei", "Dey", "Da", "Di", "nee", "unakku", "unoda", or "podu".
   - If they ask in Tanglish ('tl'), respond in casual, respectful Tanglish using English/Latin alphabet.
   - If they ask in Hinglish ('hl'), respond in casual, respectful Hinglish using English/Latin alphabet.
   - If they ask about the difference between Basic (₹129) and Pro (₹239) plans, clearly explain that Basic is ₹129 (reminders, verification, AI nutrition plan, doubt clearing), while Pro is ₹239 (adds diet logging, calorie tracking, burn logs, exercise deep-dives, performance tracking, and progress analytics). Mention both get a ₹10/mo consistency discount for zero misses (Basic becomes ₹119, Pro becomes ₹229).
   - If they ask about terms/deposit/strikes, explain the ₹300 deposit, ₹30 fee (₹270 base refund), 2 free strikes for >10 days, and ₹50 penalty.
2. Keep your answer friendly, respectful, and conversational (max 90 words).
3. Always wrap up by reminding them that replying "paid" after paying the ₹300 deposit starts their 14-day free trial and 30-day pledge.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.5 });
    return sanitizeScriptForLanguage(text.trim(), user ? user.language : 'en');
  } catch (err) {
    console.error('[Gemini] answerPaymentAndTermsQuery error:', err);
    return null;
  }
}

/**
 * Parses a fitness app screenshot (Strava, Apple Health, Samsung Health, Garmin, etc.)
 * and extracts the activity data for running, walking, or cycling verification.
 */
async function parseFitnessAppScreenshot({ imageBase64, mimeType, activityType, todayDate }) {
  const prompt = `You are a fitness data extraction engine. The user is trying to check in their ${activityType} session by uploading a screenshot from their fitness tracking app.

Today's date is: ${todayDate}

Look at the attached screenshot carefully and extract the following data:

IMPORTANT RULES:
1. Only accept screenshots from legitimate fitness tracking apps: Strava, Apple Fitness / Apple Health, Samsung Health, Garmin Connect, Nike Run Club, Google Fit, Fitbit, or similar fitness trackers.
2. Reject if it's NOT a fitness app screenshot (random photo, AI-generated, stock image, gym selfie, etc.)
3. Reject if the activity type in the screenshot doesn't match "${activityType}" (e.g., cycling screenshot for a runner)
4. Reject if the activity date shown is more than 1 day before today (${todayDate}) — old screenshots are not valid
5. For walking: minimum 500m distance to count. For running: minimum 500m. For cycling: minimum 1km.

Extract and return:
- detected_app: which app is this screenshot from (strava/apple_health/samsung_health/garmin/nike_run_club/google_fit/fitbit/other)
- activity_type: what activity is shown (running/walking/cycling/unknown)
- distance_km: distance in km (convert from miles if needed, e.g. 1.86mi = 2.99km). Return as a decimal number.
- duration_minutes: total time in minutes as a decimal (e.g. 32:15 = 32.25)
- pace_min_per_km: pace in minutes per km as a decimal (e.g. "5'30"/km" = 5.5). For cycling, derive from speed if needed.
- speed_kmh: speed in km/h (mainly for cycling)
- calories: calories burned if shown, otherwise null
- activity_date: the date of the activity shown in the screenshot as YYYY-MM-DD. If only day/time shown, infer date. If unclear, return null.
- is_valid: true if this is a valid, real fitness app screenshot for ${activityType} from today or yesterday
- reject_reason: if not valid, explain why in one short sentence. Otherwise null.

Respond ONLY with strict JSON, no markdown fences:
{
  "detected_app": string,
  "activity_type": string,
  "distance_km": number|null,
  "duration_minutes": number|null,
  "pace_min_per_km": number|null,
  "speed_kmh": number|null,
  "calories": number|null,
  "activity_date": string|null,
  "is_valid": boolean,
  "reject_reason": string|null
}`;

  const parts = [
    { text: prompt },
    { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
  ];

  const text = await callGemini({ parts, jsonMode: true, temperature: 0.1 });
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      detected_app: parsed.detected_app || 'unknown',
      activity_type: parsed.activity_type || activityType,
      distance_km: parsed.distance_km || null,
      duration_minutes: parsed.duration_minutes || null,
      pace_min_per_km: parsed.pace_min_per_km || null,
      speed_kmh: parsed.speed_kmh || null,
      calories: parsed.calories || null,
      activity_date: parsed.activity_date || null,
      is_valid: Boolean(parsed.is_valid),
      reject_reason: parsed.reject_reason || null,
    };
  } catch (err) {
    throw new GeminiError(`Could not parse fitness screenshot response: ${text}`);
  }
}

/**
 * Generates a casual, context-aware coach message after a cardio check-in.
 * Handles single-activity and multi-activity plans (e.g. running + cycling).
 */
async function generateCardioCoachFeedback({
  user,
  detectedActivity,
  todaySession,
  weekSessions,
  weeklyGoalSessions,
  weeklyGoalDistanceKm,
  recentPaces,
  otherActivitiesProgress,
  suggestGoalUpgrade,
  language,
}) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const activity = detectedActivity || user.activity || 'running';
  const name = user.name || 'bro';

  const weekDone = weekSessions.length;
  const weekRemaining = Math.max(0, weeklyGoalSessions - weekDone);
  const isForCycling = activity === 'cycling';

  let paceContext = '';
  if (recentPaces && recentPaces.length >= 2 && todaySession.pace_min_per_km) {
    const avgRecentPace = recentPaces.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(recentPaces.length, 3);
    const paceImprovement = avgRecentPace - todaySession.pace_min_per_km;
    if (paceImprovement > 0.15) {
      paceContext = `Pace improvement: average was ${avgRecentPace.toFixed(1)} min/km recently, today is ${todaySession.pace_min_per_km.toFixed(1)} min/km — ${paceImprovement.toFixed(1)} min/km faster!`;
    } else if (paceImprovement < -0.15) {
      paceContext = `Pace a bit slower today (${todaySession.pace_min_per_km.toFixed(1)} min/km) vs recent average (${avgRecentPace.toFixed(1)} min/km). Happens, no biggie.`;
    } else {
      paceContext = `Pace consistent at around ${todaySession.pace_min_per_km.toFixed(1)} min/km.`;
    }
  }

  let otherActivitiesContext = '';
  if (otherActivitiesProgress && otherActivitiesProgress.length > 0) {
    otherActivitiesContext = '\nOther activities this week:\n' +
      otherActivitiesProgress.map(a => `- ${a.activity}: ${a.done}/${a.goal} sessions done`).join('\n');
  }

  const prompt = `You are ShowUp, a casual, warm, no-BS personal fitness coach texting ${name} on WhatsApp. They just logged a ${activity} session.

Their weekly ${activity} goal: ${weeklyGoalDistanceKm}km per session, ${weeklyGoalSessions} ${activity} sessions/week.

Today's ${activity} session:
- Distance: ${todaySession.distance_km ? todaySession.distance_km.toFixed(2) + 'km' : 'unknown'}
- Duration: ${todaySession.duration_minutes ? Math.floor(todaySession.duration_minutes) + 'min' : 'unknown'}
- ${isForCycling ? 'Speed/Pace' : 'Pace'}: ${todaySession.pace_min_per_km ? todaySession.pace_min_per_km.toFixed(1) + ' min/km' : 'unknown'}
- Calories: ${todaySession.calories ? todaySession.calories + ' kcal' : 'unknown'}

This week's ${activity} progress: ${weekDone}/${weeklyGoalSessions} sessions done. ${weekRemaining > 0 ? `${weekRemaining} more to go this week.` : '🎯 Weekly goal complete!'}

${paceContext}
${otherActivitiesContext}
${suggestGoalUpgrade ? `IMPORTANT: They've consistently hit their ${weeklyGoalDistanceKm}km goal 2 weeks in a row. Suggest bumping the distance target (e.g. to ${(weeklyGoalDistanceKm + 0.5).toFixed(1)}km) — ask casually at the end.` : ''}

Write a very short, friendly message (max 35-45 words) as a supportive coach:
1. React specifically to today's ${activity} — distance, pace, or calories.
2. If distance < ${(weeklyGoalDistanceKm * 0.85).toFixed(1)}km: encourage them gently.
3. If distance >= ${(weeklyGoalDistanceKm * 0.85).toFixed(1)}km: acknowledge the solid effort.
4. Show weekly progress briefly ("${weekDone}/${weeklyGoalSessions} done").
5. Suggest goal upgrade casually if flagged.

STYLE: Very short, punchy, supportive, and natural. STRICT ZERO EMOJIS. Respectful forms in Tamil/Tanglish (use "neenga", "bro", never "da"/"dei").

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.85 });
  return sanitizeScriptForLanguage(text.trim(), language);
}

/**
 * Stage 10: Generates the specific Day 1 workout or schedule kickoff tailored to the user.
 */
async function generateDay1Workout(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);
  const scheduleService = require('./scheduleService');
  const config = require('../config');
  const today = require('../utils/date').todayStr(config.timezone);
  const weekday = scheduleService.getDayName(today, config.timezone);
  const effectiveToday = scheduleService.getEffectiveWorkoutForDate(user, today, config.timezone);

  let timetable = {};
  try {
    timetable = user.timetable ? JSON.parse(user.timetable) : {};
  } catch (e) {
    timetable = {};
  }

  // Determine next workout day if today is a rest day
  const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const todayIdx = DAYS_ORDER.indexOf(weekday);
  let nextWorkoutDay = null;
  let nextFocus = null;

  if (effectiveToday.isWorkout) {
    nextWorkoutDay = weekday;
    nextFocus = effectiveToday.focus;
  } else {
    for (let i = 1; i <= 7; i++) {
      const idx = (todayIdx + i) % 7;
      const dayName = DAYS_ORDER[idx];
      const dayFocus = timetable[dayName];
      if (dayFocus && dayFocus.toLowerCase() !== 'rest') {
        nextWorkoutDay = dayName;
        nextFocus = dayFocus;
        break;
      }
    }
  }

  const { lookupWorkoutKnowledge, formatKnowledgeForPrompt } = require('../knowledge/workoutKnowledgeBase');
  const kbEntry = lookupWorkoutKnowledge(user.activity, user.experience_level, user.days_per_week, user.goal);
  const kbBlock = kbEntry ? formatKnowledgeForPrompt(kbEntry) : '';
  const useSearch = !kbEntry;

  const prompt = `You are ShowUp, an elite AI fitness coach delivering Day 1 kickoff of training.
${coachCtx}
${kbBlock ? '\n' + kbBlock + '\n' : ''}
User Profile:
- Name: ${user.name}
- Activity: ${user.activity || 'gym'}
- Goal: ${user.goal || 'lean muscle gain'}
- Experience: ${user.experience_level || 'beginner'}
- Location/Equipment: ${user.workout_location || 'gym'} (${user.home_equipment || 'none'})
- Training Time: ${user.checkin_time || '07:00'}
- Injuries/Limitations: ${user.injuries || 'none'}
- Today's Day: ${weekday} (${effectiveToday.isWorkout ? 'Scheduled Workout Day: ' + (effectiveToday.focus || 'Training Session') : 'Scheduled Rest Day'})
- Next Workout Day: ${nextWorkoutDay || 'upcoming session'} (${nextFocus || 'Scheduled Routine'})
- Weekly Timetable: ${JSON.stringify(timetable)}

Task: Deliver the Day 1 welcome message and workout context.
Rules:
1. STRICT NO-EMOJIS RULE: 0 emojis.
2. Structure:
   ${effectiveToday.isWorkout ? `
   You are set. Today is Day 1 (${weekday}).

   ${user.checkin_time || '07:00'} -- ${effectiveToday.focus || 'Foundation Session'}

   [Clean notebook routine formatted with [1], [2], [3] Exercise Name - Sets×Reps OR cardio pace/target]

   I will send your workout before training and ask you to log your results afterward.

   Your first job: show up.
   ` : `
   You are set. Today (${weekday}) is a Rest & Recovery Day in your weekly schedule.

   Your first scheduled training session is on ${nextWorkoutDay} at ${user.checkin_time || '07:00'} -- ${nextFocus || 'Starting Session'}.

   Here is a preview of your first session (${nextFocus}):
   [Clean notebook routine formatted with [1], [2], [3] Exercise Name - Sets×Reps OR cardio pace/target]

   I will send your workout reminder the evening before ${nextWorkoutDay}. (If you want to train today instead, just tell me and I will log it for today!)

   Your first job: rest up and get ready for ${nextWorkoutDay}.
   `}
${useSearch ? '3. No local reference data was found for this activity/level — use Google Search to ground the routine in real, current exercise science.' : ''}

Reply ONLY in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6, useSearch });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.warn('Fallback generating Day 1 workout:', err.message);
    const act = user.activity || 'workout';
    const time = user.checkin_time || '07:00';
    if (!effectiveToday.isWorkout && nextWorkoutDay) {
      return `You are set. Today (${weekday}) is a Rest Day in your schedule.\n\nYour first scheduled training session is on ${nextWorkoutDay} at ${time} -- ${nextFocus || 'Foundation Session'}.\n\nI will send your workout reminder the evening before ${nextWorkoutDay}.\n\nYour first job: rest up and get ready for ${nextWorkoutDay}!`;
    }
    if (act === 'running') {
      return `You are set. Today is Day 1.\n\n${time} -- Aerobic Base Run\n\n[1] Outdoor Easy Run - 3.0km Zone 2 Pace\n[2] Post-Run Core & Mobility - 10 Mins\n\nI will send your workout before training and ask you to log your results afterward.\n\nYour first job: show up.`;
    } else if (act === 'cycling') {
      return `You are set. Today is Day 1.\n\n${time} -- Aerobic Base Ride\n\n[1] Outdoor Steady Ride - 12.0km Zone 2 Pace\n[2] Post-Ride Stretching - 10 Mins\n\nI will send your workout before training and ask you to log your results afterward.\n\nYour first job: show up.`;
    } else if (act === 'walking') {
      return `You are set. Today is Day 1.\n\n${time} -- Brisk Foundation Walk\n\n[1] Brisk Walk - 4,000 Steps\n[2] Lower Body Mobility - 5 Mins\n\nI will send your workout before training and ask you to log your results afterward.\n\nYour first job: show up.`;
    } else if (act === 'home_workout') {
      return `You are set. Today is Day 1.\n\n${time} -- Full Body Calisthenics\n\n[1] Push-Ups - 3×10-12\n[2] Bodyweight Squats - 3×15\n[3] Plank - 3×30s\n\nI will send your workout before training and ask you to log your results afterward.\n\nYour first job: show up.`;
    }
    return `You are set. Today is Day 1.\n\n${time} -- Full Body Hypertrophy\n\n[1] Barbell Bench Press - 3×8-10\n[2] Barbell Back Squat - 3×8-10\n[3] Lat Pulldown - 3×10\n\nI will send your workout before training and ask you to log your results afterward.\n\nYour first job: show up.`;
  }
}

/**
 * Sent once, right after the full setup (nutrition plan confirmed + Day 1 delivered) —
 * an honest reality check on what their chosen frequency can and can't do, and what's
 * realistically achievable with consistency, referencing the timeframe they set for
 * themselves during onboarding (goal_timeframe).
 */
async function generateRealisticExpectationsMessage(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);

  const { lookupWorkoutKnowledge } = require('../knowledge/workoutKnowledgeBase');
  const kbEntry = lookupWorkoutKnowledge(user.activity, user.experience_level, user.days_per_week, user.goal);
  const kbNote = kbEntry
    ? (kbEntry.kind === 'strength'
        ? `Their prescribed split: ${kbEntry.days.length}-day ${kbEntry.days.map(d => d.focus).join('/')} at ${kbEntry.repScheme.setsReps}.`
        : `Their prescribed plan: ${kbEntry.split}.`)
    : '';

  const prompt = `You are ShowUp, an honest, direct AI fitness coach. The user has just finished onboarding — their plan, split, and nutrition are all set up. Before they start, give them ONE honest, grounded reality check about what their specific setup can and can't do.
${coachCtx}

User's setup:
- Activity: ${user.activity || 'gym'} | Goal: ${user.goal || 'general fitness'} | Experience: ${user.experience_level || 'beginner'}
- Training frequency: ${user.days_per_week || 3} days/week
- Their own stated target timeframe: ${user.goal_timeframe || 'not specified'}
${kbNote}

Task: Write ONE short, honest message covering, in this order:
1. A direct, non-discouraging statement that ${user.days_per_week || 3} days/week means realistic progress takes patience and consistency — it will not be as fast as training more often, and skipping sessions will push the timeline out further. Do not be harsh or demotivating — be honest like a coach who respects them enough to not sugarcoat it.
2. What IS realistically achievable with their frequency if they stay consistent, in relation to the timeframe they stated (${user.goal_timeframe || 'their target'}) — be specific to their goal (e.g. what visible/measurable progress looks like at that point), not vague encouragement.
3. One sentence reinforcing that consistency at their chosen frequency beats sporadic higher frequency — showing up for every one of their ${user.days_per_week || 3} sessions matters more than the number itself.

Rules:
1. STRICT NO-EMOJIS RULE: 0 emojis.
2. Keep it concise — 60-90 words. No headers, no bullet lists — a short, direct, human paragraph or two.
3. Do not ask a question at the end — this is a statement, not a prompt for a reply.

Reply ONLY in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.5, maxTokens: 500 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.error('[Gemini] generateRealisticExpectationsMessage failed:', err.message);
    return `Quick honesty check: ${user.days_per_week || 3} days a week means real progress takes patience — it won't be as fast as training more often, and that's fine. Stay consistent with every one of your ${user.days_per_week || 3} sessions and you will see real, measurable progress toward your goal. Consistency at this frequency beats sporadic effort at a higher one — every time.`;
  }
}

/**
 * Diagnostic & empathetic feedback when a user reports why they missed a workout.
 */
async function generateMissedWorkoutFollowup(user, reason) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);
  const prompt = `You are ShowUp, an empathetic, solution-oriented AI fitness coach texting ${user.name} on WhatsApp.
${coachCtx}
The user missed their scheduled workout today.
User-reported reason: "${reason || 'no response'}"

Rules:
1. STRICT NO-EMOJIS RULE: Zero emojis.
2. Direct, empathetic coaching:
   - Remind them: "One missed workout does not matter. Repeated misses do."
   - If they reported "time" / schedule conflicts: Offer to adjust their training time or schedule.
   - If they reported "energy" / "fatigue" / "sleep": Emphasize recovery, hydration, and sleep.
   - If they reported "motivation": Remind them of their core commitment: "${user.commitment_text || user.vision_text || 'their 30-day goals'}".
   - Keep under 70 words. Re-align for tomorrow.

Reply ONLY in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    return `One missed workout does not break progress. Repeated misses do.\n\nWe will adjust your schedule to make tomorrow frictionless. Rest up and let's lock in tomorrow at ${user.checkin_time || 'your scheduled time'}.`;
  }
}

/**
 * Generates post-workout progress feedback reinforcing competence.
 */
async function generateProgressFeedback(user, details) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);
  const prompt = `You are ShowUp, an elite AI fitness coach acknowledging a completed workout for ${user.name}.
${coachCtx}
Workout details logged: "${details || 'Workout completed'}"
Streak: ${user.streak || 1} days

Rules:
1. STRICT NO-EMOJIS RULE: Zero emojis.
2. Structure:
   Workout logged.

   [Short acknowledgment of specific lift/exercise or distance]
   You progressed. ${user.streak || 1}-day streak.

   Next session I will adjust your target based on today's performance.

Reply ONLY in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    return `Workout logged.\n\nYou progressed. ${user.streak || 1}-day streak.\n\nNext session I will adjust your target based on today's performance.`;
  }
}

module.exports = {
  callGeminiRaw: callGemini,
  GeminiError,
  acknowledgeAnswer,
  verifyCheckin,
  evaluateFollowup,
  conductOnboardingInterview,
  classifyIntent,
  parseDietLog,
  parseBurnedCalories,
  parseMealReminderTimes,
  parseMealReminderUpdate,
  getExerciseSuggestions,
  getDietSuggestions,
  generateDietDeviationGuidance,
  conductTimetableInterview,
  generateWorkoutReminder,
  generateHydrationReminder,
  generateMealReminder,
  generateMealFollowUpNudge,
  generateNightlyFoodLogNudge,
  generateSleepRecoveryReminder,
  handleGeneralQuery,
  transcribeAndRespondToVoice,
  buildCoachContext,
  extractProfileFacts,
  generateDailySummary,
  extractPersonalizationSignals,
  generateFollowUpNudge,
  answerPaymentAndTermsQuery,
  parseFitnessAppScreenshot,
  generateCardioCoachFeedback,
  generateDay1Workout,
  generateRealisticExpectationsMessage,
  generateMissedWorkoutFollowup,
  generateProgressFeedback,
  generateTailoredNutritionPlan,
  parseUserProvidedDietPlan,
  parseDietChartImage,
  refineNutritionPlan,
  LANGUAGE_NAMES,
};
