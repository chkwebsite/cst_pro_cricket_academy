import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: Single bowling scorecard record
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
bs.*,
    mi.innings_no,
    mi.batting_team_id,
    mi.bowling_team_id,
    mp.team_id,
    mp.user_id,
    mp.outside_player_id,
    u.name AS player_name
             FROM cst_match_bowling_scorecard bs
             INNER JOIN cst_match_innings mi
                ON mi.id = bs.innings_id
             INNER JOIN cst_match_players mp
                ON mp.id = bs.match_player_id
             LEFT JOIN cst_users u
                ON u.id = mp.user_id
             WHERE bs.id = ?
    LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Bowling scorecard not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Single Bowling Scorecard Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch bowling scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update bowling scorecard record
export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "overs",
            "balls_bowled",
            "maidens",
            "runs_conceded",
            "wickets",
            "wides",
            "no_balls",
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                updates.push(`${field} = ?`);
                values.push(body[field]);
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
            "SELECT * FROM cst_match_bowling_scorecard WHERE id = ?",
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Bowling scorecard not found",
                },
                { status: 404 }
            );
        }

        const existing = existingRows[0];
        const updated = { ...existing, ...body };

        const numericFields = [
            "overs",
            "balls_bowled",
            "maidens",
            "runs_conceded",
            "wickets",
            "wides",
            "no_balls",
        ];

        for (const field of numericFields) {
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

        for (const field of [
            "balls_bowled",
            "maidens",
            "runs_conceded",
            "wickets",
            "wides",
            "no_balls",
        ]) {
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

        // Validate cricket overs format
        const oversValue = Number(updated.overs);
        const completeOvers = Math.floor(oversValue);
        const ballsInOvers = Math.round(
            (oversValue - completeOvers) * 10
        );

        if (
            ballsInOvers < 0 ||
            ballsInOvers > 5 ||
            Math.abs(
                oversValue -
                (completeOvers + ballsInOvers / 10)
            ) > 0.000001
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid overs format. Use values like 12.4",
                },
                { status: 400 }
            );
        }

        const calculatedBalls = completeOvers * 6 + ballsInOvers;

        if (Number(updated.balls_bowled) !== calculatedBalls) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "balls_bowled must match overs. Example: 12.4 overs = 76 balls",
                },
                { status: 400 }
            );
        }

        // Recalculate economy on every update
        const economy =
            Number(updated.balls_bowled) > 0
                ? Number(
                    (
                        (Number(updated.runs_conceded) * 6) /
                        Number(updated.balls_bowled)
                    ).toFixed(2)
                )
                : 0;

        updates.push("economy = ?");
        values.push(economy);
        values.push(id);

        await connection.execute(
            `UPDATE cst_match_bowling_scorecard
             SET ${updates.join(", ")}
             WHERE id = ? `,
            values
        );

        return NextResponse.json({
            success: true,
            message: "Bowling scorecard updated successfully",
            economy,
        });
    } catch (error) {
        console.error("PUT Bowling Scorecard Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update bowling scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Delete bowling scorecard record
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            "SELECT id FROM cst_match_bowling_scorecard WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Bowling scorecard not found",
                },
                { status: 404 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_match_bowling_scorecard WHERE id = ?",
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Bowling scorecard deleted successfully",
        });
    } catch (error) {
        console.error("DELETE Bowling Scorecard Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete bowling scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}