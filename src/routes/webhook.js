const express = require('express');
const { handleIncomingMessage } = require('../conversation/router');

const router = express.Router();

// Twilio posts application/x-www-form-urlencoded. The webhook mount in index.js
// already applies express.urlencoded, but we keep this explicit for standalone testing.
router.post('/whatsapp', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const from = req.body.From; // 'whatsapp:+919876543210'
    const body = req.body.Body || '';
    const numMedia = parseInt(req.body.NumMedia || '0', 10);

    if (!from) {
      res.status(400).send('Missing From');
      return;
    }

    const media = {};
    if (req.body.TestImageBase64) {
      // Only ever sent by scripts/simulate.js - there's no real Twilio-hosted media URL locally.
      media.testBase64 = req.body.TestImageBase64;
      media.mimeType = req.body.TestMimeType || 'image/jpeg';
    } else if (numMedia > 0 && req.body.MediaUrl0) {
      media.mediaUrl = req.body.MediaUrl0;
      media.mimeType = req.body.MediaContentType0;
    }

    await handleIncomingMessage({ phone: from, body, media });
  } catch (err) {
    console.error('Error handling incoming WhatsApp message:', err);
  }

  // Always ack with empty TwiML - all replies are sent proactively via the Twilio REST client.
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

module.exports = router;
