import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";
import { autoUpdateTodayLiveMatches } from "@/app/components/lib/match-date-validator";


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

const requiredId = (value) => {
    const number = Number(value);

    return Number.isInteger(number) && number > 0 ? number : null;
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

const isValidPositiveId = (value) =>
    Number.isInteger(value) && value > 0;

const MATCH_SELECT = `
    SELECT
        tm.*,

        t.tournament_name,
        t.tournament_code,
        t.academy_id,
        t.branch_id,

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
        g.ground_code,

        CONCAT_WS(' ', motm.first_name, motm.last_name) AS man_of_the_match_name

    FROM cst_tournament_matches tm

    LEFT JOIN cst_tournaments t
        ON t.id = tm.tournament_id

    LEFT JOIN cst_matches ma
        ON ma.id = tm.match_id

    LEFT JOIN cst_teams ta
        ON ta.id = tm.team_a_id

    LEFT JOIN cst_teams tb
        ON tb.id = tm.team_b_id

    LEFT JOIN cst_teams tw
        ON tw.id = tm.winner_team_id

    LEFT JOIN cst_ground g
        ON g.id = tm.ground_id

    LEFT JOIN cst_users motm
        ON motm.id = tm.man_of_the_match_id
`;

const VALIDATE_TEAMS_SQL = `
    SELECT id, team_name
    FROM cst_teams
    WHERE id IN (?, ?)
`;

export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        // Auto-update matches & tournament matches to 'Live' on match date
        try {
            await autoUpdateTodayLiveMatches(connection);
        } catch (autoLiveErr) {
            console.error("Auto-update live tournament matches error:", autoLiveErr);
        }

        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id");
        const tournamentId = searchParams.get("tournament_id");
        const matchId = searchParams.get("match_id");
        const matchNo = searchParams.get("match_no");
        const roundType = searchParams.get("round_type");
        const groupName = searchParams.get("group_name");
        const teamAId = searchParams.get("team_a_id");
        const teamBId = searchParams.get("team_b_id");
        const groundId = searchParams.get("ground_id");
        const bookingId = searchParams.get("booking_id");
        const status = searchParams.get("status");
        const dateFrom = searchParams.get("date_from");
        const dateTo = searchParams.get("date_to");
        const search = searchParams.get("search");

        const conditions = ["1 = 1"];
        const params = [];

        const { user: authUser } = await getAuthenticatedUser(request);
        if (authUser) {
            if (authUser.isPlayer) {
                conditions.push("t.academy_id = ? AND (t.branch_id = ? OR t.branch_id IS NULL)");
                params.push(authUser.academy_id, authUser.branch_id);
            } else if (authUser.isBranchAdmin && authUser.branch_id) {
                conditions.push("t.academy_id = ? AND t.branch_id = ?");
                params.push(authUser.academy_id, authUser.branch_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                conditions.push("t.academy_id = ?");
                params.push(authUser.academy_id);
                const branchIdParam = searchParams.get("branch_id");
                if (branchIdParam) {
                    conditions.push("t.branch_id = ?");
                    params.push(Number(branchIdParam));
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                const allowed = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
                conditions.push(`t.academy_id = ? AND t.branch_id IN (${allowed.map(() => "?").join(",")})`);
                params.push(authUser.academy_id, ...allowed);
            }
        }

        const filters = [
            ["tm.id", id],
            ["tm.tournament_id", tournamentId],
            ["tm.match_id", matchId],
            ["tm.match_no", matchNo],
            ["tm.round_type", roundType],
            ["tm.group_name", groupName],
            ["tm.team_a_id", teamAId],
            ["tm.team_b_id", teamBId],
            ["tm.ground_id", groundId],
            ["tm.booking_id", bookingId],
            ["tm.status", status],
        ];

        for (const [column, value] of filters) {
            if (value !== null && value !== "") {
                conditions.push(`${column} = ?`);
                params.push(value);
            }
        }

        if (dateFrom) {
            if (!isValidDate(dateFrom)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "date_from must be a valid YYYY-MM-DD date",
                    },
                    { status: 400 }
                );
            }

            conditions.push("tm.scheduled_date >= ?");
            params.push(dateFrom);
        }

        if (dateTo) {
            if (!isValidDate(dateTo)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "date_to must be a valid YYYY-MM-DD date",
                    },
                    { status: 400 }
                );
            }

            conditions.push("tm.scheduled_date <= ?");
            params.push(dateTo);
        }

        if (search) {
            conditions.push(`
                (
                    tm.round_name LIKE ?
                    OR t.tournament_name LIKE ?
                    OR ta.team_name LIKE ?
                    OR tb.team_name LIKE ?
                    OR g.ground_name LIKE ?
                )
            `);

            const keyword = `%${search}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        const sql = `
            ${MATCH_SELECT}
            WHERE ${conditions.join(" AND ")}
            ORDER BY
                tm.scheduled_date IS NULL,
                tm.scheduled_date ASC,
                tm.scheduled_time ASC,
                tm.match_no ASC
        `;

        const [rows] = await connection.query(sql, params);

        // Enrich with innings scores from cst_match_innings if linked to cst_matches
        const linkedMatchIds = [...new Set(rows.map((r) => r.match_id).filter(Boolean))];
        let inningsMap = {};
        if (linkedMatchIds.length > 0) {
            try {
                const placeholders = linkedMatchIds.map(() => "?").join(",");
                const [inningsRows] = await connection.query(
                    `SELECT mi.id, mi.match_id, mi.innings_no, mi.batting_team_id, mi.bowling_team_id,
                            mi.total_runs, mi.total_wickets, mi.total_overs, mi.total_balls, mi.innings_status,
                            bt.team_name AS batting_team_name
                     FROM cst_match_innings mi
                     LEFT JOIN cst_teams bt ON bt.id = mi.batting_team_id
                     WHERE mi.match_id IN (${placeholders})
                     ORDER BY mi.match_id ASC, mi.innings_no ASC`,
                    linkedMatchIds
                );
                inningsRows.forEach((inn) => {
                    if (!inningsMap[inn.match_id]) inningsMap[inn.match_id] = [];
                    inningsMap[inn.match_id].push(inn);
                });
            } catch (errInns) {
                console.error("Error enriching tournament matches with innings:", errInns);
            }
        }

        const enrichedRows = rows.map((r) => {
            const matchInnings = r.match_id ? (inningsMap[r.match_id] || []) : [];
            const innA = matchInnings.find((i) => Number(i.batting_team_id) === Number(r.team_a_id));
            const innB = matchInnings.find((i) => Number(i.batting_team_id) === Number(r.team_b_id));
            const scoreA = innA
                ? `${innA.total_runs}/${innA.total_wickets} (${innA.total_overs} ov)`
                : r.team_a_runs !== null && r.team_a_runs !== undefined
                ? `${r.team_a_runs}/${r.team_a_wickets ?? 0} (${r.team_a_overs || r.overs || 20} ov)`
                : null;
            const scoreB = innB
                ? `${innB.total_runs}/${innB.total_wickets} (${innB.total_overs} ov)`
                : r.team_b_runs !== null && r.team_b_runs !== undefined
                ? `${r.team_b_runs}/${r.team_b_wickets ?? 0} (${r.team_b_overs || r.overs || 20} ov)`
                : null;

            return {
                ...r,
                innings: matchInnings,
                team_a_score: scoreA,
                team_b_score: scoreB,
            };
        });

        return NextResponse.json({
            success: true,
            count: enrichedRows.length,
            data: enrichedRows,
        });
    } catch (error) {
        console.error("GET tournament matches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournament matches",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot schedule tournament matches." },
            { status: 403 }
        );
    }

    let connection;

    try {
        const body = await request.json();

        const {
            tournament_id,
            match_id = null,
            match_no,
            round_name = null,
            round_type = "League",
            group_name = null,
            overs = null,
            team_a_id = null,
            team_b_id = null,
            scheduled_date = null,
            scheduled_time = null,
            ground_id = null,
            booking_id = null,
            status = "Scheduled",
            winner_team_id = null,
            win_margin = null,
            result_summary = null,
            man_of_the_match_id = null,
            team_a_runs = null,
            team_a_wickets = null,
            team_a_overs = null,
            team_b_runs = null,
            team_b_wickets = null,
            team_b_overs = null,
        } = body;

        const tournamentId = requiredId(tournament_id);
        const matchNo = Number(match_no);

        if (!tournamentId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid tournament_id is required",
                },
                { status: 400 }
            );
        }

        if (!Number.isInteger(matchNo) || matchNo <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "match_no must be a positive integer",
                },
                { status: 400 }
            );
        }

        if (!ROUND_TYPES.includes(round_type)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid round_type",
                },
                { status: 400 }
            );
        }

        if (!MATCH_STATUSES.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid match status",
                },
                { status: 400 }
            );
        }

        const matchId = optionalId(match_id);
        const teamAId = optionalId(team_a_id);
        const teamBId = optionalId(team_b_id);
        const groundId = optionalId(ground_id);
        const bookingId = optionalId(booking_id);
        const winnerTeamId = optionalId(winner_team_id);

        for (const [label, value] of [
            ["match_id", matchId],
            ["team_a_id", teamAId],
            ["team_b_id", teamBId],
            ["ground_id", groundId],
            ["booking_id", bookingId],
            ["winner_team_id", winnerTeamId],
        ]) {
            if (value !== null && !isValidPositiveId(value)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${label} must be a positive integer`,
                    },
                    { status: 400 }
                );
            }
        }

        if (teamAId !== null && teamBId !== null && teamAId === teamBId) {
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
            return NextResponse.json(
                {
                    success: false,
                    message: "Winner must be Team A or Team B",
                },
                { status: 400 }
            );
        }

        if (scheduled_date !== null && scheduled_date !== "") {
            if (!isValidDate(scheduled_date)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "scheduled_date must be a valid YYYY-MM-DD date",
                    },
                    { status: 400 }
                );
            }
        }

        if (scheduled_time !== null && scheduled_time !== "") {
            if (!isValidTime(scheduled_time)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "scheduled_time must be a valid HH:mm or HH:mm:ss time",
                    },
                    { status: 400 }
                );
            }
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // Validate tournament
        const [tournaments] = await connection.query(
            `SELECT id, academy_id, branch_id FROM cst_tournaments WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [tournamentId]
        );

        if (!tournaments.length) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament not found",
                },
                { status: 404 }
            );
        }

        if (!authUser.isSuperAdmin) {
            if (Number(tournaments[0].academy_id) !== Number(authUser.academy_id)) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, message: "Tournament belongs to another academy" },
                    { status: 403 }
                );
            }
            if (authUser.isBranchAdmin && Number(tournaments[0].branch_id) !== Number(authUser.branch_id)) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, message: "Tournament belongs to another branch" },
                    { status: 403 }
                );
            }
        }

        // Validate actual match, if supplied
        if (matchId !== null) {
            const [matches] = await connection.query(
                `SELECT id FROM cst_matches WHERE id = ? LIMIT 1`,
                [matchId]
            );

            if (!matches.length) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Match not found",
                    },
                    { status: 404 }
                );
            }
        }

        // Validate teams
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

        // Validate ground
        if (groundId !== null) {
            const [grounds] = await connection.query(
                `SELECT id FROM cst_ground WHERE id = ? LIMIT 1`,
                [groundId]
            );

            if (!grounds.length) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Ground not found",
                    },
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
                    {
                        success: false,
                        message: "Ground booking not found",
                    },
                    { status: 404 }
                );
            }
        }

        const [result] = await connection.query(
            `
                INSERT INTO cst_tournament_matches (
                    tournament_id,
                    match_id,
                    match_no,
                    round_name,
                    group_name,
                    round_type,
                    overs,
                    team_a_id,
                    team_b_id,
                    scheduled_date,
                    scheduled_time,
                    ground_id,
                    booking_id,
                    status,
                    winner_team_id,
                    win_margin,
                    result_summary,
                    man_of_the_match_id,
                    team_a_runs,
                    team_a_wickets,
                    team_a_overs,
                    team_b_runs,
                    team_b_wickets,
                    team_b_overs
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                tournamentId,
                matchId,
                matchNo,
                round_name || null,
                group_name || null,
                round_type,
                overs ? Number(overs) : 20,
                teamAId,
                teamBId,
                scheduled_date || null,
                scheduled_time || null,
                groundId,
                bookingId,
                status,
                winnerTeamId,
                win_margin || null,
                result_summary || null,
                man_of_the_match_id ? Number(man_of_the_match_id) : null,
                team_a_runs !== null && team_a_runs !== undefined && team_a_runs !== "" ? Number(team_a_runs) : null,
                team_a_wickets !== null && team_a_wickets !== undefined && team_a_wickets !== "" ? Number(team_a_wickets) : null,
                team_a_overs || null,
                team_b_runs !== null && team_b_runs !== undefined && team_b_runs !== "" ? Number(team_b_runs) : null,
                team_b_wickets !== null && team_b_wickets !== undefined && team_b_wickets !== "" ? Number(team_b_wickets) : null,
                team_b_overs || null,
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Tournament match created successfully",
                data: {
                    id: result.insertId,
                    tournament_id: tournamentId,
                    match_id: matchId,
                    match_no: matchNo,
                    booking_id: bookingId,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST tournament match error:", error);

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
                message: "Failed to create tournament match",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}