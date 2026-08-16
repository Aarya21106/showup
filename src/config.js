require('dotenv').config({ override: true });
const path = require('path');

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : '',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },

  paymentLinkUrl: process.env.PAYMENT_LINK_URL || '',

  admin: {
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },

  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  pledgeDays: parseInt(process.env.PLEDGE_DAYS || '30', 10),
  trialDays: 14,
  depositAmountInr: parseInt(process.env.DEPOSIT_AMOUNT_INR || '300', 10),
  platformFeeInr: parseInt(process.env.PLATFORM_FEE_INR || '25', 10),
  fullPayoutInr: parseInt(process.env.FULL_PAYOUT_INR || '275', 10), // 300 - 25 platform fee
  slipPenaltyInr: parseInt(process.env.SLIP_PENALTY_INR || '50', 10),
  freeStrikesThresholdDays: 10, // if workout days > 10 per month
  freeStrikesCount: 2, // 2 strikes without penalty
  weeklyDiscountInr: 10, // ₹10 off per clean week
  maxDiscountInr: 40, // max ₹40 discount per month
  pricing: {
    standard: { base: 119, min: 79 },
    pro: { base: 239, min: 199 },
  },
};

const isPlaceholder = (val) => {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    lower.includes('placeholder') ||
    lower.includes('your_') ||
    lower.includes('change-me') ||
    lower.includes('xxxxxx')
  );
};

config.geminiConfigured = Boolean(
  config.gemini.apiKey &&
  !isPlaceholder(config.gemini.apiKey)
);

module.exports = config;
