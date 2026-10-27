import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


/*
|--------------------------------------------------------------------------
| GET ALL TEAMS
|--------------------------------------------------------------------------
| Examples:
| /api/teams
| /api/teams?academy_id=1
| /api/teams?academy_id=1&branch_id=2
| /api/teams?team_name=Warriors
| /api/teams?team_type=Academy
| /api/teams?category=Senior
| /api/teams?age_group=U-19
| /api/teams?status=1
|--------------------------------------------------------------------------
*/

export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const team_name = searchParams.get("team_name") || "";
        const team_code = searchParams.get("team_code") || "";
        const team_type = searchParams.get("team_type") || "";
        const category = searchParams.get("category") || "";
        const age_group = searchParams.get("age_group") || "";
        const status = searchParams.get("status");

        let sql = `
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

            WHERE t.is_deleted = 0
        `;

        const params = [];

        /*
        |--------------------------------------------------------------------------
        | ACADEMY FILTER
        |--------------------------------------------------------------------------
        */

        if (academy_id !== null && academy_id !== "") {
            sql += ` AND (
                t.academy_id = ?
                OR (t.academy_id IS NULL AND t.branch_id IS NULL)
            )`;
            params.push(Number(academy_id));
        }

        /*
        |--------------------------------------------------------------------------
        | BRANCH FILTER
        |--------------------------------------------------------------------------
        */

        if (branch_id !== null && branch_id !== "") {
            sql += ` AND (
                t.branch_id = ?
                OR (t.academy_id IS NULL AND t.branch_id IS NULL)
            )`;
            params.push(Number(branch_id));
        }

        /*
        |--------------------------------------------------------------------------
        | TEAM NAME
        |--------------------------------------------------------------------------
        */

        if (team_name) {
            sql += ` AND t.team_name LIKE ?`;
            params.push(`%${team_name}%`);
        }

        /*
        |--------------------------------------------------------------------------
        | TEAM CODE
        |--------------------------------------------------------------------------
        */

        if (team_code) {
            sql += ` AND t.team_code LIKE ?`;
            params.push(`%${team_code}%`);
        }

        /*
        |--------------------------------------------------------------------------
        | TEAM TYPE
        |--------------------------------------------------------------------------
        */

        if (team_type) {
            sql += ` AND t.team_type = ?`;
            params.push(team_type);
        }

        /*
        |--------------------------------------------------------------------------
        | CATEGORY
        |--------------------------------------------------------------------------
        */

        if (category) {
            sql += ` AND t.category LIKE ?`;
            params.push(`%${category}%`);
        }

        /*
        |--------------------------------------------------------------------------
        | AGE GROUP
        |--------------------------------------------------------------------------
        */

        if (age_group) {
            sql += ` AND t.age_group LIKE ?`;
            params.push(`%${age_group}%`);
        }

        /*
        |--------------------------------------------------------------------------
        | STATUS
        |--------------------------------------------------------------------------
        */

        if (status !== null && status !== "") {
            sql += ` AND t.status = ?`;
            params.push(Number(status));
        }

        sql += `
            ORDER BY t.id DESC
        `;

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Teams fetched successfully",
            data: rows
        });

    } catch (error) {
        console.error("GET TEAMS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch teams",
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
| CREATE TEAM
|--------------------------------------------------------------------------
*/

export async function POST(request) {
    const connection = await pool.getConnection();

    try {
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
        | VALIDATION
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
        | VALID TEAM TYPE
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
                : "Academy";

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

            /*
            | If both academy and branch are provided,
            | branch must belong to that academy.
            */

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
        | DUPLICATE TEAM CODE
        |--------------------------------------------------------------------------
        */

        const finalTeamCode =
            team_code && team_code.toString().trim()
                ? team_code.toString().trim().toUpperCase()
                : null;

        if (finalTeamCode) {
            let duplicateSql = `
                SELECT id
                FROM cst_teams
                WHERE team_code = ?
                AND is_deleted = 0
            `;

            const duplicateParams = [finalTeamCode];

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
        | INSERT TEAM
        |--------------------------------------------------------------------------
        */

        const [result] = await connection.query(
            `
            INSERT INTO cst_teams (
                academy_id,
                branch_id,
                team_name,
                team_code,
                team_type,
                category,
                age_group,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    : 1,

                created_by !== null &&
                    created_by !== undefined &&
                    created_by !== ""
                    ? Number(created_by)
                    : null
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Team created successfully",
                data: {
                    id: result.insertId
                }
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("CREATE TEAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}