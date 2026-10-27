import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

/* =====================================================
   GET SINGLE BRANCH
===================================================== */

export async function GET(request, { params }) {

    const connection = await pool.getConnection();

    try {

        const { id } =
            await params;


        const [rows] =
            await connection.query(
                `
                SELECT
                    b.id,
                    b.academy_id,

                    a.academy_name,
                    a.academy_code,

                    b.branch_name,
                    b.branch_code,
                    b.directions,
                    b.email,
                    b.phone,
                    b.address,
                    b.city,
                    b.state,
                    b.pin_code,
                    b.status,
                    b.created_at,
                    b.updated_at

                FROM cst_branch b

                INNER JOIN cst_academy a
                    ON a.id = b.academy_id

                WHERE b.id = ?
                AND b.is_deleted = 0

                LIMIT 1
                `,
                [id]
            );


        if (rows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Branch not found",
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
            "GET SINGLE BRANCH ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to fetch branch",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/* =====================================================
   PUT - UPDATE BRANCH
===================================================== */

export async function PUT(request, { params }) {
    const connection = await pool.getConnection();
    try {

        const { id } =
            await params;

        const body =
            await request.json();


        const {
            academy_id,
            branch_name,
            branch_code,
            directions = null,
            email = null,
            phone = null,
            address = null,
            city = null,
            state = null,
            pin_code = null,
            status = 1,
        } = body;


        /* =========================================
           CHECK BRANCH
        ========================================= */

        const [branchRows] =
            await connection.query(
                `
                SELECT id
                FROM cst_branch
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [id]
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


        /* =========================================
           VALIDATION
        ========================================= */

        if (
            academy_id === undefined ||
            academy_id === null
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "academy_id is required",
                },
                { status: 400 }
            );
        }


        const academyIdNumber =
            Number(academy_id);


        if (
            !Number.isInteger(
                academyIdNumber
            ) ||
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


        if (!branch_name?.trim()) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Branch name is required",
                },
                { status: 400 }
            );
        }


        if (!branch_code?.trim()) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Branch code is required",
                },
                { status: 400 }
            );
        }


        /* =========================================
           CHECK ACADEMY
        ========================================= */

        const [academyRows] =
            await connection.query(
                `
                SELECT id
                FROM cst_academy
                WHERE id = ?
                AND is_deleted = 0
                AND status = 1
                LIMIT 1
                `,
                [academyIdNumber]
            );


        if (academyRows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Academy not found or inactive",
                },
                { status: 404 }
            );
        }


        /* =========================================
           DUPLICATE BRANCH CODE
           Exclude current branch
        ========================================= */

        const [existing] =
            await connection.query(
                `
                SELECT id
                FROM cst_branch
                WHERE academy_id = ?
                AND branch_code = ?
                AND id != ?
                LIMIT 1
                `,
                [
                    academyIdNumber,
                    branch_code.trim(),
                    id,
                ]
            );


        if (existing.length > 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Branch code already exists for this academy",
                },
                { status: 409 }
            );
        }


        /* =========================================
           UPDATE
        ========================================= */




        await connection.query(
            `
            UPDATE cst_branch
            SET
                academy_id = ?,
                branch_name = ?,
                branch_code = ?,
                directions = ?,
                email = ?,
                phone = ?,
                address = ?,
                city = ?,
                state = ?,
                pin_code = ?,
                status = ?
            WHERE id = ?
            `,
            [
                academyIdNumber,
                branch_name.trim(),
                branch_code.trim(),
                directions !== undefined && directions !== null ? (typeof directions === "string" ? directions.trim() || null : null) : null,
                email,
                phone,
                address,
                city,
                state,
                pin_code,
                Number(status),
                id,
            ]
        );


        /* =========================================
           GET UPDATED DATA
        ========================================= */

        const [rows] =
            await connection.query(
                `
                SELECT
                    b.id,
                    b.academy_id,
                    a.academy_name,
                    a.academy_code,
                    b.branch_name,
                    b.branch_code,
                    b.directions,
                    b.email,
                    b.phone,
                    b.address,
                    b.city,
                    b.state,
                    b.pin_code,
                    b.status,
                    b.created_at,
                    b.updated_at

                FROM cst_branch b

                INNER JOIN cst_academy a
                    ON a.id = b.academy_id

                WHERE b.id = ?
                `,
                [id]
            );


        return NextResponse.json({
            success: true,
            message:
                "Branch updated successfully",
            data: rows[0],
        });

    } catch (error) {

        console.error(
            "UPDATE BRANCH ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to update branch",
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
   DELETE - SOFT DELETE
===================================================== */

export async function DELETE(
    request,
    { params }
) {

    let connection = null;

    try {

        const { id } =
            await params;


        connection =
            await pool.getConnection();


        const [rows] =
            await connection.execute(
                `
                SELECT id
                FROM cst_branch
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [id]
            );


        if (rows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Branch not found",
                },
                { status: 404 }
            );
        }


        await connection.execute(
            `
            UPDATE cst_branch
            SET
                is_deleted = 1,
                status = 0
            WHERE id = ?
            `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message:
                "Branch deleted successfully",
        });

    } catch (error) {

        console.error(
            "DELETE BRANCH ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to delete branch",
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