import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";
import crypto from "crypto";

// GET: All orders with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const fulfillment_branch_id = searchParams.get("fulfillment_branch_id");
        const customer_user_id = searchParams.get("customer_user_id");
        const public_user_id = searchParams.get("public_user_id");

        const fulfillment_type = searchParams.get("fulfillment_type");
        const order_status = searchParams.get("order_status");
        const payment_status = searchParams.get("payment_status");
        const payment_method = searchParams.get("payment_method");

        const order_no = searchParams.get("order_no");
        const search = searchParams.get("search");

        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");

        const min_total = searchParams.get("min_total");
        const max_total = searchParams.get("max_total");

        let sql = `
SELECT
    o.*,
    COALESCE(a.academy_name, ba.academy_name) AS academy_name,
    b.branch_name,
    COALESCE(o.estimated_delivery_date, DATE(DATE_ADD(o.created_at, INTERVAL (CASE WHEN o.fulfillment_type = 'Pickup' THEN 2 ELSE 12 END) DAY))) AS estimated_delivery_date,
    (SELECT COUNT(*) FROM cst_order_items oi WHERE oi.order_id = o.id) AS item_count,
    (SELECT GROUP_CONCAT(oi.product_name SEPARATOR ', ') FROM cst_order_items oi WHERE oi.order_id = o.id) AS item_summary
            FROM cst_orders o
            LEFT JOIN cst_academy a
                ON a.id = o.academy_id
            LEFT JOIN cst_branch b
                ON b.id = o.fulfillment_branch_id
            LEFT JOIN cst_academy ba
                ON ba.id = b.academy_id
            WHERE 1 = 1
    `;

        const values = [];

        // ID filters
        if (academy_id !== null && academy_id !== "" && academy_id !== undefined) {
            sql += " AND o.academy_id = ?";
            values.push(academy_id);
        }

        if (fulfillment_branch_id !== null && fulfillment_branch_id !== "" && fulfillment_branch_id !== undefined) {
            sql += " AND o.fulfillment_branch_id = ?";
            values.push(fulfillment_branch_id);
        }

        if (customer_user_id !== null && customer_user_id !== "" && customer_user_id !== undefined) {
            sql += " AND o.customer_user_id = ?";
            values.push(customer_user_id);
        }

        if (public_user_id !== null && public_user_id !== "" && public_user_id !== undefined) {
            sql += " AND o.public_user_id = ?";
            values.push(public_user_id);
        }

        // Enum filters
        if (fulfillment_type) {
            sql += " AND o.fulfillment_type = ?";
            values.push(fulfillment_type);
        }

        if (order_status) {
            sql += " AND o.order_status = ?";
            values.push(order_status);
        }

        if (payment_status) {
            sql += " AND o.payment_status = ?";
            values.push(payment_status);
        }

        if (payment_method) {
            sql += " AND o.payment_method = ?";
            values.push(payment_method);
        }

        // Order number
        if (order_no) {
            sql += " AND o.order_no LIKE ?";
            values.push(`%${order_no}%`);
        }

        // Search order number, customer name, phone and email
        if (search) {
            sql += `
AND(
    o.order_no LIKE ?
    OR o.customer_name LIKE ?
    OR o.customer_phone LIKE ?
    OR o.customer_email LIKE ?
)
    `;

            const keyword = `%${search}%`;

            values.push(keyword, keyword, keyword, keyword);
        }

        // Date filters
        if (start_date) {
            sql += " AND o.created_at >= ?";
            values.push(`${start_date} 00:00:00`);
        }

        if (end_date) {
            sql += " AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)";
            values.push(end_date);
        }

        // Grand total filters
        if (min_total !== null && min_total !== "") {
            sql += " AND o.grand_total >= ?";
            values.push(min_total);
        }

        if (max_total !== null && max_total !== "") {
            sql += " AND o.grand_total <= ?";
            values.push(max_total);
        }

        sql += " ORDER BY o.created_at DESC";

        const [orders] = await db.query(sql, values);

        return NextResponse.json({
            success: true,
            total: orders.length,
            data: orders,
        });
    } catch (error) {
        console.error("GET Orders Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch orders",
            },
            { status: 500 }
        );
    }
}


