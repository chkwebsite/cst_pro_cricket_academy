import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


const VALID_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

const VALID_STATUSES = [
    "Scheduled",
    "Active",
    "On Hold",
    "Completed",
    "Cancelled",
];

const ALLOWED_FIELDS = [
    "academy_id",
    "branch_id",
    "user_program_id",
    "coach_user_id",
    "training_days",
    "start_time",
    "end_time",
    "start_date",
    "end_date",
    "session_duration",
    "status",
    "remarks",
];

function errorResponse(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        { status }
    );
}

function parseDays(value) {
    const days = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split(",").map((day) => day.trim()).filter(Boolean)
            : [];

    return [...new Set(days)];
}

function normalizeBody(body) {
    const data = {};

    for (const field of ALLOWED_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            data[field] = body[field];
        }
    }

    for (const field of [
        "academy_id",
        "branch_id",
        "user_program_id",
        "coach_user_id",
        "session_duration",
    ]) {
        if (data[field] !== undefined) {
            data[field] = Number(data[field]);
        }
    }

    if (data.training_days !== undefined) {
        data.training_days = parseDays(data.training_days).join(",");
    }

    if (data.end_date === "") data.end_date = null;
    if (data.remarks === "") data.remarks = null;

    return data;
}

function validate(data) {
    const positiveFields = [
        "academy_id",
        "branch_id",
        "user_program_id",
        "coach_user_id",
        "session_duration",
    ];

    for (const field of positiveFields) {
        if (data[field] !== undefined) {
            if (
                !Number.isInteger(data[field]) ||
                data[field] <= 0
            ) {
                return `${field} must be a positive integer.`;
            }
        }
    }

    if (data.training_days !== undefined) {
        const days = parseDays(data.training_days);

        if (!days.length || days.some((day) => !VALID_DAYS.includes(day))) {
            return "Please provide valid training_days.";
        }
    }

    if (
        data.start_time !== undefined &&
        data.end_time !== undefined &&
        data.start_time >= data.end_time
    ) {
        return "end_time must be later than start_time.";
    }

    if (
        data.start_date !== undefined &&
        !/^\d{4}-\d{2}-\d{2}$/.test(data.start_date)
    ) {
        return "start_date must be in YYYY-MM-DD format.";
    }

    if (
        data.end_date !== undefined &&
        data.end_date !== null &&
        !/^\d{4}-\d{2}-\d{2}$/.test(data.end_date)
    ) {
        return "end_date must be in YYYY-MM-DD format.";
    }

    if (
        data.start_date &&
        data.end_date &&
        data.end_date < data.start_date
    ) {
        return "end_date cannot be before start_date.";
    }

    if (
        data.status !== undefined &&
        !VALID_STATUSES.includes(data.status)
    ) {
        return "Invalid status.";
    }

    return null;
}

async function validateRelations(connection, data) {
    const [branches] = await connection.execute(
        `SELECT id
         FROM cst_branch
         WHERE id = ? AND academy_id = ?
    LIMIT 1`,
        [data.branch_id, data.academy_id]
    );

    if (!branches.length) {
        return "Selected branch does not belong to this academy.";
    }

    const [enrollments] = await connection.execute(
        `SELECT p.branch_id AS program_branch_id
         FROM cst_user_programs up
         INNER JOIN cst_programs p ON p.id = up.program_id
         WHERE up.id = ?
    AND up.branch_id = ?
        AND p.academy_id = ?
            AND up.status = 1
           AND up.is_deleted = 0
           AND p.status = 1
           AND p.is_deleted = 0
         LIMIT 1`,
        [
            data.user_program_id,
            data.branch_id,
            data.academy_id,
        ]
    );

    if (!enrollments.length) {
        return "Active enrollment not found for the selected academy and branch.";
    }

    if (
        enrollments[0].program_branch_id !== null &&
        Number(enrollments[0].program_branch_id) !== data.branch_id
    ) {
        return "Selected program does not belong to this branch.";
    }

    const [coaches] = await connection.execute(
        `SELECT id
         FROM cst_users
         WHERE id = ?
    AND academy_id = ?
        AND branch_id = ?
            AND status = 1
           AND is_deleted = 0
         LIMIT 1`,
        [
            data.coach_user_id,
            data.academy_id,
            data.branch_id,
        ]
    );

    if (!coaches.length) {
        return "Active coach not found for the selected academy and branch.";
    }

    return null;
}

