const states = require('./states');
const db = require('../db/db');
const twilio = require('../services/twilio');
const messages = require('./messages');
const onboarding = require('./onboarding');
const checkin = require('./checkin');

const ONBOARD_STATES = new Set([
  states.ONBOARD_NAME, states.ONBOARD_LANGUAGE, states.ONBOARD_ACTIVITY,
  states.ONBOARD_DAYS, states.ONBOARD_TIME, states.ONBOARD_BLOCKER,
  states.ONBOARD_VISION, states.ONBOARD_COMMITMENT, states.AWAITING_PAYMENT,
]);

const CHECKIN_STATES = new Set([states.ACTIVE, states.AWAITING_CHECKIN_FOLLOWUP]);

/**
 * media: { mediaUrl?, mimeType?, testBase64? } - testBase64 is set only by the local
 * simulate.js harness, which has no real Twilio account to host media on.
 */
async function handleIncomingMessage({ phone, body, media }) {
  const { user, isNew } = db.getOrCreateUser(phone);
  const text = (body || '').trim();

  if (isNew) {
    await twilio.sendText(phone, messages.question('en', 'name'));
    return;
  }

  if (user.state === states.COMPLETED) {
    await twilio.sendText(phone, messages.t(user.language, 'waitForPrompt'));
    return;
  }

  if (ONBOARD_STATES.has(user.state)) {
    await onboarding.handleOnboarding(user, text);
    return;
  }

  if (CHECKIN_STATES.has(user.state)) {
    await checkin.handleCheckinFlow(user, text, media || {});
    return;
  }
}

module.exports = { handleIncomingMessage };
