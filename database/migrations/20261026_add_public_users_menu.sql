-- Migration: Add Public Users to cst_menu under Appointments & Users (parent_id: 17)
-- Date: 2026-10-26

INSERT INTO `cst_menu` (
    `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
    `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
)
SELECT
    17, 'public-users', 'Public users', 'Public Users', 'users', '/next_panel/public-users',
    'link', 6, 1, 1, 1, 0
WHERE NOT EXISTS (
    SELECT 1 FROM `cst_menu` WHERE `menu_url` = '/next_panel/public-users'
);

-- Grant permissions to all active permissions (admin roles)
INSERT INTO `cst_menu_permissions` (`menu_id`, `permission_id`)
SELECT m.id, p.id
FROM `cst_menu` m
CROSS JOIN `cst_permissions` p
WHERE m.menu_url = '/next_panel/public-users'
  AND p.status = 1
  AND NOT EXISTS (
    SELECT 1 FROM `cst_menu_permissions` cmp
    WHERE cmp.menu_id = m.id AND cmp.permission_id = p.id
  );
