/**
 * Quest card hero images: DB column task_types.hero_image_url wins, then slug map, then stat_tag art.
 * URLs: allow https?:// or site-relative paths starting with /.
 */

/** @type {Record<string, string>} Optional per-slug overrides (public paths or absolute URLs) */
const SLUG_MAP = {
  // Example: 'sn_wake_target': '/images/quest-heroes/custom/wake.webp',
};

/** @type {Record<string, string>} Fallback art by stat_tag (files under /public/images/quest-heroes/) */
const STAT_TAG_HERO = {
  strength: '/images/quest-heroes/stat-strength.svg',
  agility: '/images/quest-heroes/stat-agility.svg',
  vitality: '/images/quest-heroes/stat-vitality.svg',
  intelligence: '/images/quest-heroes/stat-intelligence.svg',
  discipline: '/images/quest-heroes/stat-discipline.svg',
  endurance: '/images/quest-heroes/stat-endurance.svg',
  precision: '/images/quest-heroes/stat-precision.svg',
  spirit: '/images/quest-heroes/stat-spirit.svg',
  balance: '/images/quest-heroes/stat-balance.svg',
};

const DEFAULT_HERO = '/images/quest-heroes/default.svg';

/**
 * @param {unknown} raw
 * @returns {string} normalized safe URL or ''
 */
function sanitizeHeroUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.href;
    } catch {
      return '';
    }
  }
  if (s.startsWith('/')) {
    if (/[\s'"<>\\]/.test(s)) return '';
    return s;
  }
  return '/' + s.replace(/^\/+/, '').replace(/[\s'"<>\\]/g, '');
}

/**
 * @param {unknown} dbUrl from task_types.hero_image_url
 * @param {string} slug
 * @param {string} statTag
 * @returns {string} usable URL or '' (use CSS gradient only)
 */
function resolveHeroImageUrl(dbUrl, slug, statTag) {
  const fromDb = sanitizeHeroUrl(dbUrl);
  if (fromDb) return fromDb;
  const sk = String(slug || '').trim();
  if (sk && Object.prototype.hasOwnProperty.call(SLUG_MAP, sk)) {
    const m = sanitizeHeroUrl(SLUG_MAP[sk]);
    if (m) return m;
  }
  const tag = String(statTag || '').toLowerCase().trim();
  if (tag && Object.prototype.hasOwnProperty.call(STAT_TAG_HERO, tag)) {
    return STAT_TAG_HERO[tag];
  }
  return DEFAULT_HERO;
}

/**
 * Escape for use inside double-quoted HTML attribute (background-image: url("...")).
 * @param {string} url
 */
function heroUrlForCssUrlValue(url) {
  const s = String(url || '');
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

module.exports = {
  resolveHeroImageUrl,
  sanitizeHeroUrl,
  heroUrlForCssUrlValue,
  SLUG_MAP,
  STAT_TAG_HERO,
  DEFAULT_HERO,
};
