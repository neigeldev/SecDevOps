const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Búsqueda de notas públicas
router.get('/explore', async (req, res, next) => {
  const q = req.query.q || '';
  try {
    const sql =
      'SELECT n.id, n.title, n.body, u.username FROM notes n JOIN users u ON u.id = n.owner_id ' +
      "WHERE n.is_public = true AND n.title ILIKE '%" +
      q +
      "%' ORDER BY n.id DESC";
    const result = await db.query(sql);
    res.render('explore', { q, notes: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/notes', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, title, is_public, created_at FROM notes WHERE owner_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    res.render('notes', { notes: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/notes', requireAuth, async (req, res, next) => {
  const { title, body } = req.body;
  try {
    await db.query('INSERT INTO notes (owner_id, title, body, is_public) VALUES ($1, $2, $3, $4)', [
      req.user.id,
      title,
      body,
      req.body.is_public === 'on'
    ]);
    res.redirect('/notes');
  } catch (err) {
    next(err);
  }
});

router.get('/notes/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT n.*, u.username FROM notes n JOIN users u ON u.id = n.owner_id WHERE n.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'Nota no encontrada' });
    }
    res.render('note', { note: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/notes/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.redirect('/notes');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
