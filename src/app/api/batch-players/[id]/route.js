import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// GET: Single player assignment by id
export async function GET(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const id = params?.id;

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Player assignment id is required" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
            SELECT
                bp.*,
                b.batch_name,
                b.batch_code,
                b.academy_id,
                b.branch_id,
                b.program_id,
                b.age_group_id,
                b.start_time,
                b.end_time,
                b.training_days,
                up.user_id,
                up.appointment_no,
                up.program_id AS enrollment_program_id,
                up.branch_id AS enrollment_branch_id,
                up.admission_players_id,
                ap.admission_no,
                ap.first_name,
                ap.last_name,
                ap.father_name,
                ap.phone,
                ap.email,
                p.program_name,
                a.academy_name,
                br.branch_code
            FROM cst_batch_players bp
            INNER JOIN cst_batches b ON b.id = bp.batch_id
            INNER JOIN cst_user_programs up ON up.id = bp.user_program_id
            INNER JOIN cst_admission_players ap ON ap.id = up.admission_players_id
            INNER JOIN cst_programs p ON p.id = up.program_id
            INNER JOIN cst_academy a ON a.id = b.academy_id
            INNER JOIN cst_branch br ON br.id = b.branch_id
            WHERE bp.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Player batch assignment not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET batch player [id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch player batch assignment", error: error.message },
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
