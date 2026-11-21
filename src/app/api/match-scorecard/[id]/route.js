import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser, verifyRecordAccess } from "@/app/components/lib/tenant-isolation";
import { checkAndUpdateInningsAndMatchCompletion } from "@/app/components/lib/match-completion-helper";
import { validateMatchDateForScoring } from "@/app/components/lib/match-date-validator";


// GET: Single scorecard record
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
                sc.*,
                m.academy_id,
                m.branch_id,
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

        if (!verifyRecordAccess(authUser, { academy_id: rows[0].academy_id, branch_id: rows[0].branch_id })) {
            return NextResponse.json({ success: false, message: "Forbidden. Scorecard belongs to another academy or branch." }, { status: 403 });
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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot edit match scorecards." },
            { status: 403 }
        );
    }

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
            `SELECT sc.*, m.academy_id, m.branch_id, m.overs AS match_overs, m.match_date, mi.innings_status
             FROM cst_match_scorecard sc
             INNER JOIN cst_matches m ON m.id = sc.match_id
             INNER JOIN cst_match_innings mi ON mi.id = sc.innings_id
             WHERE sc.id = ?`,
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

        // Rule: Batting score cannot be updated before match date
        const dateCheck = validateMatchDateForScoring(existing.match_date, "Batting score");
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

        // Validate batter runs, balls, boundaries against match & innings limits:
        const matchOvers = existing.match_overs ? Number(existing.match_overs) : 20;
        const matchMaxBalls = matchOvers * 6;

        const [inningsRows] = await connection.execute(
            `SELECT total_runs, extras, target_runs, total_overs, total_balls FROM cst_match_innings WHERE id = ?`,
            [existing.innings_id]
        );
        const inningsTotalRuns = Number(inningsRows[0]?.total_runs) || 0;
        const inningsExtras = Number(inningsRows[0]?.extras) || 0;
        const inningsTargetRuns = inningsRows[0]?.target_runs !== null && inningsRows[0]?.target_runs !== undefined && inningsRows[0]?.target_runs !== ""
            ? Number(inningsRows[0].target_runs)
            : (inningsTotalRuns > 0 ? inningsTotalRuns + inningsExtras : 0);

        const rawInningsOvers = Number(inningsRows[0]?.total_overs) || 0;
        const completeOversInn = Math.floor(rawInningsOvers);
        const remBallsInn = Math.round((rawInningsOvers - completeOversInn) * 10);
        const inningsTotalBalls = inningsRows[0]?.total_balls
            ? Number(inningsRows[0].total_balls)
            : (rawInningsOvers > 0 ? (completeOversInn * 6 + (remBallsInn >= 0 && remBallsInn <= 5 ? remBallsInn : 0)) : matchMaxBalls);
        const maxBallsForInnings = Math.min(inningsTotalBalls, matchMaxBalls);

        const [otherBattersRows] = await connection.execute(
            `SELECT 
                COALESCE(SUM(runs), 0) AS other_batters_runs,
                COALESCE(SUM(balls), 0) AS other_batters_balls
             FROM cst_match_scorecard
             WHERE innings_id = ? AND id != ?`,
            [existing.innings_id, id]
        );

        const otherBattersRuns = Number(otherBattersRows[0]?.other_batters_runs) || 0;
        const otherBattersBalls = Number(otherBattersRows[0]?.other_batters_balls) || 0;
        const updatedRuns = Number(updated.runs) || 0;
        const updatedBalls = Number(updated.balls) || 0;
        const updatedFours = Number(updated.fours) || 0;
        const updatedSixes = Number(updated.sixes) || 0;

        // 1. Validate Balls Faced against match limit (e.g. 20 overs = 120 balls)
        if (updatedBalls > matchMaxBalls) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Balls faced mismatch! Match is ${matchOvers} overs (${matchMaxBalls} balls). A batter cannot face ${updatedBalls} balls in a ${matchOvers}-over match.`,
                },
                { status: 400 }
            );
        }

        const newTotalBallsFaced = otherBattersBalls + updatedBalls;
        if (newTotalBallsFaced > maxBallsForInnings) {
            const maxAllowedBalls = Math.max(0, maxBallsForInnings - otherBattersBalls);
            return NextResponse.json(
                {
                    success: false,
                    message: `Balls faced mismatch! Match is ${matchOvers} overs (${matchMaxBalls} balls max, innings total: ${maxBallsForInnings} balls). Other batters have faced ${otherBattersBalls} balls. This batter can face at most ${maxAllowedBalls} ball(s), but ${updatedBalls} was entered (Total would be ${newTotalBallsFaced}).`,
                },
                { status: 400 }
            );
        }

        // 2. Validate Boundary runs & count
        if (updatedFours * 4 + updatedSixes * 6 > updatedRuns) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Boundary runs mismatch! ${updatedFours} fours (4s) and ${updatedSixes} sixes (6s) equal ${updatedFours * 4 + updatedSixes * 6} runs, which cannot exceed total runs scored (${updatedRuns}).`,
                },
                { status: 400 }
            );
        }

        if (updatedBalls > 0 && (updatedFours + updatedSixes > updatedBalls)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Boundary count mismatch! Total boundaries (${updatedFours + updatedSixes}) cannot exceed balls faced (${updatedBalls}).`,
                },
                { status: 400 }
            );
        }

        // 3. Validate Runs
        if (inningsTargetRuns > 0 || inningsTotalRuns > 0) {
            const newTotalWithExtras = otherBattersRuns + updatedRuns + inningsExtras;

            // Check against Target Runs
            if (inningsTargetRuns > 0 && newTotalWithExtras > inningsTargetRuns) {
                const maxAllowedRuns = Math.max(0, inningsTargetRuns - inningsExtras - otherBattersRuns);
                return NextResponse.json(
                    {
                        success: false,
                        message: `Runs mismatch! Innings target is ${inningsTargetRuns} runs (Extras: ${inningsExtras}, Other Batters: ${otherBattersRuns}). This batter can score at most ${maxAllowedRuns} run(s), but ${updatedRuns} was entered (Total with extras would be ${newTotalWithExtras}).`,
                    },
                    { status: 400 }
                );
            }

            // Check against Total Runs
            if (inningsTotalRuns > 0 && (otherBattersRuns + updatedRuns > inningsTotalRuns)) {
                const maxAllowedRuns = Math.max(0, inningsTotalRuns - otherBattersRuns);
                return NextResponse.json(
                    {
                        success: false,
                        message: `Runs mismatch! Innings total runs is ${inningsTotalRuns} (Other Batters: ${otherBattersRuns}). This batter can score at most ${maxAllowedRuns} run(s), but ${updatedRuns} was entered.`,
                    },
                    { status: 400 }
                );
            }
        }

        values.push(id);

        await connection.execute(
            `UPDATE cst_match_scorecard
             SET ${updates.join(", ")}
             WHERE id = ? `,
            values
        );

        // Check and auto-update innings completion (10 dismissals or overs limit) and match completion
        await checkAndUpdateInningsAndMatchCompletion(connection, existing.match_id, existing.innings_id);

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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot delete match scorecards." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT sc.id, sc.match_id, sc.innings_id, m.academy_id, m.branch_id, mi.innings_status
             FROM cst_match_scorecard sc
             INNER JOIN cst_matches m ON m.id = sc.match_id
             INNER JOIN cst_match_innings mi ON mi.id = sc.innings_id
             WHERE sc.id = ?`,
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
            "DELETE FROM cst_match_scorecard WHERE id = ?",
            [id]
        );

        // Check and auto-update innings completion (10 dismissals or overs limit) and match completion
        await checkAndUpdateInningsAndMatchCompletion(connection, rows[0].match_id, rows[0].innings_id);

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