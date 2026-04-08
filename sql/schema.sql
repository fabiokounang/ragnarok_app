-- REBORN — MySQL schema (utf8mb4)
-- Windows / any OS (recommended): from project root run  npm run db:setup
-- CLI alternative: mysql -u USER -p < sql/schema.sql  then run sql/seeds/*.sql in order

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS reborn
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reborn;

DROP TABLE IF EXISTS grimoire_pool_entries;
DROP TABLE IF EXISTS board_quest_events;
DROP TABLE IF EXISTS board_quests;
DROP TABLE IF EXISTS user_wallet_ledger;
DROP TABLE IF EXISTS user_train_routines;
DROP TABLE IF EXISTS user_train_sessions;
DROP TABLE IF EXISTS user_grimoire_reads;
DROP TABLE IF EXISTS grimoire_slug_aliases;
DROP TABLE IF EXISTS grimoire_articles;
DROP TABLE IF EXISTS grimoire_categories;
DROP TABLE IF EXISTS job_progressions;
DROP TABLE IF EXISTS user_weekly_tasks;
DROP TABLE IF EXISTS user_daily_reflections;
DROP TABLE IF EXISTS user_daily_offers;
DROP TABLE IF EXISTS user_daily_tasks;
DROP TABLE IF EXISTS job_weekly_boss;
DROP TABLE IF EXISTS job_weekly_regular;
DROP TABLE IF EXISTS job_task_types;
DROP TABLE IF EXISTS adventurer_jobs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS task_types;
DROP TABLE IF EXISTS jobs;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE jobs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(768) NULL,
  tier TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=Novice,1=First,2=Second,3=Third',
  parent_job_id INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  pick_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Times chosen as first job (community popularity)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_jobs_slug (slug),
  KEY idx_jobs_tier (tier),
  KEY idx_jobs_parent (parent_job_id),
  CONSTRAINT fk_jobs_parent FOREIGN KEY (parent_job_id) REFERENCES jobs (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_types (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(768) NULL,
  alternatives JSON NULL COMMENT 'Swap-in options (gym vs home, equipment, etc.)',
  stat_tag VARCHAR(32) NOT NULL COMMENT 'strength|agility|vitality|intelligence|discipline|spirit|endurance|precision|balance',
  base_exp SMALLINT UNSIGNED NOT NULL DEFAULT 25,
  sort_order INT NOT NULL DEFAULT 0,
  quest_kind ENUM('daily','weekly','weekly_boss') NOT NULL DEFAULT 'daily',
  weekly_target_steps SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'For weekly rows: check-ins before EXP (default 1)',
  hero_image_url VARCHAR(512) NULL COMMENT 'Quest card hero: https URL or site path /images/... (optional)',
  UNIQUE KEY uq_task_types_slug (slug),
  KEY idx_task_types_stat (stat_tag),
  KEY idx_task_types_quest_kind (quest_kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_task_types (
  job_id INT UNSIGNED NOT NULL,
  task_type_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (job_id, task_type_id),
  CONSTRAINT fk_jtt_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_jtt_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_weekly_regular (
  job_id INT UNSIGNED NOT NULL,
  task_type_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (job_id, task_type_id),
  CONSTRAINT fk_jwr_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_jwr_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_weekly_boss (
  job_id INT UNSIGNED NOT NULL,
  task_type_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (job_id),
  KEY idx_jwb_task (task_type_id),
  CONSTRAINT fk_jwb_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_jwb_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_progressions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  from_job_id INT UNSIGNED NOT NULL,
  to_job_id INT UNSIGNED NOT NULL,
  min_level SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  min_job_quests INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Lifetime completed dailies+weeklies for from_job task pool',
  min_weekly_boss_wins INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Weekly boss clears for from_job boss line',
  min_login_streak INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'users.login_streak must be >= this at promotion',
  UNIQUE KEY uq_job_progressions_pair (from_job_id, to_job_id),
  CONSTRAINT fk_jp_from FOREIGN KEY (from_job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_jp_to FOREIGN KEY (to_job_id) REFERENCES jobs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  current_job_id INT UNSIGNED NOT NULL,
  level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_exp INT UNSIGNED NOT NULL DEFAULT 0,
  stat_str TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_agi TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_vit TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_int TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_dex TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_luk TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_points_unspent SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  music_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=in-app BGM when track configured',
  astra_balance INT UNSIGNED NOT NULL DEFAULT 25 COMMENT 'Soft currency for player quest board',
  renown_points INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Social reputation from successful issued quests',
  train_focus_charges TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Next-task focus bonus charges from Train',
  train_focus_expires_date DATE NULL COMMENT 'Server date when focus charges expire',
  vault_focus_sip_charges SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Manual-use Focus tokens stored in Vault',
  login_streak INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Consecutive login days (server date)',
  last_login_streak_date DATE NULL COMMENT 'Last date streak was advanced (CURDATE)',
  login_streak_shield_charges TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Streak shield tokens in Vault inventory',
  login_streak_shield_armed_charges SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Armed shield charges consumed on 1-day gap',
  astra_streak_shield_week_monday DATE NULL COMMENT 'Week (Monday date) when shield was last purchased',
  daily_quest_reroll_salt INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Changes morning-offer shuffle on paid reroll',
  vault_daily_reroll_charges SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Manual-use reroll tokens stored in Vault',
  astra_daily_reroll_date DATE NULL COMMENT 'Last calendar day a paid daily reroll was used',
  astra_focus_sip_date DATE NULL COMMENT 'Last calendar day Focus Sip was bought',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  CONSTRAINT fk_users_job FOREIGN KEY (current_job_id) REFERENCES jobs (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE adventurer_jobs (
  user_id INT UNSIGNED NOT NULL,
  slot_num TINYINT UNSIGNED NOT NULL,
  job_id INT UNSIGNED NOT NULL,
  total_exp INT UNSIGNED NOT NULL DEFAULT 0,
  level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  stat_str TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_agi TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_vit TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_int TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_dex TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_luk TINYINT UNSIGNED NOT NULL DEFAULT 1,
  stat_points_unspent SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, slot_num),
  UNIQUE KEY uq_adventurer_jobs_user_job (user_id, job_id),
  KEY idx_adventurer_jobs_job (job_id),
  CONSTRAINT fk_adventurer_jobs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_adventurer_jobs_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_daily_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  task_type_id INT UNSIGNED NOT NULL,
  task_date DATE NOT NULL,
  is_bonus TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=core daily, 1=optional bonus',
  target_value SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  current_value SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 25 COMMENT 'EXP granted on complete (from task_types.base_exp at roll)',
  completed_at TIMESTAMP NULL DEFAULT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL COMMENT 'User took quest from board; required before check-ins / claim',
  user_note VARCHAR(768) NULL COMMENT 'Optional proof or notes (honor system)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_task_day (user_id, task_type_id, task_date),
  KEY idx_user_day (user_id, task_date),
  CONSTRAINT fk_udt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_udt_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_daily_offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  offer_date DATE NOT NULL,
  task_type_id INT UNSIGNED NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_day_offer_type (user_id, offer_date, task_type_id),
  KEY idx_udo_user_day (user_id, offer_date),
  CONSTRAINT fk_udo_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_udo_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_train_routines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(80) NOT NULL,
  blurb VARCHAR(180) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_utr_user_active (user_id, is_archived, sort_order),
  CONSTRAINT fk_utr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_train_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  routine_id BIGINT UNSIGNED NULL,
  session_date DATE NOT NULL,
  reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 8,
  focus_bonus_pct TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT '5 = +5% on next task',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_uts_user_day (user_id, session_date),
  KEY idx_uts_routine (routine_id),
  CONSTRAINT fk_uts_routine FOREIGN KEY (routine_id) REFERENCES user_train_routines (id) ON DELETE SET NULL,
  CONSTRAINT fk_uts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_daily_reflections (
  user_id INT UNSIGNED NOT NULL,
  reflection_date DATE NOT NULL,
  body VARCHAR(2000) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, reflection_date),
  CONSTRAINT fk_udr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_weekly_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  task_type_id INT UNSIGNED NOT NULL,
  week_start_date DATE NOT NULL COMMENT 'Monday of calendar week (MySQL WEEKDAY=0 Mon)',
  is_weekly_boss TINYINT(1) NOT NULL DEFAULT 0,
  target_value SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  current_value SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 25,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_week_task (user_id, task_type_id, week_start_date),
  KEY idx_user_week (user_id, week_start_date),
  CONSTRAINT fk_uwt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_uwt_task FOREIGN KEY (task_type_id) REFERENCES task_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grimoire_categories (
  id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  deck TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_grimoire_cat_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grimoire_articles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  category_id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  deck TEXT NOT NULL,
  body MEDIUMTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grimoire_articles_slug (slug),
  KEY idx_grimoire_art_cat (category_id, sort_order),
  CONSTRAINT fk_grimoire_art_cat FOREIGN KEY (category_id) REFERENCES grimoire_categories (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grimoire_slug_aliases (
  from_slug VARCHAR(64) NOT NULL,
  to_slug VARCHAR(64) NOT NULL,
  PRIMARY KEY (from_slug),
  KEY idx_grimoire_alias_to (to_slug),
  CONSTRAINT fk_grimoire_alias_article FOREIGN KEY (to_slug) REFERENCES grimoire_articles (slug) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grimoire_pool_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pool_key VARCHAR(64) NOT NULL,
  position_idx SMALLINT UNSIGNED NOT NULL,
  article_slug VARCHAR(64) NOT NULL,
  UNIQUE KEY uq_grimoire_pool_pos (pool_key, position_idx),
  KEY idx_grimoire_pool_key (pool_key),
  CONSTRAINT fk_grimoire_pool_article FOREIGN KEY (article_slug) REFERENCES grimoire_articles (slug) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_grimoire_reads (
  user_id INT UNSIGNED NOT NULL,
  article_slug VARCHAR(64) NOT NULL,
  last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, article_slug),
  KEY idx_ugr_user_time (user_id, last_read_at),
  CONSTRAINT fk_ugr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ugr_article FOREIGN KEY (article_slug) REFERENCES grimoire_articles (slug) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE board_quests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  issuer_kind ENUM('system', 'user') NOT NULL DEFAULT 'user',
  issuer_user_id INT UNSIGNED NULL,
  issuer_name VARCHAR(80) NOT NULL,
  receiver_user_id INT UNSIGNED NULL,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  track_tag VARCHAR(16) NOT NULL DEFAULT 'META',
  cadence ENUM('daily', 'weekly') NOT NULL DEFAULT 'daily',
  min_receiver_level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  min_receiver_job_tier TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=any,1=first+,2=second+,3=third+',
  reward_exp SMALLINT UNSIGNED NOT NULL DEFAULT 25,
  reward_astra SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  issuer_reward_astra SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('open', 'accepted', 'submitted', 'approved', 'rejected', 'expired', 'cancelled') NOT NULL DEFAULT 'open',
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bq_status_created (status, created_at),
  KEY idx_bq_receiver_status (receiver_user_id, status),
  KEY idx_bq_issuer_status (issuer_user_id, status),
  CONSTRAINT fk_bq_issuer_user FOREIGN KEY (issuer_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_bq_receiver_user FOREIGN KEY (receiver_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE board_quest_events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quest_id INT UNSIGNED NOT NULL,
  actor_user_id INT UNSIGNED NULL,
  event_type ENUM('create', 'accept', 'submit', 'approve', 'reject', 'cancel', 'expire') NOT NULL,
  note VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bqe_quest_time (quest_id, created_at),
  KEY idx_bqe_actor_time (actor_user_id, created_at),
  CONSTRAINT fk_bqe_quest FOREIGN KEY (quest_id) REFERENCES board_quests (id) ON DELETE CASCADE,
  CONSTRAINT fk_bqe_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_wallet_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  amount_delta INT NOT NULL COMMENT 'Signed delta (negative for spend, positive for reward)',
  reason_code ENUM('quest_post_cost', 'quest_reward_receiver', 'quest_reward_issuer', 'admin_adjust', 'astra_shop_reroll', 'astra_shop_shield', 'astra_shop_focus_sip') NOT NULL,
  ref_quest_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_uwl_user_time (user_id, created_at),
  KEY idx_uwl_quest (ref_quest_id),
  CONSTRAINT fk_uwl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_uwl_quest FOREIGN KEY (ref_quest_id) REFERENCES board_quests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
