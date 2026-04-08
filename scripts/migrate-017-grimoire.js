/**
 * Grimoire library in MySQL (categories, articles, daily pools, legacy URL aliases).
 * Usage: npm run db:migrate-grimoire
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'reborn';

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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS grimoire_categories (
        id VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL,
        deck TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_grimoire_cat_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS grimoire_articles (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(64) NOT NULL,
        category_id VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL,
        deck TEXT NOT NULL,
        body MEDIUMTEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_grimoire_articles_slug (slug),
        KEY idx_grimoire_art_cat (category_id, sort_order),
        CONSTRAINT fk_grimoire_art_cat FOREIGN KEY (category_id) REFERENCES grimoire_categories (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS grimoire_slug_aliases (
        from_slug VARCHAR(64) NOT NULL,
        to_slug VARCHAR(64) NOT NULL,
        PRIMARY KEY (from_slug),
        KEY idx_grimoire_alias_to (to_slug),
        CONSTRAINT fk_grimoire_alias_article FOREIGN KEY (to_slug) REFERENCES grimoire_articles (slug) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS grimoire_pool_entries (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        pool_key VARCHAR(64) NOT NULL,
        position_idx SMALLINT UNSIGNED NOT NULL,
        article_slug VARCHAR(64) NOT NULL,
        UNIQUE KEY uq_grimoire_pool_pos (pool_key, position_idx),
        KEY idx_grimoire_pool_key (pool_key),
        CONSTRAINT fk_grimoire_pool_article FOREIGN KEY (article_slug) REFERENCES grimoire_articles (slug) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('[migrate-017] grimoire_* tables OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
