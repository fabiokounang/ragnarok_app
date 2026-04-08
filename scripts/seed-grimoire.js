/**
 * Load longform .txt + manifest into grimoire_* tables (requires migrate-017).
 * Idempotent: replaces all Grimoire rows each run.
 * Usage: npm run db:seed-grimoire
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { parseLongform } = require('../config/grimoire/parseLongform');
const { CATEGORIES, LEGACY_ALIASES, buildPools } = require('../config/grimoirePoolSeed');

const LONGFORM_DIR = path.join(__dirname, '..', 'config', 'grimoire', 'longform');
const MANIFEST_PATH = path.join(LONGFORM_DIR, 'manifest.json');
const MIN_WORDS = Number(process.env.GRIMOIRE_MIN_WORDS || 1000);

function wc(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function wordCountArticle(sections) {
  let n = 0;
  for (const s of sections) {
    n += wc(s.heading);
    for (const p of s.paragraphs) {
      n += wc(p);
    }
  }
  return n;
}

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'reborn';

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  /** @type {Map<string, object>} */
  const manifestBySlug = new Map(manifest.map((m) => [m.slug, m]));

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4',
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    const allSlugsInBrowseOrder = [];
    const articleRows = [];

    for (let ci = 0; ci < CATEGORIES.length; ci += 1) {
      const cat = CATEGORIES[ci];
      for (let si = 0; si < cat.articleSlugs.length; si += 1) {
        const slug = cat.articleSlugs[si];
        allSlugsInBrowseOrder.push(slug);
        const m = manifestBySlug.get(slug);
        if (!m) {
          throw new Error(`[seed-grimoire] Manifest missing slug: ${slug}`);
        }
        if (m.categoryId !== cat.id) {
          throw new Error(`[seed-grimoire] categoryId mismatch for ${slug}`);
        }
        const fp = path.join(LONGFORM_DIR, m.file);
        if (!fs.existsSync(fp)) {
          throw new Error(`[seed-grimoire] Missing file: ${m.file}`);
        }
        const txt = fs.readFileSync(fp, 'utf8');
        const sections = parseLongform(txt);
        if (!sections.length) {
          throw new Error(`[seed-grimoire] No sections for ${slug}`);
        }
        const w = wordCountArticle(sections);
        if (w < MIN_WORDS) {
          throw new Error(`[seed-grimoire] ${slug} has ${w} words; minimum ${MIN_WORDS}`);
        }
        articleRows.push({
          slug,
          category_id: cat.id,
          title: m.title,
          deck: m.deck,
          body: txt,
          sort_order: si,
        });
      }
    }

    const pools = buildPools(allSlugsInBrowseOrder);

    await conn.beginTransaction();
    await conn.query('DELETE FROM grimoire_pool_entries');
    await conn.query('DELETE FROM grimoire_slug_aliases');
    await conn.query('DELETE FROM grimoire_articles');
    await conn.query('DELETE FROM grimoire_categories');

    for (let i = 0; i < CATEGORIES.length; i += 1) {
      const c = CATEGORIES[i];
      await conn.execute(
        `INSERT INTO grimoire_categories (id, title, deck, sort_order) VALUES (?, ?, ?, ?)`,
        [c.id, c.title, c.deck, i]
      );
    }

    for (const row of articleRows) {
      await conn.execute(
        `INSERT INTO grimoire_articles (slug, category_id, title, deck, body, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.slug, row.category_id, row.title, row.deck, row.body, row.sort_order]
      );
    }

    for (const [fromS, toS] of Object.entries(LEGACY_ALIASES)) {
      await conn.execute(`INSERT INTO grimoire_slug_aliases (from_slug, to_slug) VALUES (?, ?)`, [fromS, toS]);
    }

    for (const [poolKey, slugs] of Object.entries(pools)) {
      for (let i = 0; i < slugs.length; i += 1) {
        await conn.execute(
          `INSERT INTO grimoire_pool_entries (pool_key, position_idx, article_slug) VALUES (?, ?, ?)`,
          [poolKey, i, slugs[i]]
        );
      }
    }

    await conn.commit();
    console.log(
      `[seed-grimoire] OK: ${CATEGORIES.length} categories, ${articleRows.length} articles, ${Object.keys(LEGACY_ALIASES).length} aliases, ${Object.keys(pools).length} pools`
    );
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
