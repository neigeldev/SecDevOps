const tokens = require('../security/tokens');
const db = require('../db');
const logger = require('../logger');

// Carga el usuario autenticado a partir de la cookie de sesión.
// V09: el rol se consulta en la base de datos en cada petición; el token solo
// identifica al usuario, así un cambio de rol o una baja surten efecto de inmediato.
async function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies[tokens.COOKIE_NAME];
  if (token) {
    try {
      const claims = tokens.verify(token);
      const result = await db.query('SELECT id, username, role FROM users WHERE id = $1', [claims.id]);
      req.user = result.rows[0] || null;
    } catch (e) {
      req.user = null;
    }
    if (!req.user) tokens.clearSessionCookie(res);
  }
  res.locals.user = req.user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    logger.security('access_denied', req, { required: 'admin' });
    return res.status(403).render('error', { message: 'Acceso denegado' });
  }
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin };
