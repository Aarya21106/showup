/**
 * Deposit-payment activation logic — pulled out into its own neutral module
 * so both routes/payments.js (the webhook handler) and
 * conversation/onboarding.js (the reconciliation fallback in the "paid" text
 * branch) can share the EXACT same activation code without requiring each
 * other directly, which would create a circular require (payments.js already
 * needed something from onboarding.js, and onboarding.js now needs something
 * from payments.js too — this file breaks that cycle).
 */
const db = require('../db/db');
const states = require('../conversation/states');
const messages = require('../conversation/messages');
const messaging = require('./messaging');
const config = require('../config');
const { todayStr } = require('../utils/date');

function promptNutritionChoice(user) {
  return (
    `One more thing before we kick off Day 1: let's get your nutrition locked in.\n\n` +
    `Do you want me to create a tailored nutrition plan for you, or do you already follow your own diet plan?\n\n` +
    `1. Create a customized AI Nutrition Plan for me\n` +
    `2. I have my own nutrition plan (reply with text or send a photo of your diet chart)`
  );
}

/**
 * Applies a confirmed-paid deposit to a user's account — logs the payment
 * and activates the account. Shared by the webhook handler AND the
 * reconciliation fallback (razorpay.findPaidDepositLinkForUser) so both
 * paths apply the exact same activation logic instead of two versions
 * silently drifting apart. Idempotent: returns false without side effects
 * if this exact payment was already processed or the deposit is already paid.
 */
async function applyDepositPayment({ user, tier, amountInr, razorpayPaymentId, razorpayLinkId }) {
  if (razorpayPaymentId && db.getPaymentsForUser(user.id).some((p) => p.razorpay_payment_id === razorpayPaymentId)) {
    return false;
  }
  if (user.deposit_status === 'paid') return false;

  const activeTier = tier === 'basic' ? 'basic' : 'pro';
  const today = todayStr(config.timezone);

  db.logPayment({
    userId: user.id,
    razorpayPaymentId,
    razorpayLinkId,
    type: 'deposit',
    tier: activeTier,
    amountInr,
    status: 'captured',
  });

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
  await messaging.sendText(updated.phone, messages.t(updated.language, 'paidConfirmed', timeStr, actStr, activeTier));
  await messaging.sendText(updated.phone, promptNutritionChoice(updated));
  return true;
}

module.exports = { promptNutritionChoice, applyDepositPayment };
