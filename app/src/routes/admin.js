const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const r = await db.query(
      'SELECT id, username, full_name, email, role, password_hash, created_at FROM users ORDER BY id'
    );
    res.render('admin', { users: r.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
