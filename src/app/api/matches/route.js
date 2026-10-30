import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

const isValidMatchDate = (value) => {
    if (typeof value !== "string") {
        return false;
    }

    // Format must be YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    // Validate actual calendar date
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
};

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


    const date = new Date(`${value} T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );


};

const isValidTime = (value) =>
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

// GET: Fetch matches with filters
export async function GET(request) {
    let connection;


    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const filters = {
            id: searchParams.get("id"),
            academy_id: searchParams.get("academy_id"),
            branch_id: searchParams.get("branch_id"),
            tournament_id: searchParams.get("tournament_id"),
            team_a_id: searchParams.get("team_a_id"),
            team_b_id: searchParams.get("team_b_id"),
            match_no: searchParams.get("match_no"),
            match_type: searchParams.get("match_type"),
            match_date: searchParams.get("match_date"),
            date_from: searchParams.get("date_from"),
            date_to: searchParams.get("date_to"),
            ground_id: searchParams.get("ground_id"),
            booking_id: searchParams.get("booking_id"),
            status: searchParams.get("status"),
            search: searchParams.get("search"),
        };

        let sql = `
    SELECT
    m.id,
        m.academy_id,
        m.branch_id,
        m.tournament_id,
        m.team_a_id,
        m.team_b_id,
        m.match_no,
        m.match_type,
        m.match_date,
        m.match_time,
        m.ground_id,
        m.booking_id,
        m.toss_winner_team_id,
        m.toss_decision,
        m.status,
        m.remarks,
        m.created_by,
        m.created_at,
        m.updated_at,

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

        WHERE 1 = 1
        `;

        const values = [];

        if (filters.id) {
            sql += " AND m.id = ?";
            values.push(filters.id);
        }

        const authUser = await getAuthUser(request);
        if (authUser) {
            if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND m.branch_id = ? AND m.academy_id = ?";
                values.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND m.academy_id = ?";
                values.push(authUser.academy_id);
                if (filters.branch_id) {
                    sql += " AND m.branch_id = ?";
                    values.push(filters.branch_id);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND m.academy_id = ?";
                values.push(authUser.academy_id);
            } else {
                if (filters.academy_id) { sql += " AND m.academy_id = ?"; values.push(filters.academy_id); }
                if (filters.branch_id) { sql += " AND m.branch_id = ?"; values.push(filters.branch_id); }
            }
        } else {
            if (filters.academy_id) { sql += " AND m.academy_id = ?"; values.push(filters.academy_id); }
            if (filters.branch_id) { sql += " AND m.branch_id = ?"; values.push(filters.branch_id); }
        }

        if (filters.tournament_id) {
            sql += " AND m.tournament_id = ?";
            values.push(filters.tournament_id);
        }

        if (filters.team_a_id) {
            sql += " AND m.team_a_id = ?";
            values.push(filters.team_a_id);
        }

        if (filters.team_b_id) {
            sql += " AND m.team_b_id = ?";
            values.push(filters.team_b_id);
        }

        if (filters.match_no) {
            sql += " AND m.match_no LIKE ?";
            values.push(`% ${filters.match_no}% `);
        }

        if (filters.match_type) {
            sql += " AND m.match_type = ?";
            values.push(filters.match_type);
        }

        if (filters.match_date) {
            sql += " AND m.match_date = ?";
            values.push(filters.match_date);
        }

        if (filters.date_from) {
            sql += " AND m.match_date >= ?";
            values.push(filters.date_from);
        }

        if (filters.date_to) {
            sql += " AND m.match_date <= ?";
            values.push(filters.date_to);
        }

        if (filters.ground_id) {
            sql += " AND m.ground_id = ?";
            values.push(filters.ground_id);
        }

        if (filters.booking_id) {
            sql += " AND m.booking_id = ?";
            values.push(filters.booking_id);
        }

        if (filters.status) {
            sql += " AND m.status = ?";
            values.push(filters.status);
        }

        if (filters.search) {
            sql += `
    AND(
        m.match_no LIKE ?
        OR ta.team_name LIKE ?
        OR tb.team_name LIKE ?
        OR t.tournament_name LIKE ?
        OR g.ground_name LIKE ?
            )
        `;

            const searchValue = `% ${filters.search}% `;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        sql += " ORDER BY m.match_date DESC, m.match_time DESC, m.id DESC";

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            message: "Matches fetched successfully",
            total: rows.length,
            data: rows,
        });

    } catch (error) {
        console.error("GET Matches Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch matches",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// POST: Create new match
export async function POST(request) {
    let connection;
    let transactionStarted = false;


    try {
        const body = await request.json();

        const {
            academy_id,
            branch_id,
            tournament_id,
            team_a_id,
            team_b_id,
            match_no,
            match_type,
            match_date,
            match_time,
            ground_id,
            booking_id,
            toss_winner_team_id,
            toss_decision,
            status = "Scheduled",
            remarks,
            created_by,
        } = body;

        // Required fields
        if (
            !team_a_id ||
            !team_b_id ||
            !match_type ||
            !match_date
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "team_a_id, team_b_id, match_type and match_date are required",
                },
                { status: 400 }
            );
        }

        if (!isPositiveId(team_a_id) || !isPositiveId(team_b_id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid team IDs",
                },
                { status: 400 }
            );
        }

        if (Number(team_a_id) === Number(team_b_id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team A and Team B must be different",
                },
                { status: 400 }
            );
        }

        if (!validMatchTypes.includes(match_type)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid match_type",
                },
                { status: 400 }
            );
        }

        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid match status",
                },
                { status: 400 }
            );
        }

        if (!isValidMatchDate(match_date)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "match_date must be a valid YYYY-MM-DD date",
                },
                { status: 400 }
            );
        }

        if (
            match_time !== undefined &&
            match_time !== null &&
            match_time !== "" &&
            !isValidTime(match_time)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "match_time must use HH:MM or HH:MM:SS format",
                },
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
                value !== undefined &&
                value !== null &&
                value !== "" &&
                !isPositiveId(value)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Invalid ${field} `,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            toss_decision !== undefined &&
            toss_decision !== null &&
            toss_decision !== "" &&
            !validTossDecisions.includes(toss_decision)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "toss_decision must be Bat or Bowl",
                },
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
            return NextResponse.json(
                {
                    success: false,
                    message: "Toss winner must be Team A or Team B",
                },
                { status: 400 }
            );
        }

        if (
            toss_decision &&
            !toss_winner_team_id
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "toss_winner_team_id is required when toss_decision is provided",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        // Validate teams
        const [teams] = await connection.execute(
            `
        SELECT id, academy_id, branch_id, is_deleted
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
        if (academy_id !== undefined && academy_id !== null && academy_id !== "") {
            const [academies] = await connection.execute(
                "SELECT id FROM cst_academy WHERE id = ?",
                [Number(academy_id)]
            );

            if (academies.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Academy not found",
                    },
                    { status: 404 }
                );
            }
        }

        // Validate branch belongs to selected academy
        if (branch_id !== undefined && branch_id !== null && branch_id !== "") {
            let branchSql = "SELECT id, academy_id FROM cst_branch WHERE id = ?";
            const branchValues = [Number(branch_id)];

            const [branches] = await connection.execute(
                branchSql,
                branchValues
            );

            if (branches.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Branch not found",
                    },
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
                        message: "Branch does not belong to the selected academy",
                    },
                    { status: 400 }
                );
            }
        }

        // Validate tournament and academy relationship
        if (tournament_id !== undefined && tournament_id !== null && tournament_id !== "") {
            const [tournaments] = await connection.execute(
                `
            SELECT id, academy_id, branch_id, is_deleted
            FROM cst_tournaments
            WHERE id = ?
        FOR UPDATE
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
                    {
                        success: false,
                        message: "Tournament not found or deleted",
                    },
                    { status: 404 }
                );
            }

            const tournament = tournaments[0];

            if (
                academy_id &&
                tournament.academy_id &&
                Number(academy_id) !== Number(tournament.academy_id)
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Tournament does not belong to the selected academy",
                    },
                    { status: 400 }
                );
            }
        }

        // Validate ground
        if (ground_id !== undefined && ground_id !== null && ground_id !== "") {
            const [grounds] = await connection.execute(
                `
            SELECT id, academy_id, is_deleted
            FROM cst_ground
            WHERE id = ?
        `,
                [Number(ground_id)]
            );

            if (
                grounds.length === 0 ||
                Number(grounds[0].is_deleted) === 1
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Ground not found or deleted",
                    },
                    { status: 404 }
                );
            }
        }

        let bookingSlotId = null;

        // Validate booking and ground relation
        if (booking_id !== undefined && booking_id !== null && booking_id !== "") {
            const [bookings] = await connection.execute(
                `
            SELECT
                id,
                ground_id,
                slot_id,
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
                    {
                        success: false,
                        message: "Ground booking not found",
                    },
                    { status: 404 }
                );
            }

            bookingSlotId = bookings[0].slot_id;

            if (
                !ground_id ||
                Number(bookings[0].ground_id) !== Number(ground_id)
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Booking does not belong to the selected ground",
                    },
                    { status: 400 }
                );
            }

            if (bookings[0].booking_date !== match_date) {
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
                "SELECT id FROM cst_matches WHERE booking_id = ? LIMIT 1 FOR UPDATE",
                [Number(booking_id)]
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
                [Number(ground_id), match_date]
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
        if (created_by !== undefined && created_by !== null && created_by !== "") {
            const [users] = await connection.execute(
                "SELECT id FROM cst_users WHERE id = ? AND is_deleted = 0",
                [Number(created_by)]
            );

            if (users.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Created-by user not found",
                    },
                    { status: 404 }
                );
            }
        }

        // Insert match
        const [result] = await connection.execute(
            `
        INSERT INTO cst_matches
        (
            academy_id,
            branch_id,
            tournament_id,
            team_a_id,
            team_b_id,
            match_no,
            match_type,
            match_date,
            match_time,
            ground_id,
            booking_id,
            toss_winner_team_id,
            toss_decision,
            status,
            remarks,
            created_by
        )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            [
                academy_id || null,
                branch_id || null,
                tournament_id || null,
                Number(team_a_id),
                Number(team_b_id),
                match_no || null,
                match_type,
                match_date,
                match_time || null,
                ground_id || null,
                booking_id || null,
                toss_winner_team_id || null,
                toss_decision || null,
                status,
                remarks || null,
                created_by || null,
            ]
        );

        const matchId = result.insertId;

        if (booking_id) {
            const [bookingUpdate] = await connection.execute(
                `
                UPDATE cst_ground_bookings
                SET match_id = ?
                WHERE id = ?
                    AND ground_id = ?
                    AND slot_id = ?
                    AND booking_date = ?
                    AND booking_status IN ('Booked', 'Confirmed')
                    AND match_id IS NULL
                `,
                [
                    matchId,
                    Number(booking_id),
                    Number(ground_id),
                    Number(bookingSlotId),
                    match_date,
                ]
            );

            if (bookingUpdate.affectedRows !== 1) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Ground booking could not be linked to the match",
                    },
                    { status: 409 }
                );
            }
        }

        const [newMatch] = await connection.execute(
            "SELECT * FROM cst_matches WHERE id = ?",
            [matchId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Match created successfully",
                data: newMatch[0],
            },
            { status: 201 }
        );

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("POST Match Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create match",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}
