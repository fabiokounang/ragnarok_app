const rateLimit = require('express-rate-limit');

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please wait and try again.',
  skipSuccessfulRequests: true,
});

const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many registration attempts from this network. Try again later.',
});

module.exports = {
  authLoginLimiter,
  authRegisterLimiter,
};
