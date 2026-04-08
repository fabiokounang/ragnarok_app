'use strict';

const { getPool } = require('../config/database');
const { parseLongform } = require('../config/grimoire/parseLongform');

/** @param {string} str */
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/** @typedef {{ heading: string, paragraphs: string[] }} GrimoireSection */

/**
 * @typedef {object} GrimoireCache
 * @property {Array<{ id: string, title: string, deck: string, sort_order: number }>} categoryList
 * @property {Record<string, { id: string, title: string, deck: string, sort_order: number }>} categoryById
 * @property {Map<string, { slug: string, categoryId: string, title: string, deck: string, sections: GrimoireSection[], sortOrder: number }>} articlesBySlug
 * @property {Map<string, string>} aliasMap
 * @property {Map<string, string[]>} poolMap
 * @property {string[]} allSlugs
 */

/** @type {GrimoireCache | null} */
let cache = null;
/** @type {Promise<GrimoireCache> | null} */
let cacheLoadPromise = null;

async function loadCacheFromDb() {
  const pool = getPool();
  const [cats] = await pool.execute(
    `SELECT id, title, deck, sort_order FROM grimoire_categories ORDER BY sort_order ASC, id ASC`
  );
  const [arts] = await pool.execute(
    `SELECT slug, category_id, title, deck, body, sort_order FROM grimoire_articles ORDER BY category_id ASC, sort_order ASC, slug ASC`
  );
  const [aliases] = await pool.execute(`SELECT from_slug, to_slug FROM grimoire_slug_aliases`);
  const [pools] = await pool.execute(
    `SELECT pool_key, position_idx, article_slug FROM grimoire_pool_entries ORDER BY pool_key ASC, position_idx ASC`
  );

  /** @type {Record<string, { id: string, title: string, deck: string, sort_order: number }>} */
  const categoryById = Object.fromEntries(
    cats.map((c) => [c.id, { id: c.id, title: c.title, deck: c.deck, sort_order: Number(c.sort_order) }])
  );

  /** @type {Map<string, { slug: string, categoryId: string, title: string, deck: string, sections: GrimoireSection[], sortOrder: number }>} */
  const articlesBySlug = new Map();
  for (const r of arts) {
    const sections = parseLongform(r.body);
    articlesBySlug.set(r.slug, {
      slug: r.slug,
      categoryId: r.category_id,
      title: r.title,
      deck: r.deck,
      sections,
      sortOrder: Number(r.sort_order) || 0,
    });
  }

  const aliasMap = new Map(aliases.map((a) => [a.from_slug, a.to_slug]));

  /** @type {Map<string, string[]>} */
  const poolMap = new Map();
  for (const row of pools) {
    const k = row.pool_key;
    if (!poolMap.has(k)) poolMap.set(k, []);
    poolMap.get(k).push(row.article_slug);
  }

  const defaultPool = poolMap.get('default');
  if (!defaultPool || defaultPool.length === 0) {
    throw new Error('[grimoire] Database Grimoire has no default pool — run npm run db:seed-grimoire');
  }

  return {
    categoryList: cats.map((c) => ({
      id: c.id,
      title: c.title,
      deck: c.deck,
      sort_order: Number(c.sort_order),
    })),
    categoryById,
    articlesBySlug,
    aliasMap,
    poolMap,
    allSlugs: arts.map((a) => a.slug),
  };
}

async function ensureCache() {
  if (cache) return cache;
  if (!cacheLoadPromise) {
    cacheLoadPromise = loadCacheFromDb()
      .then((c) => {
        cache = c;
        return c;
      })
      .catch((e) => {
        cacheLoadPromise = null;
        throw e;
      });
  }
  return cacheLoadPromise;
}

function invalidateGrimoireCache() {
  cache = null;
  cacheLoadPromise = null;
}

async function warmCache() {
  await ensureCache();
}

/**
 * @param {GrimoireCache} c
 * @param {string} slug
 */
function normalizeArticleSlugSync(c, slug) {
  let k = String(slug || '').trim();
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(k)) return null;
  let guard = 0;
  while (c.aliasMap.has(k) && guard < 8) {
    k = c.aliasMap.get(k);
    guard += 1;
  }
  return c.articlesBySlug.has(k) ? k : null;
}

/**
 * @param {GrimoireCache} c
 * @param {string} articleSlug
 * @param {Record<string, unknown>} [extra]
 */
function withCategoryTitle(c, articleSlug, extra = {}) {
  const base = c.articlesBySlug.get(articleSlug);
  if (!base) throw new Error(`[grimoire] Missing article: ${articleSlug}`);
  const cat = c.categoryById[base.categoryId];
  return {
    categoryId: base.categoryId,
    title: base.title,
    deck: base.deck,
    sections: base.sections,
    slug: articleSlug,
    categoryTitle: cat ? cat.title : base.categoryId,
    ...extra,
  };
}

/**
 * @param {string} slug
 */
async function normalizeArticleSlug(slug) {
  const c = await ensureCache();
  return normalizeArticleSlugSync(c, slug);
}

/**
 * @param {string} slug from URL (task slug or "default")
 * @param {{ dateStr?: string }} [options]
 */
async function getGrimoireArticle(slug, options = {}) {
  const c = await ensureCache();
  const dateStr = options.dateStr || new Date().toISOString().slice(0, 10);
  const s = String(slug || 'default').trim() || 'default';
  const poolName = c.poolMap.has(s) ? s : 'default';
  const pool = c.poolMap.get(poolName);
  if (!pool || pool.length === 0) {
    const fallback = c.poolMap.get('default');
    if (!fallback || fallback.length === 0) {
      throw new Error('[grimoire] Empty pool');
    }
    const idx = djb2(`default|${dateStr}`) % fallback.length;
    return withCategoryTitle(c, fallback[idx], {
      grimoireDateStr: dateStr,
      grimoirePool: 'default',
      grimoireDailyPick: true,
    });
  }
  const idx = djb2(`${poolName}|${dateStr}`) % pool.length;
  const articleSlug = pool[idx];
  return withCategoryTitle(c, articleSlug, {
    grimoireDateStr: dateStr,
    grimoirePool: poolName,
    grimoireDailyPick: true,
  });
}

