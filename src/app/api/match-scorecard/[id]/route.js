import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: Single scorecard record
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
sc.*,
    mi.innings_no,
    mi.batting_team_id,
    mi.bowling_team_id,
    mp.team_id,
    mp.user_id,
    mp.outside_player_id,
    u.name AS player_name
             FROM cst_match_scorecard sc
             INNER JOIN cst_match_innings mi
                ON mi.id = sc.innings_id
             INNER JOIN cst_match_players mp
                ON mp.id = sc.match_player_id
             LEFT JOIN cst_users u
                ON u.id = mp.user_id
             WHERE sc.id = ?
    LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match scorecard not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Single Match Scorecard Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch match scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update scorecard record
export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "batting_position",
            "runs",
            "balls",
            "fours",
            "sixes",
            "strike_rate",
            "dismissal_type",
            "dismissed_by_player_id",
            "fielder_player_id",
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                updates.push(`${field} = ?`);
                values.push(body[field] === "" ? null : body[field]);
            }
        }

        if (updates.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No valid fields provided for update",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [existingRows] = await connection.execute(
            "SELECT * FROM cst_match_scorecard WHERE id = ?",
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match scorecard not found",
                },
                { status: 404 }
            );
        }

        const existing = existingRows[0];
        const updated = { ...existing, ...body };

        const validDismissals = [
            "Not Out",
            "Bowled",
            "Caught",
            "LBW",
            "Run Out",
            "Stumped",
            "Hit Wicket",
            "Retired Hurt",
            "Retired Out",
            "Obstructing Field",
            "Timed Out",
        ];

        if (!validDismissals.includes(updated.dismissal_type)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid dismissal_type",
                },
                { status: 400 }
            );
        }

        for (const field of ["runs", "balls", "fours", "sixes", "strike_rate"]) {
            if (
                updated[field] === null ||
                updated[field] === "" ||
                !Number.isFinite(Number(updated[field])) ||
                Number(updated[field]) < 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${field} must be a non - negative number`,
                    },
                    { status: 400 }
                );
            }
        }

        for (const field of ["runs", "balls", "fours", "sixes"]) {
            if (!Number.isInteger(Number(updated[field]))) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${field} must be an integer`,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            updated.batting_position !== null &&
            (!Number.isInteger(Number(updated.batting_position)) ||
                Number(updated.batting_position) < 1 ||
                Number(updated.batting_position) > 255)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "batting_position must be null or an integer from 1 to 255",
                },
                { status: 400 }
            );
        }

        // Validate dismissed_by_player_id and fielder_player_id
        for (const field of [
            "dismissed_by_player_id",
            "fielder_player_id",
        ]) {
            const playerId = updated[field];

            if (playerId !== null && playerId !== "") {
                const [playerRows] = await connection.execute(
                    `SELECT id
                     FROM cst_match_players
                     WHERE id = ? AND match_id = ? `,
                    [playerId, existing.match_id]
                );

                if (playerRows.length === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${field} is not registered for this match`,
                        },
                        { status: 400 }
                    );
                }
            }
        }

        if (
            updated.dismissed_by_player_id !== null &&
            Number(updated.dismissed_by_player_id) ===
            Number(existing.match_player_id)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A batter cannot be their own dismissed_by player",
                },
                { status: 400 }
            );
        }

        values.push(id);

        await connection.execute(
            `UPDATE cst_match_scorecard
             SET ${updates.join(", ")}
             WHERE id = ? `,
            values
        );

        return NextResponse.json({
            success: true,
            message: "Match scorecard updated successfully",
        });
    } catch (error) {
        console.error("PUT Match Scorecard Error:", error);

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid player reference",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update match scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Delete scorecard record
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            "SELECT id FROM cst_match_scorecard WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match scorecard not found",
                },
                { status: 404 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_match_scorecard WHERE id = ?",
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Match scorecard deleted successfully",
        });
    } catch (error) {
        console.error("DELETE Match Scorecard Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete match scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}