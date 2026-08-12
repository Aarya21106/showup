const states = require('./states');
const messages = require('./messages');
const db = require('../db/db');
const gemini = require('../services/gemini');
const whatsapp = require('../services/whatsapp');
const poster = require('../services/poster');
const config = require('../config');
const { todayStr } = require('../utils/date');

async function sendPlanAndDepositAsk(user) {
  const { publicUrl } = await poster.renderPlanPoster({
    userId: user.id,
    name: user.name,
    activity: user.activity,
    days: user.days_per_week,
    time: user.checkin_time,
    blocker: user.blocker_text,
  });

  await whatsapp.sendMedia(user.phone, `${user.name}, here's your pledge.`, publicUrl);
  await whatsapp.sendText(user.phone, messages.t(user.language, 'depositAsk', {
    name: user.name,
    amt: config.depositAmountInr,
    refund: config.fullPayoutInr,
    penalty: config.slipPenaltyInr,
    days: config.pledgeDays,
    blocker: user.blocker_text,
    vision: user.vision_text,
    score: user.commitment_score,
  }));
  await whatsapp.sendText(user.phone, messages.t(user.language, 'howItWorks'));
  if (config.paymentLinkUrl) {
    await whatsapp.sendText(user.phone, messages.t(user.language, 'paymentLink', config.paymentLinkUrl));
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
        deposit_status: 'paid', started_at: today, day_count: 0, state: states.AWAITING_TIMETABLE,
      });
      const timeStr = user.checkin_time || '08:00';
      const actStr = user.activity || 'gym';
      await whatsapp.sendText(phone, messages.t(user.language, 'paidConfirmed', timeStr, actStr));
    } else {
      const aiReply = await gemini.answerPaymentAndTermsQuery({ user, message: body, history: [] });
      if (aiReply) {
        await whatsapp.sendText(phone, aiReply);
      } else {
        await whatsapp.sendText(phone, messages.t(user.language, 'notPaidYet'));
      }
    }
    return;
  }

  if (user.state === states.AWAITING_TIMETABLE) {
    await handleTimetableSetup(user, body);
    return;
  }

  const isCardioActivity = ['running', 'walking', 'cycling'].includes(user.activity);

  let existingWeeklyPlan = null;
  try {
    existingWeeklyPlan = user.weekly_plan ? JSON.parse(user.weekly_plan) : null;
  } catch (e) { existingWeeklyPlan = null; }

  // Construct current profile for checklist
  const currentProfile = {
    name: user.name || null,
    language: user.language || null,
    activity: user.activity || null,
    tier: user.tier || null,
    days_per_week: user.days_per_week !== null && user.days_per_week !== undefined ? user.days_per_week : null,
    checkin_time: user.checkin_time || null,
    blocker_text: user.blocker_text || null,
    vision_text: user.vision_text || null,
    commitment_score: user.commitment_score !== null && user.commitment_score !== undefined ? user.commitment_score : null,
    allergy: user.allergy || null,
    height: user.height !== null && user.height !== undefined ? user.height : null,
    weight: user.weight !== null && user.weight !== undefined ? user.weight : null,
    target_muscle: user.target_muscle || null,
    fitness_app: isCardioActivity ? (user.fitness_app || null) : null,
    weekly_goal_distance_km: isCardioActivity ? (user.weekly_goal_distance_km !== null && user.weekly_goal_distance_km !== undefined ? user.weekly_goal_distance_km : null) : null,
    weekly_plan: isCardioActivity ? existingWeeklyPlan : null,
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
    await whatsapp.sendText(phone, "Sorry, I had a small hiccup. Can you say that again?");
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
      if (key === 'weekly_plan' && Array.isArray(extracted[key])) {
        fieldsToUpdate[key] = JSON.stringify(extracted[key]);
      } else {
        fieldsToUpdate[key] = extracted[key];
      }
    }
  }

  let updatedUser = user;
  if (Object.keys(fieldsToUpdate).length > 0) {
    updatedUser = db.updateUser(user.id, fieldsToUpdate);
  }

  const isPro = updatedUser.tier && updatedUser.tier.startsWith('pro');
  const hasProFields = !isPro || (
    updatedUser.height !== null && updatedUser.height !== undefined &&
    updatedUser.weight !== null && updatedUser.weight !== undefined &&
    updatedUser.target_muscle
  );

  const updatedIsCardio = ['running', 'walking', 'cycling'].includes(updatedUser.activity);
  const hasValidWeeklyPlan = (() => {
    if (!updatedUser.weekly_plan) return false;
    try {
      const plan = JSON.parse(updatedUser.weekly_plan);
      return Array.isArray(plan) && plan.length > 0 && plan.every(a => a.activity && a.days_per_week && a.goal_distance_km);
    } catch (e) { return false; }
  })();
  const hasCardioFields = !updatedIsCardio || (
    updatedUser.fitness_app &&
    (hasValidWeeklyPlan || (updatedUser.weekly_goal_distance_km !== null && updatedUser.weekly_goal_distance_km !== undefined))
  );

  // Check if all required fields are collected
  const isProfileComplete =
    updatedUser.name &&
    updatedUser.language &&
    updatedUser.activity &&
    updatedUser.tier &&
    updatedUser.days_per_week !== null &&
    updatedUser.days_per_week !== undefined &&
    updatedUser.checkin_time &&
    updatedUser.blocker_text &&
    updatedUser.vision_text &&
    updatedUser.commitment_score !== null &&
    updatedUser.commitment_score !== undefined &&
    updatedUser.allergy !== null &&
    updatedUser.allergy !== undefined &&
    hasProFields &&
    hasCardioFields;

  if (isProfileComplete) {
    const updated = db.updateUser(user.id, { state: states.AWAITING_PAYMENT, onboarding_history: '[]' });
    await sendPlanAndDepositAsk(updated);
  } else {
    await whatsapp.sendText(phone, reply);
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
      await whatsapp.sendText(phone, result.reply || messages.t(user.language, 'paidConfirmed', user.checkin_time, user.activity));
    } else {
      db.updateUser(user.id, fieldsToUpdate);
      await whatsapp.sendText(phone, result.reply);
    }
  } catch (err) {
    console.error('Error in handleTimetableSetup:', err);
    await whatsapp.sendText(phone, "Sorry, I had trouble parsing that. Could you describe your target days and timings again?");
  }
}

module.exports = { handleOnboarding, sendPlanAndDepositAsk, handleTimetableSetup };
