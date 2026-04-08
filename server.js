require('dotenv').config();

const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const session = require('express-session');
const { assertProductionSessionSecret } = require('./config/security');
const { gameLocals } = require('./middleware/gameLocals');
const { sameOriginPost } = require('./middleware/sameOriginPost');
const { heroUrlForCssUrlValue } = require('./config/taskHeroImages');
const { APP_DISPLAY_NAME, appPageTitle } = require('./config/branding');

assertProductionSessionSecret();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '48kb',
  })
);

app.use(
  session({
    name: 'reborn.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-change-SESSION_SECRET-in-env',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use(sameOriginPost);

app.use((req, res, next) => {
  res.locals.appDisplayName = APP_DISPLAY_NAME;
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(gameLocals);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.heroUrlForCssUrlValue = heroUrlForCssUrlValue;
app.use(expressLayouts);
app.set('layout', 'layouts/app-shell');

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/index'));

app.use((req, res) => {
  res.status(404).render('pages/not-found', {
    title: appPageTitle('Not found'),
    layout: 'layouts/app-shell',
    navActive: null,
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  const { warmCache } = require('./models/grimoireModel');
  warmCache().catch((e) => console.error('[grimoire] warm cache:', e.message));
});
