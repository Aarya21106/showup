const axios = require('axios');
const config = require('../config');

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

class GeminiError extends Error {}

async function callGemini({ parts, jsonMode, temperature, maxTokens }) {
  if (!config.geminiConfigured) {
    throw new GeminiError('GEMINI_API_KEY is not set');
  }

  const generationConfig = {
    temperature: temperature ?? 0.6,
    maxOutputTokens: maxTokens ?? 800,
  };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';

  let retries = 3;
  let delay = 2000;

  while (retries > 0) {
    try {
      const res = await axios.post(
        ENDPOINT(config.gemini.model),
        {
          contents: [{ role: 'user', parts }],
          generationConfig,
        },
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

const LANGUAGE_NAMES = { en: 'English', ta: 'Tamil', hi: 'Hindi', tl: 'Tanglish (Tamil language written using the English/Latin alphabet)' };

const RESPECT_AND_TONE_RULES = `
=== MANDATORY RESPECT, CLARITY & TONE RULES (CRITICAL) ===
1. STRICT NO-EMOJIS RULE: You are strictly FORBIDDEN from using emojis anywhere in your response. No emojis of any kind (no emojis like fire, muscle, flex, party, trophy, smileys, food icons, etc.). Keep all responses 100% clean, professional, and emoji-free.
2. ALWAYS use clean, pointed, easy-to-read bullet points ('• ' or '- ') for suggestions, tips, instructions, and breakdowns. Keep advice simple and directly readable.
3. ALWAYS treat the user with utmost respect, warmth, encouragement, and high regard.
4. ABSOLUTELY FORBIDDEN IN TAMIL & TANGLISH:
   - NEVER EVER use disrespectful, casual, or rude call words like "Dei", "Dey", "Da", "Di", "Elay".
   - NEVER EVER use singular/informal pronouns or verbs: "nee" / "நீ", "unakku" / "உனக்கு", "unoda" / "un" / "உன்னுடைய", "yosi", "sollu", "pannu", "podu", "vaa".
5. ALWAYS USE RESPECTFUL FORMS IN TAMIL & TANGLISH:
   - Pronouns: ALWAYS use "neenga" / "நீங்கள்" (or "[Name] bro" / "Bro" / "Ji").
   - Possessive: ALWAYS use "unga" / "ungaloda" / "உங்கள்".
   - Objective: ALWAYS use "ungalukku" / "உங்களுக்கு".
   - Verbs: ALWAYS use polite respectful endings: "yosinga", "sollunga", "pannunga", "podunga", "vaanga", "paarkalaam", "mudiyum".
6. IN ENGLISH / HINDI / HINGLISH:
   - Maintain a respectful, crisp, clean, and motivating tone.
`;

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
      ctx += `- Height: ${user.height ? `${user.height} cm` : 'Not set yet (PROACTIVELY ASK USER)'}\n`;
      ctx += `- Weight: ${user.weight ? `${user.weight} kg` : 'Not set yet (PROACTIVELY ASK USER)'}\n`;
      if (bmiData) ctx += `- BMI: ${bmiData.bmi} (${bmiData.category})\n`;
      ctx += `- Daily Target Calories: ${targetCals} kcal/day (${user.goal === 'weight_loss' ? 'Deficit' : 'Surplus/Hypertrophy'})\n`;
      ctx += `- Recommended Daily Macros: Protein ~${macros.proteinGrams}g, Carbs ~${macros.carbsGrams}g, Fat ~${macros.fatGrams}g\n`;
      ctx += `- Preferred Cuisine / Region: ${user.cuisine_region || 'Not set yet (PROACTIVELY ASK USER: e.g. South Indian / Tamil Nadu, North Indian, Western)'}\n`;
      ctx += `- Registered Food Allergies: ${user.allergy || 'None recorded'}\n`;
      ctx += `- Target Muscle Focus: ${user.target_muscle || 'General / Full Body'}\n`;
    }

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

  const isCardioUser = user && ['running', 'walking', 'cycling'].includes(user.activity);

  return `\n--- COACH MEMORY & HEALTH METRICS ---${ctx}\n${RESPECT_AND_TONE_RULES}\n--- END MEMORY & METRICS ---\n\nCRITICAL HUMAN COACHING RULES:
- You are an expert personal trainer & fitness coach.
${isCardioUser ? `- CARDIO COACHING PRIORITY:
  * You are primarily a cardio coach for ${user?.activity}. Focus on distance, pace, weekly sessions, and consistency.
  * If the user asks about their progress: reference the cardio data above (sessions this week, pace trend, weekly goal).
  * Track and celebrate pace improvements. If pace is improving, call it out!
  * If they haven't hit their weekly session count yet, remind them how many more they need.
  * If they've been consistently hitting goals for 2 weeks: suggest bumping up the distance target.
  * Keep tone casual and friendly — like a running buddy who's also their coach.` : `- PROACTIVE PROFILE COMPLETION RULES:
  1. If user's height or weight is missing, ask for their height (cm) and weight (kg) so you can compute their BMI and daily calorie budget!
  2. If user's cuisine/region preference is missing, ask for their preferred cuisine (e.g. South Indian / Tamil Nadu, North Indian, etc.)!
  3. If user's food allergies are missing, ask if they have any food allergies (peanuts, dairy, gluten, or none).
- FOOD & PORTION CALORIE CALCULATIONS:
  * Whenever the user asks about ANY food item or dish (e.g., biryani, dosa, chicken, rice, pizza, eggs, etc.) or asks "how much biryani can I eat now?":
  * ALWAYS state the EXACT PORTION WEIGHT IN GRAMS or realistic servings (e.g. 1 plate / 250g Chicken Biryani).
  * ALWAYS state the exact Calories and Macros (Protein, Carbs, Fat) for that portion!
  * ALWAYS tell them how much portion weight fits into their daily calorie target (${user?.target_calories || 2000} kcal/day)!`}
- ALWAYS follow RESPECT & TONE RULES (neenga, unga, ungalukku, sollunga — ABSOLUTELY FORBIDDEN to use 'Dei', 'Dey', 'Da', 'Di', 'unoda', 'unakku', or 'nee').\n`;
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
       - "thumbs-up": a hand making a thumbs-up sign.
       - "peace-sign": a hand holding up 2 fingers (index and middle fingers).
       - "three-fingers": a hand holding up 3 fingers.
       - "fist": a hand making a closed fist.
       - "ok-sign": a hand making an OK sign (circle made of thumb and index finger).
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
 * Runs the single-turn Gemini call during the onboarding interview.
 * Evaluates the user's latest response against the onboarding checklist,
 * extracts any new information, answers any questions shortly, and
 * asks for the next missing information.
 */
async function conductOnboardingInterview({ currentProfile, message, history, user }) {
  const profileString = JSON.stringify(currentProfile, null, 2);
  const historyString = (history || []).map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.text}`).join('\n') || '(no prior history)';
  const coachCtx = user ? buildCoachContext(user) : '';
  const prompt = `You are ShowUp, a direct, highly competent, professional fitness coach.
${coachCtx}

=== MANDATORY INSTRUCTIONS ===
1. FIRST, analyze the user's latest message ("${message}") and extract all fields into "extracted":
   - "name": If user states their name (e.g. "I am Tharun", "Tharun", "call me Alex"), extract the name (e.g. "Tharun"). Preserve existing name if already known.
   - "activity": If user states their activity (e.g. "gym", "home workout", "running", "walking", "cycling"), extract strictly as "gym", "running", "walking", or "cycling".
   - "workout_location": If user mentions gym vs home vs outdoors, extract as "gym", "home", or "outdoor". (If they choose "gym workout", set workout_location="gym", activity="gym". If they choose "home workout", set workout_location="home", activity="gym").
   - "home_equipment": If user is doing home workouts and mentions equipment (e.g. "no equipment", "none", "bodyweight only", "pair of 5kg dumbbells", "resistance bands", "pullup bar"), extract as string (e.g. "none" or "dumbbells, pullup bar").
   - "experience_level": If user mentions their experience level (e.g. "beginner", "no experience", "first time", "don't know gym things", "experienced", "intermediate", "advanced"), extract as "beginner", "intermediate", or "advanced".
   - "height": If user mentions height (e.g. "175 cm", "5ft 9", "180"), extract as number in centimeters.
   - "weight": If user mentions weight (e.g. "68 kg", "72kg", "75"), extract as number in kilograms.
   - "goal": If user mentions their target body/physique goal (e.g. "lean muscle gain", "fat loss", "defined chest", "strength"), extract their goal.
   - "days_per_week": If user mentions days per week (e.g. "4 days", "2 days at weekend", "5 days"), extract integer 1-7.
   - "checkin_time": If user mentions time (e.g. "7am", "9 am", "18:30"), extract as "HH:MM" (24-hour format).
   - "supplements": If user mentions supplements (e.g. "whey protein, creatine", "none"), extract them.
   - "diet_summary": If user mentions their daily food/diet, extract a concise summary.
   - Preserve all previously extracted fields from currentProfile unless the user explicitly updates them.

2. SECOND, based on what is NOW known (combining currentProfile + extracted from latest message), generate the "reply":
   - STRICT NO-EMOJIS RULE: Zero emojis anywhere in your response. No emojis of any kind.
   - Step 1 (Name missing): If name is still not known, ask: "What should I call you?"
   - Step 2 (Activity & Location missing): If name is known but activity or workout_location is missing, ask:
     "What is your main workout plan — gym workout, home workout, running, walking, or cycling?"
   - Step 3 (Home Equipment check): If workout_location is "home" and home_equipment is missing:
     Ask: "Do you have any workout equipment at home (such as dumbbells, resistance bands, pull-up bar, or zero equipment)?"
   - Step 4 (Experience missing): If activity/location is known (and home_equipment known if home) but experience_level is missing:
     * If user just answered they have zero equipment at home, tell them the reality clearly before asking experience:
       "Understood. Pure bodyweight workouts build great baseline endurance, core stability, and functional mobility. However, for maximum progressive overload and significant muscle hypertrophy, resistance will eventually be needed. You can still make solid progress and build a strong foundation over these 30 days.\n\nAre you a beginner to workouts, or do you already have experience with your training?"
     * Otherwise, ask: "Are you a beginner, or do you already have experience with your workouts?"
   - Step 5 (Height & Weight missing): If experience is known but height or weight is missing:
     * If beginner: Give 2-3 clean bullet points on fundamentals:
       • Focus on form and consistency rather than lifting heavy.
       • Start with a manageable routine to build the habit.
       • Track progress daily to stay accountable.
       Then ask: "To calculate your exact baseline metrics and daily protein requirements, what is your height in cm and weight in kg?"
     * If experienced: Acknowledge their experience directly.
       Then ask: "To calculate your exact baseline metrics and daily protein targets, what is your height in cm and weight in kg?"
   - Step 6 (Goal missing): If height & weight are known but goal is missing, ask:
     "What specific body or fitness goal do you want to achieve over the next 30 days? (e.g. Lean muscle gain, fat loss, athletic conditioning, chest definition)"
   - Step 7 (Schedule missing): If goal is known but days_per_week or checkin_time is missing, ask:
     "How many days a week can you commit, and what time of day will you do your workouts?"
   - Step 8 (Diet & Supplements missing): If schedule is known but supplements/diet is missing, ask:
     "Tell me about your current diet. Also, do you take or plan to take any supplements (such as whey protein, creatine, multivitamins, or none)?"
   - Step 9 (All collected): If all fields (name, activity, workout_location, experience_level, height, weight, goal, days_per_week, checkin_time, supplements) are now collected:
     Provide clean, pointed, simple nutrition and supplement suggestions in clear bullet points without asking further questions:
     • Daily Protein: [Calculate EXACT grams from their real weight, e.g. If weight is 70kg, write "Aim for ~115g to 130g of protein daily based on your 70kg body weight"]
     • Daily Nutrition: [Clean, pointed dietary recommendation matching their goal and current food]
     • Hydration: Aim for 3 to 4 liters of water daily.
     • Supplements: [Specific, pointed recommendation for what they take or plan to take]

Here is the current profile before this message:
${profileString}

Here is the recent conversation history:
${historyString}

The user's latest message:
"${message}"

Extract the fields and formulate the reply:
{
  "extracted": {
    "name": string|null,
    "language": "en"|"ta"|"hi"|"tl"|"hl"|null,
    "activity": "gym"|"running"|"walking"|"cycling"|null,
    "workout_location": "gym"|"home"|"outdoor"|null,
    "home_equipment": string|null,
    "experience_level": "beginner"|"intermediate"|"advanced"|null,
    "height": number|null,
    "weight": number|null,
    "goal": string|null,
    "days_per_week": number|null,
    "checkin_time": string|null,
    "supplements": string|null,
    "diet_summary": string|null
  },
  "reply": "string (your conversational response with zero emojis and clean bullet points)"
}`;

  const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.2, maxTokens: 2000 });

  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      extracted: parsed.extracted || {},
      reply: parsed.reply || '',
    };
  } catch (err) {
    throw new GeminiError(`Could not parse Gemini JSON response: ${text}`);
  }
}

async function classifyIntent(message) {
  const prompt = `You are an AI intent classifier for a WhatsApp fitness accountability bot.
Analyze the user's incoming message and determine their primary intent.

Available intents:
- "DIET_LOG": User wants to log food, meals, calories eaten, or diet. E.g., "I ate 2 eggs", "lunch: chicken rice 200g", "just had an apple".
- "DIET_QUERY": User is asking for diet plan suggestions, recipes, calorie target details, or general nutrition/diet advice. E.g., "suggest a diet plan", "i need diet plan for me", "what is my calorie budget?", "what should I eat?".
- "WORKOUT_BURN_LOG": User is describing a workout or activity session to log calories burned. E.g., "ran 5k in 30m", "did 45 mins of cycling", "burned 300 calories running".
- "EXERCISE_QUERY": User is asking for advice, routines, or exercises to target a specific muscle group. E.g., "how to build chest?", "suggest a leg workout", "what exercise is best for biceps?".
- "GENERAL_QUERY": User is asking a general question, checking their schedule/timetable splits, asking for progress, checking what's planned for today, or just general chatting/chatting. E.g., "what is my schedule?", "what exercises do I do today?", "what are we doing today?", "how is my progress?", "who are you?", "what?", "bro i will do it at the end tell me today is saturday, what are we doing?".
- "CHECKIN": Default. User is sending a daily check-in message about a workout they completed (often with a photo) or general confirmation. E.g., "Leg day done!", "workout completed".

User Message: "${message}"

Respond ONLY with a valid JSON object, no markdown fences:
{"intent": "DIET_LOG"|"DIET_QUERY"|"WORKOUT_BURN_LOG"|"EXERCISE_QUERY"|"GENERAL_QUERY"|"CHECKIN"}`;

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
  const prompt = `You are a nutrition database. The user wants to log food they ate.
Analyze the text and extract all food items. For each item, estimate the weight in grams (if not specified, make a reasonable estimate) and calculate the calories, protein (g), carbs (g), and fat (g).

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

async function getExerciseSuggestions(user, message, muscleGroup) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const db = require('../db/db');
  const chatHistory = db.getChatMessages(user.id, 10);
  const historyString = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
${coachCtx}
The user is asking for exercise suggestions to improve the muscle group: "${muscleGroup}". Here is their profile:
- Name: ${user.name}
- Goal: ${user.goal || 'general fitness'}
- Target Muscle: ${user.target_muscle || 'full body'}

Here is the recent chat history for context:
${historyString}

User message: "${message}"

Provide a short, highly practical, and motivating list of 3-4 exercises they can do for "${muscleGroup}".
If the user has any injuries or physical limitations in your memory, respect those and suggest alternatives.
Give a brief tip on form/intensity for each. Keep it extremely punchy and WhatsApp-friendly (max 110 words).
Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
  return text.trim();
}

async function getDietSuggestions(user, message) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const targetCalories = user.target_calories || Math.round(user.weight * 30) || 2000;
  const db = require('../db/db');
  const chatHistory = db.getChatMessages(user.id, 10);
  const historyString = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  const coachCtx = buildCoachContext(user);
  
  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
${coachCtx}
The user is asking for diet advice or a diet plan. Here is their profile:
- Name: ${user.name}
- Height: ${user.height} cm
- Weight: ${user.weight} kg
- Activity: ${user.activity}
- Daily Calorie Target: ${targetCalories} kcal
- Registered Food Allergies: ${user.allergy || 'none'}

Here is the recent chat history for context:
${historyString}

User message: "${message}"

Provide a short, highly practical, and motivating diet suggestion or plan that matches their calorie target (${targetCalories} kcal).
Also account for any dietary restrictions or preferences from your memory about this user.
Give them clear examples of what to eat for breakfast, lunch, and dinner. Keep it punchy and WhatsApp-friendly (max 140 words).

CRITICAL REQUIREMENTS:
1. For EACH recommended food item, you MUST include a brief disclaimer parenthetically of any major allergies it can cause (if any, focusing ONLY on major food allergens like Peanuts, Tree Nuts, Milk/Dairy, Eggs, Wheat/Gluten, Soy, Fish, Shellfish, Sesame). Do not list everything, only major ones. Example: "Peanut Butter Toast (Allergens: Peanuts, Wheat)" or "Greek Yogurt (Allergens: Dairy)".
2. Cross-reference the user's registered food allergies ("${user.allergy || 'none'}"). If any recommended food contains or is closely related to a food they are allergic to, warn them explicitly, highlight it, and suggest a safe alternative.

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
  return text.trim();
}

async function conductTimetableInterview({ currentTimetable, message, goal, activity, language, chatHistory, daysPerWeek, checkinTime, user }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const timetableStr = currentTimetable ? JSON.stringify(currentTimetable, null, 2) : 'none';
  const historyString = (chatHistory || []).map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  const coachCtx = user ? buildCoachContext(user) : '';

  const prompt = `You are ShowUp, an elite, highly proactive human fitness coach and best friend texting on WhatsApp.
${coachCtx}
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
   - For Muscle Gain: Prescribe heavy compound splits (e.g. Upper Body & Chest, Lower Body & Glutes, Arms & Shoulders). Prescribe high-protein nutrition guidance (e.g. 1.8g protein/kg, calorie surplus).
   - For Weight Loss: Prescribe fat-burn cardio + full body muscle preservation splits. Prescribe high-protein calorie deficit nutrition.
   - For Cardio / General: Prescribe stamina & functional strength splits.
3. Propose a weekly timetable (Monday through Sunday):
   - CRITICAL: Schedule MUST contain EXACTLY ${daysPerWeek || 3} workout days with specific muscle group focus (e.g., Saturday: Upper Body & Chest, Sunday: Lower Body & Glutes). All other days MUST be "Rest".
   - ALIGN WITH USER DAYS: If they specified weekends or specific days, place workouts on those exact days.
   - If they confirm the schedule (e.g. "looks good", "yes", "confirm", "perfect", "done"), set "confirmed" to true.
4. Check for food allergies or diet restrictions:
   - If user.allergy is not set yet or missing, PROACTIVELY ask in your message: "Do you have any food allergies (peanuts, dairy, gluten, or none) so I can tailor your diet guidance?"
5. RESPECT & TONE RULE (MANDATORY IN TAMIL/TANGLISH):
   - ALWAYS use respectful terms: "neenga", "unga", "ungalukku", "sollunga", "bro" / "Ji".
   - NEVER EVER use "Dei", "Da", "Di", "nee", "unakku", "unoda", or "podu".
6. Write a warm, encouraging, proactive coach response displaying their weekly split, target muscle focus, diet tip, and allergy check in ${langName}. Keep under 110 words.

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
    return JSON.parse(cleaned);
  } catch (err) {
    throw new GeminiError(`Could not parse timetable response: ${text}`);
  }
}

async function generateWorkoutReminder(user, focus) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);
  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
${coachCtx}
The user is about to do their workout. Here is their profile:
- Name: ${user.name}
- Activity: ${user.activity}
- Goal: ${user.goal || 'general fitness'}
- Today's workout focus/split: "${focus}"

Generate a short workout reminder and daily motivation message in ${langName}.
Start with a friendly but direct reminder about today's workout focus (e.g. "Hey John, it's Chest & Triceps time!").
Include ONE highly motivating, punchy sentence (no-BS, inspiring) to get them hyped to show up.
If you have any follow-ups due from your memory, weave them in naturally.
Ask them to reply "going", "okay", or "done" when they start or finish.
Keep it under 60 words and WhatsApp-friendly. No hashtags.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.8 });
  return text.trim();
}

async function handleGeneralQuery(user, message) {
  const db = require('../db/db');
  const chatHistory = db.getChatMessages(user.id, 10);
  const historyString = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  
  const timetableStr = user.timetable ? JSON.stringify(JSON.parse(user.timetable), null, 2) : 'No timetable set';
  const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: require('../config').timezone }).format(new Date());
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, a warm, direct, no-BS fitness coach texting your friend ${user.name} on WhatsApp.
${coachCtx}
User message: "${message}"

Profile summary for your internal awareness:
- Name: ${user.name} | Activity: ${user.activity} | Goal: ${user.goal || 'general fitness'}
- Today: ${todayName} | Daily check-in time: ${user.checkin_time} | Streak: ${user.streak} days (Day ${user.day_count}/30)
- Timetable: ${timetableStr}

INSTRUCTIONS:
1. GREETINGS & CASUAL CHAT ("hi", "hey", "hello", "what's up", etc.): Reply warmly, naturally, and concisely (1-2 sentences max). E.g. "Hey ${user.name}! What's up? Ready to hit today's session?" or "Hey! How's your ${todayName} going?".
2. FOOD / DISH / DIET / CALORIE QUESTIONS (e.g. "how much biryani can I eat?", "what to eat?", "diet plan"):
   - Give the EXACT PORTION WEIGHT IN GRAMS (e.g. 1 plate / 250g Chicken Biryani) and exact Calories (e.g. 450 kcal) and Macros (Protein, Carbs, Fat).
   - Tell them how this portion fits into their daily target calorie budget (${user.target_calories || 2000} kcal/day).
   - Tailor recommendations to their preferred cuisine region (${user.cuisine_region || 'South Indian / Tamil Nadu'})!
3. PROACTIVE PROFILE COMPLETION (Ask ONE missing detail at the end of your answer if profile is incomplete):
   - Priority 1: If user's height or weight is missing (${user.height ? `${user.height}cm` : 'missing'} / ${user.weight ? `${user.weight}kg` : 'missing'}), ask: "By the way bro, what is your height (cm) & weight (kg)? I'll calculate your exact BMI, BMR, and daily calorie target!"
   - Priority 2: If user's cuisine/region preference is missing (${user.cuisine_region || 'missing'}), ask: "Also, what region or cuisine do you prefer for your meals (e.g. South Indian / Tamil Nadu, North Indian, Western) so I can give you tailored diet plans?"
   - Priority 3: If user's food allergy is missing (${user.allergy || 'missing'}), ask: "Do you have any food allergies (peanuts, dairy, gluten, or none) so I can keep your meal plans safe?"

Keep it short, natural, and WhatsApp-friendly (max 80 words for casual chat, max 120 words for food/diet questions). No hashtags.

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
  return text.trim();
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
3. ⚙️ Platform Fee: ₹25 (${config.platformFeeInr} INR) charged for platform administration and server infrastructure, leaving a base refund pool of ₹275 (${config.fullPayoutInr} INR).
4. 🛡️ 2 Free Strikes Grace Rule: If the user's committed schedule has >10 workout days in the month (e.g. 3+ days/week), they get 2 FREE STRIKES (first 2 missed workouts incur ₹0 penalty!).
5. ⚠️ Slip Penalty: Beyond free strikes, each missed workout deducts ₹50 (${config.slipPenaltyInr} INR) from their ₹275 refund balance (floored at ₹0).
6. 📋 Standard Plan vs Pro Plan (Starting Month 2):
   - Standard Plan (₹119/month base):
     * Includes daily photo check-in verification by AI, deposit protection, streak tracking, weekly progress summaries, accountability reminders.
     * Streak Discount: Clean week (0 slips) earns ₹10 off per week (up to ₹40 off = ₹79/month!).
   - Pro Plan (₹239/month base):
     * Includes EVERYTHING in Standard + AI-customized daily workout routines (upper body, lower body, glutes, push/pull/legs, cardio), muscle focus group guidance (chest, legs, shoulders, etc.), nutrition & calorie budget guidance, and personalized exercise coaching.
     * Streak Discount: Clean week (0 slips) earns ₹10 off per week (up to ₹40 off = ₹199/month!).

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
   - If they ask about the difference between ₹119 and ₹239 plans, clearly explain that ₹119 is standard accountability + AI check-ins, while ₹239 adds AI daily workout routines, exercise advice & diet guidance. Mention both get up to ₹40/mo streak discounts (₹79 & ₹199).
   - If they ask about terms/deposit/strikes, explain the ₹300 deposit, ₹25 fee (₹275 base refund), 2 free strikes for >10 days, and ₹50 penalty.
2. Keep your answer friendly, respectful, and conversational (max 90 words).
3. Always wrap up by reminding them that replying "paid" after paying the ₹300 deposit starts their 14-day free trial and 30-day pledge.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.5 });
    return text.trim();
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

Write a short WhatsApp message (max 85 words) as a casual best-friend coach:
1. React specifically to today's ${activity} — distance, pace, calories if notable
2. If distance < ${(weeklyGoalDistanceKm * 0.85).toFixed(1)}km (below 85% of goal): be encouraging but mention they were a bit short — "hey only Xkm today" style, not harsh
3. If distance >= ${(weeklyGoalDistanceKm * 0.85).toFixed(1)}km: celebrate or acknowledge it well
4. Show weekly progress ("X/${weeklyGoalSessions} ${activity} sessions this week, N more to go" or "crushed it!")
5. If there are other activities in the plan, give them a quick status too (1 line max)
6. Mention pace trend if notable
7. Suggest goal upgrade casually if flagged

STYLE: Like texting a close Indian friend/coach. "bro", "da", "nice one", "let's go", "come on", "ayyy". Short punchy sentences. Max 1-2 emojis. No hashtags. No lectures.
Consistency > perfection is the vibe.

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.85 });
  return text.trim();
}

module.exports = {
  GeminiError,
  acknowledgeAnswer,
  verifyCheckin,
  evaluateFollowup,
  conductOnboardingInterview,
  classifyIntent,
  parseDietLog,
  parseBurnedCalories,
  getExerciseSuggestions,
  getDietSuggestions,
  conductTimetableInterview,
  generateWorkoutReminder,
  handleGeneralQuery,
  buildCoachContext,
  extractProfileFacts,
  generateDailySummary,
  extractPersonalizationSignals,
  generateFollowUpNudge,
  answerPaymentAndTermsQuery,
  parseFitnessAppScreenshot,
  generateCardioCoachFeedback,
};
