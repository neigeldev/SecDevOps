// Configuración de la aplicación
module.exports = {
  port: process.env.PORT || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'securenotes'
  },
  jwtSecret: 'secret123'
};
