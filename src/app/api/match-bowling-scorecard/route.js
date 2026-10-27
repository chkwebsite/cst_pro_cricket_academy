import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: All bowling scorecard records
// Filters: ?match_id=1&innings_id=1
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const match_id = searchParams.get("match_id");
        const innings_id = searchParams.get("innings_id");

        let sql = `
SELECT
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
            WHERE 1 = 1
    `;

        const values = [];

        if (match_id) {
            sql += " AND bs.match_id = ?";
            values.push(match_id);
        }

        if (innings_id) {
            sql += " AND bs.innings_id = ?";
            values.push(innings_id);
        }

        sql += " ORDER BY bs.innings_id ASC, bs.wickets DESC, bs.id ASC";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("GET Bowling Scorecard Error:", error);

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

// POST: Create bowling scorecard record
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            match_id,
            innings_id,
            match_player_id,
            overs = 0,
            balls_bowled = 0,
            maidens = 0,
            runs_conceded = 0,
            wickets = 0,
            wides = 0,
            no_balls = 0,
        } = body;

        if (!match_id || !innings_id || !match_player_id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "match_id, innings_id and match_player_id are required",
                },
                { status: 400 }
            );
        }

        // Validate numeric fields
        const numericFields = {
            overs,
            balls_bowled,
            maidens,
            runs_conceded,
            wickets,
            wides,
            no_balls,
        };

        for (const [field, value] of Object.entries(numericFields)) {
            if (
                value === null ||
                value === "" ||
                !Number.isFinite(Number(value)) ||
                Number(value) < 0
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
            if (!Number.isInteger(Number(numericFields[field]))) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${field} must be an integer`,
                    },
                    { status: 400 }
                );
            }
        }

        // Cricket overs: 12.4 means 12 overs and 4 balls.
        // Fractional part must be between 0 and 5.
        const oversValue = Number(overs);
        const completeOvers = Math.floor(oversValue);
        const ballsInOvers = Math.round(
            (oversValue - completeOvers) * 10
        );

        if (
            !Number.isInteger(oversValue) &&
            (ballsInOvers < 0 || ballsInOvers > 5)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid overs format. Use values like 12.4, not 12.7",
                },
                { status: 400 }
            );
        }

        if (
            !Number.isInteger(oversValue) &&
            Math.abs(
                oversValue -
                (completeOvers + ballsInOvers / 10)
            ) > 0.000001
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid cricket overs format",
                },
                { status: 400 }
            );
        }

        // Convert overs into actual balls and check consistency.
        const calculatedBalls = completeOvers * 6 + ballsInOvers;

        if (Number(balls_bowled) !== calculatedBalls) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "balls_bowled must match overs. Example: 12.4 overs = 76 balls",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Verify innings belongs to the match
        const [inningsRows] = await connection.execute(
            `SELECT id, match_id, batting_team_id, bowling_team_id
             FROM cst_match_innings
             WHERE id = ? AND match_id = ? `,
            [innings_id, match_id]
        );

        if (inningsRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Innings not found for this match",
                },
                { status: 404 }
            );
        }

        // Verify bowler belongs to the bowling team
        const [playerRows] = await connection.execute(
            `SELECT id
             FROM cst_match_players
             WHERE id = ?
    AND match_id = ?
        AND team_id = ? `,
            [
                match_player_id,
                match_id,
                inningsRows[0].bowling_team_id,
            ]
        );

        if (playerRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Bowler is not registered with the bowling team for this match",
                },
                { status: 400 }
            );
        }

        // Economy = runs conceded / overs bowled
        // Calculate using actual balls to avoid decimal-overs errors.
        const economy =
            Number(balls_bowled) > 0
                ? Number(
                    (
                        (Number(runs_conceded) * 6) /
                        Number(balls_bowled)
                    ).toFixed(2)
                )
                : 0;

        const [result] = await connection.execute(
            `INSERT INTO cst_match_bowling_scorecard(
            match_id,
            innings_id,
            match_player_id,
            overs,
            balls_bowled,
            maidens,
            runs_conceded,
            wickets,
            wides,
            no_balls,
            economy
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                match_id,
                innings_id,
                match_player_id,
                oversValue,
                balls_bowled,
                maidens,
                runs_conceded,
                wickets,
                wides,
                no_balls,
                economy,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Bowling scorecard created successfully",
                id: result.insertId,
                economy,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST Bowling Scorecard Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This bowler already has a record for this innings",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid match, innings or player reference",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create bowling scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}