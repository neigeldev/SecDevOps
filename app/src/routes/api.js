const express = require('express');
const { exec } = require('child_process');

const router = express.Router();

router.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Diagnóstico de conectividad
router.get('/api/diag', (req, res) => {
  const host = req.query.host || '127.0.0.1';
  exec('ping -c 1 ' + host, (error, stdout, stderr) => {
    res.type('text/plain').send(stdout + stderr);
  });
});

module.exports = router;