// POST: Create a new order
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            academy_id = null,
            customer_user_id = null,
            public_user_id = null,
            fulfillment_branch_id,
            fulfillment_type = "Delivery",

            customer_name,
            customer_phone,
            customer_email = null,

            delivery_address = null,
            delivery_city = null,
            delivery_state = null,
            delivery_pincode = null,

            subtotal = 0,
            tax_amount = 0,
            delivery_charge = 0,
            discount_amount = 0,

            payment_method = "COD",
            payment_status = "Pending",
            order_status = "Pending",
            notes = null,
            estimated_delivery_date = null,
        } = body;

        // Exactly one customer ID is required
        const customerId = customer_user_id === "" ? null : customer_user_id;
        const publicId = public_user_id === "" ? null : public_user_id;

        if (
            (customerId === null || customerId === undefined) ===
            (publicId === null || publicId === undefined)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Provide either customer_user_id or public_user_id, not both.",
                },
                { status: 400 }
            );
        }

        // Required fields
        if (
            !fulfillment_branch_id ||
            !customer_name?.trim() ||
            !customer_phone?.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "fulfillment_branch_id, customer_name and customer_phone are required.",
                },
                { status: 400 }
            );
        }

        if (!["Delivery", "Pickup"].includes(fulfillment_type)) {
            return NextResponse.json(
                { success: false, message: "Invalid fulfillment_type." },
                { status: 400 }
            );
        }

        if (
            fulfillment_type === "Delivery" &&
            !delivery_address?.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "delivery_address is required for Delivery orders.",
                },
                { status: 400 }
            );
        }

        const validPaymentMethods = [
            "Cash",
            "UPI",
            "Card",
            "Bank Transfer",
            "COD",
        ];

        const validPaymentStatuses = [
            "Pending",
            "Partial",
            "Paid",
            "Failed",
            "Refunded",
        ];

        const validOrderStatuses = [
            "Pending",
            "Confirmed",
            "Processing",
            "Ready",
            "Dispatched",
            "Delivered",
            "Cancelled",
            "Returned",
        ];

        if (!validPaymentMethods.includes(payment_method)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment_method." },
                { status: 400 }
            );
        }

        if (!validPaymentStatuses.includes(payment_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment_status." },
                { status: 400 }
            );
        }

        if (!validOrderStatuses.includes(order_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid order_status." },
                { status: 400 }
            );
        }

        // Validate amounts
        const amounts = {
            subtotal: Number(subtotal),
            tax_amount: Number(tax_amount),
            delivery_charge: Number(delivery_charge),
            discount_amount: Number(discount_amount),
        };

        for (const [key, amount] of Object.entries(amounts)) {
            if (!Number.isFinite(amount) || amount < 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${key} must be a valid non - negative number.`,
                    },
                    { status: 400 }
                );
            }
        }

        if (amounts.discount_amount > amounts.subtotal + amounts.tax_amount + amounts.delivery_charge) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Discount cannot exceed the order amount.",
                },
                { status: 400 }
            );
        }

        // Calculate total on the server
        const grand_total = Number(
            (
                amounts.subtotal +
                amounts.tax_amount +
                amounts.delivery_charge -
                amounts.discount_amount
            ).toFixed(2)
        );

        // Generate order number if not supplied
        const order_no =
            body.order_no?.trim() ||
            `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

        connection = await db.getConnection();
        await connection.beginTransaction();

        let resolvedAcademyId = academy_id || null;
        if (!resolvedAcademyId && fulfillment_branch_id) {
            const [bRows] = await connection.execute(
                "SELECT academy_id FROM cst_branch WHERE id = ? LIMIT 1",
                [fulfillment_branch_id]
            );
            if (bRows.length > 0 && bRows[0].academy_id) {
                resolvedAcademyId = bRows[0].academy_id;
            } else {
                resolvedAcademyId = 1;
            }
        }

        // Calculate estimated delivery date: Branch Pickup = +2 days, Home Delivery = +12 days
        let effectiveDeliveryDate = estimated_delivery_date;
        if (!effectiveDeliveryDate) {
            const addDays = fulfillment_type === "Pickup" ? 2 : 12;
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + addDays);
            const yyyy = targetDate.getFullYear();
            const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
            const dd = String(targetDate.getDate()).padStart(2, "0");
            effectiveDeliveryDate = `${yyyy}-${mm}-${dd}`;
        }

        const [result] = await connection.execute(
            `
            INSERT INTO cst_orders(
        order_no,
        academy_id,
        customer_user_id,
        public_user_id,
        fulfillment_branch_id,
        fulfillment_type,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address,
        delivery_city,
        delivery_state,
        delivery_pincode,
        subtotal,
        tax_amount,
        delivery_charge,
        discount_amount,
        grand_total,
        payment_method,
        payment_status,
        order_status,
        notes,
        estimated_delivery_date
    ) VALUES(
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
        `,
            [
                order_no,
                resolvedAcademyId,
                customerId ?? null,
                publicId ?? null,
                fulfillment_branch_id,
                fulfillment_type,
                customer_name.trim(),
                customer_phone.trim(),
                customer_email || null,
                delivery_address || null,
                delivery_city || null,
                delivery_state || null,
                delivery_pincode || null,
                amounts.subtotal,
                amounts.tax_amount,
                amounts.delivery_charge,
                amounts.discount_amount,
                grand_total,
                payment_method,
                payment_status,
                order_status,
                notes || null,
                effectiveDeliveryDate,
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Order created successfully",
                id: result.insertId,
                order_no,
                grand_total,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("POST Order Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This order_no already exists.",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid academy, branch, or customer ID. Please verify the related records.",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create order",
            },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}