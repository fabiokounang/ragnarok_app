/**
 * Astra Vault shop: wallet ledger reasons + user columns for reroll / streak shield / focus sip.
 * Usage: npm run db:migrate-astra-shop
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

const USER_COLS = [
  {
    name: 'login_streak_shield_charges',
    sql: `ADD COLUMN login_streak_shield_charges TINYINT UNSIGNED NOT NULL DEFAULT 0
          COMMENT 'Consumes on 1-day login gap (Vault)'`,
  },
  {
    name: 'astra_streak_shield_week_monday',
    sql: `ADD COLUMN astra_streak_shield_week_monday DATE NULL
          COMMENT 'Week (Monday date) when shield was last purchased'`,
  },
  {
    name: 'daily_quest_reroll_salt',
    sql: `ADD COLUMN daily_quest_reroll_salt INT UNSIGNED NOT NULL DEFAULT 0
          COMMENT 'Changes morning-offer shuffle on paid reroll'`,
  },
  {
    name: 'astra_daily_reroll_date',
    sql: `ADD COLUMN astra_daily_reroll_date DATE NULL
          COMMENT 'Last calendar day a paid daily reroll was used'`,
  },
  {
    name: 'astra_focus_sip_date',
    sql: `ADD COLUMN astra_focus_sip_date DATE NULL
          COMMENT 'Last calendar day Focus Sip was bought'`,
  },
];

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

    const [colRows] = await conn.query(
      `SELECT column_name AS c
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'`
    );
    const existing = new Set(colRows.map((r) => String(r.c)));
    for (const col of USER_COLS) {
      if (!existing.has(col.name)) {
        await conn.query(`ALTER TABLE users ${col.sql}`);
      }
    }

    const [enumRows] = await conn.query(
      `SELECT COLUMN_TYPE AS t
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'user_wallet_ledger'
         AND column_name = 'reason_code'`
    );
    const t = enumRows.length ? String(enumRows[0].t) : '';
    if (t && !t.includes('astra_shop_reroll')) {
      await conn.query(
        `ALTER TABLE user_wallet_ledger
         MODIFY COLUMN reason_code ENUM(
           'quest_post_cost',
           'quest_reward_receiver',
           'quest_reward_issuer',
           'admin_adjust',
           'astra_shop_reroll',
           'astra_shop_shield',
           'astra_shop_focus_sip'
         ) NOT NULL`
      );
    }

    console.log('[migrate-022] astra shop columns + wallet enum OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
