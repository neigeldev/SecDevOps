const express = require('express');
const dns = require('dns').promises;
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Nombre de host RFC 1123 o dirección IPv4: lista blanca estricta
const HOSTNAME_RE = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// V04: diagnóstico sin shell. Se resuelve el nombre con la API de DNS de Node
// (no se invoca ningún proceso) y solo lo puede usar un administrador.
router.get('/api/diag', requireAdmin, async (req, res) => {
  const host = typeof req.query.host === 'string' ? req.query.host : 'localhost';
  if (!HOSTNAME_RE.test(host)) {
    return res.status(400).json({ error: 'Nombre de host no válido' });
  }
  try {
    const addresses = await dns.lookup(host, { all: true });
    res.json({ host, reachable: true, addresses: addresses.map((a) => a.address) });
  } catch (err) {
    res.json({ host, reachable: false });
  }
});

module.exports = router;
