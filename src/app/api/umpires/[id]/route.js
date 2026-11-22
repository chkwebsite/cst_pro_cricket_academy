import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

const VALID_MATCH_TYPES = ["T20", "ODI", "Test", "Practice", "Friendly", "Tournament"];
const VALID_PAYMENT_TYPES = ["Per Match", "Per Day", "Per Hour"];

function isUmpireAuthorized(umpire, authUser) {
    if (!authUser) return false;
    if (authUser.isSuperAdmin) return true;
    if (Number(umpire.academy_id) !== Number(authUser.academy_id)) return false;
    if (authUser.isAcademyAdmin) return true;
    if (authUser.isBranchAdmin) {
        return !umpire.branch_id || Number(umpire.branch_id) === Number(authUser.branch_id);
    }
    const allowed = (authUser.assignedBranchIds || (authUser.branch_id ? [authUser.branch_id] : [])).map(Number);
    if (allowed.length === 0) return true;
    return !umpire.branch_id || allowed.includes(Number(umpire.branch_id));
}

// =====================================================
// GET: Single Umpire by ID
// =====================================================
export async function GET(request, { params }) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        if (errorResponse) return errorResponse;

        const { id } = await params;
        const umpireId = Number(id);

        if (!umpireId || isNaN(umpireId)) {
            return NextResponse.json(
                { success: false, message: "Invalid umpire ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `SELECT
                u.id,
                u.user_id,
                u.academy_id,
                u.branch_id,
                u.umpire_name,
                u.email,
                u.mobile,
                u.alternate_mobile,
                u.experience_years,
                u.qualification,
                u.address,
                u.status,
                u.created_at,
                u.updated_at,
                a.academy_name,
                b.branch_name,
                usr.appointment_no
            FROM cst_umpires u
            LEFT JOIN cst_academy a ON a.id = u.academy_id
            LEFT JOIN cst_branch b ON b.id = u.branch_id
            LEFT JOIN cst_users usr ON usr.id = u.user_id
            WHERE u.id = ? AND u.is_deleted = 0
            LIMIT 1`,
            [umpireId]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Umpire not found" },
                { status: 404 }
            );
        }

        const umpire = rows[0];

        if (!isUmpireAuthorized(umpire, authUser)) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to view this umpire" },
                { status: 403 }
            );
        }

        // Fetch fees
        const [fees] = await connection.query(
            `SELECT
                id,
                academy_id,
                umpire_id,
                match_type,
                fee_amount,
                payment_type,
                status,
                created_at,
                updated_at
            FROM cst_umpire_fees
            WHERE umpire_id = ?
            ORDER BY id ASC`,
            [umpireId]
        );

        return NextResponse.json({
            success: true,
            data: {
                ...umpire,
                fees,
            },
        });
    } catch (error) {
        console.error("GET Single Umpire Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch umpire details",
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// =====================================================
// PUT: Update Umpire and Fees
// =====================================================
export async function PUT(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden: Players cannot update umpires." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const { id } = await params;
        const umpireId = Number(id);

        if (!umpireId || isNaN(umpireId)) {
            return NextResponse.json(
                { success: false, message: "Invalid umpire ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Check umpire existence
        const [existing] = await connection.query(
            "SELECT * FROM cst_umpires WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [umpireId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Umpire not found" },
                { status: 404 }
            );
        }

        const currentUmpire = existing[0];

        if (!isUmpireAuthorized(currentUmpire, authUser)) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to edit this umpire" },
                { status: 403 }
            );
        }

        const body = await request.json();

        let {
            academy_id = currentUmpire.academy_id,
            branch_id = currentUmpire.branch_id,
            umpire_name,
            email = null,
            mobile,
            alternate_mobile = null,
            experience_years = 0,
            qualification = null,
            address = null,
            status = 1,
            fees = []
        } = body;

        // Tenant restrictions
        if (!authUser.isSuperAdmin) {
            academy_id = authUser.academy_id;
            if (authUser.isBranchAdmin) {
                branch_id = authUser.branch_id;
            }
        }

        const errors = {};
        if (!umpire_name || !umpire_name.trim()) {
            errors.umpire_name = "Umpire name is required.";
        }

        if (!mobile || !mobile.trim()) {
            errors.mobile = "Mobile number is required.";
        } else {
            const cleanMobile = mobile.trim();
            if (cleanMobile.length < 7 || cleanMobile.length > 20) {
                errors.mobile = "Please provide a valid mobile number (7 to 20 digits).";
            }
        }

        if (email && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
            errors.email = "Please enter a valid email address.";
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json(
                { success: false, message: "Validation failed", errors },
                { status: 400 }
            );
        }

        const cleanMobile = mobile.trim();

        // Validate branch if provided
        if (branch_id) {
            const [branchRows] = await connection.query(
                "SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? AND status = 1 LIMIT 1",
                [branch_id, academy_id]
            );
            if (branchRows.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Selected branch does not belong to the academy or is inactive" },
                    { status: 400 }
                );
            }
        }

        // Validate fee array
        const validatedFees = [];
        if (Array.isArray(fees) && fees.length > 0) {
            const seenMatchTypes = new Set();
            for (const item of fees) {
                if (!item || !item.match_type) continue;
                const matchType = item.match_type;
                if (!VALID_MATCH_TYPES.includes(matchType)) {
                    return NextResponse.json(
                        { success: false, message: `Invalid match type: ${matchType}` },
                        { status: 400 }
                    );
                }

                if (seenMatchTypes.has(matchType)) continue;
                seenMatchTypes.add(matchType);

                const feeAmount = Number(item.fee_amount || 0);
                if (isNaN(feeAmount) || feeAmount < 0) {
                    return NextResponse.json(
                        { success: false, message: `Fee amount for ${matchType} cannot be negative` },
                        { status: 400 }
                    );
                }

                const paymentType = item.payment_type && VALID_PAYMENT_TYPES.includes(item.payment_type)
                    ? item.payment_type
                    : "Per Match";

                validatedFees.push({
                    id: item.id ? Number(item.id) : null,
                    match_type: matchType,
                    fee_amount: feeAmount,
                    payment_type: paymentType,
                    status: item.status === 0 ? 0 : 1
                });
            }
        }

        // START TRANSACTION
        await connection.beginTransaction();

        // Update umpire record
        await connection.query(
            `UPDATE cst_umpires
             SET
                academy_id = ?,
                branch_id = ?,
                umpire_name = ?,
                email = ?,
                mobile = ?,
                alternate_mobile = ?,
                experience_years = ?,
                qualification = ?,
                address = ?,
                status = ?
             WHERE id = ?`,
            [
                academy_id,
                branch_id || null,
                umpire_name.trim(),
                email ? email.trim() : null,
                cleanMobile,
                alternate_mobile ? alternate_mobile.trim() : null,
                parseInt(experience_years, 10) || 0,
                qualification ? qualification.trim() : null,
                address ? address.trim() : null,
                status === 0 ? 0 : 1,
                umpireId
            ]
        );

        // Sync with cst_users account
        const nameParts = umpire_name.trim().split(" ");
        const firstName = nameParts[0] || "Umpire";
        const lastName = nameParts.slice(1).join(" ") || "";
        const userStatus = status === 0 ? 0 : 1;

        if (currentUmpire.user_id) {
            if (body.password && String(body.password).trim()) {
                const passHash = await bcrypt.hash(String(body.password).trim(), 10);
                await connection.query(
                    `UPDATE cst_users
                     SET first_name = ?, last_name = ?, email = ?, phone = ?, status = ?, password = ?
                     WHERE id = ?`,
                    [firstName, lastName, email ? email.trim() : null, cleanMobile, userStatus, passHash, currentUmpire.user_id]
                );
            } else {
                await connection.query(
                    `UPDATE cst_users
                     SET first_name = ?, last_name = ?, email = ?, phone = ?, status = ?
                     WHERE id = ?`,
                    [firstName, lastName, email ? email.trim() : null, cleanMobile, userStatus, currentUmpire.user_id]
                );
            }
        } else {
            // Create user account if not yet linked
            const userEmail = email && email.trim() ? email.trim() : `umpire_${umpireId}_${Date.now()}@cstacademy.in`;
            const appointmentNo = `UMP-${String(umpireId).padStart(4, "0")}`;
            const rawPassword = body.password && String(body.password).trim() ? String(body.password).trim() : "123456";
            const passHash = await bcrypt.hash(rawPassword, 10);

            const [insUser] = await connection.query(
                `INSERT INTO cst_users (
                    appointment_no, academy_id, branch_id, first_name, last_name,
                    email, phone, password, user_type, status, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Umpire', 1, 0)`,
                [appointmentNo, academy_id, branch_id || null, firstName, lastName, userEmail, cleanMobile, passHash]
            );
            const newUserId = insUser.insertId;

            const [umpRole] = await connection.query(
                "SELECT id FROM cst_roles WHERE LOWER(role_name) = 'umpire' LIMIT 1"
            );
            const roleId = umpRole.length > 0 ? umpRole[0].id : 31;
            await connection.query(
                "INSERT IGNORE INTO cst_user_roles (user_id, role_id) VALUES (?, ?)",
                [newUserId, roleId]
            );

            await connection.query(
                "UPDATE cst_umpires SET user_id = ? WHERE id = ?",
                [newUserId, umpireId]
            );
        }

        // Upsert fees
        if (validatedFees.length > 0) {
            for (const fee of validatedFees) {
                await connection.query(
                    `INSERT INTO cst_umpire_fees (
                        academy_id, umpire_id, match_type, fee_amount, payment_type, status
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        fee_amount = VALUES(fee_amount),
                        payment_type = VALUES(payment_type),
                        status = VALUES(status),
                        academy_id = VALUES(academy_id)`,
                    [
                        academy_id,
                        umpireId,
                        fee.match_type,
                        fee.fee_amount,
                        fee.payment_type,
                        fee.status
                    ]
                );
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Umpire updated successfully",
            data: {
                id: umpireId,
                academy_id,
                branch_id: branch_id || null,
                umpire_name: umpire_name.trim(),
                mobile: cleanMobile,
                status: status === 0 ? 0 : 1,
                fees: validatedFees
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("PUT Umpire Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to update umpire",
                error: process.env.NODE_ENV === "development" ? error.message : undefined
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// =====================================================
// DELETE: Soft Delete Umpire with Safety Checks
// =====================================================
export async function DELETE(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden: Players cannot delete umpires." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const { id } = await params;
        const umpireId = Number(id);

        if (!umpireId || isNaN(umpireId)) {
            return NextResponse.json(
                { success: false, message: "Invalid umpire ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [existing] = await connection.query(
            "SELECT * FROM cst_umpires WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [umpireId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Umpire not found or already deleted" },
                { status: 404 }
            );
        }

        const umpire = existing[0];

        if (!isUmpireAuthorized(umpire, authUser)) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to delete this umpire" },
                { status: 403 }
            );
        }

        // Check active ground bookings
        const [activeBookings] = await connection.query(
            `SELECT COUNT(*) AS total
             FROM cst_ground_bookings
             WHERE umpire_id = ? AND booking_status NOT IN ('Cancelled')`,
            [umpireId]
        );

        if (activeBookings[0].total > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Cannot delete umpire "${umpire.umpire_name}": Assigned to ${activeBookings[0].total} active ground booking(s). Please reassign or cancel those bookings first.`
                },
                { status: 400 }
            );
        }

        // Check match umpires
        const [matchUmpires] = await connection.query(
            `SELECT COUNT(*) AS total
             FROM cst_match_umpires
             WHERE umpire_id = ?`,
            [umpireId]
        );

        if (matchUmpires[0].total > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Cannot delete umpire "${umpire.umpire_name}": Assigned to ${matchUmpires[0].total} match assignment(s).`
                },
                { status: 400 }
            );
        }

        // Perform Soft Delete
        await connection.query(
            "UPDATE cst_umpires SET is_deleted = 1, status = 0 WHERE id = ?",
            [umpireId]
        );

        // Also deactivate associated fee configs
        await connection.query(
            "UPDATE cst_umpire_fees SET status = 0 WHERE umpire_id = ?",
            [umpireId]
        );

        // Deactivate linked user account if exists
        if (umpire.user_id) {
            await connection.query(
                "UPDATE cst_users SET status = 0 WHERE id = ?",
                [umpire.user_id]
            );
        }

        return NextResponse.json({
            success: true,
            message: `Umpire "${umpire.umpire_name}" deleted successfully`,
        });

    } catch (error) {
        console.error("DELETE Umpire Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete umpire",
                error: process.env.NODE_ENV === "development" ? error.message : undefined
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
