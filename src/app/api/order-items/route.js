import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

// GET: All order items with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const order_id = searchParams.get("order_id");
        const product_id = searchParams.get("product_id");
        const product_code = searchParams.get("product_code");
        const search = searchParams.get("search");

        const min_quantity = searchParams.get("min_quantity");
        const max_quantity = searchParams.get("max_quantity");
        const min_total = searchParams.get("min_total");
        const max_total = searchParams.get("max_total");

        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");

        let sql = `
SELECT
oi.*,
    o.order_no,
    o.order_status,
    o.payment_status,
    o.customer_name,
    o.customer_phone,
    p.slug AS product_slug
            FROM cst_order_items oi
            INNER JOIN cst_orders o
                ON o.id = oi.order_id
            LEFT JOIN cst_products p
                ON p.id = oi.product_id
            WHERE 1 = 1
    `;

        const values = [];

        if (order_id !== null) {
            sql += " AND oi.order_id = ?";
            values.push(order_id);
        }

        if (product_id !== null) {
            sql += " AND oi.product_id = ?";
            values.push(product_id);
        }

        if (product_code) {
            sql += " AND oi.product_code LIKE ?";
            values.push(`%${product_code}%`);
        }

        if (search) {
            sql += `
AND(
    oi.product_name LIKE ?
    OR oi.product_code LIKE ?
    OR o.order_no LIKE ?
    OR o.customer_name LIKE ?
    OR o.customer_phone LIKE ?
)
    `;

            const keyword = `%${search}%`;
            values.push(keyword, keyword, keyword, keyword, keyword);
        }

        if (min_quantity !== null && min_quantity !== "") {
            sql += " AND oi.quantity >= ?";
            values.push(min_quantity);
        }

        if (max_quantity !== null && max_quantity !== "") {
            sql += " AND oi.quantity <= ?";
            values.push(max_quantity);
        }

        if (min_total !== null && min_total !== "") {
            sql += " AND oi.line_total >= ?";
            values.push(min_total);
        }

        if (max_total !== null && max_total !== "") {
            sql += " AND oi.line_total <= ?";
            values.push(max_total);
        }

        if (start_date) {
            sql += " AND oi.created_at >= ?";
            values.push(`${ start_date } 00:00:00`);
        }

        if (end_date) {
            sql += " AND oi.created_at < DATE_ADD(?, INTERVAL 1 DAY)";
            values.push(end_date);
        }

        sql += " ORDER BY oi.id DESC";

        const [items] = await db.execute(sql, values);

        return NextResponse.json({
            success: true,
            total: items.length,
            data: items,
        });
    } catch (error) {
        console.error("GET Order Items Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch order items.",
            },
            { status: 500 }
        );
    }
}


