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

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const conditions = [];
        const values = [];

        const filters = [
            ["order_id", "h.order_id", "number"],
            ["actor_id", "h.actor_id", "number"],
            ["old_status", "h.old_status", "string"],
            ["new_status", "h.new_status", "string"],
            ["actor_type", "h.actor_type", "string"],
        ];

        for (const [key, column, type] of filters) {
            const value = searchParams.get(key);

            if (value !== null && value.trim() !== "") {
                if (type === "number") {
                    const number = Number(value);

                    if (!Number.isInteger(number) || number <= 0) {
                        return NextResponse.json(
                            { success: false, message: `Invalid ${key} ` },
                            { status: 400 }
                        );
                    }

                    conditions.push(`${column} = ?`);
                    values.push(number);
                } else {
                    conditions.push(`${column} = ?`);
                    values.push(value.trim());
                }
            }
        }

        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");
        const search = searchParams.get("search")?.trim();

        if (start_date) {
            conditions.push("h.created_at >= ?");
            values.push(`${start_date} 00:00:00`);
        }

        if (end_date) {
            conditions.push("h.created_at <= ?");
            values.push(`${end_date} 23:59:59`);
        }

        if (search) {
            conditions.push(`(
    h.remarks LIKE ?
    OR h.old_status LIKE ?
    OR h.new_status LIKE ?
    OR o.order_no LIKE ?
    OR o.customer_name LIKE ?
    OR o.customer_phone LIKE ?
      )`);

            const term = `%${search}%`;
            values.push(term, term, term, term, term, term);
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [rows] = await db.execute(
            `SELECT
h.*,
    o.order_no,
    o.customer_name,
    o.customer_phone
       FROM cst_order_status_history h
       INNER JOIN cst_orders o ON o.id = h.order_id
       ${where}
       ORDER BY h.created_at DESC, h.id DESC`,
            values
        );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("Get order status history error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch order status history" },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    const connection = await db.getConnection();

    try {
        const body = await request.json();

        const {
            order_id,
            old_status = null,
            new_status,
            remarks = null,
            actor_type = "System",
            actor_id = null,
        } = body;

        if (!Number.isInteger(Number(order_id)) || Number(order_id) <= 0) {
            return NextResponse.json(
                { success: false, message: "Valid order_id is required" },
                { status: 400 }
            );
        }

        if (!ORDER_STATUSES.includes(new_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid new_status" },
                { status: 400 }
            );
        }

        if (old_status !== null && !ORDER_STATUSES.includes(old_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid old_status" },
                { status: 400 }
            );
        }

        if (!ACTOR_TYPES.includes(actor_type)) {
            return NextResponse.json(
                { success: false, message: "Invalid actor_type" },
                { status: 400 }
            );
        }

        if (
            actor_id !== null &&
            (!Number.isInteger(Number(actor_id)) || Number(actor_id) <= 0)
        ) {
            return NextResponse.json(
                { success: false, message: "actor_id must be a positive integer or null" },
                { status: 400 }
            );
        }

        await connection.beginTransaction();

        const [orders] = await connection.execute(
            "SELECT id FROM cst_orders WHERE id = ? FOR UPDATE",
            [Number(order_id)]
        );

        if (orders.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_order_status_history
    (order_id, old_status, new_status, remarks, actor_type, actor_id)
VALUES(?, ?, ?, ?, ?, ?)`,
            [
                Number(order_id),
                old_status,
                new_status,
                remarks || null,
                actor_type,
                actor_id === null ? null : Number(actor_id),
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Order status history created successfully",
                data: {
                    id: result.insertId,
                    order_id: Number(order_id),
                    old_status,
                    new_status,
                    remarks: remarks || null,
                    actor_type,
                    actor_id: actor_id === null ? null : Number(actor_id),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        await connection.rollback();
        console.error("Create order status history error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to create order status history" },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}