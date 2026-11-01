// Verificación de salud para HEALTHCHECK (la imagen distroless no tiene curl ni shell)
const http = require('http');

const req = http.get(
  { host: '127.0.0.1', port: Number(process.env.PORT || 3000), path: '/api/health', timeout: 3000 },
  (res) => process.exit(res.statusCode === 200 ? 0 : 1)
);
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});
req.on('error', () => process.exit(1));
