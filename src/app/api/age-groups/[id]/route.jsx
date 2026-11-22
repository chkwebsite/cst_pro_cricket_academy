import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";


// =====================================================
// GET SINGLE AGE GROUP
// =====================================================
export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Age group ID is required"
            }, { status: 400 });
        }


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
    AND is_deleted = 0
            LIMIT 1
    `,
            [id]
        );


        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Age group not found"
            }, { status: 404 });
        }


        return NextResponse.json({
            success: true,
            data: rows[0]
        });


    } catch (error) {
        console.error("GET SINGLE AGE GROUP ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch age group"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}



// =====================================================
// UPDATE AGE GROUP
// =====================================================
export async function PUT(request, { params }) {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    const roleId = Number(authUser.role_id);
    if (roleId !== 1 && roleId !== 2) {
        return NextResponse.json({ success: false, message: "Forbidden. Only administrators can update age groups." }, { status: 403 });
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;

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

        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Age group ID is required"
            }, { status: 400 });
        }

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
        // CHECK EXISTING RECORD
        // =================================================

        const [existingRecord] = await connection.query(
            `
            SELECT id
            FROM cst_age_groups
            WHERE id = ?
    AND is_deleted = 0
            LIMIT 1
    `,
            [id]
        );


        if (existingRecord.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Age group not found"
            }, { status: 404 });
        }


        // =================================================
        // CHECK DUPLICATE AGE GROUP
        // =================================================

        const [duplicate] = await connection.query(
            `
            SELECT id
            FROM cst_age_groups
            WHERE age_group = ?
    AND id != ?
        AND is_deleted = 0
            LIMIT 1
    `,
            [
                age_group.trim(),
                id
            ]
        );


        if (duplicate.length > 0) {
            return NextResponse.json({
                success: false,
                message: "Age group already exists",
                errors: { age_group: "Age group already exists." }
            }, { status: 409 });
        }


        // =================================================
        // UPDATE
        // =================================================

        await connection.query(
            `
            UPDATE cst_age_groups
            SET
                age_group = ?,
                min_age = ?,
                max_age = ?,
                status = ?
            WHERE id = ?
            `,
            [
                age_group.trim(),
                Number(min_age),
                Number(max_age),
                status !== undefined ? Number(status) : 1,
                id
            ]
        );


        // =================================================
        // GET UPDATED RECORD
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
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Age group updated successfully",
            data: rows[0]
        });


    } catch (error) {
        console.error("UPDATE AGE GROUP ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to update age group"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}



// =====================================================
// DELETE AGE GROUP - SOFT DELETE
// =====================================================
export async function DELETE(request, { params }) {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }
    const roleId = Number(authUser.role_id);
    if (roleId !== 1 && roleId !== 2) {
        return NextResponse.json({ success: false, message: "Forbidden. Only administrators can delete age groups." }, { status: 403 });
    }

    const connection = await pool.getConnection();

    try {
        const { id } = await params;


        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Age group ID is required"
            }, { status: 400 });
        }


        // =================================================
        // CHECK RECORD
        // =================================================

        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_age_groups
            WHERE id = ?
    AND is_deleted = 0
            LIMIT 1
    `,
            [id]
        );


        if (existing.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Age group not found"
            }, { status: 404 });
        }


        // =================================================
        // SOFT DELETE
        // =================================================

        await connection.query(
            `
            UPDATE cst_age_groups
SET
is_deleted = 1,
    status = 0
            WHERE id = ?
    `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Age group deleted successfully"
        });


    } catch (error) {
        console.error("DELETE AGE GROUP ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete age group"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}
