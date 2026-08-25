/**
 * Motivation Engine — a self-contained toolkit of psychologically-grounded,
 * short-word, fast-to-read message generators.
 *
 * NOTHING currently wired into the live app was touched to build this — this
 * is a separate, standalone file. generateObjectionResponse below is copied
 * from services/gemini.js (which stays live and unchanged); everything else
 * here is new. Nothing in here is wired into onboarding.js/router.js yet —
 * these are ready to use, but swapping any live message for one of these is
 * a separate, deliberate step.
 *
 * === THE TACTICS, AND WHY EACH ONE IS HERE ===
 * (sourced from real persuasion/coaching research, not improvised)
 *
 * 1. LOSS AVERSION — people feel losing something they already have about
 *    twice as strongly as gaining the same thing. "Don't lose your streak"
 *    beats "build a streak." ShowUp's refundable deposit already IS a loss-
 *    aversion device; the copy here leans into that instead of burying it.
 * 2. IDENTITY FRAMING — people act to stay consistent with who they believe
 *    they are. "Become someone who shows up" outperforms "lose weight."
 * 3. COMMITMENT & CONSISTENCY — once someone states a commitment out loud
 *    (or in writing), they feel internal pressure to honor it. Reflecting
 *    their own words back to them (vision_text/blocker_text, already
 *    collected at onboarding) is stronger than generic encouragement.
 * 4. SOCIAL PROOF — people look to others' behavior under uncertainty. Used
 *    honestly here only in general, truthful terms (never fabricated
 *    numbers or fake testimonials) — e.g. "most people who show up the
 *    first week keep going," not invented statistics.
 * 5. FRESH START EFFECT — people are more motivated to act right after a
 *    clean temporal marker (Day 1, a new week, a reset). Leaned on for
 *    kickoff copy.
 * 6. IMPLEMENTATION INTENTIONS — a concrete "when X happens, I do Y" plan
 *    beats a vague intention. Day-1 copy anchors to their actual chosen
 *    time/activity, not abstract willpower.
 * 7. AUTONOMY-SUPPORTIVE FRAMING (motivational interviewing) — reconnect
 *    people to THEIR OWN stated reasons rather than arguing at them with
 *    external reasons. Never "you should," always "you said."
 *
 * Sources consulted: Modern Marketing Institute's 2026 persuasion-principles
 * roundup (loss aversion, social proof, AIDA structure), Positive
 * Psychology's motivational-interviewing principles, and coaching guidance
 * on fear-reframing (validate -> reconnect to stated goal -> factual
 * reassurance).
 *
 * === STYLE RULE APPLIED TO EVERY PROMPT BELOW ===
 * Short words over long ones. Short sentences. No corporate-speak, no
 * jargon, nothing a distracted person has to re-read. If a 1-syllable word
 * says it, use that, not a fancier synonym. This is a deliberate constraint,
 * not a suggestion — it's baked into every prompt's rules so it survives
 * changes to the flow around it.
 */

const gemini = require('./gemini');
const { callGeminiRaw: callGemini, sanitizeScriptForLanguage, buildCoachContext, LANGUAGE_NAMES } = gemini;

const SHORT_WORDS_RULE = `WORD RULE (critical): use short, plain words. Say "start" not "commence," "help" not "facilitate," "show up" not "demonstrate commitment." Short sentences. No jargon, no corporate phrases, nothing a tired reader has to read twice.`;

/**
 * The pitch for WHY the deposit + pledge exists — replaces the long,
 * paragraph-style explanation with something built to be read in one glance
 * and still land. Loss aversion (frame the deposit as something already
 * theirs, at risk) + identity framing (who they become, not just what they
 * do) + AIDA shape (hook, why it matters, what happens, one clear action).
 */
async function generateMembershipPitch(user, { depositInr, slipPenaltyInr, freeStrikes, refundInr, basicPrice, proPrice, weeklyDiscountInr, maxDiscountInr }) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, a direct fitness coach on WhatsApp. Write the message that asks ${user.name || 'the user'} to lock in their membership before Day 1.
${coachCtx}
${SHORT_WORDS_RULE}

Real facts to use (never invent others):
- Deposit: ₹${depositInr}, fully refundable
- 30-day pledge, first ${freeStrikes} misses free, then ₹${slipPenaltyInr}/miss
- Full refund on a clean run: ₹${refundInr}
- Basic ₹${basicPrice}/month (reminders, check-ins, AI nutrition plan) or Pro ₹${proPrice}/month (+ diet logging, calorie tracking, burn logs, deep-dive coaching)
- Both include the deposit. ₹${weeklyDiscountInr} off every clean week, up to ₹${maxDiscountInr}/month
- Reply "1" for Basic, "2" for Pro, or send a promo code

