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
    return {
        academy_id: Number(body.academy_id),
        branch_id: Number(body.branch_id),
        user_program_id: Number(body.user_program_id),
        coach_user_id: Number(body.coach_user_id),
        training_days: parseDays(body.training_days).join(","),
        start_time: body.start_time,
        end_time: body.end_time,
        start_date: body.start_date,
        end_date: body.end_date || null,
        session_duration:
            body.session_duration === undefined
                ? 60
                : Number(body.session_duration),
        status: body.status || "Scheduled",
        remarks: body.remarks || null,
    };
}

function validate(data) {
    if (
        !Number.isInteger(data.academy_id) || data.academy_id <= 0 ||
        !Number.isInteger(data.branch_id) || data.branch_id <= 0 ||
        !Number.isInteger(data.user_program_id) || data.user_program_id <= 0 ||
        !Number.isInteger(data.coach_user_id) || data.coach_user_id <= 0
    ) {
        return "Valid academy_id, branch_id, user_program_id and coach_user_id are required.";
    }

    const days = parseDays(data.training_days);

    if (!days.length || days.some((day) => !VALID_DAYS.includes(day))) {
        return "Please select valid training days.";
    }

    if (
        !data.start_time ||
        !data.end_time ||
        data.start_time >= data.end_time
    ) {
        return "Valid start_time and end_time are required; end_time must be later.";
    }

    if (
        !data.start_date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.start_date)
    ) {
        return "start_date must be in YYYY-MM-DD format.";
    }

    if (
        data.end_date &&
        (
            !/^\d{4}-\d{2}-\d{2}$/.test(data.end_date) ||
            data.end_date < data.start_date
        )
    ) {
        return "end_date must be valid and cannot be before start_date.";
    }

    if (
        !Number.isInteger(data.session_duration) ||
        data.session_duration <= 0
    ) {
        return "session_duration must be a positive integer.";
    }

    if (!VALID_STATUSES.includes(data.status)) {
        return "Invalid training status.";
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
        `SELECT
up.id,
    up.branch_id,
    p.academy_id,
    p.branch_id AS program_branch_id
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
        return "Active player enrollment not found for the selected academy and branch.";
    }

    const enrollment = enrollments[0];

    if (
        enrollment.program_branch_id !== null &&
        Number(enrollment.program_branch_id) !== data.branch_id
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

async function hasCoachConflict(connection, data) {
    const days = parseDays(data.training_days);

    const [rows] = await connection.execute(
        `SELECT id, training_days
         FROM cst_individual_training
         WHERE academy_id = ?
    AND branch_id = ?
        AND coach_user_id = ?
            AND status IN('Scheduled', 'Active')
           AND is_deleted = 0
           AND start_date <= COALESCE(?, '9999-12-31')
           AND COALESCE(end_date, '9999-12-31') >= ?
    AND start_time < ?
        AND end_time > ? `,
        [
            data.academy_id,
            data.branch_id,
            data.coach_user_id,
            data.end_date,
            data.start_date,
            data.end_time,
            data.start_time,
        ]
    );

    return rows.some((row) =>
        parseDays(row.training_days).some((day) => days.includes(day))
    );
}

// GET: List training records with optional filters.
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const params = new URL(request.url).searchParams;

        const conditions = ["it.is_deleted = 0"];
        const values = [];

        const filters = {
            academy_id: "it.academy_id",
            branch_id: "it.branch_id",
            user_program_id: "it.user_program_id",
            coach_user_id: "it.coach_user_id",
            status: "it.status",
        };

        for (const [key, column] of Object.entries(filters)) {
            const value = params.get(key);

            if (value !== null && value !== "") {
                if (key === "status" && !VALID_STATUSES.includes(value)) {
                    return errorResponse("Invalid status filter.");
                }

                conditions.push(`${ column } = ?`);
                values.push(value);
            }
        }

        const trainingDay = params.get("training_day");

        if (trainingDay) {
            if (!VALID_DAYS.includes(trainingDay)) {
                return errorResponse("Invalid training_day.");
            }

            conditions.push("FIND_IN_SET(?, it.training_days) > 0");
            values.push(trainingDay);
        }

        const search = params.get("search");

        if (search) {
            conditions.push(`(
            ap.first_name LIKE ?
            OR ap.last_name LIKE ?
            OR ap.admission_no LIKE ?
            OR coach.first_name LIKE ?
            OR coach.last_name LIKE ?
            OR p.program_name LIKE ?
            )`);

            const term = `%${search.trim()}%`;
            values.push(term, term, term, term, term, term);
        }

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
             WHERE ${ conditions.join(" AND ") }
             ORDER BY it.id DESC`,
            values
        );

        return NextResponse.json({
            success: true,
            total: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET individual training:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch training records." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST: Create a new individual training record.
export async function POST(request) {
    let connection;
    let transactionStarted = false;

    try {
        const body = await request.json();
        const data = normalizeBody(body);

        const validationError = validate(data);

        if (validationError) {
            return errorResponse(validationError, 422);
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const relationError = await validateRelations(connection, data);

        if (relationError) {
            await connection.rollback();
            transactionStarted = false;

            return errorResponse(relationError, 422);
        }

        if (["Scheduled", "Active"].includes(data.status)) {
            const conflict = await hasCoachConflict(connection, data);

            if (conflict) {
                await connection.rollback();
                transactionStarted = false;

                return errorResponse(
                    "Coach already has an overlapping training schedule.",
                    409
                );
            }
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_individual_training(
                                    academy_id,
                                    branch_id,
                                    user_program_id,
                                    coach_user_id,
                                    training_days,
                                    start_time,
                                    end_time,
                                    start_date,
                                    end_date,
                                    session_duration,
                                    status,
                                    remarks
                                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.academy_id,
                data.branch_id,
                data.user_program_id,
                data.coach_user_id,
                data.training_days,
                data.start_time,
                data.end_time,
                data.start_date,
                data.end_date,
                data.session_duration,
                data.status,
                data.remarks,
            ]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Individual training created successfully.",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("POST individual training:", error);

        return NextResponse.json(
            { success: false, message: "Failed to create training record." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}