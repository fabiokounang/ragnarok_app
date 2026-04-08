-- Dev-only test account (password: testpass123)
-- Safe to re-run: skips if email already exists (INSERT IGNORE).
USE reborn;

INSERT IGNORE INTO users (email, username, password_hash, display_name, current_job_id, level, total_exp)
VALUES (
  'test@reborn.local',
  'test_reborn',
  '$2b$12$Jwe157D6yGUR8VMW3wyJQO2bJRsvEvRsMSpDwrHzk4LQkzdKcyUJe',
  'Test Adventurer',
  2,
  3,
  120
);

INSERT INTO adventurer_jobs
  (user_id, slot_num, job_id, total_exp, level, stat_str, stat_agi, stat_vit, stat_int, stat_dex, stat_luk, stat_points_unspent)
SELECT u.id, 1, 2, 120, 3, 1, 1, 1, 1, 1, 1, 0
FROM users u
WHERE u.email = 'test@reborn.local'
ON DUPLICATE KEY UPDATE
  job_id = 2,
  total_exp = 120,
  level = 3,
  stat_str = 1,
  stat_agi = 1,
  stat_vit = 1,
  stat_int = 1,
  stat_dex = 1,
  stat_luk = 1,
  stat_points_unspent = 0;
