import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

export const runtime = "nodejs";

async function getStockId(context) {
    const params = await context.params;
    const id = Number(params.id);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function isValidQuantity(value) {
    return Number.isInteger(value) &&
        value >= 0 &&
        value <= 4294967295;
}

// GET: Single stock record
export async function GET(request, context) {
    try {
        const id = await getStockId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid stock ID." },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `SELECT
s.id,
    s.product_id,
    s.branch_id,
    s.quantity,
    s.reserved_quantity,
    (s.quantity - s.reserved_quantity) AS available_quantity,
        s.low_stock_alert,
        CASE
                    WHEN s.quantity = 0 THEN 'Out of Stock'
WHEN(s.quantity - s.reserved_quantity) <= s.low_stock_alert
                        THEN 'Low Stock'
                    ELSE 'In Stock'
                END AS stock_status,
    s.updated_at,
    p.product_name,
    p.product_code,
    p.academy_id,
    p.category_id,
    b.branch_name
             FROM cst_product_stock s
             INNER JOIN cst_products p ON p.id = s.product_id
             INNER JOIN cst_branch b ON b.id = s.branch_id
             WHERE s.id = ? AND p.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Stock record not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get single stock error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch stock record." },
            { status: 500 }
        );
    }
}

// PUT: Update stock quantities and low-stock threshold
export async function PUT(request, context) {
    let connection;

    try {
        const id = await getStockId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid stock ID." },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT *
    FROM cst_product_stock
             WHERE id = ?
    LIMIT 1
             FOR UPDATE`,
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Stock record not found." },
                { status: 404 }
            );
        }

        const existing = rows[0];

        const quantity =
            body.quantity === undefined
                ? existing.quantity
                : Number(body.quantity);

        const reservedQuantity =
            body.reserved_quantity === undefined
                ? existing.reserved_quantity
                : Number(body.reserved_quantity);

        const lowStockAlert =
            body.low_stock_alert === undefined
                ? existing.low_stock_alert
                : Number(body.low_stock_alert);

        if (
            !isValidQuantity(quantity) ||
            !isValidQuantity(reservedQuantity) ||
            !isValidQuantity(lowStockAlert)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Quantities must be valid unsigned integers.",
                },
                { status: 400 }
            );
        }

        if (reservedQuantity > quantity) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Reserved quantity cannot exceed total quantity.",
                },
                { status: 400 }
            );
        }

        await connection.execute(
            `UPDATE cst_product_stock
SET
quantity = ?,
    reserved_quantity = ?,
    low_stock_alert = ?
        WHERE id = ? `,
            [quantity, reservedQuantity, lowStockAlert, id]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Product stock updated successfully.",
            data: {
                id,
                product_id: existing.product_id,
                branch_id: existing.branch_id,
                quantity,
                reserved_quantity: reservedQuantity,
                available_quantity: quantity - reservedQuantity,
                low_stock_alert: lowStockAlert,
            },
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Update product stock error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update product stock." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Remove stock record only if no quantity is reserved
export async function DELETE(request, context) {
    let connection;

    try {
        const id = await getStockId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid stock ID." },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT id, reserved_quantity
             FROM cst_product_stock
             WHERE id = ?
    LIMIT 1
             FOR UPDATE`,
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Stock record not found." },
                { status: 404 }
            );
        }

        if (Number(rows[0].reserved_quantity) > 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Cannot delete stock while quantity is reserved.",
                },
                { status: 409 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_product_stock WHERE id = ?",
            [id]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Product stock deleted successfully.",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Delete product stock error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete product stock." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}