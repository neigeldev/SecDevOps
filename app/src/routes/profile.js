const express = require('express');
const _ = require('lodash');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function loadProfile(id) {
  const r = await db.query('SELECT id, username, full_name, email, role FROM users WHERE id = $1', [id]);
  return r.rows[0];
}

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    res.render('profile', { profile: await loadProfile(req.user.id), message: null });
  } catch (err) {
    next(err);
  }
});

router.post('/profile', requireAuth, async (req, res, next) => {
  try {
    const profile = _.merge(await loadProfile(req.user.id), req.body);
    await db.query('UPDATE users SET full_name = $1, email = $2, role = $3 WHERE id = $4', [
      profile.full_name,
      profile.email,
      profile.role,
      profile.id
    ]);
    res.render('profile', { profile, message: 'Perfil actualizado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
