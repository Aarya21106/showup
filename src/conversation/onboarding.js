const fs = require('fs');
const path = require('path');
const states = require('./states');
const messages = require('./messages');
const db = require('../db/db');
const gemini = require('../services/gemini');
const messaging = require('../services/messaging');
const config = require('../config');
const { todayStr, addDaysStr } = require('../utils/date');
const { isOffTopicQuestion } = require('../utils/intent');

async function resolveImage(media) {
  if (!media) return null;
  if (media.testBase64) {
    return { base64: media.testBase64, mimeType: media.mimeType || 'image/jpeg' };
  }
  if (media.mediaUrl) {
    if (fs.existsSync(media.mediaUrl)) {
      const base64 = fs.readFileSync(media.mediaUrl).toString('base64');
      const ext = path.extname(media.mediaUrl).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { base64, mimeType };
    }
    return messaging.fetchInboundMedia(media.mediaUrl);
  }
  return null;
}

function promptNutritionChoice(user) {
  return (
    `One more thing before we kick off Day 1: let's get your nutrition locked in.\n\n` +
    `Do you want me to create a tailored nutrition plan for you, or do you already follow your own diet plan?\n\n` +
    `1. Create a customized AI Nutrition Plan for me\n` +
    `2. I have my own nutrition plan (reply with text or send a photo of your diet chart)`
  );
}

/**
 * Returns the correct deposit payment link for the given tier. Bug fix: both
 * tier-selection branches below used to send the exact same config.paymentLinkUrl
 * regardless of whether the user picked Basic or Pro. Falls back to the legacy
 * single link if a tier-specific one isn't configured, so nothing breaks for
 * deployments that haven't set the two new env vars yet.
 */
function getPaymentLinkForTier(tier) {
  if (tier === 'pro' && config.paymentLinkUrlPro) return config.paymentLinkUrlPro;
  if (tier === 'basic' && config.paymentLinkUrlBasic) return config.paymentLinkUrlBasic;
  return config.paymentLinkUrl;
}

const PROMO_CODE = 'SHOWUPSTARTTEST';
const PROMO_TRIAL_DAYS = 14;

async function sendTierSelectionAsk(user) {
  // Show deposit rules + Basic vs Pro tier choice
  await messaging.sendText(user.phone, messages.t(user.language, 'accountabilityIntro', { name: user.name }));
}

/**
 * Sends a nutrition plan and puts the user in the confirmation loop — the plan is
 * NOT final at this point. state must already be states.AWAITING_NUTRITION_PLAN_CONFIRMATION
 * on the same db.updateUser() call that saved nutrition_plan.
 */
async function deliverPlanForConfirmation(updatedUser, planText) {
  await messaging.sendText(updatedUser.phone, planText);
  await messaging.sendText(updatedUser.phone, messages.nutritionPlanConfirmPrompt(updatedUser.language));
}

/**
 * Sends the Day 1 workout kickoff, then asks whether the user wants meal/calorie
 * tracking reminders. Called once the nutrition plan has been confirmed — the caller
 * is responsible for setting state: states.AWAITING_MEAL_REMINDER_CONSENT first.
 */
async function deliverDay1AndAskReminderConsent(updatedUser) {
  const phone = updatedUser.phone;
  try {
    const day1 = await gemini.generateDay1Workout(updatedUser);
    if (day1) await messaging.sendText(phone, day1);
  } catch (err) {
    console.error('Error generating Day 1 workout:', err);
  }

  // Honest reality check on their chosen frequency vs. their stated target timeframe —
  // sent once, right after the full setup is delivered, before anything else.
  try {
    const realityCheck = await gemini.generateRealisticExpectationsMessage(updatedUser);
    if (realityCheck) await messaging.sendText(phone, realityCheck);
  } catch (err) {
    console.error('Error generating realistic expectations message:', err);
  }

  await messaging.sendText(phone, messages.mealReminderConsentQuestion(updatedUser.language));
}

