/**
 * Messaging service — drop-in replacement for the old whatsapp.js.
 *
 * All code that previously called messaging.sendText() or messaging.sendMedia()
 * now calls these functions instead. Messages are queued in the DB outbox
 * and the native app fetches them via the REST API.
 */

const db = require('../db/db');
const { sendPushToUser } = require('./pushNotifications');

/**
 * Queue a text message for delivery to the native app.
 * @param {string} to - Phone number (e.g., '+919500665712')
 * @param {string} body - Message text
 */
async function sendText(to, body) {
  // Also save to chat_messages for conversation history (same as old whatsapp service)
  try {
    const user = db.getUserByPhone(to);
    if (user) {
      db.saveChatMessage(user.id, 'model', body);
      db.queueOutboxMessage({
        userId: user.id,
        phone: to,
        body,
        mediaUrl: null,
      });
      // Fire-and-forget: reaches the device even when the app is backgrounded/closed,
      // where the 3-second foreground poll wouldn't otherwise deliver this.
      sendPushToUser(user.id, { title: 'ShowUp', body }).catch(() => {});
    } else {
      console.warn(`[Messaging] No user found for phone ${to}, message not queued.`);
    }
  } catch (err) {
    console.error('[Messaging] Error queuing text message:', err);
  }
  // If in mock WhatsApp / terminal simulator / test mode, log bot replies to console
  if (process.env.MOCK_WHATSAPP === 'true' || process.env.SIMULATE_MODE === 'true' || process.env.NODE_ENV === 'test') {
    console.log(`\n🤖 ShowUp:\n${body}\n`);
  }

  return { success: true };
}

/**
 * Queue a media message for delivery to the native app.
 * @param {string} to - Phone number
 * @param {string} body - Caption text
 * @param {string} mediaUrl - URL to the media (poster image, etc.)
 */
async function sendMedia(to, body, mediaUrl) {
  try {
    const user = db.getUserByPhone(to);
    if (user) {
      db.saveChatMessage(user.id, 'model', body);
      db.queueOutboxMessage({
        userId: user.id,
        phone: to,
        body,
        mediaUrl,
      });
      sendPushToUser(user.id, { title: 'ShowUp', body }).catch(() => {});
    } else {
      console.warn(`[Messaging] No user found for phone ${to}, media message not queued.`);
    }
  } catch (err) {
    console.error('[Messaging] Error queuing media message:', err);
  }

  // If in mock WhatsApp / terminal simulator / test mode, log bot replies to console
  if (process.env.MOCK_WHATSAPP === 'true' || process.env.SIMULATE_MODE === 'true' || process.env.NODE_ENV === 'test') {
    console.log(`\n🤖 ShowUp [Media: ${mediaUrl}]:\n${body}\n`);
  }

  return { success: true };
}

/**
 * Stub — not needed for native app, but kept for API compatibility with
 * code that might reference it (e.g., checkin.js resolveImage fallback).
 */
async function fetchInboundMedia(mediaUrl) {
  throw new Error('fetchInboundMedia is not supported in native app mode. Media is sent inline as base64.');
}

module.exports = {
  sendText,
  sendMedia,
  fetchInboundMedia,
  isMock: false,
};
