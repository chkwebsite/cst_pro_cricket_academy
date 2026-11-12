import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// GET: Single coach assignment by id
export async function GET(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const id = params?.id;

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Coach assignment id is required" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
            SELECT
                bc.*,
                b.batch_name,
                b.batch_code,
                b.academy_id,
                b.branch_id,
                b.program_id,
                b.age_group_id,
                b.start_time,
                b.end_time,
                b.training_days,
                u.first_name AS coach_first_name,
                u.last_name AS coach_last_name,
                u.appointment_no,
                u.email AS coach_email,
                u.phone AS coach_phone
            FROM cst_batch_coaches bc
            INNER JOIN cst_batches b ON b.id = bc.batch_id
            INNER JOIN cst_users u ON u.id = bc.coach_user_id
            WHERE bc.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Coach assignment not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET batch coach [id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch coach assignment", error: error.message },
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
