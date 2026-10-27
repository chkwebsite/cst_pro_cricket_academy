import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: All scorecard records
// Filters: ?match_id=1&innings_id=1
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const match_id = searchParams.get("match_id");
        const innings_id = searchParams.get("innings_id");

        let sql = `
SELECT
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
            WHERE 1 = 1
    `;

        const values = [];

        if (match_id) {
            sql += " AND sc.match_id = ?";
            values.push(match_id);
        }

        if (innings_id) {
            sql += " AND sc.innings_id = ?";
            values.push(innings_id);
        }

        sql += " ORDER BY sc.innings_id ASC, sc.batting_position ASC, sc.id ASC";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("GET Match Scorecard Error:", error);

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

// POST: Create scorecard record
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            match_id,
            innings_id,
            match_player_id,
            batting_position = null,
            runs = 0,
            balls = 0,
            fours = 0,
            sixes = 0,
            strike_rate = 0,
            dismissal_type = "Not Out",
            dismissed_by_player_id = null,
            fielder_player_id = null,
        } = body;

        if (!match_id || !innings_id || !match_player_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "match_id, innings_id and match_player_id are required",
                },
                { status: 400 }
            );
        }

        const numericFields = {
            runs,
            balls,
            fours,
            sixes,
            strike_rate,
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
                        message: `${ field } must be a non - negative number`,
                    },
                    { status: 400 }
                );
            }
        }

        for (const field of ["runs", "balls", "fours", "sixes"]) {
            if (!Number.isInteger(Number(numericFields[field]))) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${ field } must be an integer`,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            batting_position !== null &&
            (!Number.isInteger(Number(batting_position)) ||
                Number(batting_position) < 1 ||
                Number(batting_position) > 255)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "batting_position must be null or an integer from 1 to 255",
                },
                { status: 400 }
            );
        }

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

        if (!validDismissals.includes(dismissal_type)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid dismissal_type",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Verify innings belongs to the specified match
        const [inningsRows] = await connection.execute(
            `SELECT id, match_id, batting_team_id
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

        // Verify player is registered for this match and batting team
        const [playerRows] = await connection.execute(
            `SELECT id, match_id, team_id
             FROM cst_match_players
             WHERE id = ? AND match_id = ? AND team_id = ? `,
            [
                match_player_id,
                match_id,
                inningsRows[0].batting_team_id,
            ]
        );

        if (playerRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Player is not registered with the batting team for this match",
                },
                { status: 400 }
            );
        }

        // Validate dismissal-related players
        if (
            dismissed_by_player_id !== null &&
            dismissed_by_player_id !== "" &&
            Number(dismissed_by_player_id) === Number(match_player_id)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A batter cannot be their own dismissed_by player",
                },
                { status: 400 }
            );
        }

        for (const [field, playerId] of [
            ["dismissed_by_player_id", dismissed_by_player_id],
            ["fielder_player_id", fielder_player_id],
        ]) {
            if (playerId !== null && playerId !== "") {
                const [rows] = await connection.execute(
                    `SELECT id
                     FROM cst_match_players
                     WHERE id = ? AND match_id = ? `,
                    [playerId, match_id]
                );

                if (rows.length === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${ field } is not a player registered for this match`,
                        },
                        { status: 400 }
                    );
                }
            }
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_match_scorecard(
        match_id,
        innings_id,
        match_player_id,
        batting_position,
        runs,
        balls,
        fours,
        sixes,
        strike_rate,
        dismissal_type,
        dismissed_by_player_id,
        fielder_player_id
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                match_id,
                innings_id,
                match_player_id,
                batting_position,
                runs,
                balls,
                fours,
                sixes,
                strike_rate,
                dismissal_type,
                dismissed_by_player_id || null,
                fielder_player_id || null,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Match scorecard created successfully",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST Match Scorecard Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This player already has a scorecard entry for this innings",
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
                message: "Failed to create match scorecard",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}