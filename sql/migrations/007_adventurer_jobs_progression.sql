-- Per-job level, EXP, and stats (RO-style alts). users.* stays for Novice-only rows.
USE reborn;

ALTER TABLE adventurer_jobs
  ADD COLUMN total_exp INT UNSIGNED NOT NULL DEFAULT 0 AFTER job_id,
  ADD COLUMN level SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER total_exp,
  ADD COLUMN stat_str TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER level,
  ADD COLUMN stat_agi TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER stat_str,
  ADD COLUMN stat_vit TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER stat_agi,
  ADD COLUMN stat_int TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER stat_vit,
  ADD COLUMN stat_dex TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER stat_int,
  ADD COLUMN stat_luk TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER stat_dex,
  ADD COLUMN stat_points_unspent SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER stat_luk;

UPDATE adventurer_jobs aj
INNER JOIN users u ON u.id = aj.user_id AND aj.job_id = u.current_job_id
SET aj.total_exp = u.total_exp,
    aj.level = u.level,
    aj.stat_str = u.stat_str,
    aj.stat_agi = u.stat_agi,
    aj.stat_vit = u.stat_vit,
    aj.stat_int = u.stat_int,
    aj.stat_dex = u.stat_dex,
    aj.stat_luk = u.stat_luk,
    aj.stat_points_unspent = u.stat_points_unspent;
