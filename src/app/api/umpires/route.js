import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

const VALID_MATCH_TYPES = ["T20", "ODI", "Test", "Practice", "Friendly", "Tournament"];
const VALID_PAYMENT_TYPES = ["Per Match", "Per Day", "Per Hour"];

// =====================================================
// GET: List all umpires
// Example: /api/umpires?academy_id=1&branch_id=2&status=1&search=John
// =====================================================
export async function GET(request) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        const { searchParams } = new URL(request.url);

        // Allow public website visitors to list active umpires for ground booking
        const isPublicActiveRequest = searchParams.get("status") === "1";
        if (errorResponse && !isPublicActiveRequest) return errorResponse;

        const search = searchParams.get("search");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const status = searchParams.get("status");

        let sql = `
            SELECT
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
            WHERE u.is_deleted = 0
        `;

        const values = [];

        // Search filter
        if (search && search.trim()) {
            sql += ` AND (
                u.umpire_name LIKE ?
                OR u.email LIKE ?
                OR u.mobile LIKE ?
                OR u.qualification LIKE ?
            )`;
            const searchPattern = `%${search.trim()}%`;
            values.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Role-based Tenant Scoping
        if (authUser) {
            if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND (u.branch_id = ? OR u.branch_id IS NULL) AND u.academy_id = ?";
                values.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND u.academy_id = ?";
                values.push(authUser.academy_id);
                if (branch_id) {
                    sql += " AND (u.branch_id = ? OR u.branch_id IS NULL)";
                    values.push(branch_id);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND u.academy_id = ?";
                values.push(authUser.academy_id);
                const allowed = authUser.assignedBranchIds && authUser.assignedBranchIds.length > 0
                    ? authUser.assignedBranchIds
                    : (authUser.branch_id ? [authUser.branch_id] : []);
                if (branch_id) {
                    if (allowed.length === 0 || allowed.includes(Number(branch_id))) {
                        sql += " AND (u.branch_id = ? OR u.branch_id IS NULL)";
                        values.push(branch_id);
                    } else {
                        sql += " AND 1 = 0";
                    }
                } else if (allowed.length > 0) {
                    sql += ` AND (u.branch_id IN (${allowed.map(() => "?").join(",")}) OR u.branch_id IS NULL)`;
                    values.push(...allowed);
                }
            } else {
                // Super Admin
                if (academy_id) {
                    sql += " AND u.academy_id = ?";
                    values.push(academy_id);
                }
                if (branch_id) {
                    sql += " AND (u.branch_id = ? OR u.branch_id IS NULL)";
                    values.push(branch_id);
                }
            }
        } else {
            // Public website visitor (no auth token): filter active umpires
            sql += " AND u.status = 1";
            if (academy_id) {
                sql += " AND u.academy_id = ?";
                values.push(academy_id);
            }
            if (branch_id) {
                sql += " AND (u.branch_id = ? OR u.branch_id IS NULL)";
                values.push(branch_id);
            }
        }

        // Status filter
        if (status !== null && status !== "" && status !== undefined) {
            sql += " AND u.status = ?";
            values.push(Number(status));
        }

        sql += " ORDER BY u.id DESC";

        connection = await pool.getConnection();
        const [umpires] = await connection.query(sql, values);

        if (umpires.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
            });
        }

        // Fetch all fees for the retrieved umpires
        const umpireIds = umpires.map((u) => u.id);
        const [feeRows] = await connection.query(
            `SELECT
                id,
                academy_id,
                umpire_id,
                match_type,
                fee_amount,
                payment_type,
                status
             FROM cst_umpire_fees
             WHERE umpire_id IN (${umpireIds.map(() => "?").join(",")})
             ORDER BY umpire_id, id ASC`,
            umpireIds
        );

        // Group fees by umpire_id
        const feeMap = new Map();
        for (const fee of feeRows) {
            if (!feeMap.has(fee.umpire_id)) {
                feeMap.set(fee.umpire_id, []);
            }
            feeMap.get(fee.umpire_id).push(fee);
        }

        // Attach fees and helper match-fee fields
        const result = umpires.map((u) => {
            const fees = feeMap.get(u.id) || [];
            const feeByMatch = {};
            fees.forEach((f) => {
                feeByMatch[f.match_type.toLowerCase() + "_fee"] = Number(f.fee_amount);
                feeByMatch[f.match_type.toLowerCase() + "_payment_type"] = f.payment_type;
            });

            return {
                ...u,
                fees,
                t20_fee: feeByMatch.t20_fee ?? null,
                odi_fee: feeByMatch.odi_fee ?? null,
                test_fee: feeByMatch.test_fee ?? null,
                practice_fee: feeByMatch.practice_fee ?? null,
                friendly_fee: feeByMatch.friendly_fee ?? null,
                tournament_fee: feeByMatch.tournament_fee ?? null,
            };
        });

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("GET Umpires Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch umpires",
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// =====================================================
// POST: Add new umpire with match fees
// =====================================================
export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer || authUser.role === "PLAYER" || String(authUser.user_type || "").toLowerCase().includes("player")) {
        return NextResponse.json(
            { success: false, message: "Forbidden: Players cannot manage umpires." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const body = await request.json();

        let {
            academy_id,
            branch_id = null,
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

        // Tenant Scoping
        if (authUser.isBranchAdmin) {
            academy_id = authUser.academy_id;
            branch_id = authUser.branch_id;
        } else if (authUser.isAcademyAdmin) {
            academy_id = authUser.academy_id;
        } else if (!authUser.isSuperAdmin && authUser.academy_id) {
            academy_id = authUser.academy_id;
            if (branch_id && authUser.assignedBranchIds && !authUser.assignedBranchIds.includes(Number(branch_id))) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized for selected branch" },
                    { status: 403 }
                );
            }
        }

        // Required Validations
        const errors = {};
        if (!academy_id) {
            errors.academy_id = "Academy is required.";
        }

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

        connection = await pool.getConnection();

        // Validate academy exists
        const [acadRows] = await connection.query(
            "SELECT id FROM cst_academy WHERE id = ? AND status = 1 LIMIT 1",
            [academy_id]
        );
        if (acadRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Selected academy does not exist or is inactive" },
                { status: 400 }
            );
        }

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

        // Validate fee records if provided
        const validatedFees = [];
        if (Array.isArray(fees) && fees.length > 0) {
            const seenMatchTypes = new Set();
            for (const item of fees) {
                if (!item || !item.match_type) continue;
                const matchType = item.match_type;
                if (!VALID_MATCH_TYPES.includes(matchType)) {
                    return NextResponse.json(
                        { success: false, message: `Invalid match type: ${matchType}. Allowed: ${VALID_MATCH_TYPES.join(", ")}` },
                        { status: 400 }
                    );
                }

                if (seenMatchTypes.has(matchType)) {
                    continue; // Skip duplicate match type in same payload
                }
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
                    match_type: matchType,
                    fee_amount: feeAmount,
                    payment_type: paymentType,
                    status: item.status === 0 ? 0 : 1
                });
            }
        }

        // START TRANSACTION
        await connection.beginTransaction();

        // ==========================================
        // CREATE / LINK CST_USERS ACCOUNT FOR UMPIRE
        // ==========================================
        let targetUserId = body.user_id ? Number(body.user_id) : null;

        if (!targetUserId) {
            // Check if user already exists with this email or mobile
            if (email && email.trim()) {
                const [userByEmail] = await connection.query(
                    "SELECT id FROM cst_users WHERE email = ? AND is_deleted = 0 LIMIT 1",
                    [email.trim()]
                );
                if (userByEmail.length > 0) targetUserId = userByEmail[0].id;
            }

            if (!targetUserId && cleanMobile) {
                const [userByPhone] = await connection.query(
                    "SELECT id FROM cst_users WHERE phone = ? AND is_deleted = 0 LIMIT 1",
                    [cleanMobile]
                );
                if (userByPhone.length > 0) targetUserId = userByPhone[0].id;
            }

            if (!targetUserId) {
                const nameParts = umpire_name.trim().split(" ");
                const firstName = nameParts[0] || "Umpire";
                const lastName = nameParts.slice(1).join(" ") || "";
                const userEmail = email && email.trim() ? email.trim() : `umpire_${Date.now()}@cstacademy.in`;
                const appointmentNo = `UMP-${Date.now().toString().slice(-4)}`;
                const rawPassword = body.password && String(body.password).trim() ? String(body.password).trim() : "123456";
                const passwordHash = await bcrypt.hash(rawPassword, 10);

                const [insUser] = await connection.query(
                    `INSERT INTO cst_users (
                        appointment_no, academy_id, branch_id, first_name, last_name,
                        email, phone, password, user_type, status, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Umpire', 1, 0)`,
                    [
                        appointmentNo,
                        academy_id,
                        branch_id || null,
                        firstName,
                        lastName,
                        userEmail,
                        cleanMobile,
                        passwordHash
                    ]
                );
                targetUserId = insUser.insertId;

                // Assign Umpire role
                const [umpRole] = await connection.query(
                    "SELECT id FROM cst_roles WHERE LOWER(role_name) = 'umpire' LIMIT 1"
                );
                const roleId = umpRole.length > 0 ? umpRole[0].id : 31;
                await connection.query(
                    "INSERT IGNORE INTO cst_user_roles (user_id, role_id) VALUES (?, ?)",
                    [targetUserId, roleId]
                );
            }
        }

        const [insertResult] = await connection.query(
            `INSERT INTO cst_umpires (
                academy_id,
                branch_id,
                user_id,
                umpire_name,
                email,
                mobile,
                alternate_mobile,
                experience_years,
                qualification,
                address,
                status,
                is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                academy_id,
                branch_id || null,
                targetUserId,
                umpire_name.trim(),
                email ? email.trim() : null,
                cleanMobile,
                alternate_mobile ? alternate_mobile.trim() : null,
                parseInt(experience_years, 10) || 0,
                qualification ? qualification.trim() : null,
                address ? address.trim() : null,
                status === 0 ? 0 : 1
            ]
        );

        const newUmpireId = insertResult.insertId;

        // Insert fees if any
        if (validatedFees.length > 0) {
            const feeValues = validatedFees.map((f) => [
                academy_id,
                newUmpireId,
                f.match_type,
                f.fee_amount,
                f.payment_type,
                f.status
            ]);

            for (const f of feeValues) {
                await connection.query(
                    `INSERT INTO cst_umpire_fees (
                        academy_id, umpire_id, match_type, fee_amount, payment_type, status
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                    f
                );
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Umpire added successfully",
            data: {
                id: newUmpireId,
                academy_id,
                branch_id: branch_id || null,
                umpire_name: umpire_name.trim(),
                mobile: cleanMobile,
                status: status === 0 ? 0 : 1,
                fees: validatedFees
            }
        }, { status: 201 });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("POST Umpire Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to create umpire",
                error: process.env.NODE_ENV === "development" ? error.message : undefined
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
