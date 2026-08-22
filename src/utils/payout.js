const config = require('../config');

/**
 * Calculates the payout at the end of a 30-day pledge period or for status checks.
 * Rules:
 * - Deposit: ₹300
 * - Platform fee: ₹30 (leaving ₹270 max refund)
 * - If committed workout days > 10 in a month, user gets 2 FREE STRIKES (0 penalty for first 2 slips).
 * - Additional slips cost ₹50 each.
 */
function calculatePledgePayout(user, missedCount = 0) {
  // Promo-trial users never actually pay the full deposit — their pledge is
  // staked on a smaller recorded amount (see onboarding.js's promo code
  // branch), so refund math must use THEIR deposit, not the standard one.
  const deposit = (user && user.deposit_amount_inr) || config.depositAmountInr; // 300
  const platformFee = config.platformFeeInr; // 30
  const baseRefund = deposit - platformFee; // 270
  const penaltyPerSlip = config.slipPenaltyInr; // 50

  // Determine committed workout days in 30 days
  let committedWorkoutDays = 12; // default estimate (3 days/wk)
  if (user && user.days_per_week) {
    committedWorkoutDays = Math.round(user.days_per_week * 4.3);
  } else if (user && user.timetable) {
    try {
      const tt = JSON.parse(user.timetable);
      const workoutDaysPerWeek = Object.values(tt).filter(v => v && v.toLowerCase() !== 'rest').length;
      committedWorkoutDays = Math.round(workoutDaysPerWeek * 4.3);
    } catch (e) {}
  }

  // 2 free strikes if committed workout days > 10
  const eligibleForFreeStrikes = committedWorkoutDays > config.freeStrikesThresholdDays;
  const freeStrikes = eligibleForFreeStrikes ? config.freeStrikesCount : 0;
  const strikesUsed = Math.min(missedCount, freeStrikes);
  const penalizedSlips = Math.max(0, missedCount - freeStrikes);

  const payout = Math.max(0, baseRefund - (penalizedSlips * penaltyPerSlip));

  return {
    deposit,
    platformFee,
    baseRefund,
    committedWorkoutDays,
    eligibleForFreeStrikes,
    freeStrikes,
    strikesUsed,
    missedCount,
    penalizedSlips,
    payout,
  };
}

/**
 * Calculates month-2 subscription pricing based on consistency.
 * ₹10 off per clean (zero-miss) week, not a flat monthly discount — a fully
 * consistent ~4-week month earns 4 × ₹10 = ₹40 off, capped at
 * config.maxDiscountInr. Bug fix: this used to be a single all-or-nothing
 * ₹10/month discount that ignored how many weeks were actually clean.
 * - Basic: ₹129/mo base → ₹89/mo at full consistency
 * - Pro: ₹239/mo base → ₹199/mo at full consistency
 */
function calculateSubscriptionDiscount(missedCount = 0, isProTier = false) {
  const totalWeeksInMonth = 4;
  const cleanWeeks = Math.max(0, totalWeeksInMonth - missedCount);
  const totalDiscount = Math.min(cleanWeeks * config.weeklyDiscountInr, config.maxDiscountInr);
  const basePrice = isProTier ? config.pricing.pro.monthly : config.pricing.basic.monthly;
  const finalPrice = basePrice - totalDiscount;

  return {
    missedCount,
    cleanWeeks,
    totalDiscount,
    basePrice,
    finalPrice,
  };
}

module.exports = {
  calculatePledgePayout,
  calculateSubscriptionDiscount,
};
