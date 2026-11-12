-- Migration: Create cst_ground_booking_requests table and register admin menu
-- Date: 2026-10-25

CREATE TABLE IF NOT EXISTS `cst_ground_booking_requests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `request_number` VARCHAR(64) NOT NULL UNIQUE,
  `customer_name` VARCHAR(150) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `ground_id` INT NOT NULL,
  `booking_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `booking_purpose` VARCHAR(100) NOT NULL DEFAULT 'Friendly Match',
  `number_of_players` INT DEFAULT NULL,
  `special_requirements` TEXT DEFAULT NULL,
  `request_status` ENUM('Pending', 'Approved', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Pending',
  `admin_remarks` TEXT DEFAULT NULL,
  `is_deleted` TINYINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ground_date` (`ground_id`, `booking_date`),
  INDEX `idx_request_status` (`request_status`),
  INDEX `idx_booking_date` (`booking_date`),
  INDEX `idx_is_deleted` (`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Register Menu under Grounds (parent_id: 21) if not already exists
INSERT INTO `cst_menu` (
  `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
  `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
)
SELECT 21, 'ground-booking-requests', 'Booking Requests', 'Ground Booking Requests', 'calendar', '/next_panel/ground-booking-requests', 'link', 6, 1, 1, 1, 0
WHERE NOT EXISTS (
  SELECT 1 FROM `cst_menu` WHERE `menu_url` = '/next_panel/ground-booking-requests'
);

-- Grant permissions to Super Power (3), Academy Admin (8), Branch Admin (9)
INSERT INTO `cst_menu_permissions` (`menu_id`, `permission_id`)
SELECT m.id, p.id
FROM `cst_menu` m
CROSS JOIN `cst_permissions` p
WHERE m.menu_url = '/next_panel/ground-booking-requests'
  AND p.id IN (3, 8, 9)
  AND NOT EXISTS (
    SELECT 1 FROM `cst_menu_permissions` cmp
    WHERE cmp.menu_id = m.id AND cmp.permission_id = p.id
  );
