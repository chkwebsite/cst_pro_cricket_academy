-- Migration: Create tables for batch coaches and batch players

CREATE TABLE IF NOT EXISTS `cst_batch_coaches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `batch_id` INT NOT NULL,
  `coach_user_id` INT NOT NULL,
  `coach_role` ENUM('Head Coach', 'Assistant Coach', 'Fitness Coach', 'Specialist Coach') NOT NULL DEFAULT 'Head Coach',
  `start_date` DATE NOT NULL,
  `end_date` DATE DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT '1',
  `is_deleted` TINYINT NOT NULL DEFAULT '0',
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_coaches_batch` (`batch_id`),
  KEY `idx_batch_coaches_user` (`coach_user_id`),
  KEY `idx_batch_coaches_status` (`status`, `is_deleted`),
  CONSTRAINT `fk_batch_coaches_batch` FOREIGN KEY (`batch_id`) REFERENCES `cst_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_batch_coaches_user` FOREIGN KEY (`coach_user_id`) REFERENCES `cst_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cst_batch_players` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `batch_id` INT NOT NULL,
  `user_program_id` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE DEFAULT NULL,
  `status` ENUM('Active', 'Transferred', 'Completed', 'Left') NOT NULL DEFAULT 'Active',
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_players_batch` (`batch_id`),
  KEY `idx_batch_players_user_program` (`user_program_id`),
  KEY `idx_batch_players_status` (`status`),
  CONSTRAINT `fk_batch_players_batch` FOREIGN KEY (`batch_id`) REFERENCES `cst_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_batch_players_user_program` FOREIGN KEY (`user_program_id`) REFERENCES `cst_user_programs` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
