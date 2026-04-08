-- Ensure stat defaults are 1 and normalize existing rows to baseline 1 (re-allocate via level-up points on Profile).
ALTER TABLE users
  MODIFY COLUMN stat_str TINYINT UNSIGNED NOT NULL DEFAULT 1,
  MODIFY COLUMN stat_agi TINYINT UNSIGNED NOT NULL DEFAULT 1,
  MODIFY COLUMN stat_vit TINYINT UNSIGNED NOT NULL DEFAULT 1,
  MODIFY COLUMN stat_int TINYINT UNSIGNED NOT NULL DEFAULT 1,
  MODIFY COLUMN stat_dex TINYINT UNSIGNED NOT NULL DEFAULT 1,
  MODIFY COLUMN stat_luk TINYINT UNSIGNED NOT NULL DEFAULT 1;

UPDATE users
SET stat_str = 1, stat_agi = 1, stat_vit = 1, stat_int = 1, stat_dex = 1, stat_luk = 1;
