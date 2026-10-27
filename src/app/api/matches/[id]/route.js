import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


const validMatchTypes = [
    "Practice",
    "Friendly",
    "League",
    "Tournament",
    "Knockout",
];

const validStatuses = [
    "Scheduled",
    "Live",
    "Completed",
    "Cancelled",
    "Postponed",
];

const validTossDecisions = ["Bat", "Bowl"];

const isPositiveId = (value) =>
    Number.isInteger(Number(value)) && Number(value) > 0;

const isValidDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        return false;
    }


    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );


};

const isValidTime = (value) =>
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

// GET: Single match
export async function GET(request, { params }) {
    let connection;


    try {
        const { id } = await params;
        const matchId = Number(id);

        if (!Number.isInteger(matchId) || matchId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid match ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `
    SELECT
    m.*,
        a.academy_name,
        b.branch_name,
        t.tournament_name,
        ta.team_name AS team_a_name,
            ta.team_code AS team_a_code,
                tb.team_name AS team_b_name,
                    tb.team_code AS team_b_code,
                        tw.team_name AS toss_winner_team_name,
                            g.ground_name,
                            gb.booking_no
        FROM cst_matches m
        LEFT JOIN cst_academy a
            ON a.id = m.academy_id
        LEFT JOIN cst_branch b
            ON b.id = m.branch_id
        LEFT JOIN cst_tournaments t
            ON t.id = m.tournament_id
        INNER JOIN cst_teams ta
            ON ta.id = m.team_a_id
        INNER JOIN cst_teams tb
            ON tb.id = m.team_b_id
        LEFT JOIN cst_teams tw
            ON tw.id = m.toss_winner_team_id
        LEFT JOIN cst_ground g
            ON g.id = m.ground_id
        LEFT JOIN cst_ground_bookings gb
            ON gb.id = m.booking_id
        WHERE m.id = ?
        LIMIT 1
            `,
            [matchId]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {
        console.error("GET Match Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch match",
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// PUT: Update match
export async function PUT(request, { params }) {
    let connection;
    let transactionStarted = false;


    try {
        const { id } = await params;
        const matchId = Number(id);

        if (!Number.isInteger(matchId) || matchId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid match ID" },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [existingRows] = await connection.execute(
            "SELECT * FROM cst_matches WHERE id = ? FOR UPDATE",
            [matchId]
        );

        if (existingRows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Match not found" },
                { status: 404 }
            );
        }

        const old = existingRows[0];

        const academy_id = body.academy_id !== undefined
            ? body.academy_id
            : old.academy_id;

        const branch_id = body.branch_id !== undefined
            ? body.branch_id
            : old.branch_id;

        const tournament_id = body.tournament_id !== undefined
            ? body.tournament_id
            : old.tournament_id;

        const team_a_id = body.team_a_id !== undefined
            ? body.team_a_id
            : old.team_a_id;

        const team_b_id = body.team_b_id !== undefined
            ? body.team_b_id
            : old.team_b_id;

        const match_no = body.match_no !== undefined
            ? body.match_no
            : old.match_no;

        const match_type = body.match_type ?? old.match_type;
        const match_date = body.match_date ?? old.match_date;
        const match_time = body.match_time !== undefined
            ? body.match_time
            : old.match_time;

        const ground_id = body.ground_id !== undefined
            ? body.ground_id
            : old.ground_id;

        const booking_id = body.booking_id !== undefined
            ? body.booking_id
            : old.booking_id;

        const toss_winner_team_id = body.toss_winner_team_id !== undefined
            ? body.toss_winner_team_id
            : old.toss_winner_team_id;

        const toss_decision = body.toss_decision !== undefined
            ? body.toss_decision
            : old.toss_decision;

        const status = body.status ?? old.status;

        const remarks = body.remarks !== undefined
            ? body.remarks
            : old.remarks;

        const created_by = body.created_by !== undefined
            ? body.created_by
            : old.created_by;

        // Validate required fields
        if (
            !isPositiveId(team_a_id) ||
            !isPositiveId(team_b_id) ||
            Number(team_a_id) === Number(team_b_id)
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Valid, different team_a_id and team_b_id are required",
                },
                { status: 400 }
            );
        }

        if (!validMatchTypes.includes(match_type)) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid match_type" },
                { status: 400 }
            );
        }

        if (!validStatuses.includes(status)) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid match status" },
                { status: 400 }
            );
        }

        if (!isValidDate(String(match_date).slice(0, 10))) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid match_date" },
                { status: 400 }
            );
        }

        if (
            match_time !== null &&
            match_time !== "" &&
            !isValidTime(String(match_time))
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid match_time" },
                { status: 400 }
            );
        }

        const optionalIds = [
            ["academy_id", academy_id],
            ["branch_id", branch_id],
            ["tournament_id", tournament_id],
            ["ground_id", ground_id],
            ["booking_id", booking_id],
            ["toss_winner_team_id", toss_winner_team_id],
            ["created_by", created_by],
        ];

        for (const [field, value] of optionalIds) {
            if (
                value !== null &&
                value !== undefined &&
                value !== "" &&
                !isPositiveId(value)
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: `Invalid ${field} ` },
                    { status: 400 }
                );
            }
        }

        if (
            toss_decision !== null &&
            toss_decision !== undefined &&
            toss_decision !== "" &&
            !validTossDecisions.includes(toss_decision)
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid toss_decision" },
                { status: 400 }
            );
        }

        if (
            toss_winner_team_id &&
            ![
                Number(team_a_id),
                Number(team_b_id),
            ].includes(Number(toss_winner_team_id))
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Toss winner must be Team A or Team B",
                },
                { status: 400 }
            );
        }

        if (toss_decision && !toss_winner_team_id) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Toss winner is required when toss decision is provided",
                },
                { status: 400 }
            );
        }

        // Validate teams
        const [teams] = await connection.execute(
            `
        SELECT id, is_deleted
        FROM cst_teams
        WHERE id IN(?, ?)
        FOR UPDATE
        `,
            [Number(team_a_id), Number(team_b_id)]
        );

        if (
            teams.length !== 2 ||
            teams.some((team) => Number(team.is_deleted) === 1)
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "One or both teams do not exist or are deleted",
                },
                { status: 400 }
            );
        }

        // Validate academy
        if (academy_id) {
            const [academies] = await connection.execute(
                "SELECT id FROM cst_academy WHERE id = ?",
                [Number(academy_id)]
            );

            if (academies.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Academy not found" },
                    { status: 404 }
                );
            }
        }

        // Validate branch
        if (branch_id) {
            const [branches] = await connection.execute(
                "SELECT id, academy_id FROM cst_branch WHERE id = ?",
                [Number(branch_id)]
            );

            if (branches.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Branch not found" },
                    { status: 404 }
                );
            }

            if (
                academy_id &&
                Number(branches[0].academy_id) !== Number(academy_id)
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Branch does not belong to selected academy",
                    },
                    { status: 400 }
                );
            }
        }

        // Validate tournament
        if (tournament_id) {
            const [tournaments] = await connection.execute(
                `
            SELECT id, academy_id, is_deleted
            FROM cst_tournaments
            WHERE id = ?
        `,
                [Number(tournament_id)]
            );

            if (
                tournaments.length === 0 ||
                Number(tournaments[0].is_deleted) === 1
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Tournament not found" },
                    { status: 404 }
                );
            }

            if (
                academy_id &&
                tournaments[0].academy_id &&
                Number(tournaments[0].academy_id) !== Number(academy_id)
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Tournament does not belong to selected academy",
                    },
                    { status: 400 }
                );
            }
        }

        // Validate ground
        if (ground_id) {
            const [grounds] = await connection.execute(
                "SELECT id, is_deleted FROM cst_ground WHERE id = ?",
                [Number(ground_id)]
            );

            if (
                grounds.length === 0 ||
                Number(grounds[0].is_deleted) === 1
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Ground not found" },
                    { status: 404 }
                );
            }
        }

        // Validate booking
        if (booking_id) {
            const [bookings] = await connection.execute(
                `
                SELECT
                    id,
                    ground_id,
                    DATE_FORMAT(booking_date, '%Y-%m-%d') AS booking_date,
                    booking_status
                FROM cst_ground_bookings
                WHERE id = ?
                FOR UPDATE
                `,
                [Number(booking_id)]
            );

            if (bookings.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Ground booking not found" },
                    { status: 404 }
                );
            }

            if (
                ground_id &&
                Number(bookings[0].ground_id) !== Number(ground_id)
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Booking does not belong to selected ground",
                    },
                    { status: 400 }
                );
            }

            if (bookings[0].booking_date !== String(match_date).slice(0, 10)) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Booking does not belong to the selected match date",
                    },
                    { status: 400 }
                );
            }

            if (!["Booked", "Confirmed"].includes(bookings[0].booking_status)) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Ground booking is not active" },
                    { status: 409 }
                );
            }

            const [linkedMatches] = await connection.execute(
                "SELECT id FROM cst_matches WHERE booking_id = ? AND id <> ? LIMIT 1 FOR UPDATE",
                [Number(booking_id), matchId]
            );

            if (linkedMatches.length > 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "This booking is already linked to a match" },
                    { status: 409 }
                );
            }
        }

        if (ground_id) {
            const [activeBookings] = await connection.execute(
                `
                SELECT id
                FROM cst_ground_bookings
                WHERE ground_id = ?
                    AND booking_date = ?
                    AND booking_status IN ('Booked', 'Confirmed')
                FOR UPDATE
                `,
                [Number(ground_id), String(match_date).slice(0, 10)]
            );

            if (activeBookings.some((booking) => Number(booking.id) !== Number(booking_id))) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Not available ground for selected date" },
                    { status: 409 }
                );
            }
        }

        // Validate created_by
        if (created_by) {
            const [users] = await connection.execute(
                "SELECT id FROM cst_users WHERE id = ? AND is_deleted = 0",
                [Number(created_by)]
            );

            if (users.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Created-by user not found" },
                    { status: 404 }
                );
            }
        }

        // Update match
        await connection.execute(
            `
        UPDATE cst_matches
    SET
    academy_id = ?,
        branch_id = ?,
        tournament_id = ?,
        team_a_id = ?,
        team_b_id = ?,
        match_no = ?,
        match_type = ?,
        match_date = ?,
        match_time = ?,
        ground_id = ?,
        booking_id = ?,
        toss_winner_team_id = ?,
        toss_decision = ?,
        status = ?,
        remarks = ?,
        created_by = ?
            WHERE id = ?
                `,
            [
                academy_id || null,
                branch_id || null,
                tournament_id || null,
                Number(team_a_id),
                Number(team_b_id),
                match_no || null,
                match_type,
                String(match_date).slice(0, 10),
                match_time || null,
                ground_id || null,
                booking_id || null,
                toss_winner_team_id || null,
                toss_decision || null,
                status,
                remarks || null,
                created_by || null,
                matchId,
            ]
        );

        const [updatedRows] = await connection.execute(
            "SELECT * FROM cst_matches WHERE id = ?",
            [matchId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Match updated successfully",
            data: updatedRows[0],
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("PUT Match Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update match",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// DELETE: Cancel match instead of permanently deleting it
export async function DELETE(request, { params }) {
    let connection;
    let transactionStarted = false;


    try {
        const { id } = await params;
        const matchId = Number(id);

        if (!Number.isInteger(matchId) || matchId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid match ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [existingRows] = await connection.execute(
            "SELECT id, status, booking_id FROM cst_matches WHERE id = ? FOR UPDATE",
            [matchId]
        );

        if (existingRows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Match not found" },
                { status: 404 }
            );
        }

        if (existingRows[0].status === "Completed") {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Completed matches cannot be cancelled",
                },
                { status: 400 }
            );
        }

        const bookingId = existingRows[0].booking_id;
        if (bookingId) {
            const [bookingRows] = await connection.execute(
                "SELECT id, booking_status FROM cst_ground_bookings WHERE id = ? FOR UPDATE",
                [bookingId]
            );

            if (bookingRows.length > 0) {
                await connection.execute(
                    "UPDATE cst_ground_payments SET remarks = ? WHERE booking_id = ?",
                    ["Match Cancellation Refund Processings", bookingId]
                );

                await connection.execute(
                    `
                    UPDATE cst_ground_bookings
                    SET
                        booking_status = CASE
                            WHEN booking_status IN ('Booked', 'Confirmed') THEN 'Cancelled'
                            ELSE booking_status
                        END,
                        match_id = CASE WHEN match_id = ? THEN NULL ELSE match_id END
                    WHERE id = ?
                    `,
                    [matchId, bookingId]
                );
            }
        }

        await connection.execute(
            `
        UPDATE cst_matches
        SET status = 'Cancelled'
        WHERE id = ?
        `,
            [matchId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Match cancelled successfully",
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("DELETE Match Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to cancel match",
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}
