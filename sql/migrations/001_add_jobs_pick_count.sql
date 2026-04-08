-- Add community pick stats for "favorite job" on choose-path (run once if DB predates pick_count).
USE reborn;

ALTER TABLE jobs
  ADD COLUMN pick_count INT UNSIGNED NOT NULL DEFAULT 0
  COMMENT 'Times chosen as first job (community popularity)'
  AFTER sort_order;
