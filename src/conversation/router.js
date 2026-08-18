const states = require('./states');
const db = require('../db/db');
const messaging = require('../services/messaging');
const messages = require('./messages');
const onboarding = require('./onboarding');
const checkin = require('./checkin');

const ONBOARD_STATES = new Set([
  states.ONBOARD_NAME, states.ONBOARD_LANGUAGE, states.ONBOARD_ACTIVITY,
  states.ONBOARD_DAYS, states.ONBOARD_TIME, states.ONBOARD_BLOCKER,
  states.ONBOARD_VISION, states.ONBOARD_COMMITMENT,
  states.AWAITING_COMMITMENT, states.AWAITING_MODE_SELECTION,
  states.AWAITING_PAYMENT, states.AWAITING_NUTRITION_CHOICE,
  states.AWAITING_USER_NUTRITION_PLAN, states.AWAITING_TIMETABLE,
]);

const CHECKIN_STATES = new Set([states.ACTIVE, states.AWAITING_CHECKIN_FOLLOWUP]);

function autoCorrectUserLanguage(user, text) {
  if (!user || !text || text.length < 1) return user.language || 'en';

  const cleanText = text.trim();
  const lower = cleanText.toLowerCase();

  // 1. Check for EXPLICIT Language Switch / Lock Commands
  const isExplicitEnglish =
    /(?:speak|talk|reply|chat|switch|change|set|use)\s+(?:in\s+|to\s+|language\s+to\s+)?english/i.test(lower) ||
    /(?:english\s+(?:only|please|la\s+pesu|la\s+pesunga|me\s+bolo|mein\s+baat\s+karo))/i.test(lower) ||
    /^english$/i.test(lower);

  const isExplicitTanglish =
    /(?:speak|talk|reply|chat|switch|change|set|use)\s+(?:in\s+|to\s+|language\s+to\s+)?tanglish/i.test(lower) ||
    /(?:tanglish\s+(?:only|please|la\s+pesu|la\s+pesunga))/i.test(lower) ||
    /^tanglish$/i.test(lower);

  const isExplicitTamil =
    /(?:speak|talk|reply|chat|switch|change|set|use)\s+(?:in\s+|to\s+|language\s+to\s+)?tamil/i.test(lower) ||
    /(?:tamil\s+(?:la\s+pesu|la\s+pesunga|la\s+chat\s+pannu|la\s+sollunga|il\s+pesavum|only|please))/i.test(lower) ||
    /(?:தமிழில்\s+(?:பேசவும்|மட்டும்|பேசு))/i.test(cleanText) ||
    /^tamil$/i.test(lower) ||
    /^தமிழ்$/i.test(cleanText);

  const isExplicitHinglish =
    /(?:speak|talk|reply|chat|switch|change|set|use)\s+(?:in\s+|to\s+|language\s+to\s+)?hinglish/i.test(lower) ||
    /(?:hinglish\s+(?:only|please|me\s+bolo|mein\s+baat\s+karo))/i.test(lower) ||
    /^hinglish$/i.test(lower);

  const isExplicitHindi =
    /(?:speak|talk|reply|chat|switch|change|set|use)\s+(?:in\s+|to\s+|language\s+to\s+)?hindi/i.test(lower) ||
    /(?:hindi\s+(?:me\s+baat\s+karo|me\s+bolo|mein\s+bolo|me\s+batao|only|please))/i.test(lower) ||
    /(?:हिंदी\s+में\s+(?:बात\s+करें|बोलो|बताओ))/i.test(cleanText) ||
    /^hindi$/i.test(lower) ||
    /^हिंदी$/i.test(cleanText);

  const isUnlockCommand =
    /(?:auto\s+language|detect\s+language|unlock\s+language|any\s+language)/i.test(lower);

  if (isUnlockCommand) {
    console.log(`[Router] User ${user.id} unlocked sticky language preference.`);
    db.updateUser(user.id, { language_locked: null });
    user.language_locked = null;
  } else if (isExplicitEnglish) {
    console.log(`[Router] User ${user.id} explicitly locked language to: English ('en')`);
    db.updateUser(user.id, { language: 'en', language_locked: 'en' });
    user.language = 'en';
    user.language_locked = 'en';
    return 'en';
  } else if (isExplicitTanglish) {
    console.log(`[Router] User ${user.id} explicitly locked language to: Tanglish ('tl')`);
    db.updateUser(user.id, { language: 'tl', language_locked: 'tl' });
    user.language = 'tl';
    user.language_locked = 'tl';
    return 'tl';
  } else if (isExplicitTamil) {
    const target = /[\u0B80-\u0BFF]/.test(cleanText) ? 'ta' : 'tl';
    console.log(`[Router] User ${user.id} explicitly locked language to: Tamil ('${target}')`);
    db.updateUser(user.id, { language: target, language_locked: target });
    user.language = target;
    user.language_locked = target;
    return target;
  } else if (isExplicitHinglish) {
    console.log(`[Router] User ${user.id} explicitly locked language to: Hinglish ('hl')`);
    db.updateUser(user.id, { language: 'hl', language_locked: 'hl' });
    user.language = 'hl';
    user.language_locked = 'hl';
    return 'hl';
  } else if (isExplicitHindi) {
    const target = /[\u0900-\u097F]/.test(cleanText) ? 'hi' : 'hl';
    console.log(`[Router] User ${user.id} explicitly locked language to: Hindi ('${target}')`);
    db.updateUser(user.id, { language: target, language_locked: target });
    user.language = target;
    user.language_locked = target;
    return target;
  }

  // 2. If user has an active language lock, respect it unless typing distinct non-Latin script
  if (user.language_locked) {
    return user.language_locked;
  }

  // 3. Dynamic language detection (when no sticky lock is active)
  const hasTamilScript = /[\u0B80-\u0BFF]/.test(cleanText);
  const hasDevanagariScript = /[\u0900-\u097F]/.test(cleanText);

  let newLang = user.language || 'en';

  if (hasTamilScript) {
    newLang = 'ta';
  } else if (hasDevanagariScript) {
    newLang = 'hi';
  } else {
    // Check Tanglish indicators
    const isTanglish =
      /\b(vanakkam|sollunga|solunga|epdi|eppadi|irukinga|irukenga|iruken|irukken|pannren|panren|pannunga|panunga|panna|pannalaam|mudiyum|mudiyala|mudiyadhu|mudila|kooda|enna|aachu|aayiduchu|sapten|saapten|saaptingala|romba|nalla|nalaiku|naalaiki|iniku|inniku|nethu|inga|anga|theriyum|therila|seri|illa|illai|podunga|pesunga|pesalam|vaanga|vanga|thambi|machan|machi|thala|anna|sapdanum|saapdanum|ennoda|ungala|ungalukku|unga|neenga|enaku|enakku|unakku|saptiya|saaptiya|valikudhu|valikuthu|aama|aamam|illaye|kudunga|solli|thanga|paniten|panniten|solren|pannikalam|polama|varala)\b/i.test(lower) ||
      /\b(?:bro|ji|thala)\s+(?:epdi|enna|sollunga|solunga|sapten|pannren|irukken|valikudhu|valikuthu)\b/i.test(lower);

    // Check Hinglish indicators
    const isHinglish =
      /\b(namaste|kaise|kaisa|kaisi|kya|chal|raha|rahi|rahe|hai|hain|karo|karna|karenge|karein|kiya|tha|thi|the|aaj|kal|parso|khaya|khana|kha|batao|bataiye|bolo|bhai|haan|nahi|nahin|accha|achha|theek|thik|bahut|thoda|samajh|gaya|gayi|shukriya|dhanyavad|kripya|apna|apni|mera|meri|mujhe|tumhe|aapko|hoga|hogi|humein|karega|karegi|chahiye|boliye|paani|bhook|dard)\b/i.test(lower) ||
      /\b(?:bhai|bhaiya|ji)\s+(?:kaise|kya|batao|bolo|karna|hai)\b/i.test(lower);

    // Check English indicators (sentences / questions in English)
    const isEnglish =
      !isTanglish &&
      !isHinglish &&
      /\b(can|could|will|would|should|what|when|where|why|how|which|who|workout|gym|diet|meal|food|eat|exercise|training|schedule|plan|tomorrow|today|yesterday|rest|protein|calories|weight|fat|muscle|body|coach|morning|evening|night|hours|sleep|sore|pain|hurt|drink|water|thanks|thank|please|feeling|tired|ready|start|finish|routine|target)\b/i.test(lower);

    if (isTanglish) {
      newLang = 'tl';
    } else if (isHinglish) {
      newLang = 'hl';
    } else if (isEnglish) {
      newLang = 'en';
    }
  }

  if (newLang !== user.language) {
    console.log(`[Router] Dynamically shifted user ${user.id} language from '${user.language}' -> '${newLang}'`);
    db.updateUser(user.id, { language: newLang });
    user.language = newLang;
  }

  return newLang;
}

