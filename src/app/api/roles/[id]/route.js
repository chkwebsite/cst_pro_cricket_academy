import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
/* =====================================================
   GET SINGLE ROLE
===================================================== */

export async function GET(request,{ params }) {
    try {

        const { id } = await params;

        const [rows] =
            await pool.query(
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

                LIMIT 1
                `,
                [id]
            );


        if (rows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Role not found",
                },
                { status: 404 }
            );
        }


        return NextResponse.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {

        console.error(
            "GET SINGLE ROLE ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to fetch role",
                error: error.message,
            },
            { status: 500 }
        );
    }
}


/* =====================================================
   PUT - UPDATE ROLE
===================================================== */

export async function PUT(
    request,
    { params }
) {
    let connection = null;

    try {

        const { id } = await params;

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
           CHECK ROLE
        ========================================= */

        const [roleRows] =
            await pool.query(
                `
                SELECT id
                FROM cst_roles
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );


        if (roleRows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Role not found",
                },
                { status: 404 }
            );
        }


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
           ACADEMY
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
                await pool.query(
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
           BRANCH
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
                await pool.query(
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


            if (
                academyIdNumber === null
            ) {
                academyIdNumber =
                    branchRows[0].academy_id;
            }
        }


        /* =========================================
           DUPLICATE ROLE
        ========================================= */

        let duplicateQuery = `
            SELECT id
            FROM cst_roles
            WHERE role_name = ?
            AND id != ?
        `;

        const duplicateParams = [
            role_name.trim(),
            id,
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
            await pool.query(
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
           UPDATE
        ========================================= */

        connection =
            await pool.getConnection();


        await connection.execute(
            `
            UPDATE cst_roles
            SET
                role_name = ?,
                role_desc = ?,
                academy_id = ?,
                branch_id = ?,
                status = ?

            WHERE id = ?
            `,
            [
                role_name.trim(),
                role_desc,
                academyIdNumber,
                branchIdNumber,
                Number(status),
                id,
            ]
        );


        /* =========================================
           GET UPDATED ROLE
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
                [id]
            );


        return NextResponse.json({
            success: true,
            message:
                "Role updated successfully",
            data: rows[0],
        });

    } catch (error) {

        console.error(
            "UPDATE ROLE ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to update role",
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
   DELETE - HARD DELETE
===================================================== */

export async function DELETE(
    request,
    { params }
) {
    let connection = null;

    try {

        const { id } = await params;


        connection =
            await pool.getConnection();


        const [rows] =
            await connection.execute(
                `
                SELECT id
                FROM cst_roles
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );


        if (rows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Role not found",
                },
                { status: 404 }
            );
        }


        await connection.execute(
            `
            DELETE FROM cst_roles
            WHERE id = ?
            `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message:
                "Role deleted successfully",
        });

    } catch (error) {

        console.error(
            "DELETE ROLE ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to delete role",
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