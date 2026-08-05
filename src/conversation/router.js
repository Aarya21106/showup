const states = require('./states');
const db = require('../db/db');
const whatsapp = require('../services/whatsapp');
const messages = require('./messages');
const onboarding = require('./onboarding');
const checkin = require('./checkin');

const ONBOARD_STATES = new Set([
  states.ONBOARD_NAME, states.ONBOARD_LANGUAGE, states.ONBOARD_ACTIVITY,
  states.ONBOARD_DAYS, states.ONBOARD_TIME, states.ONBOARD_BLOCKER,
  states.ONBOARD_VISION, states.ONBOARD_COMMITMENT, states.AWAITING_PAYMENT,
  states.AWAITING_TIMETABLE,
]);

const CHECKIN_STATES = new Set([states.ACTIVE, states.AWAITING_CHECKIN_FOLLOWUP]);

/**
 * media: { mediaUrl?, mimeType?, testBase64? } - testBase64 is set only by the local
 * simulate.js harness, which has no real Twilio account to host media on.
 */
async function handleIncomingMessage({ phone, body, media }) {
  const { user, isNew } = db.getOrCreateUser(phone);
  const text = (body || '').trim();

  if (text.length > 0) {
    db.saveChatMessage(user.id, 'user', text);

    // Fire-and-forget profile fact extraction for durable messages
    if (!isNew && text.length > 15 && !/^(going|ok|okay|sure|done|yes|paid|reset|\/reset)$/i.test(text)) {
      const gemini = require('../services/gemini');
      gemini.extractProfileFacts(user, text).catch(err =>
        console.error('[Profile] fact extraction failed:', err.message)
      );
    }
  }

  if (isNew) {
    await whatsapp.sendText(phone, messages.question('en', 'name'));
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
      db.db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    } finally {
      db.db.exec('PRAGMA foreign_keys = ON;');
    }
    
    // Recreate a clean user record and start onboarding Q1
    db.getOrCreateUser(phone);
    await whatsapp.sendText(phone, messages.question('en', 'name'));
    return;
  }

  if (user.state === states.COMPLETED) {
    await whatsapp.sendText(phone, messages.t(user.language, 'waitForPrompt'));
    return;
  }

  if (ONBOARD_STATES.has(user.state)) {
    await onboarding.handleOnboarding(user, text);
    return;
  }

  if (CHECKIN_STATES.has(user.state)) {
    const hasImage = media && (media.mediaUrl || media.testBase64);
    const isPro = user.tier && user.tier.startsWith('pro');

    if (cleanText.includes('change schedule') || cleanText.includes('update timetable') || cleanText.includes('edit schedule')) {
      db.updateUser(user.id, { state: states.AWAITING_TIMETABLE });
      await whatsapp.sendText(phone, "No problem! Let's update your weekly schedule. What fitness goal or timetable changes do you want to make?");
      return;
    }

    const today = require('../utils/date').todayStr(require('../config').timezone);
    if (user.workout_reminded_date === today && user.workout_acknowledged_date !== today) {
      db.updateUser(user.id, { workout_acknowledged_date: today });
      if (!hasImage && text.length < 20 && /^(going|ok|okay|sure|done|heading out|going now|on my way|yes|will do|ready)\b/i.test(text)) {
        await whatsapp.sendText(phone, "That's what I want to hear! Let's crush it. Send me your workout proof (photo + text) when you're done!");
        return;
      }
    }

    if (!hasImage && text.length > 0) {
      try {
        const gemini = require('../services/gemini');
        const intent = await gemini.classifyIntent(text);
        console.log(`[Router] Classified intent for user ${user.id}: ${intent}`);

        if (isPro && intent === 'DIET_LOG') {
          const diet = require('./diet');
          await diet.handleDietLog(user, text);
          return;
        }
        if (isPro && intent === 'DIET_QUERY') {
          const diet = require('./diet');
          await diet.handleDietQuery(user, text);
          return;
        }
        if (isPro && intent === 'WORKOUT_BURN_LOG') {
          const exercise = require('./exercise');
          await exercise.handleBurnLog(user, text);
          return;
        }
        if (isPro && intent === 'EXERCISE_QUERY') {
          const exercise = require('./exercise');
          await exercise.handleExerciseQuery(user, text);
          return;
        }
        if (intent === 'GENERAL_QUERY') {
          const reply = await gemini.handleGeneralQuery(user, text);
          await whatsapp.sendText(phone, reply);
          return;
        }
      } catch (err) {
        console.error('[Router] Error during intent classification:', err);
      }
    }

    await checkin.handleCheckinFlow(user, text, media || {});
    return;
  }
}

module.exports = { handleIncomingMessage };
