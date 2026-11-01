const { Pool } = require('pg');
const config = require('./config');
const password = require('./security/password');

const pool = new Pool(config.db);

function query(text, params) {
  return pool.query(text, params);
}

async function waitForDb(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Esperando a la base de datos (${i}/${retries})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('La base de datos no respondió a tiempo');
}

async function init() {
  await waitForDb();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name VARCHAR(100),
      email VARCHAR(120),
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return;

  // Datos de demostración
  const users = [
    ['admin', 'admin123', 'Administrador', 'admin@securenotes.local', 'admin'],
    ['alice', 'alice123', 'Alice Rojas', 'alice@securenotes.local', 'user'],
    ['bob', 'bob123', 'Bob Pérez', 'bob@securenotes.local', 'user']
  ];
  for (const [u, p, name, email, role] of users) {
    await pool.query(
      'INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1, $2, $3, $4, $5)',
      [u, password.hash(p), name, email, role]
    );
  }
  await pool.query(
    `INSERT INTO notes (owner_id, title, body, is_public) VALUES
      (1, 'Bienvenida', 'Bienvenido a SecureNotes. Esta nota es pública.', true),
      (2, 'Lista de compras', 'Café, pan, leche.', true),
      (2, 'Privado: clave del banco', 'La clave de la tarjeta es 4321. ¡No compartir!', false),
      (3, 'Ideas del proyecto', 'Integrar DevSecOps en el pipeline.', false)`
  );
  console.log('Datos de demostración creados');
}

module.exports = { query, init, pool };
