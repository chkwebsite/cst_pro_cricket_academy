import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";


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
           ACADEMY / BRANCH ROLE SCOPE FILTER
        ========================================= */

        const { user: authUser } = await getAuthenticatedUser(request);

        if (authUser) {
            if (authUser.isBranchAdmin && authUser.branch_id) {
                // Branch Admin: strictly their assigned branch
                where += ` AND b.id = ? AND b.academy_id = ? `;
                params.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                // Academy Admin: strictly their academy's branches
                where += ` AND b.academy_id = ? `;
                params.push(authUser.academy_id);
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                where += ` AND b.academy_id = ? `;
                params.push(authUser.academy_id);
                const allowedBranches = authUser.assignedBranchIds && authUser.assignedBranchIds.length > 0
                    ? authUser.assignedBranchIds
                    : (authUser.branch_id ? [authUser.branch_id] : []);
                if (allowedBranches.length > 0) {
                    where += ` AND b.id IN (?) `;
                    params.push(allowedBranches);
                } else {
                    where += ` AND 1 = 0 `;
                }
            } else if (academyId) {
                const academyIdNumber = Number(academyId);
                if (!Number.isInteger(academyIdNumber) || academyIdNumber <= 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: "Invalid academy_id",
                        },
                        { status: 400 }
                    );
                }
                where += ` AND b.academy_id = ? `;
                params.push(academyIdNumber);
            }
        } else {
            // Public website access: list active, non-deleted branches
            where += ` AND b.status = 1`;
            if (academyId) {
                const academyIdNumber = Number(academyId);
                if (Number.isInteger(academyIdNumber) && academyIdNumber > 0) {
                    where += ` AND b.academy_id = ? `;
                    params.push(academyIdNumber);
                }
            }
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
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin) {
        return NextResponse.json(
            { success: false, message: "Only Academy Admin and Super Admin can create branches" },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {

        const body =
            await request.json();

        // If Academy Admin, strictly enforce their own academy_id
        if (authUser.isAcademyAdmin) {
            body.academy_id = authUser.academy_id;
        }

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
                    message: "academy_id is required",
                    errors: { academy_id: "Please select an academy." },
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
                    message: "Invalid academy_id",
                    errors: { academy_id: "Invalid academy selected." },
                },
                { status: 400 }
            );
        }

        if (!branch_name?.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch name is required",
                    errors: { branch_name: "Branch name is required." },
                },
                { status: 400 }
            );
        }

        if (!branch_code?.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch code is required",
                    errors: { branch_code: "Branch code is required." },
                },
                { status: 400 }
            );
        }

        if (!email?.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email is required",
                    errors: { email: "Email is required." },
                },
                { status: 400 }
            );
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email.trim())) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please enter a valid email address",
                    errors: { email: "Please enter a valid email address (e.g. name@example.com)." },
                },
                { status: 400 }
            );
        }

        if (!phone?.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Phone number is required",
                    errors: { phone: "Phone number is required." },
                },
                { status: 400 }
            );
        }

        const phoneDigits = String(phone).replace(/\D/g, "");
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please enter a valid phone number (at least 10 digits)",
                    errors: { phone: "Please enter a valid phone number (at least 10 digits)." },
                },
                { status: 400 }
            );
        }

        if (!address?.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Address is required",
                    errors: { address: "Address is required." },
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
                    errors: { branch_code: "Branch code already exists for this academy." },
                },
                { status: 409 }
            );
        }

        /* =========================================
           CHECK DUPLICATE BRANCH NAME
           Unique per academy
        ========================================= */

        const [existingName] =
            await connection.query(
                `
                SELECT id
                FROM cst_branch
                WHERE academy_id = ?
                AND LOWER(TRIM(branch_name)) = LOWER(TRIM(?))
                LIMIT 1
                `,
                [
                    academyIdNumber,
                    branch_name.trim(),
                ]
            );

        if (existingName.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A branch with this name already exists in this academy",
                    errors: { branch_name: "A branch with this name already exists in this academy." },
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
                    email.trim(),
                    phone.trim(),
                    address.trim(),
                    city ? city.trim() : null,
                    state ? state.trim() : null,
                    pin_code ? pin_code.trim() : null,
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

        if (error.code === "ER_DUP_ENTRY") {
            const isNameDup = error.message?.includes("uq_branch_name") || error.sqlMessage?.includes("uq_branch_name");
            return NextResponse.json(
                {
                    success: false,
                    message: isNameDup
                        ? "A branch with this name already exists in this academy"
                        : "Branch code already exists for this academy",
                    errors: isNameDup
                        ? { branch_name: "A branch with this name already exists in this academy." }
                        : { branch_code: "Branch code already exists for this academy." },
                },
                { status: 409 }
            );
        }

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