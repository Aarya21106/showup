/**
 * Shared off-topic question detector for onboarding state handlers.
 *
 * Problem this solves: Every onboarding state (AWAITING_COMMITMENT,
 * AWAITING_PAYMENT, AWAITING_NUTRITION_CHOICE, etc.) was implementing its own
 * ad-hoc fallback, or no fallback at all, leading to gym/payment questions
 * being either silently dropped, stored as form data, or answered by the
 * wrong handler.
 *
 * Usage:
 *   const { isOffTopicQuestion } = require('../utils/intent');
 *   const check = isOffTopicQuestion(text);
 *   if (check) {
 *     if (check.isGymQ)     // → route to gemini.handleGeneralQuery
 *     if (check.isPaymentQ) // → route to gemini.answerPaymentAndTermsQuery
 *   }
 */

/**
 * Returns null if the text is a normal flow response (e.g. "1", "paid",
 * a commitment statement).
 *
 * Returns an object { isQuestion, isGymQ, isPaymentQ } when the text looks
 * like an off-topic question that should be answered before the flow continues.
 *
 * @param {string} text - The incoming user message (already trimmed).
 * @returns {{ isQuestion: true, isGymQ: boolean, isPaymentQ: boolean } | null}
 */
function isOffTopicQuestion(text) {
  if (!text || text.trim().length === 0) return null;

  const trimmed = text.trim();

  // Heuristic 1: ends with a question mark
  const endsWithQ = /\?$/.test(trimmed);

  // Heuristic 2: starts with a question word (English + common Tanglish/Hinglish)
  const startsWithQWord = /^(what|how|which|when|why|can|could|should|is|are|do|does|will|would|who|where|enna|epdi|eppadi|yenna|yepdi|kya|kaisa|kaise|kyun|kab|kahan)\b/i.test(trimmed);

  if (!endsWithQ && !startsWithQWord) return null;

  // Classify the topic so the caller can route to the right handler
  const isPaymentQ = /(payment|deposit|refund|money|cost|fee|stake|pay|amount|rupee|₹|upi|transfer|bank|account|receipt)/i.test(trimmed);
  const isGymQ = new RegExp([
    // Core fitness
    'exercise|workout|training|diet|food|eat|nutrition|meal|calorie|protein|carb|fat|macro',
    // Body & recovery
    'muscle|body|weight|pain|injury|sore|recover|rest|sleep|energy|tired|fatigue',
    // Activity types — gym
    'gym|bench|squat|deadlift|pull.?up|push.?up|dumbbell|barbell|machine|rep|set|lift|press',
    // Activity types — home
    'home.?workout|home.?exercise|home.?training|bodyweight|resistance.?band|no.?equipment',
    // Activity types — cardio / outdoor
    'cardio|cycling|cycle|bike|bicycle|run|running|jog|jogging|walk|walking|treadmill',
    'swimming|swim|hike|hiking|outdoor|step|steps|stair',
    // Activity types — classes / sports
    'yoga|pilates|hiit|crossfit|zumba|aerobic|sport|football|cricket|basketball|badminton',
    // Form & technique
    'form|posture|technique|stretch|warm.?up|cool.?down|mobility|flexibility',
    // Supplements & nutrition
    'supplement|creatine|whey|protein.?shake|pre.?workout|bcaa|vitamin|omega',
    // Progress & goals
    'progress|goal|plateau|bulk|cut|shred|lean|toned|strength|endurance|stamina|vo2',
    // Tanglish fitness words
    'gym.?poren|gym.?porom|workout.?panren|workout.?pannunga|exercise.?panna|velaikku.?poga',
    'thol.?valikudhu|kai.?valikudhu|kaal.?valikudhu|mula.?valikudhu',
    // Hinglish fitness words
    'gym.?ja|exercise.?kar|workout.?kar|dard.?ho|thaka|thaki|uthna|protein.?kha',
  ].join('|'), 'i').test(trimmed);

  return { isQuestion: true, isGymQ, isPaymentQ };
}

module.exports = { isOffTopicQuestion };
