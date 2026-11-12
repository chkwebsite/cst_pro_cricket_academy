import pool from "../src/app/components/lib/db.js";

async function main() {
    console.log("=== Setting up Salary Schema, Columns, Menus & Seeding Data ===");
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Check and add advance_deduction to cst_staff_salary if missing
        console.log("1. Checking cst_staff_salary columns...");
        const [salaryCols] = await connection.query(`SHOW COLUMNS FROM cst_staff_salary LIKE 'advance_deduction'`);
        if (salaryCols.length === 0) {
            console.log("Adding advance_deduction column to cst_staff_salary...");
            await connection.query(`
                ALTER TABLE cst_staff_salary 
                ADD COLUMN advance_deduction DECIMAL(10,2) NOT NULL DEFAULT '0.00' AFTER pf_deduction
            `);
            console.log("advance_deduction added to cst_staff_salary.");
        }

        // Check if UNIQUE key exists on staff_id
        const [uqKeys] = await connection.query(`
            SHOW INDEX FROM cst_staff_salary WHERE Key_name = 'uq_staff_id' OR Key_name = 'staff_id'
        `);
        console.log("Existing staff index on cst_staff_salary:", uqKeys.length);

        // 2. Check and add academy_id, branch_id, staff_id to cst_staff_salary_transactions if missing
        console.log("2. Checking cst_staff_salary_transactions columns...");
        const [txAcadCol] = await connection.query(`SHOW COLUMNS FROM cst_staff_salary_transactions LIKE 'academy_id'`);
        if (txAcadCol.length === 0) {
            console.log("Adding academy_id, branch_id, staff_id to cst_staff_salary_transactions...");
            await connection.query(`
                ALTER TABLE cst_staff_salary_transactions 
                ADD COLUMN academy_id INT NULL AFTER salary_payment_id,
                ADD COLUMN branch_id INT NULL AFTER academy_id,
                ADD COLUMN staff_id INT NULL AFTER branch_id
            `);
            console.log("Columns added to cst_staff_salary_transactions.");
        }

        // 3. Register Menus in cst_menu
        console.log("3. Registering Salary menus in cst_menu under Staff/User Management...");
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

        console.log(`Menu IDs: Staff Salary=${salaryMenuId}, Payments=${paymentMenuId}, Transactions=${transMenuId}`);

        // 4. Grant Permissions in cst_menu_permissions (Strictly Super Admin: 3, Academy Admin: 8, Branch Admin: 9)
        console.log("4. Granting permissions strictly to admin roles (3, 8, 9)...");
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

        // 5. Seed dummy salary records matching user example
        console.log("5. Seeding dummy salary structure for staff members...");
        const [staffRecords] = await connection.query(`
            SELECT id, user_id, academy_id, branch_id, first_name, last_name, role_id
            FROM cst_staff
            WHERE is_deleted = 0 AND academy_id IS NOT NULL AND branch_id IS NOT NULL
        `);
        console.log(`Found ${staffRecords.length} staff records to seed.`);

        // Example from user prompt:
        // Monthly Salary: ₹25,000
        // Basic: ₹15,000 (60%)
        // HRA: ₹5,000 (20%)
        // Conveyance: ₹2,000 (8%)
        // Other Allowance: ₹3,000 (12%)
        // Gross: ₹25,000
        // PF Deduction: ₹1,800
        // Advance Deduction: ₹2,000
        // Net Salary: ₹21,200
        const sampleConfigs = [
            { monthly: 25000, basic: 15000, hra: 5000, conv: 2000, otherA: 3000, pf: 1800, adv: 2000, net: 21200 },
            { monthly: 35000, basic: 21000, hra: 7000, conv: 2500, otherA: 4500, pf: 2520, adv: 1500, net: 30980 },
            { monthly: 18000, basic: 10800, hra: 3600, conv: 1500, otherA: 2100, pf: 1296, adv: 1000, net: 15704 },
            { monthly: 30000, basic: 18000, hra: 6000, conv: 2400, otherA: 3600, pf: 2160, adv: 2000, net: 25840 },
        ];

        let sIdx = 0;
        for (const st of staffRecords) {
            const conf = sampleConfigs[sIdx % sampleConfigs.length];
            sIdx++;

            // Insert or Update cst_staff_salary
            const [existingSal] = await connection.query(
                `SELECT id FROM cst_staff_salary WHERE staff_id = ? LIMIT 1`,
                [st.id]
            );

            let salaryStructureId;
            if (existingSal.length > 0) {
                salaryStructureId = existingSal[0].id;
                await connection.query(`
                    UPDATE cst_staff_salary SET
                        academy_id = ?, branch_id = ?,
                        basic_salary = ?, hra = ?, da = 0.00,
                        conveyance_allowance = ?, medical_allowance = 0.00, other_allowance = ?,
                        gross_salary = ?, pf_deduction = ?, advance_deduction = ?, esi_deduction = 0.00,
                        professional_tax = 0.00, other_deduction = 0.00, net_salary = ?,
                        effective_from = '2026-01-01', status = 'Active'
                    WHERE id = ?
                `, [
                    st.academy_id, st.branch_id,
                    conf.basic, conf.hra, conf.conv, conf.otherA,
                    conf.monthly, conf.pf, conf.adv, conf.net,
                    salaryStructureId
                ]);
            } else {
                const [insSal] = await connection.query(`
                    INSERT INTO cst_staff_salary (
                        academy_id, branch_id, staff_id,
                        basic_salary, hra, da,
                        conveyance_allowance, medical_allowance, other_allowance,
                        gross_salary, pf_deduction, advance_deduction, esi_deduction,
                        professional_tax, other_deduction, net_salary,
                        effective_from, status
                    )
                    VALUES (?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, ?, ?, ?, 0.00, 0.00, 0.00, ?, '2026-01-01', 'Active')
                `, [
                    st.academy_id, st.branch_id, st.id,
                    conf.basic, conf.hra, conf.conv, conf.otherA,
                    conf.monthly, conf.pf, conf.adv, conf.net
                ]);
                salaryStructureId = insSal.insertId;
            }

            // Seed sample payment record for current month (Month 11, 2026)
            const curMonth = 11;
            const curYear = 2026;
            const workingDays = 26.0;
            const presentDays = 24.0;
            const absentDays = 2.0;
            const paidLeaves = 0.0;
            // Prorated gross: (gross / 26) * 24
            const proratedGross = Math.round((conf.monthly / workingDays) * presentDays * 100) / 100;
            const totalDeductions = conf.pf + conf.adv;
            const netSalary = Math.max(0, Math.round((proratedGross - totalDeductions) * 100) / 100);
            const paidAmount = netSalary;
            const dueAmount = 0.00;
            const paymentStatus = "Paid";
            const todayDate = "2026-11-02";

            const [payRes] = await connection.query(`
                INSERT INTO cst_staff_salary_payments (
                    academy_id, branch_id, staff_id, salary_structure_id,
                    salary_month, salary_year, working_days, present_days, absent_days, paid_leaves,
                    basic_salary, allowances, bonus, overtime_amount, gross_salary,
                    deductions, advance_deduction, net_salary, paid_amount, due_amount,
                    payment_status, payment_date, remarks
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, ?, ?, ?, ?, ?, ?, ?, 'Attendance-based monthly salary disbursed')
                ON DUPLICATE KEY UPDATE 
                    working_days = VALUES(working_days),
                    present_days = VALUES(present_days),
                    absent_days = VALUES(absent_days),
                    gross_salary = VALUES(gross_salary),
                    net_salary = VALUES(net_salary),
                    paid_amount = VALUES(paid_amount),
                    due_amount = VALUES(due_amount),
                    payment_status = VALUES(payment_status),
                    payment_date = VALUES(payment_date)
            `, [
                st.academy_id, st.branch_id, st.id, salaryStructureId,
                curMonth, curYear, workingDays, presentDays, absentDays, paidLeaves,
                conf.basic, (conf.hra + conf.conv + conf.otherA), proratedGross,
                conf.pf, conf.adv, netSalary, paidAmount, dueAmount,
                paymentStatus, todayDate
            ]);

            const paymentId = payRes.insertId || payRes.id;
            if (paymentId) {
                const txNo = `TXN-SAL-202611-${String(st.id).padStart(4, "0")}`;
                await connection.query(`
                    INSERT INTO cst_staff_salary_transactions (
                        salary_payment_id, academy_id, branch_id, staff_id,
                        amount, payment_mode, transaction_no, payment_date, remarks
                    )
                    VALUES (?, ?, ?, ?, ?, 'Bank Transfer', ?, '2026-11-02 12:00:00', 'Automated bank payout via NEFT')
                    ON DUPLICATE KEY UPDATE amount = VALUES(amount)
                `, [paymentId, st.academy_id, st.branch_id, st.id, paidAmount, txNo]);
            }
        }

        await connection.commit();
        console.log("=== Setup & Dummy Seeding Successfully Completed ===");
        process.exit(0);
    } catch (err) {
        await connection.rollback();
        console.error("Migration/seed error:", err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

main();
