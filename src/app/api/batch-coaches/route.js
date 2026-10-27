import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: List batch coach assignments
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id");
        const batch_id = searchParams.get("batch_id");
        const coach_user_id = searchParams.get("coach_user_id");
        const coach_role = searchParams.get("coach_role");
        const status = searchParams.get("status");
        const is_deleted = searchParams.get("is_deleted") ?? "0";
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const search = searchParams.get("search");

        connection = await pool.getConnection();

        let sql = `
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
            INNER JOIN cst_batches b
                ON b.id = bc.batch_id
            INNER JOIN cst_users u
                ON u.id = bc.coach_user_id
            WHERE 1 = 1
    `;

        const params = [];

        if (id) {
            sql += " AND bc.id = ?";
            params.push(id);
        }

        if (batch_id) {
            sql += " AND bc.batch_id = ?";
            params.push(batch_id);
        }

        if (coach_user_id) {
            sql += " AND bc.coach_user_id = ?";
            params.push(coach_user_id);
        }

        if (coach_role) {
            sql += " AND bc.coach_role = ?";
            params.push(coach_role);
        }

        if (status !== null && status !== "") {
            sql += " AND bc.status = ?";
            params.push(status);
        }

        if (is_deleted !== "") {
            sql += " AND bc.is_deleted = ?";
            params.push(is_deleted);
        }

        if (academy_id) {
            sql += " AND b.academy_id = ?";
            params.push(academy_id);
        }

        if (branch_id) {
            sql += " AND b.branch_id = ?";
            params.push(branch_id);
        }

        if (search) {
            sql += `
AND(
    b.batch_name LIKE ?
    OR b.batch_code LIKE ?
    OR u.first_name LIKE ?
    OR u.last_name LIKE ?
    OR u.appointment_no LIKE ?
    OR u.email LIKE ?
                )
    `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        sql += " ORDER BY bc.id DESC";

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Batch coach assignments fetched successfully",
            total: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET batch coaches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch batch coach assignments",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// POST: Assign coach to batch
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            batch_id,
            coach_user_id,
            coach_role = "Head Coach",
            start_date,
            end_date = null,
            status = 1,
            remarks = null,
        } = body;

        if (!batch_id || !coach_user_id || !start_date) {
            return NextResponse.json(
                {
                    success: false,
                    message: "batch_id, coach_user_id and start_date are required",
                },
                { status: 400 }
            );
        }

        const validRoles = [
            "Head Coach",
            "Assistant Coach",
            "Fitness Coach",
            "Specialist Coach",
        ];

        if (!validRoles.includes(coach_role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid coach_role",
                },
                { status: 400 }
            );
        }

        if (end_date && end_date < start_date) {
            return NextResponse.json(
                {
                    success: false,
                    message: "end_date cannot be before start_date",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Verify batch is active
        const [batches] = await connection.query(
            `
                SELECT id
                FROM cst_batches
                WHERE id = ?
    AND status = 1
                  AND is_deleted = 0
                FOR UPDATE
    `,
            [batch_id]
        );

        if (batches.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Active batch not found",
                },
                { status: 404 }
            );
        }

        // Verify coach user exists and is active
        // Adjust the role condition according to your cst_roles/user-role schema.
        const [coaches] = await connection.query(
            `
                SELECT id
                FROM cst_users
                WHERE id = ?
    AND status = 1
                  AND is_deleted = 0
    `,
            [coach_user_id]
        );

        if (coaches.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Active coach user not found",
                },
                { status: 404 }
            );
        }

        // Prevent duplicate active assignment of the same coach to the same batch
        const [existing] = await connection.query(
            `
                SELECT id
                FROM cst_batch_coaches
                WHERE batch_id = ?
    AND coach_user_id = ?
        AND status = 1
                  AND is_deleted = 0
AND(end_date IS NULL OR end_date >= ?)
                LIMIT 1
    `,
            [batch_id, coach_user_id, start_date]
        );

        if (existing.length > 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "This coach is already assigned to this batch",
                },
                { status: 409 }
            );
        }

        const [result] = await connection.query(
            `
                INSERT INTO cst_batch_coaches(
        batch_id,
        coach_user_id,
        coach_role,
        start_date,
        end_date,
        status,
        remarks
    )
VALUES(?, ?, ?, ?, ?, ?, ?)
    `,
            [
                batch_id,
                coach_user_id,
                coach_role,
                start_date,
                end_date,
                status,
                remarks,
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Coach assigned to batch successfully",
                data: {
                    id: result.insertId,
                    batch_id,
                    coach_user_id,
                    coach_role,
                    start_date,
                    end_date,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST batch coaches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to assign coach",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// PUT: Update coach assignment
export async function PUT(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            id,
            batch_id,
            coach_user_id,
            coach_role,
            start_date,
            end_date,
            status,
            is_deleted,
            remarks,
        } = body;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Assignment id is required",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            "SELECT * FROM cst_batch_coaches WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Coach assignment not found",
                },
                { status: 404 }
            );
        }

        const old = rows[0];

        const updated = {
            batch_id: batch_id ?? old.batch_id,
            coach_user_id: coach_user_id ?? old.coach_user_id,
            coach_role: coach_role ?? old.coach_role,
            start_date: start_date ?? old.start_date,
            end_date: end_date === undefined ? old.end_date : end_date || null,
            status: status ?? old.status,
            is_deleted: is_deleted ?? old.is_deleted,
            remarks: remarks === undefined ? old.remarks : remarks,
        };

        const validRoles = [
            "Head Coach",
            "Assistant Coach",
            "Fitness Coach",
            "Specialist Coach",
        ];

        if (!validRoles.includes(updated.coach_role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid coach_role",
                },
                { status: 400 }
            );
        }

        if (updated.end_date && updated.end_date < updated.start_date) {
            return NextResponse.json(
                {
                    success: false,
                    message: "end_date cannot be before start_date",
                },
                { status: 400 }
            );
        }

        // Validate active batch and coach user
        const [validRows] = await connection.query(
            `
                SELECT b.id
                FROM cst_batches b
                INNER JOIN cst_users u
                    ON u.id = ?
    AND u.status = 1
                   AND u.is_deleted = 0
                WHERE b.id = ?
    AND b.status = 1
                  AND b.is_deleted = 0
    `,
            [updated.coach_user_id, updated.batch_id]
        );

        if (validRows.length === 0 && Number(updated.status) === 1 && Number(updated.is_deleted) === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Active batch or coach user not found",
                },
                { status: 404 }
            );
        }

        const [duplicateRows] = await connection.query(
            `
                SELECT id
                FROM cst_batch_coaches
                WHERE batch_id = ?
    AND coach_user_id = ?
        AND id <> ?
            AND status = 1
                  AND is_deleted = 0
AND(end_date IS NULL OR end_date >= ?)
AND(?IS NULL OR start_date <= ?)
                LIMIT 1
    `,
            [
                updated.batch_id,
                updated.coach_user_id,
                id,
                updated.start_date,
                updated.end_date,
                updated.end_date,
            ]
        );

        if (
            duplicateRows.length > 0 &&
            Number(updated.status) === 1 &&
            Number(updated.is_deleted) === 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This coach already has an overlapping assignment to this batch",
                },
                { status: 409 }
            );
        }

        await connection.query(
            `
                UPDATE cst_batch_coaches
SET
batch_id = ?,
    coach_user_id = ?,
    coach_role = ?,
    start_date = ?,
    end_date = ?,
    status = ?,
    is_deleted = ?,
    remarks = ?
        WHERE id = ?
            `,
            [
                updated.batch_id,
                updated.coach_user_id,
                updated.coach_role,
                updated.start_date,
                updated.end_date,
                updated.status,
                updated.is_deleted,
                updated.remarks,
                id,
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Coach assignment updated successfully",
        });
    } catch (error) {
        console.error("PUT batch coaches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update coach assignment",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// DELETE: Soft delete coach assignment
export async function DELETE(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Assignment id is required",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
                SELECT id
                FROM cst_batch_coaches
                WHERE id = ?
    AND is_deleted = 0
        `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Coach assignment not found",
                },
                { status: 404 }
            );
        }

        await connection.query(
            `
                UPDATE cst_batch_coaches
SET
status = 0,
    is_deleted = 1,
    end_date = COALESCE(end_date, CURDATE())
                WHERE id = ?
    `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Coach assignment removed successfully",
        });
    } catch (error) {
        console.error("DELETE batch coaches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to remove coach assignment",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}