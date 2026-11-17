import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser, verifyRecordAccess } from "@/app/components/lib/tenant-isolation";

// GET: All scorecard records
// Filters: ?match_id=1&innings_id=1
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const authUser = await getAuthenticatedUser(request);

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
                COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.player_name, '') AS player_name
            FROM cst_match_scorecard sc
            INNER JOIN cst_matches m
                ON m.id = sc.match_id
            INNER JOIN cst_match_innings mi
                ON mi.id = sc.innings_id
            INNER JOIN cst_match_players mp
                ON mp.id = sc.match_player_id
            LEFT JOIN cst_users u
                ON u.id = mp.user_id
            LEFT JOIN cst_outside_players op
                ON op.id = mp.outside_player_id
            WHERE 1 = 1
        `;

        const values = [];

        if (authUser) {
            if (authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
                if (authUser.academy_id) {
                    sql += " AND m.academy_id = ?";
                    values.push(authUser.academy_id);
                }
                sql += " AND m.id IN (SELECT match_id FROM cst_match_players WHERE user_id = ?)";
                values.push(authUser.id);
            } else if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND m.branch_id = ? AND m.academy_id = ?";
                values.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND m.academy_id = ?";
                values.push(authUser.academy_id);
                const branchIdParam = searchParams.get("branch_id");
                if (branchIdParam) {
                    sql += " AND m.branch_id = ?";
                    values.push(Number(branchIdParam));
                }
            } else if (authUser.isAccountant && authUser.academy_id) {
                sql += " AND m.academy_id = ?";
                values.push(authUser.academy_id);
                if (authUser.branch_id) {
                    sql += " AND m.branch_id = ?";
                    values.push(authUser.branch_id);
                } else if (authUser.accessibleBranchIds && authUser.accessibleBranchIds.length > 0) {
                    sql += ` AND m.branch_id IN (${authUser.accessibleBranchIds.map(() => "?").join(",")})`;
                    values.push(...authUser.accessibleBranchIds);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND m.academy_id = ?";
                values.push(authUser.academy_id);
                if (authUser.accessibleBranchIds && authUser.accessibleBranchIds.length > 0) {
                    sql += ` AND (m.branch_id IS NULL OR m.branch_id IN (${authUser.accessibleBranchIds.map(() => "?").join(",")}))`;
                    values.push(...authUser.accessibleBranchIds);
                }
            } else if (authUser.isSuperAdmin) {
                const academyIdParam = searchParams.get("academy_id");
                if (academyIdParam) {
                    sql += " AND m.academy_id = ?";
                    values.push(Number(academyIdParam));
                }
                const branchIdParam = searchParams.get("branch_id");
                if (branchIdParam) {
                    sql += " AND m.branch_id = ?";
                    values.push(Number(branchIdParam));
                }
            }
        }

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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot manage match scorecards." },
            { status: 403 }
        );
    }

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

        // Verify match exists and check tenant access
        const [matchRows] = await connection.execute(
            "SELECT id, academy_id, branch_id, overs FROM cst_matches WHERE id = ? LIMIT 1",
            [match_id]
        );

        if (matchRows.length === 0) {
            return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
        }

        if (!verifyRecordAccess(authUser, { academy_id: matchRows[0].academy_id, branch_id: matchRows[0].branch_id })) {
            return NextResponse.json({ success: false, message: "Forbidden. Match belongs to another academy or branch." }, { status: 403 });
        }

        const matchOvers = matchRows[0].overs ? Number(matchRows[0].overs) : 20;
        const matchMaxBalls = matchOvers * 6;

        // Verify innings belongs to the specified match and get total_runs, extras, target_runs, overs, balls
        const [inningsRows] = await connection.execute(
            `SELECT id, match_id, batting_team_id, total_runs, extras, target_runs, total_overs, total_balls
             FROM cst_match_innings
             WHERE id = ? AND match_id = ?`,
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

        const inningsTotalRuns = Number(inningsRows[0].total_runs) || 0;
        const inningsExtras = Number(inningsRows[0].extras) || 0;
        const inningsTargetRuns = inningsRows[0].target_runs !== null && inningsRows[0].target_runs !== undefined && inningsRows[0].target_runs !== ""
            ? Number(inningsRows[0].target_runs)
            : (inningsTotalRuns > 0 ? inningsTotalRuns + inningsExtras : 0);

        const rawInningsOvers = Number(inningsRows[0].total_overs) || 0;
        const completeOversInn = Math.floor(rawInningsOvers);
        const remBallsInn = Math.round((rawInningsOvers - completeOversInn) * 10);
        const inningsTotalBalls = inningsRows[0].total_balls
            ? Number(inningsRows[0].total_balls)
            : (rawInningsOvers > 0 ? (completeOversInn * 6 + (remBallsInn >= 0 && remBallsInn <= 5 ? remBallsInn : 0)) : matchMaxBalls);
        const maxBallsForInnings = Math.min(inningsTotalBalls, matchMaxBalls);

        // Fetch sum of runs and balls faced by existing batters in this innings
        const [battersSumRows] = await connection.execute(
            `SELECT 
                COALESCE(SUM(runs), 0) AS total_batter_runs,
                COALESCE(SUM(balls), 0) AS total_batter_balls
             FROM cst_match_scorecard
             WHERE innings_id = ?`,
            [innings_id]
        );

        const currentBattersRuns = Number(battersSumRows[0]?.total_batter_runs) || 0;
        const currentBattersBalls = Number(battersSumRows[0]?.total_batter_balls) || 0;
        const newBatterRuns = Number(runs) || 0;
        const newBatterBalls = Number(balls) || 0;
        const newFours = Number(fours) || 0;
        const newSixes = Number(sixes) || 0;

        // 1. Validate Balls Faced against match overs (e.g. 20 overs = 120 balls)
        if (newBatterBalls > matchMaxBalls) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Balls faced mismatch! Match is ${matchOvers} overs (${matchMaxBalls} balls). A batter cannot face ${newBatterBalls} balls in a ${matchOvers}-over match.`,
                },
                { status: 400 }
            );
        }

        const newTotalBallsFaced = currentBattersBalls + newBatterBalls;
        if (newTotalBallsFaced > maxBallsForInnings) {
            const maxAllowedBalls = Math.max(0, maxBallsForInnings - currentBattersBalls);
            return NextResponse.json(
                {
                    success: false,
                    message: `Balls faced mismatch! Match is ${matchOvers} overs (${matchMaxBalls} balls max, innings total: ${maxBallsForInnings} balls). Other batters have faced ${currentBattersBalls} balls. This batter can face at most ${maxAllowedBalls} ball(s), but ${newBatterBalls} was entered (Total would be ${newTotalBallsFaced}).`,
                },
                { status: 400 }
            );
        }

        // 2. Validate Boundary runs & count
        if (newFours * 4 + newSixes * 6 > newBatterRuns) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Boundary runs mismatch! ${newFours} fours (4s) and ${newSixes} sixes (6s) equal ${newFours * 4 + newSixes * 6} runs, which cannot exceed total runs scored (${newBatterRuns}).`,
                },
                { status: 400 }
            );
        }

        if (newBatterBalls > 0 && (newFours + newSixes > newBatterBalls)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Boundary count mismatch! Total boundaries (${newFours + newSixes}) cannot exceed balls faced (${newBatterBalls}).`,
                },
                { status: 400 }
            );
        }

        // 3. Validate that adding this batter's runs does not exceed target_runs or total_runs
        if (inningsTargetRuns > 0 || inningsTotalRuns > 0) {
            const newTotalWithExtras = currentBattersRuns + newBatterRuns + inningsExtras;

            // Check against Target Runs (Batters + Extras <= Target)
            if (inningsTargetRuns > 0 && newTotalWithExtras > inningsTargetRuns) {
                const maxAllowedRuns = Math.max(0, inningsTargetRuns - inningsExtras - currentBattersRuns);
                return NextResponse.json(
                    {
                        success: false,
                        message: `Runs mismatch! Innings target is ${inningsTargetRuns} runs (Extras: ${inningsExtras}, Other Batters: ${currentBattersRuns}). This batter can score at most ${maxAllowedRuns} run(s), but ${newBatterRuns} was entered (Total with extras would be ${newTotalWithExtras}).`,
                    },
                    { status: 400 }
                );
            }

            // Check against Total Runs (Batters <= Total Runs)
            if (inningsTotalRuns > 0 && (currentBattersRuns + newBatterRuns > inningsTotalRuns)) {
                const maxAllowedRuns = Math.max(0, inningsTotalRuns - currentBattersRuns);
                return NextResponse.json(
                    {
                        success: false,
                        message: `Runs mismatch! Innings total runs is ${inningsTotalRuns} (Other Batters: ${currentBattersRuns}). This batter can score at most ${maxAllowedRuns} run(s), but ${newBatterRuns} was entered.`,
                    },
                    { status: 400 }
                );
            }
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