const express = require('express');
const path = require('path');
const config = require('./config');
require('./db/db'); // initializes the DB and applies schema on first import

const landingRouter = require('./routes/landing');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const { startScheduler } = require('./scheduler');

const app = express();

app.use('/posters', express.static(path.join(__dirname, '..', 'generated')));
app.use('/', landingRouter);
app.use('/webhook', webhookRouter);
app.use('/admin', adminRouter);

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(config.port, () => {
  console.log(`ShowUp listening on http://localhost:${config.port}`);

  if (!config.publicBaseUrl) {
    console.warn('[config] PUBLIC_BASE_URL is not set - poster images will not be fetchable by Twilio. Set it to your ngrok/deployed URL in .env.');
  }
  if (!config.geminiConfigured) {
    console.warn('[config] GEMINI_API_KEY is not set - conversational replies and photo verification will fail until you add one.');
  }
  if (!config.twilioConfigured) {
    console.warn('[config] TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set - running in MOCK mode: outgoing WhatsApp messages are logged to the console instead of actually sent.');
  }
  if (!config.paymentLinkUrl) {
    console.warn('[config] PAYMENT_LINK_URL is not set - the deposit step will skip sending a payment link.');
  }
  if (!config.admin.password) {
    console.warn('[config] ADMIN_PASSWORD is not set - /admin is running WITHOUT auth.');
  }

  startScheduler();
});
