/**
 * Central input limits and light sanitization (defense in depth with parameterized SQL + EJS escaping).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;
const MAX_DISPLAY_NAME_LEN = 80;
const MAX_USERNAME_LEN = 32;
const MIN_USERNAME_LEN = 3;
const USERNAME_RE = /^[a-z0-9_]+$/;

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeEmail(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .slice(0, MAX_EMAIL_LEN);
}

/**
 * Strip control chars; trim; cap length (matches DB VARCHAR(80)).
 * @param {unknown} raw
 * @returns {string}
 */
function sanitizeDisplayName(raw) {
  let s = String(raw ?? '')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LEN);
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  return s;
}

/**
 * Lowercase + trim + keep allowed chars [a-z0-9_], cap length.
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeUsername(raw) {
  const base = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, MAX_USERNAME_LEN);
  return base;
}

/**
 * @param {string} username normalized
 */
function isValidUsername(username) {
  if (!username) return false;
  if (username.length < MIN_USERNAME_LEN || username.length > MAX_USERNAME_LEN) return false;
  return USERNAME_RE.test(username);
}

/**
 * @param {string} email normalized
 */
function isValidEmailShape(email) {
  if (!email || email.length > MAX_EMAIL_LEN) return false;
  return EMAIL_RE.test(email);
}

/**
 * Long passwords are a cheap DoS vector for bcrypt; cap length.
 * @param {string} password
 */
function isPasswordLengthOk(password) {
  const len = password.length;
  return len >= 8 && len <= MAX_PASSWORD_LEN;
}

/** Typical MySQL signed INT PK range */
const MAX_DB_INT_ID = 2147483647;

/**
 * @param {unknown} raw from req.body / query
 * @returns {number | null}
 */
function parsePositiveIntId(raw) {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DB_INT_ID) return null;
  return n;
}

function assertProductionSessionSecret() {
  if (process.env.NODE_ENV !== 'production') return;
  const s = process.env.SESSION_SECRET;
  const weak = !s || s.length < 32 || s === 'dev-only-change-SESSION_SECRET-in-env';
  if (weak) {
    console.error(
      '[security] Production requires SESSION_SECRET (min 32 random chars) in environment.'
    );
    process.exit(1);
  }
}

module.exports = {
  EMAIL_RE,
  MAX_EMAIL_LEN,
  MAX_PASSWORD_LEN,
  MAX_DISPLAY_NAME_LEN,
  MAX_USERNAME_LEN,
  MIN_USERNAME_LEN,
  MAX_DB_INT_ID,
  USERNAME_RE,
  normalizeEmail,
  normalizeUsername,
  sanitizeDisplayName,
  isValidEmailShape,
  isValidUsername,
  isPasswordLengthOk,
  parsePositiveIntId,
  assertProductionSessionSecret,
};
