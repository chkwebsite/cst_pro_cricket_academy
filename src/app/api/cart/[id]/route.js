import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

function validateOwner(public_user_id, customer_user_id) {
    const hasPublicUser =
        public_user_id !== null && public_user_id !== undefined &&
        public_user_id !== "";

    const hasCustomerUser =
        customer_user_id !== null && customer_user_id !== undefined &&
        customer_user_id !== "";

    if (hasPublicUser === hasCustomerUser) {
        return "Provide either public_user_id or customer_user_id, not both.";
    }

    const id = hasPublicUser ? public_user_id : customer_user_id;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return "Owner ID must be a positive integer.";
    }

    return null;
}

async function getId(context) {
    const params = await context.params;
    const id = Number(params.id);

    return Number.isInteger(id) && id > 0 ? id : null;
}

// GET: Single cart
export async function GET(request, context) {
    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid cart ID" },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `SELECT
c.*,
    pu.name AS public_user_name,
        pu.email AS public_user_email,
            cu.name AS customer_user_name,
                cu.email AS customer_user_email
             FROM cst_cart c
             LEFT JOIN cst_public_users pu
                ON pu.id = c.public_user_id
             LEFT JOIN cst_users cu
                ON cu.id = c.customer_user_id
             WHERE c.id = ?
    LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Cart not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get cart error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch cart" },
            { status: 500 }
        );
    }
}

// PUT: Update cart owner
export async function PUT(request, context) {
    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid cart ID" },
                { status: 400 }
            );
        }

        const body = await request.json();

        const [existingRows] = await db.execute(
            "SELECT * FROM cst_cart WHERE id = ?",
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Cart not found" },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        const public_user_id =
            Object.prototype.hasOwnProperty.call(body, "public_user_id")
                ? body.public_user_id
                : existing.public_user_id;

        const customer_user_id =
            Object.prototype.hasOwnProperty.call(body, "customer_user_id")
                ? body.customer_user_id
                : existing.customer_user_id;

        const normalizedPublicId =
            public_user_id === "" ? null : public_user_id;

        const normalizedCustomerId =
            customer_user_id === "" ? null : customer_user_id;

        const validationError = validateOwner(
            normalizedPublicId,
            normalizedCustomerId
        );

        if (validationError) {
            return NextResponse.json(
                { success: false, message: validationError },
                { status: 400 }
            );
        }

        await db.execute(
            `UPDATE cst_cart
             SET public_user_id = ?,
    customer_user_id = ?
        WHERE id = ? `,
            [
                normalizedPublicId === null
                    ? null
                    : Number(normalizedPublicId),
                normalizedCustomerId === null
                    ? null
                    : Number(normalizedCustomerId),
                id,
            ]
        );

        const [updatedRows] = await db.execute(
            "SELECT * FROM cst_cart WHERE id = ?",
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Cart updated successfully",
            data: updatedRows[0],
        });
    } catch (error) {
        console.error("Update cart error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "A cart already exists for this user.",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "The specified user does not exist.",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update cart" },
            { status: 500 }
        );
    }
}

// DELETE: Delete cart
export async function DELETE(request, context) {
    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid cart ID" },
                { status: 400 }
            );
        }

        const [result] = await db.execute(
            "DELETE FROM cst_cart WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: "Cart not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Cart deleted successfully",
        });
    } catch (error) {
        console.error("Delete cart error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete cart" },
            { status: 500 }
        );
    }
}
