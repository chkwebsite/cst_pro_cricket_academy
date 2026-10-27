import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


const VALID_ROLES = ["playing_11", "substitute", "captain", "vice_captain", "wicket_keeper"];
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

const toBoolean = (value) => {
    return value === true || value === 1 || value === "1";
};

const isPositiveInt = (value) => {
    return Number.isInteger(Number(value)) && Number(value) > 0;
};

const getPlayerReference = (body) => {
    const userId = body.user_id ? Number(body.user_id) : null;
    const outsidePlayerId = body.outside_player_id
        ? Number(body.outside_player_id)
        : null;
    const tournamentPlayerId = body.tournament_team_player_id
        ? Number(body.tournament_team_player_id)
        : null;

    const count = [userId, outsidePlayerId, tournamentPlayerId]
        .filter((value) => value !== null).length;

    if (count !== 1) {
        return {
            valid: false,
            message:
                "Provide exactly one of user_id, outside_player_id or tournament_team_player_id.",
        };
    }

    for (const value of [userId, outsidePlayerId, tournamentPlayerId]) {
        if (value !== null && !isPositiveInt(value)) {
            return {
                valid: false,
                message: "Player IDs must be positive integers.",
            };
        }
    }

    return {
        valid: true,
        user_id: userId,
        outside_player_id: outsidePlayerId,
        tournament_team_player_id: tournamentPlayerId,
    };
};

async function validatePlayer(connection, player, matchId, teamId) {
    if (player.user_id !== null) {
        const [users] = await connection.execute(
            `SELECT id
             FROM cst_users
             WHERE id = ?
             LIMIT 1`,
            [player.user_id]
        );

        if (!users.length) {
            return "Registered user not found.";
        }
    }

    if (player.outside_player_id !== null) {
        const [outsidePlayers] = await connection.execute(
            `SELECT id
             FROM cst_outside_players
             WHERE id = ?
             LIMIT 1`,
            [player.outside_player_id]
        );

        if (!outsidePlayers.length) {
            return "Outside player not found.";
        }
    }

    if (player.tournament_team_player_id !== null) {
        const [tournamentPlayers] = await connection.execute(
            `SELECT id, team_id
             FROM cst_tournament_team_players
             WHERE id = ?
             LIMIT 1`,
            [player.tournament_team_player_id]
        );

        if (!tournamentPlayers.length) {
            return "Tournament team player not found.";
        }

        if (Number(tournamentPlayers[0].team_id) !== Number(teamId)) {
            return "Tournament player does not belong to the selected team.";
        }

        const [matches] = await connection.execute(
            `SELECT tournament_id
             FROM cst_matches
             WHERE id = ?
             LIMIT 1`,
            [matchId]
        );

        if (!matches.length || !matches[0].tournament_id) {
            return "Tournament player can only be selected for a tournament match.";
        }

        const [tournamentTeams] = await connection.execute(
            `SELECT id
             FROM cst_tournament_teams
             WHERE tournament_id = ?
               AND team_id = ?
             LIMIT 1`,
            [matches[0].tournament_id, teamId]
        );

        if (!tournamentTeams.length) {
            return "Selected team is not registered in this tournament.";
        }
    }

    return null;
}

async function validateMatchTeam(connection, matchId, teamId) {
    const [matches] = await connection.execute(
        `SELECT
            m.id,
            m.team_a_id,
            m.team_b_id,
            m.academy_id,
            m.branch_id,
            m.tournament_id,
            tournament.academy_id AS tournament_academy_id,
            tournament.branch_id AS tournament_branch_id
         FROM cst_matches m
         LEFT JOIN cst_tournaments tournament ON tournament.id = m.tournament_id
         WHERE m.id = ?
         LIMIT 1`,
        [matchId]
    );

    if (!matches.length) {
        return {
            valid: false,
            message: "Match not found.",
        };
    }

    const match = matches[0];

    if (
        Number(match.team_a_id) !== Number(teamId) &&
        Number(match.team_b_id) !== Number(teamId)
    ) {
        return {
            valid: false,
            message: "Selected team does not belong to this match.",
        };
    }

    const [teams] = await connection.execute(
        `SELECT academy_id, branch_id
         FROM cst_teams
         WHERE id = ?
         LIMIT 1`,
        [teamId]
    );

    return { valid: true, match, team: teams[0] || {} };
}

