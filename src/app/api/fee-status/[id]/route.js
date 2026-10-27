import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


const FEE_TYPES = [
    "Tournament Team",
    "Tournament Player",
    "Match Team",
    "Match Player",
    "Ground Booking",
    "Other",
];

const FEE_STATUSES = [
    "Pending",
    "Partial",
    "Paid",
    "Cancelled",
];

const isPositiveInt = (value) =>
    Number.isInteger(Number(value)) && Number(value) > 0;

const isValidAmount = (value) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0;

const getNullableId = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isInteger(number) && number > 0
        ? number
        : NaN;
};

function getCalculatedStatus(feeAmount, paidAmount) {
    if (Number(paidAmount) === 0) return "Pending";
    if (Number(paidAmount) >= Number(feeAmount)) return "Paid";
    return "Partial";
}

function validateFeeTypeReferences(data) {
    const has = (field) =>
        data[field] !== undefined &&
        data[field] !== null &&
        data[field] !== "";

    switch (data.fee_type) {
        case "Tournament Team":
            if (!has("tournament_id") || !has("tournament_team_id")) {
                return "tournament_id and tournament_team_id are required for Tournament Team fees.";
            }
            break;

        case "Tournament Player":
            if (
                !has("tournament_id") ||
                !has("tournament_team_player_id")
            ) {
                return "tournament_id and tournament_team_player_id are required for Tournament Player fees.";
            }
            break;

        case "Match Team":
            if (!has("match_id") || !has("match_team_id")) {
                return "match_id and match_team_id are required for Match Team fees.";
            }
            break;

        case "Match Player":
            if (!has("match_id") || !has("match_player_id")) {
                return "match_id and match_player_id are required for Match Player fees.";
            }
            break;

        case "Ground Booking":
            if (!has("ground_booking_id")) {
                return "ground_booking_id is required for Ground Booking fees.";
            }
            break;
    }

    return null;
}

async function validateForeignKeys(connection, data) {
    const checks = [
        ["academy_id", "cst_academy"],
        ["branch_id", "cst_branch"],
        ["tournament_id", "cst_tournaments"],
        ["tournament_team_id", "cst_tournament_teams"],
        ["tournament_team_player_id", "cst_tournament_team_players"],
        ["match_id", "cst_matches"],
        ["match_team_id", "cst_match_teams"],
        ["match_player_id", "cst_match_players"],
        ["ground_booking_id", "cst_ground_bookings"],
        ["user_id", "cst_users"],
        ["outside_player_id", "cst_outside_players"],
        ["created_by", "cst_users"],
    ];

    for (const [field, table] of checks) {
        const value = data[field];

        if (value === undefined || value === null || value === "") {
            continue;
        }

        const [rows] = await connection.execute(
            `SELECT id FROM ${table} WHERE id = ? LIMIT 1`,
            [Number(value)]
        );

        if (!rows.length) {
            return `${field} record not found.`;
        }
    }

    return null;
}

