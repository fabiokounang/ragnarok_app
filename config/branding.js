/**
 * Product display name for page titles, auth shell, and similar UI copy.
 * Change here when rebranding.
 */
const APP_DISPLAY_NAME = 'REBORN';

/**
 * @param {string} [segment] e.g. "Login", "Quests"
 * @returns {string} e.g. "Login — REBORN"
 */
function appPageTitle(segment) {
  const s = segment == null ? '' : String(segment).trim();
  if (!s) return APP_DISPLAY_NAME;
  return `${s} — ${APP_DISPLAY_NAME}`;
}

module.exports = { APP_DISPLAY_NAME, appPageTitle };
