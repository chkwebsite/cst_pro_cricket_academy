import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

async function getItemId(context) {
    const params = await context.params;
    const id = Number(params.id);

    return Number.isInteger(id) && id > 0 ? id : null;
}

// GET: Single cart item
export async function GET(request, context) {
    try {
        const id = await getItemId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid cart item ID" },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `SELECT
ci.*,
    p.product_name,
    p.product_code,
    p.slug AS product_slug
             FROM cst_cart_items ci
             LEFT JOIN cst_products p ON p.id = ci.product_id
             WHERE ci.id = ?
    LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Cart item not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get cart item error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch cart item" },
            { status: 500 }
        );
    }
}

// PUT: Update cart item quantity or product
export async function PUT(request, context) {
    try {
        const id = await getItemId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid cart item ID" },
                { status: 400 }
            );
        }

        const body = await request.json();

        const [existingRows] = await db.execute(
            "SELECT * FROM cst_cart_items WHERE id = ? LIMIT 1",
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Cart item not found" },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        const quantity = body.quantity === undefined
            ? existing.quantity
            : Number(body.quantity);

        const product_id = body.product_id === undefined
            ? existing.product_id
            : Number(body.product_id);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Quantity must be a positive integer",
                },
                { status: 400 }
            );
        }

        if (!Number.isInteger(product_id) || product_id <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid product_id" },
                { status: 400 }
            );
        }

        // Check whether this product already exists in the same cart.
        const [duplicateRows] = await db.execute(
            `SELECT id
             FROM cst_cart_items
             WHERE cart_id = ?
    AND product_id = ?
        AND id <> ?
            LIMIT 1`,
            [existing.cart_id, product_id, id]
        );

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This product already exists in the cart.",
                },
                { status: 409 }
            );
        }

        await db.execute(
            `UPDATE cst_cart_items
             SET product_id = ?, quantity = ?
    WHERE id = ? `,
            [product_id, quantity, id]
        );

        const [updatedRows] = await db.execute(
            `SELECT
ci.*,
    p.product_name,
    p.product_code,
    p.slug AS product_slug
             FROM cst_cart_items ci
             LEFT JOIN cst_products p ON p.id = ci.product_id
             WHERE ci.id = ? `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Cart item updated successfully",
            data: updatedRows[0],
        });
    } catch (error) {
        console.error("Update cart item error:", error);

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
                { success: false, message: "Product does not exist" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update cart item" },
            { status: 500 }
        );
    }
}

// DELETE: Remove product from cart
export async function DELETE(request, context) {
    try {
        const id = await getItemId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid cart item ID" },
                { status: 400 }
            );
        }

        const [result] = await db.execute(
            "DELETE FROM cst_cart_items WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: "Cart item not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Cart item removed successfully",
        });
    } catch (error) {
        console.error("Delete cart item error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete cart item" },
            { status: 500 }
        );
    }
}
