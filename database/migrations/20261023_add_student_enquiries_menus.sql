-- Migration: Add Student Enquiries and Follow-ups to cst_menu under Appointments & Users (parent_id: 17)

INSERT INTO `cst_menu` (
    `parent_id`, `menu_key`, `menu_name`, `menu_title`, `menu_icon`, `menu_url`,
    `menu_type`, `menu_order`, `is_sidebar`, `is_active`, `status`, `is_deleted`
) VALUES
(17, 'student-enquiries', 'Student enquiries', 'Student Enquiries', 'user-check', '/next_panel/student-enquiries', 'link', 4, 1, 1, 1, 0),
(17, 'student-enquiries-flowup', 'Enquiry follow-ups', 'Enquiry Follow-ups', 'calendar', '/next_panel/student-enquiries-flowup', 'link', 5, 1, 1, 1, 0);
