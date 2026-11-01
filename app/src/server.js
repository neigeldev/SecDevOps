const app = require('./app');
const db = require('./db');
const config = require('./config');

db.init()
  .then(() => {
    app.listen(config.port, () => console.log(`SecureNotes escuchando en el puerto ${config.port}`));
  })
  .catch((err) => {
    console.error('No se pudo iniciar la aplicación', err);
    process.exit(1);
  });
