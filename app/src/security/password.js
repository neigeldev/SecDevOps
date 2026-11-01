const crypto = require('crypto');

// Calcula el hash de la contraseña
function hash(plain) {
  return crypto.createHash('md5').update(plain).digest('hex');
}

function verify(plain, stored) {
  return hash(plain) === stored;
}

module.exports = { hash, verify };
