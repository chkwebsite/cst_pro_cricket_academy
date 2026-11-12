import pool from "./db";

export async function ensureEcommerceTables() {
    if (globalThis._ecommerceInitialized) return;
    globalThis._ecommerceInitialized = true;

    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Categories
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_product_categories\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`academy_id\` INT DEFAULT NULL,
              \`category_name\` VARCHAR(150) NOT NULL,
              \`slug\` VARCHAR(180) NOT NULL,
              \`description\` TEXT DEFAULT NULL,
              \`category_image\` VARCHAR(255) DEFAULT NULL,
              \`sort_order\` INT NOT NULL DEFAULT 0,
              \`status\` TINYINT NOT NULL DEFAULT 1,
              \`is_deleted\` TINYINT NOT NULL DEFAULT 0,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`uniq_category_slug\` (\`slug\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Products
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_products\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`academy_id\` INT DEFAULT NULL,
              \`category_id\` INT DEFAULT NULL,
              \`product_name\` VARCHAR(200) NOT NULL,
              \`slug\` VARCHAR(220) NOT NULL,
              \`product_code\` VARCHAR(50) DEFAULT NULL,
              \`description\` TEXT DEFAULT NULL,
              \`price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`sale_price\` DECIMAL(10,2) DEFAULT NULL,
              \`tax_percent\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
              \`status\` TINYINT NOT NULL DEFAULT 1,
              \`is_deleted\` TINYINT NOT NULL DEFAULT 0,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`uniq_product_slug\` (\`slug\`),
              KEY \`idx_category_id\` (\`category_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Images
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_product_images\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`product_id\` INT NOT NULL,
              \`image_path\` VARCHAR(255) NOT NULL,
              \`image_alt\` VARCHAR(150) DEFAULT NULL,
              \`is_primary\` TINYINT NOT NULL DEFAULT 0,
              \`sort_order\` INT NOT NULL DEFAULT 0,
              \`status\` TINYINT NOT NULL DEFAULT 1,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`idx_product_images_pid\` (\`product_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. Stock
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_product_stock\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`product_id\` INT NOT NULL,
              \`branch_id\` INT NOT NULL,
              \`quantity\` INT NOT NULL DEFAULT 0,
              \`reserved_quantity\` INT NOT NULL DEFAULT 0,
              \`low_stock_alert\` INT NOT NULL DEFAULT 5,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`uniq_product_branch\` (\`product_id\`, \`branch_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 5. Orders
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_orders\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`order_no\` VARCHAR(60) NOT NULL,
              \`academy_id\` INT DEFAULT NULL,
              \`customer_user_id\` INT DEFAULT NULL,
              \`public_user_id\` INT DEFAULT NULL,
              \`fulfillment_branch_id\` INT NOT NULL,
              \`fulfillment_type\` ENUM('Delivery','Pickup') NOT NULL DEFAULT 'Delivery',
              \`customer_name\` VARCHAR(150) NOT NULL,
              \`customer_phone\` VARCHAR(25) NOT NULL,
              \`customer_email\` VARCHAR(150) DEFAULT NULL,
              \`delivery_address\` TEXT DEFAULT NULL,
              \`delivery_city\` VARCHAR(100) DEFAULT NULL,
              \`delivery_state\` VARCHAR(100) DEFAULT NULL,
              \`delivery_pincode\` VARCHAR(20) DEFAULT NULL,
              \`subtotal\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`tax_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`delivery_charge\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`discount_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`grand_total\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`payment_method\` ENUM('Cash','UPI','Card','Bank Transfer','COD') NOT NULL DEFAULT 'COD',
              \`payment_status\` ENUM('Pending','Partial','Paid','Failed','Refunded') NOT NULL DEFAULT 'Pending',
              \`order_status\` ENUM('Pending','Confirmed','Processing','Ready','Dispatched','Delivered','Cancelled','Returned') NOT NULL DEFAULT 'Pending',
              \`notes\` TEXT DEFAULT NULL,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`uniq_order_no\` (\`order_no\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 6. Order Items
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_order_items\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`order_id\` INT NOT NULL,
              \`product_id\` INT DEFAULT NULL,
              \`product_name\` VARCHAR(200) NOT NULL,
              \`product_code\` VARCHAR(50) DEFAULT NULL,
              \`unit_price\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`quantity\` INT NOT NULL DEFAULT 1,
              \`tax_percent\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
              \`tax_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`discount_amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`line_total\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`idx_order_items_oid\` (\`order_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 7. Order Payments
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_order_payments\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`order_id\` INT NOT NULL,
              \`payment_method\` ENUM('Cash','UPI','Card','Bank Transfer','COD') NOT NULL,
              \`payment_status\` ENUM('Pending','Success','Failed','Refunded') NOT NULL DEFAULT 'Pending',
              \`payment_provider\` VARCHAR(50) DEFAULT NULL,
              \`transaction_no\` VARCHAR(100) DEFAULT NULL,
              \`gateway_order_id\` VARCHAR(100) DEFAULT NULL,
              \`gateway_transaction_id\` VARCHAR(100) DEFAULT NULL,
              \`amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
              \`payment_date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`response_payload\` LONGTEXT DEFAULT NULL,
              \`notes\` TEXT DEFAULT NULL,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`idx_order_payments_oid\` (\`order_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 8. Order Status History
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_order_status_history\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`order_id\` INT NOT NULL,
              \`old_status\` VARCHAR(50) DEFAULT NULL,
              \`new_status\` VARCHAR(50) NOT NULL,
              \`actor_type\` ENUM('Public User','Academy User','System') NOT NULL DEFAULT 'System',
              \`actor_id\` INT DEFAULT NULL,
              \`notes\` TEXT DEFAULT NULL,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`idx_status_history_oid\` (\`order_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 9. Cart
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_cart\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`public_user_id\` INT DEFAULT NULL,
              \`customer_user_id\` INT DEFAULT NULL,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`idx_cart_puid\` (\`public_user_id\`),
              KEY \`idx_cart_cuid\` (\`customer_user_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 10. Cart Items
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`cst_cart_items\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`cart_id\` INT NOT NULL,
              \`product_id\` INT NOT NULL,
              \`quantity\` INT NOT NULL DEFAULT 1,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`uniq_cart_product\` (\`cart_id\`, \`product_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 11. Ensure Menus in cst_menu
        try {
            // Check Parent: Prefer existing Product_Master, fallback to store-management
            const [existingProductMaster] = await connection.query(
                "SELECT id FROM cst_menu WHERE menu_key = 'Product_Master' LIMIT 1"
            );
            const [existingParent] = await connection.query(
                "SELECT id FROM cst_menu WHERE menu_key = 'store-management' LIMIT 1"
            );
            let parentId = existingProductMaster?.[0]?.id || existingParent?.[0]?.id;

            if (!parentId) {
                const [insP] = await connection.query(`
                    INSERT INTO cst_menu (
                      parent_id, menu_key, menu_name, menu_title, menu_icon, menu_url,
                      menu_type, menu_order, is_sidebar, is_active, status, is_deleted
                    ) VALUES (NULL, 'Product_Master', 'Product Master', 'Product Master', 'shopping-bag', '/next_panel/products', 'header', 9, 1, 1, 1, 0)
                `);
                parentId = insP.insertId;
            }

            if (parentId) {
                const children = [
                    { key: "product-categories", name: "Product categories", title: "Product categories", icon: "folder-tree", url: "/next_panel/product-categories", order: 1 },
                    { key: "products", name: "Products", title: "Products", icon: "package", url: "/next_panel/products", order: 2 },
                    { key: "product-images", name: "Product Images", title: "Product Images", icon: "images", url: "/next_panel/product-images", order: 3 },
                    { key: "product-stock", name: "Inventory / Stock", title: "Inventory", icon: "layers", url: "/next_panel/product-stock", order: 4 },
                    { key: "orders", name: "Orders", title: "Orders", icon: "shopping-cart", url: "/next_panel/orders", order: 5 },
                    { key: "order-payments", name: "Order Payments", title: "Order Payments", icon: "credit-card", url: "/next_panel/order-payments", order: 6 },
                ];

                for (const child of children) {
                    const [cExists] = await connection.query(
                        "SELECT id FROM cst_menu WHERE menu_key = ? OR menu_url = ? OR menu_url = ? LIMIT 1",
                        [child.key, child.url, child.url.replace(/^\//, "")]
                    );

                    let childMenuId = cExists?.[0]?.id;
                    if (!childMenuId) {
                        const [insC] = await connection.query(`
                            INSERT INTO cst_menu (
                              parent_id, menu_key, menu_name, menu_title, menu_icon, menu_url,
                              menu_type, menu_order, is_sidebar, is_active, status, is_deleted
                            ) VALUES (?, ?, ?, ?, ?, ?, 'link', ?, 1, 1, 1, 0)
                        `, [parentId, child.key, child.name, child.title, child.icon, child.url, child.order]);
                        childMenuId = insC.insertId;
                    }

                    if (childMenuId) {
                        await connection.query(`
                            INSERT IGNORE INTO cst_menu_permissions (menu_id, permission_id)
                            SELECT ?, id FROM cst_permissions WHERE status = 1
                        `, [childMenuId]);
                    }
                }
            }
        } catch (menuErr) {
            console.warn("ensureEcommerceTables menu warning:", menuErr?.message);
        }

        initialized = true;
    } catch (err) {
        console.error("ensureEcommerceTables error:", err);
    } finally {
        if (connection) connection.release();
    }
}
