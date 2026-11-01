// Pruebas unitarias de los controles de seguridad (sin base de datos).
// Ejecutar con: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64');
process.env.DB_PASSWORD = 'solo-para-pruebas';
process.env.COOKIE_SECURE = 'true';

const jwt = require('jsonwebtoken');
const password = require('../src/security/password');
const tokens = require('../src/security/tokens');
const config = require('../src/config');

test('scrypt: el hash usa sal aleatoria y verifica correctamente', async () => {
  const a = await password.hash('Una-Clave-Larga-2026');
  const b = await password.hash('Una-Clave-Larga-2026');
  assert.match(a, /^scrypt\$65536\$8\$2\$/);
  assert.notEqual(a, b, 'dos hashes de la misma clave deben ser distintos (sal)');
  assert.equal(await password.verify('Una-Clave-Larga-2026', a), true);
  assert.equal(await password.verify('otra-clave', a), false);
});

test('scrypt: rechaza hashes heredados MD5', async () => {
  const md5 = crypto.createHash('md5').update('admin123').digest('hex');
  assert.equal(await password.verify('admin123', md5), false);
});

test('política de contraseñas: mínimo 12 caracteres', () => {
  assert.ok(password.validatePolicy('corta'));
  assert.equal(password.validatePolicy('suficientemente-larga'), null);
});

test('JWT: incluye expiración, emisor y audiencia', () => {
  const t = tokens.sign({ id: 7, username: 'ana', role: 'user' });
  const decoded = jwt.decode(t, { complete: true });
  assert.equal(decoded.header.alg, 'HS256');
  assert.ok(decoded.payload.exp > decoded.payload.iat);
  assert.equal(decoded.payload.iss, 'securenotes');
  assert.deepEqual(tokens.verify(t), { id: 7, username: 'ana', role: 'user' });
});

test('JWT: rechaza alg=none y firmas con otra clave', () => {
  const none = jwt.sign({ sub: '1', role: 'admin' }, null, { algorithm: 'none' });
  assert.throws(() => tokens.verify(none));
  const forged = jwt.sign({ sub: '1', role: 'admin' }, 'secret123', {
    issuer: 'securenotes',
    audience: 'securenotes-web'
  });
  assert.throws(() => tokens.verify(forged));
});

test('JWT: rechaza tokens expirados y de otra audiencia', () => {
  const expired = jwt.sign({ sub: '1' }, config.jwt.secret, {
    expiresIn: -10,
    issuer: 'securenotes',
    audience: 'securenotes-web'
  });
  assert.throws(() => tokens.verify(expired), /expired/);
  const otherAud = jwt.sign({ sub: '1' }, config.jwt.secret, { issuer: 'securenotes', audience: 'otra-app' });
  assert.throws(() => tokens.verify(otherAud), /audience/);
});

test('cookie de sesión usa el prefijo __Host- cuando hay HTTPS', () => {
  assert.equal(tokens.COOKIE_NAME, '__Host-session');
});

test('logger: nunca registra campos sensibles', () => {
  const logger = require('../src/logger');
  const lines = [];
  const original = console.log;
  console.log = (l) => lines.push(l);
  try {
    logger.info('prueba', { username: 'ana', password: 'x', token: 'y', csrfToken: 'z' });
  } finally {
    console.log = original;
  }
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.username, 'ana');
  assert.equal(entry.password, undefined);
  assert.equal(entry.token, undefined);
  assert.equal(entry.csrfToken, undefined);
});
