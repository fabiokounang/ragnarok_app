/**
 * Optional hero image URL per task type (quest cards).
 * Usage: npm run db:migrate-task-hero-image
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

function ignorableDup(err) {
  return err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME');
}

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
      ALTER TABLE task_types
      ADD COLUMN hero_image_url VARCHAR(512) NULL COMMENT 'Quest card hero URL or /images/... path'
      AFTER weekly_target_steps
    `);
    console.log('[migrate-016] task_types.hero_image_url OK');
  } catch (e) {
    if (ignorableDup(e)) {
      console.log('[migrate-016] task_types.hero_image_url already exists');
    } else {
      throw e;
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
