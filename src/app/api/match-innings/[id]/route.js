import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// GET: Get single innings
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
mi.*,
    m.match_date,
    m.match_type,
    bt.team_name AS batting_team_name,
        bw.team_name AS bowling_team_name
             FROM cst_match_innings mi
             INNER JOIN cst_matches m
                ON m.id = mi.match_id
             INNER JOIN cst_teams bt
                ON bt.id = mi.batting_team_id
             INNER JOIN cst_teams bw
                ON bw.id = mi.bowling_team_id
             WHERE mi.id = ?
    LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match innings not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Single Match Innings Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch match innings" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update innings
export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "innings_no",
            "batting_team_id",
            "bowling_team_id",
            "total_runs",
            "total_wickets",
            "total_overs",
            "total_balls",
            "extras",
            "wides",
            "no_balls",
            "byes",
            "leg_byes",
            "penalty_runs",
            "target_runs",
            "innings_status",
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                updates.push(`${field} = ?`);
                values.push(body[field]);
            }
        }

        if (updates.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No valid fields provided for update",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Check existing innings
        const [existingRows] = await connection.execute(
            "SELECT * FROM cst_match_innings WHERE id = ?",
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match innings not found" },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        // Validate combined values, including fields not supplied in PUT
        const updated = { ...existing, ...body };

        if (
            Number(updated.batting_team_id) ===
            Number(updated.bowling_team_id)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Batting team and bowling team must be different",
                },
                { status: 400 }
            );
        }

        const validStatuses = [
            "Not Started",
            "In Progress",
            "Completed",
        ];

        if (!validStatuses.includes(updated.innings_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid innings_status" },
                { status: 400 }
            );
        }

        const numericFields = [
            "innings_no",
            "batting_team_id",
            "bowling_team_id",
            "total_runs",
            "total_wickets",
            "total_overs",
            "total_balls",
            "extras",
            "wides",
            "no_balls",
            "byes",
            "leg_byes",
            "penalty_runs",
        ];

        for (const field of numericFields) {
            if (
                !Number.isFinite(Number(updated[field])) ||
                Number(updated[field]) < 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${field} must be a non - negative number`,
                    },
                    { status: 400 }
                );
            }
        }

        if (
            !Number.isInteger(Number(updated.innings_no)) ||
            Number(updated.innings_no) < 1 ||
            Number(updated.innings_no) > 255
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "innings_no must be between 1 and 255",
                },
                { status: 400 }
            );
        }

        if (
            updated.target_runs !== null &&
            (!Number.isInteger(Number(updated.target_runs)) ||
                Number(updated.target_runs) < 0)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "target_runs must be null or a non-negative integer",
                },
                { status: 400 }
            );
        }

        // If team changed, validate that both teams exist and belong to match
        const [matchTeams] = await connection.execute(
            `SELECT team_id
             FROM cst_match_teams
             WHERE match_id = ?
    AND team_id IN(?, ?)`,
            [
                existing.match_id,
                updated.batting_team_id,
                updated.bowling_team_id,
            ]
        );

        if (matchTeams.length !== 2) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Both teams must be registered for this match",
                },
                { status: 400 }
            );
        }

        values.push(id);

        await connection.execute(
            `UPDATE cst_match_innings
             SET ${updates.join(", ")}
             WHERE id = ? `,
            values
        );

        return NextResponse.json({
            success: true,
            message: "Match innings updated successfully",
        });
    } catch (error) {
        console.error("PUT Match Innings Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This innings number already exists for this match",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid team reference",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update match innings" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Delete innings
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            "SELECT id FROM cst_match_innings WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Match innings not found" },
                { status: 404 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_match_innings WHERE id = ?",
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Match innings deleted successfully",
        });
    } catch (error) {
        console.error("DELETE Match Innings Error:", error);

        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Cannot delete innings because scorecard or ball records are linked to it",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to delete match innings" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}