const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const { STARTING_JOB_ID } = require('../config/constants');
const { defaultPathAfterAuth } = require('../config/onboardingGate');
const {
  normalizeEmail,
  normalizeUsername,
  sanitizeDisplayName,
  isValidEmailShape,
  isValidUsername,
  isPasswordLengthOk,
  MAX_DISPLAY_NAME_LEN,
  MAX_USERNAME_LEN,
  MIN_USERNAME_LEN,
  MAX_PASSWORD_LEN,
} = require('../config/security');
const { appPageTitle } = require('../config/branding');

async function getLogin(req, res, next) {
  if (req.session.userId) {
    try {
      const row = await userModel.findWithJobById(req.session.userId);
      if (!row) {
        return res.redirect('/login');
      }
      return res.redirect(defaultPathAfterAuth(row.currentJobId, row.totalExp));
    } catch (err) {
      return next(err);
    }
  }
  const registered = req.query.registered === '1';
  return res.render('pages/login', {
    title: appPageTitle('Login'),
    layout: 'layouts/auth',
    authVariant: 'login',
    errors: [],
    form: { login: '' },
    registered,
  });
}

async function postLogin(req, res, next) {
  const rawLogin = String(req.body.login || '');
  const login = rawLogin.includes('@') ? normalizeEmail(rawLogin) : normalizeUsername(rawLogin);
  const password = String(req.body.password || '');
  const errors = [];

  if (!login) errors.push('Username or email is required.');
  else if (rawLogin.includes('@') && !isValidEmailShape(login)) errors.push('Enter a valid email.');
  if (!password) errors.push('Password is required.');

  if (errors.length) {
    return res.render('pages/login', {
      title: appPageTitle('Login'),
      layout: 'layouts/auth',
      authVariant: 'login',
      errors,
      form: { login: rawLogin || '' },
      registered: false,
    });
  }

  if (password.length > MAX_PASSWORD_LEN) {
    return res.render('pages/login', {
      title: appPageTitle('Login'),
      layout: 'layouts/auth',
      authVariant: 'login',
      errors: ['Invalid email or password.'],
      form: { login: rawLogin },
      registered: false,
    });
  }

  try {
    const user = await userModel.findByLogin(login);
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) {
      errors.push('Invalid username/email or password.');
      return res.render('pages/login', {
        title: appPageTitle('Login'),
        layout: 'layouts/auth',
        authVariant: 'login',
        errors,
        form: { login: rawLogin },
        registered: false,
      });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.userId = user.id;
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.redirect(defaultPathAfterAuth(user.currentJobId, user.totalExp));
  } catch (err) {
    return next(err);
  }
}

async function getRegister(req, res, next) {
  if (req.session.userId) {
    try {
      const row = await userModel.findWithJobById(req.session.userId);
      if (!row) {
        return res.redirect('/login');
      }
      return res.redirect(defaultPathAfterAuth(row.currentJobId, row.totalExp));
    } catch (err) {
      return next(err);
    }
  }
  return res.render('pages/register', {
    title: appPageTitle('Register'),
    layout: 'layouts/auth',
    authVariant: 'register',
    errors: [],
    form: { displayName: '', username: '', email: '' },
  });
}

async function postRegister(req, res, next) {
  const displayName = sanitizeDisplayName(req.body.displayName);
  const username = normalizeUsername(req.body.username);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  const errors = [];

  if (!displayName) errors.push('Display name is required.');
  if (displayName.length > MAX_DISPLAY_NAME_LEN) errors.push('Display name is too long.');
  if (!username) errors.push('Username is required.');
  else if (!isValidUsername(username)) {
    errors.push(
      `Username must be ${MIN_USERNAME_LEN}-${MAX_USERNAME_LEN} chars and use only lowercase letters, numbers, or underscore.`
    );
  }
  if (!email) errors.push('Email is required.');
  else if (!isValidEmailShape(email)) errors.push('Enter a valid email.');
  if (!isPasswordLengthOk(password)) {
    if (password.length < 8) errors.push('Password must be at least 8 characters.');
    else errors.push(`Password must be at most ${MAX_PASSWORD_LEN} characters.`);
  }
  if (password !== confirmPassword) errors.push('Passwords do not match.');

  if (errors.length) {
    return res.render('pages/register', {
      title: appPageTitle('Register'),
      layout: 'layouts/auth',
      authVariant: 'register',
      errors,
      form: { displayName, username, email },
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await userModel.createUser({
      email,
      username,
      passwordHash,
      displayName,
      currentJobId: STARTING_JOB_ID,
    });
    return res.redirect('/login?registered=1');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return res.render('pages/register', {
        title: appPageTitle('Register'),
        layout: 'layouts/auth',
        authVariant: 'register',
        errors: ['That email or username is already registered.'],
        form: { displayName, username, email },
      });
    }
    return next(err);
  }
}

function postLogout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('reborn.sid', { path: '/' });
    res.redirect('/login');
  });
}

module.exports = {
  getLogin,
  postLogin,
  getRegister,
  postRegister,
  postLogout,
};
