const express = require('express');
const db = require('../db/db');
const states = require('../conversation/states');
const messages = require('../conversation/messages');
const messaging = require('../services/messaging');
const razorpay = require('../services/razorpay');
const config = require('../config');
const { todayStr } = require('../utils/date');
const { promptNutritionChoice } = require('../conversation/onboarding');

const router = express.Router();

/**
 * POST /api/payments/webhook
 * Called directly by Razorpay (not the app) whenever a payment event fires —
 * no Firebase auth here, the request is authenticated instead by verifying
 * the signature against the raw body using the webhook secret configured in
 * the Razorpay dashboard.
 */
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;

  if (!rawBody || !razorpay.verifyWebhookSignature(rawBody, signature)) {
    console.error('[Payments] Webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Always ack quickly — Razorpay retries on non-2xx, and none of this should
  // ever block or fail the response back to them.
  res.json({ received: true });

  try {
    const event = req.body.event;
    if (event !== 'payment_link.paid' && event !== 'payment.captured') return;

    // payment_link.paid carries both entities in the same payload — prefer the
    // payment entity for the real Razorpay payment id + amount, fall back to
    // the payment_link entity (plain payment.captured has no link at all).
    const linkEntity = req.body.payload?.payment_link?.entity;
    const paymentEntity = req.body.payload?.payment?.entity;
    const entity = linkEntity || paymentEntity;
    if (!entity) return;

    const notes = entity.notes || {};
    const userId = parseInt(notes.user_id, 10);
    if (!userId) {
      console.error('[Payments] Webhook payment has no user_id in notes:', entity.id);
      return;
    }

    const user = db.getUserById(userId);
    if (!user) {
      console.error('[Payments] Webhook payment references unknown user:', userId);
      return;
    }

    const paymentType = notes.type === 'subscription' ? 'subscription' : 'deposit';
    const amountPaise = paymentEntity?.amount ?? linkEntity?.amount_paid ?? linkEntity?.amount ?? 0;
    const razorpayPaymentId = paymentEntity?.id || null;
    const razorpayLinkId = linkEntity?.id || null;

    // Idempotency: a duplicate webhook delivery (Razorpay retries on any
    // non-2xx, and can also just double-send) must not double-charge state —
    // this payment id/link id combination is only ever processed once.
    if (razorpayPaymentId && db.getPaymentsForUser(userId).some((p) => p.razorpay_payment_id === razorpayPaymentId)) {
      return;
    }

    const activeTier = notes.tier === 'basic' ? 'basic' : (notes.tier === 'pro' ? 'pro' : (user.tier === 'free' ? 'pro' : user.tier));
    const today = todayStr(config.timezone);

    db.logPayment({
      userId: user.id,
      razorpayPaymentId,
      razorpayLinkId,
      type: paymentType,
      tier: activeTier,
      amountInr: Math.round(amountPaise / 100),
      status: 'captured',
    });

    if (paymentType === 'subscription') {
      // Renewal payment — the user already onboarded once, so skip straight
      // back into active coaching for a fresh 30-day cycle instead of
      // replaying nutrition setup.
      const updated = db.updateUser(user.id, {
        tier: activeTier,
        started_at: today,
        day_count: 0,
        missed_count: 0,
        streak: 0,
        state: states.ACTIVE,
      });
      await messaging.sendText(updated.phone, `Renewal confirmed — your ${activeTier === 'pro' ? 'Pro' : 'Basic'} membership is active for another 30 days. Day 1 starts now, let's go!`);
      return;
    }

    if (user.deposit_status === 'paid') return; // deposit already confirmed — nothing to do

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
  } catch (err) {
    console.error('[Payments] Webhook handling error:', err);
  }
});

module.exports = router;
