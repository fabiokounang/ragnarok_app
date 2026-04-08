/**
 * Quest board P2P + soft currency (Astra) + renown.
 * Usage: npm run db:migrate-quest-board
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
    multipleStatements: true,
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    const [colRows] = await conn.query(
      `SELECT column_name AS c
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND column_name IN ('astra_balance', 'renown_points')`
    );
    const existing = new Set(colRows.map((r) => String(r.c)));
    if (!existing.has('astra_balance')) {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN astra_balance INT UNSIGNED NOT NULL DEFAULT 25
         COMMENT 'Soft currency for player quest board'`
      );
    }
    if (!existing.has('renown_points')) {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN renown_points INT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'Social reputation from successful issued quests'`
      );
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS board_quests (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        issuer_kind ENUM('system', 'user') NOT NULL DEFAULT 'user',
        issuer_user_id INT UNSIGNED NULL,
        issuer_name VARCHAR(80) NOT NULL,
        receiver_user_id INT UNSIGNED NULL,
        title VARCHAR(120) NOT NULL,
        description VARCHAR(1000) NOT NULL,
        track_tag VARCHAR(16) NOT NULL DEFAULT 'META',
        cadence ENUM('daily', 'weekly') NOT NULL DEFAULT 'daily',
        min_receiver_level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
        min_receiver_job_tier TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=any,1=first+,2=second+,3=third+',
        reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 25,
        reward_astra SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        issuer_reward_astra SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        status ENUM('open', 'accepted', 'submitted', 'approved', 'rejected', 'expired', 'cancelled') NOT NULL DEFAULT 'open',
        accepted_at TIMESTAMP NULL DEFAULT NULL,
        submitted_at TIMESTAMP NULL DEFAULT NULL,
        resolved_at TIMESTAMP NULL DEFAULT NULL,
        expires_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_bq_status_created (status, created_at),
        KEY idx_bq_receiver_status (receiver_user_id, status),
        KEY idx_bq_issuer_status (issuer_user_id, status),
        CONSTRAINT fk_bq_issuer_user FOREIGN KEY (issuer_user_id) REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT fk_bq_receiver_user FOREIGN KEY (receiver_user_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS board_quest_events (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        quest_id INT UNSIGNED NOT NULL,
        actor_user_id INT UNSIGNED NULL,
        event_type ENUM('create', 'accept', 'submit', 'approve', 'reject', 'cancel', 'expire') NOT NULL,
        note VARCHAR(1000) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_bqe_quest_time (quest_id, created_at),
        KEY idx_bqe_actor_time (actor_user_id, created_at),
        CONSTRAINT fk_bqe_quest FOREIGN KEY (quest_id) REFERENCES board_quests (id) ON DELETE CASCADE,
        CONSTRAINT fk_bqe_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_wallet_ledger (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        amount_delta INT NOT NULL COMMENT 'Signed delta (negative for spend, positive for reward)',
        reason_code ENUM('quest_post_cost', 'quest_reward_receiver', 'quest_reward_issuer', 'admin_adjust') NOT NULL,
        ref_quest_id INT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_uwl_user_time (user_id, created_at),
        KEY idx_uwl_quest (ref_quest_id),
        CONSTRAINT fk_uwl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_uwl_quest FOREIGN KEY (ref_quest_id) REFERENCES board_quests (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(
      `INSERT INTO board_quests
       (issuer_kind, issuer_user_id, issuer_name, title, description, track_tag, cadence, reward_exp, reward_astra, issuer_reward_astra, status, expires_at)
       SELECT 'system', NULL, 'Game Master', 'First Steps Contract',
              'Complete one daily core quest and submit it as proof.',
              'META', 'daily', 30, 5, 0, 'open', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY)
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM board_quests WHERE issuer_kind = 'system' AND title = 'First Steps Contract'
       )`
    );

    console.log('[migrate-019] quest board + astra + renown OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
