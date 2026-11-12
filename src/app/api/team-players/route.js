import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const team_id = searchParams.get("team_id");
        const user_id = searchParams.get("user_id");
        const outside_player_id = searchParams.get("outside_player_id");
        const jersey_no = searchParams.get("jersey_no");
        const player_role = searchParams.get("player_role");
        const status = searchParams.get("status");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");

        let sql = `
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

            WHERE tp.is_deleted = 0
            AND t.is_deleted = 0
        `;

        const params = [];

        if (team_id !== null && team_id !== "") {
            sql += ` AND tp.team_id = ?`;
            params.push(Number(team_id));
        }

        if (user_id !== null && user_id !== "") {
            sql += ` AND tp.user_id = ?`;
            params.push(Number(user_id));
        }

        if (
            outside_player_id !== null &&
            outside_player_id !== ""
        ) {
            sql += ` AND tp.outside_player_id = ?`;
            params.push(Number(outside_player_id));
        }

        if (jersey_no) {
            sql += ` AND tp.jersey_no LIKE ?`;
            params.push(`%${jersey_no}%`);
        }

        if (player_role) {
            sql += ` AND tp.player_role = ?`;
            params.push(player_role);
        }

        if (status !== null && status !== "") {
            sql += ` AND tp.status = ?`;
            params.push(Number(status));
        }

        if (academy_id !== null && academy_id !== "") {
            sql += ` AND (
                t.academy_id = ?
                OR (t.academy_id IS NULL AND t.branch_id IS NULL)
            )`;
            params.push(Number(academy_id));
        }

        if (branch_id !== null && branch_id !== "") {
            sql += ` AND (
                t.branch_id = ?
                OR (t.academy_id IS NULL AND t.branch_id IS NULL)
            )`;
            params.push(Number(branch_id));
        }

        sql += ` ORDER BY tp.id DESC`;

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Team players fetched successfully",
            data: rows
        });

    } catch (error) {
        console.error("GET TEAM PLAYERS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch team players",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


export async function POST(request) {
    const connection = await pool.getConnection();

    try {
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
        | VALIDATE TEAM
        |--------------------------------------------------------------------------
        */

        if (
            team_id === null ||
            team_id === undefined ||
            team_id === ""
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team ID is required"
                },
                { status: 400 }
            );
        }

        const [teamRows] = await connection.query(
            `
            SELECT
                id,
                academy_id,
                branch_id,
                team_name
            FROM cst_teams
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [Number(team_id)]
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
        | USER OR OUTSIDE PLAYER
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

        if (!hasUser && !hasOutsidePlayer) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Either user_id or outside_player_id is required"
                },
                { status: 400 }
            );
        }

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

        /*
        |--------------------------------------------------------------------------
        | VALIDATE USER
        |--------------------------------------------------------------------------
        */

        if (hasUser) {
            const [userRows] = await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [Number(user_id)]
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

        if (hasOutsidePlayer) {
            const [outsideRows] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [Number(outside_player_id)]
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

        /*
        |--------------------------------------------------------------------------
        | VALID PLAYER ROLE
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
            player_role && player_role.toString().trim()
                ? player_role.toString().trim()
                : "Player";

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
        | DATE VALIDATION
        |--------------------------------------------------------------------------
        */

        if (joined_date && left_date) {
            if (
                new Date(left_date) <
                new Date(joined_date)
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
        | CHECK DUPLICATE PLAYER IN SAME TEAM
        |--------------------------------------------------------------------------
        */

        let duplicateSql = `
            SELECT id
            FROM cst_team_players
            WHERE team_id = ?
            AND is_deleted = 0
        `;

        const duplicateParams = [
            Number(team_id)
        ];

        if (hasUser) {
            duplicateSql += ` AND user_id = ?`;
            duplicateParams.push(Number(user_id));
        } else {
            duplicateSql += ` AND outside_player_id = ?`;
            duplicateParams.push(Number(outside_player_id));
        }

        duplicateSql += ` LIMIT 1`;

        const [duplicatePlayerRows] =
            await connection.query(
                duplicateSql,
                duplicateParams
            );

        if (duplicatePlayerRows.length > 0) {
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
        | CHECK JERSEY NUMBER
        |--------------------------------------------------------------------------
        */

        if (
            jersey_no !== null &&
            jersey_no !== undefined &&
            jersey_no !== ""
        ) {
            const [jerseyRows] = await connection.query(
                `
                SELECT id
                FROM cst_team_players
                WHERE team_id = ?
                AND jersey_no = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    Number(team_id),
                    jersey_no.toString().trim()
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
        | INSERT
        |--------------------------------------------------------------------------
        */

        const [result] = await connection.query(
            `
            INSERT INTO cst_team_players (
                team_id,
                user_id,
                outside_player_id,
                jersey_no,
                player_role,
                joined_date,
                left_date,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                Number(team_id),

                hasUser
                    ? Number(user_id)
                    : null,

                hasOutsidePlayer
                    ? Number(outside_player_id)
                    : null,

                jersey_no
                    ? jersey_no.toString().trim()
                    : null,

                finalRole,

                joined_date || null,
                left_date || null,

                status !== null &&
                    status !== undefined &&
                    status !== ""
                    ? Number(status)
                    : 1
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Player added to team successfully",
                data: {
                    id: result.insertId,
                    team_id: Number(team_id)
                }
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("CREATE TEAM PLAYER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to add player to team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}