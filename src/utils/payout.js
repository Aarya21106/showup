const config = require('../config');

/**
 * Calculates the payout at the end of a 30-day pledge period or for status checks.
 * Rules:
 * - Deposit: ₹300
 * - Platform fee: ₹25 (leaving ₹275 max refund)
 * - If committed workout days > 10 in a month, user gets 2 FREE STRIKES (0 penalty for first 2 slips).
 * - Additional slips cost ₹50 each.
 */
function calculatePledgePayout(user, missedCount = 0) {
  const deposit = config.depositAmountInr; // 300
  const platformFee = config.platformFeeInr; // 25
  const baseRefund = deposit - platformFee; // 275
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
 * Calculates month-2 subscription pricing based on weekly consistency.
 * For each week (7-day block) with 0 slips, award ₹10 discount (max ₹40 off).
 * - Standard: ₹119/mo base → ₹79/mo min
 * - Pro: ₹239/mo base → ₹199/mo min
 */
function calculateSubscriptionDiscount(cleanWeeksCount = 0, isProTier = false) {
  const discountPerWeek = config.weeklyDiscountInr; // 10
  const maxDiscount = config.maxDiscountInr; // 40
  const totalDiscount = Math.min(cleanWeeksCount * discountPerWeek, maxDiscount);

  const basePrice = isProTier ? config.pricing.pro.base : config.pricing.standard.base; // 239 or 119
  const finalPrice = basePrice - totalDiscount;

  return {
    cleanWeeksCount,
    totalDiscount,
    basePrice,
    finalPrice,
  };
}

module.exports = {
  calculatePledgePayout,
  calculateSubscriptionDiscount,
};
