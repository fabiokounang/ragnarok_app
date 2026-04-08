const { getPool } = require('../config/database');
const { STARTING_JOB_ID } = require('../config/constants');

const FROM_NOVICE_FIRST_JOBS = `
     FROM jobs j
     INNER JOIN job_progressions p0 ON p0.to_job_id = j.id AND p0.from_job_id = ?
     WHERE j.tier = 1
     ORDER BY j.sort_order`;

/** Log pick_count migration hint at most once per server process. */
let pickCountMissingLogged = false;

function warnPickCountMissingOnce() {
  if (pickCountMissingLogged) return;
  pickCountMissingLogged = true;
  console.warn(
    '[jobModel] jobs.pick_count missing — favorite stats disabled. Run once: npm run db:setup  OR  mysql < sql/migrations/001_add_jobs_pick_count.sql'
  );
}

function mapFirstJobsProgressRows(rows) {
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    sortOrder: r.sort_order,
    pickCount: Number(r.pickCount),
    evolutionPaths: /** @type {Array<{ steps: string[], gateLevels: number[] }>} */ ([]),
  }));
}

function isMissingPickCountColumn(err) {
  if (!err) return false;
  if (err.errno !== 1054 && err.code !== 'ER_BAD_FIELD_ERROR') return false;
  const msg = String(err.message || '');
  return msg.includes('pick_count');
}

/**
 * Full RO-style chains from DB: Novice → 1st → 2nd → 3rd (Renewal names in seeds).
 * @param {number} firstJobId
 * @param {Map<number, string>} jobById
 * @param {Array<{ fromId: number, toId: number, minLevel: number }>} progs
 */
function buildEvolutionPaths(firstJobId, jobById, progs) {
  const noviceId = STARTING_JOB_ID;
  const firstName = jobById.get(firstJobId);
  if (!firstName) return [];

  const noviceEdge = progs.find((p) => p.fromId === noviceId && p.toId === firstJobId);
  const gateToFirst = noviceEdge ? noviceEdge.minLevel : 10;

  const paths = [];
  const tier2Edges = progs.filter((p) => p.fromId === firstJobId);

  for (const e2 of tier2Edges) {
    const n2 = jobById.get(e2.toId);
    if (!n2) continue;
    const tier3Edges = progs.filter((p) => p.fromId === e2.toId);

    if (tier3Edges.length === 0) {
      paths.push({
        steps: ['Novice', firstName, n2],
        gateLevels: [gateToFirst, e2.minLevel],
      });
      continue;
    }
    for (const e3 of tier3Edges) {
      const n3 = jobById.get(e3.toId);
      if (!n3) continue;
      paths.push({
        steps: ['Novice', firstName, n2, n3],
        gateLevels: [gateToFirst, e2.minLevel, e3.minLevel],
      });
    }
  }
  return paths;
}

async function fetchProgressionContext(pool) {
  const [jobRows] = await pool.execute('SELECT id, name FROM jobs');
  const [progRows] = await pool.execute(
    'SELECT from_job_id, to_job_id, min_level FROM job_progressions'
  );
  const jobById = new Map(
    jobRows.map((r) => [Number(r.id), String(r.name)])
  );
  const progs = progRows.map((r) => ({
    fromId: Number(r.from_job_id),
    toId: Number(r.to_job_id),
    minLevel: Number(r.min_level),
  }));
  return { jobById, progs };
}

async function attachEvolutionPaths(pool, jobs) {
  const { jobById, progs } = await fetchProgressionContext(pool);
  for (const job of jobs) {
    job.evolutionPaths = buildEvolutionPaths(Number(job.id), jobById, progs);
  }
}

/**
 * First jobs reachable from Novice (tier 1, valid progression from starting job).
 * @returns {Promise<Array<{ id: number, slug: string, name: string, description: string }>>}
 */
async function listFirstJobsFromNovice() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT j.id, j.slug, j.name, j.description
     FROM jobs j
     INNER JOIN job_progressions p ON p.to_job_id = j.id AND p.from_job_id = ?
     WHERE j.tier = 1
     ORDER BY j.sort_order`,
    [STARTING_JOB_ID]
  );
  return rows;
}

/**
 * First jobs + evolution chains from job_progressions + pick stats.
 * Works when `pick_count` column is missing (pickCount 0; favorite disabled).
 */
async function listFirstJobsWithProgress() {
  const pool = getPool();
  const params = [STARTING_JOB_ID];

  const withPick = `SELECT j.id, j.slug, j.name, j.description, j.sort_order,
            COALESCE(j.pick_count, 0) AS pickCount
     ${FROM_NOVICE_FIRST_JOBS}`;

  let rows;
  try {
    [rows] = await pool.execute(withPick, params);
  } catch (err) {
    if (!isMissingPickCountColumn(err)) throw err;
    warnPickCountMissingOnce();
    const withoutPick = `SELECT j.id, j.slug, j.name, j.description, j.sort_order,
            0 AS pickCount
     ${FROM_NOVICE_FIRST_JOBS}`;
    [rows] = await pool.execute(withoutPick, params);
  }

  const jobs = mapFirstJobsProgressRows(rows);
  await attachEvolutionPaths(pool, jobs);
  return jobs;
}

/**
 * @param {number} jobId
 * @returns {Promise<boolean>}
 */
async function isValidNoviceFirstJob(jobId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT 1 FROM job_progressions WHERE from_job_id = ? AND to_job_id = ? LIMIT 1`,
    [STARTING_JOB_ID, jobId]
  );
  return rows.length > 0;
}

/**
 * @param {number} jobId
 */
async function incrementJobPickCount(jobId) {
  const pool = getPool();
  try {
    await pool.execute('UPDATE jobs SET pick_count = pick_count + 1 WHERE id = ?', [jobId]);
  } catch (err) {
    if (isMissingPickCountColumn(err)) {
      warnPickCountMissingOnce();
      return;
    }
    throw err;
  }
}

module.exports = {
  listFirstJobsFromNovice,
  listFirstJobsWithProgress,
  isValidNoviceFirstJob,
  incrementJobPickCount,
};
