import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// ======================================================
// GET SINGLE GROUND
// GET /api/ground/1
// ======================================================
export async function GET(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid ground ID is required"
                },
                { status: 400 }
            );
        }

        const [rows] = await connection.execute(
            `
            SELECT
                g.id,
                g.academy_id,
                g.branch_id,
                a.academy_name,
                b.branch_name,
                g.ground_name,
                g.ground_code,
                g.contact_person,
                g.phone,
                g.email,
                g.address,
                g.description,
                g.ground_facility,
                g.status,
                g.is_deleted,
                g.created_at,
                g.updated_at
            FROM cst_ground g
            LEFT JOIN cst_academy a ON a.id = g.academy_id
            LEFT JOIN cst_branch b ON b.id = g.branch_id
            WHERE g.id = ?
            AND g.is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground not found"
                },
                { status: 404 }
            );
        }

        const [images] = await connection.execute(
            `
            SELECT id, ground_image, is_primary
            FROM cst_ground_images
            WHERE ground_id = ?
            AND status = 1
            ORDER BY is_primary DESC, id DESC
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Ground fetched successfully",
            data: { ...rows[0], images }
        });

    } catch (error) {

        console.error("GET SINGLE GROUND ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground",
                error: error.message
            },
            { status: 500 }
        );

    } finally {

        if (connection) {
            connection.release();
        }
    }
}


// ======================================================
// UPDATE GROUND
// PUT /api/ground/1
// ======================================================
export async function PUT(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid ground ID is required"
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const {
            academy_id,
            branch_id,
            ground_name,
            ground_code,
            contact_person,
            phone,
            email,
            address,
            description,
            ground_facility,
            status
        } = body;

        // ==========================================
        // VALIDATION
        // ==========================================

        const academyId = Number(academy_id);

        if (!academy_id || !Number.isInteger(academyId) || academyId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy is required"
                },
                { status: 400 }
            );
        }

        const branchId = Number(branch_id);
        if (!branch_id || !Number.isInteger(branchId) || branchId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch is required"
                },
                { status: 400 }
            );
        }

        if (!ground_name || !ground_name.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground name is required"
                },
                { status: 400 }
            );
        }

        if (!ground_code || !ground_code.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground code is required"
                },
                { status: 400 }
            );
        }

        if (!address || !address.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Address is required"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // CHECK GROUND EXISTS
        // ==========================================

        const [existingGround] = await connection.execute(
            `
            SELECT id
            FROM cst_ground
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (existingGround.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground not found"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // CHECK ACADEMY EXISTS
        // ==========================================

        const [academyRows] = await connection.execute(
            `SELECT id FROM cst_academy WHERE id = ? LIMIT 1`,
            [academyId]
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

        const [branchRows] = await connection.execute(
            `SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? AND is_deleted = 0 LIMIT 1`,
            [branchId, academyId]
        );

        if (branchRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch not found for the selected academy"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // CHECK DUPLICATE GROUND CODE
        // ==========================================

        const [existingCode] = await connection.execute(
            `
            SELECT id
            FROM cst_ground
            WHERE ground_code = ?
            AND id != ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [
                ground_code.trim(),
                id
            ]
        );

        if (existingCode.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground code already exists"
                },
                { status: 409 }
            );
        }

        // ==========================================
        // CHECK DUPLICATE EMAIL
        // ==========================================

        if (email && email.trim()) {

            const [existingEmail] = await connection.execute(
                `
                SELECT id
                FROM cst_ground
                WHERE email = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    email.trim(),
                    id
                ]
            );

            if (existingEmail.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Email already exists"
                    },
                    { status: 409 }
                );
            }
        }

        // ==========================================
        // UPDATE
        // ==========================================

        await connection.execute(
            `
            UPDATE cst_ground
            SET
                academy_id = ?,
                branch_id = ?,
                ground_name = ?,
                ground_code = ?,
                contact_person = ?,
                phone = ?,
                email = ?,
                address = ?,
                description = ?,
                ground_facility = ?,
                status = ?
            WHERE id = ?
            AND is_deleted = 0
            `,
            [
                academyId,
                branchId,
                ground_name.trim(),
                ground_code.trim(),
                contact_person?.trim() || null,
                phone?.trim() || null,
                email?.trim() || null,
                address.trim(),
                description?.trim() || null,
                ground_facility?.trim() || null,
                status !== undefined ? status : 1,
                id
            ]
        );

        // ==========================================
        // GET UPDATED RECORD
        // ==========================================

        const [rows] = await connection.execute(
            `
            SELECT
                g.id,
                g.academy_id,
                g.branch_id,
                a.academy_name,
                g.ground_name,
                g.ground_code,
                g.contact_person,
                g.phone,
                g.email,
                g.address,
                g.description,
                g.ground_facility,
                g.status,
                g.is_deleted,
                g.created_at,
                g.updated_at
            FROM cst_ground g
            LEFT JOIN cst_academy a ON a.id = g.academy_id
            WHERE g.id = ?
            LIMIT 1
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Ground updated successfully",
            data: rows[0]
        });

    } catch (error) {

        // DB-level guards (unique email key / academy foreign key)
        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email already exists (it may belong to a deleted ground)"
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy not found"
                },
                { status: 404 }
            );
        }

        console.error("UPDATE GROUND ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update ground",
                error: error.message
            },
            { status: 500 }
        );

    } finally {

        if (connection) {
            connection.release();
        }
    }
}


// ======================================================
// DELETE GROUND
// DELETE /api/ground/1
// ======================================================
export async function DELETE(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid ground ID is required"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // CHECK GROUND EXISTS
        // ==========================================

        const [existingGround] = await connection.execute(
            `
            SELECT id
            FROM cst_ground
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (existingGround.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground not found"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // SOFT DELETE
        // ==========================================

        await connection.execute(
            `
            UPDATE cst_ground
            SET
                is_deleted = 1,
                status = 0
            WHERE id = ?
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Ground deleted successfully"
        });

    } catch (error) {

        console.error("DELETE GROUND ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete ground",
                error: error.message
            },
            { status: 500 }
        );

    } finally {

        if (connection) {
            connection.release();
        }
    }
}