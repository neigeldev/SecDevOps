const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

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

// V09: lista blanca de campos editables. El rol y el id nunca se toman del
// cliente y la actualización siempre aplica sobre el usuario autenticado.
router.post('/profile', requireAuth, async (req, res, next) => {
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim().slice(0, 100) : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().slice(0, 120) : '';
  try {
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).render('profile', { profile: await loadProfile(req.user.id), message: 'Correo no válido' });
    }
    await db.query('UPDATE users SET full_name = $1, email = $2 WHERE id = $3', [fullName, email, req.user.id]);
    res.render('profile', { profile: await loadProfile(req.user.id), message: 'Perfil actualizado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
