import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// =====================================================
// UPDATE GROUND SLOT
// PUT /api/ground-slots/1
// =====================================================
export async function PUT(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid slot ID is required",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const {
            academy_id,
            branch_id,
            ground_id,
            slot_name,
            start_time,
            end_time,
            price,
            status,
        } = body;

        // =================================================
        // VALIDATION
        // =================================================

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

        // =================================================
        // TIME VALIDATION
        // =================================================

        if (start_time >= end_time) {
            return NextResponse.json(
                {
                    success: false,
                    message: "End time must be greater than start time",
                },
                { status: 400 }
            );
        }

        // =================================================
        // CHECK EXISTING SLOT
        // =================================================

        const [slotRows] = await connection.query(
            `SELECT
                id,
                ground_id,
                slot_name,
                start_time,
                end_time,
                price,
                status
             FROM cst_ground_slots
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (slotRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground slot not found",
                },
                { status: 404 }
            );
        }

        // =================================================
        // CHECK GROUND OWNERSHIP
        // =================================================

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

        // =================================================
        // CHECK SLOT BELONGS TO THIS GROUND
        // =================================================

        if (
            Number(slotRows[0].ground_id) !==
            Number(ground_id)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This slot does not belong to the selected ground",
                },
                { status: 403 }
            );
        }

        // =================================================
        // CHECK DUPLICATE SLOT NAME
        // =================================================

        const [duplicate] = await connection.query(
            `SELECT id
             FROM cst_ground_slots
             WHERE ground_id = ?
             AND slot_name = ?
             AND id != ?
             AND status = 1
             LIMIT 1`,
            [
                ground_id,
                slot_name.trim(),
                id,
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

        // =================================================
        // CHECK TIME OVERLAP
        // =================================================

        const [overlap] = await connection.query(
            `SELECT
                id,
                slot_name,
                start_time,
                end_time
             FROM cst_ground_slots
             WHERE ground_id = ?
             AND id != ?
             AND status = 1
             AND start_time < ?
             AND end_time > ?
             LIMIT 1`,
            [
                ground_id,
                id,
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

        // =================================================
        // UPDATE
        // =================================================

        await connection.query(
            `UPDATE cst_ground_slots
             SET
                ground_id = ?,
                slot_name = ?,
                start_time = ?,
                end_time = ?,
                price = ?,
                status = ?
             WHERE id = ?`,
            [
                ground_id,
                slot_name.trim(),
                start_time,
                end_time,
                price,
                status,
                id,
            ]
        );

        // =================================================
        // GET UPDATED RECORD
        // =================================================

        const [updatedRows] = await connection.query(
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
            [id]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Ground slot updated successfully",
                data: updatedRows[0],
            },
            { status: 200 }
        );

    } catch (error) {
        console.error(
            "UPDATE GROUND SLOT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update ground slot",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// DELETE GROUND SLOT
// DELETE /api/ground-slots/1
// =====================================================
export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid slot ID is required",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const {
            academy_id,
            branch_id,
        } = body;

        // =================================================
        // VALIDATION
        // =================================================

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

        // =================================================
        // GET SLOT + GROUND
        // =================================================

        const [rows] = await connection.query(
            `SELECT
                gs.id,
                gs.ground_id,
                g.academy_id,
                g.branch_id,
                gs.status
             FROM cst_ground_slots gs
             INNER JOIN cst_ground g
                ON g.id = gs.ground_id
             WHERE gs.id = ?
             AND g.academy_id = ?
             AND g.branch_id = ?
             AND g.is_deleted = 0
             LIMIT 1`,
            [
                id,
                academy_id,
                branch_id,
            ]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground slot not found or access denied",
                },
                { status: 404 }
            );
        }

        // =================================================
        // SOFT DELETE
        // =================================================

        await connection.query(
            `UPDATE cst_ground_slots
             SET status = 0
             WHERE id = ?`,
            [id]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Ground slot deleted successfully",
            },
            { status: 200 }
        );

    } catch (error) {
        console.error(
            "DELETE GROUND SLOT ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete ground slot",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}