const express = require('express');
const QRCode = require('qrcode');
const config = require('../config');

const router = express.Router();

function buildWhatsAppLink() {
  const rawNumber = config.twilio.from.replace('whatsapp:', '').replace(/[^\d+]/g, '').replace('+', '');
  const joinText = config.twilio.sandboxCode ? `join ${config.twilio.sandboxCode}` : '';
  const query = joinText ? `?text=${encodeURIComponent(joinText)}` : '';
  return `https://wa.me/${rawNumber}${query}`;
}

router.get('/', async (req, res) => {
  const waLink = buildWhatsAppLink();
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(waLink, { margin: 1, width: 480, color: { dark: '#0b0f0d', light: '#f4f7f4' } });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ShowUp</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 20% 0%, #1c2b23 0%, #0b0f0d 55%, #050605 100%);
    color: #f4f7f4; font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 24px;
  }
  .card { max-width: 420px; }
  .brand { font-size: 28px; font-weight: 800; letter-spacing: 8px; color: #35e08a; margin-bottom: 8px; }
  h1 { font-size: 40px; margin: 0 0 16px; line-height: 1.15; }
  p { color: #9fb3a8; font-size: 18px; line-height: 1.5; }
  img { border-radius: 16px; margin: 24px 0; max-width: 100%; }
  a.cta {
    display: inline-block; margin-top: 12px; padding: 16px 32px; border-radius: 999px;
    background: #35e08a; color: #06110a; font-weight: 700; text-decoration: none; font-size: 18px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">SHOWUP</div>
    <h1>Scan or tap to start your pledge.</h1>
    <p>${config.pledgeDays} days. A real deposit. A coach that checks your photos, not just your word.</p>
    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="WhatsApp QR code" width="240" height="240" />` : ''}
    <div><a class="cta" href="${waLink}">Open WhatsApp</a></div>
  </div>
</body>
</html>`);
});

module.exports = router;
