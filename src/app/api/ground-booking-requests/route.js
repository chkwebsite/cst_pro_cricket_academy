import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

// GET: Fetch all booking requests (Tenant Scoped)
export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    try {
        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status");
        const groundId = searchParams.get("ground_id");
        const bookingDate = searchParams.get("booking_date");
        const search = searchParams.get("search");

        let sql = `
            SELECT
                r.id,
                r.request_number,
                r.customer_name,
                r.mobile,
                r.email,
                r.ground_id,
                r.umpire_id,
                r.umpire_fee_id,
                u.umpire_name,
                u.mobile AS umpire_phone,
                uf.fee_amount AS umpire_fee_amount,
                uf.match_type AS umpire_match_type,
                g.ground_name,
                g.ground_code,
                g.academy_id,
                g.branch_id,
                r.booking_date,
                r.start_time,
                r.end_time,
                r.booking_purpose,
                r.number_of_players,
                r.special_requirements,
                r.request_status,
                r.admin_remarks,
                r.created_at,
                r.updated_at
            FROM cst_ground_booking_requests r
            INNER JOIN cst_ground g ON g.id = r.ground_id
            LEFT JOIN cst_umpires u ON u.id = r.umpire_id
            LEFT JOIN cst_umpire_fees uf ON uf.id = r.umpire_fee_id
            WHERE r.is_deleted = 0 AND g.is_deleted = 0
        `;

        const values = [];

        // Role-based Tenant Scoping
        if (authUser.isPlayer) {
            sql += ` AND (r.mobile = ? OR r.email = ?)`;
            values.push(authUser.phone || "---", authUser.email || "---");
        } else if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += ` AND g.academy_id = ? AND g.branch_id = ?`;
            values.push(authUser.academy_id, authUser.branch_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += ` AND g.academy_id = ?`;
            values.push(authUser.academy_id);
            const branchIdParam = searchParams.get("branch_id");
            if (branchIdParam) {
                sql += ` AND g.branch_id = ?`;
                values.push(branchIdParam);
            }
        } else if (!authUser.isSuperAdmin && authUser.academy_id) {
            sql += ` AND g.academy_id = ?`;
            values.push(authUser.academy_id);
            const allowed = authUser.assignedBranchIds || [authUser.branch_id];
            sql += ` AND g.branch_id IN (${allowed.map(() => "?").join(",")})`;
            values.push(...allowed);
        } else {
            // Super Admin
            const academyIdParam = searchParams.get("academy_id");
            const branchIdParam = searchParams.get("branch_id");
            if (academyIdParam) {
                sql += ` AND g.academy_id = ?`;
                values.push(academyIdParam);
            }
            if (branchIdParam) {
                sql += ` AND g.branch_id = ?`;
                values.push(branchIdParam);
            }
        }

        if (status) {
            sql += " AND r.request_status = ?";
            values.push(status);
        }

        if (groundId) {
            sql += " AND r.ground_id = ?";
            values.push(groundId);
        }

        if (bookingDate) {
            sql += " AND r.booking_date = ?";
            values.push(bookingDate);
        }

        if (search) {
            sql += ` AND (
                r.customer_name LIKE ?
                OR r.mobile LIKE ?
                OR r.email LIKE ?
                OR r.request_number LIKE ?
            )`;

            const searchValue = `%${search}%`;
            values.push(searchValue, searchValue, searchValue, searchValue);
        }

        sql += " ORDER BY r.created_at DESC";

        const [rows] = await pool.execute(sql, values);

        return NextResponse.json({
            success: true,
            message: "Ground booking requests fetched successfully",
            data: rows,
        });
    } catch (error) {
        console.error("GET ground booking requests error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground booking requests",
            },
            { status: 500 }
        );
    }
}


