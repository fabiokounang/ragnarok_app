/**
 * Mitigates CSRF for cookie-backed POSTs: require Origin or Referer host to match Host.
 * SameSite=Lax on the session cookie is the first line of defense; this adds a check in production.
 *
 * - Enforced only when NODE_ENV === 'production' (or FORCE_SAME_ORIGIN_POST=1 for local prod tests).
 * - Development (npm run dev) skips this so localhost / varying headers do not block forms.
 * - ALLOW_MISSING_POST_ORIGIN=1 skips the check (e.g. Postman) — never use in production.
 * - localhost, 127.0.0.1, and ::1 are treated as the same host when comparing.
 */

function normalizeLoopbackHost(host) {
  if (!host) return '';
  const h = String(host).toLowerCase();
  const withPort = /^\[::1\]:(\d+)$/.exec(h);
  if (withPort) return `localhost:${withPort[1]}`;
  if (h === '[::1]' || h === '::1') return 'localhost';
  const v4 = /^127\.0\.0\.1(:(\d+))?$/.exec(h);
  if (v4) return v4[2] ? `localhost:${v4[2]}` : 'localhost';
  return h;
}

function hostMatchesRequest(hostHeader, urlString) {
  if (!hostHeader || !urlString) return false;
  try {
    const u = new URL(urlString);
    return normalizeLoopbackHost(hostHeader) === normalizeLoopbackHost(u.host);
  } catch {
    return false;
  }
}

function sameOriginPost(req, res, next) {
  if (req.method !== 'POST') {
    return next();
  }
  if (process.env.ALLOW_MISSING_POST_ORIGIN === '1') {
    return next();
  }

  const enforce =
    process.env.NODE_ENV === 'production' || process.env.FORCE_SAME_ORIGIN_POST === '1';
  if (!enforce) {
    return next();
  }

  const host = req.get('host');
  if (!host) {
    return res.status(403).type('text/plain').send('Forbidden');
  }

  const origin = req.get('origin');
  if (origin && hostMatchesRequest(host, origin)) {
    return next();
  }

  const referer = req.get('referer');
  if (referer && hostMatchesRequest(host, referer)) {
    return next();
  }

  return res.status(403).type('text/plain').send('Forbidden');
}

module.exports = { sameOriginPost };
