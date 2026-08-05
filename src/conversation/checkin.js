const states = require('./states');
const messages = require('./messages');
const db = require('../db/db');
const gemini = require('../services/gemini');
const whatsapp = require('../services/whatsapp');
const poster = require('../services/poster');
const config = require('../config');
const { todayStr } = require('../utils/date');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');


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
    // If the mediaUrl is a local file path (for testing in simulator), read it directly
    if (fs.existsSync(media.mediaUrl)) {
      const base64 = fs.readFileSync(media.mediaUrl).toString('base64');
      const ext = path.extname(media.mediaUrl).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { base64, mimeType };
    }
    return whatsapp.fetchInboundMedia(media.mediaUrl);
  }
  return null;
}

/** Marks a checkin accepted, bumps streak, and either sends the day's confirmation
 * or - if this was the final program day - renders the final poster and closes out. */
async function finalizeAccepted(user, checkinId, reason) {
  db.updateCheckin(checkinId, { status: 'accepted', gemini_reason: reason });
  const streak = user.streak + 1;

  if (user.day_count >= config.pledgeDays) {
    const { calculatePledgePayout } = require('../utils/payout');
    const missed = user.missed_count;
    const { payout } = calculatePledgePayout(user, missed);
    const completedDays = config.pledgeDays - missed;

    db.updateUser(user.id, { state: states.COMPLETED, streak, pending_checkin_id: null, current_gesture: null });

    const { publicUrl } = await poster.renderFinalPoster({
      userId: user.id, name: user.name, activity: user.activity, completedDays, payout,
    });
    await whatsapp.sendMedia(user.phone, `${user.name} — final tally.`, publicUrl);
    const msg = missed === 0
      ? messages.t(user.language, 'finalComplete', payout)
      : messages.t(user.language, 'finalPartial', completedDays, payout);
    await whatsapp.sendText(user.phone, msg);
    return;
  }

  db.updateUser(user.id, { streak, pending_checkin_id: null, state: states.ACTIVE, current_gesture: null });
  const daysLeft = Math.max(config.pledgeDays - user.day_count, 0);
  await whatsapp.sendText(user.phone, messages.t(user.language, 'checkinAccepted', streak, daysLeft));
}

const GESTURES = ['thumbs-up', 'peace-sign', 'three-fingers', 'fist', 'ok-sign'];
function getRandomGesture() {
  return GESTURES[Math.floor(Math.random() * GESTURES.length)];
}

async function handleActiveCheckin(user, body, media) {
  // If the user has no current gesture assigned, generate one and ask them to check in using it
  if (!user.current_gesture) {
    const gesture = getRandomGesture();
    db.updateUser(user.id, { current_gesture: gesture });
    const gestureText = messages.t(user.language, `gesture_${gesture}`);
    await whatsapp.sendText(user.phone, messages.t(user.language, 'needGesturePhoto', gestureText, user.activity));
    return;
  }

  const gestureText = messages.t(user.language, `gesture_${user.current_gesture}`);

  if (!media.mediaUrl && !media.testBase64) {
    await whatsapp.sendText(user.phone, messages.t(user.language, 'needPhoto', gestureText, user.activity));
    return;
  }

  let image;
  try {
    image = await resolveImage(media);
  } catch (err) {
    await whatsapp.sendText(user.phone, messages.t(user.language, 'needPhoto', gestureText, user.activity));
    return;
  }

  // Calculate photo hash
  let photoHash = null;
  if (image && image.base64) {
    photoHash = crypto.createHash('md5').update(image.base64).digest('hex');
  }

  // Block duplicate photo hashes
  if (photoHash && db.hasDuplicatePhotoHash(user.id, photoHash)) {
    const msg = user.language === 'ta'
      ? 'நீங்கள் ஏற்கனவே பயன்படுத்திய புகைப்படத்தை மீண்டும் பயன்படுத்துகிறீர்கள்! தயவுசெய்து இன்றைய உடற்பயிற்சியின் புதிய புகைப்படத்தை அனுப்பவும்.'
      : user.language === 'hi'
      ? 'आप पहले से इस्तेमाल की गई फोटो दोबारा भेज रहे हैं! कृपया आज की कसरत की नई फोटो भेजें।'
      : "It looks like you've reused a photo from a previous workout! Please upload a fresh photo of today's session to check in.";
    await whatsapp.sendText(user.phone, msg);
    return;
  }

  const today = todayStr(config.timezone);
  const todayDate = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const recentCheckins = db.getCheckinsForUser(user.id).slice(-5).map((c) => ({
    date: c.date,
    description: c.description || '',
    status: c.status,
    reason: c.gemini_reason || '',
  }));

  // Fetch previous accepted checkin for background consistency check
  let lastAcceptedBase64 = null;
  let lastAcceptedMimeType = null;
  const lastCheckin = db.getLastAcceptedCheckin(user.id);
  if (lastCheckin && lastCheckin.photo_ref) {
    try {
      const prevImage = await resolveImage({ mediaUrl: lastCheckin.photo_ref === 'test-image' ? null : lastCheckin.photo_ref });
      if (prevImage) {
        lastAcceptedBase64 = prevImage.base64;
        lastAcceptedMimeType = prevImage.mimeType;
      }
    } catch (err) {
      console.error('Failed to resolve previous checkin image:', err);
    }
  }

  const checkin = db.createCheckin({
    userId: user.id,
    date: today,
    description: body,
    photoRef: media.localPath || media.mediaUrl || 'test-image',
    status: 'pending',
    photoHash,
    gesture: user.current_gesture,
  });

  let result;
  try {
    result = await gemini.verifyCheckin({
      description: body,
      imageBase64: image.base64,
      mimeType: image.mimeType,
      activity: user.activity,
      language: user.language,
      recentCheckins,
      todayDate,
      expectedGesture: user.current_gesture,
      lastAcceptedBase64,
      lastAcceptedMimeType,
    });
  } catch (err) {
    console.error('verifyCheckin failed:', err);
    await whatsapp.sendText(user.phone, verifyTroubleMessage(user.language));
    return;
  }

  if (result.matches && !result.suspicious) {
    await finalizeAccepted(user, checkin.id, result.reason);
  } else {
    db.updateCheckin(checkin.id, { gemini_reason: result.reason });
    db.updateUser(user.id, { state: states.AWAITING_CHECKIN_FOLLOWUP, pending_checkin_id: checkin.id });
    await whatsapp.sendText(user.phone, result.followupQuestion || genericFollowupQuestion(user.language));
  }
}

