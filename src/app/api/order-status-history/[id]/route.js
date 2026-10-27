import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

const ORDER_STATUSES = [
    "Pending",
    "Confirmed",
    "Processing",
    "Ready",
    "Dispatched",
    "Delivered",
    "Cancelled",
    "Returned",
];

const ACTOR_TYPES = ["Public User", "Academy User", "System"];

async function getHistoryId(context) {
    const params = await context.params;
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

// GET: Single history record
export async function GET(request, context) {
    try {
        const id = await getHistoryId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid history ID" },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `SELECT
h.*,
    o.order_no,
    o.customer_name,
    o.customer_phone
       FROM cst_order_status_history h
       INNER JOIN cst_orders o ON o.id = h.order_id
       WHERE h.id = ?
    LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Order status history not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get order status history error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch order status history" },
            { status: 500 }
        );
    }
}

// PUT: Update a history record
export async function PUT(request, context) {
    const connection = await db.getConnection();

    try {
        const id = await getHistoryId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid history ID" },
                { status: 400 }
            );
        }

        const body = await request.json();

        const allowedFields = [
            "old_status",
            "new_status",
            "remarks",
            "actor_type",
            "actor_id",
        ];

        const fields = allowedFields.filter((field) =>
            Object.prototype.hasOwnProperty.call(body, field)
        );

        if (fields.length === 0) {
            return NextResponse.json(
                { success: false, message: "No valid fields provided for update" },
                { status: 400 }
            );
        }

        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            "SELECT * FROM cst_order_status_history WHERE id = ? FOR UPDATE",
            [id]
        );

        if (existingRows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order status history not found" },
                { status: 404 }
            );
        }

        const existing = existingRows[0];
        const updated = { ...existing, ...body };

        if (
            updated.old_status !== null &&
            !ORDER_STATUSES.includes(updated.old_status)
        ) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid old_status" },
                { status: 400 }
            );
        }

        if (!ORDER_STATUSES.includes(updated.new_status)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid new_status" },
                { status: 400 }
            );
        }

        if (!ACTOR_TYPES.includes(updated.actor_type)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid actor_type" },
                { status: 400 }
            );
        }

        if (
            updated.actor_id !== null &&
            (!Number.isInteger(Number(updated.actor_id)) ||
                Number(updated.actor_id) <= 0)
        ) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "actor_id must be a positive integer or null" },
                { status: 400 }
            );
        }

        const values = fields.map((field) => {
            if (field === "actor_id") {
                return updated.actor_id === null ? null : Number(updated.actor_id);
            }

            if (field === "remarks") {
                return updated.remarks || null;
            }

            return updated[field];
        });

        const setClause = fields.map((field) => `${field} = ?`).join(", ");

        await connection.execute(
            `UPDATE cst_order_status_history
       SET ${setClause}
       WHERE id = ? `,
            [...values, id]
        );

        const [updatedRows] = await connection.execute(
            "SELECT * FROM cst_order_status_history WHERE id = ?",
            [id]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Order status history updated successfully",
            data: updatedRows[0],
        });
    } catch (error) {
        await connection.rollback();
        console.error("Update order status history error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update order status history" },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// DELETE: Delete a history record
export async function DELETE(request, context) {
    let connection;

    try {
        const id = await getHistoryId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid history ID" },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            "SELECT id FROM cst_order_status_history WHERE id = ? FOR UPDATE",
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order status history not found" },
                { status: 404 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_order_status_history WHERE id = ?",
            [id]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Order status history deleted successfully",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Delete order status history error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete order status history" },
            { status: 500 }
        );
    } finally {
        connection?.release();
    }
}
