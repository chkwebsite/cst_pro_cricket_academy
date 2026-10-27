import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// =====================================================
// GET - ALL MATCH TYPES
// =====================================================
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const name = searchParams.get("name");
        const code = searchParams.get("code");
        const status = searchParams.get("status");

        let where = `
            WHERE is_deleted = 0
        `;

        const params = [];

        // Name search
        if (name) {
            where += ` AND name LIKE ?`;
            params.push(`%${name}%`);
        }

        // Code search
        if (code) {
            where += ` AND code LIKE ?`;
            params.push(`%${code}%`);
        }

        // Status
        if (status !== null && status !== "") {
            where += ` AND status = ?`;
            params.push(status);
        }

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
            ${where}
            ORDER BY id DESC
            `,
            params
        );

        return NextResponse.json({
            success: true,
            message: "Match types fetched successfully",
            data: rows
        });

    } catch (error) {
        console.error("GET MATCH TYPES ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch match types",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// POST - CREATE MATCH TYPE
// =====================================================
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
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

        // ==========================================
        // CLEAN DATA
        // ==========================================

        const matchTypeName = name.trim();
        const matchTypeCode = code.trim().toUpperCase();

        // ==========================================
        // CHECK DUPLICATE NAME
        // ==========================================

        const [nameRows] = await connection.query(
            `
            SELECT id
            FROM cst_match_types
            WHERE LOWER(name) = LOWER(?)
            AND is_deleted = 0
            LIMIT 1
            `,
            [matchTypeName]
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
            LIMIT 1
            `,
            [matchTypeCode]
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
        // INSERT
        // ==========================================

        const [result] = await connection.query(
            `
            INSERT INTO cst_match_types
            (
                name,
                code,
                description,
                status
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?
            )
            `,
            [
                matchTypeName,
                matchTypeCode,
                description,
                status
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Match type created successfully",
                data: {
                    id: result.insertId,
                    name: matchTypeName,
                    code: matchTypeCode,
                    description,
                    status: Number(status)
                }
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("POST MATCH TYPE ERROR:", error);

        // MySQL duplicate unique code protection
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
                message: "Failed to create match type",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}