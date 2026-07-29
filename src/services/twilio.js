const axios = require('axios');
const twilioLib = require('twilio');
const config = require('../config');

const client = config.twilioConfigured
  ? twilioLib(config.twilio.accountSid, config.twilio.authToken)
  : null;

/**
 * Sends a WhatsApp text message. In dev mode (no Twilio creds), logs to console
 * instead of throwing, so the bot logic can be exercised without a Twilio account.
 */
async function sendText(to, body) {
  if (!client) {
    console.log(`\n[MOCK WHATSAPP -> ${to}]\n${body}\n`);
    return { mock: true };
  }
  return client.messages.create({ from: config.twilio.from, to, body });
}

/**
 * Sends a WhatsApp message with an image attached. mediaUrl must be a publicly
 * reachable URL (Twilio fetches it server-side) - build it from PUBLIC_BASE_URL.
 */
async function sendMedia(to, body, mediaUrl) {
  if (!client) {
    console.log(`\n[MOCK WHATSAPP -> ${to}] (with image: ${mediaUrl})\n${body}\n`);
    return { mock: true };
  }
  return client.messages.create({ from: config.twilio.from, to, body, mediaUrl: [mediaUrl] });
}

/**
 * Downloads a Twilio-hosted inbound media file (requires Twilio account auth) and
 * returns it as base64 + mime type, ready for the Gemini vision call.
 */
async function fetchInboundMedia(mediaUrl) {
  if (!config.twilioConfigured) {
    throw new Error('Cannot fetch Twilio media without TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN configured');
  }
  const res = await axios.get(mediaUrl, {
    auth: { username: config.twilio.accountSid, password: config.twilio.authToken },
    responseType: 'arraybuffer',
    timeout: 20000,
  });
  const mimeType = res.headers['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(res.data).toString('base64');
  return { base64, mimeType };
}

module.exports = { sendText, sendMedia, fetchInboundMedia, isMock: !client };
