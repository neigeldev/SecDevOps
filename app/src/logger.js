// V12: registro estructurado (JSON por línea) apto para CloudWatch Logs.
// Nunca se registran contraseñas, tokens ni cookies: se filtran por nombre de campo.
const SENSITIVE = /pass|secret|token|cookie|authorization|csrf/i;

function sanitize(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (SENSITIVE.test(k)) continue;
    out[k] = typeof v === 'string' ? v.replace(/[\r\n]/g, ' ').slice(0, 300) : v;
  }
  return out;
}

function write(level, event, fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...sanitize(fields) });
  if (level === 'error') console.error(line);
  else console.log(line);
}

module.exports = {
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields),
  // Evento de seguridad: lo consumen los filtros de métricas y alarmas de CloudWatch
  security: (event, req, fields) =>
    write('warn', event, { ip: req.ip, path: req.path, userId: req.user ? req.user.id : undefined, ...fields })
};
