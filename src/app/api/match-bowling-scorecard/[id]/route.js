import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser, verifyRecordAccess } from "@/app/components/lib/tenant-isolation";
import { checkAndUpdateInningsAndMatchCompletion } from "@/app/components/lib/match-completion-helper";
import { validateMatchDateForScoring } from "@/app/components/lib/match-date-validator";


// GET: Single bowling scorecard record
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
                bs.*,
                m.academy_id,
                m.branch_id,
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

        if (!verifyRecordAccess(authUser, { academy_id: rows[0].academy_id, branch_id: rows[0].branch_id })) {
            return NextResponse.json({ success: false, message: "Forbidden. Bowling scorecard belongs to another academy or branch." }, { status: 403 });
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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot edit bowling scorecards." },
            { status: 403 }
        );
    }

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
            `SELECT bs.*, m.academy_id, m.branch_id, m.overs AS match_overs, m.match_date, mi.innings_status
             FROM cst_match_bowling_scorecard bs
             INNER JOIN cst_matches m ON m.id = bs.match_id
             INNER JOIN cst_match_innings mi ON mi.id = bs.innings_id
             WHERE bs.id = ?`,
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

        // Rule: Bowling score cannot be updated before match date
        const dateCheck = validateMatchDateForScoring(existing.match_date, "Bowling score");
        if (!dateCheck.allowed) {
            return NextResponse.json(
                { success: false, message: dateCheck.message },
                { status: 400 }
            );
        }

        if (!verifyRecordAccess(authUser, { academy_id: existing.academy_id, branch_id: existing.branch_id })) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Scorecard belongs to another academy or branch." },
                { status: 403 }
            );
        }

        // Rule: If innings is Completed, player scores cannot be modified unless user is Super Admin or Academy Admin
        if (existing.innings_status === "Completed") {
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

        const matchOvers = existing.match_overs ? Number(existing.match_overs) : 20;
        const maxMatchBalls = matchOvers * 6;

        if (calculatedBalls > maxMatchBalls) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Overs mismatch! Bowler's overs (${updated.overs} = ${calculatedBalls} balls) cannot exceed the match limit of ${matchOvers} overs (${maxMatchBalls} balls).`,
                },
                { status: 400 }
            );
        }

        // Validate bowler balls, wides, no-balls, and wickets against innings totals
        const [inningsRows] = await connection.execute(
            `SELECT total_overs, total_balls, total_wickets, extras, wides, no_balls FROM cst_match_innings WHERE id = ?`,
            [existing.innings_id]
        );

        if (inningsRows.length > 0) {
            const rawInningsBalls = inningsRows[0].total_balls ? Number(inningsRows[0].total_balls) : 0;
            const rawInningsOvers = Number(inningsRows[0].total_overs) || 0;
            const completeOversInn = Math.floor(rawInningsOvers);
            const remBallsInn = Math.round((rawInningsOvers - completeOversInn) * 10);
            const inningsTotalBalls = rawInningsBalls > 0 ? rawInningsBalls : (completeOversInn * 6 + (remBallsInn >= 0 && remBallsInn <= 5 ? remBallsInn : 0));

            const [otherBowlersRows] = await connection.execute(
                `SELECT 
                    COALESCE(SUM(balls_bowled), 0) AS other_balls_bowled,
                    COALESCE(SUM(wides), 0) AS other_wides,
                    COALESCE(SUM(no_balls), 0) AS other_no_balls,
                    COALESCE(SUM(wickets), 0) AS other_wickets
                 FROM cst_match_bowling_scorecard
                 WHERE innings_id = ? AND id != ?`,
                [existing.innings_id, id]
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
                            message: `Overs mismatch! Innings total is ${inningsRows[0].total_overs} overs (${inningsTotalBalls} balls). Other bowlers have bowled ${otherBallsBowled} balls. This bowler can bowl at most ${maxAllowedBalls} balls (${maxAllowedOvers} overs), but ${calculatedBalls} balls (${updated.overs} overs) was entered.`,
                        },
                        { status: 400 }
                    );
                }
            }

            // 2. Wides (wd) validation
            const inningsWides = Number(inningsRows[0].wides) || 0;
            const updatedWides = Number(updated.wides) || 0;
            if (otherWides + updatedWides > inningsWides) {
                const maxAllowedWides = Math.max(0, inningsWides - otherWides);
                return NextResponse.json(
                    {
                        success: false,
                        message: `Wides (wd) mismatch! Innings total wides is ${inningsWides}. Other bowlers have already bowled ${otherWides} wides. This bowler cannot bowl ${updatedWides} wides (max allowed: ${maxAllowedWides}).`,
                    },
                    { status: 400 }
                );
            }

            // 3. No-balls (nb) validation
            const inningsNoBalls = Number(inningsRows[0].no_balls) || 0;
            const updatedNoBalls = Number(updated.no_balls) || 0;
            if (otherNoBalls + updatedNoBalls > inningsNoBalls) {
                const maxAllowedNoBalls = Math.max(0, inningsNoBalls - otherNoBalls);
                return NextResponse.json(
                    {
                        success: false,
                        message: `No-balls (nb) mismatch! Innings total no-balls is ${inningsNoBalls}. Other bowlers have already bowled ${otherNoBalls} no-balls. This bowler cannot bowl ${updatedNoBalls} no-balls (max allowed: ${maxAllowedNoBalls}).`,
                    },
                    { status: 400 }
                );
            }

            // 4. Wickets (W) validation
            const inningsWickets = Number(inningsRows[0].total_wickets) || 0;
            const updatedWickets = Number(updated.wickets) || 0;
            if (otherWickets + updatedWickets > inningsWickets) {
                const maxAllowedWickets = Math.max(0, inningsWickets - otherWickets);
                return NextResponse.json(
                    {
                        success: false,
                        message: `Wickets (W) mismatch! Innings total wickets is ${inningsWickets}. Other bowlers have already taken ${otherWickets} wickets. This bowler cannot take ${updatedWickets} wickets (max allowed: ${maxAllowedWickets}).`,
                    },
                    { status: 400 }
                );
            }

            // 5. Total Extras consistency check
            const inningsExtras = Number(inningsRows[0].extras) || 0;
            if (inningsExtras > 0 && ((otherWides + updatedWides) + (otherNoBalls + updatedNoBalls) > inningsExtras)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Extras mismatch! Total bowler extras (${otherWides + updatedWides} wides + ${otherNoBalls + updatedNoBalls} no-balls) cannot exceed innings total extras (${inningsExtras}).`,
                    },
                    { status: 400 }
                );
            }
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

        // Check and auto-update innings completion (10 dismissals or overs limit) and match completion
        await checkAndUpdateInningsAndMatchCompletion(connection, existing.match_id, existing.innings_id);

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
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT bs.id, bs.match_id, bs.innings_id, m.academy_id, m.branch_id, mi.innings_status
             FROM cst_match_bowling_scorecard bs 
             INNER JOIN cst_matches m ON m.id = bs.match_id 
             INNER JOIN cst_match_innings mi ON mi.id = bs.innings_id
             WHERE bs.id = ?`,
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

        if (!verifyRecordAccess(authUser, { academy_id: rows[0].academy_id, branch_id: rows[0].branch_id })) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Scorecard belongs to another academy or branch." },
                { status: 403 }
            );
        }

        // Rule: If innings is Completed, player scores cannot be deleted unless user is Super Admin or Academy Admin
        if (rows[0].innings_status === "Completed") {
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

        await connection.execute(
            "DELETE FROM cst_match_bowling_scorecard WHERE id = ?",
            [id]
        );

        // Check and auto-update innings completion (10 dismissals or overs limit) and match completion
        await checkAndUpdateInningsAndMatchCompletion(connection, rows[0].match_id, rows[0].innings_id);

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