-- ==============================================================================
-- Migration: 20261126_create_saas_subscription_tables.sql
-- Description: Academy-Wise SaaS Subscription Management System
-- Tables: cst_subscription_plans, cst_academy_subscriptions, cst_subscription_payments, cst_subscription_history
-- ==============================================================================

-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS `cst_subscription_plans` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `plan_name` VARCHAR(100) NOT NULL,
    `plan_code` VARCHAR(50) NOT NULL UNIQUE,
    `duration_months` INT NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT NULL,
    `features` JSON NULL,
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1: Active, 0: Inactive',
    `is_deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_plans_status` (`status`, `is_deleted`),
    INDEX `idx_plans_duration` (`duration_months`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Academy Subscriptions Table
CREATE TABLE IF NOT EXISTS `cst_academy_subscriptions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `academy_id` INT NOT NULL,
    `plan_id` INT NOT NULL,
    `subscription_start_date` DATE NOT NULL,
    `subscription_end_date` DATE NOT NULL,
    `grace_period_days` INT NOT NULL DEFAULT 5,
    `grace_end_date` DATE NOT NULL,
    `subscription_status` ENUM('active', 'grace_period', 'expired', 'suspended', 'cancelled') NOT NULL DEFAULT 'active',
    `payment_status` ENUM('pending', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'success',
    `is_manual` TINYINT NOT NULL DEFAULT 0 COMMENT '1: Manual activation by Super Admin, 0: Online/Automated',
    `remarks` TEXT NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_academy_subs` (`academy_id`, `subscription_status`),
    INDEX `idx_subs_dates` (`subscription_end_date`, `grace_end_date`),
    CONSTRAINT `fk_academy_sub_academy` FOREIGN KEY (`academy_id`) REFERENCES `cst_academy` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_academy_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `cst_subscription_plans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Subscription Payments Table
CREATE TABLE IF NOT EXISTS `cst_subscription_payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `academy_id` INT NOT NULL,
    `subscription_id` INT NULL,
    `transaction_id` VARCHAR(100) NULL,
    `invoice_number` VARCHAR(100) NOT NULL UNIQUE,
    `amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `payment_mode` VARCHAR(50) NOT NULL DEFAULT 'manual' COMMENT 'online, manual, bank_transfer, upi, cheque',
    `payment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `payment_status` ENUM('pending', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'success',
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_sub_payments_academy` (`academy_id`),
    INDEX `idx_sub_payments_status` (`payment_status`),
    CONSTRAINT `fk_sub_payment_academy` FOREIGN KEY (`academy_id`) REFERENCES `cst_academy` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sub_payment_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `cst_academy_subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Subscription Audit and Change History Table
CREATE TABLE IF NOT EXISTS `cst_subscription_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `academy_id` INT NULL,
    `subscription_id` INT NULL,
    `event_type` VARCHAR(50) NOT NULL COMMENT 'initial_assignment, renewal, expiry_extended, status_update, manual_academy_activated, manual_academy_deactivated, plan_created, plan_updated',
    `plan_id` INT NULL,
    `previous_values` JSON NULL,
    `new_values` JSON NULL,
    `changed_by` INT NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sub_history_academy` (`academy_id`),
    INDEX `idx_sub_history_event` (`event_type`),
    INDEX `idx_sub_history_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Default 4 Subscription Plans
INSERT INTO `cst_subscription_plans` (`id`, `plan_name`, `plan_code`, `duration_months`, `price`, `description`, `features`, `status`, `is_deleted`)
VALUES
(1, 'Monthly Plan', 'PLAN_MONTHLY', 1, 2999.00, 'Standard 1-month comprehensive academy management access with core features.', JSON_ARRAY('Full Player Management', 'Branch & Batch Management', 'Player Attendance & Performance Tracking', 'Fee Collection & Status Matrix', 'Ground Booking & Schedule Management', 'Matches & Tournament Scorecard', '5-Day Grace Period on Expiry'), 1, 0),
(2, 'Quarterly Plan', 'PLAN_QUARTERLY', 3, 7999.00, '3-month quarterly subscription plan with cost savings and full academy operations.', JSON_ARRAY('Everything in Monthly Plan', 'Multi-branch Multi-coach Support', 'Tournament Standings & Leaderboards', 'Player Program Fees Matrix', '5-Day Grace Period on Expiry'), 1, 0),
(3, 'Half Yearly Plan', 'PLAN_HALF_YEARLY', 6, 14999.00, '6-month mid-term subscription package with premium operations and analytics.', JSON_ARRAY('Everything in Quarterly Plan', 'Priority Customer Support', 'Advanced Financial Analytics', 'Staff & Salary Management', '5-Day Grace Period on Expiry'), 1, 0),
(4, 'Yearly Plan', 'PLAN_YEARLY', 12, 27999.00, 'Full 1-year annual subscription plan offering maximum savings and unlimited operations.', JSON_ARRAY('Everything in Half Yearly Plan', 'Maximum Annual Cost Savings', 'Dedicated Account Manager', 'Custom Academy Branding & Reports', '5-Day Grace Period on Expiry'), 1, 0)
ON DUPLICATE KEY UPDATE `price` = VALUES(`price`), `duration_months` = VALUES(`duration_months`);