async function handleOnboarding(user, body, media) {
  const phone = user.phone;
  const text = (body || '').trim();

  // Stage 7 & 8 removed: No more mode selection. Flow goes directly from
  // AWAITING_COMMITMENT → AWAITING_PAYMENT with tier selection (Basic / Pro).
  // The AWAITING_MODE_SELECTION state is no longer used.

  // Stage 9: Awaiting Payment + Tier Selection
  if (user.state === states.AWAITING_PAYMENT) {
    const lower = text.toLowerCase().trim();

    // --- Tier selection: user picks Basic or Pro ---
    // Bug fix: this used to guard on `!user.tier`, but the `tier` column's DB
    // default is the STRING 'free' (schema.sql), never null/undefined — so
    // `!user.tier` was always false and these branches could never fire for any
    // new user. 'free' is only ever the pre-selection sentinel here (no one
    // actively "picks" it), so the correct check is against that sentinel value.
    const tierUnselected = !user.tier || user.tier === 'free';

    if ((lower === '1' || /\bbasic\b/i.test(lower)) && tierUnselected) {
      db.updateUser(user.id, { tier: 'basic' });
      await messaging.sendText(phone, messages.t(user.language, 'depositAsk', { name: user.name, tier: 'basic' }));
      const link = getPaymentLinkForTier('basic');
      if (link) {
        await messaging.sendText(phone, messages.t(user.language, 'paymentLink', link));
      }
      return;
    }

    if ((lower === '2' || /\bpro\b/i.test(lower)) && tierUnselected) {
      db.updateUser(user.id, { tier: 'pro' });
      await messaging.sendText(phone, messages.t(user.language, 'depositAsk', { name: user.name, tier: 'pro' }));
      const link = getPaymentLinkForTier('pro');
      if (link) {
        await messaging.sendText(phone, messages.t(user.language, 'paymentLink', link));
      }
      return;
    }

    // --- Promo code: free trial access, no payment needed ---
    if (text.trim().toUpperCase() === PROMO_CODE) {
      if (user.promo_code_used) {
        await messaging.sendText(phone, 'That promo code has already been used on this account. Reply "1" for Basic or "2" for Pro, then send "paid" once your deposit is done.');
        return;
      }
      const today = todayStr(config.timezone);
      const updated = db.updateUser(user.id, {
        accountability_mode: 'accountability',
        deposit_status: 'trial',
        tier: 'pro',
        started_at: today,
        day_count: 0,
        trial_expires_at: addDaysStr(today, PROMO_TRIAL_DAYS),
        promo_code_used: PROMO_CODE,
        state: states.AWAITING_NUTRITION_CHOICE,
      });
      const timeStr = updated.checkin_time || '08:00';
      const actStr = updated.activity || 'workout';
      await messaging.sendText(phone, `Promo code accepted — you've got full Pro access free for ${PROMO_TRIAL_DAYS} days, no deposit needed.`);
      await messaging.sendText(phone, messages.t(user.language, 'paidConfirmed', timeStr, actStr, 'pro'));
      await messaging.sendText(phone, promptNutritionChoice(user));
      return;
    }

    // --- Payment confirmation ---
    if (/\bpaid\b/i.test(lower)) {
      // If they never actually selected a tier (still at the 'free' sentinel),
      // don't silently guess for them — ask first, since this was the source of
      // repeated "why is my account on the wrong tier" confusion.
      if (tierUnselected) {
        await messaging.sendText(phone, 'Which plan are you paying for? Reply "1" for Basic or "2" for Pro first, then send "paid".');
        return;
      }
      const activeTier = user.tier;
      const today = todayStr(config.timezone);
      const updated = db.updateUser(user.id, {
        accountability_mode: 'accountability',
        deposit_status: 'paid',
        tier: activeTier,
        started_at: today,
        day_count: 0,
        state: states.AWAITING_NUTRITION_CHOICE,
      });
      const timeStr = updated.checkin_time || '08:00';
      const actStr = updated.activity || 'workout';
      await messaging.sendText(phone, messages.t(user.language, 'paidConfirmed', timeStr, actStr, activeTier));
      await messaging.sendText(phone, promptNutritionChoice(user));
      return;
    }

    // --- Question handling (Bug 4 fix preserved) ---
    const questionCheck = isOffTopicQuestion(text);
    if (questionCheck && questionCheck.isGymQ && !questionCheck.isPaymentQ) {
      const aiReply = await gemini.handleGeneralQuery(user, text);
      if (aiReply) {
        await messaging.sendText(phone, aiReply +
          '\n\nWhenever you\'re ready: reply "1" for Basic or "2" for Pro, then send "paid" once your deposit is done.');
      }
    } else {
      const aiReply = await gemini.answerPaymentAndTermsQuery({ user, message: text, history: [] });
      if (aiReply) {
        await messaging.sendText(phone, aiReply);
      } else {
        await messaging.sendText(phone, messages.t(user.language, 'notPaidYet'));
      }
    }
    return;
  }

  // Stage 9.5: Awaiting Nutrition Choice (AI Plan vs User's Own Plan)
  if (user.state === states.AWAITING_NUTRITION_CHOICE) {
    const hasImage = media && (media.mediaUrl || media.testBase64);
    const lower = text.toLowerCase();

    if (hasImage) {
      // User directly sent a photo of their diet chart
      const resolved = await resolveImage(media);
      let planText;
      try {
        planText = await gemini.parseDietChartImage({
          imageBase64: resolved.base64,
          mimeType: resolved.mimeType,
          user,
        });
      } catch (err) {
        console.error('Error parsing diet chart image:', err);
        planText = "Here's your reviewed diet chart.\n\nI have logged what I could read from the photo.";
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        nutrition_photo_ref: media.mediaUrl || 'uploaded_photo',
        state: states.AWAITING_NUTRITION_PLAN_CONFIRMATION,
      });

      await deliverPlanForConfirmation(updated, planText);
      return;
    }

    if (lower === '1' || lower.includes('create') || lower.includes('ai') || lower.includes('tailored') || lower.includes('yes') || lower.includes('make plan')) {
      // User wants tailored AI Nutrition Plan
      await messaging.sendText(phone, 'Building your tailored nutrition plan based on your metrics and goals...');
      let planText;
      try {
        planText = await gemini.generateTailoredNutritionPlan(user);
      } catch (err) {
        console.error('Error generating tailored nutrition plan:', err);
        planText = 'Here is your personalized nutrition target based on your goals.';
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'ai_generated',
        state: states.AWAITING_NUTRITION_PLAN_CONFIRMATION,
      });

      await deliverPlanForConfirmation(updated, planText);
      return;
    } else if (lower === '2' || lower.includes('own') || lower.includes('my plan') || lower.includes('already') || lower.includes('have plan') || lower.includes('custom')) {
      // User has their own plan
      db.updateUser(user.id, {
        state: states.AWAITING_USER_NUTRITION_PLAN,
      });
      await messaging.sendText(phone, 'Great! Please share your nutrition plan.\n\nYou can text the details (e.g. what you eat for breakfast, lunch, dinner) OR send a photo of your diet chart/meal sheet.');
      return;
    } else if (text.length > 20 || /(breakfast|lunch|dinner|eggs|oats|rice|chicken|roti|paneer|dal|protein)/i.test(lower)) {
      // User directly provided their diet plan text
      let planText;
      try {
        planText = await gemini.parseUserProvidedDietPlan({ text, user });
      } catch (err) {
        console.error('Error parsing user provided diet plan:', err);
        planText = `Here's your reviewed nutrition plan:\n${text}`;
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        state: states.AWAITING_NUTRITION_PLAN_CONFIRMATION,
      });

      await deliverPlanForConfirmation(updated, planText);
      return;
    } else {
      // Bug 6 fix: AWAITING_NUTRITION_CHOICE catch-all previously sent a canned
      // "reply 1 or 2" response for all unrecognised input, including genuine questions.
      // Now: questions get an AI answer first, then the prompt is re-appended.
      const questionCheck = isOffTopicQuestion(text);
      if (questionCheck) {
        const aiReply = await gemini.handleGeneralQuery(user, text);
        if (aiReply) {
          await messaging.sendText(phone, aiReply +
            '\n\nWhenever ready: Reply "1" for a customized AI Nutrition Plan, or "2" to share your own plan.');
        }
      } else {
        await messaging.sendText(phone, 'Reply "1" for a tailored AI Nutrition Plan, or "2" to provide your own nutrition plan (via text or photo).');
      }
      return;
    }
  }

  // Stage 9.6: Awaiting User's Own Nutrition Plan (Text or Photo)
  if (user.state === states.AWAITING_USER_NUTRITION_PLAN) {
    const hasImage = media && (media.mediaUrl || media.testBase64);

    if (hasImage) {
      const resolved = await resolveImage(media);
      let planText;
      try {
        planText = await gemini.parseDietChartImage({
          imageBase64: resolved.base64,
          mimeType: resolved.mimeType,
          user,
        });
      } catch (err) {
        console.error('Error parsing diet chart image:', err);
        planText = "Here's your reviewed diet chart.\n\nI have logged what I could read from the photo.";
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        nutrition_photo_ref: media.mediaUrl || 'uploaded_photo',
        state: states.AWAITING_NUTRITION_PLAN_CONFIRMATION,
      });

      await deliverPlanForConfirmation(updated, planText);
      return;
    } else {
      let planText;
      try {
        planText = await gemini.parseUserProvidedDietPlan({ text, user });
      } catch (err) {
        console.error('Error parsing user provided diet plan:', err);
        planText = `Here's your reviewed nutrition plan:\n${text}`;
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        state: states.AWAITING_NUTRITION_PLAN_CONFIRMATION,
      });

      await deliverPlanForConfirmation(updated, planText);
      return;
    }
  }

  // Stage 9.65: Awaiting Nutrition Plan Confirmation — the plan shown above is not
  // final until the user confirms it or asks for changes. This closes the gap where
  // the plan text invited feedback ("let me know if you want swaps") but the flow
  // moved straight on to Day 1 delivery without ever waiting for a reply.
  if (user.state === states.AWAITING_NUTRITION_PLAN_CONFIRMATION) {
    const lower = text.toLowerCase().trim();
    const isConfirm = lower === '1' ||
      /\b(confirm|confirmed|yes|yeah|yep|sure|ok|okay|good|great|perfect|fine|looks good|works|correct|seri|aama|haan|thik hai|theek hai)\b/i.test(lower);

    if (isConfirm) {
      const updated = db.updateUser(user.id, { state: states.AWAITING_MEAL_REMINDER_CONSENT });
      await deliverDay1AndAskReminderConsent(updated);
      return;
    }

    // A genuinely off-topic (non-diet) question gets answered, then the confirm prompt repeats.
    const questionCheck = isOffTopicQuestion(text);
    if (questionCheck && !questionCheck.isGymQ) {
      const aiReply = await gemini.handleGeneralQuery(user, text);
      if (aiReply) {
        await messaging.sendText(phone, aiReply + '\n\n' + messages.nutritionPlanConfirmPrompt(user.language));
      }
      return;
    }

    // Anything else (including diet/food-related replies) is treated as a change
    // request against the current plan — e.g. "swap chicken for paneer", "less rice".
    let updatedPlan;
    try {
      updatedPlan = await gemini.refineNutritionPlan({
        user,
        currentPlan: user.nutrition_plan || '',
        changeRequest: text,
      });
    } catch (err) {
      console.error('Error refining nutrition plan:', err);
      await messaging.sendText(phone, "Sorry, I had trouble updating that — could you rephrase the change you want?");
      return;
    }

    db.updateUser(user.id, { nutrition_plan: updatedPlan });
    await deliverPlanForConfirmation(user, updatedPlan);
    return;
  }

  // Stage 9.7: Awaiting Meal Reminder Consent — "Should I remind you to track your calories?"
  if (user.state === states.AWAITING_MEAL_REMINDER_CONSENT) {
    const lower = text.toLowerCase().trim();

    if (lower === '1' || /\b(yes|yeah|yep|sure|ok|okay|haan|aama|seri|venum)\b/i.test(lower)) {
      db.updateUser(user.id, { state: states.AWAITING_MEAL_REMINDER_TIMES });
      await messaging.sendText(phone, messages.mealReminderTimesPrompt(user.language));
      return;
    }
    if (lower === '2' || /\b(no|nope|nah|illa|nahi|venda)\b/i.test(lower)) {
      db.updateUser(user.id, { meal_reminder_optin: 'no', state: states.AWAITING_SELF_TRACKING_CONSENT });
      await messaging.sendText(phone, messages.selfTrackingConsentQuestion(user.language));
      return;
    }

    const questionCheck = isOffTopicQuestion(text);
    if (questionCheck) {
      const aiReply = await gemini.handleGeneralQuery(user, text);
      if (aiReply) {
        await messaging.sendText(phone, aiReply + '\n\n' + messages.mealReminderConsentQuestion(user.language));
      }
      return;
    }

    // Unclear reply — re-ask
    await messaging.sendText(phone, messages.mealReminderConsentQuestion(user.language));
    return;
  }

  // Stage 9.8: Awaiting Meal Reminder Times — user asked for reminders, now say when
  if (user.state === states.AWAITING_MEAL_REMINDER_TIMES) {
    // Bug fix: this used to hand ANY reply straight to parseMealReminderTimes,
    // which is instructed to fall back to default times (09:00/13:30/20:30)
    // whenever it can't find real times in the text. That's correct for a
    // genuinely vague answer ("whenever, you decide"), but it also silently
    // fired — and locked in — for outright questions like "Is it daily
    // reminders?", answering nothing and never actually asking again. Every
    // other onboarding state in this file guards on isOffTopicQuestion first;
    // this one didn't.
    const questionCheck = isOffTopicQuestion(text);
    if (questionCheck) {
      const aiReply = await gemini.handleGeneralQuery(user, text);
      if (aiReply) {
        await messaging.sendText(phone, aiReply + '\n\n' + messages.mealReminderTimesPrompt(user.language));
      }
      return;
    }

    let times;
    try {
      times = await gemini.parseMealReminderTimes(text, config.timezone);
    } catch (err) {
      console.error('Error parsing meal reminder times:', err);
      times = { breakfast: '09:00', lunch: '13:30', dinner: '20:30', snacks: [] };
    }

    db.updateUser(user.id, {
      meal_reminder_optin: 'yes',
      meal_reminder_times: JSON.stringify(times),
      state: states.ACTIVE,
    });

    const parts = [`Breakfast ${times.breakfast}`, `Lunch ${times.lunch}`, `Dinner ${times.dinner}`];
    if (times.snacks && times.snacks.length > 0) parts.push(`Snacks ${times.snacks.join(', ')}`);
    await messaging.sendText(phone, messages.mealReminderConfirmed(user.language, parts.join(' | ')));
    return;
  }

  // Stage 9.9: Awaiting Self-Tracking Consent — user declined reminders, will they self-log?
  if (user.state === states.AWAITING_SELF_TRACKING_CONSENT) {
    const lower = text.toLowerCase().trim();

    // Override: catches replies like "no I can't, that's why I need you to remind me" —
    // the bare word "no" in there used to get misread as a second refusal (see below),
    // even though the sentence is clearly asking for reminders. Any mention of
    // reminders takes priority over yes/no keyword matching and routes straight back
    // to the reminder-times flow.
    const wantsRemindersAfterAll = /\b(remind|reminde?rs?|remaind(?:er|ers)?)\b/i.test(lower);
    if (wantsRemindersAfterAll) {
      db.updateUser(user.id, { tracking_decline_count: 0, state: states.AWAITING_MEAL_REMINDER_TIMES });
      await messaging.sendText(phone, messages.mealReminderTimesPrompt(user.language));
      return;
    }

    if (lower === '1' || /\b(yes|yeah|yep|sure|ok|okay|haan|aama|seri)\b/i.test(lower)) {
      db.updateUser(user.id, { self_tracking_optin: 'yes', tracking_decline_count: 0, state: states.ACTIVE });
      await messaging.sendText(phone, messages.selfTrackingConfirmed(user.language));
      return;
    }

    if (lower === '2' || /\b(no|nope|nah|illa|nahi)\b/i.test(lower)) {
      const declineCount = (user.tracking_decline_count || 0) + 1;
      if (declineCount === 1) {
        // First refusal: warn about the risk, then give them one more chance to reconsider
        db.updateUser(user.id, { tracking_decline_count: declineCount });
        await messaging.sendText(phone, messages.trackingDeclinedWarning(user.language));
        return;
      }
      // Second refusal: respect the final decision and move on — no infinite nagging
      db.updateUser(user.id, {
        self_tracking_optin: 'no',
        tracking_decline_count: declineCount,
        state: states.ACTIVE,
      });
      await messaging.sendText(phone, messages.trackingDeclinedFinal(user.language));
      return;
    }

    const questionCheck = isOffTopicQuestion(text);
    if (questionCheck) {
      const aiReply = await gemini.handleGeneralQuery(user, text);
      if (aiReply) {
        await messaging.sendText(phone, aiReply + '\n\n' + messages.selfTrackingConsentQuestion(user.language));
      }
      return;
    }

    // Unclear reply — re-ask
    await messaging.sendText(phone, messages.selfTrackingConsentQuestion(user.language));
    return;
  }

  // Stage 6: Awaiting User Commitment
  if (user.state === states.AWAITING_COMMITMENT) {
    // Bug 1 fix preserved: off-topic questions are answered first; state does NOT advance.
    const questionCheck = isOffTopicQuestion(text);
    if (questionCheck) {
      const isPaymentQ = questionCheck.isPaymentQ;
      const aiReply = isPaymentQ
        ? await gemini.answerPaymentAndTermsQuery({ user, message: text, history: [] })
        : await gemini.handleGeneralQuery(user, text);
      if (aiReply) {
        await messaging.sendText(phone, aiReply +
          '\n\nWhenever you\'re ready, share your commitment statement.');
      }
      return;
    }

    const commitment = text;
    const updated = db.updateUser(user.id, {
      commitment_text: commitment,
      vision_text: commitment,
      accountability_mode: 'accountability',  // single mode now
      state: states.AWAITING_PAYMENT,
    });

    // Acknowledge commitment, then immediately show tier selection
    await messaging.sendText(phone, `Commitment locked in:\n"${commitment}"`);
    await sendTierSelectionAsk(updated);
    return;
  }

  if (user.state === states.AWAITING_TIMETABLE) {
    await handleTimetableSetup(user, text);
    return;
  }

  // Stages 1 to 5: Diagnosis & Baseline Collection
  const currentProfile = {
    name: user.name || null,
    language: user.language || null,
    goal: user.goal || null,
    experience_level: user.experience_level || null,
    activity: user.activity || null,
    workout_location: user.workout_location || null,
    home_equipment: user.home_equipment || null,
    height: user.height || null,
    weight: user.weight || null,
    days_per_week: user.days_per_week !== null && user.days_per_week !== undefined ? user.days_per_week : null,
    goal_timeframe: user.goal_timeframe || null,
    timetable: user.timetable || null,
    checkin_time: user.checkin_time || null,
    diet_summary: user.diet_summary || null,
    allergy: user.allergy || null,
    diet_restrictions: user.diet_restrictions || null,
    blocker_text: user.blocker_text || null,
    sleep_hours: user.sleep_hours || null,
    injuries: user.injuries || null,
  };

  // Parse existing onboarding history
  let history = [];
  try {
    history = JSON.parse(user.onboarding_history || '[]');
  } catch (err) {
    history = [];
  }

  let result;
  try {
    result = await gemini.conductOnboardingInterview({
      currentProfile,
      message: text,
      history,
      user,
    });
  } catch (err) {
    console.error('Error conducting onboarding interview:', err);
    await messaging.sendText(phone, "Sorry, please say that again.");
    return;
  }

  const { extracted, is_profile_complete, reply } = result;

  // Update history
  history.push({ role: 'user', text });
  history.push({ role: 'model', text: reply });
  if (history.length > 14) {
    history = history.slice(-14);
  }

  // Merge extracted fields and build the updated profile
  const fieldsToUpdate = {
    onboarding_history: JSON.stringify(history),
  };
  for (const key of Object.keys(currentProfile)) {
    if (extracted[key] !== undefined && extracted[key] !== null && extracted[key] !== '') {
      if (key === 'timetable') {
        // Kept as a raw object/string here — normalized to JSON string after validation below.
        fieldsToUpdate.timetable = extracted.timetable;
      } else {
        fieldsToUpdate[key] = extracted[key];
      }
    }
  }

  // Validate/repair the timetable so its workout-day count always matches days_per_week
  // exactly, using a goal-appropriate split template — the model doesn't always land on
  // the correct day count purely from prose instructions (this was the root cause of
  // mismatched splits at low day counts like 2 days/week).
  if (fieldsToUpdate.timetable) {
    const { ensureValidTimetable } = require('../knowledge/splitTemplates');
    const finalActivity = fieldsToUpdate.activity || currentProfile.activity;
    const finalGoal = fieldsToUpdate.goal || currentProfile.goal;
    const finalDaysPerWeek = fieldsToUpdate.days_per_week !== undefined ? fieldsToUpdate.days_per_week : currentProfile.days_per_week;

    let parsedTimetable = fieldsToUpdate.timetable;
    if (typeof parsedTimetable === 'string') {
      try { parsedTimetable = JSON.parse(parsedTimetable); } catch (e) { parsedTimetable = null; }
    }

    const validated = ensureValidTimetable(parsedTimetable, finalActivity, finalGoal, finalDaysPerWeek);
    fieldsToUpdate.timetable = JSON.stringify(validated);
  }

  let updatedUser = user;
  if (Object.keys(fieldsToUpdate).length > 0) {
    updatedUser = db.updateUser(user.id, fieldsToUpdate);
  }

  // Check if all variables are collected
  const isComplete =
    is_profile_complete ||
    (
      Boolean(updatedUser.name) &&
      Boolean(updatedUser.goal) &&
      Boolean(updatedUser.experience_level) &&
      Boolean(updatedUser.activity) &&
      Boolean(updatedUser.height) &&
      Boolean(updatedUser.weight) &&
      updatedUser.days_per_week !== null &&
      updatedUser.days_per_week !== undefined &&
      Boolean(updatedUser.goal_timeframe) &&
      Boolean(updatedUser.timetable && updatedUser.timetable !== '{}' && updatedUser.timetable !== 'null') &&
      Boolean(updatedUser.checkin_time) &&
      Boolean(updatedUser.diet_summary) &&
      Boolean(updatedUser.allergy || updatedUser.diet_restrictions) &&
      Boolean(updatedUser.blocker_text) &&
      updatedUser.sleep_hours !== null &&
      updatedUser.sleep_hours !== undefined &&
      Boolean(updatedUser.injuries)
    );

  // If onboarding is complete, split plan delivery and commitment ask into 2 distinct messages
  if (isComplete) {
    let planPart = reply;
    let commitmentPart = null;

    if (reply && reply.includes('---')) {
      const parts = reply.split('---');
      planPart = parts[0].trim();
      commitmentPart = parts.slice(1).join('---').trim();
    } else if (reply && (reply.includes('Your plan is ready') || reply.includes('One thing I need') || reply.includes('committing to consistently') || reply.includes('commitment statement'))) {
      const splitRegex = /\n\s*(?:---+|\*\*\*+)?\s*(Your plan is ready|One thing I need from you|Unga plan ready|Aapka plan ready|உங்கள் திட்டம் தயார்)/i;
      const match = reply.search(splitRegex);
      if (match !== -1) {
        planPart = reply.substring(0, match).trim();
        commitmentPart = reply.substring(match).replace(/^[\s\-\*]+/, '').trim();
      }
    }

    if (planPart) {
      await messaging.sendText(phone, planPart);
    }

    // Deliver the commitment ask as a distinct, dedicated second message
    const commitmentMsg = commitmentPart || messages.question(updatedUser.language || 'en', 'commitment_ask');
    await messaging.sendText(phone, commitmentMsg);

    // Move to Stage 6: Awaiting Commitment
    db.updateUser(user.id, {
      state: states.AWAITING_COMMITMENT,
      onboarding_history: '[]',
    });
  } else {
    // Regular onboarding turn
    if (reply) {
      await messaging.sendText(phone, reply);
    }
  }
}

