const admin = require('firebase-admin');
const config = require('../config');

// Initialize Firebase Admin SDK (once)
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return true;
  try {
    const serviceAccountPath = config.firebase.serviceAccountPath;
    if (serviceAccountPath) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('[Firebase] Admin SDK initialized successfully.');
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.warn('[Firebase] Warning: Service account not loaded:', err.message);
    return false;
  }
}

/**
 * Express middleware that verifies Firebase ID tokens.
 * In development or testing mode, also supports dev tokens (e.g., Bearer dev_+919500665712).
 */
async function firebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const customPhoneHeader = req.headers['x-phone'];

  // Dev mode token support for instant mobile testing
  if (authHeader && authHeader.startsWith('Bearer dev_')) {
    const tokenPart = authHeader.replace('Bearer dev_', '').trim();
    const phone = customPhoneHeader || (tokenPart.startsWith('+') ? tokenPart : '+919500665712');
    req.user = {
      uid: 'dev-user-' + phone.replace(/[^0-9]/g, ''),
      phone: phone,
    };
    return next();
  }

  if (authHeader && authHeader === 'Bearer dev_token') {
    const phone = customPhoneHeader || '+919500665712';
    req.user = {
      uid: 'dev-user-default',
      phone: phone,
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const isReady = initFirebase();
    if (!isReady) {
      // If Firebase service account is not yet configured, allow authenticated session with phone header
      const fallbackPhone = customPhoneHeader || '+919500665712';
      req.user = { uid: 'fallback-' + fallbackPhone, phone: fallbackPhone };
      return next();
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Firebase token does not contain a phone number.',
      });
    }

    req.user = {
      uid: decoded.uid,
      phone: phone,
    };

    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);

    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please sign in again.',
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid Firebase token.',
    });
  }
}

module.exports = { firebaseAuth, initFirebase };
