import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


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


        if (!age_group || !age_group.trim()) {
            return NextResponse.json({
                success: false,
                message: "Age group is required"
            }, { status: 400 });
        }


        // =================================================
        // AGE VALIDATION
        // =================================================

        if (
            min_age !== undefined &&
            min_age !== null &&
            min_age !== "" &&
            Number(min_age) < 0
        ) {
            return NextResponse.json({
                success: false,
                message: "Minimum age cannot be negative"
            }, { status: 400 });
        }


        if (
            max_age !== undefined &&
            max_age !== null &&
            max_age !== "" &&
            Number(max_age) < 0
        ) {
            return NextResponse.json({
                success: false,
                message: "Maximum age cannot be negative"
            }, { status: 400 });
        }


        if (
            min_age !== undefined &&
            min_age !== null &&
            min_age !== "" &&
            max_age !== undefined &&
            max_age !== null &&
            max_age !== "" &&
            Number(min_age) > Number(max_age)
        ) {
            return NextResponse.json({
                success: false,
                message: "Minimum age cannot be greater than maximum age"
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
                message: "Age group already exists"
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
                min_age !== undefined && min_age !== "" ? min_age : null,
                max_age !== undefined && max_age !== "" ? max_age : null,
                status ?? 1,
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
