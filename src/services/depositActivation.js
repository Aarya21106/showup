/**
 * Deposit + tier-fee payment activation logic — pulled out into its own
 * neutral module so both routes/payments.js (the webhook handler) and
 * conversation/onboarding.js (the reconciliation fallback in the "paid" text
 * branch) can share the EXACT same activation code without requiring each
 * other directly, which would create a circular require.
 *
 * Activating an account (without a promo code) requires TWO separate real
 * payments: the refundable deposit (config.depositAmountInr) AND the first
 * month's tier fee (config.pricing.basic/pro.monthly) — there is no free
 * trial period unless a valid promo code was used instead, which bypasses
 * both charges entirely (handled elsewhere, in onboarding.js's promo branch).
 * Each payment is tracked independently (deposit_status / tier_fee_status);
 * full activation (Day 1 starts, nutrition setup begins) only fires once
 * BOTH are 'paid'.
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

function tierFeeAmount(tier) {
  return tier === 'basic'
    ? (config.testBasicChargeInr || config.pricing.basic.monthly)
    : (config.testProChargeInr || config.pricing.pro.monthly);
}

/**
 * If both the deposit AND the tier fee are now paid, fully activates the
 * account (Day 1 starts, moves into nutrition setup) and returns true.
 * Otherwise leaves state untouched and returns false — the caller is
 * responsible for acknowledging whichever single payment just landed.
 */
async function maybeFullyActivate(user) {
  if (user.deposit_status !== 'paid' || user.tier_fee_status !== 'paid') return false;

  const today = todayStr(config.timezone);
  const updated = db.updateUser(user.id, {
    accountability_mode: 'accountability',
    started_at: today,
    day_count: 0,
    state: states.AWAITING_NUTRITION_CHOICE,
  });

  const timeStr = updated.checkin_time || '08:00';
  const actStr = updated.activity || 'workout';
  await messaging.sendText(updated.phone, messages.t(updated.language, 'paidConfirmed', timeStr, actStr, updated.tier));
  await messaging.sendText(updated.phone, promptNutritionChoice(updated));
  return true;
}

/**
 * Applies a confirmed-paid deposit to a user's account. Shared by the
 * webhook handler AND the reconciliation fallback (findPaidDepositLinkForUser)
 * so both paths apply the exact same logic. Idempotent: returns false without
 * side effects if this exact payment was already processed or the deposit is
 * already marked paid.
 */
async function applyDepositPayment({ user, tier, amountInr, razorpayPaymentId, razorpayLinkId }) {
  if (razorpayPaymentId && db.getPaymentsForUser(user.id).some((p) => p.razorpay_payment_id === razorpayPaymentId)) {
    return false;
  }
  if (user.deposit_status === 'paid') return false;

  const activeTier = tier === 'basic' ? 'basic' : 'pro';

  db.logPayment({
    userId: user.id,
    razorpayPaymentId,
    razorpayLinkId,
    type: 'deposit',
    tier: activeTier,
    amountInr,
    status: 'captured',
  });

  const updated = db.updateUser(user.id, { deposit_status: 'paid', tier: activeTier });

  if (await maybeFullyActivate(updated)) return true;

  await messaging.sendText(
    updated.phone,
    `Deposit received. One more step: pay your first month's ${activeTier === 'pro' ? 'Pro' : 'Basic'} fee (₹${tierFeeAmount(activeTier)}) to fully activate — reply "paid" once you have, or use the link sent earlier.`
  );
  return true;
}

/**
 * Applies a confirmed-paid first-month tier fee to a user's account. Mirror
 * of applyDepositPayment above for the OTHER of the two required charges.
 */
async function applyTierFeePayment({ user, tier, amountInr, razorpayPaymentId, razorpayLinkId }) {
  if (razorpayPaymentId && db.getPaymentsForUser(user.id).some((p) => p.razorpay_payment_id === razorpayPaymentId)) {
    return false;
  }
  if (user.tier_fee_status === 'paid') return false;

  const activeTier = tier === 'basic' ? 'basic' : 'pro';

  db.logPayment({
    userId: user.id,
    razorpayPaymentId,
    razorpayLinkId,
    type: 'initial_fee',
    tier: activeTier,
    amountInr,
    status: 'captured',
  });

  const updated = db.updateUser(user.id, { tier_fee_status: 'paid', tier: activeTier });

  if (await maybeFullyActivate(updated)) return true;

  await messaging.sendText(
    updated.phone,
    `${activeTier === 'pro' ? 'Pro' : 'Basic'} fee received. One more step: pay your ₹${config.depositAmountInr} refundable deposit to fully activate — reply "paid" once you have, or use the link sent earlier.`
  );
  return true;
}

module.exports = { promptNutritionChoice, applyDepositPayment, applyTierFeePayment, tierFeeAmount };
