const express = require('express');
const { firebaseAuth } = require('../middleware/auth');
const { apiLimiter, messageLimiter } = require('../middleware/rateLimit');
const { handleIncomingMessage } = require('../conversation/router');
const db = require('../db/db');

const router = express.Router();

// All API routes require Firebase auth
router.use(firebaseAuth);

// Apply general rate limiter to all API routes
router.use(apiLimiter);

/**
 * POST /api/message
 * Send a message from the native app to the bot.
 * Body: { body: string, imageBase64?: string, mimeType?: string }
 *
 * The phone number is extracted from the Firebase token — no spoofing possible.
 */
router.post('/message', messageLimiter, async (req, res) => {
  try {
    const phone = req.user.phone;
    const { body, imageBase64, mimeType } = req.body;

    if (!body && !imageBase64) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Either body (text) or imageBase64 (image) is required.',
      });
    }

    const media = {};
    if (imageBase64) {
      media.testBase64 = imageBase64;
      media.mimeType = mimeType || 'image/jpeg';
    }

    // Route through the same conversation engine
    await handleIncomingMessage({
      phone,
      body: body || '',
      media: Object.keys(media).length > 0 ? media : undefined,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error handling message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/messages
 * Fetch pending bot replies for the authenticated user.
 * Returns all undelivered outbox messages, ordered oldest-first.
 */
router.get('/messages', async (req, res) => {
  try {
    const phone = req.user.phone;
    const user = db.getUserByPhone(phone);

    if (!user) {
      return res.json({ messages: [] });
    }

    const messages = db.getPendingMessages(user.id);
    res.json({ messages });
  } catch (err) {
    console.error('[API] Error fetching messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/messages/ack
 * Acknowledge (mark as delivered) messages by their IDs.
 * Body: { messageIds: number[] }
 *
 * Only messages belonging to the authenticated user can be acknowledged.
 */
router.post('/messages/ack', async (req, res) => {
  try {
    const phone = req.user.phone;
    const user = db.getUserByPhone(phone);
    const { messageIds } = req.body;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'messageIds must be a non-empty array of message IDs.',
      });
    }

    db.markMessagesDelivered(user.id, messageIds);
    res.json({ success: true, acknowledged: messageIds.length });
  } catch (err) {
    console.error('[API] Error acknowledging messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/me
 * Get the authenticated user's profile and state.
 * Only returns YOUR data — phone comes from the token.
 */
router.get('/me', (req, res) => {
  try {
    const phone = req.user.phone;
    const user = db.getUserByPhone(phone);

    if (!user) {
      return res.json({
        exists: false,
        message: 'No account found. Send a message to start onboarding.',
      });
    }

    // Strip sensitive/internal fields
    const {
      onboarding_history, profile_json, water_reminders_sent,
      workout_reminded_date, workout_acknowledged_date, last_prompted_date,
      last_weekly_summary_date, pending_checkin_id, poster_path,
      current_gesture, last_goal_review_date,
      ...safeProfile
    } = user;

    res.json({ exists: true, user: safeProfile });
  } catch (err) {
    console.error('[API] Error fetching profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/checkins
 * Get the authenticated user's check-in history.
 */
router.get('/checkins', (req, res) => {
  try {
    const phone = req.user.phone;
    const user = db.getUserByPhone(phone);

    if (!user) {
      return res.json({ checkins: [] });
    }

    const checkins = db.getCheckinsForUser(user.id).map((c) => ({
      id: c.id,
      date: c.date,
      description: c.description,
      status: c.status,
      reason: c.gemini_reason,
      distanceKm: c.distance_km,
      durationMinutes: c.duration_minutes,
      paceMinPerKm: c.pace_min_per_km,
      activityCalories: c.activity_calories,
      activityType: c.activity_type,
      createdAt: c.created_at,
    }));

    res.json({ checkins });
  } catch (err) {
    console.error('[API] Error fetching checkins:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
