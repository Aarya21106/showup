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
  paymentLinkUrlBasic: process.env.PAYMENT_LINK_URL_BASIC || '',
  paymentLinkUrlPro: process.env.PAYMENT_LINK_URL_PRO || '',

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  google: {
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
  },

  admin: {
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },

  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  pledgeDays: parseInt(process.env.PLEDGE_DAYS || '30', 10),
  trialDays: 14,
  depositAmountInr: parseInt(process.env.DEPOSIT_AMOUNT_INR || '300', 10),
  platformFeeInr: parseInt(process.env.PLATFORM_FEE_INR || '30', 10),
  slipPenaltyInr: parseInt(process.env.SLIP_PENALTY_INR || '50', 10),
  freeStrikesThresholdDays: 10, // if workout days > 10 per month
  freeStrikesCount: 2, // 2 strikes without penalty
  weeklyDiscountInr: 10, // ₹10 off per clean (zero-miss) week
  maxDiscountInr: 40, // cap: 4 clean weeks × ₹10 = ₹40/month for full consistency
  pricing: {
    basic: { monthly: 129, minAfterDiscount: 89 },  // 129 - maxDiscountInr
    pro:   { monthly: 239, minAfterDiscount: 199 }, // 239 - maxDiscountInr
  },
};

// Always derived from the deposit and fee above — never its own env var, so it
// can't silently drift out of sync with them (a stale FULL_PAYOUT_INR=500 once
// sat in .env, quoting a "refund" bigger than the deposit itself).
config.fullPayoutInr = config.depositAmountInr - config.platformFeeInr;

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
