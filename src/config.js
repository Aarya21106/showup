require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
    sandboxCode: process.env.TWILIO_SANDBOX_CODE || '',
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
  depositAmountInr: parseInt(process.env.DEPOSIT_AMOUNT_INR || '300', 10),
  fullPayoutInr: parseInt(process.env.FULL_PAYOUT_INR || '500', 10),
  slipPenaltyInr: parseInt(process.env.SLIP_PENALTY_INR || '50', 10),
};

config.twilioConfigured = Boolean(config.twilio.accountSid && config.twilio.authToken);
config.geminiConfigured = Boolean(config.gemini.apiKey);

module.exports = config;
