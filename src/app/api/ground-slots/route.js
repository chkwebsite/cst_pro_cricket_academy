import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const ground_id = searchParams.get("ground_id");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const slot_name = searchParams.get("slot_name");
        const start_time = searchParams.get("start_time");
        const status = searchParams.get("status");

        let sql = `
            SELECT
                gs.id,
                gs.ground_id,

                g.academy_id,
                g.branch_id,

                g.ground_name,
                g.ground_code,

                gs.slot_name,
                gs.start_time,
                gs.end_time,
                gs.price,
                gs.status,

                gs.created_at,
                gs.updated_at

            FROM cst_ground_slots gs

            INNER JOIN cst_ground g
                ON g.id = gs.ground_id

            WHERE g.is_deleted = 0
        `;

        const values = [];

        if (ground_id !== null && ground_id !== "") {
            if (!Number.isInteger(Number(ground_id)) || Number(ground_id) <= 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid ground_id"
                    },
                    { status: 400 }
                );
            }

            sql += ` AND gs.ground_id = ?`;
            values.push(Number(ground_id));
        }

        // =====================================================
        // ACADEMY FILTER
        // =====================================================

        if (academy_id !== null && academy_id !== "") {

            if (isNaN(academy_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid academy_id"
                    },
                    { status: 400 }
                );
            }

            sql += ` AND g.academy_id = ?`;
            values.push(academy_id);
        }

        // =====================================================
        // BRANCH FILTER
        // =====================================================

        if (branch_id !== null && branch_id !== "") {

            if (isNaN(branch_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid branch_id"
                    },
                    { status: 400 }
                );
            }

            sql += ` AND g.branch_id = ?`;
            values.push(branch_id);
        }

        // =====================================================
        // SLOT NAME FILTER
        // =====================================================

        if (slot_name) {
            sql += ` AND gs.slot_name LIKE ?`;
            values.push(`%${slot_name}%`);
        }

        // =====================================================
        // START TIME FILTER
        // =====================================================

        if (start_time) {
            sql += ` AND gs.start_time >= ?`;
            values.push(start_time);
        }

        // =====================================================
        // STATUS FILTER
        // =====================================================

        if (status !== null && status !== "") {

            if (!["0", "1"].includes(status)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Status must be 0 or 1"
                    },
                    { status: 400 }
                );
            }

            sql += ` AND gs.status = ?`;
            values.push(status);
        }

        // =====================================================
        // ORDER
        // =====================================================

        sql += `
            ORDER BY
                gs.start_time ASC,
                gs.id ASC
        `;

        const [rows] = await connection.query(
            sql,
            values
        );

        return NextResponse.json(
            {
                success: true,
                count: rows.length,
                data: rows
            },
            { status: 200 }
        );

    } catch (error) {

        console.error(
            "GET GROUND SLOTS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground slots",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}

export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const body = await request.json();

        const {
            academy_id,
            branch_id,
            ground_id,
            slot_name,
            start_time,
            end_time,
            price = 0,
            status = 1,
        } = body;

        // =====================================================
        // VALIDATION
        // =====================================================

        if (!academy_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy ID is required",
                },
                { status: 400 }
            );
        }

        if (!branch_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch ID is required",
                },
                { status: 400 }
            );
        }

        if (!ground_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground ID is required",
                },
                { status: 400 }
            );
        }

        if (!slot_name || !slot_name.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Slot name is required",
                },
                { status: 400 }
            );
        }

        if (!start_time) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Start time is required",
                },
                { status: 400 }
            );
        }

        if (!end_time) {
            return NextResponse.json(
                {
                    success: false,
                    message: "End time is required",
                },
                { status: 400 }
            );
        }

        if (Number(price) < 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Price cannot be negative",
                },
                { status: 400 }
            );
        }

        if (![0, 1].includes(Number(status))) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Status must be 0 or 1",
                },
                { status: 400 }
            );
        }

        // =====================================================
        // TIME VALIDATION
        // =====================================================

        if (start_time >= end_time) {
            return NextResponse.json(
                {
                    success: false,
                    message: "End time must be greater than start time",
                },
                { status: 400 }
            );
        }

        // =====================================================
        // CHECK GROUND
        // Academy + Branch + Ground must match
        // =====================================================

        const [groundRows] = await connection.query(
            `SELECT
                id,
                academy_id,
                branch_id,
                ground_name,
                ground_code
             FROM cst_ground
             WHERE id = ?
             AND academy_id = ?
             AND branch_id = ?
             AND status = 1
             AND is_deleted = 0
             LIMIT 1`,
            [
                ground_id,
                academy_id,
                branch_id,
            ]
        );

        if (groundRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground not found for this academy and branch",
                },
                { status: 404 }
            );
        }

        // =====================================================
        // CHECK DUPLICATE SLOT NAME
        // =====================================================

        const [duplicate] = await connection.query(
            `SELECT id
             FROM cst_ground_slots
             WHERE ground_id = ?
             AND slot_name = ?
             AND status = 1
             LIMIT 1`,
            [
                ground_id,
                slot_name.trim(),
            ]
        );

        if (duplicate.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Slot with this name already exists for this ground",
                },
                { status: 409 }
            );
        }

        // =====================================================
        // CHECK TIME OVERLAP
        // =====================================================

        const [overlap] = await connection.query(
            `SELECT
                id,
                slot_name,
                start_time,
                end_time
             FROM cst_ground_slots
             WHERE ground_id = ?
             AND status = 1
             AND start_time < ?
             AND end_time > ?
             LIMIT 1`,
            [
                ground_id,
                end_time,
                start_time,
            ]
        );

        if (overlap.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This time overlaps with an existing slot",
                    data: overlap[0],
                },
                { status: 409 }
            );
        }

        // =====================================================
        // INSERT
        // =====================================================

        const [result] = await connection.query(
            `INSERT INTO cst_ground_slots
            (
                ground_id,
                slot_name,
                start_time,
                end_time,
                price,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                ground_id,
                slot_name.trim(),
                start_time,
                end_time,
                price,
                status,
            ]
        );

        // =====================================================
        // GET CREATED RECORD
        // =====================================================

        const [rows] = await connection.query(
            `SELECT
                gs.id,
                gs.ground_id,
                g.academy_id,
                g.branch_id,
                g.ground_name,
                g.ground_code,
                gs.slot_name,
                gs.start_time,
                gs.end_time,
                gs.price,
                gs.status,
                gs.created_at,
                gs.updated_at
             FROM cst_ground_slots gs
             INNER JOIN cst_ground g
                ON g.id = gs.ground_id
             WHERE gs.id = ?
             LIMIT 1`,
            [result.insertId]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Ground slot created successfully",
                data: rows[0],
            },
            { status: 201 }
        );

    } catch (error) {

        console.error(
            "CREATE GROUND SLOT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create ground slot",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}