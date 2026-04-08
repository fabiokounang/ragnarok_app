/**
 * MySQL connectivity + sanity check (jobs / task_types counts after seeds).
 * Usage: npm run db:test
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createPool } = require('../config/database');

async function main() {
  const pool = createPool();
  try {
    const [ping] = await pool.query('SELECT 1 AS ok');
    if (!ping.length || ping[0].ok !== 1) {
      throw new Error('Unexpected ping result');
    }
    console.log('[db:test] Ping OK');

    const [[jobCount]] = await pool.query('SELECT COUNT(*) AS n FROM jobs');
    const [[taskCount]] = await pool.query('SELECT COUNT(*) AS n FROM task_types');
    const [[linkCount]] = await pool.query('SELECT COUNT(*) AS n FROM job_task_types');

    console.log(`[db:test] jobs = ${jobCount.n}, task_types = ${taskCount.n}, job_task_types = ${linkCount.n}`);

    if (Number(jobCount.n) === 9) {
      // OK: base seeds only
    } else if (Number(jobCount.n) === 25) {
      // OK: 01 + 09 advanced jobs
    } else {
      console.warn('[db:test] Expected 9 jobs (base) or 25 with 09_advanced_jobs.sql; got', jobCount.n);
    }
    if (Number(taskCount.n) < 60) {
      console.warn('[db:test] Expected at least 60 daily task_types after 02 (incl. Blacksmith id 64).');
    } else if (Number(taskCount.n) < 97) {
      console.warn('[db:test] Weekly catalog incomplete: npm run db:migrate-weekly (expect 97 = 60 daily + 37 weekly incl. Blacksmith pool).');
    }
    if (Number(linkCount.n) === 60) {
      // base only
    } else if (Number(linkCount.n) >= 180) {
      // ~60 + copied pools for 16 tier-2 jobs
    } else if (Number(jobCount.n) > 9) {
      console.warn('[db:test] job_task_types lower than expected with advanced jobs (run full db:setup).');
    } else if (Number(linkCount.n) !== 60) {
      console.warn('[db:test] Expected 60 job_task_types rows (check 03_job_task_types.sql).');
    }

    console.log('[db:test] Done.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[db:test] Failed:', err.message || err);
  process.exit(1);
});
