const express = require('express');
const db = require('../db');
const passwordUtil = require('../security/password');
const tokens = require('../security/tokens');
const logger = require('../logger');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

let dummy;
async function dummyHash() {
  if (!dummy) dummy = await passwordUtil.hash('usuario-inexistente');
  return dummy;
}

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', loginLimiter, async (req, res, next) => {
  const { username, password } = req.body;
  try {
    // V01: consulta parametrizada; el valor nunca se concatena al SQL
    const result = await db.query(
      'SELECT id, username, role, password_hash FROM users WHERE username = $1',
      [String(username || '')]
    );
    const user = result.rows[0];
    // Si el usuario no existe se verifica contra un hash señuelo para que el
    // tiempo de respuesta no revele qué usuarios existen.
    const valid = await passwordUtil.verify(String(password || ''), user ? user.password_hash : await dummyHash());
    if (!user || !valid) {
      // V12: se registra el intento fallido (sin la contraseña) para alertas
      logger.security('login_failed', req, { username: String(username || '').slice(0, 50) });
      return res.status(401).render('login', { error: 'Usuario o contraseña incorrectos' });
    }
    tokens.setSessionCookie(res, user);
    logger.info('login_success', { userId: user.id, ip: req.ip });
    res.redirect('/notes');
  } catch (err) {
    next(err);
  }
});

router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/register', loginLimiter, async (req, res, next) => {
  const { username, password, full_name, email } = req.body;
  const policyError = passwordUtil.validatePolicy(password);
  if (policyError) return res.status(400).render('register', { error: policyError });
  try {
    await db.query(
      'INSERT INTO users (username, password_hash, full_name, email) VALUES ($1, $2, $3, $4)',
      [username, await passwordUtil.hash(password), full_name, email]
    );
    logger.info('user_registered', { ip: req.ip });
    res.redirect('/login');
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).render('register', { error: 'El nombre de usuario no está disponible' });
    }
    next(err);
  }
});

router.post('/logout', (req, res) => {
  if (req.user) logger.info('logout', { userId: req.user.id });
  tokens.clearSessionCookie(res);
  res.redirect('/');
});

module.exports = router;
