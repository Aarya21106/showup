const states = require('./states');
const messages = require('./messages');
const db = require('../db/db');
const gemini = require('../services/gemini');
const messaging = require('../services/messaging');
const config = require('../config');
const { todayStr } = require('../utils/date');

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

async function handleOnboarding(user, body) {
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
      const updated = db.updateUser(user.id, {
        accountability_mode: 'coach_only',
        deposit_status: 'free',
        started_at: today,
        day_count: 0,
        state: states.ACTIVE,
      });
      await messaging.sendText(phone, messages.t(user.language, 'coachModeConfirmed', user.checkin_time, user.activity));
      
      // Stage 10: Immediately deliver Day 1
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) {
          await messaging.sendText(phone, day1);
        }
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
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
      const updated = db.updateUser(user.id, {
        deposit_status: 'paid',
        started_at: today,
        day_count: 0,
        state: states.ACTIVE,
      });
      const timeStr = user.checkin_time || '08:00';
      const actStr = user.activity || 'workout';
      await messaging.sendText(phone, messages.t(user.language, 'paidConfirmed', timeStr, actStr));
      
      // Stage 10: Immediately deliver Day 1
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) {
          await messaging.sendText(phone, day1);
        }
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
      return;
    } else if (text === '2' || /\b(switch to coach mode|coach mode|free|no-stake|no stake)\b/i.test(text)) {
      // Switch from payment to free Coach Mode
      const today = todayStr(config.timezone);
      const updated = db.updateUser(user.id, {
        accountability_mode: 'coach_only',
        deposit_status: 'free',
        started_at: today,
        day_count: 0,
        state: states.ACTIVE,
      });
      await messaging.sendText(phone, messages.t(user.language, 'coachModeConfirmed', user.checkin_time, user.activity));
      try {
        const day1 = await gemini.generateDay1Workout(updated);
        if (day1) {
          await messaging.sendText(phone, day1);
        }
      } catch (err) {
        console.error('Error generating Day 1 workout:', err);
      }
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

