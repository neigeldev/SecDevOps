const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { loadUser } = require('./middleware/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(loadUser);

app.get('/', (req, res) => res.render('index'));
app.use(require('./routes/auth'));
app.use(require('./routes/notes'));
app.use(require('./routes/profile'));
app.use(require('./routes/admin'));
app.use(require('./routes/api'));

app.use((req, res) => res.status(404).render('error', { message: 'Página no encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`<h1>Error interno</h1><pre>${err.stack}</pre>`);
});

module.exports = app;
