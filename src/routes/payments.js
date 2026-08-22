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
    const entity =
      req.body.payload?.payment_link?.entity ||
      req.body.payload?.payment?.entity;

    if (!entity || (event !== 'payment_link.paid' && event !== 'payment.captured')) {
      return;
    }

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
    if (user.deposit_status === 'paid') {
      return; // already confirmed — duplicate webhook delivery, nothing to do
    }

    const activeTier = notes.tier === 'basic' ? 'basic' : (notes.tier === 'pro' ? 'pro' : (user.tier === 'free' ? 'pro' : user.tier));
    const today = todayStr(config.timezone);
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
