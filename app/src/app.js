const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const { loadUser } = require('./middleware/auth');
const { csrfProtection } = require('./security/csrf');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by'); // V10: no revelar la tecnología del servidor

// Defensa contra el acceso directo al origen: si la app está detrás de
// CloudFront, solo se aceptan peticiones que traen el encabezado secreto.
if (config.originVerifySecret) {
  const expected = crypto.createHash('sha256').update(config.originVerifySecret).digest();
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const got = crypto.createHash('sha256').update(String(req.get('x-origin-verify') || '')).digest();
    if (!crypto.timingSafeEqual(got, expected)) return res.status(403).send('Forbidden');
    next();
  });
}

// V10: encabezados de seguridad (CSP estricta sin inline, HSTS, anti-clickjacking...)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.cookieSecure ? [] : null
      }
    },
    strictTransportSecurity: config.cookieSecure ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' }
  })
);
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: '1h' }));

// Las páginas dinámicas no se almacenan en cachés intermedias
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(loadUser);
app.use(csrfProtection);

app.get('/', (req, res) => res.render('index'));
app.use(require('./routes/auth'));
app.use(require('./routes/notes'));
app.use(require('./routes/profile'));
app.use(require('./routes/admin'));
app.use(require('./routes/api'));

app.use((req, res) => res.status(404).render('error', { message: 'Página no encontrada' }));

// V11: manejo de errores sin filtrar detalles internos. El detalle queda en el
// log del servidor asociado a un identificador que se muestra al usuario.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  const errorId = crypto.randomUUID();
  console.error(JSON.stringify({ level: 'error', event: 'unhandled_error', errorId, status, message: err.message, stack: err.stack }));
  res.status(status);
  if (!res.locals.user) res.locals.user = null;
  if (!res.locals.csrfToken) res.locals.csrfToken = '';
  res.render('error', { message: status === 500 ? `Ocurrió un error inesperado. Código de referencia: ${errorId}` : 'Solicitud no válida' });
});

module.exports = app;
