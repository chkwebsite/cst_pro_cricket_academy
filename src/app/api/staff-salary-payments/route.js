import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

const FULL_WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Helper: Calculate attendance-based working days and prorated salary
export async function calculateStaffPayroll(connection, staffId, month, year, overrides = {}) {
    // 1. Fetch Staff & Salary Structure
    const [staffRows] = await connection.query(
        `SELECT s.id, s.user_id, s.academy_id, s.branch_id, s.first_name, s.last_name, s.appointment_no,
                s.date_of_joining,
                r.role_name
         FROM cst_staff s
         LEFT JOIN cst_roles r ON r.id = s.role_id
         WHERE s.id = ? AND s.is_deleted = 0`,
        [staffId]
    );

    if (staffRows.length === 0) {
        throw new Error("Staff member not found.");
    }
    const staff = staffRows[0];

    const [salaryRows] = await connection.query(
        `SELECT * FROM cst_staff_salary 
         WHERE staff_id = ? AND status = 'Active' 
         ORDER BY id DESC LIMIT 1`,
        [staffId]
    );

    if (salaryRows.length === 0) {
        throw new Error(`No active salary structure configured for ${staff.first_name} ${staff.last_name}. Please set up Staff Salary Structure first.`);
    }
    const salaryStructure = salaryRows[0];

    const daysInMonth = new Date(year, month, 0).getDate();

    // 2. Parse Date of Joining
    let dojYear = null;
    let dojMonth = null;
    let dojDay = 1;
    let dojStr = null;

    if (staff.date_of_joining) {
        dojStr = String(staff.date_of_joining).slice(0, 10);
        const parts = dojStr.split("-").map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            dojYear = parts[0];
            dojMonth = parts[1];
            dojDay = parts[2];
        }
    }

    const baseGross = Number(salaryStructure.gross_salary) || 0;
    const baseBasic = Number(salaryStructure.basic_salary) || 0;
    const bonus = overrides.bonus !== undefined ? Number(overrides.bonus) : 0;
    const overtimeAmount = overrides.overtime_amount !== undefined ? Number(overrides.overtime_amount) : 0;
    const pfDeduction = Number(salaryStructure.pf_deduction) || 0;
    const advanceDeduction = overrides.advance_deduction !== undefined
        ? Number(overrides.advance_deduction)
        : (Number(salaryStructure.advance_deduction) || 0);
    const otherDeductions = overrides.other_deductions !== undefined
        ? Number(overrides.other_deductions)
        : (Number(salaryStructure.other_deduction) || 0);

    // Case A: Staff has NOT joined yet for this payroll period (month is prior to joining date)
    const isPreJoining = dojYear !== null && (year < dojYear || (year === dojYear && month < dojMonth));
    if (isPreJoining) {
        return {
            staff_id: staff.id,
            user_id: staff.user_id,
            academy_id: staff.academy_id,
            branch_id: staff.branch_id,
            staff_name: `${staff.first_name} ${staff.last_name}`.trim(),
            appointment_no: staff.appointment_no,
            role_name: staff.role_name,
            salary_structure_id: salaryStructure.id,
            salary_month: month,
            salary_year: year,
            date_of_joining: dojStr,
            is_joining_month: false,
            is_pre_joining: true,
            joining_start_day: null,
            total_month_days: daysInMonth,
            working_days: 0,
            present_days: 0,
            absent_days: 0,
            paid_leaves: 0,
            half_days: 0,
            weekly_off_days: 0,
            base_gross_salary: baseGross,
            basic_salary: 0,
            allowances: 0,
            bonus: 0,
            overtime_amount: 0,
            gross_salary: 0,
            pf_deduction: 0,
            advance_deduction: 0,
            other_deductions: 0,
            deductions: 0,
            net_salary: 0,
            remarks: `Staff joined on ${dojStr}; not employed during ${month}/${year}.`,
        };
    }

    // 3. Total Month Days & Weekly Offs
    // Business Rule: "week off ko bhi working day me add hoga"
    // Base days in month = daysInMonth (30, 31, 28, or 29 depending on month)
    let weeklyOffDaysList = [];
    if (staff.user_id) {
        const [wOffRows] = await connection.query(
            `SELECT day_of_week FROM cst_user_weekly_off WHERE user_id = ? AND status = 1`,
            [staff.user_id]
        );
        weeklyOffDaysList = wOffRows.map((r) => r.day_of_week);
    }
    if (weeklyOffDaysList.length === 0) {
        weeklyOffDaysList = ["Sunday"]; // Standard default
    }

    // Case B: The Joining Month (First month of employment)
    const isJoiningMonth = dojYear !== null && (year === dojYear && month === dojMonth);
    const startDay = isJoiningMonth ? Math.min(Math.max(1, dojDay), daysInMonth) : 1;

    // Active employment base days in this month
    const totalBaseDays = isJoiningMonth ? (daysInMonth - startDay + 1) : daysInMonth;

    // Count weekly off days in the active window (for auditing and paid week off tracking)
    let weeklyOffCount = 0;
    for (let d = startDay; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month - 1, d);
        const dayName = FULL_WEEKDAY_NAMES[dateObj.getDay()];
        if (weeklyOffDaysList.includes(dayName)) {
            weeklyOffCount++;
        }
    }

    // 4. Fetch Attendance records from api/attendance (cst_attendance) strictly from startDay to daysInMonth
    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let absentCount = 0;

    if (staff.user_id) {
        const startDate = `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

        const [attRows] = await connection.query(
            `SELECT attendance_date, attendance_status 
             FROM cst_attendance 
             WHERE user_id = ? AND attendance_date BETWEEN ? AND ?`,
            [staff.user_id, startDate, endDate]
        );

        attRows.forEach((r) => {
            const st = r.attendance_status;
            if (st === "Present") presentCount++;
            else if (st === "Late") lateCount++;
            else if (st === "Half Day") halfDayCount++;
            else if (st === "Leave") leaveCount++;
            else if (st === "Absent") absentCount++;
        });
    }

    // Attendance Deduction Policy:
    // Absent = 1.0 day deducted
    // Leave = 1.0 day deducted
    // Half Day = 0.5 day deducted
    // Late = 0.25 day deducted
    // Week off = 0.0 deducted (included in working days as paid)
    const absentDays = overrides.absent_days !== undefined ? Number(overrides.absent_days) : absentCount;
    const leaveDays = overrides.paid_leaves !== undefined ? Number(overrides.paid_leaves) : leaveCount;
    const halfDays = overrides.half_days !== undefined ? Number(overrides.half_days) : halfDayCount;
    const lateDays = overrides.late_days !== undefined ? Number(overrides.late_days) : lateCount;

    const totalDeductedDays = Math.round(((absentDays * 1.0) + (leaveDays * 1.0) + (halfDays * 0.5) + (lateDays * 0.25)) * 100) / 100;

    // Total base working days (including week offs)
    const totalWorkingDays = overrides.working_days !== undefined
        ? Number(overrides.working_days)
        : totalBaseDays;

    // Effective working days after deductions
    const payableWorkingDays = overrides.present_days !== undefined
        ? Number(overrides.present_days)
        : Math.max(0, Math.round((totalWorkingDays - totalDeductedDays) * 100) / 100);

    // 5. Salary Calculation on Working Days:
    // Daily Gross Rate = Base Gross / Total Days in Month (30, 31, 28, or 29)
    // Formula: (Salary / daysInMonth) * workingDays
    // Example: (30000 / 30) * 28.5 = 28500
    const dailyRate = daysInMonth > 0 ? (baseGross / daysInMonth) : 0;
    const earnedGross = Math.min(baseGross, Math.round(dailyRate * payableWorkingDays * 100) / 100);

    // Prorated Basic and Allowances
    const proratedBasic = daysInMonth > 0
        ? Math.round((baseBasic / daysInMonth) * payableWorkingDays * 100) / 100
        : 0;
    const proratedAllowances = Math.max(0, Math.round((earnedGross - proratedBasic) * 100) / 100);

    // Deductions: Prorated PF for worked days
    const calculatedPF = daysInMonth > 0
        ? Math.round((pfDeduction / daysInMonth) * payableWorkingDays * 100) / 100
        : pfDeduction;

    const totalDeductions = calculatedPF + advanceDeduction + otherDeductions;
    const netSalary = Math.max(0, Math.round((earnedGross + bonus + overtimeAmount - totalDeductions) * 100) / 100);

    return {
        staff_id: staff.id,
        user_id: staff.user_id,
        academy_id: staff.academy_id,
        branch_id: staff.branch_id,
        staff_name: `${staff.first_name} ${staff.last_name}`.trim(),
        appointment_no: staff.appointment_no,
        role_name: staff.role_name,
        salary_structure_id: salaryStructure.id,
        salary_month: month,
        salary_year: year,
        date_of_joining: dojStr,
        is_joining_month: isJoiningMonth,
        is_pre_joining: false,
        joining_start_day: isJoiningMonth ? startDay : null,
        total_month_days: daysInMonth,
        working_days: totalWorkingDays,
        present_days: payableWorkingDays,
        absent_days: absentDays,
        late_days: lateDays,
        half_days: halfDays,
        paid_leaves: leaveDays,
        deducted_days: totalDeductedDays,
        weekly_off_days: weeklyOffCount,
        daily_rate: Math.round(dailyRate * 100) / 100,
        base_gross_salary: baseGross,
        basic_salary: proratedBasic,
        allowances: proratedAllowances,
        bonus,
        overtime_amount: overtimeAmount,
        gross_salary: earnedGross,
        pf_deduction: calculatedPF,
        advance_deduction: advanceDeduction,
        other_deductions: otherDeductions,
        deductions: totalDeductions,
        net_salary: netSalary,
        remarks: isJoiningMonth
            ? `First month payroll calculated from Date of Joining: ${dojStr} (Day ${startDay}). Deductions: Abs ${absentDays}d, Late ${lateDays}d, Half ${halfDays}d, Leave ${leaveDays}d.`
            : `Payroll calculated: ${payableWorkingDays}/${totalWorkingDays} working days. Deductions: Abs ${absentDays}d, Late ${lateDays}d, Half ${halfDays}d, Leave ${leaveDays}d.`,
    };
}

// =========================================================================
// GET: List Salary Payments (Admin only)
// =========================================================================
export async function GET(request) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json({ success: false, message: "Forbidden. Insufficient permissions." }, { status: 403 });
        }

        connection = await pool.getConnection();
        const { searchParams } = new URL(request.url);

        let academy_id = searchParams.get("academy_id");
        let branch_id = searchParams.get("branch_id");
        const staff_id = searchParams.get("staff_id");
        const month = searchParams.get("month") || searchParams.get("salary_month");
        const year = searchParams.get("year") || searchParams.get("salary_year");
        const payment_status = searchParams.get("payment_status");
        const search = (searchParams.get("search") || "").trim();

        // Multi-Tenant Isolation
        if (authUser.isSuperAdmin) {
            // Unrestricted
        } else if (authUser.isAcademyAdmin) {
            if (academy_id && String(academy_id) !== String(authUser.academy_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Academy Admin cannot access another academy's records." },
                    { status: 403 }
                );
            }
            academy_id = authUser.academy_id;
        } else if (authUser.isBranchAdmin) {
            if (branch_id && String(branch_id) !== String(authUser.branch_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Branch Admin cannot access another branch's records." },
                    { status: 403 }
                );
            }
            branch_id = authUser.branch_id;
            academy_id = authUser.academy_id;
        }

        const where = ["p.id IS NOT NULL"];
        const params = [];

        if (academy_id) {
            where.push("p.academy_id = ?");
            params.push(academy_id);
        }
        if (branch_id) {
            where.push("p.branch_id = ?");
            params.push(branch_id);
        }
        if (staff_id) {
            where.push("p.staff_id = ?");
            params.push(staff_id);
        }
        if (month) {
            where.push("p.salary_month = ?");
            params.push(month);
        }
        if (year) {
            where.push("p.salary_year = ?");
            params.push(year);
        }
        if (payment_status) {
            where.push("p.payment_status = ?");
            params.push(payment_status);
        }
        if (search) {
            where.push("(s.first_name LIKE ? OR s.last_name LIKE ? OR s.appointment_no LIKE ? OR r.role_name LIKE ?)");
            const q = `%${search}%`;
            params.push(q, q, q, q);
        }

        const sql = `
            SELECT 
                p.*,
                s.appointment_no,
                s.first_name,
                s.last_name,
                s.user_id,
                s.date_of_joining,
                r.role_name,
                a.academy_name,
                b.branch_name,
                sal.gross_salary AS full_base_salary,
                sal.pf_deduction AS base_pf_deduction,
                sal.advance_deduction AS base_advance_deduction,
                u.email,
                u.phone
            FROM cst_staff_salary_payments p
            JOIN cst_staff s ON s.id = p.staff_id
            LEFT JOIN cst_roles r ON r.id = s.role_id
            LEFT JOIN cst_staff_salary sal ON sal.id = p.salary_structure_id
            LEFT JOIN cst_academy a ON a.id = p.academy_id
            LEFT JOIN cst_branch b ON b.id = p.branch_id
            LEFT JOIN cst_users u ON u.id = s.user_id
            WHERE ${where.join(" AND ")}
            ORDER BY p.salary_year DESC, p.salary_month DESC, p.id DESC
        `;

        const [rows] = await connection.query(sql, params);
        return NextResponse.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("GET /api/staff-salary-payments error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// =========================================================================
// POST: Calculate & Generate Staff Salary Payments (Single or Bulk Month)
// =========================================================================
export async function POST(request) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json({ success: false, message: "Forbidden. Insufficient permissions." }, { status: 403 });
        }

        const body = await request.json();
        const action = body.action || "generate"; // "generate" | "generate_bulk"
        const month = Number(body.salary_month || body.month);
        const year = Number(body.salary_year || body.year);

        if (!month || month < 1 || month > 12 || !year || year < 2000) {
            return NextResponse.json(
                { success: false, message: "Valid salary_month (1-12) and salary_year (YYYY) are required." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Mode 1: Bulk Generation for all configured staff in a Branch
        if (action === "generate_bulk") {
            let academy_id = body.academy_id;
            let branch_id = body.branch_id;

            if (authUser.isBranchAdmin) {
                branch_id = authUser.branch_id;
                academy_id = authUser.academy_id;
            } else if (authUser.isAcademyAdmin) {
                academy_id = authUser.academy_id;
            }

            if (!branch_id) {
                return NextResponse.json({ success: false, message: "branch_id is required for bulk generation." }, { status: 400 });
            }

            // Get all active staff who have an active salary structure in this branch
            const [staffList] = await connection.query(
                `SELECT s.id 
                 FROM cst_staff s
                 JOIN cst_staff_salary sal ON sal.staff_id = s.id AND sal.status = 'Active'
                 WHERE s.branch_id = ? AND s.is_deleted = 0`,
                [branch_id]
            );

            if (staffList.length === 0) {
                return NextResponse.json(
                    { success: false, message: "No active staff with salary structures found in this branch." },
                    { status: 404 }
                );
            }

            const results = [];
            for (const st of staffList) {
                const payroll = await calculateStaffPayroll(connection, st.id, month, year);

                // Upsert into cst_staff_salary_payments
                await connection.query(
                    `INSERT INTO cst_staff_salary_payments (
                        academy_id, branch_id, staff_id, salary_structure_id,
                        salary_month, salary_year, total_month_days, working_days, present_days, absent_days, late_days, half_days, paid_leaves,
                        basic_salary, allowances, bonus, overtime_amount, gross_salary,
                        deductions, advance_deduction, net_salary, paid_amount, due_amount,
                        payment_status, remarks
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'Pending', 'Auto-generated payroll based on working days')
                    ON DUPLICATE KEY UPDATE 
                        total_month_days = VALUES(total_month_days),
                        working_days = VALUES(working_days),
                        present_days = VALUES(present_days),
                        absent_days = VALUES(absent_days),
                        late_days = VALUES(late_days),
                        half_days = VALUES(half_days),
                        paid_leaves = VALUES(paid_leaves),
                        gross_salary = VALUES(gross_salary),
                        deductions = VALUES(deductions),
                        advance_deduction = VALUES(advance_deduction),
                        net_salary = VALUES(net_salary),
                        due_amount = VALUES(net_salary) - paid_amount,
                        payment_status = CASE 
                            WHEN (VALUES(net_salary) - paid_amount) <= 0 AND paid_amount > 0 THEN 'Paid'
                            WHEN paid_amount > 0 THEN 'Partial'
                            ELSE 'Pending'
                        END`,
                    [
                        payroll.academy_id, payroll.branch_id, payroll.staff_id, payroll.salary_structure_id,
                        month, year, payroll.total_month_days, payroll.working_days, payroll.present_days, payroll.absent_days,
                        payroll.late_days, payroll.half_days, payroll.paid_leaves,
                        payroll.basic_salary, payroll.allowances, payroll.bonus, payroll.overtime_amount, payroll.gross_salary,
                        payroll.deductions, payroll.advance_deduction, payroll.net_salary, payroll.net_salary
                    ]
                );
                results.push(payroll);
            }

            await connection.commit();
            return NextResponse.json({
                success: true,
                message: `Payroll successfully generated for ${results.length} staff members for ${month}/${year}.`,
                count: results.length,
                data: results,
            });
        }

        // Mode 2: Single Staff Payroll Generation / Recalculation
        const staff_id = body.staff_id;
        if (!staff_id) {
            return NextResponse.json({ success: false, message: "staff_id is required." }, { status: 400 });
        }

        // Verify Staff & Multi-Tenant Boundary
        const [stCheck] = await connection.query(`SELECT academy_id, branch_id FROM cst_staff WHERE id = ? AND is_deleted = 0`, [staff_id]);
        if (stCheck.length === 0) {
            return NextResponse.json({ success: false, message: "Staff member not found." }, { status: 404 });
        }

        if (authUser.isBranchAdmin && String(stCheck[0].branch_id) !== String(authUser.branch_id)) {
            return NextResponse.json({ success: false, message: "Forbidden. Cannot calculate salary for another branch." }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && String(stCheck[0].academy_id) !== String(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden. Cannot calculate salary for another academy." }, { status: 403 });
        }

        const payroll = await calculateStaffPayroll(connection, staff_id, month, year, body);

        // Check if payment already exists to maintain paid_amount
        const [existingPay] = await connection.query(
            `SELECT id, paid_amount FROM cst_staff_salary_payments 
             WHERE staff_id = ? AND salary_month = ? AND salary_year = ? LIMIT 1`,
            [staff_id, month, year]
        );

        const currentPaid = existingPay.length > 0 ? Number(existingPay[0].paid_amount || 0) : 0;
        const dueAmount = Math.max(0, Math.round((payroll.net_salary - currentPaid) * 100) / 100);
        let paymentStatus = "Pending";
        if (dueAmount <= 0 && currentPaid > 0) {
            paymentStatus = "Paid";
        } else if (currentPaid > 0) {
            paymentStatus = "Partial";
        }

        const [insertRes] = await connection.query(
            `INSERT INTO cst_staff_salary_payments (
                academy_id, branch_id, staff_id, salary_structure_id,
                salary_month, salary_year, total_month_days, working_days, present_days, absent_days, late_days, half_days, paid_leaves,
                basic_salary, allowances, bonus, overtime_amount, gross_salary,
                deductions, advance_deduction, net_salary, paid_amount, due_amount,
                payment_status, remarks
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                total_month_days = VALUES(total_month_days),
                working_days = VALUES(working_days),
                present_days = VALUES(present_days),
                absent_days = VALUES(absent_days),
                late_days = VALUES(late_days),
                half_days = VALUES(half_days),
                paid_leaves = VALUES(paid_leaves),
                basic_salary = VALUES(basic_salary),
                allowances = VALUES(allowances),
                bonus = VALUES(bonus),
                gross_salary = VALUES(gross_salary),
                deductions = VALUES(deductions),
                advance_deduction = VALUES(advance_deduction),
                net_salary = VALUES(net_salary),
                due_amount = VALUES(net_salary) - paid_amount,
                payment_status = CASE 
                    WHEN (VALUES(net_salary) - paid_amount) <= 0 AND paid_amount > 0 THEN 'Paid'
                    WHEN paid_amount > 0 THEN 'Partial'
                    ELSE 'Pending'
                END,
                remarks = VALUES(remarks)`,
            [
                payroll.academy_id, payroll.branch_id, payroll.staff_id, payroll.salary_structure_id,
                month, year, payroll.total_month_days, payroll.working_days, payroll.present_days, payroll.absent_days,
                payroll.late_days, payroll.half_days, payroll.paid_leaves,
                payroll.basic_salary, payroll.allowances, payroll.bonus, payroll.overtime_amount, payroll.gross_salary,
                payroll.deductions, payroll.advance_deduction, payroll.net_salary, currentPaid, dueAmount,
                paymentStatus, body.remarks || "Calculated based on monthly working days and attendance"
            ]
        );

        await connection.commit();

        const paymentId = existingPay.length > 0 ? existingPay[0].id : insertRes.insertId;

        return NextResponse.json({
            success: true,
            message: `Staff salary calculated successfully based on ${payroll.present_days}/${payroll.working_days} working days.`,
            data: {
                id: paymentId,
                ...payroll,
                paid_amount: currentPaid,
                due_amount: dueAmount,
                payment_status: paymentStatus,
            },
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("POST /api/staff-salary-payments error:", err);
        return NextResponse.json(
            { success: false, message: "Payroll calculation failed: " + err.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
