const fs = require('fs');
const path = require('path');
const states = require('./states');
const messages = require('./messages');
const db = require('../db/db');
const gemini = require('../services/gemini');
const messaging = require('../services/messaging');
const config = require('../config');
const { todayStr } = require('../utils/date');

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

async function sendPlanAndDepositAsk(user) {
  await messaging.sendText(user.phone, messages.t(user.language, 'depositAsk', {
    name: user.name,
    amt: config.depositAmountInr,
    refund: config.fullPayoutInr,
    penalty: config.slipPenaltyInr,
    days: config.pledgeDays,
  }));
  if (config.paymentLinkUrl) {
    await messaging.sendText(user.phone, messages.t(user.language, 'paymentLink', config.paymentLinkUrl));
  } else {
    console.warn('PAYMENT_LINK_URL is not set - skipped sending payment link to', user.phone);
  }
}

async function handleOnboarding(user, body, media) {
  const phone = user.phone;
  const text = (body || '').trim();

  // Stage 7 & 8: Awaiting Mode Selection
  if (user.state === states.AWAITING_MODE_SELECTION) {
    const lower = text.toLowerCase();
    if (lower === '1' || lower.includes('accountability') || lower.includes('stake') || lower.includes('deposit')) {
      // User chose Accountability Mode (financial commitment)
      const updated = db.updateUser(user.id, {
        accountability_mode: 'accountability',
        state: states.AWAITING_PAYMENT,
      });
      await sendPlanAndDepositAsk(updated);
      return;
    } else if (lower === '2' || lower.includes('coach') || lower.includes('no-stake') || lower.includes('no stake') || lower.includes('free')) {
      // User chose Free Coach Mode (zero stake)
      const today = todayStr(config.timezone);
      db.updateUser(user.id, {
        accountability_mode: 'coach_only',
        deposit_status: 'free',
        started_at: today,
        day_count: 0,
        state: states.AWAITING_NUTRITION_CHOICE,
      });
      await messaging.sendText(phone, messages.t(user.language, 'coachModeConfirmed', user.checkin_time, user.activity));
      await messaging.sendText(phone, promptNutritionChoice(user));
      return;
    } else {
      // User asked a question about modes/terms/refunds
      const aiReply = await gemini.answerPaymentAndTermsQuery({ user, message: text, history: [] });
      if (aiReply) {
        await messaging.sendText(phone, aiReply + '\n\nReply "1" for Accountability Mode (₹300 refundable deposit) or "2" for Coach Mode (free tracking).');
      } else {
        await messaging.sendText(phone, 'Reply "1" for Accountability Mode (₹300 refundable deposit) or "2" for Coach Mode (free tracking).');
      }
      return;
    }
  }

  // Stage 9: Awaiting Payment (for Accountability Mode)
  if (user.state === states.AWAITING_PAYMENT) {
    if (/\bpaid\b/i.test(text)) {
      const today = todayStr(config.timezone);
      db.updateUser(user.id, {
        deposit_status: 'paid',
        started_at: today,
        day_count: 0,
        state: states.AWAITING_NUTRITION_CHOICE,
      });
      const timeStr = user.checkin_time || '08:00';
      const actStr = user.activity || 'workout';
      await messaging.sendText(phone, messages.t(user.language, 'paidConfirmed', timeStr, actStr));
      await messaging.sendText(phone, promptNutritionChoice(user));
      return;
    } else if (text === '2' || /\b(switch to coach mode|coach mode|free|no-stake|no stake)\b/i.test(text)) {
      // Switch from payment to free Coach Mode
      const today = todayStr(config.timezone);
      db.updateUser(user.id, {
        accountability_mode: 'coach_only',
        deposit_status: 'free',
        started_at: today,
        day_count: 0,
        state: states.AWAITING_NUTRITION_CHOICE,
      });
      await messaging.sendText(phone, messages.t(user.language, 'coachModeConfirmed', user.checkin_time, user.activity));
      await messaging.sendText(phone, promptNutritionChoice(user));
      return;
    } else {
      const aiReply = await gemini.answerPaymentAndTermsQuery({ user, message: text, history: [] });
      if (aiReply) {
        await messaging.sendText(phone, aiReply);
      } else {
        await messaging.sendText(phone, messages.t(user.language, 'notPaidYet'));
      }
      return;
    }
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
        planText = 'Diet Chart Received & Saved in your profile.';
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        nutrition_photo_ref: media.mediaUrl || 'uploaded_photo',
        state: states.ACTIVE,
      });

      await messaging.sendText(phone, planText);

      // Deliver Day 1 kickoff
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) await messaging.sendText(phone, day1);
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
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
        planText = 'Your personalized nutrition target is locked in.';
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'ai_generated',
        state: states.ACTIVE,
      });

      await messaging.sendText(phone, planText);

      // Deliver Day 1 kickoff
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) await messaging.sendText(phone, day1);
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
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
        planText = `Your Custom Nutrition Plan is locked in:\n${text}`;
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        state: states.ACTIVE,
      });

      await messaging.sendText(phone, planText);

      // Deliver Day 1 kickoff
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) await messaging.sendText(phone, day1);
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
      return;
    } else {
      await messaging.sendText(phone, 'Reply "1" for a tailored AI Nutrition Plan, or "2" to provide your own nutrition plan (via text or photo).');
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
        planText = 'Diet Chart Received & Saved in your profile.';
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        nutrition_photo_ref: media.mediaUrl || 'uploaded_photo',
        state: states.ACTIVE,
      });

      await messaging.sendText(phone, planText);

      // Deliver Day 1 kickoff
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) await messaging.sendText(phone, day1);
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
      return;
    } else {
      let planText;
      try {
        planText = await gemini.parseUserProvidedDietPlan({ text, user });
      } catch (err) {
        console.error('Error parsing user provided diet plan:', err);
        planText = `Your Custom Nutrition Plan is locked in:\n${text}`;
      }

      const updated = db.updateUser(user.id, {
        nutrition_plan: planText,
        nutrition_plan_source: 'user_provided',
        state: states.ACTIVE,
      });

      await messaging.sendText(phone, planText);

      // Deliver Day 1 kickoff
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) await messaging.sendText(phone, day1);
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
      return;
    }
  }

  // Stage 6: Awaiting User Commitment
  if (user.state === states.AWAITING_COMMITMENT) {
    const commitment = text;
    db.updateUser(user.id, {
      commitment_text: commitment,
      vision_text: commitment,
      state: states.AWAITING_MODE_SELECTION,
    });
    
    // Acknowledge self-generated commitment & present Stage 7 & 8
    const introMsg = messages.t(user.language, 'accountabilityIntro', { name: user.name });
    await messaging.sendText(phone, `Commitment locked in:\n"${commitment}"\n\n${introMsg}`);
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
        fieldsToUpdate.timetable = typeof extracted.timetable === 'object' ? JSON.stringify(extracted.timetable) : extracted.timetable;
      } else {
        fieldsToUpdate[key] = extracted[key];
      }
    }
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
      Boolean(updatedUser.timetable && updatedUser.timetable !== '{}' && updatedUser.timetable !== 'null') &&
      Boolean(updatedUser.checkin_time) &&
      Boolean(updatedUser.diet_summary) &&
      Boolean(updatedUser.allergy || updatedUser.diet_restrictions) &&
      Boolean(updatedUser.blocker_text) &&
      updatedUser.sleep_hours !== null &&
      updatedUser.sleep_hours !== undefined &&
      Boolean(updatedUser.injuries)
    );

  // Send Gemini's reply
  if (reply) {
    await messaging.sendText(phone, reply);
  }

  if (isComplete) {
    // Move to Stage 6: Awaiting Commitment
    db.updateUser(user.id, {
      state: states.AWAITING_COMMITMENT,
      onboarding_history: '[]',
    });
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

    const fieldsToUpdate = {
      timetable: JSON.stringify(result.timetable),
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

module.exports = { handleOnboarding, sendPlanAndDepositAsk, handleTimetableSetup };

