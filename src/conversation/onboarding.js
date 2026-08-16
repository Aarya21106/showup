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

  if (user.state === states.AWAITING_PAYMENT) {
    if (/\bpaid\b/i.test(body)) {
      const today = todayStr(config.timezone);
      db.updateUser(user.id, {
        deposit_status: 'paid',
        started_at: today,
        day_count: 0,
        state: states.ACTIVE,
      });
      const timeStr = user.checkin_time || '08:00';
      const actStr = user.activity || 'workout';
      await messaging.sendText(phone, messages.t(user.language, 'paidConfirmed', timeStr, actStr));
    } else {
      const aiReply = await gemini.answerPaymentAndTermsQuery({ user, message: body, history: [] });
      if (aiReply) {
        await messaging.sendText(phone, aiReply);
      } else {
        await messaging.sendText(phone, messages.t(user.language, 'notPaidYet'));
      }
    }
    return;
  }

  if (user.state === states.AWAITING_TIMETABLE) {
    await handleTimetableSetup(user, body);
    return;
  }

  // Construct current profile for checklist
  const currentProfile = {
    name: user.name || null,
    language: user.language || null,
    activity: user.activity || null,
    workout_location: user.workout_location || null,
    home_equipment: user.home_equipment || null,
    experience_level: user.experience_level || null,
    height: user.height || null,
    weight: user.weight || null,
    goal: user.goal || null,
    days_per_week: user.days_per_week !== null && user.days_per_week !== undefined ? user.days_per_week : null,
    checkin_time: user.checkin_time || null,
    supplements: user.supplements || null,
    diet_summary: user.diet_summary || null,
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
      message: body.trim(),
      history,
      user,
    });
  } catch (err) {
    console.error('Error conducting onboarding interview:', err);
    await messaging.sendText(phone, "Sorry, please say that again.");
    return;
  }

  const { extracted, reply } = result;

  // Update history
  history.push({ role: 'user', text: body.trim() });
  history.push({ role: 'model', text: reply });
  if (history.length > 10) {
    history = history.slice(-10);
  }

  // Merge extracted fields and build the updated profile
  const fieldsToUpdate = {
    onboarding_history: JSON.stringify(history),
  };
  for (const key of Object.keys(currentProfile)) {
    if (extracted[key] !== undefined && extracted[key] !== null && extracted[key] !== '') {
      fieldsToUpdate[key] = extracted[key];
    }
  }

  let updatedUser = user;
  if (Object.keys(fieldsToUpdate).length > 0) {
    updatedUser = db.updateUser(user.id, fieldsToUpdate);
  }

  // Check if all required onboarding fields are collected
  const isProfileComplete =
    Boolean(updatedUser.name) &&
    Boolean(updatedUser.activity) &&
    Boolean(updatedUser.workout_location) &&
    (updatedUser.workout_location !== 'home' || Boolean(updatedUser.home_equipment)) &&
    Boolean(updatedUser.experience_level) &&
    Boolean(updatedUser.height) &&
    Boolean(updatedUser.weight) &&
    Boolean(updatedUser.goal) &&
    updatedUser.days_per_week !== null &&
    updatedUser.days_per_week !== undefined &&
    Boolean(updatedUser.checkin_time) &&
    updatedUser.supplements !== null &&
    updatedUser.supplements !== undefined;

  // Always send Gemini's reply (which includes the diet/supplement suggestions when finishing)
  if (reply) {
    await messaging.sendText(phone, reply);
  }

  if (isProfileComplete) {
    const updated = db.updateUser(user.id, { state: states.AWAITING_PAYMENT, onboarding_history: '[]' });
    await sendPlanAndDepositAsk(updated);
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
