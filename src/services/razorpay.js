const Razorpay = require('razorpay');
const config = require('../config');

let client = null;
function getClient() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) return null;
  if (!client) {
    client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  }
  return client;
}

/**
 * Creates a per-user Razorpay Payment Link for the refundable deposit, tagged
 * with this user's id, tier, and type: 'deposit' in `notes` — the webhook
 * handler and the reconciliation fallback both read these back to know
 * exactly whose payment just came in and what it's for, instead of trusting
 * a self-reported "paid" text reply.
 *
 * This is one of TWO separate charges required to activate an account (see
 * createTierFeePaymentLink for the other) unless a valid promo code was used
 * instead, which waives both.
 */
async function createDepositPaymentLink({ user, tier }) {
  const razorpay = getClient();
  if (!razorpay) return null;

  const amountInr = config.testDepositChargeInr || config.depositAmountInr;

  try {
    const link = await razorpay.paymentLink.create({
      amount: amountInr * 100,
      currency: 'INR',
      description: `ShowUp ${tier === 'pro' ? 'Pro' : 'Basic'} refundable deposit`,
      reference_id: `user_${user.id}_deposit_${Date.now()}`,
      notes: { user_id: String(user.id), tier, type: 'deposit' },
      customer: { name: user.name || 'ShowUp Member' },
      notify: { sms: false, email: false },
      reminder_enable: false,
    });
    return link.short_url;
  } catch (err) {
    console.error('[Razorpay] Failed to create deposit payment link:', err.message);
    return null;
  }
}

/**
 * Creates a per-user Razorpay Payment Link for the FIRST month's tier fee —
 * the second of the two separate charges required to activate an account
 * (alongside the refundable deposit above), unless a valid promo code
 * waives both and grants the 14-day free trial instead. Tagged type:
 * 'initial_fee' so the webhook/reconciliation can tell this apart from a
 * later renewal (type: 'subscription', see createSubscriptionPaymentLink).
 */
async function createTierFeePaymentLink({ user, tier }) {
  const razorpay = getClient();
  if (!razorpay) return null;

  const amountInr = tier === 'pro'
    ? (config.testProChargeInr || config.pricing.pro.monthly)
    : (config.testBasicChargeInr || config.pricing.basic.monthly);

  try {
    const link = await razorpay.paymentLink.create({
      amount: amountInr * 100,
      currency: 'INR',
      description: `ShowUp ${tier === 'pro' ? 'Pro' : 'Basic'} first month`,
      reference_id: `user_${user.id}_initialfee_${Date.now()}`,
      notes: { user_id: String(user.id), tier, type: 'initial_fee' },
      customer: { name: user.name || 'ShowUp Member' },
      notify: { sms: false, email: false },
      reminder_enable: false,
    });
    return link.short_url;
  } catch (err) {
    console.error('[Razorpay] Failed to create tier-fee payment link:', err.message);
    return null;
  }
}

/**
 * Creates a per-user Razorpay Payment Link for a monthly subscription renewal
 * (sent when a user's 30-day pledge completes) — same pattern as the two
 * links above, but tagged type: 'subscription' so the webhook knows to renew
 * the pledge cycle instead of running the initial-activation flow.
 */
async function createSubscriptionPaymentLink({ user, tier }) {
  const razorpay = getClient();
  if (!razorpay) return null;

  const amountInr = tier === 'pro'
    ? (config.testProChargeInr || config.pricing.pro.monthly)
    : (config.testBasicChargeInr || config.pricing.basic.monthly);

  try {
    const link = await razorpay.paymentLink.create({
      amount: amountInr * 100,
      currency: 'INR',
      description: `ShowUp ${tier === 'pro' ? 'Pro' : 'Basic'} monthly renewal`,
      reference_id: `user_${user.id}_renewal_${Date.now()}`,
      notes: { user_id: String(user.id), tier, type: 'subscription' },
      customer: { name: user.name || 'ShowUp Member' },
      notify: { sms: false, email: false },
      reminder_enable: false,
    });
    return link.short_url;
  } catch (err) {
    console.error('[Razorpay] Failed to create subscription payment link:', err.message);
    return null;
  }
}

/**
 * Reconciliation fallback for when the webhook hasn't (yet) reached us — e.g.
 * a misconfigured/unreachable webhook URL, a delivery still queued for
 * retry, or any other delivery gap. Per Razorpay's own guidance ("if a
 * critical user-facing flow requires instant status but the webhook
 * notification hasn't arrived, perform an immediate API Fetch call to
 * verify status"), this asks Razorpay directly — via our own real API
 * credentials, never by fabricating or replaying a webhook payload — whether
 * a payment link tagged for this user has actually been paid. Scans recent
 * payment links (Razorpay's list API has no server-side filter by notes).
 * `type` selects which of the two initial charges to look for ('deposit' or
 * 'initial_fee'); returns the most recent matching PAID link, or null.
 */
async function findPaidLinkForUser(userId, type) {
  const razorpay = getClient();
  if (!razorpay) return null;

  try {
    const res = await razorpay.paymentLink.all({ count: 30 });
    const links = res.payment_links || res.items || [];
    const match = links.find((l) => l.notes && l.notes.user_id === String(userId) && l.status === 'paid' && l.notes.type === type);
    return match || null;
  } catch (err) {
    console.error('[Razorpay] findPaidLinkForUser error:', err.message);
    return null;
  }
}

const findPaidDepositLinkForUser = (userId) => findPaidLinkForUser(userId, 'deposit');
const findPaidTierFeeLinkForUser = (userId) => findPaidLinkForUser(userId, 'initial_fee');

/** Verifies the X-Razorpay-Signature header against the raw webhook body. */
function verifyWebhookSignature(rawBody, signature) {
  if (!config.razorpay.webhookSecret || !signature) return false;
  try {
    return Razorpay.validateWebhookSignature(rawBody, signature, config.razorpay.webhookSecret);
  } catch (err) {
    console.error('[Razorpay] Webhook signature validation error:', err.message);
    return false;
  }
}

module.exports = {
  createDepositPaymentLink,
  createTierFeePaymentLink,
  createSubscriptionPaymentLink,
  verifyWebhookSignature,
  findPaidDepositLinkForUser,
  findPaidTierFeeLinkForUser,
};
