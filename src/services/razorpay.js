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
 * exactly whose payment just came in, instead of trusting a self-reported
 * "paid" text reply. This is the ONLY charge required to activate an
 * account — paying it unlocks a free Pro month 1 (see
 * services/depositActivation.js) — unless a valid promo code was used
 * instead, which waives it entirely.
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
 * Creates a per-user Razorpay Payment Link for a monthly subscription renewal
 * (sent when a user's 30-day pledge completes, or free-trial period ends),
 * tagged type: 'subscription' so the webhook knows to renew the pledge cycle
 * instead of running the initial-activation flow.
 *
 * `priceOverrideInr`, when given, charges that exact amount instead of the
 * flat monthly price — used to apply the earned consistency discount (see
 * utils/payout.js's calculateSubscriptionDiscount) to the REAL charge, not
 * just display it in a message. A test-charge override (env-configured),
 * where set, still wins over both — it exists specifically to keep live
 * testing cheap regardless of what the real price would otherwise be.
 */
async function createSubscriptionPaymentLink({ user, tier, priceOverrideInr }) {
  const razorpay = getClient();
  if (!razorpay) return null;

  const testOverride = tier === 'pro' ? config.testProChargeInr : config.testBasicChargeInr;
  const fullPrice = tier === 'pro' ? config.pricing.pro.monthly : config.pricing.basic.monthly;
  const amountInr = testOverride || priceOverrideInr || fullPrice;

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
 * the deposit payment link tagged for this user has actually been paid.
 * Scans recent payment links (Razorpay's list API has no server-side filter
 * by notes); returns the most recent matching PAID deposit link, or null.
 */
async function findPaidDepositLinkForUser(userId) {
  const razorpay = getClient();
  if (!razorpay) return null;

  try {
    const res = await razorpay.paymentLink.all({ count: 30 });
    const links = res.payment_links || res.items || [];
    const match = links.find((l) => l.notes && l.notes.user_id === String(userId) && l.status === 'paid' && l.notes.type === 'deposit');
    return match || null;
  } catch (err) {
    console.error('[Razorpay] findPaidDepositLinkForUser error:', err.message);
    return null;
  }
}

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
  createSubscriptionPaymentLink,
  verifyWebhookSignature,
  findPaidDepositLinkForUser,
};
