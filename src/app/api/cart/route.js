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

// GET: All carts with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const conditions = [];
        const values = [];

        const id = searchParams.get("id");
        const public_user_id = searchParams.get("public_user_id");
        const customer_user_id = searchParams.get("customer_user_id");
        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");

        if (id) {
            if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid cart id" },
                    { status: 400 }
                );
            }

            conditions.push("c.id = ?");
            values.push(Number(id));
        }

        if (public_user_id) {
            if (
                !Number.isInteger(Number(public_user_id)) ||
                Number(public_user_id) <= 0
            ) {
                return NextResponse.json(
                    { success: false, message: "Invalid public_user_id" },
                    { status: 400 }
                );
            }

            conditions.push("c.public_user_id = ?");
            values.push(Number(public_user_id));
        }

        if (customer_user_id) {
            if (
                !Number.isInteger(Number(customer_user_id)) ||
                Number(customer_user_id) <= 0
            ) {
                return NextResponse.json(
                    { success: false, message: "Invalid customer_user_id" },
                    { status: 400 }
                );
            }

            conditions.push("c.customer_user_id = ?");
            values.push(Number(customer_user_id));
        }

        if (start_date) {
            conditions.push("c.created_at >= ?");
            values.push(`${ start_date } 00:00:00`);
        }

        if (end_date) {
            conditions.push("c.created_at <= ?");
            values.push(`${ end_date } 23: 59: 59`);
        }

        const where = conditions.length
            ? `WHERE ${ conditions.join(" AND ") } `
            : "";

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
             ${ where }
             ORDER BY c.id DESC`,
            values
        );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("Get carts error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch carts" },
            { status: 500 }
        );
    }
}

// POST: Create cart
export async function POST(request) {
    try {
        const body = await request.json();

        const public_user_id =
            body.public_user_id === "" || body.public_user_id === undefined
                ? null
                : body.public_user_id;

        const customer_user_id =
            body.customer_user_id === "" || body.customer_user_id === undefined
                ? null
                : body.customer_user_id;

        const validationError = validateOwner(
            public_user_id,
            customer_user_id
        );

        if (validationError) {
            return NextResponse.json(
                { success: false, message: validationError },
                { status: 400 }
            );
        }

        const publicId =
            public_user_id === null ? null : Number(public_user_id);

        const customerId =
            customer_user_id === null ? null : Number(customer_user_id);

        const [result] = await db.execute(
            `INSERT INTO cst_cart
    (public_user_id, customer_user_id)
VALUES(?, ?)`,
            [publicId, customerId]
        );

        const [rows] = await db.execute(
            "SELECT * FROM cst_cart WHERE id = ?",
            [result.insertId]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Cart created successfully",
                data: rows[0],
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create cart error:", error);

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
            { success: false, message: "Failed to create cart" },
            { status: 500 }
        );
    }
}
