const express = require('express');
const path = require('path');
const config = require('./config');
require('./db/db'); // initializes the DB and applies schema on first import
require('./services/whatsapp'); // starts the WhatsApp client connection using Baileys

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

app.get('/qr', async (req, res) => {
  const whatsapp = require('./services/whatsapp');
  if (whatsapp.getIsConnected()) {
    return res.send(`
      <html><body style="background:#0b141a;color:#00a884;font-family:sans-serif;text-align:center;padding-top:80px;">
        <h1>🎉 WhatsApp Bot is Connected & Live!</h1>
        <p style="color:#8696a0;">Your WhatsApp account is successfully linked.</p>
      </body></html>
    `);
  }
  const qrDataUrl = await whatsapp.getLatestQrDataUrl();
  if (!qrDataUrl) {
    return res.send(`
      <html>
        <head><meta http-equiv="refresh" content="3"></head>
        <body style="background:#0b141a;color:white;font-family:sans-serif;text-align:center;padding-top:80px;">
          <h2>⏳ Generating fresh QR Code...</h2>
          <p style="color:#8696a0;">Page will refresh automatically in 3 seconds.</p>
        </body>
      </html>
    `);
  }
  res.send(`
    <html>
      <head>
        <title>ShowUp WhatsApp QR Code</title>
        <meta http-equiv="refresh" content="15">
        <style>
          body { background: #0b141a; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #111b21; padding: 30px 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #222d34; }
          img { background: white; padding: 15px; border-radius: 12px; margin: 20px 0; display: block; }
          h2 { color: #00a884; margin: 0 0 10px 0; }
          p { color: #8696a0; font-size: 15px; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>ShowUp WhatsApp Bot</h2>
          <p>Open WhatsApp on your phone</p>
          <p><b>Linked Devices</b> &rarr; <b>Link a Device</b></p>
          <img src="${qrDataUrl}" width="280" height="280" />
          <p style="font-size: 12px; color: #667781;">Auto-refreshes every 15 seconds</p>
        </div>
      </body>
    </html>
  `);
});

app.listen(config.port, () => {
  console.log(`ShowUp listening on http://localhost:${config.port}`);

  if (!config.publicBaseUrl) {
    console.warn('[config] PUBLIC_BASE_URL is not set - poster images will not be viewable by recipients. Set it to your ngrok/deployed URL in .env.');
  }
  if (!config.geminiConfigured) {
    console.warn('[config] GEMINI_API_KEY is not set - conversational replies and photo verification will fail until you add one.');
  }
  if (process.env.MOCK_WHATSAPP === 'true') {
    console.warn('[config] Running in MOCK mode: outgoing WhatsApp messages are logged to the console instead of actually sent.');
  }
  if (!config.paymentLinkUrl) {
    console.warn('[config] PAYMENT_LINK_URL is not set - the deposit step will skip sending a payment link.');
  }
  if (!config.admin.password) {
    console.warn('[config] ADMIN_PASSWORD is not set - /admin is running WITHOUT auth.');
  }

  startScheduler();
});
