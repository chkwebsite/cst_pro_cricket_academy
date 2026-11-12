import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

function validId(value) {
    return (
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0
    );
}

const editableFields = [
    "product_id",
    "product_name",
    "product_code",
    "quantity",
    "unit_price",
    "tax_percent",
    "discount_amount",
];

// GET: Single order item
export async function GET(request, { params }) {
    try {
        const { id } = await params;

        if (!validId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order item ID." },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `
SELECT
oi.*,
    o.order_no,
    o.order_status,
    o.payment_status,
    o.customer_name,
    p.slug AS product_slug
            FROM cst_order_items oi
            INNER JOIN cst_orders o ON o.id = oi.order_id
            LEFT JOIN cst_products p ON p.id = oi.product_id
            WHERE oi.id = ?
    LIMIT 1
        `,
            [Number(id)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Order item not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Single Order Item Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch order item." },
            { status: 500 }
        );
    }
}


// PUT: Update an order item
export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!validId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order item ID." },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            "SELECT * FROM cst_order_items WHERE id = ? FOR UPDATE",
            [Number(id)]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order item not found." },
                { status: 404 }
            );
        }

        const existing = rows[0];
        const item = { ...existing };

        for (const field of editableFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                item[field] = body[field];
            }
        }

        const qty = Number(item.quantity);
        const price = Number(item.unit_price);
        const taxPercent = Number(item.tax_percent);
        const discount = Number(item.discount_amount);

        if (
            !Number.isSafeInteger(qty) || qty <= 0 ||
            !Number.isFinite(price) || price < 0 ||
            !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100 ||
            !Number.isFinite(discount) || discount < 0 ||
            !item.product_name?.trim()
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid product name, quantity, price, tax or discount.",
                },
                { status: 400 }
            );
        }

        const productId =
            item.product_id === null || item.product_id === ""
                ? null
                : Number(item.product_id);

        if (
            productId !== null &&
            (!Number.isSafeInteger(productId) || productId <= 0)
        ) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid product_id." },
                { status: 400 }
            );
        }

        const grossAmount = Number((qty * price).toFixed(2));

        if (discount > grossAmount) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Discount exceeds item amount." },
                { status: 400 }
            );
        }

        if (productId !== null) {
            const [products] = await connection.execute(
                "SELECT id FROM cst_products WHERE id = ? AND is_deleted = 0 LIMIT 1",
                [productId]
            );

            if (products.length === 0) {
                await connection.rollback();

                return NextResponse.json(
                    { success: false, message: "Product not found." },
                    { status: 404 }
                );
            }
        }

        const taxableAmount = Number((grossAmount - discount).toFixed(2));
        const taxAmount = Number(
            (taxableAmount * taxPercent / 100).toFixed(2)
        );
        const lineTotal = Number((taxableAmount + taxAmount).toFixed(2));

        await connection.execute(
            `
            UPDATE cst_order_items
            SET product_id = ?,
    product_name = ?,
    product_code = ?,
    quantity = ?,
    unit_price = ?,
    tax_percent = ?,
    tax_amount = ?,
    discount_amount = ?,
    line_total = ?
        WHERE id = ?
            `,
            [
                productId,
                item.product_name.trim(),
                item.product_code || null,
                qty,
                price,
                taxPercent,
                taxAmount,
                discount,
                lineTotal,
                Number(id),
            ]
        );

        // Recalculate parent order totals.
        const orderId = existing.order_id;

        const [totals] = await connection.execute(
            `
            SELECT
COALESCE(SUM(quantity * unit_price), 0) AS subtotal,
    COALESCE(SUM(tax_amount), 0) AS tax_amount,
        COALESCE(SUM(discount_amount), 0) AS discount_amount
            FROM cst_order_items
            WHERE order_id = ?
    `,
            [orderId]
        );

        const [orders] = await connection.execute(
            "SELECT delivery_charge, fulfillment_branch_id, order_status FROM cst_orders WHERE id = ? FOR UPDATE",
            [orderId]
        );

        const subtotal = Number(Number(totals[0].subtotal).toFixed(2));
        const totalTax = Number(Number(totals[0].tax_amount).toFixed(2));
        const totalDiscount = Number(Number(totals[0].discount_amount).toFixed(2));
        const deliveryCharge = Number(orders[0].delivery_charge);

        const grandTotal = Number(
            (subtotal + totalTax + deliveryCharge - totalDiscount).toFixed(2)
        );

        await connection.execute(
            `
            UPDATE cst_orders
            SET subtotal = ?,
    tax_amount = ?,
    discount_amount = ?,
    grand_total = ?
        WHERE id = ?
            `,
            [
                subtotal,
                totalTax,
                totalDiscount,
                grandTotal,
                orderId,
            ]
        );

        // Update stock difference if order is not Cancelled
        if (orders[0].fulfillment_branch_id && orders[0].order_status !== "Cancelled") {
            const branchId = orders[0].fulfillment_branch_id;
            const oldPid = existing.product_id;
            const newPid = item.product_id;
            const oldQty = Number(existing.quantity);
            const newQty = Number(item.quantity);

            if (oldPid === newPid && newPid !== null) {
                const diff = newQty - oldQty;
                if (diff > 0) {
                    await connection.execute(
                        "UPDATE cst_product_stock SET quantity = GREATEST(0, CAST(quantity AS SIGNED) - ?) WHERE product_id = ? AND branch_id = ?",
                        [diff, newPid, branchId]
                    );
                } else if (diff < 0) {
                    await connection.execute(
                        "UPDATE cst_product_stock SET quantity = quantity + ? WHERE product_id = ? AND branch_id = ?",
                        [-diff, newPid, branchId]
                    );
                }
            } else {
                if (oldPid !== null) {
                    await connection.execute(
                        "UPDATE cst_product_stock SET quantity = quantity + ? WHERE product_id = ? AND branch_id = ?",
                        [oldQty, oldPid, branchId]
                    );
                }
                if (newPid !== null) {
                    await connection.execute(
                        "UPDATE cst_product_stock SET quantity = GREATEST(0, CAST(quantity AS SIGNED) - ?) WHERE product_id = ? AND branch_id = ?",
                        [newQty, newPid, branchId]
                    );
                }
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Order item updated successfully.",
            id: Number(id),
            line_total: lineTotal,
            order_totals: {
                subtotal,
                tax_amount: totalTax,
                discount_amount: totalDiscount,
                delivery_charge: deliveryCharge,
                grand_total: grandTotal,
            },
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("PUT Order Item Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update order item." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// DELETE: Delete an order item
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!validId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order item ID." },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            "SELECT * FROM cst_order_items WHERE id = ? FOR UPDATE",
            [Number(id)]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order item not found." },
                { status: 404 }
            );
        }

        const item = rows[0];

        await connection.execute(
            "DELETE FROM cst_order_items WHERE id = ?",
            [Number(id)]
        );

        const [totals] = await connection.execute(
            `
            SELECT
COALESCE(SUM(quantity * unit_price), 0) AS subtotal,
    COALESCE(SUM(tax_amount), 0) AS tax_amount,
        COALESCE(SUM(discount_amount), 0) AS discount_amount
            FROM cst_order_items
            WHERE order_id = ?
    `,
            [item.order_id]
        );

        const [orders] = await connection.execute(
            "SELECT delivery_charge, fulfillment_branch_id, order_status FROM cst_orders WHERE id = ? FOR UPDATE",
            [item.order_id]
        );

        const subtotal = Number(Number(totals[0].subtotal).toFixed(2));
        const totalTax = Number(Number(totals[0].tax_amount).toFixed(2));
        const totalDiscount = Number(Number(totals[0].discount_amount).toFixed(2));
        const deliveryCharge = Number(orders[0].delivery_charge);

        const grandTotal = Number(
            (subtotal + totalTax + deliveryCharge - totalDiscount).toFixed(2)
        );

        await connection.execute(
            `
            UPDATE cst_orders
            SET subtotal = ?,
    tax_amount = ?,
    discount_amount = ?,
    grand_total = ?
        WHERE id = ?
            `,
            [
                subtotal,
                totalTax,
                totalDiscount,
                grandTotal,
                item.order_id,
            ]
        );

        // Restore stock when order item is deleted
        if (item.product_id !== null && orders[0].fulfillment_branch_id && orders[0].order_status !== "Cancelled") {
            await connection.execute(
                "UPDATE cst_product_stock SET quantity = quantity + ? WHERE product_id = ? AND branch_id = ?",
                [Number(item.quantity), item.product_id, orders[0].fulfillment_branch_id]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Order item deleted successfully.",
            order_totals: {
                subtotal,
                tax_amount: totalTax,
                discount_amount: totalDiscount,
                delivery_charge: deliveryCharge,
                grand_total: grandTotal,
            },
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("DELETE Order Item Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete order item." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
