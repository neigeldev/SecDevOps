const jwt = require('jsonwebtoken');
const config = require('../config');

function sign(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, config.jwtSecret);
}

function verify(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { sign, verify };