function checkForHealthProfileUpdates(user, text) {
  if (!user || !text) return;
  const lower = text.toLowerCase();
  const fitness = require('../utils/fitness');
  const updates = {};

  // 1. Allergy extraction
  if (/(no allergy|no food allergy|onnum illa|none|naan|nill|illai|illa|nothing|no allergies|apdi ethum illai|ethum illai)/i.test(lower)) {
    if (user.allergy !== 'none') updates.allergy = 'none';
  } else if (/(peanuts|dairy|gluten|egg|milk|wheat|soy|fish|nuts|seafood|lactose)/i.test(lower)) {
    const match = lower.match(/(peanuts|dairy|gluten|egg|milk|wheat|soy|fish|nuts|seafood|lactose)/gi);
    if (match) {
      const val = Array.from(new Set(match)).join(', ');
      if (user.allergy !== val) updates.allergy = val;
    }
  }

  // 2. Height & Weight extraction
  const heightMatch = lower.match(/(\d{3})\s*(?:cm|centimeters)/i) || lower.match(/height\s*(?:is|:|=)?\s*(\d{2,3})/i);
  if (heightMatch) {
    const h = parseFloat(heightMatch[1]);
    if (h >= 120 && h <= 250 && user.height !== h) {
      updates.height = h;
    }
  }

  const weightMatch = lower.match(/(\d{2,3})\s*(kg|kilos|kilograms)/i) || lower.match(/weight\s*[:=]?\s*(\d{2,3})/i);
  if (weightMatch) {
    const w = parseFloat(weightMatch[1]);
    if (w >= 30 && w <= 250 && user.weight !== w) {
      updates.weight = w;
    }
  }

  // 3. Cuisine / Region preference extraction
  if (/south\s*indian|tamil|chennai|kerala|andhra|karnataka/i.test(lower)) {
    if (user.cuisine_region !== 'South Indian') updates.cuisine_region = 'South Indian';
  } else if (/north\s*indian|punjabi|delhi|mumbai|gujarati/i.test(lower)) {
    if (user.cuisine_region !== 'North Indian') updates.cuisine_region = 'North Indian';
  } else if (/western|continental/i.test(lower)) {
    if (user.cuisine_region !== 'Western') updates.cuisine_region = 'Western';
  }

  const newHeight = updates.height || user.height;
  const newWeight = updates.weight || user.weight;
  if (newHeight && newWeight) {
    const targetCals = fitness.calculateTargetCalories(newHeight, newWeight, user.days_per_week || 4, user.goal || 'muscle_gain');
    if (user.target_calories !== targetCals) {
      updates.target_calories = targetCals;
    }
  }

  if (Object.keys(updates).length > 0) {
    console.log(`[Router] Updating health profile for user ${user.id}:`, updates);
    db.updateUser(user.id, updates);
    Object.assign(user, updates);
  }
}

