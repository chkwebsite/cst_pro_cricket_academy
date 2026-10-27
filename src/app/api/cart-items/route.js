import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

// GET: All cart items with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const conditions = [];
        const values = [];

        const filters = [
            ["id", "ci.id"],
            ["cart_id", "ci.cart_id"],
            ["product_id", "ci.product_id"],
            ["quantity", "ci.quantity"],
        ];

        for (const [key, column] of filters) {
            const value = searchParams.get(key);

            if (value !== null && value.trim() !== "") {
                const number = Number(value);

                if (!Number.isInteger(number) || number <= 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `Invalid ${key} `,
                        },
                        { status: 400 }
                    );
                }

                conditions.push(`${column} = ?`);
                values.push(number);
            }
        }

        const min_quantity = searchParams.get("min_quantity");
        const max_quantity = searchParams.get("max_quantity");
        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");
        const search = searchParams.get("search")?.trim();

        if (min_quantity !== null && min_quantity !== "") {
            const min = Number(min_quantity);

            if (!Number.isInteger(min) || min < 1) {
                return NextResponse.json(
                    { success: false, message: "Invalid min_quantity" },
                    { status: 400 }
                );
            }

            conditions.push("ci.quantity >= ?");
            values.push(min);
        }

        if (max_quantity !== null && max_quantity !== "") {
            const max = Number(max_quantity);

            if (!Number.isInteger(max) || max < 1) {
                return NextResponse.json(
                    { success: false, message: "Invalid max_quantity" },
                    { status: 400 }
                );
            }

            conditions.push("ci.quantity <= ?");
            values.push(max);
        }

        if (min_quantity && max_quantity &&
            Number(min_quantity) > Number(max_quantity)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "min_quantity cannot exceed max_quantity",
                },
                { status: 400 }
            );
        }

        if (start_date) {
            conditions.push("ci.created_at >= ?");
            values.push(`${start_date} 00:00:00`);
        }

        if (end_date) {
            conditions.push("ci.created_at <= ?");
            values.push(`${end_date} 23: 59: 59`);
        }

        if (search) {
            conditions.push(`(
    p.product_name LIKE ?
    OR p.product_code LIKE ?
    OR CAST(ci.product_id AS CHAR) LIKE ?
    OR CAST(ci.cart_id AS CHAR) LIKE ?
            )`);

            const term = `% ${search}% `;
            values.push(term, term, term, term);
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")} `
            : "";

        const [rows] = await db.execute(
            `SELECT
ci.*,
    p.product_name,
    p.product_code,
    p.slug AS product_slug
             FROM cst_cart_items ci
             LEFT JOIN cst_products p
                ON p.id = ci.product_id
             ${where}
             ORDER BY ci.id DESC`,
            values
        );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("Get cart items error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch cart items",
            },
            { status: 500 }
        );
    }
}

// POST: Add product to cart
export async function POST(request) {
    try {
        const body = await request.json();

        const cart_id = Number(body.cart_id);
        const product_id = Number(body.product_id);
        const quantity = body.quantity === undefined
            ? 1
            : Number(body.quantity);

        if (!Number.isInteger(cart_id) || cart_id <= 0) {
            return NextResponse.json(
                { success: false, message: "Valid cart_id is required" },
                { status: 400 }
            );
        }

        if (!Number.isInteger(product_id) || product_id <= 0) {
            return NextResponse.json(
                { success: false, message: "Valid product_id is required" },
                { status: 400 }
            );
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Quantity must be a positive integer",
                },
                { status: 400 }
            );
        }

        const [existingItems] = await db.execute(
            `SELECT id
             FROM cst_cart_items
             WHERE cart_id = ? AND product_id = ?
    LIMIT 1`,
            [cart_id, product_id]
        );

        if (existingItems.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product already exists in this cart. Update its quantity instead.",
                    data: existingItems[0],
                },
                { status: 409 }
            );
        }

        const [result] = await db.execute(
            `INSERT INTO cst_cart_items
    (cart_id, product_id, quantity)
VALUES(?, ?, ?)`,
            [cart_id, product_id, quantity]
        );

        const [rows] = await db.execute(
            `SELECT
ci.*,
    p.product_name,
    p.product_code,
    p.slug AS product_slug
             FROM cst_cart_items ci
             LEFT JOIN cst_products p ON p.id = ci.product_id
             WHERE ci.id = ? `,
            [result.insertId]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Product added to cart successfully",
                data: rows[0],
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Add cart item error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This product already exists in the cart.",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Cart or product does not exist.",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to add product to cart",
            },
            { status: 500 }
        );
    }
}
