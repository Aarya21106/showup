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

const CARDIO_ACTIVITIES = new Set(['running', 'walking', 'cycling']);

// Returns all activity entries from the user's weekly plan.
// Falls back to building a single-entry plan from legacy columns.
function getUserAllActivities(user) {
  if (user.weekly_plan) {
    try {
      const plan = JSON.parse(user.weekly_plan);
      if (Array.isArray(plan) && plan.length > 0) return plan;
    } catch (e) { /* fall through */ }
  }
  if (user.activity && CARDIO_ACTIVITIES.has(user.activity)) {
    return [{
      activity: user.activity,
      days_per_week: user.days_per_week || 3,
      goal_distance_km: user.weekly_goal_distance_km || 3.0,
    }];
  }
  return [];
}

// Returns the plan entry for a specific activity type, or null if not in the user's plan.
function getActivityPlan(user, activityType) {
  const all = getUserAllActivities(user);
  return all.find(a => a.activity === activityType) || null;
}

// True if the user has any cardio activity in their plan.
function isCardioUser(user) {
  if (CARDIO_ACTIVITIES.has(user.activity)) return true;
  try {
    const plan = JSON.parse(user.weekly_plan || '[]');
    return plan.some(a => CARDIO_ACTIVITIES.has(a.activity));
  } catch (e) {
    return false;
  }
}

function getWeekBounds(timezone) {
  const now = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()));
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const d = new Date(todayLocal + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  const mondayOffset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) => dt.toISOString().split('T')[0];
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

function appDisplayName(fitnessApp) {
  return fitnessApp === 'strava' ? 'Strava' :
    fitnessApp === 'apple_health' ? 'Apple Fitness' :
    fitnessApp === 'samsung_health' ? 'Samsung Health' :
    fitnessApp === 'garmin' ? 'Garmin Connect' :
    fitnessApp === 'nike_run_club' ? 'Nike Run Club' :
    fitnessApp === 'google_fit' ? 'Google Fit' :
    fitnessApp === 'fitbit' ? 'Fitbit' : 'your fitness app';
}

function cardioNoScreenshotMsg(language, user) {
  const appName = appDisplayName(user.fitness_app);
  const activities = getUserAllActivities(user).map(a => a.activity).join(' or ');

  if (language === 'tl') {
    return `Screenshot anupunga bro! 📱 Unga ${activities} session-a ${appName}-la paathu screenshot eduthu send pannunga — distance, time, pace verify panren!`;
  }
  if (language === 'hl') {
    return `Bhai screenshot bhejo! 📱 ${appName} mein apna ${activities} session dhundho, screenshot lo aur bhejo — distance, time, pace sab check karunga!`;
  }
  return `Send me your screenshot bro! 📱 Open ${appName}, find today's ${activities} session and screenshot it — I'll check distance, time and pace!`;
}

