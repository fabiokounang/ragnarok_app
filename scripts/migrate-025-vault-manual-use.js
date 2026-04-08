/**
 * Vault manual-use columns:
 * - vault_daily_reroll_charges
 * - vault_focus_sip_charges
 * - login_streak_shield_armed_charges
 * Usage: npm run db:migrate-vault-manual
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'reborn',
    charset: 'utf8mb4',
  });
  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    const [rows] = await conn.query(
      `SELECT column_name AS c
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'users'
         AND column_name IN ('vault_daily_reroll_charges', 'vault_focus_sip_charges', 'login_streak_shield_armed_charges')`
    );
    const existing = new Set(rows.map((r) => String(r.c)));
    if (!existing.has('vault_daily_reroll_charges')) {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN vault_daily_reroll_charges SMALLINT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'Manual-use reroll tokens in Vault'`
      );
    }
    if (!existing.has('vault_focus_sip_charges')) {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN vault_focus_sip_charges SMALLINT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'Manual-use focus sip tokens in Vault'`
      );
    }
    if (!existing.has('login_streak_shield_armed_charges')) {
      await conn.query(
        `ALTER TABLE users
         ADD COLUMN login_streak_shield_armed_charges SMALLINT UNSIGNED NOT NULL DEFAULT 0
         COMMENT 'Armed shield charges consumed on one-day login gap'`
      );
    }
    console.log('[migrate-025] vault manual-use columns OK');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
