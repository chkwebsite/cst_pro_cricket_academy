import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

const VALID_FULFILLMENT_TYPES = ["Delivery", "Pickup"];

const VALID_PAYMENT_METHODS = [
    "Cash",
    "UPI",
    "Card",
    "Bank Transfer",
    "COD",
];

const VALID_PAYMENT_STATUSES = [
    "Pending",
    "Partial",
    "Paid",
    "Failed",
    "Refunded",
];

const VALID_ORDER_STATUSES = [
    "Pending",
    "Confirmed",
    "Processing",
    "Ready",
    "Dispatched",
    "Delivered",
    "Cancelled",
    "Returned",
];

const ORDER_FIELDS = [
    "academy_id",
    "customer_user_id",
    "public_user_id",
    "fulfillment_branch_id",
    "fulfillment_type",
    "customer_name",
    "customer_phone",
    "customer_email",
    "delivery_address",
    "delivery_city",
    "delivery_state",
    "delivery_pincode",
    "subtotal",
    "tax_amount",
    "delivery_charge",
    "discount_amount",
    "payment_method",
    "payment_status",
    "order_status",
    "notes",
    "estimated_delivery_date",
];

const AMOUNT_FIELDS = [
    "subtotal",
    "tax_amount",
    "delivery_charge",
    "discount_amount",
];

function isPositiveId(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0
    );
}

function normalizeNullableId(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return Number(value);
}

function validateAmount(value, field) {
    const amount = Number(value);

    if (
        value === null ||
        value === "" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        !/^\d+(\.\d{1,2})?$/.test(String(value))
    ) {
        return `${field} must be a non - negative amount with up to 2 decimal places.`;
    }

    return null;
}

function validateOrder(body) {
    if (
        !isPositiveId(body.fulfillment_branch_id) ||
        !body.customer_name?.trim() ||
        !body.customer_phone?.trim()
    ) {
        return "fulfillment_branch_id, customer_name and customer_phone are required.";
    }

    const customerId = normalizeNullableId(body.customer_user_id);
    const publicId = normalizeNullableId(body.public_user_id);

    if (
        (customerId === null && publicId === null) ||
        (customerId !== null && publicId !== null)
    ) {
        return "Provide either customer_user_id or public_user_id, not both.";
    }

    if (
        (customerId !== null && !isPositiveId(customerId)) ||
        (publicId !== null && !isPositiveId(publicId))
    ) {
        return "Customer IDs must be positive integers.";
    }

    if (
        body.academy_id !== null &&
        body.academy_id !== undefined &&
        body.academy_id !== "" &&
        !isPositiveId(body.academy_id)
    ) {
        return "academy_id must be a positive integer or null.";
    }

    if (!VALID_FULFILLMENT_TYPES.includes(body.fulfillment_type)) {
        return "Invalid fulfillment_type.";
    }

    if (
        body.fulfillment_type === "Delivery" &&
        !body.delivery_address?.trim()
    ) {
        return "delivery_address is required for Delivery orders.";
    }

    if (!VALID_PAYMENT_METHODS.includes(body.payment_method)) {
        return "Invalid payment_method.";
    }

    if (!VALID_PAYMENT_STATUSES.includes(body.payment_status)) {
        return "Invalid payment_status.";
    }

    if (!VALID_ORDER_STATUSES.includes(body.order_status)) {
        return "Invalid order_status.";
    }

    for (const field of AMOUNT_FIELDS) {
        const error = validateAmount(body[field], field);
        if (error) return error;
    }

    const subtotal = Number(body.subtotal);
    const taxAmount = Number(body.tax_amount);
    const deliveryCharge = Number(body.delivery_charge);
    const discountAmount = Number(body.discount_amount);

    if (
        discountAmount >
        subtotal + taxAmount + deliveryCharge
    ) {
        return "Discount cannot exceed the order amount.";
    }

    return null;
}


// GET: Get a single order
export async function GET(request, context) {
    try {
        const { id } = await context.params;

        if (!isPositiveId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order ID." },
                { status: 400 }
            );
        }

        const [orders] = await db.execute(
            `
SELECT
o.*,
    COALESCE(a.academy_name, ba.academy_name) AS academy_name,
    b.branch_name,
    COALESCE(o.estimated_delivery_date, DATE(DATE_ADD(o.created_at, INTERVAL (CASE WHEN o.fulfillment_type = 'Pickup' THEN 2 ELSE 12 END) DAY))) AS estimated_delivery_date
            FROM cst_orders o
            LEFT JOIN cst_academy a
                ON a.id = o.academy_id
            LEFT JOIN cst_branch b
                ON b.id = o.fulfillment_branch_id
            LEFT JOIN cst_academy ba
                ON ba.id = b.academy_id
            WHERE o.id = ?
    LIMIT 1
            `,
            [Number(id)]
        );

        if (orders.length === 0) {
            return NextResponse.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: orders[0],
        });
    } catch (error) {
        console.error("GET Single Order Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch order." },
            { status: 500 }
        );
    }
}


