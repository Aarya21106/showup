const express = require('express');
const path = require('path');
const config = require('./config');
const db = require('./db/db'); // initializes the local DB and applies schema on first import

const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const adminRouter = require('./routes/admin');
const { startScheduler } = require('./scheduler');

const app = express();

// Render puts every request behind a reverse proxy, which sets X-Forwarded-For.
// Without telling Express to trust it, express-rate-limit can't safely resolve
// the real client IP and throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every
// rate-limited request (auth, api, message) instead of just limiting it.
// `1` trusts exactly one hop, matching Render's single reverse proxy.
app.set('trust proxy', 1);

// Parse JSON bodies for REST API
app.use(express.json({ limit: '10mb' }));

// Static files for poster images
app.use('/posters', express.static(path.join(__dirname, '..', 'generated')));

// Unauthenticated Auth endpoints (OTP send, verify, Firebase login)
app.use('/api/auth', authRouter);

// REST API routes (Firebase auth + rate limiting applied inside the router)
app.use('/api', apiRouter);

// Admin panel (existing basic auth)
app.use('/admin', adminRouter);

// Health check (no auth needed)
app.get('/healthz', (req, res) => res.send('ok'));

async function start() {
  // Restores the local (ephemeral, on Render's free plan) SQLite file from
  // Turso before accepting any traffic — must complete before the scheduler
  // or any request handler can read/write user data.
  await db.initTurso();

  app.listen(config.port, () => {
    console.log(`ShowUp API listening on http://localhost:${config.port}`);

    if (!config.geminiConfigured) {
      console.warn('[config] GEMINI_API_KEY is not set - conversational replies and photo verification will fail until you add one.');
    }
    if (!config.paymentLinkUrl) {
      console.warn('[config] PAYMENT_LINK_URL is not set - the deposit step will skip sending a payment link.');
    }
    if (!config.admin.password) {
      console.warn('[config] ADMIN_PASSWORD is not set - /admin is running WITHOUT auth.');
    }
    if (!config.firebase.serviceAccountPath) {
      console.warn('[config] FIREBASE_SERVICE_ACCOUNT_PATH is not set - API auth will fail.');
    }
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      console.warn('[config] TURSO_DATABASE_URL/TURSO_AUTH_TOKEN not set - user data will NOT survive a redeploy on Render\'s free plan.');
    }

    startScheduler();
  });
}

start();
