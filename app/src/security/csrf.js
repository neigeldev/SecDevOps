const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');

// V10: protección CSRF con el patrón "Signed Double-Submit Cookie" (OWASP).
// - La cookie guarda un valor aleatorio (HttpOnly, SameSite=Strict).
// - El formulario lleva HMAC(clave, valor); sin la clave nadie puede calcularlo.
// La clave se deriva con HKDF del secreto de la aplicación (separación de claves).
const KEY = Buffer.from(crypto.hkdfSync('sha256', config.jwt.secret, 'securenotes', 'csrf-token-v1', 32));
const COOKIE_NAME = config.cookieSecure ? '__Host-csrf' : 'csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function tokenFor(nonce) {
  return crypto.createHmac('sha256', KEY).update(nonce).digest('base64url');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function csrfProtection(req, res, next) {
  let nonce = req.cookies[COOKIE_NAME];
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) {
    nonce = crypto.randomBytes(32).toString('base64url');
    res.cookie(COOKIE_NAME, nonce, { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' });
    req.cookies[COOKIE_NAME] = undefined; // una cookie nueva nunca valida un POST
  }
  res.locals.csrfToken = tokenFor(nonce);

  if (SAFE_METHODS.has(req.method)) return next();

  const sent = req.body && req.body._csrf;
  if (!req.cookies[COOKIE_NAME] || typeof sent !== 'string' || !safeEqual(sent, res.locals.csrfToken)) {
    logger.security('csrf_failed', req);
    return res.status(403).render('error', { message: 'La solicitud no es válida (token CSRF). Recarga la página e intenta de nuevo.' });
  }
  next();
}

module.exports = { csrfProtection };
