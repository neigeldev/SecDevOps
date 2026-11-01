const express = require('express');
const db = require('../db');
const passwordUtil = require('../security/password');
const tokens = require('../security/tokens');

const router = express.Router();

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;
  console.log(`Intento de login: usuario=${username} password=${password}`);
  try {
    // V01: consulta parametrizada; el valor nunca se concatena al SQL
    const result = await db.query(
      'SELECT id, username, role, password_hash FROM users WHERE username = $1',
      [String(username || '')]
    );
    const user = result.rows[0];
    if (!user || !passwordUtil.verify(String(password || ''), user.password_hash)) {
      return res.status(401).render('login', { error: 'Usuario o contraseña incorrectos' });
    }
    res.cookie('token', tokens.sign(user));
    res.redirect('/notes');
  } catch (err) {
    next(err);
  }
});

router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/register', async (req, res, next) => {
  const { username, password, full_name, email } = req.body;
  try {
    await db.query(
      'INSERT INTO users (username, password_hash, full_name, email) VALUES ($1, $2, $3, $4)',
      [username, passwordUtil.hash(password), full_name, email]
    );
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

module.exports = router;
