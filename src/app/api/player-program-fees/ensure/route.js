import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

export const dynamic = "force-dynamic";

async function handleEnsure(userProgramIdRaw, feeMonthRaw, amountRaw) {
    const user_program_id = Number(userProgramIdRaw);
    if (!Number.isInteger(user_program_id) || user_program_id <= 0) {
        return { error: "Valid user_program_id is required", status: 400 };
    }

    if (!feeMonthRaw) {
        return { error: "fee_month is required (YYYY-MM or YYYY-MM-DD)", status: 400 };
    }

    // Normalize to YYYY-MM-01
    const monthStr = String(feeMonthRaw).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
        return { error: "Invalid fee_month format. Use YYYY-MM or YYYY-MM-DD", status: 400 };
    }
    const normalizedFeeMonth = `${monthStr}-01`;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if invoice already exists
        const [existing] = await connection.query(
            `
            SELECT
                f.id,
                f.academy_id,
                f.branch_id,
                f.user_program_id,
                f.admission_players_id,
                f.program_id,
                f.fee_month,
                f.total_amount,
                f.paid_amount,
                f.due_amount,
                f.payment_status,
                ap.admission_no,
                CONCAT_WS(' ', ap.first_name, ap.last_name) AS player_name,
                p.program_name
            FROM cst_player_program_fees f
            INNER JOIN cst_admission_players ap ON ap.id = f.admission_players_id
            INNER JOIN cst_programs p ON p.id = f.program_id
            WHERE f.user_program_id = ?
              AND f.fee_month = ?
            LIMIT 1
            `,
            [user_program_id, normalizedFeeMonth]
        );

        if (existing.length > 0) {
            await connection.commit();
            return {
                data: {
                    success: true,
                    message: "Fee invoice already exists.",
                    fee_id: existing[0].id,
                    data: existing[0],
                },
                status: 200,
            };
        }

        // 2. Fetch active enrollment details
        const [enrollments] = await connection.query(
            `
            SELECT
                up.id AS user_program_id,
                up.branch_id,
                up.admission_players_id,
                up.program_id,
                up.start_date,
                up.end_date,
                p.academy_id,
                p.program_name,
                p.program_fee,
                p.registration_fee,
                ap.admission_no,
                CONCAT_WS(' ', ap.first_name, ap.last_name) AS player_name
            FROM cst_user_programs up
            INNER JOIN cst_programs p ON p.id = up.program_id
            INNER JOIN cst_admission_players ap ON ap.id = up.admission_players_id
            WHERE up.id = ?
              AND up.is_deleted = 0
            LIMIT 1
            `,
            [user_program_id]
        );

        if (enrollments.length === 0) {
            await connection.rollback();
            return { error: "Player enrollment not found.", status: 404 };
        }

        const en = enrollments[0];

        // Determine fee amount
        let finalAmount = 0;
        if (amountRaw !== undefined && amountRaw !== null && amountRaw !== "" && Number(amountRaw) > 0) {
            finalAmount = Number(amountRaw);
        } else {
            finalAmount = Number(en.program_fee) || 0;
        }

        const dueDate = `${monthStr}-10`; // Default due date: 10th of the billing month

        const [result] = await connection.query(
            `
            INSERT INTO cst_player_program_fees (
                academy_id,
                branch_id,
                user_program_id,
                admission_players_id,
                program_id,
                fee_month,
                fee_amount,
                registration_fee,
                daily_fee,
                kit_fee,
                discount_amount,
                late_fee,
                total_amount,
                paid_amount,
                due_amount,
                payment_status,
                due_date,
                remarks
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0.00, 0.00, ?, 0.00, ?, 'Pending', ?, 'Generated from fees matrix'
            )
            `,
            [
                en.academy_id,
                en.branch_id,
                en.user_program_id,
                en.admission_players_id,
                en.program_id,
                normalizedFeeMonth,
                finalAmount,
                finalAmount,
                finalAmount,
                dueDate,
            ]
        );

        const newId = result.insertId;

        await connection.commit();

        return {
            data: {
                success: true,
                message: "Fee invoice created successfully.",
                fee_id: newId,
                data: {
                    id: newId,
                    academy_id: en.academy_id,
                    branch_id: en.branch_id,
                    user_program_id: en.user_program_id,
                    admission_players_id: en.admission_players_id,
                    program_id: en.program_id,
                    fee_month: normalizedFeeMonth,
                    total_amount: finalAmount,
                    paid_amount: 0,
                    due_amount: finalAmount,
                    payment_status: "Pending",
                    admission_no: en.admission_no,
                    player_name: en.player_name,
                    program_name: en.program_name,
                },
            },
            status: 201,
        };
    } catch (err) {
        await connection.rollback();
        console.error("ensure player fee invoice error:", err);
        return { error: err.message || "Failed to ensure fee invoice", status: 500 };
    } finally {
        connection.release();
    }
}

export async function POST(request) {
    const authUser = await getAuthUser(request);
    if (authUser && (authUser.isCoach || authUser.isPlayer)) {
        return NextResponse.json(
            { success: false, message: "Coaches and Players do not have permission to generate fee invoices" },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const res = await handleEnsure(body.user_program_id, body.fee_month, body.amount);
        if (res.error) {
            return NextResponse.json({ success: false, message: res.error }, { status: res.status });
        }
        return NextResponse.json(res.data, { status: res.status });
    } catch (err) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}

export async function GET(request) {
    const authUser = await getAuthUser(request);
    if (authUser && (authUser.isCoach || authUser.isPlayer)) {
        return NextResponse.json(
            { success: false, message: "Coaches and Players do not have permission to generate fee invoices" },
            { status: 403 }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const user_program_id = searchParams.get("user_program_id");
        const fee_month = searchParams.get("fee_month");
        const amount = searchParams.get("amount");

        const res = await handleEnsure(user_program_id, fee_month, amount);
        if (res.error) {
            return NextResponse.json({ success: false, message: res.error }, { status: res.status });
        }
        return NextResponse.json(res.data, { status: res.status });
    } catch (err) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
