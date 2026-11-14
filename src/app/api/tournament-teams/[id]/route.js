import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

// Helper to check tournament access
function isTournamentAuthorized(tournament, authUser) {
    if (authUser.isSuperAdmin) return true;
    if (Number(tournament.academy_id) !== Number(authUser.academy_id)) return false;
    if (authUser.isPlayer) {
        return Number(tournament.branch_id) === Number(authUser.branch_id) || !tournament.branch_id;
    }
    if (authUser.isAcademyAdmin) return true;
    if (authUser.isBranchAdmin) {
        return Number(tournament.branch_id) === Number(authUser.branch_id);
    }
    const allowed = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
    return allowed.includes(Number(tournament.branch_id));
}

/*
|--------------------------------------------------------------------------
| GET SINGLE TOURNAMENT TEAM
|--------------------------------------------------------------------------
*/

export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
            return NextResponse.json(
                { success: false, message: "Valid registration ID is required" },
                { status: 400 }
            );
        }

        const [rows] = await connection.query(
            `
            SELECT
                tt.id,
                tt.tournament_id,
                t.tournament_name,
                t.tournament_code,
                t.academy_id,
                a.academy_name,
                t.branch_id,
                b.branch_name,

                tt.team_id,
                tm.team_name,
                tm.team_code,
                tm.team_type,
                tm.category,
                tm.age_group,

                tt.registration_no,
                tt.registered_date,
                tt.team_fee,
                tt.payment_status,
                tt.status,
                tt.created_by,
                CONCAT_WS(
                    ' ',
                    u.first_name,
                    u.last_name
                ) AS created_by_name,
                tt.created_at

            FROM cst_tournament_teams tt

            INNER JOIN cst_tournaments t
                ON t.id = tt.tournament_id

            INNER JOIN cst_teams tm
                ON tm.id = tt.team_id

            LEFT JOIN cst_academy a
                ON a.id = t.academy_id

            LEFT JOIN cst_branch b
                ON b.id = t.branch_id

            LEFT JOIN cst_users u
                ON u.id = tt.created_by

            WHERE tt.id = ?
            AND tt.is_deleted = 0

            LIMIT 1
            `,
            [Number(id)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Tournament team registration not found" },
                { status: 404 }
            );
        }

        const registration = rows[0];

        // Check authentication
        const { user: authUser } = await getAuthenticatedUser(request);
        if (authUser && !isTournamentAuthorized(registration, authUser)) {
            return NextResponse.json(
                { success: false, message: "Tournament team not found or access denied" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Tournament team fetched successfully",
            data: registration
        });

    } catch (error) {
        console.error("GET SINGLE TOURNAMENT TEAM ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch tournament team", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| UPDATE TOURNAMENT TEAM
|--------------------------------------------------------------------------
*/

export async function PUT(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot update tournament teams." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;
        const regId = Number(id);

        if (!regId || isNaN(regId)) {
            return NextResponse.json(
                { success: false, message: "Valid registration ID is required" },
                { status: 400 }
            );
        }

        const [existingRows] = await connection.query(
            `
            SELECT tt.id, tt.tournament_id, tt.team_id, t.academy_id, t.branch_id
            FROM cst_tournament_teams tt
            INNER JOIN cst_tournaments t ON t.id = tt.tournament_id
            WHERE tt.id = ? AND tt.is_deleted = 0
            LIMIT 1
            `,
            [regId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Tournament team registration not found" },
                { status: 404 }
            );
        }

        if (!isTournamentAuthorized(existingRows[0], authUser)) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to edit this registration" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            registration_no,
            registered_date,
            team_fee,
            payment_status,
            status
        } = body;

        if (team_fee !== undefined && team_fee !== null && team_fee !== "") {
            const parsedFee = Number(team_fee);
            if (!Number.isFinite(parsedFee) || parsedFee < 0) {
                return NextResponse.json(
                    { success: false, message: "Team fee cannot be negative" },
                    { status: 400 }
                );
            }
        }

        await connection.query(
            `
            UPDATE cst_tournament_teams
            SET
                registration_no = COALESCE(?, registration_no),
                registered_date = COALESCE(?, registered_date),
                team_fee = COALESCE(?, team_fee),
                payment_status = COALESCE(?, payment_status),
                status = COALESCE(?, status)
            WHERE id = ?
            `,
            [
                registration_no || null,
                registered_date || null,
                team_fee !== undefined && team_fee !== null && team_fee !== "" ? Number(team_fee) : null,
                payment_status || null,
                status || null,
                regId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Tournament team updated successfully",
            data: { id: regId }
        });

    } catch (error) {
        console.error("UPDATE TOURNAMENT TEAM ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update tournament team", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| DELETE TOURNAMENT TEAM - SOFT DELETE
|--------------------------------------------------------------------------
*/

export async function DELETE(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot delete tournament teams." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;
        const regId = Number(id);

        if (!regId || isNaN(regId)) {
            return NextResponse.json(
                { success: false, message: "Valid registration ID is required" },
                { status: 400 }
            );
        }

        const [existingRows] = await connection.query(
            `
            SELECT tt.id, t.academy_id, t.branch_id
            FROM cst_tournament_teams tt
            INNER JOIN cst_tournaments t ON t.id = tt.tournament_id
            WHERE tt.id = ? AND tt.is_deleted = 0
            LIMIT 1
            `,
            [regId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Tournament team registration not found" },
                { status: 404 }
            );
        }

        if (!isTournamentAuthorized(existingRows[0], authUser)) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to delete this registration" },
                { status: 403 }
            );
        }

        await connection.query(
            `UPDATE cst_tournament_teams SET is_deleted = 1 WHERE id = ?`,
            [regId]
        );

        return NextResponse.json({
            success: true,
            message: "Tournament team deleted successfully"
        });

    } catch (error) {
        console.error("DELETE TOURNAMENT TEAM ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete tournament team", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