/**
 * @param {string} rawSlug
 */
async function getArticleBySlug(rawSlug) {
  const c = await ensureCache();
  const normalized = normalizeArticleSlugSync(c, rawSlug);
  if (!normalized) return null;
  return withCategoryTitle(c, normalized);
}

async function listCategories() {
  const c = await ensureCache();
  const counts = new Map();
  for (const slug of c.articlesBySlug.keys()) {
    const a = c.articlesBySlug.get(slug);
    if (!a) continue;
    counts.set(a.categoryId, (counts.get(a.categoryId) || 0) + 1);
  }
  return c.categoryList.map((cat) => ({
    id: cat.id,
    title: cat.title,
    deck: cat.deck,
    articleCount: counts.get(cat.id) || 0,
  }));
}

/**
 * @param {string} categoryId
 */
async function listArticlesInCategory(categoryId) {
  const c = await ensureCache();
  const id = String(categoryId || '').trim();
  if (!/^[a-z]{2,24}$/.test(id)) return null;
  const cat = c.categoryById[id];
  if (!cat) return null;
  const articles = [];
  for (const a of c.articlesBySlug.values()) {
    if (a.categoryId === id) {
      articles.push({ slug: a.slug, title: a.title, deck: a.deck, sortOrder: a.sortOrder });
    }
  }
  articles.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  const order = articles.map((x) => x.slug);
  const slim = articles.map(({ slug, title, deck }) => ({ slug, title, deck }));
  return {
    category: { id: cat.id, title: cat.title, deck: cat.deck, articleSlugs: order },
    articles: slim,
  };
}

/**
 * @param {string} categoryId
 */
async function getCategoryMeta(categoryId) {
  const c = await ensureCache();
  return c.categoryById[String(categoryId).trim()] || null;
}

async function getGrimoireArticleSlugs() {
  const c = await ensureCache();
  return [...c.allSlugs];
}

async function getGrimoireCategoryIds() {
  const c = await ensureCache();
  return c.categoryList.map((x) => x.id);
}

/**
 * @param {string} rawQuery
 * @param {number} [limit]
 */
async function searchArticles(rawQuery, limit = 24) {
  const c = await ensureCache();
  const q = String(rawQuery || '')
    .trim()
    .toLowerCase();
  if (q.length < 2) return [];
  const lim = Math.max(1, Math.min(40, Math.floor(Number(limit) || 24)));
  /** @type {Array<{ slug: string, title: string, deck: string, categoryId: string, categoryTitle: string }>} */
  const out = [];
  for (const art of c.articlesBySlug.values()) {
    const t = (art.title || '').toLowerCase();
    const d = (art.deck || '').toLowerCase();
    if (t.includes(q) || d.includes(q)) {
      const cat = c.categoryById[art.categoryId];
      out.push({
        slug: art.slug,
        title: art.title,
        deck: art.deck,
        categoryId: art.categoryId,
        categoryTitle: cat ? cat.title : art.categoryId,
      });
    }
  }
  out.sort((a, b) => a.title.localeCompare(b.title) || a.slug.localeCompare(b.slug));
  return out.slice(0, lim);
}

/**
 * @param {number} userId
 * @param {string} articleSlug
 */
async function recordUserArticleRead(userId, articleSlug) {
  const norm = await normalizeArticleSlug(articleSlug);
  if (!norm) return;
  const pool = getPool();
  try {
    await pool.execute(
      `INSERT INTO user_grimoire_reads (user_id, article_slug, last_read_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
      [userId, norm]
    );
  } catch (e) {
    if (e.errno === 1146 || e.code === 'ER_NO_SUCH_TABLE') return;
    throw e;
  }
}

/**
 * @param {number} userId
 * @param {number} [limit]
 */
async function listRecentReadsForUser(userId, limit = 8) {
  const pool = getPool();
  const lim = Math.max(1, Math.min(20, Math.floor(Number(limit) || 8)));
  let rows = [];
  try {
    const [r] = await pool.execute(
      `SELECT article_slug, last_read_at FROM user_grimoire_reads WHERE user_id = ? ORDER BY last_read_at DESC LIMIT ${lim}`,
      [userId]
    );
    rows = r;
  } catch (e) {
    if (e.errno === 1146 || e.code === 'ER_NO_SUCH_TABLE') return [];
    throw e;
  }
  const c = await ensureCache();
  return rows
    .map((row) => {
      const slug = String(row.article_slug);
      const art = c.articlesBySlug.get(slug);
      if (!art) return null;
      const cat = c.categoryById[art.categoryId];
      return {
        slug,
        title: art.title,
        categoryId: art.categoryId,
        categoryTitle: cat ? cat.title : art.categoryId,
        lastReadAt: row.last_read_at,
      };
    })
    .filter(Boolean);
}

module.exports = {
  getGrimoireArticle,
  getArticleBySlug,
  normalizeArticleSlug,
  listCategories,
  listArticlesInCategory,
  getCategoryMeta,
  warmCache,
  invalidateGrimoireCache,
  getGrimoireArticleSlugs,
  getGrimoireCategoryIds,
  searchArticles,
  recordUserArticleRead,
  listRecentReadsForUser,
};
