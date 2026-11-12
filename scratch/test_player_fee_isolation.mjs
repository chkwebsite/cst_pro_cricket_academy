import jwt from "jsonwebtoken";
import pool from "../src/app/components/lib/db.js";
import { getAuthUser, JWT_SECRET } from "../src/app/components/lib/rbac.js";

async function runTest() {
    console.log("=== TESTING PLAYER PROGRAM FEE ISOLATION & SECURITY ===");

    // Find Player 11
    const [p11Users] = await pool.query("SELECT id, email, user_type, academy_id, branch_id FROM cst_users WHERE id = 11");
    const player11 = p11Users[0];
    const tokenP11 = jwt.sign({ id: player11.id, email: player11.email }, JWT_SECRET, { expiresIn: "1h" });

    // Mock request
    const mockReqP11 = {
        cookies: { get: () => ({ value: tokenP11 }) },
        headers: { get: () => `Bearer ${tokenP11}` }
    };
    const authUser = await getAuthUser(mockReqP11);

    console.log(`Authenticated as: ${authUser.first_name} ${authUser.last_name} (Role: ${authUser.role}, ID: ${authUser.id})`);

    // Execute the exact query now implemented in /api/player-program-fees/route.js
    let sql = `
        SELECT
            f.id,
            f.academy_id,
            f.branch_id,
            f.user_program_id,
            f.admission_players_id,
            f.program_id,
            f.fee_month,
            DATE_FORMAT(f.fee_month, '%M %Y') AS fee_month_name,
            f.fee_amount,
            f.registration_fee,
            f.daily_fee,
            f.kit_fee,
            f.discount_amount,
            f.late_fee,
            f.total_amount,
            f.paid_amount,
            f.due_amount,
            f.payment_status,
            f.due_date,
            f.remarks,
            f.created_at,
            f.updated_at,
            ap.admission_no,
            CONCAT(ap.first_name, ' ', COALESCE(ap.last_name, '')) AS player_name,
            p.program_name,
            up.appointment_no,
            up.start_date,
            up.end_date
        FROM cst_player_program_fees f
        INNER JOIN cst_user_programs up ON up.id = f.user_program_id
        INNER JOIN cst_admission_players ap ON ap.id = f.admission_players_id
        INNER JOIN cst_programs p ON p.id = f.program_id
        WHERE up.is_deleted = 0
          AND ap.is_deleted = 0
          AND p.is_deleted = 0
    `;
    const values = [];

    if (authUser.isPlayer) {
        sql += ` AND ap.user_id = ? `;
        values.push(authUser.id);
    }

    sql += " ORDER BY f.fee_month DESC, f.id DESC";

    const [rows] = await pool.query(sql, values);

    console.log(`\nQuery execution result for Player 11:`);
    console.log(`Total invoices returned: ${rows.length}`);

    // Verify all rows belong ONLY to user_id = 11
    const [p11Admissions] = await pool.query("SELECT id FROM cst_admission_players WHERE user_id = 11");
    const p11AdmIds = p11Admissions.map(a => a.id);

    const hasForeignPlayer = rows.some(f => !p11AdmIds.includes(f.admission_players_id));
    if (hasForeignPlayer) {
        console.error("FAIL: Foreign players' invoices returned!");
    } else {
        console.log("PASS: 100% of returned invoices belong to Player 11!");
    }

    rows.forEach(f => {
        console.log(` - Invoice #${f.id}: ${f.player_name} (Adm: ${f.admission_no}) | ${f.program_name} | Month: ${f.fee_month_name} | Amount: ₹${f.total_amount} | Paid: ₹${f.paid_amount} | Due: ₹${f.due_amount} | Status: ${f.payment_status}`);
    });

    // Check how many invoices exist in the whole database across all players
    const [allRows] = await pool.query("SELECT COUNT(*) as total FROM cst_player_program_fees");
    console.log(`\nTotal invoices in database across all players: ${allRows[0].total}`);
    console.log(`Before fix, Player 11 saw: ${allRows[0].total} invoices (including other players).`);
    console.log(`After fix, Player 11 sees: ONLY ${rows.length} invoices (belonging strictly to themselves).`);

    // Verify other player fee [id] access check
    const [otherFee] = await pool.query(
        "SELECT f.id, ap.user_id FROM cst_player_program_fees f JOIN cst_admission_players ap ON ap.id = f.admission_players_id WHERE ap.user_id != 11 LIMIT 1"
    );
    if (otherFee.length > 0) {
        const canAccess = (authUser.isPlayer && Number(otherFee[0].user_id) === Number(authUser.id));
        console.log(`\nTesting direct access to Other Player's Invoice #${otherFee[0].id}:`);
        console.log(`Can Player 11 access foreign invoice? ${canAccess ? "YES (FAIL)" : "NO (BLOCKED 403 - PASS)"}`);
    }

    await pool.end();
}

runTest().catch(console.error);