async function handleTimetableSetup(user, body) {
  const phone = user.phone;
  let currentTimetable = null;
  try {
    currentTimetable = JSON.parse(user.timetable);
  } catch (err) {
    currentTimetable = null;
  }

  try {
    const chatHistory = db.getChatMessages(user.id, 20);
    const result = await gemini.conductTimetableInterview({
      currentTimetable,
      message: body.trim(),
      goal: user.goal,
      activity: user.activity,
      language: user.language,
      chatHistory,
      daysPerWeek: user.days_per_week,
      checkinTime: user.checkin_time,
      user,
    });

    const { ensureValidTimetable } = require('../knowledge/splitTemplates');
    const validatedTimetable = ensureValidTimetable(result.timetable, user.activity, result.goal || user.goal, user.days_per_week);

    const fieldsToUpdate = {
      timetable: JSON.stringify(validatedTimetable),
      goal: result.goal,
    };
    if (result.target_muscle) fieldsToUpdate.target_muscle = result.target_muscle;
    if (result.allergy) fieldsToUpdate.allergy = result.allergy;

    if (result.confirmed) {
      fieldsToUpdate.state = states.ACTIVE;
      db.updateUser(user.id, fieldsToUpdate);
      await messaging.sendText(phone, result.reply || messages.t(user.language, 'paidConfirmed', user.checkin_time, user.activity));
    } else {
      db.updateUser(user.id, fieldsToUpdate);
      await messaging.sendText(phone, result.reply);
    }
  } catch (err) {
    console.error('Error in handleTimetableSetup:', err);
    await messaging.sendText(phone, "Please describe your preferred workout days and timings.");
  }
}

module.exports = { handleOnboarding, sendTierSelectionAsk, handleTimetableSetup };