// GET /api/fee-status/10
export async function GET(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid fee record ID." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
                fs.*,
                a.academy_name,
                b.branch_name,
                t.tournament_name,
                m.match_no,
                m.match_date,
                COALESCE(u.first_name, ttp_u.first_name, mp_u.first_name) AS first_name,
                COALESCE(u.last_name, ttp_u.last_name, mp_u.last_name) AS last_name,
                COALESCE(op.player_name, ttp_op.player_name, mp_op.player_name) AS outside_player_name,
                tt_team.team_name AS tournament_team_name,
                mt_t.team_name AS match_team_name
             FROM cst_fee_status fs
             LEFT JOIN cst_academy a
                ON a.id = fs.academy_id
             LEFT JOIN cst_branch b
                ON b.id = fs.branch_id
             LEFT JOIN cst_tournaments t
                ON t.id = fs.tournament_id
             LEFT JOIN cst_matches m
                ON m.id = fs.match_id
             LEFT JOIN cst_users u
                ON u.id = fs.user_id
             LEFT JOIN cst_outside_players op
                ON op.id = fs.outside_player_id
             LEFT JOIN cst_tournament_teams tt
                ON tt.id = fs.tournament_team_id
             LEFT JOIN cst_teams tt_team
                ON tt_team.id = tt.team_id
             LEFT JOIN cst_tournament_team_players ttp
                ON ttp.id = fs.tournament_team_player_id
             LEFT JOIN cst_users ttp_u
                ON ttp_u.id = ttp.user_id
             LEFT JOIN cst_outside_players ttp_op
                ON ttp_op.id = ttp.outside_player_id
             LEFT JOIN cst_match_teams mt_team
                ON mt_team.id = fs.match_team_id
             LEFT JOIN cst_teams mt_t
                ON mt_t.id = mt_team.team_id
             LEFT JOIN cst_match_players mp
                ON mp.id = fs.match_player_id
             LEFT JOIN cst_users mp_u
                ON mp_u.id = mp.user_id
             LEFT JOIN cst_outside_players mp_op
                ON mp_op.id = mp.outside_player_id
             WHERE fs.id = ?
             LIMIT 1`,
            [Number(id)]
        );

        if (!rows.length) {
            return NextResponse.json(
                { success: false, message: "Fee record not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET single fee status error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch fee record.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT /api/fee-status/10
export async function PUT(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid fee record ID." },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            `SELECT *
             FROM cst_fee_status
             WHERE id = ?
             FOR UPDATE`,
            [Number(id)]
        );

        if (!existingRows.length) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Fee record not found." },
                { status: 404 }
            );
        }

        const old = existingRows[0];

        const nullableFields = [
            "branch_id",
            "tournament_id",
            "tournament_team_id",
            "tournament_team_player_id",
            "match_id",
            "match_team_id",
            "match_player_id",
            "ground_booking_id",
            "user_id",
            "outside_player_id",
        ];

        const data = {
            academy_id:
                body.academy_id === undefined
                    ? Number(old.academy_id)
                    : Number(body.academy_id),

            fee_type: body.fee_type ?? old.fee_type,

            fee_amount:
                body.fee_amount === undefined
                    ? Number(old.fee_amount)
                    : Number(body.fee_amount),

            paid_amount:
                body.paid_amount === undefined
                    ? Number(old.paid_amount)
                    : Number(body.paid_amount),

            status: body.status ?? old.status,

            remarks:
                body.remarks === undefined
                    ? old.remarks
                    : body.remarks === null || body.remarks === ""
                        ? null
                        : String(body.remarks).trim(),

            created_by:
                body.created_by === undefined
                    ? old.created_by
                    : getNullableId(body.created_by),
        };

        for (const field of nullableFields) {
            data[field] =
                body[field] === undefined
                    ? old[field]
                    : getNullableId(body[field]);
        }

        if (!isPositiveInt(data.academy_id)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid academy_id." },
                { status: 400 }
            );
        }

        if (!FEE_TYPES.includes(data.fee_type)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid fee_type." },
                { status: 400 }
            );
        }

        for (const field of nullableFields) {
            if (
                data[field] !== null &&
                !Number.isInteger(data[field])
            ) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: `${field} must be a positive integer or null.`,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            !isValidAmount(data.fee_amount) ||
            !isValidAmount(data.paid_amount)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Fee amounts must be non-negative numbers.",
                },
                { status: 400 }
            );
        }

        if (data.paid_amount > data.fee_amount) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "paid_amount cannot exceed fee_amount.",
                },
                { status: 400 }
            );
        }

        if (!FEE_STATUSES.includes(data.status)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid fee status." },
                { status: 400 }
            );
        }

        if (
            data.status !== "Cancelled" &&
            data.status !== getCalculatedStatus(
                data.fee_amount,
                data.paid_amount
            )
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Fee status must match fee_amount and paid_amount.",
                },
                { status: 400 }
            );
        }

        const referenceError = validateFeeTypeReferences(data);

        if (referenceError) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: referenceError },
                { status: 400 }
            );
        }

        const dbError = await validateForeignKeys(connection, data);

        if (dbError) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: dbError },
                { status: 400 }
            );
        }

        await connection.execute(
            `UPDATE cst_fee_status
             SET academy_id = ?,
                 branch_id = ?,
                 fee_type = ?,
                 tournament_id = ?,
                 tournament_team_id = ?,
                 tournament_team_player_id = ?,
                 match_id = ?,
                 match_team_id = ?,
                 match_player_id = ?,
                 ground_booking_id = ?,
                 user_id = ?,
                 outside_player_id = ?,
                 fee_amount = ?,
                 paid_amount = ?,
                 status = ?,
                 remarks = ?,
                 created_by = ?
             WHERE id = ?`,
            [
                data.academy_id,
                data.branch_id,
                data.fee_type,
                data.tournament_id,
                data.tournament_team_id,
                data.tournament_team_player_id,
                data.match_id,
                data.match_team_id,
                data.match_player_id,
                data.ground_booking_id,
                data.user_id,
                data.outside_player_id,
                data.fee_amount,
                data.paid_amount,
                data.status,
                data.remarks,
                data.created_by,
                Number(id),
            ]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Fee record updated successfully.",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("PUT fee status error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update fee record.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE /api/fee-status/10
export async function DELETE(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid fee record ID." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            "SELECT id FROM cst_fee_status WHERE id = ? LIMIT 1",
            [Number(id)]
        );

        if (!rows.length) {
            return NextResponse.json(
                { success: false, message: "Fee record not found." },
                { status: 404 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_fee_status WHERE id = ?",
            [Number(id)]
        );

        return NextResponse.json({
            success: true,
            message: "Fee record deleted successfully.",
        });
    } catch (error) {
        console.error("DELETE fee status error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete fee record.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}