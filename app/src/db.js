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

  await seed();
}

// V06: sin credenciales en el código. El administrador inicial solo se crea si
// se entrega ADMIN_PASSWORD(_FILE) desde un gestor de secretos.
async function seed() {
  const { admin, seedDemo } = config;
  if (admin.password) {
    const policyError = password.validatePolicy(admin.password);
    if (policyError) throw new Error(`ADMIN_PASSWORD no cumple la política: ${policyError}`);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, 'Administrador', 'admin')
       ON CONFLICT (username) DO NOTHING RETURNING id`,
      [admin.username, await password.hash(admin.password)]
    );
    if (result.rowCount) console.log('Usuario administrador inicial creado');
  }
  if (seedDemo) {
    await pool.query(
      `INSERT INTO notes (owner_id, title, body, is_public)
       SELECT id, 'Bienvenida', 'Bienvenido a SecureNotes. Esta nota es pública.', true
       FROM users WHERE username = $1 AND NOT EXISTS (SELECT 1 FROM notes)`,
      [admin.username]
    );
  }
}

module.exports = { query, init, pool };