function validateSelection(body) {
    const selection = {
        playing_11: toBoolean(body.playing_11) ? 1 : 0,
        substitute: toBoolean(body.substitute) ? 1 : 0,
        captain: toBoolean(body.captain) ? 1 : 0,
        vice_captain: toBoolean(body.vice_captain) ? 1 : 0,
        wicket_keeper: toBoolean(body.wicket_keeper) ? 1 : 0,
        jersey_no: body.jersey_no ? String(body.jersey_no).trim() : null,
        status: body.status === undefined ? 1 : Number(body.status),
    };

    if (![0, 1].includes(selection.status)) {
        return {
            valid: false,
            message: "status must be 0 or 1.",
        };
    }

    if (
        selection.captain &&
        selection.vice_captain
    ) {
        return {
            valid: false,
            message: "A player cannot be both captain and vice-captain.",
        };
    }

    if (
        (selection.captain ||
            selection.vice_captain ||
            selection.wicket_keeper) &&
        !selection.playing_11
    ) {
        return {
            valid: false,
            message:
                "Captain, vice-captain and wicket-keeper must be in playing_11.",
        };
    }

    if (selection.playing_11 && selection.substitute) {
        return {
            valid: false,
            message:
                "A player cannot be in playing_11 and substitute at the same time.",
        };
    }

    return {
        valid: true,
        data: selection,
    };
}

