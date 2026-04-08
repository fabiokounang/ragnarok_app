/**
 * Track last-read Grimoire articles per user (library search + continue reading).
 * Usage: npm run db:migrate-grimoire-reads
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
      CREATE TABLE IF NOT EXISTS user_grimoire_reads (
        user_id INT UNSIGNED NOT NULL,
        article_slug VARCHAR(64) NOT NULL,
        last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, article_slug),
        KEY idx_ugr_user_time (user_id, last_read_at),
        CONSTRAINT fk_ugr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_ugr_article FOREIGN KEY (article_slug) REFERENCES grimoire_articles (slug) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[migrate-018] user_grimoire_reads OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
