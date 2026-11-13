import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

// Helper to check team access
function isTeamAuthorized(team, authUser) {
    if (!authUser) return true;
    if (authUser.isSuperAdmin) return true;

    if (team.academy_id && Number(team.academy_id) !== Number(authUser.academy_id)) {
        return false;
    }

    if (authUser.isPlayer) {
        if (Number(team.branch_id) === Number(authUser.branch_id) || !team.branch_id) return true;
        return false;
    }

    if (authUser.isBranchAdmin) {
        return Number(team.branch_id) === Number(authUser.branch_id);
    }

    if (authUser.isAcademyAdmin) {
        return true;
    }

    const allowed = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
    return allowed.includes(Number(team.branch_id)) || !team.branch_id;
}

/*
|--------------------------------------------------------------------------
| GET SINGLE TEAM
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
                    message: "Valid team ID is required"
                },
                { status: 400 }
            );
        }

        const [rows] = await connection.query(
            `
            SELECT
                t.id,
                t.academy_id,
                a.academy_name,

                t.branch_id,
                b.branch_name,

                t.team_name,
                t.team_code,
                t.team_type,
                t.category,
                t.age_group,

                t.status,
                t.is_deleted,

                t.created_by,
                u.first_name AS created_by_name,

                t.created_at,
                t.updated_at

            FROM cst_teams t

            LEFT JOIN cst_academy a
                ON a.id = t.academy_id

            LEFT JOIN cst_branch b
                ON b.id = t.branch_id

            LEFT JOIN cst_users u
                ON u.id = t.created_by

            WHERE t.id = ?
            AND t.is_deleted = 0

            LIMIT 1
            `,
            [Number(id)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team not found"
                },
                { status: 404 }
            );
        }

        const team = rows[0];

        // Check tenant authorization
        const { user: authUser } = await getAuthenticatedUser(request);
        if (authUser && !isTeamAuthorized(team, authUser)) {
            return NextResponse.json(
                { success: false, message: "Forbidden: You are not authorized to access this team" },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Team fetched successfully",
            data: team
        });

    } catch (error) {
        console.error("GET SINGLE TEAM ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch team",
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
| UPDATE TEAM
|--------------------------------------------------------------------------
*/

export async function PUT(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot update teams." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;
        const teamId = Number(id);

        if (!teamId || isNaN(teamId)) {
            return NextResponse.json(
                { success: false, message: "Valid team ID is required" },
                { status: 400 }
            );
        }

        // Verify existing team & ownership
        const [existingRows] = await connection.query(
            `SELECT id, academy_id, branch_id, team_code, status, is_deleted
             FROM cst_teams WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [teamId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Team not found" },
                { status: 404 }
            );
        }

        const existingTeam = existingRows[0];
        if (!isTeamAuthorized(existingTeam, authUser)) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Unauthorized to edit this team" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            academy_id,
            branch_id,
            team_name,
            team_code,
            team_type,
            category,
            age_group,
            status
        } = body;

        if (!team_name || !team_name.toString().trim()) {
            return NextResponse.json(
                { success: false, message: "Team name is required" },
                { status: 400 }
            );
        }

        const allowedTeamTypes = ["Academy", "External", "Club", "School", "Corporate", "Other"];
        const finalTeamType = team_type && team_type.toString().trim() ? team_type.toString().trim() : "Academy";
        if (!allowedTeamTypes.includes(finalTeamType)) {
            return NextResponse.json(
                { success: false, message: "Invalid team type" },
                { status: 400 }
            );
        }

        // Enforce tenant scoping
        let finalAcademyId = existingTeam.academy_id || 1;
        let finalBranchId = existingTeam.branch_id || null;

        if (authUser.isSuperAdmin) {
            if (academy_id !== undefined) finalAcademyId = academy_id ? Number(academy_id) : 1;
            if (branch_id !== undefined) finalBranchId = branch_id ? Number(branch_id) : null;
        } else if (authUser.isAcademyAdmin) {
            finalAcademyId = Number(authUser.academy_id);
            if (branch_id !== undefined) finalBranchId = branch_id ? Number(branch_id) : null;
        } else if (authUser.isBranchAdmin) {
            finalAcademyId = Number(authUser.academy_id);
            finalBranchId = Number(authUser.branch_id);
        } else {
            // Staff / Coach
            finalAcademyId = Number(authUser.academy_id);
            if (branch_id !== undefined) finalBranchId = branch_id ? Number(branch_id) : null;
            const allowed = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
            if (finalBranchId && !allowed.includes(finalBranchId)) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized branch selection" },
                    { status: 403 }
                );
            }
        }

        if (finalBranchId) {
            const [bRows] = await connection.query(
                `SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? AND is_deleted = 0 LIMIT 1`,
                [finalBranchId, finalAcademyId]
            );
            if (bRows.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Branch does not belong to authorized academy" },
                    { status: 400 }
                );
            }
        }

        // Check duplicate team code within academy
        const finalTeamCode =
            team_code && team_code.toString().trim()
                ? team_code.toString().trim().toUpperCase()
                : null;

        if (finalTeamCode) {
            const [duplicateRows] = await connection.query(
                `
                SELECT id
                FROM cst_teams
                WHERE team_code = ?
                AND academy_id = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [finalTeamCode, finalAcademyId, teamId]
            );

            if (duplicateRows.length > 0) {
                return NextResponse.json(
                    { success: false, message: "Team code already exists in this academy" },
                    { status: 409 }
                );
            }
        }

        await connection.query(
            `
            UPDATE cst_teams
            SET
                academy_id = ?,
                branch_id = ?,
                team_name = ?,
                team_code = ?,
                team_type = ?,
                category = ?,
                age_group = ?,
                status = ?
            WHERE id = ?
            `,
            [
                finalAcademyId,
                finalBranchId || null,
                team_name.toString().trim(),
                finalTeamCode,
                finalTeamType,
                category ? category.toString().trim() : null,
                age_group ? age_group.toString().trim() : null,
                status !== null && status !== undefined && status !== "" ? Number(status) : existingTeam.status,
                teamId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Team updated successfully",
            data: { id: teamId, academy_id: finalAcademyId, branch_id: finalBranchId }
        });

    } catch (error) {
        console.error("UPDATE TEAM ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update team", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| DELETE TEAM - SOFT DELETE
|--------------------------------------------------------------------------
*/

export async function DELETE(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot delete teams." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;
        const teamId = Number(id);

        if (!teamId || isNaN(teamId)) {
            return NextResponse.json(
                { success: false, message: "Valid team ID is required" },
                { status: 400 }
            );
        }

        const [existingRows] = await connection.query(
            `SELECT id, academy_id, branch_id FROM cst_teams WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [teamId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Team not found" },
                { status: 404 }
            );
        }

        if (!isTeamAuthorized(existingRows[0], authUser)) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Unauthorized to delete this team" },
                { status: 403 }
            );
        }

        await connection.query(
            `UPDATE cst_teams SET is_deleted = 1 WHERE id = ?`,
            [teamId]
        );

        return NextResponse.json({
            success: true,
            message: "Team deleted successfully"
        });

    } catch (error) {
        console.error("DELETE TEAM ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete team", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
