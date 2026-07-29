const states = require('./states');
const messages = require('./messages');
const db = require('../db/db');
const gemini = require('../services/gemini');
const twilio = require('../services/twilio');
const poster = require('../services/poster');
const config = require('../config');
const { todayStr } = require('../utils/date');

function verifyTroubleMessage(language) {
  if (language === 'ta') return 'இப்போது சரிபார்க்க முடியவில்லை — சிறிது நேரம் கழித்து மீண்டும் அனுப்புங்கள்.';
  if (language === 'hi') return 'अभी वेरिफाई नहीं कर पाया — कुछ देर बाद फिर से भेजें।';
  return "Couldn't verify that just now — please resend in a bit.";
}

function genericFollowupQuestion(language) {
  if (language === 'ta') return 'இதை இன்னும் கொஞ்சம் விளக்க முடியுமா?';
  if (language === 'hi') return 'क्या आप इसे थोड़ा और स्पष्ट कर सकते हैं?';
  return 'Can you tell me a bit more about that?';
}

async function resolveImage(media) {
  if (media.testBase64) {
    return { base64: media.testBase64, mimeType: media.mimeType || 'image/jpeg' };
  }
  if (media.mediaUrl) {
    return twilio.fetchInboundMedia(media.mediaUrl);
  }
  return null;
}

/** Marks a checkin accepted, bumps streak, and either sends the day's confirmation
 * or - if this was the final program day - renders the final poster and closes out. */
async function finalizeAccepted(user, checkinId, reason) {
  db.updateCheckin(checkinId, { status: 'accepted', gemini_reason: reason });
  const streak = user.streak + 1;

  if (user.day_count >= config.pledgeDays) {
    const missed = user.missed_count;
    const payout = missed === 0
      ? config.fullPayoutInr
      : Math.max(config.depositAmountInr - config.slipPenaltyInr * missed, 0);
    const completedDays = config.pledgeDays - missed;

    db.updateUser(user.id, { state: states.COMPLETED, streak, pending_checkin_id: null });

    const { publicUrl } = await poster.renderFinalPoster({
      userId: user.id, name: user.name, activity: user.activity, completedDays, payout,
    });
    await twilio.sendMedia(user.phone, `${user.name} — final tally.`, publicUrl);
    const msg = missed === 0
      ? messages.t(user.language, 'finalComplete', payout)
      : messages.t(user.language, 'finalPartial', completedDays, payout);
    await twilio.sendText(user.phone, msg);
    return;
  }

  db.updateUser(user.id, { streak, pending_checkin_id: null, state: states.ACTIVE });
  const daysLeft = Math.max(config.pledgeDays - user.day_count, 0);
  await twilio.sendText(user.phone, messages.t(user.language, 'checkinAccepted', streak, daysLeft));
}

async function handleActiveCheckin(user, body, media) {
  if (!media.mediaUrl && !media.testBase64) {
    await twilio.sendText(user.phone, messages.t(user.language, 'needPhoto'));
    return;
  }

  let image;
  try {
    image = await resolveImage(media);
  } catch (err) {
    await twilio.sendText(user.phone, messages.t(user.language, 'needPhoto'));
    return;
  }

  const today = todayStr(config.timezone);
  const recentDescriptions = db.getCheckinsForUser(user.id).map((c) => c.description).filter(Boolean);

  const checkin = db.createCheckin({
    userId: user.id,
    date: today,
    description: body,
    photoRef: media.mediaUrl || 'test-image',
    status: 'pending',
  });

  let result;
  try {
    result = await gemini.verifyCheckin({
      description: body,
      imageBase64: image.base64,
      mimeType: image.mimeType,
      activity: user.activity,
      language: user.language,
      recentDescriptions,
    });
  } catch (err) {
    await twilio.sendText(user.phone, verifyTroubleMessage(user.language));
    return;
  }

  if (result.matches && !result.suspicious) {
    await finalizeAccepted(user, checkin.id, result.reason);
  } else {
    db.updateCheckin(checkin.id, { gemini_reason: result.reason });
    db.updateUser(user.id, { state: states.AWAITING_CHECKIN_FOLLOWUP, pending_checkin_id: checkin.id });
    await twilio.sendText(user.phone, result.followupQuestion || genericFollowupQuestion(user.language));
  }
}

async function handleFollowup(user, body, media) {
  const pending = db.getCheckinById(user.pending_checkin_id);
  if (!pending) {
    db.updateUser(user.id, { state: states.ACTIVE, pending_checkin_id: null });
    await twilio.sendText(user.phone, messages.t(user.language, 'waitForPrompt'));
    return;
  }

  let image = null;
  try {
    if (media.mediaUrl || media.testBase64) {
      image = await resolveImage(media);
    } else if (pending.photo_ref && pending.photo_ref !== 'test-image') {
      image = await twilio.fetchInboundMedia(pending.photo_ref);
    }
  } catch (err) {
    image = null; // fall back to a text-only final decision rather than blocking the user
  }

  let result;
  try {
    result = await gemini.evaluateFollowup({
      originalDescription: pending.description,
      followupAnswer: body,
      imageBase64: image?.base64,
      mimeType: image?.mimeType,
      activity: user.activity,
      language: user.language,
    });
  } catch (err) {
    await twilio.sendText(user.phone, verifyTroubleMessage(user.language));
    return;
  }

  if (result.accepted) {
    db.updateCheckin(pending.id, {
      description: `${pending.description || ''} | follow-up: ${body}`.trim(),
    });
    await finalizeAccepted(user, pending.id, result.reason);
  } else {
    db.updateCheckin(pending.id, { status: 'failed', gemini_reason: result.reason });
    db.updateUser(user.id, {
      state: states.ACTIVE, pending_checkin_id: null, streak: 0, missed_count: user.missed_count + 1,
    });
    await twilio.sendText(user.phone, messages.t(user.language, 'checkinFailedFinal', result.reason));
  }
}

async function handleCheckinFlow(user, body, media) {
  if (user.state === states.ACTIVE) {
    await handleActiveCheckin(user, body, media);
  } else if (user.state === states.AWAITING_CHECKIN_FOLLOWUP) {
    await handleFollowup(user, body, media);
  }
}

module.exports = { handleCheckinFlow, finalizeAccepted };
