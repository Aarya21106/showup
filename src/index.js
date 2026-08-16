const express = require('express');
const path = require('path');
const config = require('./config');
require('./db/db'); // initializes the DB and applies schema on first import

const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const adminRouter = require('./routes/admin');
const { startScheduler } = require('./scheduler');

const app = express();

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

  startScheduler();
});
