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
 * with this user's id and chosen tier in `notes` — the webhook handler reads
 * those back to know exactly whose payment just came in, instead of trusting
 * a self-reported "paid" text reply.
 */
async function createDepositPaymentLink({ user, tier }) {
  const razorpay = getClient();
  if (!razorpay) return null;

  try {
    const link = await razorpay.paymentLink.create({
      amount: config.depositAmountInr * 100,
      currency: 'INR',
      description: `ShowUp ${tier === 'pro' ? 'Pro' : 'Basic'} refundable deposit`,
      reference_id: `user_${user.id}_${Date.now()}`,
      notes: { user_id: String(user.id), tier },
      customer: { name: user.name || 'ShowUp Member' },
      notify: { sms: false, email: false },
      reminder_enable: false,
    });
    return link.short_url;
  } catch (err) {
    console.error('[Razorpay] Failed to create payment link:', err.message);
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

module.exports = { createDepositPaymentLink, verifyWebhookSignature };
