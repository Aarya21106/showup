// Sends push notifications to the ShowUp mobile app via Expo's push service.
// The app is an Expo-managed project, so this is the standard delivery path —
// no separate FCM/APNs credential setup needed beyond the existing EAS project.
//
// This exists because the mobile app previously only saw new messages by polling
// GET /api/messages every 3 seconds while in the foreground — a reminder sent while
// the app was backgrounded or closed would silently wait in the outbox until the
// user happened to reopen the app. Push notifications close that gap.

const { Expo } = require('expo-server-sdk');
const db = require('../db/db');

const expo = new Expo();

/**
 * Sends a push notification to every device registered for a user.
 * Best-effort and fire-and-forget by design — a push failure should never block
 * or fail the underlying chat message, which is already queued in the outbox
 * and will be picked up by the next foreground poll regardless.
 */
async function sendPushToUser(userId, { title, body, data } = {}) {
  try {
    const tokens = db.getPushTokensForUser(userId);
    if (!tokens || tokens.length === 0) return;

    const messages = [];
    for (const token of tokens) {
      if (!Expo.isExpoPushToken(token)) {
        // Stale/invalid token format — drop it so it stops being retried forever.
        db.deletePushToken(token);
        continue;
      }
      messages.push({
        to: token,
        sound: 'default',
        title: title || 'ShowUp',
        body: (body || '').slice(0, 180), // keep notification body reasonably short
        data: data || {},
      });
    }
    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      // Prune tokens Expo reports as no longer registered (app uninstalled, etc.)
      receipts.forEach((receipt, i) => {
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          db.deletePushToken(chunk[i].to);
        }
      });
    }
  } catch (err) {
    console.error(`[Push] Failed to send push to user ${userId}:`, err.message);
  }
}

module.exports = { sendPushToUser };
