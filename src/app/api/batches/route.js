import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";


// GET: Fetch batches with filters
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const program_id = searchParams.get("program_id");
        const age_group_id = searchParams.get("age_group_id");
        const status = searchParams.get("status");
        const is_deleted = searchParams.get("is_deleted") ?? "0";
        const search = searchParams.get("search");

        connection = await pool.getConnection();

        let sql = `
SELECT
b.*,
    a.academy_name,
    br.branch_code,
    p.program_name,
    ag.age_group AS age_group_name,
    ag.age_group
            FROM cst_batches b
            INNER JOIN cst_academy a
                ON a.id = b.academy_id
            INNER JOIN cst_branch br
                ON br.id = b.branch_id
            INNER JOIN cst_programs p
                ON p.id = b.program_id
            INNER JOIN cst_age_groups ag
                ON ag.id = b.age_group_id
            WHERE 1 = 1
    `;

        const params = [];

        const authUser = await getAuthUser(request);
        if (authUser) {
            if (authUser.isCoach) {
                // Coach only sees their assigned batches
                sql += ` AND b.id IN (
                    SELECT batch_id FROM cst_batch_coaches
                    WHERE coach_user_id = ? AND status = 1 AND is_deleted = 0
                )`;
                params.push(authUser.id);
            } else if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND b.branch_id = ? AND b.academy_id = ?";
                params.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND b.academy_id = ?";
                params.push(authUser.academy_id);
                if (branch_id) {
                    sql += " AND b.branch_id = ?";
                    params.push(branch_id);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND b.academy_id = ?";
                params.push(authUser.academy_id);
            } else {
                if (academy_id) {
                    sql += " AND b.academy_id = ?";
                    params.push(academy_id);
                }
                if (branch_id) {
                    sql += " AND b.branch_id = ?";
                    params.push(branch_id);
                }
            }
        } else {
            if (academy_id) {
                sql += " AND b.academy_id = ?";
                params.push(academy_id);
            }
            if (branch_id) {
                sql += " AND b.branch_id = ?";
                params.push(branch_id);
            }
        }

        if (program_id) {
            sql += " AND b.program_id = ?";
            params.push(program_id);
        }

        if (age_group_id) {
            sql += " AND b.age_group_id = ?";
            params.push(age_group_id);
        }

        if (status !== null && status !== "") {
            sql += " AND b.status = ?";
            params.push(status);
        }

        if (is_deleted !== "") {
            sql += " AND b.is_deleted = ?";
            params.push(is_deleted);
        }

        if (search) {
            sql += `
AND(
    b.batch_name LIKE ?
    OR b.batch_code LIKE ?
    OR p.program_name LIKE ?
    OR ag.age_group LIKE ?
    OR a.academy_name LIKE ?
    OR br.branch_code LIKE ?
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

        sql += " ORDER BY b.id DESC";

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Batches fetched successfully",
            total: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET batches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch batches",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// POST: Create a new batch
export async function POST(request) {
    const authUser = await getAuthUser(request);
    if (authUser) {
        if (authUser.isCoach || authUser.isPlayer) {
            return NextResponse.json(
                { success: false, message: "Coaches and Players cannot create batches" },
                { status: 403 }
            );
        }
    }

    let connection;

    try {
        const body = await request.json();

        if (authUser && authUser.isAcademyAdmin && authUser.academy_id) {
            body.academy_id = authUser.academy_id;
        }
        if (authUser && authUser.isBranchAdmin) {
            body.academy_id = authUser.academy_id;
            body.branch_id = authUser.branch_id;
        }

        const {
            academy_id,
            branch_id,
            program_id,
            age_group_id,
            batch_name,
            batch_code,
            start_time,
            end_time,
            training_days,
            max_players = 25,
            start_date = null,
            end_date = null,
            status = 1,
            remarks = null,
        } = body;

        if (
            !academy_id ||
            !branch_id ||
            !program_id ||
            !age_group_id ||
            !batch_name?.trim() ||
            !batch_code?.trim() ||
            !start_time ||
            !end_time ||
            !training_days
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please provide all required batch fields",
                },
                { status: 400 }
            );
        }

        const validDays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ];

        const days = Array.isArray(training_days)
            ? training_days
            : String(training_days).split(",");

        if (
            days.length === 0 ||
            days.some((day) => !validDays.includes(day))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid training_days value",
                },
                { status: 400 }
            );
        }

        if (
            !Number.isInteger(Number(max_players)) ||
            Number(max_players) < 1
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "max_players must be a positive integer",
                },
                { status: 400 }
            );
        }

        if (start_time >= end_time) {
            return NextResponse.json(
                {
                    success: false,
                    message: "end_time must be later than start_time",
                },
                { status: 400 }
            );
        }

        if (
            start_date &&
            end_date &&
            end_date < start_date
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "end_date cannot be before start_date",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Validate academy, branch, program and age group
        const [validRecords] = await connection.query(
            `
SELECT
br.id AS branch_id,
    p.id AS program_id,
        p.academy_id AS program_academy_id,
            p.branch_id AS program_branch_id,
                ag.id AS age_group_id
                FROM cst_branch br
                INNER JOIN cst_programs p
                    ON p.id = ?
    AND p.academy_id = br.academy_id
AND(p.branch_id IS NULL OR p.branch_id = br.id)
                   AND p.is_deleted = 0
                   AND p.status = 1
                INNER JOIN cst_age_groups ag
                    ON ag.id = ?
    WHERE br.id = ?
        AND br.academy_id = ?
            `,
            [
                program_id,
                age_group_id,
                branch_id,
                academy_id,
            ]
        );

        if (validRecords.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid academy, branch, program or age group combination",
                },
                { status: 400 }
            );
        }

        const [result] = await connection.query(
            `
                INSERT INTO cst_batches(
                academy_id,
                branch_id,
                program_id,
                age_group_id,
                batch_name,
                batch_code,
                start_time,
                end_time,
                training_days,
                max_players,
                start_date,
                end_date,
                status,
                remarks
            )
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
            [
                academy_id,
                branch_id,
                program_id,
                age_group_id,
                batch_name.trim(),
                batch_code.trim(),
                start_time,
                end_time,
                days.join(","),
                Number(max_players),
                start_date || null,
                end_date || null,
                status,
                remarks,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Batch created successfully",
                data: {
                    id: result.insertId,
                    academy_id,
                    branch_id,
                    program_id,
                    age_group_id,
                    batch_name: batch_name.trim(),
                    batch_code: batch_code.trim(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST batches error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This batch code already exists in the selected branch",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create batch",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// PUT: Update an existing batch
export async function PUT(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            id,
            academy_id,
            branch_id,
            program_id,
            age_group_id,
            batch_name,
            batch_code,
            start_time,
            end_time,
            training_days,
            max_players,
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
                    message: "Batch id is required",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [existingRows] = await connection.query(
            "SELECT * FROM cst_batches WHERE id = ?",
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batch not found",
                },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        const updated = {
            academy_id: academy_id ?? existing.academy_id,
            branch_id: branch_id ?? existing.branch_id,
            program_id: program_id ?? existing.program_id,
            age_group_id: age_group_id ?? existing.age_group_id,
            batch_name: batch_name ?? existing.batch_name,
            batch_code: batch_code ?? existing.batch_code,
            start_time: start_time ?? existing.start_time,
            end_time: end_time ?? existing.end_time,
            training_days: training_days ?? existing.training_days,
            max_players: max_players ?? existing.max_players,
            start_date:
                start_date === undefined
                    ? existing.start_date
                    : start_date || null,
            end_date:
                end_date === undefined
                    ? existing.end_date
                    : end_date || null,
            status: status ?? existing.status,
            is_deleted: is_deleted ?? existing.is_deleted,
            remarks: remarks === undefined ? existing.remarks : remarks,
        };

        if (
            !updated.batch_name?.trim() ||
            !updated.batch_code?.trim() ||
            !updated.start_time ||
            !updated.end_time
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batch name, code and timing are required",
                },
                { status: 400 }
            );
        }

        if (updated.start_time >= updated.end_time) {
            return NextResponse.json(
                {
                    success: false,
                    message: "end_time must be later than start_time",
                },
                { status: 400 }
            );
        }

        if (
            !Number.isInteger(Number(updated.max_players)) ||
            Number(updated.max_players) < 1
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "max_players must be a positive integer",
                },
                { status: 400 }
            );
        }

        if (
            updated.start_date &&
            updated.end_date &&
            updated.end_date < updated.start_date
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "end_date cannot be before start_date",
                },
                { status: 400 }
            );
        }

        const validDays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ];

        const days = Array.isArray(updated.training_days)
            ? updated.training_days
            : String(updated.training_days).split(",");

        if (
            days.length === 0 ||
            days.some((day) => !validDays.includes(day))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid training_days value",
                },
                { status: 400 }
            );
        }

        const [validRecords] = await connection.query(
            `
                SELECT br.id
                FROM cst_branch br
                INNER JOIN cst_programs p
                    ON p.id = ?
    AND p.academy_id = br.academy_id
AND(p.branch_id IS NULL OR p.branch_id = br.id)
                   AND p.is_deleted = 0
                   AND p.status = 1
                INNER JOIN cst_age_groups ag
                    ON ag.id = ?
    WHERE br.id = ?
        AND br.academy_id = ?
            `,
            [
                updated.program_id,
                updated.age_group_id,
                updated.branch_id,
                updated.academy_id,
            ]
        );

        if (validRecords.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid academy, branch, program or age group combination",
                },
                { status: 400 }
            );
        }

        const [result] = await connection.query(
            `
                UPDATE cst_batches
SET
academy_id = ?,
    branch_id = ?,
    program_id = ?,
    age_group_id = ?,
    batch_name = ?,
    batch_code = ?,
    start_time = ?,
    end_time = ?,
    training_days = ?,
    max_players = ?,
    start_date = ?,
    end_date = ?,
    status = ?,
    is_deleted = ?,
    remarks = ?
        WHERE id = ?
            `,
            [
                updated.academy_id,
                updated.branch_id,
                updated.program_id,
                updated.age_group_id,
                updated.batch_name.trim(),
                updated.batch_code.trim(),
                updated.start_time,
                updated.end_time,
                days.join(","),
                Number(updated.max_players),
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
            message: "Batch updated successfully",
            affectedRows: result.affectedRows,
        });
    } catch (error) {
        console.error("PUT batches error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This batch code already exists in the selected branch",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update batch",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// DELETE: Soft delete a batch
export async function DELETE(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batch id is required",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            "SELECT id FROM cst_batches WHERE id = ? AND is_deleted = 0",
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batch not found",
                },
                { status: 404 }
            );
        }

        const [activePlayers] = await connection.query(
            `
                SELECT COUNT(*) AS total
                FROM cst_batch_players
                WHERE batch_id = ?
    AND status = 'Active'
        `,
            [id]
        );

        if (Number(activePlayers[0].total) > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Cannot delete a batch with active players. Transfer or remove players first.",
                },
                { status: 409 }
            );
        }

        const [activeCoaches] = await connection.query(
            `
                SELECT COUNT(*) AS total
                FROM cst_batch_coaches
                WHERE batch_id = ?
    AND status = 1
                  AND is_deleted = 0
    `,
            [id]
        );

        if (Number(activeCoaches[0].total) > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Please deactivate coach assignments before deleting this batch.",
                },
                { status: 409 }
            );
        }

        await connection.query(
            `
                UPDATE cst_batches
                SET is_deleted = 1, status = 0
                WHERE id = ?
    `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Batch deleted successfully",
        });
    } catch (error) {
        console.error("DELETE batches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete batch",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
