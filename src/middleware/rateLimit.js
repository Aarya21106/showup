const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter: 30 requests per minute per IP.
 * Applies to all /api/* routes.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'You are sending too many requests. Please wait a minute and try again.',
    retryAfterMs: 60000,
  },
});

/**
 * Stricter rate limiter for message sending: 10 requests per minute per IP.
 * Prevents spam-sending messages through the API.
 */
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many messages',
    message: 'You are sending messages too quickly. Please slow down.',
    retryAfterMs: 60000,
  },
});

module.exports = { apiLimiter, messageLimiter };
