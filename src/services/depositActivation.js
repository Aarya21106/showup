/**
 * Deposit-payment activation logic — pulled out into its own neutral module
 * so both routes/payments.js (the webhook handler) and
 * conversation/onboarding.js (the reconciliation fallback in the "paid" text
 * branch) can share the EXACT same activation code without requiring each
 * other directly, which would create a circular require.
 *
 * Current rule (business decision, superseding an earlier two-charge model):
 * paying ONLY the refundable deposit (config.depositAmountInr) activates the
 * account with full PRO access for month 1, completely free — no separate
 * tier fee required upfront. Starting month 2, the real subscription price
 * applies (config.pricing.basic/pro.monthly), reduced by the consistency
 * discount earned during month 1 (see utils/payout.js's
 * calculateSubscriptionDiscount, applied when the renewal link is created —
 * see conversation/router.js's COMPLETED-state renewal handler). A valid
 * promo code (handled separately in onboarding.js) waives the deposit too,
 * for a genuinely free 14-day trial.
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
 * and fully activates the account (month 1 is free Pro access, deposit is
 * the only charge). Shared by the webhook handler AND the reconciliation
 * fallback (findPaidDepositLinkForUser) so both paths apply the exact same
 * logic. Idempotent: returns false without side effects if this exact
 * payment was already processed or the deposit is already marked paid.
 */
async function applyDepositPayment({ user, tier, amountInr, razorpayPaymentId, razorpayLinkId }) {
  if (razorpayPaymentId && db.getPaymentsForUser(user.id).some((p) => p.razorpay_payment_id === razorpayPaymentId)) {
    return false;
  }
  if (user.deposit_status === 'paid') return false;

  // Month 1 is always full Pro access, free, regardless of what tier (if
  // any) was selected earlier — the real Basic/Pro choice + real price only
  // matters starting the month-2 renewal.
  db.logPayment({
    userId: user.id,
    razorpayPaymentId,
    razorpayLinkId,
    type: 'deposit',
    tier: 'pro',
    amountInr,
    status: 'captured',
  });

  const today = todayStr(config.timezone);
  // Durable (awaited) write: this is the moment the account is told it's
  // fully active on real money — worth the extra round-trip to confirm the
  // durable copy actually landed before anyone sees "you're activated".
  const updated = await db.updateUserDurable(user.id, {
    accountability_mode: 'accountability',
    deposit_status: 'paid',
    tier: 'pro',
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

module.exports = { promptNutritionChoice, applyDepositPayment };
