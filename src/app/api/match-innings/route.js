import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser, verifyRecordAccess } from "@/app/components/lib/tenant-isolation";

// GET: Get all match innings
// Optional filters: ?match_id=1&innings_status=In Progress
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
        }

        const match_id = searchParams.get("match_id");
        const innings_status = searchParams.get("innings_status");

        let sql = `
            SELECT
                mi.*,
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
            WHERE 1 = 1
        `;

        const params = [];

        if (authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
            if (authUser.academy_id) {
                sql += " AND m.academy_id = ?";
                params.push(authUser.academy_id);
            }
            sql += " AND m.id IN (SELECT match_id FROM cst_match_players WHERE user_id = ?)";
            params.push(authUser.id);
        } else if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += " AND m.branch_id = ? AND m.academy_id = ?";
            params.push(authUser.branch_id, authUser.academy_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += " AND m.academy_id = ?";
            params.push(authUser.academy_id);
            const branchIdParam = searchParams.get("branch_id");
            if (branchIdParam) {
                sql += " AND m.branch_id = ?";
                params.push(Number(branchIdParam));
            }
        } else if (authUser.isAccountant && authUser.academy_id) {
            sql += " AND m.academy_id = ?";
            params.push(authUser.academy_id);
            if (authUser.branch_id) {
                sql += " AND m.branch_id = ?";
                params.push(authUser.branch_id);
            } else if (authUser.accessibleBranchIds && authUser.accessibleBranchIds.length > 0) {
                sql += ` AND m.branch_id IN (${authUser.accessibleBranchIds.map(() => "?").join(",")})`;
                params.push(...authUser.accessibleBranchIds);
            }
        } else if (!authUser.isSuperAdmin && authUser.academy_id) {
            sql += " AND m.academy_id = ?";
            params.push(authUser.academy_id);
            if (authUser.accessibleBranchIds && authUser.accessibleBranchIds.length > 0) {
                sql += ` AND (m.branch_id IS NULL OR m.branch_id IN (${authUser.accessibleBranchIds.map(() => "?").join(",")}))`;
                params.push(...authUser.accessibleBranchIds);
            }
        } else if (authUser.isSuperAdmin) {
            const academyIdParam = searchParams.get("academy_id");
            if (academyIdParam) {
                sql += " AND m.academy_id = ?";
                params.push(Number(academyIdParam));
            }
            const branchIdParam = searchParams.get("branch_id");
            if (branchIdParam) {
                sql += " AND m.branch_id = ?";
                params.push(Number(branchIdParam));
            }
        }

        if (match_id) {
            sql += " AND mi.match_id = ?";
            params.push(match_id);
        }

        if (innings_status) {
            sql += " AND mi.innings_status = ?";
            params.push(innings_status);
        }

        sql += " ORDER BY mi.match_id DESC, mi.innings_no ASC";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(sql, params);

        return NextResponse.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("GET Match Innings Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch match innings",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST: Create match innings
export async function POST(request) {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    if (authUser.isCoach || authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players and coaches cannot manage match innings." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const body = await request.json();

        const {
            match_id,
            innings_no,
            batting_team_id,
            bowling_team_id,
            total_runs = 0,
            total_wickets = 0,
            total_overs = 0,
            total_balls = 0,
            extras = 0,
            wides = 0,
            no_balls = 0,
            byes = 0,
            leg_byes = 0,
            penalty_runs = 0,
            target_runs = null,
            innings_status = "Not Started",
        } = body;

        // Required field validation
        if (
            !match_id ||
            !innings_no ||
            !batting_team_id ||
            !bowling_team_id
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "match_id, innings_no, batting_team_id and bowling_team_id are required",
                },
                { status: 400 }
            );
        }

        if (Number(batting_team_id) === Number(bowling_team_id)) {
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

        if (!validStatuses.includes(innings_status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid innings_status",
                },
                { status: 400 }
            );
        }

        const numericFields = {
            innings_no,
            total_runs,
            total_wickets,
            total_overs,
            total_balls,
            extras,
            wides,
            no_balls,
            byes,
            leg_byes,
            penalty_runs,
        };

        for (const [key, value] of Object.entries(numericFields)) {
            if (!Number.isFinite(Number(value)) || Number(value) < 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${key} must be a non - negative number`,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            !Number.isInteger(Number(innings_no)) ||
            Number(innings_no) < 1 ||
            Number(innings_no) > 255
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "innings_no must be an integer between 1 and 255",
                },
                { status: 400 }
            );
        }

        if (
            target_runs !== null &&
            (!Number.isInteger(Number(target_runs)) ||
                Number(target_runs) < 0)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "target_runs must be null or a non-negative integer",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Verify match exists
        const [matches] = await connection.execute(
            "SELECT id, academy_id, branch_id FROM cst_matches WHERE id = ?",
            [match_id]
        );

        if (matches.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match not found" },
                { status: 404 }
            );
        }

        if (!verifyRecordAccess(authUser, { academy_id: matches[0].academy_id, branch_id: matches[0].branch_id })) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Match belongs to another academy or branch." },
                { status: 403 }
            );
        }

        // Verify both teams exist
        const [teams] = await connection.execute(
            "SELECT id FROM cst_teams WHERE id IN (?, ?)",
            [batting_team_id, bowling_team_id]
        );

        if (teams.length !== 2) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batting team or bowling team not found",
                },
                { status: 404 }
            );
        }

        // Ensure both teams are registered for this match
        const [matchTeams] = await connection.execute(
            `SELECT team_id
             FROM cst_match_teams
             WHERE match_id = ?
    AND team_id IN(?, ?)`,
            [match_id, batting_team_id, bowling_team_id]
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

        // Create innings
        const [result] = await connection.execute(
            `INSERT INTO cst_match_innings(
        match_id,
        innings_no,
        batting_team_id,
        bowling_team_id,
        total_runs,
        total_wickets,
        total_overs,
        total_balls,
        extras,
        wides,
        no_balls,
        byes,
        leg_byes,
        penalty_runs,
        target_runs,
        innings_status
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                match_id,
                innings_no,
                batting_team_id,
                bowling_team_id,
                total_runs,
                total_wickets,
                total_overs,
                total_balls,
                extras,
                wides,
                no_balls,
                byes,
                leg_byes,
                penalty_runs,
                target_runs,
                innings_status,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Match innings created successfully",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST Match Innings Error:", error);

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
                    message: "Invalid match or team reference",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create match innings",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
