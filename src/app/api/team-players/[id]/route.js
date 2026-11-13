import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

// Helper to check team access
function isTeamAuthorized(team, authUser) {
    if (authUser.isSuperAdmin) return true;
    if (!team.academy_id && !team.branch_id) return true;
    if (Number(team.academy_id) !== Number(authUser.academy_id)) return false;
    if (authUser.isAcademyAdmin) return true;
    if (authUser.isBranchAdmin) {
        return Number(team.branch_id) === Number(authUser.branch_id) || !team.branch_id;
    }
    const allowed = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
    return allowed.includes(Number(team.branch_id)) || !team.branch_id;
}

/*
|--------------------------------------------------------------------------
| GET SINGLE TEAM PLAYER
|--------------------------------------------------------------------------
*/

export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(Number(id))) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid team player ID is required"
                },
                { status: 400 }
            );
        }

        const [rows] = await connection.query(
            `
            SELECT
                tp.id,
                tp.team_id,

                t.team_name,
                t.team_code,
                t.academy_id,
                a.academy_name,
                t.branch_id,
                b.branch_name,

                tp.user_id,
                CASE
                    WHEN tp.user_id IS NOT NULL
                    THEN CONCAT_WS(
                        ' ',
                        u.first_name,
                        u.last_name
                    )
                    ELSE NULL
                END AS player_name,

                u.email AS player_email,
                u.phone AS player_phone,
                u.profile_image AS user_profile_image,

                tp.outside_player_id,
                op.player_name AS outside_player_name,
                op.phone AS outside_player_phone,
                op.email AS outside_player_email,
                op.profile_image AS outside_profile_image,

                tp.jersey_no,
                tp.player_role,
                tp.joined_date,
                tp.left_date,
                tp.status,
                tp.is_deleted,
                tp.created_at,
                tp.updated_at

            FROM cst_team_players tp

            INNER JOIN cst_teams t
                ON t.id = tp.team_id

            LEFT JOIN cst_academy a
                ON a.id = t.academy_id

            LEFT JOIN cst_branch b
                ON b.id = t.branch_id

            LEFT JOIN cst_users u
                ON u.id = tp.user_id

            LEFT JOIN cst_outside_players op
                ON op.id = tp.outside_player_id

            WHERE tp.id = ?
            AND tp.is_deleted = 0

            LIMIT 1
            `,
            [Number(id)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team player not found"
                },
                { status: 404 }
            );
        }

        const player = rows[0];

        // Check authentication & tenant authorization
        const authHeader = request.headers.get("authorization");
        if (authHeader) {
            const { user: authUser } = await getAuthenticatedUser(request);
            if (authUser) {
                if (authUser.isPlayer && Number(player.user_id) !== Number(authUser.id)) {
                    if (!isTeamAuthorized(player, authUser)) {
                        return NextResponse.json(
                            { success: false, message: "Team player not found or access denied" },
                            { status: 404 }
                        );
                    }
                } else if (!isTeamAuthorized(player, authUser)) {
                    return NextResponse.json(
                        { success: false, message: "Team player not found or access denied" },
                        { status: 404 }
                    );
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: "Team player fetched successfully",
            data: player
        });

    } catch (error) {
        console.error("GET SINGLE TEAM PLAYER ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch team player",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| UPDATE TEAM PLAYER
|--------------------------------------------------------------------------
*/

export async function PUT(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot update team players." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;
        const teamPlayerId = Number(id);

        if (!teamPlayerId || isNaN(teamPlayerId)) {
            return NextResponse.json(
                { success: false, message: "Valid team player ID is required" },
                { status: 400 }
            );
        }

        // Verify existing team player & authorization
        const [existingRows] = await connection.query(
            `
            SELECT tp.*, t.academy_id, t.branch_id
            FROM cst_team_players tp
            INNER JOIN cst_teams t ON t.id = tp.team_id
            WHERE tp.id = ? AND tp.is_deleted = 0
            LIMIT 1
            `,
            [teamPlayerId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Team player not found" },
                { status: 404 }
            );
        }

        const existingPlayer = existingRows[0];
        if (!isTeamAuthorized(existingPlayer, authUser)) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to edit this team player" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            team_id,
            user_id,
            outside_player_id,
            jersey_no,
            player_role,
            joined_date,
            left_date,
            status
        } = body;

        const finalTeamId = team_id ? Number(team_id) : existingPlayer.team_id;

        // If target team changed, verify authorization for new team
        if (finalTeamId !== existingPlayer.team_id) {
            const [newTeam] = await connection.query(
                `SELECT id, academy_id, branch_id FROM cst_teams WHERE id = ? AND is_deleted = 0 LIMIT 1`,
                [finalTeamId]
            );
            if (newTeam.length === 0 || !isTeamAuthorized(newTeam[0], authUser)) {
                return NextResponse.json(
                    { success: false, message: "Target team not found or access denied" },
                    { status: 403 }
                );
            }
        }

        const allowedRoles = [
            "Player",
            "Captain",
            "Vice Captain",
            "Wicket Keeper",
            "All Rounder",
            "Bowler",
            "Batter"
        ];

        const finalRole = player_role && player_role.toString().trim()
            ? player_role.toString().trim()
            : existingPlayer.player_role;

        if (!allowedRoles.includes(finalRole)) {
            return NextResponse.json(
                { success: false, message: "Invalid player role" },
                { status: 400 }
            );
        }

        await connection.query(
            `
            UPDATE cst_team_players
            SET
                team_id = ?,
                jersey_no = ?,
                player_role = ?,
                joined_date = ?,
                left_date = ?,
                status = ?
            WHERE id = ?
            `,
            [
                finalTeamId,
                jersey_no !== null && jersey_no !== undefined && jersey_no !== "" ? Number(jersey_no) : existingPlayer.jersey_no,
                finalRole,
                joined_date !== undefined ? joined_date : existingPlayer.joined_date,
                left_date !== undefined ? left_date : existingPlayer.left_date,
                status !== null && status !== undefined && status !== "" ? Number(status) : existingPlayer.status,
                teamPlayerId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Team player updated successfully",
            data: { id: teamPlayerId }
        });

    } catch (error) {
        console.error("UPDATE TEAM PLAYER ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update team player", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| DELETE TEAM PLAYER - SOFT DELETE
|--------------------------------------------------------------------------
*/

export async function DELETE(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot delete team players." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;
        const teamPlayerId = Number(id);

        if (!teamPlayerId || isNaN(teamPlayerId)) {
            return NextResponse.json(
                { success: false, message: "Valid team player ID is required" },
                { status: 400 }
            );
        }

        const [existingRows] = await connection.query(
            `
            SELECT tp.id, t.academy_id, t.branch_id
            FROM cst_team_players tp
            INNER JOIN cst_teams t ON t.id = tp.team_id
            WHERE tp.id = ? AND tp.is_deleted = 0
            LIMIT 1
            `,
            [teamPlayerId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Team player not found" },
                { status: 404 }
            );
        }

        if (!isTeamAuthorized(existingRows[0], authUser)) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to delete this team player" },
                { status: 403 }
            );
        }

        await connection.query(
            `UPDATE cst_team_players SET is_deleted = 1 WHERE id = ?`,
            [teamPlayerId]
        );

        return NextResponse.json({
            success: true,
            message: "Team player deleted successfully"
        });

    } catch (error) {
        console.error("DELETE TEAM PLAYER ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete team player", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