// GET /api/match-players
// Example:
// /api/match-players?match_id=10
// /api/match-players?match_id=10&team_id=2
// /api/match-players?playing_11=1
// /api/match-players?user_id=25

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const filters = {
            id: searchParams.get("id"),
            match_id: searchParams.get("match_id"),
            team_id: searchParams.get("team_id"),
            user_id: searchParams.get("user_id"),
            outside_player_id: searchParams.get("outside_player_id"),
            tournament_team_player_id: searchParams.get(
                "tournament_team_player_id"
            ),
            playing_11: searchParams.get("playing_11"),
            substitute: searchParams.get("substitute"),
            captain: searchParams.get("captain"),
            vice_captain: searchParams.get("vice_captain"),
            wicket_keeper: searchParams.get("wicket_keeper"),
            status: searchParams.get("status"),
        };

        const conditions = [];
        const values = [];

        const numericFilters = [
            "id",
            "match_id",
            "team_id",
            "user_id",
            "outside_player_id",
            "tournament_team_player_id",
        ];

        for (const key of numericFilters) {
            if (filters[key] !== null && filters[key] !== "") {
                if (!isPositiveInt(filters[key])) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${key} must be a positive integer.`,
                        },
                        { status: 400 }
                    );
                }

                conditions.push(`mp.${key} = ?`);
                values.push(Number(filters[key]));
            }
        }

        for (const key of [
            "playing_11",
            "substitute",
            "captain",
            "vice_captain",
            "wicket_keeper",
            "status",
        ]) {
            if (filters[key] !== null && filters[key] !== "") {
                if (!["0", "1"].includes(filters[key])) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${key} must be 0 or 1.`,
                        },
                        { status: 400 }
                    );
                }

                conditions.push(`mp.${key} = ?`);
                values.push(Number(filters[key]));
            }
        }

        connection = await pool.getConnection();

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [rows] = await connection.execute(
            `SELECT
                mp.*,
                m.match_no,
                m.match_type,
                m.match_date,
                m.status AS match_status,
                m.tournament_id,
                t.team_name,
                t.team_code,
                COALESCE(u.first_name, ttpu.first_name) AS first_name,
                COALESCE(u.last_name, ttpu.last_name) AS last_name,
                COALESCE(op.player_name, ttpop.player_name) AS outside_player_name,
                op.id AS outside_player_record_id,
                ttp.id AS tournament_player_record_id
             FROM cst_match_players mp
             INNER JOIN cst_matches m ON m.id = mp.match_id
             INNER JOIN cst_teams t ON t.id = mp.team_id
             LEFT JOIN cst_users u ON u.id = mp.user_id
             LEFT JOIN cst_outside_players op
                ON op.id = mp.outside_player_id
             LEFT JOIN cst_tournament_team_players ttp
                ON ttp.id = mp.tournament_team_player_id
             LEFT JOIN cst_users ttpu ON ttpu.id = ttp.user_id
             LEFT JOIN cst_outside_players ttpop ON ttpop.id = ttp.outside_player_id
             ${whereClause}
             ORDER BY mp.id DESC`,
            values
        );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET match players error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch match players.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST /api/match-players
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const matchId = Number(body.match_id);
        const teamId = Number(body.team_id);

        if (!isPositiveInt(matchId) || !isPositiveInt(teamId)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid match_id and team_id are required.",
                },
                { status: 400 }
            );
        }

        const player = getPlayerReference(body);

        if (!player.valid) {
            return NextResponse.json(
                { success: false, message: player.message },
                { status: 400 }
            );
        }

        const playerFee = body.player_fee === undefined ? 0 : Number(body.player_fee);
        const paidAmount = body.paid_amount === undefined ? 0 : Number(body.paid_amount);
        const paymentMode = body.payment_mode || "Cash";
        const requestedAcademyId = body.academy_id === undefined || body.academy_id === null || body.academy_id === ""
            ? null
            : Number(body.academy_id);
        const createdBy = body.created_by === undefined || body.created_by === null || body.created_by === ""
            ? null
            : Number(body.created_by);

        if (!Number.isFinite(playerFee) || playerFee < 0) {
            return NextResponse.json(
                { success: false, message: "player_fee must be zero or greater." },
                { status: 400 }
            );
        }

        if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > playerFee) {
            return NextResponse.json(
                { success: false, message: "paid_amount must be between zero and player_fee." },
                { status: 400 }
            );
        }

        if (paidAmount > 0 && !PAYMENT_MODES.includes(paymentMode)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment_mode." },
                { status: 400 }
            );
        }

        if (createdBy !== null && !isPositiveInt(createdBy)) {
            return NextResponse.json(
                { success: false, message: "created_by must be a positive integer or null." },
                { status: 400 }
            );
        }

        if (requestedAcademyId !== null && !isPositiveInt(requestedAcademyId)) {
            return NextResponse.json(
                { success: false, message: "academy_id must be a positive integer or null." },
                { status: 400 }
            );
        }

        const selection = validateSelection(body);

        if (!selection.valid) {
            return NextResponse.json(
                { success: false, message: selection.message },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const matchTeam = await validateMatchTeam(
            connection,
            matchId,
            teamId
        );

        if (!matchTeam.valid) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: matchTeam.message,
                },
                { status: 400 }
            );
        }

        const playerError = await validatePlayer(
            connection,
            player,
            matchId,
            teamId
        );

        if (playerError) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: playerError,
                },
                { status: 400 }
            );
        }

        const [creatorRows] = createdBy === null
            ? [[]]
            : await connection.execute(
                `SELECT academy_id, branch_id FROM cst_users WHERE id = ? LIMIT 1`,
                [createdBy]
            );
        const [playerOrganizationRows] = player.user_id === null
            ? [[]]
            : await connection.execute(
                `SELECT academy_id, branch_id FROM cst_users WHERE id = ? LIMIT 1`,
                [player.user_id]
            );
        let requestedAcademy = null;
        if (requestedAcademyId !== null) {
            const [academyRows] = await connection.execute(
                `SELECT id FROM cst_academy WHERE id = ? LIMIT 1`,
                [requestedAcademyId]
            );
            requestedAcademy = academyRows[0] ? { academy_id: academyRows[0].id, branch_id: null } : null;
        }
        const matchRecord = matchTeam.match;
        const organizationCandidates = [
            { academy_id: matchRecord.academy_id, branch_id: matchRecord.branch_id },
            { academy_id: matchTeam.team.academy_id, branch_id: matchTeam.team.branch_id },
            { academy_id: matchRecord.tournament_academy_id, branch_id: matchRecord.tournament_branch_id },
            requestedAcademy,
            playerOrganizationRows[0],
            creatorRows[0],
        ];
        let organization = organizationCandidates.find(
            (item) => item?.academy_id !== null && item?.academy_id !== undefined
        );
        if (!organization) {
            const branchCandidate = organizationCandidates.find(
                (item) => item?.branch_id !== null && item?.branch_id !== undefined
            );
            if (branchCandidate) {
                const [branchRows] = await connection.execute(
                    `SELECT id, academy_id FROM cst_branch WHERE id = ? LIMIT 1`,
                    [branchCandidate.branch_id]
                );
                if (branchRows[0]?.academy_id) {
                    organization = {
                        academy_id: branchRows[0].academy_id,
                        branch_id: branchRows[0].id,
                    };
                }
            }
        }
        const academyId = organization?.academy_id;
        const branchId = organization?.branch_id ?? null;

        if (!Number.isInteger(Number(academyId)) || Number(academyId) <= 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Cannot create the player fee: academy could not be determined from the match, team, tournament, or current user.",
                },
                { status: 400 }
            );
        }

        // Check whether this player has already been selected for this match.
        const identityColumn =
            player.user_id !== null
                ? "user_id"
                : player.outside_player_id !== null
                    ? "outside_player_id"
                    : "tournament_team_player_id";

        const identityValue =
            player.user_id ??
            player.outside_player_id ??
            player.tournament_team_player_id;

        const [duplicate] = await connection.execute(
            `SELECT id
             FROM cst_match_players
             WHERE match_id = ?
               AND ${identityColumn} = ?
             LIMIT 1`,
            [matchId, identityValue]
        );

        if (duplicate.length) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "This player is already added to this match.",
                },
                { status: 409 }
            );
        }

        // At most 11 active playing-eleven players per team.
        if (selection.data.playing_11) {
            const [playingEleven] = await connection.execute(
                `SELECT COUNT(*) AS total
                 FROM cst_match_players
                 WHERE match_id = ?
                   AND team_id = ?
                   AND playing_11 = 1
                   AND status = 1`,
                [matchId, teamId]
            );

            if (Number(playingEleven[0].total) >= 11) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This team already has 11 players in the playing eleven.",
                    },
                    { status: 400 }
                );
            }
        }

        // Enforce one captain and one vice-captain per team.
        for (const role of ["captain", "vice_captain"]) {
            if (selection.data[role]) {
                const [existing] = await connection.execute(
                    `SELECT id
                     FROM cst_match_players
                     WHERE match_id = ?
                       AND team_id = ?
                       AND ${role} = 1
                       AND status = 1
                     LIMIT 1`,
                    [matchId, teamId]
                );

                if (existing.length) {
                    await connection.rollback();

                    return NextResponse.json(
                        {
                            success: false,
                            message: `This team already has a ${role.replace("_", " ")}.`,
                        },
                        { status: 409 }
                    );
                }
            }
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_match_players (
                match_id,
                team_id,
                user_id,
                outside_player_id,
                tournament_team_player_id,
                jersey_no,
                playing_11,
                substitute,
                captain,
                vice_captain,
                wicket_keeper,
                status,
                player_fee,
                paid_amount,
                payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                matchId,
                teamId,
                player.user_id,
                player.outside_player_id,
                player.tournament_team_player_id,
                selection.data.jersey_no,
                selection.data.playing_11,
                selection.data.substitute,
                selection.data.captain,
                selection.data.vice_captain,
                selection.data.wicket_keeper,
                selection.data.status,
                playerFee,
                paidAmount,
                playerFee <= 0
                    ? "Not Generated"
                    : paidAmount <= 0
                        ? "Pending"
                        : paidAmount >= playerFee
                            ? "Paid"
                            : "Partial",
            ]
        );

        const feeStatus = selection.data.status === 0
            ? "Cancelled"
            : playerFee === 0 || paidAmount >= playerFee
                ? "Paid"
                : paidAmount > 0
                    ? "Partial"
                    : "Pending";
        const [feeStatusResult] = await connection.execute(
            `INSERT INTO cst_fee_status (
                academy_id,
                branch_id,
                fee_type,
                tournament_id,
                match_id,
                match_player_id,
                user_id,
                outside_player_id,
                fee_amount,
                paid_amount,
                status,
                remarks,
                created_by
            ) VALUES (?, ?, 'Match Player', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(academyId),
                branchId === null ? null : Number(branchId),
                matchRecord.tournament_id,
                matchId,
                result.insertId,
                player.user_id,
                player.outside_player_id,
                playerFee,
                paidAmount,
                feeStatus,
                "Match player fee",
                createdBy,
            ]
        );

        if (paidAmount > 0) {
            await connection.execute(
                `INSERT INTO cst_fee_payments (
                    fee_status_id,
                    amount,
                    payment_mode,
                    transaction_no,
                    payment_date,
                    status,
                    remarks,
                    created_by
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'Paid', ?, ?)`,
                [
                    feeStatusResult.insertId,
                    paidAmount,
                    paymentMode,
                    body.transaction_no ? String(body.transaction_no).trim() : null,
                    "Initial match player payment",
                    createdBy,
                ]
            );
        }

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Match player added successfully.",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST match player error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to add match player.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}