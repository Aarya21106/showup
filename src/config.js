require('dotenv').config({ override: true });

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  whatsapp: {
    from: process.env.WHATSAPP_FROM || 'whatsapp:+919500665712',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  },

  paymentLinkUrl: process.env.PAYMENT_LINK_URL || '',

  admin: {
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },

  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  pledgeDays: parseInt(process.env.PLEDGE_DAYS || '30', 10),
  depositAmountInr: parseInt(process.env.DEPOSIT_AMOUNT_INR || '300', 10),
  fullPayoutInr: parseInt(process.env.FULL_PAYOUT_INR || '500', 10),
  slipPenaltyInr: parseInt(process.env.SLIP_PENALTY_INR || '50', 10),
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

config.whatsappConfigured = Boolean(
  config.whatsapp.from
);
config.geminiConfigured = Boolean(
  config.gemini.apiKey &&
  !isPlaceholder(config.gemini.apiKey)
);

module.exports = config;

