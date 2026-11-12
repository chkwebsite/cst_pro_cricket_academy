import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { syncOnUserProgramUpdate } from "@/app/components/lib/playerFlowSync.js";

// =====================================================
// GET SINGLE USER PROGRAM
// GET /api/user-programs/[id]
// =====================================================

export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User program ID is required"
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
            SELECT
                up.id,
                up.user_id,
                up.appointment_no,
                up.program_id,
                up.branch_id,
                up.admission_players_id,
                up.start_date,
                up.end_date,
                up.status,
                up.created_at,
                up.updated_at,

                u.first_name,
                u.last_name,

                p.program_name,
                p.program_fee,
                p.registration_fee,
                p.daily_fee,
                p.kit_fee,
                p.academy_id,
                ap.admission_no,
                CONCAT_WS(' ', ap.first_name, ap.last_name) AS player_name,
                b.branch_name

            FROM cst_user_programs up
            LEFT JOIN cst_users u ON u.id = up.user_id
            LEFT JOIN cst_admission_players ap ON ap.id = up.admission_players_id
            LEFT JOIN cst_programs p ON p.id = up.program_id
            LEFT JOIN cst_branch b ON b.id = up.branch_id
            WHERE up.id = ?
              AND up.is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User program not found"
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("GET SINGLE USER PROGRAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to get user program",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// =====================================================
// PUT USER PROGRAM
// PUT /api/user-programs/[id]
// =====================================================

export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User program ID is required"
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const {
            user_id,
            program_id,
            branch_id,
            admission_players_id,
            start_date,
            end_date,
            status
        } = body;

        connection = await pool.getConnection();

        let appointment_no = undefined;
        if (admission_players_id) {
            const [playerRows] = await connection.query(
                `SELECT admission_no FROM cst_admission_players WHERE id = ? LIMIT 1`,
                [admission_players_id]
            );
            if (playerRows.length > 0) {
                appointment_no = playerRows[0].admission_no;
            }
        }

        const updates = [];
        const values = [];

        if (user_id !== undefined) {
            updates.push("user_id = ?");
            values.push(user_id || null);
        }

        if (appointment_no !== undefined) {
            updates.push("appointment_no = ?");
            values.push(appointment_no);
        }

        if (program_id !== undefined) {
            updates.push("program_id = ?");
            values.push(program_id);
        }

        if (branch_id !== undefined) {
            updates.push("branch_id = ?");
            values.push(branch_id);
        }

        if (admission_players_id !== undefined) {
            updates.push("admission_players_id = ?");
            values.push(admission_players_id);
        }

        if (start_date !== undefined) {
            updates.push("start_date = ?");
            values.push(start_date || null);
        }

        if (end_date !== undefined) {
            updates.push("end_date = ?");
            values.push(end_date || null);
        }

        if (status !== undefined) {
            updates.push("status = ?");
            values.push(Number(status));
        }

        if (updates.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No fields to update"
                },
                { status: 400 }
            );
        }

        values.push(id);

        const [result] = await connection.query(
            `
            UPDATE cst_user_programs
            SET ${updates.join(", ")}
            WHERE id = ?
              AND is_deleted = 0
            `,
            values
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User program not found"
                },
                { status: 404 }
            );
        }

        // Automatically sync updated fees and attendance
        try {
            await syncOnUserProgramUpdate({
                connection,
                userProgramId: id,
                admissionPlayersId,
                programId: program_id,
                branchId: branch_id,
                userId: user_id,
                startDate: start_date,
                endDate: end_date,
                status,
                paymentInfo:
                    body.paid_amount || body.initial_payment
                        ? {
                              paid_amount: Number(body.paid_amount || body.initial_payment),
                              payment_mode: body.payment_mode || "Cash",
                              transaction_no: body.transaction_no || null,
                              remarks: body.payment_remarks || null,
                          }
                        : null,
            });
        } catch (syncErr) {
            console.error("USER PROGRAM UPDATE SYNC ERROR:", syncErr);
        }

        return NextResponse.json({
            success: true,
            message: "User program updated successfully"
        });

    } catch (error) {
        console.error("PUT USER PROGRAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update user program",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// =====================================================
// DELETE USER PROGRAM (Soft Delete)
// DELETE /api/user-programs/[id]
// =====================================================

export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User program ID is required"
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [result] = await connection.query(
            `
            UPDATE cst_user_programs
            SET is_deleted = 1
            WHERE id = ?
              AND is_deleted = 0
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User program not found"
                },
                { status: 404 }
            );
        }

        // Also cancel pending fees for this deleted program enrollment
        try {
            await connection.query(
                `UPDATE cst_player_program_fees
                 SET payment_status = 'Cancelled',
                     remarks = CONCAT(COALESCE(remarks, ''), ' [Enrollment deleted]')
                 WHERE user_program_id = ? AND payment_status = 'Pending'`,
                [id]
            );
        } catch (feeCancelErr) {
            console.error("FEE CANCEL ON DELETE ERROR:", feeCancelErr);
        }

        return NextResponse.json({
            success: true,
            message: "User program deleted successfully"
        });

    } catch (error) {
        console.error("DELETE USER PROGRAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete user program",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
}
