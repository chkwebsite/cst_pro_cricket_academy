import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

const validStatuses = [
    "Pending",
    "Approved",
    "Rejected",
    "Cancelled",
];

// GET: Fetch a single booking request
export async function GET(request, { params }) {
    try {
        const { id } = await params;

        const [rows] = await pool.execute(
            `SELECT
                r.*,
                g.ground_name,
                g.ground_code,
                g.address AS ground_address,
                g.contact_person AS ground_contact_person,
                g.phone AS ground_contact_phone,
                g.email AS ground_contact_email,
                g.ground_facility
             FROM cst_ground_booking_requests r
             LEFT JOIN cst_ground g ON g.id = r.ground_id
             WHERE r.id = ? AND r.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Booking request not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET booking request error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch booking request",
            },
            { status: 500 }
        );
    }
}


// PUT: Update booking request or admin status
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const [existingRows] = await pool.execute(
            `SELECT *
             FROM cst_ground_booking_requests
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Booking request not found",
                },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        const customerName =
            body.customer_name ?? existing.customer_name;

        const mobile =
            body.mobile ?? existing.mobile;

        const email =
            body.email !== undefined ? body.email : existing.email;

        const groundId =
            body.ground_id ?? existing.ground_id;

        const bookingDate =
            body.booking_date ?? existing.booking_date;

        const startTime =
            body.start_time ?? existing.start_time;

        const endTime =
            body.end_time ?? existing.end_time;

        const bookingPurpose =
            body.booking_purpose ?? existing.booking_purpose;

        const numberOfPlayers =
            body.number_of_players !== undefined
                ? body.number_of_players
                : existing.number_of_players;

        const specialRequirements =
            body.special_requirements !== undefined
                ? body.special_requirements
                : existing.special_requirements;

        const requestStatus =
            body.request_status ?? existing.request_status;

        const adminRemarks =
            body.admin_remarks !== undefined
                ? body.admin_remarks
                : existing.admin_remarks;

        if (
            !customerName ||
            !mobile ||
            !groundId ||
            !bookingDate ||
            !startTime ||
            !endTime ||
            !bookingPurpose
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Required fields cannot be empty",
                },
                { status: 400 }
            );
        }

        if (startTime >= endTime) {
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

        if (!validPurposes.includes(bookingPurpose)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid booking purpose",
                },
                { status: 400 }
            );
        }

        if (!validStatuses.includes(requestStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid booking request status",
                },
                { status: 400 }
            );
        }

        if (
            numberOfPlayers != null &&
            (!Number.isInteger(Number(numberOfPlayers)) ||
                Number(numberOfPlayers) < 1)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Number of players must be a positive integer",
                },
                { status: 400 }
            );
        }

        // Check availability when the requested slot is active
        if (["Pending", "Approved"].includes(requestStatus)) {
            const [conflicts] = await pool.execute(
                `SELECT id
                 FROM cst_ground_booking_requests
                 WHERE ground_id = ?
                   AND booking_date = ?
                   AND id != ?
                   AND request_status IN ('Pending', 'Approved')
                   AND is_deleted = 0
                   AND start_time < ?
                   AND end_time > ?
                 LIMIT 1`,
                [
                    groundId,
                    bookingDate,
                    id,
                    endTime,
                    startTime,
                ]
            );

            if (conflicts.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Selected ground and time slot are already requested or booked",
                    },
                    { status: 409 }
                );
            }
        }

        await pool.execute(
            `UPDATE cst_ground_booking_requests
             SET
                customer_name = ?,
                mobile = ?,
                email = ?,
                ground_id = ?,
                booking_date = ?,
                start_time = ?,
                end_time = ?,
                booking_purpose = ?,
                number_of_players = ?,
                special_requirements = ?,
                request_status = ?,
                admin_remarks = ?
             WHERE id = ? AND is_deleted = 0`,
            [
                customerName,
                mobile,
                email || null,
                groundId,
                bookingDate,
                startTime,
                endTime,
                bookingPurpose,
                numberOfPlayers ?? null,
                specialRequirements || null,
                requestStatus,
                adminRemarks || null,
                id,
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Booking request updated successfully",
        });
    } catch (error) {
        console.error("PUT booking request error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update booking request",
            },
            { status: 500 }
        );
    }
}


// DELETE: Soft delete a booking request
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        const [result] = await pool.execute(
            `UPDATE cst_ground_booking_requests
             SET is_deleted = 1
             WHERE id = ? AND is_deleted = 0`,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Booking request not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Booking request deleted successfully",
        });
    } catch (error) {
        console.error("DELETE booking request error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete booking request",
            },
            { status: 500 }
        );
    }
}
