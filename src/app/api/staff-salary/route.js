import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

// Helper: Calculate standard salary components from monthly/gross salary
export function autoCalculateComponents(monthlySalary, pfRate = 0.12, customAdvance = 0) {
    const gross = Number(monthlySalary) || 0;
    // Standard Indian salary structure:
    // Basic: 60%, HRA: 20%, Conveyance: 8%, Other Allowance: 12%
    const basic = Math.round(gross * 0.60 * 100) / 100;
    const hra = Math.round(gross * 0.20 * 100) / 100;
    const conveyance = Math.round(gross * 0.08 * 100) / 100;
    const otherAllowance = Math.round((gross - basic - hra - conveyance) * 100) / 100;

    // Standard PF: 12% of basic
    const pf = Math.round(basic * pfRate * 100) / 100;
    const advance = Number(customAdvance) || 0;
    const totalDeductions = pf + advance;
    const net = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

    return {
        gross_salary: gross,
        basic_salary: basic,
        hra,
        conveyance_allowance: conveyance,
        other_allowance: otherAllowance,
        pf_deduction: pf,
        advance_deduction: advance,
        net_salary: net,
    };
}

// =========================================================================
// GET: List Staff Salary Structures (Admin only)
// =========================================================================
export async function GET(request) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Insufficient permissions." },
                { status: 403 }
            );
        }

        connection = await pool.getConnection();
        const { searchParams } = new URL(request.url);

        let academy_id = searchParams.get("academy_id");
        let branch_id = searchParams.get("branch_id");
        const staff_id = searchParams.get("staff_id");
        const status = searchParams.get("status");
        const search = (searchParams.get("search") || "").trim();

        // Multi-Tenant Isolation
        if (authUser.isSuperAdmin) {
            // Unrestricted
        } else if (authUser.isAcademyAdmin) {
            if (academy_id && String(academy_id) !== String(authUser.academy_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Academy Admin cannot access another academy's records." },
                    { status: 403 }
                );
            }
            academy_id = authUser.academy_id;
        } else if (authUser.isBranchAdmin) {
            if (branch_id && String(branch_id) !== String(authUser.branch_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Branch Admin cannot access another branch's records." },
                    { status: 403 }
                );
            }
            branch_id = authUser.branch_id;
            academy_id = authUser.academy_id;
        }

        const where = ["sal.id IS NOT NULL"];
        const params = [];

        if (academy_id) {
            where.push("sal.academy_id = ?");
            params.push(academy_id);
        }
        if (branch_id) {
            where.push("sal.branch_id = ?");
            params.push(branch_id);
        }
        if (staff_id) {
            where.push("sal.staff_id = ?");
            params.push(staff_id);
        }
        if (status) {
            where.push("sal.status = ?");
            params.push(status);
        }
        if (search) {
            where.push("(s.first_name LIKE ? OR s.last_name LIKE ? OR s.appointment_no LIKE ? OR r.role_name LIKE ?)");
            const q = `%${search}%`;
            params.push(q, q, q, q);
        }

        const sql = `
            SELECT 
                sal.id,
                sal.academy_id,
                sal.branch_id,
                sal.staff_id,
                sal.basic_salary,
                sal.hra,
                sal.da,
                sal.conveyance_allowance,
                sal.medical_allowance,
                sal.other_allowance,
                sal.gross_salary,
                sal.pf_deduction,
                sal.advance_deduction,
                sal.esi_deduction,
                sal.professional_tax,
                sal.other_deduction,
                sal.net_salary,
                sal.effective_from,
                sal.effective_to,
                sal.status,
                sal.created_at,
                sal.updated_at,
                s.appointment_no,
                s.first_name,
                s.last_name,
                s.user_id,
                r.role_name,
                a.academy_name,
                b.branch_name,
                u.email,
                u.phone
            FROM cst_staff_salary sal
            JOIN cst_staff s ON s.id = sal.staff_id
            LEFT JOIN cst_roles r ON r.id = s.role_id
            LEFT JOIN cst_academy a ON a.id = sal.academy_id
            LEFT JOIN cst_branch b ON b.id = sal.branch_id
            LEFT JOIN cst_users u ON u.id = s.user_id
            WHERE ${where.join(" AND ")}
            ORDER BY sal.id DESC
        `;

        const [rows] = await connection.query(sql, params);
        return NextResponse.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("GET /api/staff-salary error:", err);
        return NextResponse.json(
            { success: false, message: "Internal server error: " + err.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// =========================================================================
// POST: Create or Update Staff Salary Structure (Admin only)
// =========================================================================
export async function POST(request) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Insufficient permissions." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            staff_id,
            monthly_salary,
            effective_from = new Date().toISOString().slice(0, 10),
            effective_to = null,
            status = "Active",
        } = body;

        if (!staff_id) {
            return NextResponse.json(
                { success: false, message: "Validation error: staff_id is required." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Verify Staff Exists and check tenant boundary
        const [staffRows] = await connection.query(
            `SELECT id, academy_id, branch_id, first_name, last_name FROM cst_staff WHERE id = ? AND is_deleted = 0`,
            [staff_id]
        );

        if (staffRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Staff member not found." },
                { status: 404 }
            );
        }

        const staff = staffRows[0];
        const academy_id = body.academy_id || staff.academy_id;
        const branch_id = body.branch_id || staff.branch_id;

        // Boundary checks
        if (authUser.isBranchAdmin && (String(branch_id) !== String(authUser.branch_id) || String(staff.branch_id) !== String(authUser.branch_id))) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Branch Admin cannot configure salaries for other branches." },
                { status: 403 }
            );
        }
        if (authUser.isAcademyAdmin && (String(academy_id) !== String(authUser.academy_id) || String(staff.academy_id) !== String(authUser.academy_id))) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Academy Admin cannot configure salaries for other academies." },
                { status: 403 }
            );
        }

        // Component Resolution: Auto-calculate from monthly_salary if provided, or accept manual breakdown
        let basic_salary = body.basic_salary !== undefined ? Number(body.basic_salary) : null;
        let hra = body.hra !== undefined ? Number(body.hra) : null;
        let da = body.da !== undefined ? Number(body.da) : 0;
        let conveyance_allowance = body.conveyance_allowance !== undefined ? Number(body.conveyance_allowance) : (body.conveyance !== undefined ? Number(body.conveyance) : null);
        let medical_allowance = body.medical_allowance !== undefined ? Number(body.medical_allowance) : 0;
        let other_allowance = body.other_allowance !== undefined ? Number(body.other_allowance) : null;
        let pf_deduction = body.pf_deduction !== undefined ? Number(body.pf_deduction) : null;
        let advance_deduction = body.advance_deduction !== undefined ? Number(body.advance_deduction) : 0;
        let esi_deduction = body.esi_deduction !== undefined ? Number(body.esi_deduction) : 0;
        let professional_tax = body.professional_tax !== undefined ? Number(body.professional_tax) : 0;
        let other_deduction = body.other_deduction !== undefined ? Number(body.other_deduction) : 0;

        const baseMonthly = monthly_salary !== undefined && monthly_salary !== null ? Number(monthly_salary) : null;

        // If monthly_salary is provided and basic/hra/etc are not passed, auto-fill standard breakdown
        if (baseMonthly !== null && baseMonthly > 0 && basic_salary === null) {
            const calculated = autoCalculateComponents(baseMonthly, 0.12, advance_deduction);
            basic_salary = calculated.basic_salary;
            hra = calculated.hra;
            conveyance_allowance = calculated.conveyance_allowance;
            other_allowance = calculated.other_allowance;
            if (pf_deduction === null) pf_deduction = calculated.pf_deduction;
        }

        // Defaults if still empty
        basic_salary = basic_salary || 0;
        hra = hra || 0;
        conveyance_allowance = conveyance_allowance || 0;
        other_allowance = other_allowance || 0;
        if (pf_deduction === null) {
            pf_deduction = Math.round(basic_salary * 0.12 * 100) / 100;
        }

        const gross_salary = Math.round((basic_salary + hra + da + conveyance_allowance + medical_allowance + other_allowance) * 100) / 100;
        const totalDeductions = pf_deduction + advance_deduction + esi_deduction + professional_tax + other_deduction;
        const net_salary = Math.max(0, Math.round((gross_salary - totalDeductions) * 100) / 100);

        await connection.beginTransaction();

        // Check if structure exists for staff
        const [existing] = await connection.query(
            `SELECT id FROM cst_staff_salary WHERE staff_id = ? LIMIT 1`,
            [staff_id]
        );

        let salaryId;
        if (existing.length > 0) {
            // Branch Admin cannot edit an existing salary structure
            if (authUser.isBranchAdmin) {
                await connection.rollback();
                return NextResponse.json({
                    success: false,
                    message: "Forbidden. Branch Admin does not have permission to edit salary structures. Only Academy Admin and Super Admin can edit."
                }, { status: 403 });
            }

            salaryId = existing[0].id;
            await connection.query(
                `UPDATE cst_staff_salary SET
                    academy_id = ?,
                    branch_id = ?,
                    basic_salary = ?,
                    hra = ?,
                    da = ?,
                    conveyance_allowance = ?,
                    medical_allowance = ?,
                    other_allowance = ?,
                    gross_salary = ?,
                    pf_deduction = ?,
                    advance_deduction = ?,
                    esi_deduction = ?,
                    professional_tax = ?,
                    other_deduction = ?,
                    net_salary = ?,
                    effective_from = ?,
                    effective_to = ?,
                    status = ?
                WHERE id = ?`,
                [
                    academy_id, branch_id,
                    basic_salary, hra, da, conveyance_allowance, medical_allowance, other_allowance,
                    gross_salary, pf_deduction, advance_deduction, esi_deduction, professional_tax, other_deduction,
                    net_salary, effective_from, effective_to, status,
                    salaryId
                ]
            );
        } else {
            const [insRes] = await connection.query(
                `INSERT INTO cst_staff_salary (
                    academy_id, branch_id, staff_id,
                    basic_salary, hra, da,
                    conveyance_allowance, medical_allowance, other_allowance,
                    gross_salary, pf_deduction, advance_deduction, esi_deduction,
                    professional_tax, other_deduction, net_salary,
                    effective_from, effective_to, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    academy_id, branch_id, staff_id,
                    basic_salary, hra, da,
                    conveyance_allowance, medical_allowance, other_allowance,
                    gross_salary, pf_deduction, advance_deduction, esi_deduction,
                    professional_tax, other_deduction, net_salary,
                    effective_from, effective_to, status
                ]
            );
            salaryId = insRes.insertId;
        }

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Staff salary structure saved successfully.",
                data: {
                    id: salaryId,
                    staff_id,
                    gross_salary,
                    basic_salary,
                    hra,
                    conveyance_allowance,
                    other_allowance,
                    pf_deduction,
                    advance_deduction,
                    net_salary,
                },
            },
            { status: existing.length > 0 ? 200 : 201 }
        );
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("POST /api/staff-salary error:", err);
        return NextResponse.json(
            { success: false, message: "Failed to save salary structure: " + err.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
