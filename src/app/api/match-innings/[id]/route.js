import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser, verifyRecordAccess } from "@/app/components/lib/tenant-isolation";
import { checkAndUpdateInningsAndMatchCompletion } from "@/app/components/lib/match-completion-helper";

// GET: Get single innings
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
                mi.*,
                m.academy_id,
                m.branch_id,
                m.match_no,
                m.match_date,
                m.match_type,
                m.status AS match_status,
                m.remarks AS match_remarks,
                bt.team_name AS batting_team_name,
                bw.team_name AS bowling_team_name
             FROM cst_match_innings mi
             INNER JOIN cst_matches m
                ON m.id = mi.match_id
             INNER JOIN cst_teams bt
                ON bt.id = mi.batting_team_id
             INNER JOIN cst_teams bw
                ON bw.id = mi.bowling_team_id
             WHERE mi.id = ?
    LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match innings not found" },
                { status: 404 }
            );
        }

        if (!verifyRecordAccess(authUser, { academy_id: rows[0].academy_id, branch_id: rows[0].branch_id })) {
            return NextResponse.json({ success: false, message: "Forbidden. Innings belongs to another academy or branch." }, { status: 403 });
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Single Match Innings Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch match innings" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update innings
export async function PUT(request, { params }) {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot edit match innings." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "innings_no",
            "batting_team_id",
            "bowling_team_id",
            "total_runs",
            "total_wickets",
            "total_overs",
            "total_balls",
            "extras",
            "wides",
            "no_balls",
            "byes",
            "leg_byes",
            "penalty_runs",
            "target_runs",
            "innings_status",
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

        // Check existing innings
        const [existingRows] = await connection.execute(
            `SELECT mi.*, m.academy_id, m.branch_id, m.overs AS match_overs
             FROM cst_match_innings mi
             INNER JOIN cst_matches m ON m.id = mi.match_id
             WHERE mi.id = ?`,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match innings not found" },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        if (!verifyRecordAccess(authUser, { academy_id: existing.academy_id, branch_id: existing.branch_id })) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Innings belongs to another academy or branch." },
                { status: 403 }
            );
        }

        // Rule: If innings is Completed, it cannot be edited unless user is Super Admin or Academy Admin
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
                        message: "Forbidden. This innings is completed and locked. Only Super Admin and Academy Admin can edit completed innings records.",
                    },
                    { status: 403 }
                );
            }
        }

        // Validate combined values, including fields not supplied in PUT
        const updated = { ...existing, ...body };

        if (
            Number(updated.batting_team_id) ===
            Number(updated.bowling_team_id)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batting team and bowling team must be different",
                },
                { status: 400 }
            );
        }

        const validStatuses = [
            "Not Started",
            "In Progress",
            "Completed",
        ];

        if (!validStatuses.includes(updated.innings_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid innings_status" },
                { status: 400 }
            );
        }

        const numericFields = [
            "innings_no",
            "batting_team_id",
            "bowling_team_id",
            "total_runs",
            "total_wickets",
            "total_overs",
            "total_balls",
            "extras",
            "wides",
            "no_balls",
            "byes",
            "leg_byes",
            "penalty_runs",
        ];

        for (const field of numericFields) {
            if (
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

        if (
            !Number.isInteger(Number(updated.innings_no)) ||
            Number(updated.innings_no) < 1 ||
            Number(updated.innings_no) > 255
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "innings_no must be between 1 and 255",
                },
                { status: 400 }
            );
        }

        if (
            updated.target_runs !== null &&
            (!Number.isInteger(Number(updated.target_runs)) ||
                Number(updated.target_runs) < 0)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "target_runs must be null or a non-negative integer",
                },
                { status: 400 }
            );
        }

        const matchOvers = existing.match_overs ? Number(existing.match_overs) : 20;

        // Validate overs against match limit and against balls already bowled
        if (updated.total_overs !== undefined && updated.total_overs !== null && updated.total_overs !== "") {
            const numOvers = Number(updated.total_overs);
            const completeOvers = Math.floor(numOvers);
            const remBalls = Math.round((numOvers - completeOvers) * 10);
            if (remBalls < 0 || remBalls > 5) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid overs format. Decimal part (balls) must be between .0 and .5 (e.g. 19.5, 20.0).",
                    },
                    { status: 400 }
                );
            }
            const enteredBalls = completeOvers * 6 + remBalls;
            const maxAllowedBalls = matchOvers * 6;
            if (enteredBalls > maxAllowedBalls) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Overs mismatch! Innings total overs (${updated.total_overs}) cannot exceed the match limit of ${matchOvers} overs (${maxAllowedBalls} balls).`,
                    },
                    { status: 400 }
                );
            }

            // Check if balls already bowled by bowlers exceed this new total_overs
            const [bowlerBallsRows] = await connection.execute(
                `SELECT COALESCE(SUM(balls_bowled), 0) AS total_balls_bowled
                 FROM cst_match_bowling_scorecard
                 WHERE innings_id = ?`,
                [id]
            );
            const totalBallsBowled = Number(bowlerBallsRows[0]?.total_balls_bowled) || 0;
            if (totalBallsBowled > 0 && enteredBalls < totalBallsBowled) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Overs mismatch! Total overs (${updated.total_overs} = ${enteredBalls} balls) cannot be less than balls already bowled by bowlers in this innings (${totalBallsBowled} balls).`,
                    },
                    { status: 400 }
                );
            }
        }

        if (updated.total_balls !== undefined && updated.total_balls !== null && updated.total_balls !== "") {
            const maxAllowedBalls = matchOvers * 6;
            if (Number(updated.total_balls) > maxAllowedBalls) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Overs mismatch! Innings total balls (${updated.total_balls}) cannot exceed the match limit of ${matchOvers} overs (${maxAllowedBalls} balls).`,
                    },
                    { status: 400 }
                );
            }
        }

        // Validate total_runs against already recorded batter runs + extras
        if (updated.total_runs !== undefined && updated.total_runs !== null && updated.total_runs !== "") {
            const [batterSumRows] = await connection.execute(
                `SELECT COALESCE(SUM(runs), 0) AS total_batters_runs
                 FROM cst_match_scorecard
                 WHERE innings_id = ?`,
                [id]
            );
            const totalBattersRuns = Number(batterSumRows[0]?.total_batters_runs) || 0;
            const inningsExtras = Number(updated.extras) || 0;
            const minRequiredRuns = totalBattersRuns + inningsExtras;
            if (totalBattersRuns > 0 && Number(updated.total_runs) < minRequiredRuns) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Runs mismatch! Total runs (${updated.total_runs}) cannot be less than already recorded batters' runs (${totalBattersRuns}) + extras (${inningsExtras}) = ${minRequiredRuns} runs.`,
                    },
                    { status: 400 }
                );
            }
        }

        // If team changed, validate that both teams exist and belong to match
        const [matchTeams] = await connection.execute(
            `SELECT team_id
             FROM cst_match_teams
             WHERE match_id = ?
    AND team_id IN(?, ?)`,
            [
                existing.match_id,
                updated.batting_team_id,
                updated.bowling_team_id,
            ]
        );

        if (matchTeams.length !== 2) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Both teams must be registered for this match",
                },
                { status: 400 }
            );
        }

        // Rule: If 10 wickets dismissed or overs limit reached, auto-mark Completed
        const isTenWickets = Number(updated.total_wickets) >= 10;
        const isOverLimit = Number(updated.total_balls) >= matchOvers * 6 || (Number(updated.total_overs) >= matchOvers && matchOvers > 0);
        if (isTenWickets || isOverLimit) {
            const statusIdx = updates.findIndex((u) => u.startsWith("innings_status"));
            if (statusIdx >= 0) {
                values[statusIdx] = "Completed";
            } else {
                updates.push("innings_status = ?");
                values.push("Completed");
            }
        }

        values.push(id);

        await connection.execute(
            `UPDATE cst_match_innings
             SET ${updates.join(", ")}
             WHERE id = ? `,
            values
        );

        // Check and auto-update innings completion (10 dismissals or overs limit) and match completion
        await checkAndUpdateInningsAndMatchCompletion(connection, existing.match_id, id);

        return NextResponse.json({
            success: true,
            message: "Match innings updated successfully",
        });
    } catch (error) {
        console.error("PUT Match Innings Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This innings number already exists for this match",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid team reference",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update match innings" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Delete innings
export async function DELETE(request, { params }) {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot delete match innings." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT mi.id, mi.match_id, mi.innings_status, m.academy_id, m.branch_id
             FROM cst_match_innings mi
             INNER JOIN cst_matches m ON m.id = mi.match_id
             WHERE mi.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match innings not found" },
                { status: 404 }
            );
        }

        if (!verifyRecordAccess(authUser, { academy_id: rows[0].academy_id, branch_id: rows[0].branch_id })) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Innings belongs to another academy or branch." },
                { status: 403 }
            );
        }

        // Rule: If innings is Completed, it cannot be deleted unless user is Super Admin or Academy Admin
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
                        message: "Forbidden. This innings is completed and locked. Only Super Admin and Academy Admin can delete completed innings records.",
                    },
                    { status: 403 }
                );
            }
        }

        await connection.execute(
            "DELETE FROM cst_match_innings WHERE id = ?",
            [id]
        );

        // Check and auto-update match completion if needed
        await checkAndUpdateInningsAndMatchCompletion(connection, rows[0].match_id, null);

        return NextResponse.json({
            success: true,
            message: "Match innings deleted successfully",
        });
    } catch (error) {
        console.error("DELETE Match Innings Error:", error);

        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Cannot delete innings because scorecard or ball records are linked to it",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to delete match innings" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}