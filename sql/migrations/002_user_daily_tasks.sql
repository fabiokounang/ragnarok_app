-- Daily task instances per user per day (core + optional bonus). Run if DB exists without this table.
-- Target database: npm run db:migrate-daily uses DB_NAME from .env (default reborn).

CREATE TABLE IF NOT EXISTS user_daily_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  task_type_id INT UNSIGNED NOT NULL,
  task_date DATE NOT NULL,
  is_bonus TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=core daily, 1=optional bonus',
  target_value SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  current_value SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 25,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL COMMENT 'User took quest; NULL until Take quest',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_task_day (user_id, task_type_id, task_date),
  KEY idx_user_day (user_id, task_date),
  CONSTRAINT fk_udt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_udt_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
