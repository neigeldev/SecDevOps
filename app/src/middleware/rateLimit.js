const { rateLimit } = require('express-rate-limit');
const logger = require('../logger');

// V13: limitación de intentos para frenar fuerza bruta y relleno de credenciales.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.security('login_rate_limited', req, { username: String(req.body.username || '') });
    res.status(429).render('error', { message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
  }
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MIN || 300),
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

module.exports = { loginLimiter, globalLimiter };
