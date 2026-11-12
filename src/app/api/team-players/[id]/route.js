import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";



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

        return NextResponse.json({
            success: true,
            message: "Team player fetched successfully",
            data: rows[0]
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

        const teamPlayerId = Number(id);

        /*
        |--------------------------------------------------------------------------
        | EXISTING RECORD
        |--------------------------------------------------------------------------
        */

        const [existingRows] = await connection.query(
            `
            SELECT *
            FROM cst_team_players
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [teamPlayerId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team player not found"
                },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

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

        /*
        |--------------------------------------------------------------------------
        | TEAM
        |--------------------------------------------------------------------------
        */

        const finalTeamId =
            team_id !== null &&
                team_id !== undefined &&
                team_id !== ""
                ? Number(team_id)
                : existing.team_id;

        const [teamRows] = await connection.query(
            `
            SELECT id
            FROM cst_teams
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [finalTeamId]
        );

        if (teamRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team not found"
                },
                { status: 404 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | PLAYER
        |--------------------------------------------------------------------------
        */

        const hasUser =
            user_id !== null &&
            user_id !== undefined &&
            user_id !== "";

        const hasOutsidePlayer =
            outside_player_id !== null &&
            outside_player_id !== undefined &&
            outside_player_id !== "";

        /*
        | If neither is supplied, keep existing player.
        */

        let finalUserId = existing.user_id;
        let finalOutsidePlayerId =
            existing.outside_player_id;

        if (hasUser || hasOutsidePlayer) {

            if (hasUser && hasOutsidePlayer) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Only one of user_id or outside_player_id can be selected"
                    },
                    { status: 400 }
                );
            }

            if (hasUser) {
                finalUserId = Number(user_id);
                finalOutsidePlayerId = null;
            }

            if (hasOutsidePlayer) {
                finalUserId = null;
                finalOutsidePlayerId =
                    Number(outside_player_id);
            }
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE USER
        |--------------------------------------------------------------------------
        */

        if (finalUserId !== null) {
            const [userRows] = await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [finalUserId]
            );

            if (userRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "User/player not found"
                    },
                    { status: 404 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE OUTSIDE PLAYER
        |--------------------------------------------------------------------------
        */

        if (finalOutsidePlayerId !== null) {
            const [outsideRows] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [finalOutsidePlayerId]
            );

            if (outsideRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Outside player not found"
                    },
                    { status: 404 }
                );
            }
        }

        if (
            finalUserId === null &&
            finalOutsidePlayerId === null
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A team player must have either user_id or outside_player_id"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | ROLE
        |--------------------------------------------------------------------------
        */

        const allowedRoles = [
            "Player",
            "Captain",
            "Vice Captain",
            "Wicket Keeper",
            "All Rounder",
            "Bowler",
            "Batter"
        ];

        const finalRole =
            player_role !== null &&
                player_role !== undefined &&
                player_role !== ""
                ? player_role.toString().trim()
                : existing.player_role;

        if (!allowedRoles.includes(finalRole)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid player role"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | DATES
        |--------------------------------------------------------------------------
        */

        const finalJoinedDate =
            joined_date !== null &&
                joined_date !== undefined &&
                joined_date !== ""
                ? joined_date
                : existing.joined_date;

        const finalLeftDate =
            left_date !== null &&
                left_date !== undefined &&
                left_date !== ""
                ? left_date
                : existing.left_date;

        if (finalJoinedDate && finalLeftDate) {
            if (
                new Date(finalLeftDate) <
                new Date(finalJoinedDate)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Left date cannot be before joined date"
                    },
                    { status: 400 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | DUPLICATE PLAYER IN TEAM
        |--------------------------------------------------------------------------
        */

        let duplicateSql = `
            SELECT id
            FROM cst_team_players
            WHERE team_id = ?
            AND id != ?
            AND is_deleted = 0
        `;

        const duplicateParams = [
            finalTeamId,
            teamPlayerId
        ];

        if (finalUserId !== null) {
            duplicateSql += ` AND user_id = ?`;
            duplicateParams.push(finalUserId);
        } else {
            duplicateSql += ` AND outside_player_id = ?`;
            duplicateParams.push(finalOutsidePlayerId);
        }

        duplicateSql += ` LIMIT 1`;

        const [duplicateRows] =
            await connection.query(
                duplicateSql,
                duplicateParams
            );

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This player is already added to this team"
                },
                { status: 409 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | JERSEY NUMBER
        |--------------------------------------------------------------------------
        */

        const finalJerseyNo =
            jersey_no !== null &&
                jersey_no !== undefined &&
                jersey_no !== ""
                ? jersey_no.toString().trim()
                : null;

        if (finalJerseyNo) {
            const [jerseyRows] = await connection.query(
                `
                SELECT id
                FROM cst_team_players
                WHERE team_id = ?
                AND jersey_no = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    finalTeamId,
                    finalJerseyNo,
                    teamPlayerId
                ]
            );

            if (jerseyRows.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This jersey number is already assigned to this team"
                    },
                    { status: 409 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | UPDATE
        |--------------------------------------------------------------------------
        */

        await connection.query(
            `
            UPDATE cst_team_players
            SET
                team_id = ?,
                user_id = ?,
                outside_player_id = ?,
                jersey_no = ?,
                player_role = ?,
                joined_date = ?,
                left_date = ?,
                status = ?
            WHERE id = ?
            `,
            [
                finalTeamId,
                finalUserId,
                finalOutsidePlayerId,
                finalJerseyNo,
                finalRole,
                finalJoinedDate || null,
                finalLeftDate || null,
                status !== null &&
                    status !== undefined &&
                    status !== ""
                    ? Number(status)
                    : existing.status,
                teamPlayerId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Team player updated successfully",
            data: {
                id: teamPlayerId
            }
        });

    } catch (error) {
        console.error("UPDATE TEAM PLAYER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update team player",
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
| DELETE TEAM PLAYER - SOFT DELETE
|--------------------------------------------------------------------------
*/

export async function DELETE(request, { params }) {
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

        const teamPlayerId = Number(id);

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_team_players
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [teamPlayerId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team player not found"
                },
                { status: 404 }
            );
        }

        await connection.query(
            `
            UPDATE cst_team_players
            SET
                is_deleted = 1,
                status = 0
            WHERE id = ?
            `,
            [teamPlayerId]
        );

        return NextResponse.json({
            success: true,
            message: "Team player removed successfully"
        });

    } catch (error) {
        console.error("DELETE TEAM PLAYER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to remove team player",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
