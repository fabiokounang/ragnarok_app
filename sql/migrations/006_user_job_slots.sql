-- Up to 3 first-class jobs per user. Active class for dailies is users.current_job_id.
USE reborn;

CREATE TABLE IF NOT EXISTS adventurer_jobs (
  user_id INT UNSIGNED NOT NULL,
  slot_num TINYINT UNSIGNED NOT NULL,
  job_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, slot_num),
  UNIQUE KEY uq_adventurer_jobs_user_job (user_id, job_id),
  KEY idx_adventurer_jobs_job (job_id),
  CONSTRAINT fk_adventurer_jobs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_adventurer_jobs_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO adventurer_jobs (user_id, slot_num, job_id)
SELECT u.id, 1, u.current_job_id
FROM users u
WHERE u.current_job_id <> 1;
