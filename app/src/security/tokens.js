const jwt = require('jsonwebtoken');
const config = require('../config');

// V07: algoritmo fijado, expiración, emisor y audiencia verificados.
const ALGORITHM = 'HS256';

// El prefijo __Host- obliga al navegador a exigir Secure, Path=/ y sin Domain
const COOKIE_NAME = config.cookieSecure ? '__Host-session' : 'session';

const COOKIE_OPTIONS = Object.freeze({
  httpOnly: true, // inaccesible desde JavaScript (mitiga robo por XSS)
  secure: config.cookieSecure, // solo por HTTPS
  sameSite: 'strict', // no se envía en peticiones entre sitios (mitiga CSRF)
  path: '/'
});

function sign(user) {
  return jwt.sign({ sub: String(user.id), username: user.username, role: user.role }, config.jwt.secret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwt.ttlSeconds,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  });
}

function verify(token) {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: [ALGORITHM],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  });
  return { id: Number(payload.sub), username: payload.username, role: payload.role };
}

function setSessionCookie(res, user) {
  res.cookie(COOKIE_NAME, sign(user), { ...COOKIE_OPTIONS, maxAge: config.jwt.ttlSeconds * 1000 });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}

module.exports = { sign, verify, setSessionCookie, clearSessionCookie, COOKIE_NAME };