Structure (short lines, blank line between each, total under 90 words):
1. One line: the deposit is THEIRS, held, not spent — they get it back by showing up, not by paying more.
2. One line: this isn't about tracking workouts, it's about becoming someone who doesn't quit on themselves.
3. The plan choice (Basic vs Pro) in the shortest form that's still clear.
4. One line, the clear next action (reply 1, 2, or send a promo code).

Zero emojis. Reply in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6, maxTokens: 350 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.error('[Motivation] generateMembershipPitch error:', err);
    return null;
  }
}

/**
 * Day 1 kickoff — fresh start effect + implementation intention (anchor to
 * their real chosen time/activity, not vague willpower) + identity framing.
 */
async function generateDay1Kickoff(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, a direct fitness coach on WhatsApp. Today is Day 1 for ${user.name || 'the user'}.
${coachCtx}
${SHORT_WORDS_RULE}

Their plan: ${user.activity || 'workout'} at ${user.checkin_time || '08:00'}, ${user.days_per_week || 3} days a week.

Write a short Day 1 message (under 50 words, 2-3 short lines):
1. Name today as the start of a new streak — a clean slate, right now.
2. Anchor to their exact time/activity: "at ${user.checkin_time || '08:00'}, you show up" — concrete, not abstract.
3. One line on identity: today isn't about the workout, it's proof of who they're becoming.

Zero emojis, no filler. Reply in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6, maxTokens: 250 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.error('[Motivation] generateDay1Kickoff error:', err);
    return null;
  }
}

/**
 * Streak-protection nudge — pure loss aversion. Sent when a user has a real
 * streak going and is at risk of missing today (e.g. from the scheduler, if
 * wired in later). Never fabricates a number that isn't user.streak itself.
 */
async function generateStreakSaveNudge(user) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const streak = user.streak || 0;
  const coachCtx = buildCoachContext(user);

  if (streak < 1) return null; // no real streak to protect — don't fake urgency

  const prompt = `You are ShowUp, a direct fitness coach on WhatsApp. ${user.name || 'The user'} has a real ${streak}-day streak and hasn't checked in yet today.
${coachCtx}
${SHORT_WORDS_RULE}

Write one short nudge (under 30 words, 1-2 lines): the streak they already built is real and at risk TODAY if they skip — losing it costs more than never starting one. No guilt-tripping, just the plain stakes. End with a short nudge to check in now.

Zero emojis. Reply in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6, maxTokens: 150 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.error('[Motivation] generateStreakSaveNudge error:', err);
    return null;
  }
}

/**
 * Responds to a doubt/fear/hesitation statement — copied as-is from
 * services/gemini.js's generateObjectionResponse (that copy stays live and
 * unchanged; this one lives here so this file is a complete, standalone
 * toolkit). See gemini.js for the full technique writeup — same tactic:
 * reflect the concern, reconnect to their own stated vision/blocker,
 * address the real facts, then invite them to continue.
 */
async function generateObjectionResponse({ user, concernText }) {
  const langName = LANGUAGE_NAMES[user.language] || 'English';
  const coachCtx = buildCoachContext(user);

  const prompt = `You are ShowUp, a warm, direct AI fitness coach on WhatsApp. The user just said something that sounds like doubt, fear, or hesitation — NOT a request to move forward. Address it before anything else.
${coachCtx}
${SHORT_WORDS_RULE}

What they just said: "${concernText}"

Their own stated reason for starting this (collected earlier — use it, don't ignore it):
- Vision/goal in their words: "${user.vision_text || 'not stated'}"
- What's held them back before: "${user.blocker_text || 'not stated'}"

Respond using this exact structure (do not label the steps, just write it naturally as 2-4 short sentences, max 70 words):
1. Reflect their concern back in one short line so they feel heard — don't dismiss or minimize it.
2. Reconnect them to their OWN stated vision/reason above (quote or paraphrase it) — not a generic "you can do it," their actual words.
3. Address the SPECIFIC factual root of the fear if it's about money/failing: the deposit is refundable, there are 2 free buffer days with zero penalty before any money is ever forfeited, and missing a day doesn't end the pledge — only sustained no-shows cost anything. Use only these real facts, never invent new ones.
4. End by gently inviting them to continue (do not repeat their exact previous question here — that gets asked again right after this message).

Rules: zero emojis, warm but not saccharine, no corporate reassurance clichés ("we're here for you every step"). Reply in ${langName}.`;

  try {
    const text = await callGemini({ parts: [{ text: prompt }], temperature: 0.6, maxTokens: 300 });
    return sanitizeScriptForLanguage(text.trim(), user.language);
  } catch (err) {
    console.error('[Motivation] generateObjectionResponse error:', err);
    return "That's a fair worry to have. The deposit is fully refundable, and you get 2 free buffer days before anything is ever forfeited — one missed day doesn't cost you anything.";
  }
}

module.exports = {
  generateMembershipPitch,
  generateDay1Kickoff,
  generateStreakSaveNudge,
  generateObjectionResponse,
};
