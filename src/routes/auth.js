const express = require('express');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/db');
const config = require('../config');
const { initFirebase } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const googleClient = config.google.webClientId ? new OAuth2Client(config.google.webClientId) : null;

// Apply auth rate limiter across all login and OTP endpoints
router.use(authLimiter);

// In-memory OTP store with 5-minute expiration
// { [normalizedPhone]: { code: '123456', expiresAt: number } }
const otpStore = new Map();

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

/**
 * POST /api/auth/send-otp
 * Body: { phone: string }
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Generate a 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(normalized, { code, expiresAt });

    console.log(`\n========================================`);
    console.log(`[AUTH] Phone OTP for ${normalized}: ${code}`);
    console.log(`========================================\n`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      phone: normalized,
      devCode: code,
    });
  } catch (err) {
    console.error('[Auth] Error sending OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { phone: string, code: string }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    const normalized = normalizePhone(phone);
    const stored = otpStore.get(normalized);

    // Accept valid generated code, or master test code '123456' for instant demo testing
    const isValid = (stored && stored.code === code.trim() && stored.expiresAt > Date.now()) || code.trim() === '123456';

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP code' });
    }

    // Clear used OTP
    otpStore.delete(normalized);

    // Fetch or create user in DB
    const user = db.getOrCreateUser(normalized);

    // Generate session token supported by auth middleware
    const sessionToken = `dev_${normalized}`;

    res.json({
      success: true,
      token: sessionToken,
      phone: normalized,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        state: user.state,
        activity: user.activity,
        streak: user.streak,
        day_count: user.day_count,
        missed_count: user.missed_count,
        deposit_status: user.deposit_status,
      },
    });
  } catch (err) {
    console.error('[Auth] Error verifying OTP:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/firebase
 * Body: { idToken: string }
 */
router.post('/firebase', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const isReady = initFirebase();
    if (!isReady) {
      return res.status(500).json({
        error: 'Firebase Admin not configured',
        message: 'Please use OTP authentication or provide Firebase service account',
      });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) {
      return res.status(400).json({ error: 'Token does not contain a verified phone number' });
    }

    const user = db.getOrCreateUser(phone);
    if (!user.firebase_uid) {
      db.updateUser(user.id, { firebase_uid: decoded.uid });
    }

    res.json({
      success: true,
      token: idToken,
      phone: phone,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        state: user.state,
        activity: user.activity,
        streak: user.streak,
        day_count: user.day_count,
        missed_count: user.missed_count,
        deposit_status: user.deposit_status,
      },
    });
  } catch (err) {
    console.error('[Auth] Firebase verify error:', err.message);
    res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
});

/**
 * POST /api/auth/google
 * Body: { idToken: string }
 *
 * Verifies a Google Sign-In ID token directly against Google's servers (via
 * google-auth-library) — independent of whether Firebase Admin is configured,
 * since Google accounts don't carry a phone number and this app's existing
 * phone-based OTP path was the only auth method until now.
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    if (!googleClient) {
      return res.status(500).json({
        error: 'Google Sign-In not configured',
        message: 'GOOGLE_WEB_CLIENT_ID is not set on the server.',
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.webClientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { user } = db.getOrCreateUserByGoogle({
      googleUid: payload.sub,
      email: payload.email,
      name: payload.name,
    });

    // Session token follows the same dev-token convention the rest of the
    // auth middleware already understands (see middleware/auth.js) — no new
    // middleware branch needed.
    const sessionToken = `dev_${user.phone}`;

    res.json({
      success: true,
      token: sessionToken,
      phone: user.phone,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        state: user.state,
        activity: user.activity,
        streak: user.streak,
        day_count: user.day_count,
        missed_count: user.missed_count,
        deposit_status: user.deposit_status,
      },
    });
  } catch (err) {
    console.error('[Auth] Google verify error:', err.message);
    res.status(401).json({ error: 'Invalid Google ID token' });
  }
});

module.exports = router;
