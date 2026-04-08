/**
 * Seed Game Master quests (idempotent by title).
 * Usage: npm run db:seed-quest-board
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

const TEMPLATES = [
  ['GM Daily: Read 20 minutes', 'Pick one Grimoire article and read at least 20 minutes, then submit one key point.', 'INT', 'daily', 25, 4],
  ['GM Daily: 30-minute walk', 'Take a focused 30-minute walk without social feed distractions.', 'STR', 'daily', 20, 3],
  ['GM Daily: Deep work sprint', 'Complete one uninterrupted 45-minute deep work sprint.', 'DIS', 'daily', 28, 5],
  ['GM Daily: Recovery block', 'Do 15+ minutes stretching/breathing/recovery work.', 'SPR', 'daily', 18, 2],
  ['GM Daily: Journal reflection', 'Write a short reflection on what moved your progress today.', 'META', 'daily', 16, 2],
  ['GM Weekly: Finish 2 core dailies for 3 days', 'Stay consistent for at least 3 days this week with 2 core dailies each day.', 'DIS', 'weekly', 60, 12],
  ['GM Weekly: Learn one practical finance concept', 'Read one business/economy concept and provide a real-life example.', 'INT', 'weekly', 55, 10],
  ['GM Weekly: Strength baseline session', 'Complete one harder training session and write your baseline numbers.', 'STR', 'weekly', 52, 9],
  ['GM Weekly: Sleep discipline checkpoint', 'Track sleep routine for 5 days and report one adjustment.', 'SPR', 'weekly', 48, 8],
  ['GM Weekly: Teach-back challenge', 'Explain one thing you learned to another person or in your notes.', 'META', 'weekly', 50, 9],
  ['GM Daily: Inbox zero 15', 'Clear your pending tasks/messages for at least 15 focused minutes.', 'DIS', 'daily', 22, 3],
  ['GM Weekly: Boss prep run', 'Complete all weekly regular quests before touching boss quest.', 'META', 'weekly', 70, 14],
];

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'reborn';

  const conn = await mysql.createConnection({ host, port, user, password, database, charset: 'utf8mb4' });
  try {
    await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    let inserted = 0;
    for (const [title, description, track, cadence, rewardExp, rewardAstra] of TEMPLATES) {
      const [r] = await conn.execute(
        `INSERT INTO board_quests
         (issuer_kind, issuer_user_id, issuer_name, title, description, track_tag, cadence, reward_exp, reward_astra, issuer_reward_astra, status, expires_at)
         SELECT 'system', NULL, 'Game Master', ?, ?, ?, ?, ?, ?, 0, 'open', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY)
         FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM board_quests WHERE issuer_kind = 'system' AND title = ? AND status IN ('open','accepted','submitted')
         )`,
        [title, description, track, cadence, rewardExp, rewardAstra, title]
      );
      inserted += Number(r.affectedRows) || 0;
    }
    console.log(`[seed-quest-board] inserted=${inserted}, templates=${TEMPLATES.length}`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
