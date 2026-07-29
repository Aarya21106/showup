const states = require('./states');
const messages = require('./messages');
const db = require('../db/db');
const gemini = require('../services/gemini');
const twilio = require('../services/twilio');
const poster = require('../services/poster');
const config = require('../config');
const { parseTime } = require('../utils/time');
const { todayStr } = require('../utils/date');

async function askNext(phone, nextQuestion, justAskedQuestion, answer, language, name) {
  const ack = await gemini.acknowledgeAnswer({ question: justAskedQuestion, answer, language, name }).catch(() => null);
  const text = ack ? `${ack}\n\n${nextQuestion}` : `${messages.fallbackAck(language)}\n\n${nextQuestion}`;
  await twilio.sendText(phone, text);
}

// Best-effort extraction of a 1-10 commitment number from free text ("9", "an 8 honestly",
// "10/10"). Falls back to a reasonable default rather than blocking the flow on a parse miss.
function parseScore(text) {
  const match = (text || '').match(/\d{1,2}/);
  if (!match) return 8;
  return Math.max(1, Math.min(10, parseInt(match[0], 10)));
}

async function sendPlanAndDepositAsk(user) {
  const { publicUrl } = await poster.renderPlanPoster({
    userId: user.id,
    name: user.name,
    activity: user.activity,
    days: user.days_per_week,
    time: user.checkin_time,
    blocker: user.blocker_text,
  });

  await twilio.sendMedia(user.phone, `${user.name}, here's your pledge.`, publicUrl);
  await twilio.sendText(user.phone, messages.t(user.language, 'depositAsk', {
    name: user.name,
    amt: config.depositAmountInr,
    refund: config.fullPayoutInr,
    penalty: config.slipPenaltyInr,
    days: config.pledgeDays,
    blocker: user.blocker_text,
    vision: user.vision_text,
    score: user.commitment_score,
  }));
  await twilio.sendText(user.phone, messages.t(user.language, 'howItWorks'));
  if (config.paymentLinkUrl) {
    await twilio.sendText(user.phone, messages.t(user.language, 'paymentLink', config.paymentLinkUrl));
  } else {
    console.warn('PAYMENT_LINK_URL is not set - skipped sending payment link to', user.phone);
  }
}

async function handleOnboarding(user, body) {
  const phone = user.phone;

  switch (user.state) {
    case states.ONBOARD_NAME: {
      const name = body.trim().slice(0, 60) || 'friend';
      db.updateUser(user.id, { name, state: states.ONBOARD_LANGUAGE });
      await askNext(phone, messages.question('en', 'language'), messages.question('en', 'name'), body, 'en', name);
      break;
    }

    case states.ONBOARD_LANGUAGE: {
      const language = messages.detectLanguage(body);
      db.updateUser(user.id, { language, state: states.ONBOARD_ACTIVITY });
      await askNext(phone, messages.question(language, 'activity'), messages.question('en', 'language'), body, language, user.name);
      break;
    }

    case states.ONBOARD_ACTIVITY: {
      db.updateUser(user.id, { activity: body.trim().slice(0, 120), state: states.ONBOARD_DAYS });
      await askNext(phone, messages.question(user.language, 'days'), messages.question(user.language, 'activity'), body, user.language, user.name);
      break;
    }

    case states.ONBOARD_DAYS: {
      db.updateUser(user.id, { days_per_week: body.trim().slice(0, 60), state: states.ONBOARD_TIME });
      await askNext(phone, messages.question(user.language, 'time'), messages.question(user.language, 'days'), body, user.language, user.name);
      break;
    }

    case states.ONBOARD_TIME: {
      const checkinTime = parseTime(body);
      db.updateUser(user.id, { checkin_time: checkinTime, state: states.ONBOARD_BLOCKER });
      await askNext(phone, messages.question(user.language, 'blocker'), messages.question(user.language, 'time'), body, user.language, user.name);
      break;
    }

    case states.ONBOARD_BLOCKER: {
      const blocker = body.trim().slice(0, 200);
      db.updateUser(user.id, { blocker_text: blocker, state: states.ONBOARD_VISION });
      await askNext(phone, messages.question(user.language, 'vision'), messages.question(user.language, 'blocker'), body, user.language, user.name);
      break;
    }

    case states.ONBOARD_VISION: {
      const vision = body.trim().slice(0, 200);
      db.updateUser(user.id, { vision_text: vision, state: states.ONBOARD_COMMITMENT });
      await askNext(phone, messages.question(user.language, 'commitment'), messages.question(user.language, 'vision'), body, user.language, user.name);
      break;
    }

    case states.ONBOARD_COMMITMENT: {
      const score = parseScore(body);
      const updated = db.updateUser(user.id, { commitment_score: score, state: states.AWAITING_PAYMENT });
      await sendPlanAndDepositAsk(updated);
      break;
    }

    case states.AWAITING_PAYMENT: {
      if (/\bpaid\b/i.test(body)) {
        const today = todayStr(config.timezone);
        db.updateUser(user.id, {
          deposit_status: 'paid', started_at: today, day_count: 0, state: states.ACTIVE,
        });
        await twilio.sendText(phone, messages.t(user.language, 'paidConfirmed', user.checkin_time));
      } else {
        await twilio.sendText(phone, messages.t(user.language, 'notPaidYet'));
      }
      break;
    }

    default:
      break;
  }
}

module.exports = { handleOnboarding, sendPlanAndDepositAsk };
