const tokens = require('../security/tokens');

// Carga el usuario autenticado a partir de la cookie
function loadUser(req, res, next) {
  const token = req.cookies[tokens.COOKIE_NAME];
  req.user = null;
  if (token) {
    try {
      req.user = tokens.verify(token);
    } catch (e) {
      req.user = null;
    }
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
    return res.status(403).render('error', { message: 'Acceso denegado' });
  }
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin };
