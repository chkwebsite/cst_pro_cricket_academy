import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { syncOnUserProgramInsert } from "@/app/components/lib/playerFlowSync.js";
import { getAuthenticatedUser, validateBranchBelongsToAcademy, validateProgramBelongsToAcademy } from "@/app/components/lib/tenant-isolation";

// =====================================================
// GET USER PROGRAMS
// GET /api/user-programs
// =====================================================
export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const user_id = searchParams.get("user_id");
        const program_id = searchParams.get("program_id");
        const branch_id = searchParams.get("branch_id");
        const academy_id = searchParams.get("academy_id");
        const admission_players_id = searchParams.get("admission_players_id");

        const status = searchParams.get("status");
        const search = searchParams.get("search");

        const page = Math.max(Number(searchParams.get("page") || 1), 1);
        const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 100);
        const offset = (page - 1) * limit;

        connection = await pool.getConnection();

        // =====================================================
        // WHERE
        // =====================================================
        let where = `
            WHERE up.is_deleted = 0
        `;
        const values = [];

        // Tenant Isolation
        if (!authUser.isSuperAdmin) {
            where += ` AND (p.academy_id = ? OR b.academy_id = ?) `;
            values.push(authUser.academy_id, authUser.academy_id);

            if (authUser.isPlayer) {
                where += ` AND up.user_id = ? `;
                values.push(authUser.id);
            } else if (authUser.isBranchAdmin) {
                where += ` AND up.branch_id = ? `;
                values.push(authUser.branch_id);
            } else if (!authUser.isAcademyAdmin) {
                // Staff / Coach
                const allowedBranches = authUser.assignedBranchIds || (authUser.branch_id ? [authUser.branch_id] : []);
                if (allowedBranches.length > 0) {
                    where += ` AND up.branch_id IN (?) `;
                    values.push(allowedBranches);
                } else {
                    where += ` AND 1 = 0 `;
                }
            } else {
                // Academy Admin can filter by branch
                if (branch_id) {
                    where += ` AND up.branch_id = ? `;
                    values.push(Number(branch_id));
                }
            }
        } else {
            // Super Admin
            if (academy_id) {
                where += ` AND (p.academy_id = ? OR b.academy_id = ?) `;
                values.push(Number(academy_id), Number(academy_id));
            }
            if (branch_id) {
                where += ` AND up.branch_id = ? `;
                values.push(Number(branch_id));
            }
        }

        // USER FILTER
        if (user_id && !authUser.isPlayer) {
            where += ` AND up.user_id = ? `;
            values.push(Number(user_id));
        }

        // ADMISSION PLAYER FILTER
        if (admission_players_id) {
            where += ` AND up.admission_players_id = ? `;
            values.push(Number(admission_players_id));
        }

        // STATUS FILTER
        if (status !== null && status !== "" && status !== undefined) {
            where += ` AND up.status = ? `;
            values.push(Number(status));
        }

        // SEARCH
        if (search && search.trim()) {
            const keyword = `%${search.trim()}%`;
            where += `
                AND (
                    CAST(up.id AS CHAR) LIKE ?
                    OR CAST(up.user_id AS CHAR) LIKE ?
                    OR CAST(up.program_id AS CHAR) LIKE ?
                    OR CAST(up.branch_id AS CHAR) LIKE ?
                    OR CAST(up.admission_players_id AS CHAR) LIKE ?
                    OR u.first_name LIKE ?
                    OR u.last_name LIKE ?
                    OR ap.admission_no LIKE ?
                    OR ap.first_name LIKE ?
                    OR ap.last_name LIKE ?
                    OR p.program_name LIKE ?
                    OR b.branch_name LIKE ?
                )
            `;
            values.push(
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        // =====================================================
        // COUNT
        // =====================================================
        const [countRows] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM cst_user_programs up
            LEFT JOIN cst_users u ON u.id = up.user_id
            LEFT JOIN cst_admission_players ap ON ap.id = up.admission_players_id
            LEFT JOIN cst_programs p ON p.id = up.program_id
            LEFT JOIN cst_branch b ON b.id = up.branch_id
            ${where}
            `,
            values
        );

        const total = Number(countRows[0]?.total || 0);

        // =====================================================
        // LIST
        // =====================================================
        const [rows] = await connection.query(
            `
            SELECT
                up.id,
                up.user_id,
                up.appointment_no,
                up.program_id,
                up.branch_id,
                up.admission_players_id,
                COALESCE(up.start_date, DATE(ap.created_at), DATE(up.created_at)) AS start_date,
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
            ${where}
            ORDER BY up.id DESC
            LIMIT ? OFFSET ?
            `,
            [...values, limit, offset]
        );

        return NextResponse.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("GET USER PROGRAMS ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to get user programs",
                error: error.message,
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
// CREATE USER PROGRAM
// POST /api/user-programs
// =====================================================
export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer || (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin)) {
        return NextResponse.json(
            { success: false, message: "Forbidden: You are not authorized to assign user programs" },
            { status: 403 }
        );
    }

    let connection;

    try {
        const body = await request.json();

        let {
            user_id,
            program_id,
            branch_id,
            admission_players_id,
            start_date,
            end_date,
            status,
        } = body;

        if (authUser.isBranchAdmin) {
            branch_id = authUser.branch_id;
        }

        if (!program_id) {
            return NextResponse.json(
                { success: false, message: "program_id is required" },
                { status: 400 }
            );
        }

        if (!branch_id) {
            return NextResponse.json(
                { success: false, message: "branch_id is required" },
                { status: 400 }
            );
        }

        if (!admission_players_id) {
            return NextResponse.json(
                { success: false, message: "admission_players_id is required" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Validate program belongs to authorized academy
        if (!authUser.isSuperAdmin) {
            const isProgramValid = await validateProgramBelongsToAcademy(connection, program_id, authUser.academy_id);
            if (!isProgramValid) {
                return NextResponse.json(
                    { success: false, message: "Program does not belong to your academy" },
                    { status: 400 }
                );
            }

            const isBranchValid = await validateBranchBelongsToAcademy(connection, branch_id, authUser.academy_id);
            if (!isBranchValid) {
                return NextResponse.json(
                    { success: false, message: "Branch does not belong to your academy" },
                    { status: 400 }
                );
            }
        }

        let appointment_no = null;
        if (admission_players_id) {
            let playerSql = `SELECT admission_no, branch_id FROM cst_admission_players WHERE id = ? AND is_deleted = 0`;
            const playerParams = [admission_players_id];
            if (!authUser.isSuperAdmin && authUser.isBranchAdmin) {
                playerSql += ` AND branch_id = ?`;
                playerParams.push(authUser.branch_id);
            }
            playerSql += ` LIMIT 1`;

            const [playerRows] = await connection.query(playerSql, playerParams);
            if (playerRows.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Player admission not found or belongs to another branch" },
                    { status: 404 }
                );
            }
            appointment_no = playerRows[0].admission_no;
        }

        const [result] = await connection.query(
            `
            INSERT INTO cst_user_programs (
                user_id,
                appointment_no,
                program_id,
                branch_id,
                admission_players_id,
                start_date,
                end_date,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                user_id || null,
                appointment_no,
                program_id,
                branch_id,
                admission_players_id,
                start_date || null,
                end_date || null,
                status !== undefined ? Number(status) : 1,
            ]
        );

        // Automatically sync fee invoice, initial payment (if any), and player attendance
        let syncResult = null;
        try {
            syncResult = await syncOnUserProgramInsert({
                connection,
                userProgramId: result.insertId,
                admissionPlayersId,
                programId,
                branchId,
                userId: user_id || null,
                startDate: start_date || null,
                endDate: end_date || null,
                status: status !== undefined ? Number(status) : 1,
                initialPayment:
                    body.paid_amount || body.initial_payment
                        ? {
                              paid_amount: Number(body.paid_amount || body.initial_payment),
                              payment_mode: body.payment_mode || "Cash",
                              transaction_no: body.transaction_no || null,
                              payment_remarks: body.payment_remarks || null,
                              discount_amount: Number(body.discount_amount || 0),
                              due_date: body.due_date || null,
                          }
                        : null,
            });
        } catch (syncErr) {
            console.error("USER PROGRAM FLOW SYNC ERROR:", syncErr);
        }

        return NextResponse.json(
            {
                success: true,
                message: "User program created successfully",
                data: { id: result.insertId, sync: syncResult },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST USER PROGRAM ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to create user program",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
