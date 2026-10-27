import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


const ROUND_TYPES = [
    "League",
    "Round Robin",
    "Quarter Final",
    "Semi Final",
    "Final",
    "Qualifier",
    "Eliminator",
    "Custom",
];

const MATCH_STATUSES = [
    "Scheduled",
    "Live",
    "Completed",
    "Cancelled",
    "Postponed",
];

const optionalId = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }

    const number = Number(value);

    return Number.isInteger(number) && number > 0 ? number : NaN;
};

const isValidDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

const MATCH_SELECT = `
    SELECT
        tm.*,
        t.tournament_name,
        t.tournament_code,
        ma.match_no AS actual_match_no,
        ma.match_type,
        ma.match_date,
        ma.match_time AS actual_match_time,
        ma.status AS actual_match_status,
        ma.booking_id AS actual_match_booking_id,
        ta.team_name AS team_a_name,
        ta.team_code AS team_a_code,
        tb.team_name AS team_b_name,
        tb.team_code AS team_b_code,
        tw.team_name AS winner_team_name,
        g.ground_name,
        g.ground_code
    FROM cst_tournament_matches tm
    LEFT JOIN cst_tournaments t ON t.id = tm.tournament_id
    LEFT JOIN cst_matches ma ON ma.id = tm.match_id
    LEFT JOIN cst_teams ta ON ta.id = tm.team_a_id
    LEFT JOIN cst_teams tb ON tb.id = tm.team_b_id
    LEFT JOIN cst_teams tw ON tw.id = tm.winner_team_id
    LEFT JOIN cst_ground g ON g.id = tm.ground_id
`;

