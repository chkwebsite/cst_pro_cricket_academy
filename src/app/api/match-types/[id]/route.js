import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// =====================================================
// GET - SINGLE MATCH TYPE
// =====================================================
export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        const [rows] = await connection.query(
            `
            SELECT
                id,
                name,
                code,
                description,
                status,
                is_deleted,
                created_at,
                updated_at
            FROM cst_match_types
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
                    message: "Match type not found"
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Match type fetched successfully",
            data: rows[0]
        });

    } catch (error) {
        console.error("GET SINGLE MATCH TYPE ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch match type",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// PUT - UPDATE MATCH TYPE
// =====================================================
export async function PUT(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        const body = await request.json();

        const {
            name,
            code,
            description = null,
            status = 1
        } = body;

        // ==========================================
        // VALIDATION
        // ==========================================

        if (!name || !name.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match type name is required"
                },
                { status: 400 }
            );
        }

        if (!code || !code.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match type code is required"
                },
                { status: 400 }
            );
        }

        const matchTypeName = name.trim();
        const matchTypeCode = code.trim().toUpperCase();

        // ==========================================
        // CHECK EXISTING
        // ==========================================

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_match_types
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match type not found"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // CHECK DUPLICATE NAME
        // ==========================================

        const [nameRows] = await connection.query(
            `
            SELECT id
            FROM cst_match_types
            WHERE LOWER(name) = LOWER(?)
            AND id != ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [
                matchTypeName,
                id
            ]
        );

        if (nameRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match type name already exists"
                },
                { status: 409 }
            );
        }

        // ==========================================
        // CHECK DUPLICATE CODE
        // ==========================================

        const [codeRows] = await connection.query(
            `
            SELECT id
            FROM cst_match_types
            WHERE code = ?
            AND id != ?
            LIMIT 1
            `,
            [
                matchTypeCode,
                id
            ]
        );

        if (codeRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match type code already exists"
                },
                { status: 409 }
            );
        }

        // ==========================================
        // UPDATE
        // ==========================================

        await connection.query(
            `
            UPDATE cst_match_types

            SET
                name = ?,
                code = ?,
                description = ?,
                status = ?

            WHERE id = ?
            `,
            [
                matchTypeName,
                matchTypeCode,
                description,
                status,
                id
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Match type updated successfully",
            data: {
                id: Number(id),
                name: matchTypeName,
                code: matchTypeCode,
                description,
                status: Number(status)
            }
        });

    } catch (error) {
        console.error("PUT MATCH TYPE ERROR:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match type code already exists"
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update match type",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// DELETE - SOFT DELETE
// =====================================================
export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        // ==========================================
        // CHECK EXISTING
        // ==========================================

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_match_types
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Match type not found"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // SOFT DELETE
        // ==========================================

        await connection.query(
            `
            UPDATE cst_match_types
            SET
                is_deleted = 1,
                status = 0
            WHERE id = ?
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Match type deleted successfully"
        });

    } catch (error) {
        console.error("DELETE MATCH TYPE ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete match type",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}