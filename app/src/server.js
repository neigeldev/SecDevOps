const app = require('./app');
const db = require('./db');
const config = require('./config');
const logger = require('./logger');

db.init()
  .then(() => {
    const server = app.listen(config.port, () => logger.info('server_started', { port: config.port, env: config.env }));
    // Cierre ordenado: Docker/systemd envían SIGTERM al detener el contenedor
    process.on('SIGTERM', () => {
      logger.info('server_stopping');
      server.close(() => db.pool.end().finally(() => process.exit(0)));
    });
  })
  .catch((err) => {
    logger.error('startup_failed', { message: err.message });
    process.exit(1);
  });