async function handleCardioCheckin(user, body, media) {
  const hasImage = media && (media.mediaUrl || media.testBase64);

  if (!hasImage) {
    await whatsapp.sendText(user.phone, cardioNoScreenshotMsg(user.language, user));
    return;
  }

  let image;
  try {
    image = await resolveImage(media);
  } catch (err) {
    await whatsapp.sendText(user.phone, cardioNoScreenshotMsg(user.language, user));
    return;
  }

  const photoHash = image.base64 ? crypto.createHash('md5').update(image.base64).digest('hex') : null;

  if (photoHash && db.hasDuplicatePhotoHash(user.id, photoHash)) {
    const msg = user.language === 'tl'
      ? 'Neenga innaikku already use panna screenshot mathum anuppeengala? 😅 Inaikku pudhusa complete panna activity-oda screenshot anupunga!'
      : user.language === 'hl'
      ? 'Bhai yeh screenshot pehle bhi bheja hai! 😅 Aaj ki nayi activity ka screenshot bhejo!'
      : "Looks like you've already submitted this screenshot! 😅 Send today's fresh activity screenshot to check in.";
    await whatsapp.sendText(user.phone, msg);
    return;
  }

  const today = todayStr(config.timezone);
  const allActivities = getUserAllActivities(user);

  // Let Gemini detect which activity is in the screenshot (could be running or cycling for multi-plan users)
  let parsed;
  try {
    parsed = await gemini.parseFitnessAppScreenshot({
      imageBase64: image.base64,
      mimeType: image.mimeType,
      activityType: allActivities.map(a => a.activity).join(' or '),
      todayDate: today,
    });
  } catch (err) {
    console.error('parseFitnessAppScreenshot failed:', err);
    await whatsapp.sendText(user.phone, verifyTroubleMessage(user.language));
    return;
  }

  console.log(`[Cardio] Parsed screenshot for user ${user.id}:`, JSON.stringify(parsed));

  if (!parsed.is_valid) {
    const validActivities = allActivities.map(a => a.activity).join('/');
    const rejectMsg = user.language === 'tl'
      ? `Hmm, ithu correct-ah scan aagala 🤔 ${parsed.reject_reason ? `(${parsed.reject_reason})` : ''} — inaikku unga ${validActivities}-oda ${appDisplayName(user.fitness_app)} screenshot anupunga bro!`
      : user.language === 'hl'
      ? `Yaar, yeh valid nahi laga 🤔 ${parsed.reject_reason ? `(${parsed.reject_reason})` : ''} — aaj ke ${validActivities} ka proper ${appDisplayName(user.fitness_app)} screenshot bhejo!`
      : `Hmm, that doesn't look right 🤔 ${parsed.reject_reason ? `(${parsed.reject_reason}) ` : ''}— send your actual ${validActivities} screenshot from ${appDisplayName(user.fitness_app)} for today!`;
    await whatsapp.sendText(user.phone, rejectMsg);
    return;
  }

  // Identify which plan entry matches the detected activity
  const detectedActivity = parsed.activity_type;
  const activityPlan = getActivityPlan(user, detectedActivity);

  if (!activityPlan && allActivities.length > 0) {
    // Screenshot shows an activity not in their plan
    const planned = allActivities.map(a => a.activity).join(', ');
    const msg = user.language === 'tl'
      ? `Adhu ${detectedActivity} screenshot-a bro? Unga plan-la ${planned} dhaan irukku. Neenga correct activity pannirkeenga-na sollunga!`
      : user.language === 'hl'
      ? `Bhai yeh ${detectedActivity} ka screenshot dikh raha hai, par aapke plan mein ${planned} hai. Sahi activity ka screenshot bhejo!`
      : `That looks like a ${detectedActivity} session, but your plan has ${planned}. Send the right activity screenshot, or let me know if you want to add ${detectedActivity} to your plan!`;
    await whatsapp.sendText(user.phone, msg);
    return;
  }

  // Use the matched plan's goals (or fallback to defaults)
  const weeklyGoalSessions = activityPlan ? activityPlan.days_per_week : (user.days_per_week || 3);
  const weeklyGoalDistanceKm = activityPlan ? activityPlan.goal_distance_km : (user.weekly_goal_distance_km || 3.0);

  // Store checkin with detected activity type
  db.createCheckin({
    userId: user.id,
    date: today,
    description: body || `${detectedActivity} ${parsed.distance_km ? parsed.distance_km.toFixed(2) + 'km' : ''}`,
    photoRef: media.localPath || media.mediaUrl || 'test-image',
    status: 'accepted',
    geminiReason: `${parsed.detected_app} screenshot verified`,
    photoHash,
    distanceKm: parsed.distance_km,
    durationMinutes: parsed.duration_minutes,
    paceMinPerKm: parsed.pace_min_per_km,
    activityCalories: parsed.calories,
    activityType: detectedActivity,
  });

  // Bump streak
  const streak = user.streak + 1;
  db.updateUser(user.id, { streak, pending_checkin_id: null, state: states.ACTIVE, current_gesture: null });

  // Weekly progress for the specific activity checked in
  const { weekStart, weekEnd } = getWeekBounds(config.timezone);
  const weekSessions = db.getWeekCardioCheckinsByActivity(user.id, weekStart, weekEnd, detectedActivity);

  // Recent paces for this activity (exclude today, which is newest)
  const recentForActivity = db.getRecentCardioCheckinsByActivity(user.id, detectedActivity, 8);
  const recentPaces = recentForActivity
    .filter(s => s.pace_min_per_km)
    .slice(1)
    .map(s => s.pace_min_per_km);

  // Also gather other activities' weekly progress for context in coach message
  const otherActivitiesProgress = allActivities
    .filter(a => a.activity !== detectedActivity)
    .map(a => {
      const sessions = db.getWeekCardioCheckinsByActivity(user.id, weekStart, weekEnd, a.activity);
      return { activity: a.activity, done: sessions.length, goal: a.days_per_week };
    });

  // Check if goal upgrade should be suggested (consecutive weeks hitting goal for this activity)
  let suggestGoalUpgrade = false;
  if (weekSessions.length >= weeklyGoalSessions) {
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
    const fmt = (dt) => dt.toISOString().split('T')[0];
    const lastWeekSessions = db.getWeekCardioCheckinsByActivity(user.id, fmt(lastWeekStart), fmt(lastWeekEnd), detectedActivity);
    const lastWeekMetGoal = lastWeekSessions.length >= weeklyGoalSessions &&
      lastWeekSessions.every(s => s.distance_km >= weeklyGoalDistanceKm * 0.85);

    const lastReview = user.last_goal_review_date;
    const daysSinceReview = lastReview
      ? Math.floor((new Date(today) - new Date(lastReview)) / (1000 * 60 * 60 * 24))
      : 999;

    if (lastWeekMetGoal && daysSinceReview >= 7) {
      suggestGoalUpgrade = true;
      db.updateUser(user.id, { last_goal_review_date: today });
    }
  }

  let coachMsg;
  try {
    coachMsg = await gemini.generateCardioCoachFeedback({
      user,
      detectedActivity,
      todaySession: {
        distance_km: parsed.distance_km,
        duration_minutes: parsed.duration_minutes,
        pace_min_per_km: parsed.pace_min_per_km,
        calories: parsed.calories,
      },
      weekSessions,
      weeklyGoalSessions,
      weeklyGoalDistanceKm,
      recentPaces,
      otherActivitiesProgress,
      suggestGoalUpgrade,
      language: user.language,
    });
  } catch (err) {
    console.error('generateCardioCoachFeedback failed:', err);
    coachMsg = messages.t(user.language, 'checkinAccepted', streak, Math.max(config.pledgeDays - user.day_count, 0));
  }

  await whatsapp.sendText(user.phone, coachMsg);

  // If program ended
  if (user.day_count >= config.pledgeDays) {
    const { calculatePledgePayout } = require('../utils/payout');
    const { payout } = calculatePledgePayout(user, user.missed_count);
    const completedDays = config.pledgeDays - user.missed_count;
    db.updateUser(user.id, { state: states.COMPLETED });
    const { publicUrl } = await poster.renderFinalPoster({
      userId: user.id, name: user.name, activity: user.activity, completedDays, payout,
    });
    await whatsapp.sendMedia(user.phone, `${user.name} — final tally.`, publicUrl);
    const msg = user.missed_count === 0
      ? messages.t(user.language, 'finalComplete', payout)
      : messages.t(user.language, 'finalPartial', completedDays, payout);
    await whatsapp.sendText(user.phone, msg);
  }
}

async function handleActiveCheckin(user, body, media) {
  if (isCardioUser(user)) {
    await handleCardioCheckin(user, body, media);
    return;
  }

  // Gym flow: gesture-based photo verification
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
