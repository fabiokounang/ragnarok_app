/**
 * Windows-friendly: applies schema + all seeds using mysql2 (no mysql.exe in PATH needed).
 *
 * Prerequisites: MySQL/MariaDB running, .env with DB_HOST, DB_USER, DB_PASSWORD (DB_PORT optional).
 *
 * Usage: npm run db:setup
 *
 * Existing databases created before progression columns: run `npm run db:migrate-job-progression-reqs`
 * before applying seed 09 (or rely on fresh schema.sql which already includes those columns).
 * Morning board + notes + reflections: `npm run db:migrate-daily-morning-board` on older DBs.
 * Grimoire: schema includes grimoire_* + user_grimoire_reads; this script then runs `db:seed-grimoire`.
 * Existing DBs: `npm run db:migrate-grimoire` then `npm run db:seed-grimoire`; for read history: `npm run db:migrate-grimoire-reads`.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..');
const SQL_DIR = path.join(ROOT, 'sql');
const SEEDS_DIR = path.join(SQL_DIR, 'seeds');

const FILES = [
  path.join(SQL_DIR, 'schema.sql'),
  path.join(SEEDS_DIR, '01_jobs.sql'),
  path.join(SEEDS_DIR, '02_task_types.sql'),
  path.join(SEEDS_DIR, '03_job_task_types.sql'),
  path.join(SEEDS_DIR, '04_job_progressions.sql'),
  path.join(SEEDS_DIR, '05_test_user.sql'),
  path.join(SEEDS_DIR, '06_task_type_alternatives.sql'),
  path.join(SEEDS_DIR, '08_weekly_tasks.sql'),
  path.join(SEEDS_DIR, '09_advanced_jobs.sql'),
];

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    for (const file of FILES) {
      if (!fs.existsSync(file)) {
        throw new Error(`Missing file: ${file}`);
      }
      let sql = fs.readFileSync(file, 'utf8');
      sql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const label = path.relative(ROOT, file);
      process.stdout.write(`[db:setup] Running ${label} ... `);
      await conn.query(sql);
      console.log('OK');
    }
    console.log('[db:setup] Seeding Grimoire (longform → MySQL) ...');
    const seedGr = spawnSync(process.execPath, [path.join(__dirname, 'seed-grimoire.js')], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    if (seedGr.status !== 0) {
      process.exit(seedGr.status || 1);
    }
    console.log('[db:setup] Finished. Run `npm run db:test` to verify.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\n[db:setup] Failed:', err.message || err);
  if (err.code === 'ECONNREFUSED') {
    console.error('Hint: start MySQL (Windows Services, XAMPP, Laragon, or Docker).');
  }
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('Hint: check DB_USER and DB_PASSWORD in .env (copy from .env.example).');
  }
  process.exit(1);
});
