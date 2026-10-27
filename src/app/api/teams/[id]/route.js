import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";



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

        return NextResponse.json({
            success: true,
            message: "Team fetched successfully",
            data: rows[0]
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

        const teamId = Number(id);

        const [existingRows] = await connection.query(
            `
            SELECT *
            FROM cst_teams
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [teamId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team not found"
                },
                { status: 404 }
            );
        }

        const existingTeam = existingRows[0];

        const body = await request.json();

        const {
            academy_id,
            branch_id,
            team_name,
            team_code,
            team_type,
            category,
            age_group,
            status,
            created_by
        } = body;

        /*
        |--------------------------------------------------------------------------
        | TEAM NAME
        |--------------------------------------------------------------------------
        */

        if (!team_name || !team_name.toString().trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team name is required"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | TEAM TYPE
        |--------------------------------------------------------------------------
        */

        const allowedTeamTypes = [
            "Academy",
            "External",
            "Club",
            "School",
            "Corporate",
            "Other"
        ];

        const finalTeamType =
            team_type && team_type.toString().trim()
                ? team_type.toString().trim()
                : existingTeam.team_type;

        if (!allowedTeamTypes.includes(finalTeamType)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid team type"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE ACADEMY
        |--------------------------------------------------------------------------
        */

        if (
            academy_id !== null &&
            academy_id !== undefined &&
            academy_id !== ""
        ) {
            const [academyRows] = await connection.query(
                `
                SELECT id
                FROM cst_academy
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [Number(academy_id)]
            );

            if (academyRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Academy not found"
                    },
                    { status: 404 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE BRANCH
        |--------------------------------------------------------------------------
        */

        if (
            branch_id !== null &&
            branch_id !== undefined &&
            branch_id !== ""
        ) {
            const [branchRows] = await connection.query(
                `
                SELECT id, academy_id
                FROM cst_branch
                WHERE id = ?
                LIMIT 1
                `,
                [Number(branch_id)]
            );

            if (branchRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Branch not found"
                    },
                    { status: 404 }
                );
            }

            if (
                academy_id !== null &&
                academy_id !== undefined &&
                academy_id !== ""
            ) {
                if (
                    Number(branchRows[0].academy_id) !==
                    Number(academy_id)
                ) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "Selected branch does not belong to selected academy"
                        },
                        { status: 400 }
                    );
                }
            }
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE CREATED BY
        |--------------------------------------------------------------------------
        */

        if (
            created_by !== null &&
            created_by !== undefined &&
            created_by !== ""
        ) {
            const [userRows] = await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [Number(created_by)]
            );

            if (userRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Created by user not found"
                    },
                    { status: 404 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | TEAM CODE
        |--------------------------------------------------------------------------
        */

        const finalTeamCode =
            team_code !== null &&
                team_code !== undefined &&
                team_code.toString().trim()
                ? team_code.toString().trim().toUpperCase()
                : null;

        /*
        |--------------------------------------------------------------------------
        | DUPLICATE TEAM CODE
        |--------------------------------------------------------------------------
        */

        if (finalTeamCode) {
            let duplicateSql = `
                SELECT id
                FROM cst_teams
                WHERE team_code = ?
                AND id != ?
                AND is_deleted = 0
            `;

            const duplicateParams = [
                finalTeamCode,
                teamId
            ];

            if (
                academy_id !== null &&
                academy_id !== undefined &&
                academy_id !== ""
            ) {
                duplicateSql += ` AND academy_id = ?`;
                duplicateParams.push(Number(academy_id));
            } else {
                duplicateSql += ` AND academy_id IS NULL`;
            }

            duplicateSql += ` LIMIT 1`;

            const [duplicateRows] = await connection.query(
                duplicateSql,
                duplicateParams
            );

            if (duplicateRows.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Team code already exists in this academy"
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
            UPDATE cst_teams
            SET
                academy_id = ?,
                branch_id = ?,
                team_name = ?,
                team_code = ?,
                team_type = ?,
                category = ?,
                age_group = ?,
                status = ?,
                created_by = ?
            WHERE id = ?
            `,
            [
                academy_id !== null &&
                    academy_id !== undefined &&
                    academy_id !== ""
                    ? Number(academy_id)
                    : null,

                branch_id !== null &&
                    branch_id !== undefined &&
                    branch_id !== ""
                    ? Number(branch_id)
                    : null,

                team_name.toString().trim(),
                finalTeamCode,
                finalTeamType,

                category
                    ? category.toString().trim()
                    : null,

                age_group
                    ? age_group.toString().trim()
                    : null,

                status !== null &&
                    status !== undefined &&
                    status !== ""
                    ? Number(status)
                    : existingTeam.status,

                created_by !== null &&
                    created_by !== undefined &&
                    created_by !== ""
                    ? Number(created_by)
                    : existingTeam.created_by,

                teamId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Team updated successfully",
            data: {
                id: teamId
            }
        });

    } catch (error) {
        console.error("UPDATE TEAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update team",
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
| DELETE TEAM - SOFT DELETE
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
                    message: "Valid team ID is required"
                },
                { status: 400 }
            );
        }

        const teamId = Number(id);

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_teams
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [teamId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team not found"
                },
                { status: 404 }
            );
        }

        await connection.query(
            `
            UPDATE cst_teams
            SET
                is_deleted = 1,
                status = 0
            WHERE id = ?
            `,
            [teamId]
        );

        return NextResponse.json({
            success: true,
            message: "Team deleted successfully"
        });

    } catch (error) {
        console.error("DELETE TEAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}