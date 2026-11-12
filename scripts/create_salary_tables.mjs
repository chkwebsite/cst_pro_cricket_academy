import pool from "../src/app/components/lib/db.js";

async function main() {
    console.log("=== Creating Salary Tables, Menus & Seeding Data ===");
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Create cst_staff_salary
        console.log("1. Creating table cst_staff_salary...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cst_staff_salary (
                id INT AUTO_INCREMENT PRIMARY KEY,
                academy_id INT NOT NULL,
                branch_id INT NOT NULL,
                user_id INT NOT NULL,
                monthly_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                hra DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                conveyance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                other_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                gross_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                pf_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                advance_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                net_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                effective_date DATE NULL,
                status TINYINT NOT NULL DEFAULT 1,
                remarks VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_salary (user_id),
                INDEX idx_academy_branch (academy_id, branch_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log("Table cst_staff_salary verified/created.");

        // 2. Create cst_staff_salary_payments
        console.log("2. Creating table cst_staff_salary_payments...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cst_staff_salary_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                academy_id INT NOT NULL,
                branch_id INT NOT NULL,
                user_id INT NOT NULL,
                salary_month INT NOT NULL,
                salary_year INT NOT NULL,
                base_gross_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_month_days INT NOT NULL DEFAULT 30,
                total_working_days INT NOT NULL DEFAULT 26,
                present_days DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                absent_days DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                half_days INT NOT NULL DEFAULT 0,
                leave_days INT NOT NULL DEFAULT 0,
                weekly_off_days INT NOT NULL DEFAULT 0,
                payable_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                bonus DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                pf_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                advance_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                net_payable DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                pending_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                payment_status ENUM('Unpaid', 'Partially Paid', 'Paid') NOT NULL DEFAULT 'Unpaid',
                payment_date DATE NULL,
                remarks TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_salary_period (user_id, salary_month, salary_year),
                INDEX idx_academy_branch (academy_id, branch_id),
                INDEX idx_user (user_id),
                INDEX idx_period (salary_year, salary_month)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log("Table cst_staff_salary_payments verified/created.");

        // 3. Create cst_staff_salary_transactions
        console.log("3. Creating table cst_staff_salary_transactions...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cst_staff_salary_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                salary_payment_id INT NOT NULL,
                academy_id INT NOT NULL,
                branch_id INT NOT NULL,
                user_id INT NOT NULL,
                transaction_number VARCHAR(100) NOT NULL UNIQUE,
                amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                payment_method ENUM('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other') NOT NULL DEFAULT 'Bank Transfer',
                payment_date DATE NOT NULL,
                reference_no VARCHAR(100) NULL,
                payment_status ENUM('Success', 'Pending', 'Failed') NOT NULL DEFAULT 'Success',
                notes TEXT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_payment (salary_payment_id),
                INDEX idx_academy_branch (academy_id, branch_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log("Table cst_staff_salary_transactions verified/created.");

        // 4. Register Menus in cst_menu
        console.log("4. Registering Salary menus in cst_menu...");
        const [parents] = await connection.query(`SELECT id FROM cst_menu WHERE menu_key = 'staff-user-management' OR id = 64 LIMIT 1`);
        let parentId = parents.length > 0 ? parents[0].id : 64;

        // Menu 1: Staff Salary Structure
        const [m1] = await connection.query(`SELECT id FROM cst_menu WHERE menu_key = 'staff-salary' OR menu_url = '/next_panel/staff-salary' LIMIT 1`);
        let salaryMenuId;
        if (m1.length > 0) {
            salaryMenuId = m1[0].id;
            await connection.query(`
                UPDATE cst_menu 
                SET parent_id = ?, menu_name = 'Staff Salary Structure', menu_title = 'Staff Salary Structure', menu_url = '/next_panel/staff-salary', menu_key = 'staff-salary', menu_order = 3, menu_type = 'link', menu_icon = 'credit-card', status = 1, is_sidebar = 1, is_active = 1 
                WHERE id = ?
            `, [parentId, salaryMenuId]);
        } else {
            const [ins1] = await connection.query(`
                INSERT INTO cst_menu (parent_id, menu_key, menu_name, menu_title, menu_url, menu_order, menu_type, menu_icon, status, is_sidebar, is_active)
                VALUES (?, 'staff-salary', 'Staff Salary Structure', 'Staff Salary Structure', '/next_panel/staff-salary', 3, 'link', 'credit-card', 1, 1, 1)
            `, [parentId]);
            salaryMenuId = ins1.insertId;
        }

        // Menu 2: Staff Salary Payments (Monthly Payroll)
        const [m2] = await connection.query(`SELECT id FROM cst_menu WHERE menu_key = 'staff-salary-payments' OR menu_url = '/next_panel/staff-salary-payments' LIMIT 1`);
        let paymentMenuId;
        if (m2.length > 0) {
            paymentMenuId = m2[0].id;
            await connection.query(`
                UPDATE cst_menu 
                SET parent_id = ?, menu_name = 'Salary Payments', menu_title = 'Salary Payments', menu_url = '/next_panel/staff-salary-payments', menu_key = 'staff-salary-payments', menu_order = 4, menu_type = 'link', menu_icon = 'banknote', status = 1, is_sidebar = 1, is_active = 1 
                WHERE id = ?
            `, [parentId, paymentMenuId]);
        } else {
            const [ins2] = await connection.query(`
                INSERT INTO cst_menu (parent_id, menu_key, menu_name, menu_title, menu_url, menu_order, menu_type, menu_icon, status, is_sidebar, is_active)
                VALUES (?, 'staff-salary-payments', 'Salary Payments', 'Salary Payments', '/next_panel/staff-salary-payments', 4, 'link', 'banknote', 1, 1, 1)
            `, [parentId]);
            paymentMenuId = ins2.insertId;
        }

        // Menu 3: Salary Transactions
        const [m3] = await connection.query(`SELECT id FROM cst_menu WHERE menu_key = 'staff-salary-transactions' OR menu_url = '/next_panel/staff-salary-transactions' LIMIT 1`);
        let transMenuId;
        if (m3.length > 0) {
            transMenuId = m3[0].id;
            await connection.query(`
                UPDATE cst_menu 
                SET parent_id = ?, menu_name = 'Salary Transactions', menu_title = 'Salary Transactions', menu_url = '/next_panel/staff-salary-transactions', menu_key = 'staff-salary-transactions', menu_order = 5, menu_type = 'link', menu_icon = 'receipt', status = 1, is_sidebar = 1, is_active = 1 
                WHERE id = ?
            `, [parentId, transMenuId]);
        } else {
            const [ins3] = await connection.query(`
                INSERT INTO cst_menu (parent_id, menu_key, menu_name, menu_title, menu_url, menu_order, menu_type, menu_icon, status, is_sidebar, is_active)
                VALUES (?, 'staff-salary-transactions', 'Salary Transactions', 'Salary Transactions', '/next_panel/staff-salary-transactions', 5, 'link', 'receipt', 1, 1, 1)
            `, [parentId]);
            transMenuId = ins3.insertId;
        }

        // 5. Grant Menu Permissions (Strictly Super Admin, Academy Admin, Branch Admin)
        console.log("5. Granting Permissions in cst_menu_permissions...");
        // 3: super_pawer_all, 8: academy_admin, 9: branch_admin
        const adminPerms = [3, 8, 9];
        const salaryMenuIds = [salaryMenuId, paymentMenuId, transMenuId];

        for (const menuId of salaryMenuIds) {
            for (const permId of adminPerms) {
                await connection.query(`
                    INSERT INTO cst_menu_permissions (menu_id, permission_id)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE menu_id = menu_id
                `, [menuId, permId]);
            }
        }

        // 6. Seed dummy salary records for Staff & Coaches
        console.log("6. Seeding dummy salary structure and payments...");
        const [staffUsers] = await connection.query(`
            SELECT id, academy_id, branch_id, first_name, last_name, user_type
            FROM cst_users
            WHERE is_deleted = 0 
              AND academy_id IS NOT NULL 
              AND branch_id IS NOT NULL
              AND (user_type LIKE '%coach%' OR user_type LIKE '%staff%' OR user_type LIKE '%account%' OR user_type LIKE '%management%')
            LIMIT 10
        `);

        console.log(`Found ${staffUsers.length} staff/coach users for dummy data.`);

        const salaryConfigs = [
            { monthly: 25000, basic: 15000, hra: 5000, conv: 2000, otherA: 3000, pf: 1800, adv: 2000, otherD: 0, net: 21200 },
            { monthly: 35000, basic: 21000, hra: 7000, conv: 2500, otherA: 4500, pf: 2520, adv: 1500, otherD: 0, net: 30980 },
            { monthly: 18000, basic: 10800, hra: 3600, conv: 1600, otherA: 2000, pf: 1296, adv: 1000, otherD: 0, net: 15704 },
            { monthly: 40000, basic: 24000, hra: 8000, conv: 3000, otherA: 5000, pf: 2880, adv: 2500, otherD: 0, net: 34620 },
        ];

        let idx = 0;
        for (const user of staffUsers) {
            const conf = salaryConfigs[idx % salaryConfigs.length];
            idx++;

            // Insert into cst_staff_salary
            await connection.query(`
                INSERT INTO cst_staff_salary (
                    academy_id, branch_id, user_id, 
                    monthly_salary, basic_salary, hra, conveyance, other_allowance, gross_salary, 
                    pf_deduction, advance_deduction, other_deductions, net_salary, 
                    effective_date, status, remarks
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01', 1, 'Standard Salary Structure')
                ON DUPLICATE KEY UPDATE 
                    monthly_salary = VALUES(monthly_salary),
                    basic_salary = VALUES(basic_salary),
                    hra = VALUES(hra),
                    conveyance = VALUES(conveyance),
                    other_allowance = VALUES(other_allowance),
                    gross_salary = VALUES(gross_salary),
                    pf_deduction = VALUES(pf_deduction),
                    advance_deduction = VALUES(advance_deduction),
                    other_deductions = VALUES(other_deductions),
                    net_salary = VALUES(net_salary),
                    effective_date = VALUES(effective_date),
                    status = 1
            `, [
                user.academy_id, user.branch_id, user.id,
                conf.monthly, conf.basic, conf.hra, conf.conv, conf.otherA, conf.monthly,
                conf.pf, conf.adv, conf.otherD, conf.net
            ]);

            // Seed sample payment record for current month (Month 11, 2026)
            const curMonth = 11;
            const curYear = 2026;
            const totalMonthDays = 30;
            const totalWorkingDays = 26;
            const presentDays = 24.0;
            const absentDays = 2.0;
            const halfDays = 0;
            const leaveDays = 0;
            const weeklyOffDays = 4;
            // Prorated payable salary: (gross / 26) * 24
            const payableSalary = Math.round((conf.monthly / totalWorkingDays) * presentDays * 100) / 100;
            const totalDeductions = conf.pf + conf.adv;
            const netPayable = Math.max(0, Math.round((payableSalary - totalDeductions) * 100) / 100);
            const paidAmount = netPayable;
            const pendingAmount = 0.00;
            const paymentStatus = "Paid";
            const todayStr = "2026-11-02";

            const [payResult] = await connection.query(`
                INSERT INTO cst_staff_salary_payments (
                    academy_id, branch_id, user_id, 
                    salary_month, salary_year, base_gross_salary, 
                    total_month_days, total_working_days, present_days, absent_days, half_days, leave_days, weekly_off_days, 
                    payable_salary, bonus, pf_deduction, advance_deduction, other_deductions, total_deductions, 
                    net_payable, paid_amount, pending_amount, payment_status, payment_date, remarks
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, 0.00, ?, ?, ?, ?, ?, ?, 'Monthly salary disbursed based on attendance')
                ON DUPLICATE KEY UPDATE 
                    base_gross_salary = VALUES(base_gross_salary),
                    payable_salary = VALUES(payable_salary),
                    net_payable = VALUES(net_payable),
                    paid_amount = VALUES(paid_amount),
                    pending_amount = VALUES(pending_amount),
                    payment_status = VALUES(payment_status),
                    payment_date = VALUES(payment_date)
            `, [
                user.academy_id, user.branch_id, user.id,
                curMonth, curYear, conf.monthly,
                totalMonthDays, totalWorkingDays, presentDays, absentDays, halfDays, leaveDays, weeklyOffDays,
                payableSalary, conf.pf, conf.adv, totalDeductions,
                netPayable, paidAmount, pendingAmount, paymentStatus, todayStr
            ]);

            const paymentId = payResult.insertId || payResult.id;
            if (paymentId) {
                const txNo = `SAL-${curYear}${String(curMonth).padStart(2, "0")}-${String(user.id).padStart(4, "0")}-01`;
                await connection.query(`
                    INSERT INTO cst_staff_salary_transactions (
                        salary_payment_id, academy_id, branch_id, user_id, 
                        transaction_number, amount, payment_method, payment_date, reference_no, payment_status, notes
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'Bank Transfer', ?, 'NEFT-88992211', 'Success', 'Automated bank payout')
                    ON DUPLICATE KEY UPDATE amount = VALUES(amount), payment_status = VALUES(payment_status)
                `, [paymentId, user.academy_id, user.branch_id, user.id, txNo, paidAmount, todayStr]);
            }
        }

        await connection.commit();
        console.log("=== Database Migration & Seeding Successfully Completed ===");
    } catch (err) {
        await connection.rollback();
        console.error("Migration failed:", err);
        throw err;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
