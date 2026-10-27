import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


/* =====================================================
   GET - BRANCH LIST
   Search + Filter + Sorting
===================================================== */

export async function GET(request) {
    const connection = await pool.getConnection();
    try {
        const { searchParams } = new URL(request.url);

        const academyId =
            searchParams.get("academy_id")?.trim() || "";

        const search =
            searchParams.get("search")?.trim() || "";

        const branchCode =
            searchParams.get("branch_code")?.trim() || "";

        const city =
            searchParams.get("city")?.trim() || "";

        const state =
            searchParams.get("state")?.trim() || "";

        const statusParam =
            searchParams.get("status");


        /* =========================================
           SORTING
        ========================================= */

        const allowedSortColumns = [
            "id",
            "branch_name",
            "branch_code",
            "academy_id",
            "city",
            "state",
            "status",
            "created_at",
            "updated_at",
        ];

        const requestedSort =
            searchParams.get("sortBy") || "id";

        const sortBy =
            allowedSortColumns.includes(requestedSort)
                ? requestedSort
                : "id";

        const sortOrder =
            searchParams
                .get("sortOrder")
                ?.toUpperCase() === "ASC"
                ? "ASC"
                : "DESC";


        /* =========================================
           WHERE
        ========================================= */

        let where = `
            WHERE b.is_deleted = 0
        `;

        const params = [];


        /* =========================================
           ACADEMY FILTER
        ========================================= */

        if (academyId) {

            const academyIdNumber =
                Number(academyId);

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

            where += `
                AND b.academy_id = ?
            `;

            params.push(
                academyIdNumber
            );
        }


        /* =========================================
           GLOBAL SEARCH
        ========================================= */

        if (search) {

            where += `
                AND (
                    b.branch_name LIKE ?
                    OR b.branch_code LIKE ?
                    OR b.email LIKE ?
                    OR b.phone LIKE ?
                    OR b.city LIKE ?
                    OR b.state LIKE ?
                    OR a.academy_name LIKE ?
                    OR a.academy_code LIKE ?
                )
            `;

            const value = `%${search}%`;

            params.push(
                value,
                value,
                value,
                value,
                value,
                value,
                value,
                value
            );
        }


        /* =========================================
           BRANCH CODE
        ========================================= */

        if (branchCode) {

            where += `
                AND b.branch_code LIKE ?
            `;

            params.push(
                `%${branchCode}%`
            );
        }


        /* =========================================
           CITY
        ========================================= */

        if (city) {

            where += `
                AND b.city = ?
            `;

            params.push(city);
        }


        /* =========================================
           STATE
        ========================================= */

        if (state) {

            where += `
                AND b.state = ?
            `;

            params.push(state);
        }


        /* =========================================
           STATUS
        ========================================= */

        if (
            statusParam !== null &&
            statusParam !== ""
        ) {

            const status =
                Number(statusParam);

            if (
                status !== 0 &&
                status !== 1
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Status must be 0 or 1",
                    },
                    { status: 400 }
                );
            }

            where += `
                AND b.status = ?
            `;

            params.push(status);
        }


        /* =========================================
           FETCH BRANCHES
           Academy information included
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

                ${where}

                ORDER BY
                    b.${sortBy} ${sortOrder}
                `,
                params
            );


        return NextResponse.json({
            success: true,

            message:
                "Branches fetched successfully",

            count: rows.length,

            data: rows,

            filters: {
                academy_id:
                    academyId
                        ? Number(academyId)
                        : null,

                search,

                branch_code:
                    branchCode,

                city,

                state,

                status:
                    statusParam !== null
                        ? Number(statusParam)
                        : null,
            },

            sorting: {
                sortBy,
                sortOrder,
            },
        });

    } catch (error) {

        console.error(
            "GET BRANCH ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to fetch branches",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/* =====================================================
   POST - CREATE BRANCH
===================================================== */

export async function POST(request) {

    const connection = await pool.getConnection();

    try {

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


        if (
            status !== 0 &&
            status !== 1 &&
            status !== "0" &&
            status !== "1"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Status must be 0 or 1",
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
                SELECT
                    id,
                    academy_name,
                    academy_code
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
           CHECK DUPLICATE BRANCH CODE
           Unique per academy
        ========================================= */

        const [existing] =
            await connection.query(
                `
                SELECT id
                FROM cst_branch
                WHERE academy_id = ?
                AND branch_code = ?
                LIMIT 1
                `,
                [
                    academyIdNumber,
                    branch_code.trim(),
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
           INSERT
        ========================================= */



        const [result] =
            await connection.query(
                `
                INSERT INTO cst_branch (
                    academy_id,
                    branch_name,
                    branch_code,
                    directions,
                    email,
                    phone,
                    address,
                    city,
                    state,
                    pin_code,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    academyIdNumber,
                    branch_name.trim(),
                    branch_code.trim(),
                    directions ? directions.trim() : null,
                    email,
                    phone,
                    address,
                    city,
                    state,
                    pin_code,
                    Number(status),
                ]
            );


        /* =========================================
           GET CREATED BRANCH
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
                [result.insertId]
            );


        return NextResponse.json(
            {
                success: true,
                message:
                    "Branch created successfully",
                data: rows[0],
            },
            { status: 201 }
        );

    } catch (error) {

        console.error(
            "CREATE BRANCH ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to create branch",
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