// POST: Create a new booking request (Public website or logged-in user)
export async function POST(request) {
    try {
        const body = await request.json();

        const {
            customer_name,
            mobile,
            email,
            ground_id,
            umpire_id,
            umpire_fee_id,
            booking_date,
            start_time,
            end_time,
            booking_purpose,
            number_of_players,
            special_requirements,
        } = body;

        // Required field validation
        const errors = {};
        if (!customer_name || !String(customer_name).trim()) errors.customer_name = "Customer name is required.";
        if (!mobile || !String(mobile).trim()) errors.mobile = "Mobile number is required.";
        else if (String(mobile).trim().length < 10) errors.mobile = "Please enter a valid 10-digit mobile number.";

        if (!ground_id) errors.ground_id = "Please select a ground.";
        if (!booking_date) errors.booking_date = "Booking date is required.";
        if (!start_time) errors.start_time = "Start time is required.";
        if (!end_time) errors.end_time = "End time is required.";
        else if (start_time && end_time && start_time >= end_time) {
            errors.end_time = "End time must be after start time.";
        }

        const validPurposes = [
            "Practice Session",
            "Friendly Match",
            "Tournament",
            "Corporate Event",
            "Other",
        ];
        if (!booking_purpose || !validPurposes.includes(booking_purpose)) {
            errors.booking_purpose = "Please select a valid booking purpose.";
        }

        if (
            number_of_players != null &&
            number_of_players !== "" &&
            (!Number.isInteger(Number(number_of_players)) || Number(number_of_players) < 1)
        ) {
            errors.number_of_players = "Number of players must be a positive integer.";
        }

        if (email && String(email).trim() && !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
            errors.email = "Please enter a valid email address.";
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: Object.values(errors)[0],
                    errors,
                },
                { status: 400 }
            );
        }

        // Validate ground exists and is active
        const [groundRows] = await pool.execute(
            `SELECT id, academy_id, branch_id, status FROM cst_ground WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [ground_id]
        );

        if (groundRows.length === 0 || groundRows[0].status !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid or inactive ground selected",
                },
                { status: 400 }
            );
        }

        // Check if requester is logged in to validate tenant authorization
        const authHeader = request.headers.get("authorization");
        if (authHeader) {
            const { user: authUser } = await getAuthenticatedUser(request);
            if (authUser && !authUser.isSuperAdmin && !authUser.isPlayer) {
                if (Number(groundRows[0].academy_id) !== Number(authUser.academy_id)) {
                    return NextResponse.json(
                        { success: false, message: "Unauthorized ground for user's academy" },
                        { status: 403 }
                    );
                }
                if (authUser.isBranchAdmin && Number(groundRows[0].branch_id) !== Number(authUser.branch_id)) {
                    return NextResponse.json(
                        { success: false, message: "Unauthorized ground for user's branch" },
                        { status: 403 }
                    );
                }
            }
        }

        // Check overlapping booking requests
        const [conflicts] = await pool.execute(
            `SELECT id
             FROM cst_ground_booking_requests
             WHERE ground_id = ?
               AND booking_date = ?
               AND request_status IN ('Pending', 'Approved')
               AND is_deleted = 0
               AND start_time < ?
               AND end_time > ?
             LIMIT 1`,
            [
                ground_id,
                booking_date,
                end_time,
                start_time,
            ]
        );

        if (conflicts.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This ground already has a booking request for the selected time",
                },
                { status: 409 }
            );
        }

        // Generate unique request number
        const requestNumber =
            `GBR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const [result] = await pool.execute(
            `INSERT INTO cst_ground_booking_requests (
                request_number,
                customer_name,
                mobile,
                email,
                ground_id,
                umpire_id,
                umpire_fee_id,
                booking_date,
                start_time,
                end_time,
                booking_purpose,
                number_of_players,
                special_requirements,
                request_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [
                requestNumber,
                customer_name.trim(),
                mobile.trim(),
                email || null,
                ground_id,
                umpire_id ? Number(umpire_id) : null,
                umpire_fee_id ? Number(umpire_fee_id) : null,
                booking_date,
                start_time,
                end_time,
                booking_purpose,
                number_of_players ?? null,
                special_requirements || null,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Ground booking request submitted successfully",
                data: {
                    id: result.insertId,
                    request_number: requestNumber,
                    request_status: "Pending",
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST ground booking request error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to submit ground booking request",
            },
            { status: 500 }
        );
    }
}
