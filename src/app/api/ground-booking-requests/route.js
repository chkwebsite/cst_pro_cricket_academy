import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// GET: Fetch all booking requests
export async function GET(request) {
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
                g.ground_name,
                g.ground_code,
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
            LEFT JOIN cst_ground g ON g.id = r.ground_id
            WHERE r.is_deleted = 0
        `;

        const values = [];

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


// POST: Create a new booking request
export async function POST(request) {
    try {
        const body = await request.json();

        const {
            customer_name,
            mobile,
            email,
            ground_id,
            booking_date,
            start_time,
            end_time,
            booking_purpose,
            number_of_players,
            special_requirements,
        } = body;

        // Required field validation
        if (
            !customer_name ||
            !mobile ||
            !ground_id ||
            !booking_date ||
            !start_time ||
            !end_time ||
            !booking_purpose
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please provide all required fields",
                },
                { status: 400 }
            );
        }

        // Validate booking time
        if (start_time >= end_time) {
            return NextResponse.json(
                {
                    success: false,
                    message: "End time must be after start time",
                },
                { status: 400 }
            );
        }

        const validPurposes = [
            "Practice Session",
            "Friendly Match",
            "Tournament",
            "Corporate Event",
            "Other",
        ];

        if (!validPurposes.includes(booking_purpose)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid booking purpose",
                },
                { status: 400 }
            );
        }

        if (
            number_of_players != null &&
            (!Number.isInteger(Number(number_of_players)) ||
                Number(number_of_players) < 1)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Number of players must be a positive integer",
                },
                { status: 400 }
            );
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
                booking_date,
                start_time,
                end_time,
                booking_purpose,
                number_of_players,
                special_requirements,
                request_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [
                requestNumber,
                customer_name.trim(),
                mobile.trim(),
                email || null,
                ground_id,
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
