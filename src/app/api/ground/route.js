import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";


// ======================================================
// GET ALL GROUNDS / FILTER
// GET /api/ground
// GET /api/ground?name=Gurgaon
// GET /api/ground?code=GRD001
// GET /api/ground?phone=9876
// GET /api/ground?address=Sohna
// GET /api/ground?name=Cricket&code=GRD&phone=9876&address=Gurgaon
// GET /api/ground?status=1
// GET /api/ground?academy_id=1
// ======================================================
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const name = searchParams.get("name")?.trim() || "";
        const code = searchParams.get("code")?.trim() || "";
        const phone = searchParams.get("phone")?.trim() || "";
        const address = searchParams.get("address")?.trim() || "";
        const status = searchParams.get("status");
        const academyId = searchParams.get("academy_id")?.trim() || "";
        const branchId = searchParams.get("branch_id")?.trim() || "";

        let sql = `
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
            WHERE g.is_deleted = 0
        `;

        const values = [];

        // Ground Name
        if (name) {
            sql += ` AND g.ground_name LIKE ?`;
            values.push(`%${name}%`);
        }

        // Ground Code
        if (code) {
            sql += ` AND g.ground_code LIKE ?`;
            values.push(`%${code}%`);
        }

        // Phone
        if (phone) {
            sql += ` AND g.phone LIKE ?`;
            values.push(`%${phone}%`);
        }

        // Address
        if (address) {
            sql += ` AND g.address LIKE ?`;
            values.push(`%${address}%`);
        }

        // Status
        if (status !== null && status !== "") {
            sql += ` AND g.status = ?`;
            values.push(status);
        }

        // Academy & Branch role-based scoping
        const authUser = await getAuthUser(request);
        if (authUser) {
            if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND g.branch_id = ? AND g.academy_id = ?";
                values.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND g.academy_id = ?";
                values.push(authUser.academy_id);
                if (branchId && Number.isInteger(Number(branchId))) {
                    sql += " AND g.branch_id = ?";
                    values.push(Number(branchId));
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND g.academy_id = ?";
                values.push(authUser.academy_id);
            } else {
                if (academyId && !isNaN(academyId)) {
                    sql += ` AND g.academy_id = ?`;
                    values.push(academyId);
                }
                if (branchId && Number.isInteger(Number(branchId))) {
                    sql += ` AND g.branch_id = ?`;
                    values.push(Number(branchId));
                }
            }
        } else {
            if (academyId && !isNaN(academyId)) {
                sql += ` AND g.academy_id = ?`;
                values.push(academyId);
            }
            if (branchId && Number.isInteger(Number(branchId))) {
                sql += ` AND g.branch_id = ?`;
                values.push(Number(branchId));
            }
        }

        sql += ` ORDER BY g.id DESC`;

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            message: "Grounds fetched successfully",
            data: rows,
            total: rows.length
        });

    } catch (error) {

        console.error("GET GROUNDS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch grounds",
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
// POST - ADD GROUND
// ======================================================
export async function POST(request) {
    let connection;

    try {
        connection = await pool.getConnection();

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
            AND is_deleted = 0
            LIMIT 1
            `,
            [ground_code.trim()]
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
                AND is_deleted = 0
                LIMIT 1
                `,
                [email.trim()]
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
        // INSERT GROUND
        // ==========================================

        const [result] = await connection.execute(
            `
            INSERT INTO cst_ground (
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
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                status !== undefined ? status : 1
            ]
        );

        // ==========================================
        // GET INSERTED RECORD
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
            `,
            [result.insertId]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Ground added successfully",
                data: rows[0]
            },
            { status: 201 }
        );

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

        console.error("POST GROUND ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to add ground",
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