// GET: Fetch one individual training record.
export async function GET(request, { params }) {
    let connection;

    try {
        const { id: rawId } = await params;
        const id = Number(rawId);

        if (!Number.isInteger(id) || id <= 0) {
            return errorResponse("Valid training id is required.");
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
it.*,
    up.program_id,
    up.appointment_no,
    ap.id AS admission_player_id,
        ap.admission_no,
        ap.first_name AS player_first_name,
            ap.last_name AS player_last_name,
                ap.phone AS player_phone,
                    p.program_name,
                    coach.first_name AS coach_first_name,
                        coach.last_name AS coach_last_name,
                            coach.appointment_no AS coach_appointment_no,
                                a.academy_name,
                                br.branch_code
             FROM cst_individual_training it
             INNER JOIN cst_user_programs up
                ON up.id = it.user_program_id
             INNER JOIN cst_admission_players ap
                ON ap.id = up.admission_players_id
             INNER JOIN cst_programs p
                ON p.id = up.program_id
             INNER JOIN cst_users coach
                ON coach.id = it.coach_user_id
             INNER JOIN cst_academy a
                ON a.id = it.academy_id
             INNER JOIN cst_branch br
                ON br.id = it.branch_id
             WHERE it.id = ?
    AND it.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (!rows.length) {
            return errorResponse("Individual training not found.", 404);
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET single individual training:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch training record." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update individual training.
export async function PUT(request, { params }) {
    let connection;
    let transactionStarted = false;

    try {
        const { id: rawId } = await params;
        const id = Number(rawId);

        if (!Number.isInteger(id) || id <= 0) {
            return errorResponse("Valid training id is required.");
        }

        const body = await request.json();
        const data = normalizeBody(body);

        if (!Object.keys(data).length) {
            return errorResponse("No valid fields provided.");
        }

        const validationError = validate(data);

        if (validationError) {
            return errorResponse(validationError, 422);
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [rows] = await connection.execute(
            `SELECT *
    FROM cst_individual_training
             WHERE id = ? AND is_deleted = 0
             FOR UPDATE`,
            [id]
        );

        if (!rows.length) {
            await connection.rollback();
            transactionStarted = false;

            return errorResponse("Individual training not found.", 404);
        }

        const existing = rows[0];

        const dateString = (value) => {
            if (!value) return null;

            return value instanceof Date
                ? value.toISOString().slice(0, 10)
                : String(value).slice(0, 10);
        };

        const updated = {
            academy_id: existing.academy_id,
            branch_id: existing.branch_id,
            user_program_id: existing.user_program_id,
            coach_user_id: existing.coach_user_id,
            training_days: existing.training_days,
            start_time: existing.start_time,
            end_time: existing.end_time,
            start_date: dateString(existing.start_date),
            end_date: dateString(existing.end_date),
            session_duration: existing.session_duration,
            status: existing.status,
            remarks: existing.remarks,
            ...data,
        };

        const fullValidationError = validate({
            ...updated,
            academy_id: Number(updated.academy_id),
            branch_id: Number(updated.branch_id),
            user_program_id: Number(updated.user_program_id),
            coach_user_id: Number(updated.coach_user_id),
            session_duration: Number(updated.session_duration),
        });

        if (fullValidationError) {
            await connection.rollback();
            transactionStarted = false;

            return errorResponse(fullValidationError, 422);
        }

        const relationError = await validateRelations(connection, {
            ...updated,
            academy_id: Number(updated.academy_id),
            branch_id: Number(updated.branch_id),
            user_program_id: Number(updated.user_program_id),
            coach_user_id: Number(updated.coach_user_id),
        });

        if (relationError) {
            await connection.rollback();
            transactionStarted = false;

            return errorResponse(relationError, 422);
        }

        if (["Scheduled", "Active"].includes(updated.status)) {
            const days = parseDays(updated.training_days);

            const [conflicts] = await connection.execute(
                `SELECT id, training_days
                 FROM cst_individual_training
                 WHERE id <> ?
    AND academy_id = ?
        AND branch_id = ?
            AND coach_user_id = ?
                AND status IN('Scheduled', 'Active')
                   AND is_deleted = 0
                   AND start_date <= COALESCE(?, '9999-12-31')
                   AND COALESCE(end_date, '9999-12-31') >= ?
    AND start_time < ?
        AND end_time > ? `,
                [
                    id,
                    updated.academy_id,
                    updated.branch_id,
                    updated.coach_user_id,
                    updated.end_date,
                    updated.start_date,
                    updated.end_time,
                    updated.start_time,
                ]
            );

            const hasConflict = conflicts.some((row) =>
                parseDays(row.training_days).some((day) => days.includes(day))
            );

            if (hasConflict) {
                await connection.rollback();
                transactionStarted = false;

                return errorResponse(
                    "Coach already has an overlapping training schedule.",
                    409
                );
            }
        }

        const fields = Object.keys(data);
        const values = fields.map((field) => {
            if (field === "end_date" || field === "remarks") {
                return data[field] ?? null;
            }

            return data[field];
        });

        const setClause = fields
            .map((field) => `${field} = ?`)
            .join(", ");

        await connection.execute(
            `UPDATE cst_individual_training
             SET ${setClause}
             WHERE id = ? AND is_deleted = 0`,
            [...values, id]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Individual training updated successfully.",
        });
    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("PUT individual training:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update training record." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Soft delete.
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id: rawId } = await params;
        const id = Number(rawId);

        if (!Number.isInteger(id) || id <= 0) {
            return errorResponse("Valid training id is required.");
        }

        connection = await pool.getConnection();

        const [result] = await connection.execute(
            `UPDATE cst_individual_training
             SET is_deleted = 1,
    status = 'Cancelled'
             WHERE id = ?
    AND is_deleted = 0`,
            [id]
        );

        if (result.affectedRows === 0) {
            return errorResponse("Individual training not found.", 404);
        }

        return NextResponse.json({
            success: true,
            message: "Individual training deleted successfully.",
        });
    } catch (error) {
        console.error("DELETE individual training:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete training record." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}