-- Migration: Create E-Commerce Store & Order Management Tables
-- Date: 2026-10-26

-- 1. Product Categories
CREATE TABLE IF NOT EXISTS `cst_product_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `academy_id` INT DEFAULT NULL,
  `category_name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `category_image` VARCHAR(255) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `is_deleted` TINYINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_category_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Products
CREATE TABLE IF NOT EXISTS `cst_products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `academy_id` INT DEFAULT NULL,
  `category_id` INT DEFAULT NULL,
  `product_name` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(220) NOT NULL,
  `product_code` VARCHAR(50) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `sale_price` DECIMAL(10,2) DEFAULT NULL,
  `tax_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `status` TINYINT NOT NULL DEFAULT 1,
  `is_deleted` TINYINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_slug` (`slug`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Product Images
CREATE TABLE IF NOT EXISTS `cst_product_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `image_path` VARCHAR(255) NOT NULL,
  `image_alt` VARCHAR(150) DEFAULT NULL,
  `is_primary` TINYINT NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_pid` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Product Stock
CREATE TABLE IF NOT EXISTS `cst_product_stock` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  `reserved_quantity` INT NOT NULL DEFAULT 0,
  `low_stock_alert` INT NOT NULL DEFAULT 5,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_branch` (`product_id`, `branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Orders
CREATE TABLE IF NOT EXISTS `cst_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(60) NOT NULL,
  `academy_id` INT DEFAULT NULL,
  `customer_user_id` INT DEFAULT NULL,
  `public_user_id` INT DEFAULT NULL,
  `fulfillment_branch_id` INT NOT NULL,
  `fulfillment_type` ENUM('Delivery','Pickup') NOT NULL DEFAULT 'Delivery',
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_phone` VARCHAR(25) NOT NULL,
  `customer_email` VARCHAR(150) DEFAULT NULL,
  `delivery_address` TEXT DEFAULT NULL,
  `delivery_city` VARCHAR(100) DEFAULT NULL,
  `delivery_state` VARCHAR(100) DEFAULT NULL,
  `delivery_pincode` VARCHAR(20) DEFAULT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `delivery_charge` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('Cash','UPI','Card','Bank Transfer','COD') NOT NULL DEFAULT 'COD',
  `payment_status` ENUM('Pending','Partial','Paid','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  `order_status` ENUM('Pending','Confirmed','Processing','Ready','Dispatched','Delivered','Cancelled','Returned') NOT NULL DEFAULT 'Pending',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_no` (`order_no`),
  KEY `idx_order_public_user` (`public_user_id`),
  KEY `idx_order_customer_user` (`customer_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Order Items
CREATE TABLE IF NOT EXISTS `cst_order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `product_id` INT DEFAULT NULL,
  `product_name` VARCHAR(200) NOT NULL,
  `product_code` VARCHAR(50) DEFAULT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `quantity` INT NOT NULL DEFAULT 1,
  `tax_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_oid` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Order Payments
CREATE TABLE IF NOT EXISTS `cst_order_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `payment_method` ENUM('Cash','UPI','Card','Bank Transfer','COD') NOT NULL,
  `payment_status` ENUM('Pending','Success','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  `payment_provider` VARCHAR(50) DEFAULT NULL,
  `transaction_no` VARCHAR(100) DEFAULT NULL,
  `gateway_order_id` VARCHAR(100) DEFAULT NULL,
  `gateway_transaction_id` VARCHAR(100) DEFAULT NULL,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `response_payload` LONGTEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_payments_oid` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Order Status History
CREATE TABLE IF NOT EXISTS `cst_order_status_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `old_status` VARCHAR(50) DEFAULT NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `actor_type` ENUM('Public User','Academy User','System') NOT NULL DEFAULT 'System',
  `actor_id` INT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_history_oid` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Cart
CREATE TABLE IF NOT EXISTS `cst_cart` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `public_user_id` INT DEFAULT NULL,
  `customer_user_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cart_puid` (`public_user_id`),
  KEY `idx_cart_cuid` (`customer_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Cart Items
CREATE TABLE IF NOT EXISTS `cst_cart_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cart_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_cart_product` (`cart_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Register Parent Menu "Store & Orders" in cst_menu
INSERT INTO `cst_menu` (
  `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
  `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
)
SELECT NULL, 'store-management', 'Store & Orders', 'Store & Orders', 'shopping-bag', '/next_panel/products', 'header', 9, 1, 1, 1, 0
WHERE NOT EXISTS (
  SELECT 1 FROM `cst_menu` WHERE `menu_key` = 'store-management'
);

-- Register Child Menus
INSERT INTO `cst_menu` (
  `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
  `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
)
SELECT m.id, 'products', 'Products', 'Products', 'package', '/next_panel/products', 'link', 1, 1, 1, 1, 0
FROM `cst_menu` m WHERE m.menu_key = 'store-management'
AND NOT EXISTS (SELECT 1 FROM `cst_menu` WHERE `menu_url` = '/next_panel/products');

INSERT INTO `cst_menu` (
  `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
  `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
)
SELECT m.id, 'product-categories', 'Categories', 'Categories', 'folder-tree', '/next_panel/product-categories', 'link', 2, 1, 1, 1, 0
FROM `cst_menu` m WHERE m.menu_key = 'store-management'
AND NOT EXISTS (SELECT 1 FROM `cst_menu` WHERE `menu_url` = '/next_panel/product-categories');

INSERT INTO `cst_menu` (
  `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
  `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
)
SELECT m.id, 'product-stock', 'Inventory / Stock', 'Inventory', 'layers', '/next_panel/product-stock', 'link', 3, 1, 1, 1, 0
FROM `cst_menu` m WHERE m.menu_key = 'store-management'
AND NOT EXISTS (SELECT 1 FROM `cst_menu` WHERE `menu_url` = '/next_panel/product-stock');

INSERT INTO `cst_menu` (
  `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
  `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
)
SELECT m.id, 'orders', 'Orders', 'Orders', 'shopping-cart', '/next_panel/orders', 'link', 4, 1, 1, 1, 0
FROM `cst_menu` m WHERE m.menu_key = 'store-management'
AND NOT EXISTS (SELECT 1 FROM `cst_menu` WHERE `menu_url` = '/next_panel/orders');

-- Grant permissions for new menus
INSERT INTO `cst_menu_permissions` (`menu_id`, `permission_id`)
SELECT m.id, p.id
FROM `cst_menu` m
CROSS JOIN `cst_permissions` p
WHERE m.menu_url IN ('/next_panel/products', '/next_panel/product-categories', '/next_panel/product-stock', '/next_panel/orders')
  AND p.status = 1
  AND NOT EXISTS (
    SELECT 1 FROM `cst_menu_permissions` cmp
    WHERE cmp.menu_id = m.id AND cmp.permission_id = p.id
  );
