import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";


// =====================================================
// GET ALL AGE GROUPS
// =====================================================
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status");

        let sql = `
SELECT
id,
    age_group,
    min_age,
    max_age,
    status,
    is_deleted,
    created_at,
    updated_at
            FROM cst_age_groups
            WHERE is_deleted = 0
    `;

        const values = [];

        // STATUS FILTER
        if (status !== null && status !== "") {
            sql += ` AND status = ? `;
            values.push(status);
        }

        sql += ` ORDER BY id DESC`;

        const [rows] = await connection.query(sql, values);

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET AGE GROUPS ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch age groups"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}


// =====================================================
// CREATE AGE GROUP
// =====================================================
export async function POST(request) {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    const roleId = Number(authUser.role_id);
    if (roleId !== 1 && roleId !== 2) {
        return NextResponse.json({ success: false, message: "Forbidden. Only administrators can manage age groups." }, { status: 403 });
    }

    const connection = await pool.getConnection();

    try {
        const body = await request.json();

        const {
            age_group,
            min_age,
            max_age,
            status
        } = body;


        // =================================================
        // VALIDATION
        // =================================================

        const errors = {};

        if (!age_group || !age_group.trim()) {
            errors.age_group = "Age group name is required.";
        }

        // =================================================
        // AGE VALIDATION (MANDATORY)
        // =================================================

        if (min_age === undefined || min_age === null || String(min_age).trim() === "") {
            errors.min_age = "Minimum age is required.";
        } else if (isNaN(Number(min_age)) || Number(min_age) < 0) {
            errors.min_age = "Minimum age must be a valid non-negative number.";
        }

        if (max_age === undefined || max_age === null || String(max_age).trim() === "") {
            errors.max_age = "Maximum age is required.";
        } else if (isNaN(Number(max_age)) || Number(max_age) < 0) {
            errors.max_age = "Maximum age must be a valid non-negative number.";
        }

        if (!errors.min_age && !errors.max_age && Number(min_age) > Number(max_age)) {
            errors.min_age = "Minimum age cannot be greater than maximum age.";
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json({
                success: false,
                message: Object.values(errors)[0],
                errors,
            }, { status: 400 });
        }

        // =================================================
        // CHECK DUPLICATE AGE GROUP
        // =================================================

        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_age_groups
            WHERE age_group = ?
    AND is_deleted = 0
            LIMIT 1
    `,
            [age_group.trim()]
        );

        if (existing.length > 0) {
            return NextResponse.json({
                success: false,
                message: "Age group already exists",
                errors: { age_group: "Age group already exists." }
            }, { status: 409 });
        }


        // =================================================
        // INSERT
        // =================================================

        const [result] = await connection.query(
            `
            INSERT INTO cst_age_groups
            (
                age_group,
                min_age,
                max_age,
                status
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                age_group.trim(),
                Number(min_age),
                Number(max_age),
                status !== undefined ? Number(status) : 1
            ]
        );


        // =================================================
        // GET CREATED RECORD
        // =================================================

        const [rows] = await connection.query(
            `
SELECT
id,
    age_group,
    min_age,
    max_age,
    status,
    is_deleted,
    created_at,
    updated_at
            FROM cst_age_groups
            WHERE id = ?
    LIMIT 1
        `,
            [result.insertId]
        );


        return NextResponse.json({
            success: true,
            message: "Age group created successfully",
            data: rows[0]
        }, { status: 201 });


    } catch (error) {
        console.error("CREATE AGE GROUP ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to create age group"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}
