/**
 * User-owned Train routines + session routine link.
 * Usage: npm run db:migrate-train-routines
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'reborn';

  const conn = await mysql.createConnection({ host, port, user, password, database, charset: 'utf8mb4' });
  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_train_routines (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        title VARCHAR(80) NOT NULL,
        blurb VARCHAR(180) NULL,
        sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        is_archived TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_utr_user_active (user_id, is_archived, sort_order),
        CONSTRAINT fk_utr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [colRows] = await conn.query(
      `SELECT column_name AS c
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'user_train_sessions'
         AND column_name = 'routine_id'`
    );
    if (!colRows.length) {
      await conn.query(`ALTER TABLE user_train_sessions ADD COLUMN routine_id BIGINT UNSIGNED NULL AFTER user_id`);
      await conn.query(
        `ALTER TABLE user_train_sessions
         ADD CONSTRAINT fk_uts_routine FOREIGN KEY (routine_id) REFERENCES user_train_routines (id) ON DELETE SET NULL`
      );
      await conn.query(`ALTER TABLE user_train_sessions ADD KEY idx_uts_routine (routine_id)`);
    }

    const [seedCountRows] = await conn.query(`SELECT COUNT(*) AS c FROM user_train_routines`);
    if ((Number(seedCountRows[0]?.c) || 0) === 0) {
      await conn.query(`
        INSERT INTO user_train_routines (user_id, title, blurb, sort_order, is_archived)
        SELECT id, 'Daily pushups', '2-3 sets, focus on clean reps.', 0, 0 FROM users
        UNION ALL
        SELECT id, 'Daily book reading', 'Read 20 minutes, capture one takeaway.', 1, 0 FROM users
        UNION ALL
        SELECT id, 'Language lesson', 'Practice vocab + one short exercise.', 2, 0 FROM users
        UNION ALL
        SELECT id, 'Stretch routine', '10-15 minutes full body mobility.', 3, 0 FROM users
      `);
    }

    console.log('[migrate-021] user_train_routines + routine_id link OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
