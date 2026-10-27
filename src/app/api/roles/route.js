import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim() || "";
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const status = searchParams.get("status");



        let sql = `
            SELECT
                r.id,
                r.role_name,
                r.role_desc,
                r.academy_id,
                a.academy_name,
                r.branch_id,
                b.branch_name,
                r.status,
                r.created_at,
                r.updated_at
            FROM cst_roles r
            LEFT JOIN cst_academy a
                ON a.id = r.academy_id
            LEFT JOIN cst_branch b
                ON b.id = r.branch_id
            WHERE 1 = 1
        `;

        const params = [];

        // Search
        if (search) {
            sql += `
                AND (
                    r.role_name LIKE ?
                    OR r.role_desc LIKE ?
                    OR a.academy_name LIKE ?
                    OR b.branch_name LIKE ?
                )
            `;

            const searchValue = `%${search}%`;

            params.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        // Academy filter
        if (academy_id) {
            sql += ` AND r.academy_id = ?`;
            params.push(academy_id);
        }

        // Branch filter
        if (branch_id) {
            sql += ` AND r.branch_id = ?`;
            params.push(branch_id);
        }

        // Status filter
        if (status !== null && status !== "") {
            sql += ` AND r.status = ?`;
            params.push(status);
        }

        // No sorting
        const [roles] = await connection.query(sql, params);

        return NextResponse.json(
            {
                success: true,
                count: roles.length,
                data: roles,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("GET Roles Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch roles",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
}


/* =====================================================
   POST - CREATE ROLE
===================================================== */

export async function POST(request) {

    const connection = await pool.getConnection();

    try {

        const body =
            await request.json();

        const {
            role_name,
            role_desc = null,
            academy_id = null,
            branch_id = null,
            status = 1,
        } = body;


        /* =========================================
           VALIDATION
        ========================================= */

        if (!role_name?.trim()) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Role name is required",
                },
                { status: 400 }
            );
        }


        if (status !== 0 && status !== 1) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Status must be 0 or 1",
                },
                { status: 400 }
            );
        }


        let academyIdNumber = null;
        let branchIdNumber = null;


        /* =========================================
           ACADEMY VALIDATION
        ========================================= */

        if (
            academy_id !== null &&
            academy_id !== undefined &&
            academy_id !== ""
        ) {

            academyIdNumber =
                Number(academy_id);

            if (
                !Number.isInteger(academyIdNumber) ||
                academyIdNumber <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Invalid academy_id",
                    },
                    { status: 400 }
                );
            }


            const [academyRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM cst_academy
                    WHERE id = ?
                    AND is_deleted = 0
                    LIMIT 1
                    `,
                    [academyIdNumber]
                );


            if (academyRows.length === 0) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Academy not found",
                    },
                    { status: 404 }
                );
            }
        }


        /* =========================================
           BRANCH VALIDATION
        ========================================= */

        if (
            branch_id !== null &&
            branch_id !== undefined &&
            branch_id !== ""
        ) {

            branchIdNumber =
                Number(branch_id);

            if (
                !Number.isInteger(branchIdNumber) ||
                branchIdNumber <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Invalid branch_id",
                    },
                    { status: 400 }
                );
            }


            const [branchRows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        academy_id
                    FROM cst_branch
                    WHERE id = ?
                    AND is_deleted = 0
                    LIMIT 1
                    `,
                    [branchIdNumber]
                );


            if (branchRows.length === 0) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Branch not found",
                    },
                    { status: 404 }
                );
            }


            /* Branch must belong to selected academy */

            if (
                academyIdNumber !== null &&
                branchRows[0].academy_id !==
                academyIdNumber
            ) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Branch does not belong to selected academy",
                    },
                    { status: 400 }
                );
            }


            /* If branch selected but academy not selected */

            if (
                academyIdNumber === null
            ) {

                academyIdNumber =
                    branchRows[0].academy_id;
            }
        }


        /* =========================================
           DUPLICATE ROLE CHECK
        ========================================= */

        let duplicateQuery = `
            SELECT id
            FROM cst_roles
            WHERE role_name = ?
        `;

        const duplicateParams = [
            role_name.trim(),
        ];


        if (academyIdNumber === null) {

            duplicateQuery += `
                AND academy_id IS NULL
            `;

        } else {

            duplicateQuery += `
                AND academy_id = ?
            `;

            duplicateParams.push(
                academyIdNumber
            );
        }


        if (branchIdNumber === null) {

            duplicateQuery += `
                AND branch_id IS NULL
            `;

        } else {

            duplicateQuery += `
                AND branch_id = ?
            `;

            duplicateParams.push(
                branchIdNumber
            );
        }


        duplicateQuery += `
            LIMIT 1
        `;


        const [existing] =
            await connection.query(
                duplicateQuery,
                duplicateParams
            );


        if (existing.length > 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Role already exists in this scope",
                },
                { status: 409 }
            );
        }


        /* =========================================
           INSERT
        ========================================= */



        const [result] =
            await connection.query(
                `
                INSERT INTO cst_roles (
                    role_name,
                    role_desc,
                    academy_id,
                    branch_id,
                    status
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    role_name.trim(),
                    role_desc,
                    academyIdNumber,
                    branchIdNumber,
                    Number(status),
                ]
            );


        /* =========================================
           GET CREATED ROLE
        ========================================= */

        const [rows] =
            await connection.query(
                `
                SELECT
                    r.id,
                    r.role_name,
                    r.role_desc,
                    r.academy_id,
                    a.academy_name,
                    a.academy_code,
                    r.branch_id,
                    b.branch_name,
                    b.branch_code,
                    r.status,
                    r.created_at,
                    r.updated_at

                FROM cst_roles r

                LEFT JOIN cst_academy a
                    ON a.id = r.academy_id

                LEFT JOIN cst_branch b
                    ON b.id = r.branch_id

                WHERE r.id = ?
                `,
                [result.insertId]
            );


        return NextResponse.json(
            {
                success: true,
                message:
                    "Role created successfully",
                data: rows[0],
            },
            { status: 201 }
        );

    } catch (error) {

        console.error(
            "CREATE ROLE ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to create role",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {

        if (connection) {
            connection.release();
        }
    }
}