export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid tournament match ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `${MATCH_SELECT} WHERE tm.id = ? LIMIT 1`,
            [Number(id)]
        );

        if (!rows.length) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament match not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET tournament match error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournament match",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const matchRowId = Number(id);

        if (!Number.isInteger(matchRowId) || matchRowId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid tournament match ID" },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [existingRows] = await connection.query(
            `SELECT * FROM cst_tournament_matches WHERE id = ? FOR UPDATE`,
            [matchRowId]
        );

        if (!existingRows.length) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament match not found",
                },
                { status: 404 }
            );
        }

        const old = existingRows[0];

        const tournamentId =
            body.tournament_id === undefined
                ? old.tournament_id
                : Number(body.tournament_id);

        const matchNo =
            body.match_no === undefined
                ? old.match_no
                : Number(body.match_no);

        const matchId =
            body.match_id === undefined
                ? old.match_id
                : optionalId(body.match_id);

        const roundName =
            body.round_name === undefined
                ? old.round_name
                : body.round_name || null;

        const roundType =
            body.round_type === undefined
                ? old.round_type
                : body.round_type;

        const teamAId =
            body.team_a_id === undefined
                ? old.team_a_id
                : optionalId(body.team_a_id);

        const teamBId =
            body.team_b_id === undefined
                ? old.team_b_id
                : optionalId(body.team_b_id);

        const scheduledDate =
            body.scheduled_date === undefined
                ? old.scheduled_date
                    ? new Date(old.scheduled_date).toISOString().slice(0, 10)
                    : null
                : body.scheduled_date || null;

        const scheduledTime =
            body.scheduled_time === undefined
                ? old.scheduled_time
                    ? String(old.scheduled_time).slice(0, 8)
                    : null
                : body.scheduled_time || null;

        const groundId =
            body.ground_id === undefined
                ? old.ground_id
                : optionalId(body.ground_id);

        const bookingId =
            body.booking_id === undefined
                ? old.booking_id
                : optionalId(body.booking_id);

        const status =
            body.status === undefined
                ? old.status
                : body.status;

        const winnerTeamId =
            body.winner_team_id === undefined
                ? old.winner_team_id
                : optionalId(body.winner_team_id);

        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Valid tournament_id is required" },
                { status: 400 }
            );
        }

        if (!Number.isInteger(matchNo) || matchNo <= 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "match_no must be a positive integer" },
                { status: 400 }
            );
        }

        if (!ROUND_TYPES.includes(roundType)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid round_type" },
                { status: 400 }
            );
        }

        if (!MATCH_STATUSES.includes(status)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid match status" },
                { status: 400 }
            );
        }

        for (const [label, value] of [
            ["match_id", matchId],
            ["team_a_id", teamAId],
            ["team_b_id", teamBId],
            ["ground_id", groundId],
            ["booking_id", bookingId],
            ["winner_team_id", winnerTeamId],
        ]) {
            if (value !== null && (!Number.isInteger(value) || value <= 0)) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: `${label} must be a positive integer or null`,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            teamAId !== null &&
            teamBId !== null &&
            teamAId === teamBId
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Team A and Team B must be different",
                },
                { status: 400 }
            );
        }

        if (
            winnerTeamId !== null &&
            winnerTeamId !== teamAId &&
            winnerTeamId !== teamBId
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Winner must be Team A or Team B",
                },
                { status: 400 }
            );
        }

        if (
            scheduledDate !== null &&
            !isValidDate(scheduledDate)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "scheduled_date must be a valid YYYY-MM-DD date",
                },
                { status: 400 }
            );
        }

        if (
            scheduledTime !== null &&
            !isValidTime(scheduledTime)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "scheduled_time must be a valid HH:mm or HH:mm:ss time",
                },
                { status: 400 }
            );
        }

        const [tournaments] = await connection.query(
            `SELECT id FROM cst_tournaments WHERE id = ? LIMIT 1`,
            [tournamentId]
        );

        if (!tournaments.length) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Tournament not found" },
                { status: 404 }
            );
        }

        if (matchId !== null) {
            const [matches] = await connection.query(
                `SELECT id FROM cst_matches WHERE id = ? LIMIT 1`,
                [matchId]
            );

            if (!matches.length) {
                await connection.rollback();

                return NextResponse.json(
                    { success: false, message: "Match not found" },
                    { status: 404 }
                );
            }
        }

        const teamIds = [...new Set(
            [teamAId, teamBId, winnerTeamId].filter((value) => value !== null)
        )];

        if (teamIds.length) {
            const placeholders = teamIds.map(() => "?").join(",");

            const [teams] = await connection.query(
                `SELECT id FROM cst_teams WHERE id IN (${placeholders})`,
                teamIds
            );

            if (teams.length !== teamIds.length) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "One or more teams were not found",
                    },
                    { status: 404 }
                );
            }
        }

        if (groundId !== null) {
            const [grounds] = await connection.query(
                `SELECT id FROM cst_ground WHERE id = ? LIMIT 1`,
                [groundId]
            );

            if (!grounds.length) {
                await connection.rollback();

                return NextResponse.json(
                    { success: false, message: "Ground not found" },
                    { status: 404 }
                );
            }
        }

        if (bookingId !== null) {
            const [bookings] = await connection.query(
                `SELECT id FROM cst_ground_bookings WHERE id = ? LIMIT 1`,
                [bookingId]
            );

            if (!bookings.length) {
                await connection.rollback();

                return NextResponse.json(
                    { success: false, message: "Ground booking not found" },
                    { status: 404 }
                );
            }
        }

        await connection.query(
            `
                UPDATE cst_tournament_matches
                SET
                    tournament_id = ?,
                    match_id = ?,
                    match_no = ?,
                    round_name = ?,
                    round_type = ?,
                    team_a_id = ?,
                    team_b_id = ?,
                    scheduled_date = ?,
                    scheduled_time = ?,
                    ground_id = ?,
                    booking_id = ?,
                    status = ?,
                    winner_team_id = ?
                WHERE id = ?
            `,
            [
                tournamentId,
                matchId,
                matchNo,
                roundName,
                roundType,
                teamAId,
                teamBId,
                scheduledDate,
                scheduledTime,
                groundId,
                bookingId,
                status,
                winnerTeamId,
                matchRowId,
            ]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Tournament match updated successfully",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("PUT tournament match error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This match number or match_id is already registered in a tournament",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "One of the referenced records does not exist",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update tournament match",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const matchRowId = Number(id);

        if (!Number.isInteger(matchRowId) || matchRowId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid tournament match ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [result] = await connection.query(
            `DELETE FROM cst_tournament_matches WHERE id = ?`,
            [matchRowId]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament match not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Tournament match deleted successfully",
        });
    } catch (error) {
        console.error("DELETE tournament match error:", error);

        return NextResponse.json(
            {
                success: false,
                message:
                    error.code === "ER_ROW_IS_REFERENCED_2"
                        ? "This tournament match cannot be deleted because another record references it"
                        : "Failed to delete tournament match",
            },
            { status: error.code === "ER_ROW_IS_REFERENCED_2" ? 409 : 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}