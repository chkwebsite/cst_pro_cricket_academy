import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { syncIndividualTrainingOnEnrollment } from "@/app/components/lib/playerFlowSync.js";


const VALID_STATUSES = [
    "Active",
    "Transferred",
    "Completed",
    "Left",
];

// GET: List batch players
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id");
        const batch_id = searchParams.get("batch_id");
        const user_program_id = searchParams.get("user_program_id");
        const admission_players_id = searchParams.get("admission_players_id");
        const user_id = searchParams.get("user_id");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const program_id = searchParams.get("program_id");
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        connection = await pool.getConnection();

        let sql = `
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

            INNER JOIN cst_batches b
                ON b.id = bp.batch_id

            INNER JOIN cst_user_programs up
                ON up.id = bp.user_program_id

            INNER JOIN cst_admission_players ap
                ON ap.id = up.admission_players_id

            INNER JOIN cst_programs p
                ON p.id = up.program_id

            INNER JOIN cst_academy a
                ON a.id = b.academy_id

            INNER JOIN cst_branch br
                ON br.id = b.branch_id

            WHERE 1 = 1
    `;

        const params = [];

        if (id) {
            sql += " AND bp.id = ?";
            params.push(id);
        }

        if (batch_id) {
            sql += " AND bp.batch_id = ?";
            params.push(batch_id);
        }

        if (user_program_id) {
            sql += " AND bp.user_program_id = ?";
            params.push(user_program_id);
        }

        if (admission_players_id) {
            sql += " AND up.admission_players_id = ?";
            params.push(admission_players_id);
        }

        if (user_id) {
            sql += " AND up.user_id = ?";
            params.push(user_id);
        }

        if (academy_id) {
            sql += " AND b.academy_id = ?";
            params.push(academy_id);
        }

        if (branch_id) {
            sql += " AND b.branch_id = ?";
            params.push(branch_id);
        }

        if (program_id) {
            sql += " AND b.program_id = ?";
            params.push(program_id);
        }

        if (status) {
            sql += " AND bp.status = ?";
            params.push(status);
        }

        if (search) {
            sql += `
AND(
    b.batch_name LIKE ?
    OR b.batch_code LIKE ?
    OR ap.first_name LIKE ?
    OR ap.last_name LIKE ?
    OR ap.admission_no LIKE ?
    OR up.appointment_no LIKE ?
    OR p.program_name LIKE ?
                )
    `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        sql += " ORDER BY bp.id DESC";

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Batch players fetched successfully",
            total: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET batch players error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch batch players",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// POST: Assign player to a batch
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            batch_id,
            user_program_id,
            start_date,
            end_date = null,
            status = "Active",
            remarks = null,
        } = body;

        if (!batch_id || !user_program_id || !start_date) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "batch_id, user_program_id and start_date are required",
                },
                { status: 400 }
            );
        }

        if (!VALID_STATUSES.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid player assignment status",
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

        // Lock the batch row to protect its capacity from concurrent assignments
        const [batches] = await connection.query(
            `
SELECT
id,
    academy_id,
    branch_id,
    program_id,
    age_group_id,
    max_players
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

        const batch = batches[0];

        // Verify enrollment belongs to the same branch/program and an eligible player
        const [enrollments] = await connection.query(
            `
SELECT
up.id,
    up.user_id,
    up.admission_players_id,
    up.program_id,
    up.branch_id,
    up.start_date,
    up.end_date,
    up.status AS enrollment_status,
        up.is_deleted AS enrollment_is_deleted,
            ap.status AS player_status,
                ap.is_deleted AS player_is_deleted,
                    p.academy_id AS program_academy_id
                FROM cst_user_programs up

                INNER JOIN cst_admission_players ap
                    ON ap.id = up.admission_players_id

                INNER JOIN cst_programs p
                    ON p.id = up.program_id

                WHERE up.id = ?
    FOR UPDATE
        `,
            [user_program_id]
        );

        if (enrollments.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Player program enrollment not found",
                },
                { status: 404 }
            );
        }

        const enrollment = enrollments[0];

        if (
            Number(enrollment.enrollment_is_deleted) === 1 ||
            Number(enrollment.enrollment_status) !== 1 ||
            Number(enrollment.player_is_deleted) === 1 ||
            Number(enrollment.player_status) !== 1
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Player or enrollment is inactive",
                },
                { status: 400 }
            );
        }

        if (
            Number(enrollment.program_id) !== Number(batch.program_id) ||
            Number(enrollment.branch_id) !== Number(batch.branch_id) ||
            Number(enrollment.program_academy_id) !== Number(batch.academy_id)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Player enrollment and batch must belong to the same academy, branch and program",
                },
                { status: 400 }
            );
        }

        // Validate that the selected batch age group exists and is valid.
        // Player DOB validation can be added if DOB is stored in the player table.

        // Check for another active assignment for the same enrollment.
        const [existingAssignments] = await connection.query(
            `
                SELECT id, batch_id
                FROM cst_batch_players
                WHERE user_program_id = ?
    AND status = 'Active'
AND(end_date IS NULL OR end_date >= ?)
                LIMIT 1
                FOR UPDATE
    `,
            [user_program_id, start_date]
        );

        if (existingAssignments.length > 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This enrollment already has an active batch assignment. Transfer it before assigning another batch.",
                    data: existingAssignments[0],
                },
                { status: 409 }
            );
        }

        if (status === "Active") {
            const [counts] = await connection.query(
                `
                    SELECT COUNT(*) AS total
                    FROM cst_batch_players
                    WHERE batch_id = ?
    AND status = 'Active'
AND(end_date IS NULL OR end_date >= CURDATE())
    `,
                [batch_id]
            );

            if (Number(counts[0].total) >= Number(batch.max_players)) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Batch is full. No seats are available.",
                    },
                    { status: 409 }
                );
            }
        }

        const [result] = await connection.query(
            `
                INSERT INTO cst_batch_players(
        batch_id,
        user_program_id,
        start_date,
        end_date,
        status,
        remarks
    )
VALUES(?, ?, ?, ?, ?, ?)
    `,
            [
                batch_id,
                user_program_id,
                start_date,
                end_date,
                status,
                remarks,
            ]
        );

        // Auto-sync into cst_individual_training if batch or enrollment is program_id 1 (One-on-One 1:1)
        if (Number(batch.program_id) === 1 || Number(enrollment.program_id) === 1) {
            try {
                let batchCoachId = null;
                const [bCoaches] = await connection.query(
                    `SELECT coach_user_id FROM cst_batch_coaches WHERE batch_id = ? AND status = 1 AND is_deleted = 0 ORDER BY id ASC LIMIT 1`,
                    [updated.batch_id]
                );
                if (bCoaches.length > 0) {
                    batchCoachId = bCoaches[0].coach_user_id;
                }

                const trainingDays = batch.training_days
                    ? (Array.isArray(batch.training_days) ? batch.training_days.join(",") : String(batch.training_days))
                    : "Monday,Wednesday,Friday";
                const sTime = batch.start_time ? String(batch.start_time).slice(0, 8) : "07:00:00";
                const eTime = batch.end_time ? String(batch.end_time).slice(0, 8) : "08:00:00";

                await syncIndividualTrainingOnEnrollment({
                    connection,
                    academyId: batch.academy_id,
                    branchId: batch.branch_id,
                    userProgramId: updated.user_program_id,
                    startDate: updated.start_date,
                    endDate: updated.end_date,
                    coachUserId: batchCoachId,
                    trainingDays,
                    startTime: sTime,
                    endTime: eTime,
                    status: updated.status === "Active" ? "Active" : "On Hold",
                    remarks: `Auto-updated from batch ${batch.batch_name || ""} (${batch.batch_code || ""})`,
                });
            } catch (itErr) {
                console.error("Batch player individual training auto-sync error:", itErr);
            }
        }

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Player assigned to batch successfully",
                data: {
                    id: result.insertId,
                    batch_id,
                    user_program_id,
                    start_date,
                    end_date,
                    status,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST batch players error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to assign player to batch",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// PUT: Update a batch player assignment
export async function PUT(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            id,
            batch_id,
            user_program_id,
            start_date,
            end_date,
            status,
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

        if (status && !VALID_STATUSES.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid player assignment status",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `
SELECT *
    FROM cst_batch_players
                WHERE id = ?
    FOR UPDATE
        `,
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Batch player assignment not found",
                },
                { status: 404 }
            );
        }

        const old = rows[0];

        const updated = {
            batch_id: batch_id ?? old.batch_id,
            user_program_id: user_program_id ?? old.user_program_id,
            start_date: start_date ?? old.start_date,
            end_date:
                end_date === undefined ? old.end_date : end_date || null,
            status: status ?? old.status,
            remarks: remarks === undefined ? old.remarks : remarks,
        };

        if (updated.end_date && updated.end_date < updated.start_date) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "end_date cannot be before start_date",
                },
                { status: 400 }
            );
        }

        const [batches] = await connection.query(
            `
SELECT
id,
    academy_id,
    branch_id,
    program_id,
    max_players
                FROM cst_batches
                WHERE id = ?
    AND status = 1
                  AND is_deleted = 0
                FOR UPDATE
    `,
            [updated.batch_id]
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

        const batch = batches[0];

        const [enrollments] = await connection.query(
            `
SELECT
up.id,
    up.program_id,
    up.branch_id,
    up.status AS enrollment_status,
        up.is_deleted AS enrollment_is_deleted,
            ap.status AS player_status,
                ap.is_deleted AS player_is_deleted,
                    p.academy_id AS program_academy_id
                FROM cst_user_programs up
                INNER JOIN cst_admission_players ap
                    ON ap.id = up.admission_players_id
                INNER JOIN cst_programs p
                    ON p.id = up.program_id
                WHERE up.id = ?
    `,
            [updated.user_program_id]
        );

        if (enrollments.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Player program enrollment not found",
                },
                { status: 404 }
            );
        }

        const enrollment = enrollments[0];

        if (
            Number(enrollment.enrollment_is_deleted) === 1 ||
            Number(enrollment.enrollment_status) !== 1 ||
            Number(enrollment.player_is_deleted) === 1 ||
            Number(enrollment.player_status) !== 1
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Player or enrollment is inactive",
                },
                { status: 400 }
            );
        }

        if (
            Number(enrollment.program_id) !== Number(batch.program_id) ||
            Number(enrollment.branch_id) !== Number(batch.branch_id) ||
            Number(enrollment.program_academy_id) !== Number(batch.academy_id)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Player enrollment and batch must belong to the same academy, branch and program",
                },
                { status: 400 }
            );
        }

        if (updated.status === "Active") {
            const [duplicateRows] = await connection.query(
                `
                    SELECT id
                    FROM cst_batch_players
                    WHERE user_program_id = ?
    AND id <> ?
        AND status = 'Active'
AND(end_date IS NULL OR end_date >= ?)
                    LIMIT 1
    `,
                [
                    updated.user_program_id,
                    id,
                    updated.start_date,
                ]
            );

            if (duplicateRows.length > 0) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This enrollment already has another active batch assignment",
                    },
                    { status: 409 }
                );
            }

            const [counts] = await connection.query(
                `
                    SELECT COUNT(*) AS total
                    FROM cst_batch_players
                    WHERE batch_id = ?
    AND id <> ?
        AND status = 'Active'
AND(end_date IS NULL OR end_date >= CURDATE())
    `,
                [updated.batch_id, id]
            );

            if (Number(counts[0].total) >= Number(batch.max_players)) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Batch is full. No seats are available.",
                    },
                    { status: 409 }
                );
            }
        }

        await connection.query(
            `
                UPDATE cst_batch_players
SET
batch_id = ?,
    user_program_id = ?,
    start_date = ?,
    end_date = ?,
    status = ?,
    remarks = ?
        WHERE id = ?
            `,
            [
                updated.batch_id,
                updated.user_program_id,
                updated.start_date,
                updated.end_date,
                updated.status,
                updated.remarks,
                id,
            ]
        );

        // Auto-sync into cst_individual_training if batch or enrollment is program_id 1 (One-on-One 1:1)
        if (Number(batch.program_id) === 1 || Number(enrollment.program_id) === 1) {
            try {
                let batchCoachId = null;
                const [bCoaches] = await connection.query(
                    `SELECT coach_user_id FROM cst_batch_coaches WHERE batch_id = ? AND status = 1 AND is_deleted = 0 ORDER BY id ASC LIMIT 1`,
                    [updated.batch_id]
                );
                if (bCoaches.length > 0) {
                    batchCoachId = bCoaches[0].coach_user_id;
                }

                const trainingDays = batch.training_days
                    ? (Array.isArray(batch.training_days) ? batch.training_days.join(",") : String(batch.training_days))
                    : "Monday,Wednesday,Friday";
                const sTime = batch.start_time ? String(batch.start_time).slice(0, 8) : "07:00:00";
                const eTime = batch.end_time ? String(batch.end_time).slice(0, 8) : "08:00:00";

                await syncIndividualTrainingOnEnrollment({
                    connection,
                    academyId: batch.academy_id,
                    branchId: batch.branch_id,
                    userProgramId: updated.user_program_id,
                    startDate: updated.start_date,
                    endDate: updated.end_date,
                    coachUserId: batchCoachId,
                    trainingDays,
                    startTime: sTime,
                    endTime: eTime,
                    status: updated.status === "Active" ? "Active" : "On Hold",
                    remarks: `Auto-updated from batch ${batch.batch_name || ""} (${batch.batch_code || ""})`,
                });
            } catch (itErr) {
                console.error("Batch player individual training auto-sync error:", itErr);
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Batch player assignment updated successfully",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("PUT batch players error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update batch player assignment",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// DELETE: Mark player as Left, preserving assignment history
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
                SELECT id, status
                FROM cst_batch_players
                WHERE id = ?
    `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batch player assignment not found",
                },
                { status: 404 }
            );
        }

        if (rows[0].status !== "Active") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Only active assignments can be removed",
                },
                { status: 409 }
            );
        }

        await connection.query(
            `
                UPDATE cst_batch_players
SET
status = 'Left',
    end_date = COALESCE(end_date, CURDATE())
                WHERE id = ?
    `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Player removed from batch successfully",
        });
    } catch (error) {
        console.error("DELETE batch players error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to remove player from batch",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}