import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser, verifyRecordAccess } from "@/app/components/lib/tenant-isolation";
import { checkAndUpdateInningsAndMatchCompletion } from "@/app/components/lib/match-completion-helper";
import { validateMatchDateForScoring } from "@/app/components/lib/match-date-validator";

// GET: All bowling scorecard records
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
                bs.*,
                mi.innings_no,
                mi.batting_team_id,
                mi.bowling_team_id,
                mp.team_id,
                mp.user_id,
                mp.outside_player_id,
                COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.player_name, '') AS player_name
            FROM cst_match_bowling_scorecard bs
            INNER JOIN cst_matches m
                ON m.id = bs.match_id
            INNER JOIN cst_match_innings mi
                ON mi.id = bs.innings_id
            INNER JOIN cst_match_players mp
                ON mp.id = bs.match_player_id
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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot manage bowling scorecards." },
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
            overs = 0,
            balls_bowled = 0,
            maidens = 0,
            runs_conceded = 0,
            wickets = 0,
            wides = 0,
            no_balls = 0,
        } = body;

        const errors = {};
        if (!match_id) errors.match_id = "Please select a match.";
        if (!innings_id) errors.innings_id = "Please select an innings.";
        if (!match_player_id) errors.match_player_id = "Please select a bowler.";

        if (Object.keys(errors).length > 0) {
            return NextResponse.json(
                { success: false, message: Object.values(errors)[0], errors },
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
                    errors: { overs: "Invalid overs format. Decimal part must be between .0 and .5." },
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

        // Verify match exists and check tenant access
        const [matchRows] = await connection.execute(
            "SELECT id, academy_id, branch_id, overs, match_date FROM cst_matches WHERE id = ? LIMIT 1",
            [match_id]
        );

        if (matchRows.length === 0) {
            return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
        }

        // Rule: Bowling score cannot be added before match date
        const dateCheck = validateMatchDateForScoring(matchRows[0].match_date, "Bowling score");
        if (!dateCheck.allowed) {
            return NextResponse.json(
                { success: false, message: dateCheck.message },
                { status: 400 }
            );
        }

        if (!verifyRecordAccess(authUser, { academy_id: matchRows[0].academy_id, branch_id: matchRows[0].branch_id })) {
            return NextResponse.json({ success: false, message: "Forbidden. Match belongs to another academy or branch." }, { status: 403 });
        }

        const matchOvers = matchRows[0].overs ? Number(matchRows[0].overs) : 20;
        const maxMatchBalls = matchOvers * 6;

        if (calculatedBalls > maxMatchBalls) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Overs mismatch! Bowler's overs (${overs} = ${calculatedBalls} balls) cannot exceed the match limit of ${matchOvers} overs (${maxMatchBalls} balls).`,
                },
                { status: 400 }
            );
        }

        // Verify innings belongs to the match
        const [inningsRows] = await connection.execute(
            `SELECT id, match_id, batting_team_id, bowling_team_id, total_overs, total_balls, total_wickets, extras, wides, no_balls, innings_status
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

        // Rule: If innings is Completed, player scores cannot be added unless user is Super Admin or Academy Admin
        if (inningsRows[0].innings_status === "Completed") {
            const isSuperOrAcademyAdmin = Boolean(
                authUser.isSuperAdmin ||
                authUser.isAcademyAdmin ||
                ["super admin", "super_admin", "academy admin", "academy_admin"].includes(
                    String(authUser.role || authUser.user_type || "").toLowerCase()
                )
            );
            if (!isSuperOrAcademyAdmin) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Forbidden. This innings is completed and player scores are locked. Only Super Admin and Academy Admin can add or edit player scores.",
                    },
                    { status: 403 }
                );
            }
        }

        const rawInningsBalls = inningsRows[0].total_balls ? Number(inningsRows[0].total_balls) : 0;
        const rawInningsOvers = Number(inningsRows[0].total_overs) || 0;
        const completeOversInn = Math.floor(rawInningsOvers);
        const remBallsInn = Math.round((rawInningsOvers - completeOversInn) * 10);
        const inningsTotalBalls = rawInningsBalls > 0 ? rawInningsBalls : (completeOversInn * 6 + (remBallsInn >= 0 && remBallsInn <= 5 ? remBallsInn : 0));

        // Fetch totals already bowled by other bowlers in this innings
        const [otherBowlersRows] = await connection.execute(
            `SELECT 
                COALESCE(SUM(balls_bowled), 0) AS other_balls_bowled,
                COALESCE(SUM(wides), 0) AS other_wides,
                COALESCE(SUM(no_balls), 0) AS other_no_balls,
                COALESCE(SUM(wickets), 0) AS other_wickets
             FROM cst_match_bowling_scorecard
             WHERE innings_id = ?`,
            [innings_id]
        );

        const otherBallsBowled = Number(otherBowlersRows[0]?.other_balls_bowled) || 0;
        const otherWides = Number(otherBowlersRows[0]?.other_wides) || 0;
        const otherNoBalls = Number(otherBowlersRows[0]?.other_no_balls) || 0;
        const otherWickets = Number(otherBowlersRows[0]?.other_wickets) || 0;

        // 1. Overs validation
        if (inningsTotalBalls > 0) {
            const newTotalBallsBowled = otherBallsBowled + calculatedBalls;
            if (newTotalBallsBowled > inningsTotalBalls) {
                const maxAllowedBalls = Math.max(0, inningsTotalBalls - otherBallsBowled);
                const maxAllowedOvers = `${Math.floor(maxAllowedBalls / 6)}.${maxAllowedBalls % 6}`;
                return NextResponse.json(
                    {
                        success: false,
                        message: `Overs mismatch! Innings total is ${inningsRows[0].total_overs} overs (${inningsTotalBalls} balls). Other bowlers have already bowled ${otherBallsBowled} balls. This bowler can bowl at most ${maxAllowedBalls} balls (${maxAllowedOvers} overs), but ${calculatedBalls} balls (${overs} overs) was entered.`,
                    },
                    { status: 400 }
                );
            }
        }

        // 2. Wides (wd) validation
        const inningsWides = Number(inningsRows[0].wides) || 0;
        const newWides = Number(wides) || 0;
        if (otherWides + newWides > inningsWides) {
            const maxAllowedWides = Math.max(0, inningsWides - otherWides);
            return NextResponse.json(
                {
                    success: false,
                    message: `Wides (wd) mismatch! Innings total wides is ${inningsWides}. Other bowlers have already bowled ${otherWides} wides. This bowler cannot bowl ${newWides} wides (max allowed: ${maxAllowedWides}).`,
                },
                { status: 400 }
            );
        }

        // 3. No-balls (nb) validation
        const inningsNoBalls = Number(inningsRows[0].no_balls) || 0;
        const newNoBalls = Number(no_balls) || 0;
        if (otherNoBalls + newNoBalls > inningsNoBalls) {
            const maxAllowedNoBalls = Math.max(0, inningsNoBalls - otherNoBalls);
            return NextResponse.json(
                {
                    success: false,
                    message: `No-balls (nb) mismatch! Innings total no-balls is ${inningsNoBalls}. Other bowlers have already bowled ${otherNoBalls} no-balls. This bowler cannot bowl ${newNoBalls} no-balls (max allowed: ${maxAllowedNoBalls}).`,
                },
                { status: 400 }
            );
        }

        // 4. Wickets (W) validation
        const inningsWickets = Number(inningsRows[0].total_wickets) || 0;
        const newWickets = Number(wickets) || 0;
        if (otherWickets + newWickets > inningsWickets) {
            const maxAllowedWickets = Math.max(0, inningsWickets - otherWickets);
            return NextResponse.json(
                {
                    success: false,
                    message: `Wickets (W) mismatch! Innings total wickets is ${inningsWickets}. Other bowlers have already taken ${otherWickets} wickets. This bowler cannot take ${newWickets} wickets (max allowed: ${maxAllowedWickets}).`,
                },
                { status: 400 }
            );
        }

        // 5. Total Extras consistency check
        const inningsExtras = Number(inningsRows[0].extras) || 0;
        if (inningsExtras > 0 && ((otherWides + newWides) + (otherNoBalls + newNoBalls) > inningsExtras)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Extras mismatch! Total bowler extras (${otherWides + newWides} wides + ${otherNoBalls + newNoBalls} no-balls) cannot exceed innings total extras (${inningsExtras}).`,
                },
                { status: 400 }
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

        // Check and auto-update innings completion (10 dismissals or overs limit) and match completion
        await checkAndUpdateInningsAndMatchCompletion(connection, match_id, innings_id);

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
                    message: "This bowler already has a record for this innings",
                    errors: { match_player_id: "This bowler already has a scorecard in this innings." },
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