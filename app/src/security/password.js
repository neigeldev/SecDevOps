const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// V05: derivación de clave con scrypt (memory-hard) y sal aleatoria por usuario.
// Parámetros según OWASP Password Storage Cheat Sheet: N=2^16, r=8, p=2 (~64 MiB).
const PARAMS = { N: 2 ** 16, r: 8, p: 2, maxmem: 160 * 1024 * 1024 };
const KEY_LENGTH = 32;
const SALT_BYTES = 16;

async function hash(plain) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(plain.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verify(plain, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(plain.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem
  });
  // Comparación en tiempo constante para no filtrar información por tiempos
  return crypto.timingSafeEqual(key, expected);
}

// Política mínima de contraseñas (NIST SP 800-63B / OWASP ASVS V2.1)
function validatePolicy(plain) {
  if (typeof plain !== 'string' || plain.length < 12) return 'La contraseña debe tener al menos 12 caracteres';
  if (plain.length > 128) return 'La contraseña no puede superar 128 caracteres';
  return null;
}

module.exports = { hash, verify, validatePolicy };
