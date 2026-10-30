import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

// GET: Single batch by id with coaches and players count
export async function GET(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const id = params?.id;

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Batch id is required" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
            SELECT
                b.*,
                a.academy_name,
                br.branch_name,
                br.branch_code,
                p.program_name,
                ag.age_group AS age_group_name,
                ag.min_age,
                ag.max_age
            FROM cst_batches b
            INNER JOIN cst_academy a ON a.id = b.academy_id
            INNER JOIN cst_branch br ON br.id = b.branch_id
            INNER JOIN cst_programs p ON p.id = b.program_id
            INNER JOIN cst_age_groups ag ON ag.id = b.age_group_id
            WHERE b.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Batch not found" },
                { status: 404 }
            );
        }

        const authUser = await getAuthUser(request);
        if (authUser && !authUser.isSuperAdmin) {
            if (authUser.isAcademyAdmin && authUser.academy_id && Number(rows[0].academy_id) !== Number(authUser.academy_id)) {
                return NextResponse.json({ success: false, message: "Batch not found or access denied" }, { status: 403 });
            }
            if (authUser.isBranchAdmin && authUser.branch_id && Number(rows[0].branch_id) !== Number(authUser.branch_id)) {
                return NextResponse.json({ success: false, message: "Access denied: Batch belongs to another branch" }, { status: 403 });
            }
        }

        const batch = rows[0];

        // Fetch active assigned coaches
        const [coaches] = await connection.query(
            `
            SELECT
                bc.id AS assignment_id,
                bc.coach_role,
                bc.start_date,
                bc.end_date,
                bc.status,
                bc.remarks,
                u.id AS coach_user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.appointment_no
            FROM cst_batch_coaches bc
            INNER JOIN cst_users u ON u.id = bc.coach_user_id
            WHERE bc.batch_id = ? AND bc.is_deleted = 0
            ORDER BY bc.status DESC, bc.id DESC
            `,
            [id]
        );

        // Fetch assigned players
        const [players] = await connection.query(
            `
            SELECT
                bp.id AS assignment_id,
                bp.start_date,
                bp.end_date,
                bp.status,
                bp.remarks,
                up.id AS user_program_id,
                up.appointment_no,
                ap.id AS admission_players_id,
                ap.admission_no,
                ap.first_name,
                ap.last_name,
                ap.father_name,
                ap.phone,
                ap.email
            FROM cst_batch_players bp
            INNER JOIN cst_user_programs up ON up.id = bp.user_program_id
            INNER JOIN cst_admission_players ap ON ap.id = up.admission_players_id
            WHERE bp.batch_id = ?
            ORDER BY bp.status = 'Active' DESC, bp.id DESC
            `,
            [id]
        );

        const activePlayerCount = players.filter(p => p.status === 'Active').length;
        const activeCoachCount = coaches.filter(c => Number(c.status) === 1).length;

        return NextResponse.json({
            success: true,
            data: {
                ...batch,
                active_players_count: activePlayerCount,
                active_coaches_count: activeCoachCount,
                coaches,
                players,
            },
        });
    } catch (error) {
        console.error("GET batch [id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch batch", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Forward to root PUT with id injected
export async function PUT(request, context) {
    const params = await context?.params;
    const id = params?.id;
    const body = await request.json();
    body.id = id;

    // Use root handler
    const { PUT: rootPut } = await import("../route.js");
    const fakeRequest = new Request(request.url, {
        method: "PUT",
        headers: request.headers,
        body: JSON.stringify(body),
    });
    return rootPut(fakeRequest);
}

// DELETE: Forward to root DELETE with id
export async function DELETE(request, context) {
    const params = await context?.params;
    const id = params?.id;

    const url = new URL(request.url);
    url.searchParams.set("id", id);

    const { DELETE: rootDelete } = await import("../route.js");
    const fakeRequest = new Request(url.toString(), {
        method: "DELETE",
        headers: request.headers,
    });
    return rootDelete(fakeRequest);
}