function isWorkoutDayToday(user) {
  if (!user || !user.timetable) return true;
  try {
    const timetable = JSON.parse(user.timetable);
    const todayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: require('../config').timezone,
    }).format(new Date());
    const todaySplit = timetable[todayName];
    if (!todaySplit || todaySplit.toLowerCase() === 'rest') {
      return false; // Rest day
    }
    return true; // Scheduled workout day
  } catch (err) {
    return true;
  }
}

/**
 * media: { mediaUrl?, mimeType?, testBase64 } - testBase64 is set only by the local
 * simulate.js harness, which has no real Twilio account to host media on.
 */
async function handleIncomingMessage({ phone, body, media }) {
  const { user, isNew } = db.getOrCreateUser(phone);
  const text = (body || '').trim();

  if (text.length > 0) {
    if (!isNew) {
      autoCorrectUserLanguage(user, text);
      checkForHealthProfileUpdates(user, text);
    }
    db.saveChatMessage(user.id, 'user', text);

    // Fire-and-forget profile fact extraction for durable messages (skip during onboarding — interview handles it)
    const onboardingStates = new Set(['ONBOARD_NAME', 'ONBOARD_LANGUAGE', 'ONBOARD_ACTIVITY', 'ONBOARD_DAYS', 'ONBOARD_TIME', 'ONBOARD_BLOCKER', 'ONBOARD_VISION', 'ONBOARD_COMMITMENT']);
    if (!isNew && !onboardingStates.has(user.state) && text.length > 15 && !/^(going|ok|okay|sure|done|yes|paid|reset|\/reset)$/i.test(text)) {
      const gemini = require('../services/gemini');
      gemini.extractProfileFacts(user, text).catch(err =>
        console.error('[Profile] fact extraction failed:', err.message)
      );
    }
  }

  if (isNew) {
    await messaging.sendText(phone, messages.question('en', 'name'));
    return;
  }

  const cleanText = text.toLowerCase();
  if (cleanText === 'reset' || cleanText === '/reset') {
    console.log(`[Router] Resetting user ${phone} from database...`);
    db.db.exec('PRAGMA foreign_keys = OFF;');
    try {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(user.id);
      db.db.prepare('DELETE FROM nutrition_logs WHERE user_id = ?').run(user.id);
      db.db.prepare('DELETE FROM burned_calories_logs WHERE user_id = ?').run(user.id);
      db.db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(user.id);
      db.db.prepare('DELETE FROM outbox_messages WHERE user_id = ?').run(user.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    } finally {
      db.db.exec('PRAGMA foreign_keys = ON;');
    }
    
    // Recreate a clean user record and start onboarding Q1
    db.getOrCreateUser(phone);
    await messaging.sendText(phone, messages.question('en', 'name'));
    return;
  }

  if (user.state === states.COMPLETED) {
    await messaging.sendText(phone, messages.t(user.language, 'waitForPrompt'));
    return;
  }

  if (ONBOARD_STATES.has(user.state)) {
    await onboarding.handleOnboarding(user, text, media);
    return;
  }

  if (CHECKIN_STATES.has(user.state)) {
    const hasImage = media && (media.mediaUrl || media.testBase64);
    const isPro = user.tier && user.tier.startsWith('pro');
    const workoutToday = isWorkoutDayToday(user);

    if (cleanText.includes('change schedule') || cleanText.includes('update timetable') || cleanText.includes('edit schedule')) {
      db.updateUser(user.id, { state: states.AWAITING_TIMETABLE });
      await messaging.sendText(phone, "No problem! Let's update your weekly schedule. What fitness goal or timetable changes do you want to make?");
      return;
    }

    const today = require('../utils/date').todayStr(require('../config').timezone);
    if (user.workout_reminded_date === today && user.workout_acknowledged_date !== today) {
      db.updateUser(user.id, { workout_acknowledged_date: today });
      if (!hasImage && text.length < 20 && /^(going|ok|okay|sure|done|heading out|going now|on my way|yes|will do|ready)\b/i.test(text)) {
        await messaging.sendText(phone, "That's what I want to hear! Let's crush it. Send me your workout proof (photo + text) when you're done!");
        return;
      }
    }

    if (!hasImage && text.length > 0) {
      try {
        const gemini = require('../services/gemini');
        
        // Background extraction of any durable user facts (injuries, diet constraints, etc.)
        gemini.extractProfileFacts(user, text).catch(e => console.error('[Memory] Fact extraction error:', e.message));

        const intent = await gemini.classifyIntent(text);
        console.log(`[Router] Classified intent for user ${user.id}: ${intent}`);

        if (intent === 'SUBSTITUTION_OR_MODIFICATION') {
          const coaching = require('./coaching');
          await coaching.handleSubstitutionOrModification(user, text);
          return;
        }

        if (intent === 'HEALTH_ALERT') {
          const coaching = require('./coaching');
          await coaching.handleHealthAlert(user, text);
          return;
        }

        if (intent === 'RESCHEDULE_REQUEST') {
          const scheduleService = require('../services/scheduleService');
          const reply = await scheduleService.handleNaturalReschedule(user, text);
          await messaging.sendText(phone, reply);
          return;
        }

        if (intent === 'POST_WORKOUT_RESPONSE') {
          const coaching = require('./coaching');
          await coaching.handlePostWorkoutResponse(user, text);
          return;
        }

        if (intent === 'WEIGHT_UPDATE') {
          const coaching = require('./coaching');
          await coaching.handleWeightUpdate(user, text);
          return;
        }

        if (intent === 'PERFORMANCE_LOG') {
          const coaching = require('./coaching');
          await coaching.handlePerformanceLog(user, text);
          return;
        }

        if (intent === 'DIET_DEVIATION') {
          const diet = require('./diet');
          await diet.handleDietDeviation(user, text);
          return;
        }

        if (intent === 'DIET_LOG' && isPro) {
          const diet = require('./diet');
          await diet.handleDietLog(user, text);
          return;
        }
        if (intent === 'DIET_QUERY') {
          if (isPro) {
            const diet = require('./diet');
            await diet.handleDietQuery(user, text);
          } else {
            const reply = await gemini.handleGeneralQuery(user, text);
            await messaging.sendText(phone, reply);
          }
          return;
        }
        if (intent === 'WORKOUT_BURN_LOG' && isPro) {
          const exercise = require('./exercise');
          await exercise.handleBurnLog(user, text);
          return;
        }
        if (intent === 'EXERCISE_QUERY') {
          if (isPro) {
            const exercise = require('./exercise');
            await exercise.handleExerciseQuery(user, text);
          } else {
            const reply = await gemini.handleGeneralQuery(user, text);
            await messaging.sendText(phone, reply);
          }
          return;
        }
        if (intent === 'GENERAL_QUERY' || !workoutToday) {
          const reply = await gemini.handleGeneralQuery(user, text);
          await messaging.sendText(phone, reply);
          return;
        }
      } catch (err) {
        console.error('[Router] Error during intent classification:', err);
      }
    }

    if (workoutToday || hasImage) {
      await checkin.handleCheckinFlow(user, text, media || {});
    } else {
      const gemini = require('../services/gemini');
      const reply = await gemini.handleGeneralQuery(user, text);
      await messaging.sendText(phone, reply);
    }
    return;
  }
}

module.exports = { handleIncomingMessage };
