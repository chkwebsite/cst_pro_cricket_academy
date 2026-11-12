import pool from "../src/app/components/lib/db.js";

async function run() {
    const [salaries] = await pool.query(`
        SELECT sal.id, sal.staff_id, s.first_name, s.last_name, sal.gross_salary, sal.basic_salary, sal.hra, sal.conveyance_allowance, sal.other_allowance, sal.pf_deduction, sal.advance_deduction, sal.net_salary
        FROM cst_staff_salary sal
        JOIN cst_staff s ON s.id = sal.staff_id
    `);
    console.log("=== Seeded Salaries ===");
    console.table(salaries);

    const [payments] = await pool.query(`
        SELECT p.id, p.staff_id, s.first_name, s.last_name, p.salary_month, p.salary_year, p.working_days, p.present_days, p.gross_salary, p.net_salary, p.paid_amount, p.payment_status
        FROM cst_staff_salary_payments p
        JOIN cst_staff s ON s.id = p.staff_id
    `);
    console.log("=== Seeded Salary Payments ===");
    console.table(payments);

    const [txs] = await pool.query(`
        SELECT t.id, t.salary_payment_id, t.transaction_no, t.amount, t.payment_mode, t.payment_date
        FROM cst_staff_salary_transactions t
    `);
    console.log("=== Seeded Transactions ===");
    console.table(txs);

    process.exit(0);
}
run();
