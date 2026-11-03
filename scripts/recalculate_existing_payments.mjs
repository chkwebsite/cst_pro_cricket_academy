import pool from "../src/app/components/lib/db.js";
import { calculateStaffPayroll } from "../src/app/api/staff-salary-payments/route.js";

async function main() {
    console.log("===============================================================");
    console.log("RECALCULATING EXISTING PAYROLL WITH NEW ATTENDANCE RULES");
    console.log("Rules:");
    console.log("1. Base days = daysInMonth (week offs included in working days)");
    console.log("2. Absent = -1.0d, Leave = -1.0d, Half Day = -0.5d, Late = -0.25d");
    console.log("3. Salary = (baseGross / daysInMonth) * workingDays");
    console.log("===============================================================");

    const connection = await pool.getConnection();

    try {
        const [payments] = await connection.query(
            `SELECT p.id, p.staff_id, p.salary_month, p.salary_year, p.paid_amount,
                    s.first_name, s.last_name, sal.gross_salary AS full_base_salary
             FROM cst_staff_salary_payments p
             JOIN cst_staff s ON s.id = p.staff_id
             JOIN cst_staff_salary sal ON sal.id = p.salary_structure_id
             ORDER BY p.id`
        );

        console.log(`Found ${payments.length} payment records to update.`);

        for (const pay of payments) {
            console.log(`\nRecalculating for ${pay.first_name} ${pay.last_name} (Payment #${pay.id}, ${pay.salary_month}/${pay.salary_year})...`);
            
            // Recalculate
            const payroll = await calculateStaffPayroll(connection, pay.staff_id, pay.salary_month, pay.salary_year);
            
            const currentPaid = Number(pay.paid_amount || 0);
            const dueAmount = Math.max(0, Math.round((payroll.net_salary - currentPaid) * 100) / 100);
            let paymentStatus = "Pending";
            if (dueAmount <= 0 && currentPaid > 0) {
                paymentStatus = "Paid";
            } else if (currentPaid > 0) {
                paymentStatus = "Partial";
            }

            await connection.query(
                `UPDATE cst_staff_salary_payments SET
                    total_month_days = ?,
                    working_days = ?,
                    present_days = ?,
                    absent_days = ?,
                    late_days = ?,
                    half_days = ?,
                    paid_leaves = ?,
                    basic_salary = ?,
                    allowances = ?,
                    gross_salary = ?,
                    deductions = ?,
                    advance_deduction = ?,
                    net_salary = ?,
                    due_amount = ?,
                    payment_status = ?,
                    remarks = ?
                 WHERE id = ?`,
                [
                    payroll.total_month_days,
                    payroll.working_days,
                    payroll.present_days,
                    payroll.absent_days,
                    payroll.late_days,
                    payroll.half_days,
                    payroll.paid_leaves,
                    payroll.basic_salary,
                    payroll.allowances,
                    payroll.gross_salary,
                    payroll.deductions,
                    payroll.advance_deduction,
                    payroll.net_salary,
                    dueAmount,
                    paymentStatus,
                    payroll.remarks || "Calculated based on monthly working days and attendance",
                    pay.id
                ]
            );

            console.log(`✓ Updated #${pay.id} (${pay.first_name}): Base ₹${pay.full_base_salary} -> WD: ${payroll.present_days}/${payroll.working_days} Days -> Earned Gross: ₹${payroll.gross_salary}, Net: ₹${payroll.net_salary}`);
        }

        console.log("\n===============================================================");
        console.log("All existing payroll records successfully refreshed!");
        console.log("===============================================================");

        // Fetch and display the updated branch 2 records (from user's screenshot)
        const [updatedBranch2] = await connection.query(
            `SELECT p.id, s.first_name, s.last_name, sal.gross_salary AS base_monthly,
                    p.working_days, p.present_days, p.absent_days, p.late_days, p.half_days,
                    p.gross_salary AS prorated_gross, p.deductions, p.advance_deduction, p.net_salary
             FROM cst_staff_salary_payments p
             JOIN cst_staff s ON s.id = p.staff_id
             JOIN cst_staff_salary sal ON sal.id = p.salary_structure_id
             WHERE p.branch_id = 2 AND p.salary_month = 11 AND p.salary_year = 2026`
        );
        console.log("\nUpdated Branch 2 Records (as seen in screenshot):");
        console.table(updatedBranch2);
    } finally {
        connection.release();
        process.exit(0);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
