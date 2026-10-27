import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

const isPositiveInt = (value) =>
    Number.isInteger(Number(value)) && Number(value) > 0;

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const matchId = searchParams.get("match_id");
        const teamId = searchParams.get("team_id");
        const id = searchParams.get("id");

        connection = await pool.getConnection();

        // If match_id is provided, ensure Team A and Team B exist in cst_match_teams
        if (matchId && isPositiveInt(matchId)) {
            const [matches] = await connection.execute(
                `SELECT id, team_a_id, team_b_id FROM cst_matches WHERE id = ? LIMIT 1`,
                [Number(matchId)]
            );

            if (matches.length > 0) {
                const match = matches[0];
                if (match.team_a_id) {
                    const [existingA] = await connection.execute(
                        `SELECT id FROM cst_match_teams WHERE match_id = ? AND team_id = ? LIMIT 1`,
                        [match.id, match.team_a_id]
                    );
                    if (!existingA.length) {
                        await connection.execute(
                            `INSERT INTO cst_match_teams (match_id, team_id, team_side, match_fee, payment_status, status) VALUES (?, ?, 'A', 0, 'Pending', 1)`,
                            [match.id, match.team_a_id]
                        );
                    }
                }
                if (match.team_b_id) {
                    const [existingB] = await connection.execute(
                        `SELECT id FROM cst_match_teams WHERE match_id = ? AND team_id = ? LIMIT 1`,
                        [match.id, match.team_b_id]
                    );
                    if (!existingB.length) {
                        await connection.execute(
                            `INSERT INTO cst_match_teams (match_id, team_id, team_side, match_fee, payment_status, status) VALUES (?, ?, 'B', 0, 'Pending', 1)`,
                            [match.id, match.team_b_id]
                        );
                    }
                }
            }
        }

        const conditions = [];
        const values = [];

        if (id && isPositiveInt(id)) {
            conditions.push("mt.id = ?");
            values.push(Number(id));
        }

        if (matchId && isPositiveInt(matchId)) {
            conditions.push("mt.match_id = ?");
            values.push(Number(matchId));
        }

        if (teamId && isPositiveInt(teamId)) {
            conditions.push("mt.team_id = ?");
            values.push(Number(teamId));
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const [rows] = await connection.execute(
            `SELECT
                mt.id,
                mt.match_id,
                mt.team_id,
                mt.team_side,
                mt.match_fee,
                mt.payment_status,
                mt.status,
                mt.created_at,
                t.team_name,
                t.team_code,
                m.match_no,
                m.match_date,
                m.academy_id,
                m.branch_id
             FROM cst_match_teams mt
             INNER JOIN cst_teams t ON t.id = mt.team_id
             INNER JOIN cst_matches m ON m.id = mt.match_id
             ${whereClause}
             ORDER BY mt.match_id DESC, mt.team_side ASC`,
            values
        );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET match teams error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch match teams.", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
