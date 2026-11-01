const fs = require('fs');

// V06: ningún secreto vive en el código. Cada secreto se lee de una variable de
// entorno o, preferiblemente, de un archivo montado (Docker secrets, SSM -> tmpfs).
function readSecret(name, { required = true } = {}) {
  const file = process.env[`${name}_FILE`];
  if (file) return fs.readFileSync(file, 'utf8').trim();
  if (process.env[name]) return process.env[name];
  if (required) throw new Error(`Falta el secreto requerido ${name} (o ${name}_FILE)`);
  return undefined;
}

function bool(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const jwtSecret = readSecret('JWT_SECRET');
if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 bytes (256 bits)');
}

const dbSsl = bool(process.env.DB_SSL, false);

module.exports = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  // Número de proxies de confianza delante de la app (Caddy, CloudFront)
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  // Las cookies solo viajan por HTTPS salvo que se desactive explícitamente
  cookieSecure: bool(process.env.COOKIE_SECURE, true),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'securenotes',
    password: readSecret('DB_PASSWORD'),
    database: process.env.DB_NAME || 'securenotes',
    max: 10,
    // Cifrado en tránsito hacia la base de datos (RDS exige TLS con rds.force_ssl=1)
    ssl: dbSsl
      ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA ? fs.readFileSync(process.env.DB_SSL_CA, 'utf8') : undefined }
      : false
  },
  jwt: {
    secret: jwtSecret,
    issuer: 'securenotes',
    audience: 'securenotes-web',
    ttlSeconds: Number(process.env.JWT_TTL_SECONDS || 3600)
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: readSecret('ADMIN_PASSWORD', { required: false })
  },
  seedDemo: bool(process.env.SEED_DEMO, false),
  // Secreto compartido con CloudFront para rechazar tráfico que no pase por la CDN
  originVerifySecret: readSecret('ORIGIN_VERIFY_SECRET', { required: false })
});
