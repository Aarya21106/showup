const axios = require('axios');
const config = require('../config');

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

class GeminiError extends Error {}

async function callGemini({ parts, jsonMode, temperature }) {
  if (!config.geminiConfigured) {
    throw new GeminiError('GEMINI_API_KEY is not set');
  }

  const generationConfig = {
    temperature: temperature ?? 0.6,
    maxOutputTokens: 400,
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
 * Dynamic onboarding checklist interview:
 * Receives current profile fields and the user's latest message,
 * extracts any new information, answers any questions shortly, and
 * asks for the next missing information.
 */
async function conductOnboardingInterview({ currentProfile, message, history }) {
  const profileString = JSON.stringify(currentProfile, null, 2);
  const historyString = (history || []).map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.text}`).join('\n') || '(no prior history)';
  const prompt = `You are ShowUp, a fitness accountability bot conducting an onboarding interview on WhatsApp.
Your tone is like a warm, direct, no-BS fitness coach and friend. This bot supports accountability for gym workouts, running, walking, and cycling.

We need to collect these fields for the user's checklist:
1. "name": The user's name.
2. "language": Preferred language (MUST be exactly one of 'en' for English, 'ta' for Tamil, or 'hi' for Hindi).
3. "activity": The activity they commit to (MUST be exactly one of 'gym', 'running', 'walking', or 'cycling').
4. "tier": Pricing plan preference. MUST be exactly one of 'free' (free trial accountability), 'pro_120' (120 INR plan with diet/calorie tracking), or 'pro_350' (350 INR plan with full coaching & exercises).
5. "days_per_week": How many days a week they commit to their activity (an integer between 1 and 7).
6. "checkin_time": The daily check-in time for their session. Extract and convert to 'HH:MM' 24h format in Asia/Kolkata timezone (e.g. "7am" -> "07:00", "6:30 pm" -> "18:30").
7. "blocker_text": What stopped them from staying consistent before (e.g. bad mornings, laziness, boredom).
8. "vision_text": What success looks like / what showing up for 30 days will do for them.
9. "commitment_score": Their commitment level on a scale of 1 to 10.
10. "allergy": Any food allergies they have (e.g. peanuts, dairy, wheat, or none). Ask the user: "Do you have any food allergies?"
11. "height": Height in cm. (ONLY required if tier is 'pro_120' or 'pro_350'; set to null otherwise).
12. "weight": Weight in kg. (ONLY required if tier is 'pro_120' or 'pro_350'; set to null otherwise).
13. "target_muscle": Muscle group they want to improve (e.g. chest, legs, shoulders, full body). (ONLY required if tier is 'pro_120' or 'pro_350'; set to null otherwise).

Here is the user's current profile:
${profileString}

Here is the recent conversation history for context:
${historyString}

The user's latest message just now:
"${message}"

Instructions:
1. Analyze the user's latest message in context of the recent history.
2. Extract any of the checklist fields they have provided or clarified. If a field was already collected, preserve its value unless the user explicitly wants to update/change it in their message.
   - For "activity", extract it as exactly one of 'gym', 'running', 'walking', or 'cycling' if they mention it. If they say "work out", default to 'gym'.
   - For "tier", extract it as exactly one of 'free', 'pro_120', or 'pro_350'. If they ask about the plans, explain the options (Free = accountability only, Pro 120 = diet/calorie tracking, Pro 350 = workout coaching/exercises) and ask them to select one.
   - For "days_per_week", try to extract just the number (1-7).
   - For "checkin_time", format it strictly as "HH:MM" (24-hour, e.g. "07:00" or "18:30").
   - For "language", if they specified English/Tamil/Hindi, set it to "en"/"ta"/"hi" respectively.
   - For "commitment_score", extract the number (1-10) or choose a reasonable default if they just say "very high" or "committed" (e.g., 9).
   - For "height" (REAL) and "weight" (REAL), extract them as numerical values (e.g. "170 cm" -> 170, "65 kg" -> 65) ONLY if the tier is 'pro_120' or 'pro_350'.
   - For "target_muscle", extract the muscle focus group (e.g., chest, legs, shoulders, core, full body) ONLY if the tier is 'pro_120' or 'pro_350'.
   - If a field is not present in their latest message/context and was not already in the profile, return null for it.
3. If the user asked a question, made a joke, or went off-topic, react to it shortly, warmly, and with no BS.
4. Then, ask for the next missing checklist item (in the user's preferred language, falling back to English if language is not yet set or detected). Do NOT ask for more than one detail at a time. Keep your message short, punchy, and conversational (max 60 words).
5. Respond ONLY with a valid, clean JSON object, no markdown blocks:
{
  "extracted": {
    "name": string|null,
    "language": "en"|"ta"|"hi"|null,
    "activity": "gym"|"running"|"walking"|"cycling"|null,
    "tier": "free"|"pro_120"|"pro_350"|null,
    "days_per_week": number|null,
    "checkin_time": string|null,
    "blocker_text": string|null,
    "vision_text": string|null,
    "commitment_score": number|null,
    "allergy": string|null,
    "height": number|null,
    "weight": number|null,
    "target_muscle": string|null
  },
  "reply": "string (your conversational response reacting to their message and asking for the next missing detail)"
}`;

  const text = await callGemini({ parts: [{ text: prompt }], jsonMode: true, temperature: 0.2 });

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

  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
The user is asking for exercise suggestions to improve the muscle group: "${muscleGroup}". Here is their profile:
- Name: ${user.name}
- Goal: ${user.goal || 'general fitness'}
- Target Muscle: ${user.target_muscle || 'full body'}

Here is the recent chat history for context:
${historyString}

User message: "${message}"

Provide a short, highly practical, and motivating list of 3-4 exercises they can do for "${muscleGroup}".
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
  
  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
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
Give them clear examples of what to eat for breakfast, lunch, and dinner. Keep it punchy and WhatsApp-friendly (max 140 words).

CRITICAL REQUIREMENTS:
1. For EACH recommended food item, you MUST include a brief disclaimer parenthetically of any major allergies it can cause (if any, focusing ONLY on major food allergens like Peanuts, Tree Nuts, Milk/Dairy, Eggs, Wheat/Gluten, Soy, Fish, Shellfish, Sesame). Do not list everything, only major ones. Example: "Peanut Butter Toast (Allergens: Peanuts, Wheat)" or "Greek Yogurt (Allergens: Dairy)".
2. Cross-reference the user's registered food allergies ("${user.allergy || 'none'}"). If any recommended food contains or is closely related to a food they are allergic to, warn them explicitly, highlight it, and suggest a safe alternative.

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
  return text.trim();
}

async function conductTimetableInterview({ currentTimetable, message, goal, activity, language, chatHistory, daysPerWeek, checkinTime }) {
  const langName = LANGUAGE_NAMES[language] || 'English';
  const timetableStr = currentTimetable ? JSON.stringify(currentTimetable, null, 2) : 'none';
  const historyString = (chatHistory || []).map(m => `${m.role === 'user' ? 'User' : 'ShowUp'}: ${m.text}`).join('\n') || '(no prior history)';
  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
We are setting up the user's weekly workout timetable/split.
User's activity: "${activity}"
User's current goal: "${goal || 'not set yet'}"
Target number of workout days per week: ${daysPerWeek || 3}
User's preferred check-in timing details: ${checkinTime || 'daily'}

Current timetable structure:
${timetableStr}

Here is the recent chat history for context:
${historyString}

User message: "${message}"

Instructions:
1. Analyze the user's message and the chat history context.
2. If they mention their fitness goal (e.g., gain muscle, lose weight, general fitness, cardio endurance), extract/update the goal field.
   - Map goal to one of: "muscle_gain", "weight_loss", "cardio", "general".
3. Propose/update a weekly timetable (Monday through Sunday) based on their goal and activity.
   - CRITICAL CONSTRAINT: The proposed schedule MUST contain EXACTLY ${daysPerWeek || 3} workout days. All other days MUST be "Rest". Do NOT suggest more workout days than this target.
   - ALIGN WITH USER DAYS: Check the user's onboarding message or request in the chat history. For example, if they specified "2 days weekend", you MUST place the splits on Saturday and Sunday and set all weekdays (Monday-Friday) to "Rest".
   - If they confirm the suggestion (e.g., "looks good", "yes", "confirm", "perfect"), set "confirmed" to true.
   - If they want to edit any day, apply the edits and set "confirmed" to false. Ensure the number of workout days remains exactly ${daysPerWeek || 3} unless they explicitly request to change the weekly workout frequency itself.
4. Write a warm, punchy, conversational response in ${langName} displaying their weekly timetable clearly and asking if they want to confirm it or make any changes. Keep the message under 100 words.

Respond ONLY with strict JSON, no markdown fences:
{
  "goal": "muscle_gain"|"weight_loss"|"cardio"|"general",
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
  "reply": "string (conversational response displaying the table in text and asking to confirm or edit)"
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
  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
The user is about to do their workout. Here is their profile:
- Name: ${user.name}
- Activity: ${user.activity}
- Goal: ${user.goal || 'general fitness'}
- Today's workout focus/split: "${focus}"

Generate a short workout reminder and daily motivation message in ${langName}.
Start with a friendly but direct reminder about today's workout focus (e.g. "Hey John, it's Chest & Triceps time!").
Include ONE highly motivating, punchy sentence (no-BS, inspiring) to get them hyped to show up.
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

  const prompt = `You are ShowUp, a direct, no-BS fitness coach and best friend.
The user is asking a general question, chatting, checking their schedule/timetable, or asking for progress.
Here is their profile:
- Name: ${user.name}
- Activity: ${user.activity}
- Goal: ${user.goal || 'not set yet'}
- Registered Food Allergies: ${user.allergy || 'none'}
- Weekly splits/timetable: 
${timetableStr}
- Streak: ${user.streak} days
- Day count: ${user.day_count}/30 days
- Today's day name: ${todayName}
- Daily check-in time: ${user.checkin_time}
- Active daily gesture to use when checking in: ${user.current_gesture || 'none assigned yet'}

Here is the recent chat history for context:
${historyString}

User message: "${message}"

Write a short, direct, no-BS response answering their question or discussing their schedule/splits. Mention the split scheduled for today or their timetable details if they ask about it.
Keep it punchy, friendly, and under 120 words. No hashtags.

Reply ONLY in ${langName}.`;

  const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.7 });
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
  handleGeneralQuery
};