// POST: Create an order item
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            order_id,
            product_id = null,
            product_name,
            product_code = null,
            quantity,
            unit_price,
            tax_percent = 0,
            discount_amount = 0,
        } = body;

        // Required fields
        if (
            !Number.isSafeInteger(Number(order_id)) ||
            Number(order_id) <= 0 ||
            !product_name?.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid order_id and product_name are required.",
                },
                { status: 400 }
            );
        }

        // Numeric validation
        const qty = Number(quantity);
        const price = Number(unit_price);
        const taxPercent = Number(tax_percent);
        const discount = Number(discount_amount);

        if (!Number.isSafeInteger(qty) || qty <= 0) {
            return NextResponse.json(
                { success: false, message: "quantity must be a positive integer." },
                { status: 400 }
            );
        }

        if (
            !Number.isFinite(price) || price < 0 ||
            !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100 ||
            !Number.isFinite(discount) || discount < 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid unit_price, tax_percent, or discount_amount.",
                },
                { status: 400 }
            );
        }

        if (
            product_id !== null &&
            product_id !== "" &&
            (!Number.isSafeInteger(Number(product_id)) || Number(product_id) <= 0)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid product_id." },
                { status: 400 }
            );
        }

        const productId = product_id === null || product_id === ""
            ? null
            : Number(product_id);

        const grossAmount = Number((qty * price).toFixed(2));

        if (discount > grossAmount) {
            return NextResponse.json(
                {
                    success: false,
                    message: "discount_amount cannot exceed quantity multiplied by unit_price.",
                },
                { status: 400 }
            );
        }

        // Tax is calculated after discount.
        const taxableAmount = Number((grossAmount - discount).toFixed(2));
        const taxAmount = Number(
            (taxableAmount * taxPercent / 100).toFixed(2)
        );
        const lineTotal = Number((taxableAmount + taxAmount).toFixed(2));

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Lock order and verify it exists.
        const [orders] = await connection.execute(
            "SELECT id, fulfillment_branch_id, order_status FROM cst_orders WHERE id = ? FOR UPDATE",
            [Number(order_id)]
        );

        if (orders.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        // Verify product if product_id was supplied.
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

        const [result] = await connection.execute(
            `
            INSERT INTO cst_order_items(
        order_id,
        product_id,
        product_name,
        product_code,
        quantity,
        unit_price,
        tax_percent,
        tax_amount,
        discount_amount,
        line_total
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            [
                Number(order_id),
                productId,
                product_name.trim(),
                product_code || null,
                qty,
                price,
                taxPercent,
                taxAmount,
                discount,
                lineTotal,
            ]
        );

        // Deduct inventory from cst_product_stock when product is sold
        if (productId !== null && orders[0].fulfillment_branch_id && orders[0].order_status !== "Cancelled") {
            const branchId = orders[0].fulfillment_branch_id;
            const [stockRows] = await connection.execute(
                "SELECT id, quantity FROM cst_product_stock WHERE product_id = ? AND branch_id = ? LIMIT 1 FOR UPDATE",
                [productId, branchId]
            );

            if (stockRows.length > 0) {
                await connection.execute(
                    "UPDATE cst_product_stock SET quantity = GREATEST(0, CAST(quantity AS SIGNED) - ?) WHERE id = ?",
                    [qty, stockRows[0].id]
                );
            } else {
                await connection.execute(
                    "INSERT INTO cst_product_stock (product_id, branch_id, quantity, reserved_quantity, low_stock_alert) VALUES (?, ?, 0, 0, 5)",
                    [productId, branchId]
                );
            }
        }

        // Recalculate order totals from all its items.
        const [totals] = await connection.execute(
            `
SELECT
COALESCE(SUM(quantity * unit_price), 0) AS subtotal,
    COALESCE(SUM(tax_amount), 0) AS tax_amount,
        COALESCE(SUM(discount_amount), 0) AS discount_amount
            FROM cst_order_items
            WHERE order_id = ?
    `,
            [Number(order_id)]
        );

        // Preserve the order's existing delivery charge.
        const [orderRows] = await connection.execute(
            "SELECT delivery_charge FROM cst_orders WHERE id = ?",
            [Number(order_id)]
        );

        const subtotal = Number(Number(totals[0].subtotal).toFixed(2));
        const taxAmountTotal = Number(Number(totals[0].tax_amount).toFixed(2));
        const discountTotal = Number(Number(totals[0].discount_amount).toFixed(2));
        const deliveryCharge = Number(orderRows[0].delivery_charge);

        const grandTotal = Number(
            (subtotal + taxAmountTotal + deliveryCharge - discountTotal).toFixed(2)
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
                taxAmountTotal,
                discountTotal,
                grandTotal,
                Number(order_id),
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Order item created successfully.",
                id: result.insertId,
                data: {
                    order_id: Number(order_id),
                    product_id: productId,
                    quantity: qty,
                    unit_price: price,
                    tax_amount: taxAmount,
                    discount_amount: discount,
                    line_total: lineTotal,
                },
                order_totals: {
                    subtotal,
                    tax_amount: taxAmountTotal,
                    discount_amount: discountTotal,
                    delivery_charge: deliveryCharge,
                    grand_total: grandTotal,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST Order Item Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create order item.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