// PUT: Update an order
export async function PUT(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order ID." },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existingOrders] = await connection.execute(
            "SELECT * FROM cst_orders WHERE id = ? FOR UPDATE",
            [Number(id)]
        );

        if (existingOrders.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        const existing = existingOrders[0];

        // Merge supplied fields with the existing order.
        // Omitted fields retain their previous values.
        const updated = { ...existing };

        for (const field of ORDER_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                updated[field] = body[field];
            }
        }

        // Normalize nullable customer IDs.
        updated.customer_user_id = normalizeNullableId(
            updated.customer_user_id
        );
        updated.public_user_id = normalizeNullableId(
            updated.public_user_id
        );
        updated.academy_id = normalizeNullableId(updated.academy_id);

        // Validate the final order state.
        const validationError = validateOrder(updated);

        if (validationError) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: validationError },
                { status: 400 }
            );
        }

        const subtotal = Number(updated.subtotal);
        const taxAmount = Number(updated.tax_amount);
        const deliveryCharge = Number(updated.delivery_charge);
        const discountAmount = Number(updated.discount_amount);

        const grandTotal = Number(
            (
                subtotal +
                taxAmount +
                deliveryCharge -
                discountAmount
            ).toFixed(2)
        );

        if (!updated.estimated_delivery_date || (body.fulfillment_type && body.fulfillment_type !== existing.fulfillment_type && !body.estimated_delivery_date)) {
            const addDays = updated.fulfillment_type === "Pickup" ? 2 : 12;
            const targetDate = new Date(existing.created_at || Date.now());
            targetDate.setDate(targetDate.getDate() + addDays);
            const yyyy = targetDate.getFullYear();
            const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
            const dd = String(targetDate.getDate()).padStart(2, "0");
            updated.estimated_delivery_date = `${yyyy}-${mm}-${dd}`;
        }

        const setParts = [];
        const values = [];

        for (const field of ORDER_FIELDS) {
            if (field === "subtotal" ||
                field === "tax_amount" ||
                field === "delivery_charge" ||
                field === "discount_amount") {
                updated[field] = Number(updated[field]);
            }

            setParts.push(`${field} = ?`);
            values.push(updated[field] ?? null);
        }

        setParts.push("grand_total = ?");
        values.push(grandTotal);

        // Automatically record status timestamps and manage inventory.
        if (
            updated.order_status === "Cancelled" &&
            existing.order_status !== "Cancelled"
        ) {
            setParts.push("cancelled_at = CURRENT_TIMESTAMP");

            // Restore product stock when order is cancelled
            const [orderItems] = await connection.execute(
                "SELECT product_id, quantity FROM cst_order_items WHERE order_id = ? AND product_id IS NOT NULL",
                [Number(id)]
            );
            const branchId = existing.fulfillment_branch_id;
            for (const it of orderItems) {
                await connection.execute(
                    "UPDATE cst_product_stock SET quantity = quantity + ? WHERE product_id = ? AND branch_id = ?",
                    [Number(it.quantity), it.product_id, branchId]
                );
            }
        } else if (
            updated.order_status !== "Cancelled" &&
            existing.order_status === "Cancelled" &&
            Object.prototype.hasOwnProperty.call(body, "order_status")
        ) {
            setParts.push("cancelled_at = NULL");

            // Re-deduct product stock when uncancelled
            const [orderItems] = await connection.execute(
                "SELECT product_id, quantity FROM cst_order_items WHERE order_id = ? AND product_id IS NOT NULL",
                [Number(id)]
            );
            const branchId = updated.fulfillment_branch_id || existing.fulfillment_branch_id;
            for (const it of orderItems) {
                await connection.execute(
                    "UPDATE cst_product_stock SET quantity = GREATEST(0, CAST(quantity AS SIGNED) - ?) WHERE product_id = ? AND branch_id = ?",
                    [Number(it.quantity), it.product_id, branchId]
                );
            }
        }

        if (
            updated.order_status === "Delivered" &&
            existing.order_status !== "Delivered"
        ) {
            setParts.push("delivered_at = CURRENT_TIMESTAMP");
        } else if (
            updated.order_status !== "Delivered" &&
            Object.prototype.hasOwnProperty.call(body, "order_status")
        ) {
            setParts.push("delivered_at = NULL");
        }

        values.push(Number(id));

        await connection.execute(
            `UPDATE cst_orders SET ${setParts.join(", ")} WHERE id = ? `,
            values
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Order updated successfully.",
            id: Number(id),
            grand_total: grandTotal,
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("PUT Order Error:", error);

        if (
            error.code === "ER_NO_REFERENCED_ROW_2" ||
            error.code === "ER_NO_REFERENCED_ROW"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid academy, branch, or customer ID. Verify the related records.",
                },
                { status: 400 }
            );
        }

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                { success: false, message: "Duplicate order number." },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update order." },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}


// DELETE: Delete an order
export async function DELETE(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order ID." },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [orders] = await connection.execute(
            "SELECT id, order_no FROM cst_orders WHERE id = ? FOR UPDATE",
            [Number(id)]
        );

        if (orders.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_orders WHERE id = ?",
            [Number(id)]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Order deleted successfully.",
            data: orders[0],
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("DELETE Order Error:", error);

        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This order cannot be deleted because related records exist.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to delete order." },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}