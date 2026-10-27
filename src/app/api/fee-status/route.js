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

function getNullableId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isInteger(number) && number > 0
        ? number
        : NaN;
}

function getNullableText(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return String(value).trim();
}

function validateFeeData(body, isUpdate = false) {
    if (
        !isUpdate &&
        (!isPositiveInt(body.academy_id) ||
            !FEE_TYPES.includes(body.fee_type))
    ) {
        return {
            valid: false,
            message: "Valid academy_id and fee_type are required.",
        };
    }

    if (
        body.fee_type !== undefined &&
        !FEE_TYPES.includes(body.fee_type)
    ) {
        return {
            valid: false,
            message: "Invalid fee_type.",
        };
    }

    const nullableIds = [
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
        "created_by",
    ];

    for (const field of nullableIds) {
        if (
            Object.prototype.hasOwnProperty.call(body, field) &&
            getNullableId(body[field]) !== null &&
            !Number.isInteger(getNullableId(body[field]))
        ) {
            return {
                valid: false,
                message: `${field} must be a positive integer or null.`,
            };
        }
    }

    for (const field of ["fee_amount", "paid_amount"]) {
        if (
            Object.prototype.hasOwnProperty.call(body, field) &&
            !isValidAmount(body[field])
        ) {
            return {
                valid: false,
                message: `${field} must be a valid non-negative amount.`,
            };
        }
    }

    if (
        body.status !== undefined &&
        !FEE_STATUSES.includes(body.status)
    ) {
        return {
            valid: false,
            message: "Invalid fee status.",
        };
    }

    return { valid: true };
}

function getCalculatedStatus(feeAmount, paidAmount) {
    if (Number(paidAmount) === 0) {
        return "Pending";
    }

    if (Number(paidAmount) >= Number(feeAmount)) {
        return "Paid";
    }

    return "Partial";
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

    // Table and column names above are fixed constants, not user input.
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

        case "Other":
            break;
    }

    return null;
}

// GET /api/fee-status
// Examples:
// /api/fee-status?academy_id=1
// /api/fee-status?academy_id=1&branch_id=2
// /api/fee-status?fee_type=Match Player
// /api/fee-status?status=Pending
// /api/fee-status?match_id=10
// /api/fee-status?user_id=25

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const filterFields = [
            "id",
            "academy_id",
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
            "created_by",
        ];

        const conditions = [];
        const values = [];

        for (const field of filterFields) {
            const value = searchParams.get(field);

            if (value !== null && value !== "") {
                if (!isPositiveInt(value)) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${field} must be a positive integer.`,
                        },
                        { status: 400 }
                    );
                }

                conditions.push(`fs.${field} = ?`);
                values.push(Number(value));
            }
        }

        const feeType = searchParams.get("fee_type");

        if (feeType) {
            if (!FEE_TYPES.includes(feeType)) {
                return NextResponse.json(
                    { success: false, message: "Invalid fee_type." },
                    { status: 400 }
                );
            }

            conditions.push("fs.fee_type = ?");
            values.push(feeType);
        }

        const status = searchParams.get("status");

        if (status) {
            if (!FEE_STATUSES.includes(status)) {
                return NextResponse.json(
                    { success: false, message: "Invalid fee status." },
                    { status: 400 }
                );
            }

            conditions.push("fs.status = ?");
            values.push(status);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
                fs.*,
                a.academy_name,
                b.branch_name,
                t.tournament_name,
                mt.match_no,
                mt.match_date,
                g.ground_name,
                COALESCE(u.first_name, ttp_u.first_name, mp_u.first_name) AS first_name,
                COALESCE(u.last_name, ttp_u.last_name, mp_u.last_name) AS last_name,
                COALESCE(op.player_name, ttp_op.player_name, mp_op.player_name) AS outside_player_name,
                tt_team.team_name AS tournament_team_name,
                mt_t.team_name AS match_team_name,
                op.player_name,
                op.id AS outside_player_record_id
             FROM cst_fee_status fs
             LEFT JOIN cst_academy a
                ON a.id = fs.academy_id
             LEFT JOIN cst_branch b
                ON b.id = fs.branch_id
             LEFT JOIN cst_tournaments t
                ON t.id = fs.tournament_id
             LEFT JOIN cst_matches mt
                ON mt.id = fs.match_id
             LEFT JOIN cst_ground_bookings gb
                ON gb.id = fs.ground_booking_id
             LEFT JOIN cst_ground g
                ON g.id = gb.ground_id
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
             ${whereClause}
             ORDER BY fs.id DESC`,
            values
        );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET fee status error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch fee records.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST /api/fee-status
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const validation = validateFeeData(body);

        if (!validation.valid) {
            return NextResponse.json(
                { success: false, message: validation.message },
                { status: 400 }
            );
        }

        const data = {
            academy_id: Number(body.academy_id),
            branch_id: getNullableId(body.branch_id),
            fee_type: body.fee_type,

            tournament_id: getNullableId(body.tournament_id),
            tournament_team_id: getNullableId(body.tournament_team_id),
            tournament_team_player_id: getNullableId(
                body.tournament_team_player_id
            ),

            match_id: getNullableId(body.match_id),
            match_team_id: getNullableId(body.match_team_id),
            match_player_id: getNullableId(body.match_player_id),

            ground_booking_id: getNullableId(body.ground_booking_id),

            user_id: getNullableId(body.user_id),
            outside_player_id: getNullableId(body.outside_player_id),

            fee_amount:
                body.fee_amount === undefined
                    ? 0
                    : Number(body.fee_amount),

            paid_amount:
                body.paid_amount === undefined
                    ? 0
                    : Number(body.paid_amount),

            remarks: getNullableText(body.remarks),
            created_by: getNullableId(body.created_by),
        };

        if (
            Object.values(data).some(
                (value) => typeof value === "number" && !Number.isFinite(value)
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "One or more supplied values are invalid.",
                },
                { status: 400 }
            );
        }

        if (data.paid_amount > data.fee_amount) {
            return NextResponse.json(
                {
                    success: false,
                    message: "paid_amount cannot exceed fee_amount.",
                },
                { status: 400 }
            );
        }

        const referenceError = validateFeeTypeReferences(data);

        if (referenceError) {
            return NextResponse.json(
                { success: false, message: referenceError },
                { status: 400 }
            );
        }

        const status = body.status ?? getCalculatedStatus(
            data.fee_amount,
            data.paid_amount
        );

        if (!FEE_STATUSES.includes(status)) {
            return NextResponse.json(
                { success: false, message: "Invalid fee status." },
                { status: 400 }
            );
        }

        if (
            status !== "Cancelled" &&
            status !== getCalculatedStatus(
                data.fee_amount,
                data.paid_amount
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Fee status must match fee_amount and paid_amount.",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const referenceErrorFromDb = await validateForeignKeys(
            connection,
            data
        );

        if (referenceErrorFromDb) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: referenceErrorFromDb },
                { status: 400 }
            );
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_fee_status (
                academy_id,
                branch_id,
                fee_type,
                tournament_id,
                tournament_team_id,
                tournament_team_player_id,
                match_id,
                match_team_id,
                match_player_id,
                ground_booking_id,
                user_id,
                outside_player_id,
                fee_amount,
                paid_amount,
                status,
                remarks,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                status,
                data.remarks,
                data.created_by,
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Fee record created successfully.",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST fee status error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create fee record.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}