async function handleFollowup(user, body, media) {
  const pending = db.getCheckinById(user.pending_checkin_id);
  if (!pending) {
    db.updateUser(user.id, { state: states.ACTIVE, pending_checkin_id: null });
    await whatsapp.sendText(user.phone, messages.t(user.language, 'waitForPrompt'));
    return;
  }

  let image = null;
  let photoHash = null;
  try {
    if (media.mediaUrl || media.testBase64) {
      image = await resolveImage(media);
      if (image && image.base64) {
        photoHash = crypto.createHash('md5').update(image.base64).digest('hex');
      }
    } else if (pending.photo_ref && pending.photo_ref !== 'test-image') {
      image = await whatsapp.fetchInboundMedia(pending.photo_ref);
      photoHash = pending.photo_hash;
    }
  } catch (err) {
    image = null;
  }

  // Block duplicate photo hashes in followup
  if (photoHash && db.hasDuplicatePhotoHash(user.id, photoHash)) {
    const msg = user.language === 'ta'
      ? 'நீங்கள் ஏற்கனவே பயன்படுத்திய புகைப்படத்தை மீண்டும் பயன்படுத்துகிறீர்கள்! தயவுசெய்து இன்றைய உடற்பயிற்சியின் புதிய புகைப்படத்தை அனுப்பவும்.'
      : user.language === 'hi'
      ? 'आप पहले से इस्तेमाल की गई फोटो दोबारा भेज रहे हैं! कृपया आज की कसरत की नई फोटो भेजें।'
      : "It looks like you've reused a photo from a previous workout! Please upload a fresh photo of today's session to check in.";
    await whatsapp.sendText(user.phone, msg);
    return;
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
    console.error('evaluateFollowup failed:', err);
    await whatsapp.sendText(user.phone, verifyTroubleMessage(user.language));
    return;
  }

  if (result.accepted) {
    db.updateCheckin(pending.id, {
      description: `${pending.description || ''} | follow-up: ${body}`.trim(),
      photo_hash: photoHash,
    });
    await finalizeAccepted(user, pending.id, result.reason);
  } else {
    db.updateCheckin(pending.id, { status: 'failed', gemini_reason: result.reason, photo_hash: photoHash });
    db.updateUser(user.id, {
      state: states.ACTIVE, pending_checkin_id: null, streak: 0, missed_count: user.missed_count + 1, current_gesture: null,
    });
    await whatsapp.sendText(user.phone, messages.t(user.language, 'checkinFailedFinal', result.reason));
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
