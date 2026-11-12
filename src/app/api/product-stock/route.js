import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

export const runtime = "nodejs";

// GET: Stock list with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const productId = searchParams.get("product_id");
        const branchId = searchParams.get("branch_id");
        const academyId = searchParams.get("academy_id");
        const search = searchParams.get("search")?.trim();
        const stockStatus = searchParams.get("stock_status");
        const lowStockAlert = searchParams.get("low_stock");

        let sql = `
SELECT
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
    p.slug,
    p.price,
    p.sale_price,
    p.academy_id,
    b.branch_name,
    b.city,
    b.address,
    b.phone AS branch_phone
            FROM cst_product_stock s
            INNER JOIN cst_products p
                ON p.id = s.product_id
            INNER JOIN cst_branch b
                ON b.id = s.branch_id
            WHERE p.is_deleted = 0
    `;

        const params = [];

        if (productId !== null && productId !== "") {
            const value = Number(productId);

            if (!Number.isInteger(value) || value <= 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid product_id." },
                    { status: 400 }
                );
            }

            sql += " AND s.product_id = ?";
            params.push(value);
        }

        if (branchId !== null && branchId !== "") {
            const value = Number(branchId);

            if (!Number.isInteger(value) || value <= 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid branch_id." },
                    { status: 400 }
                );
            }

            sql += " AND s.branch_id = ?";
            params.push(value);
        }

        if (academyId !== null && academyId !== "") {
            if (academyId === "null") {
                sql += " AND p.academy_id IS NULL";
            } else {
                const value = Number(academyId);

                if (!Number.isInteger(value) || value <= 0) {
                    return NextResponse.json(
                        { success: false, message: "Invalid academy_id." },
                        { status: 400 }
                    );
                }

                sql += " AND p.academy_id = ?";
                params.push(value);
            }
        }

        if (search) {
            sql += `
AND(
    p.product_name LIKE ?
    OR p.product_code LIKE ?
    OR p.slug LIKE ?
                )
    `;

            const value = `% ${ search }% `;
            params.push(value, value, value);
        }

        if (stockStatus) {
            const allowedStatuses = [
                "In Stock",
                "Low Stock",
                "Out of Stock",
            ];

            if (!allowedStatuses.includes(stockStatus)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid stock_status filter.",
                    },
                    { status: 400 }
                );
            }

            if (stockStatus === "Out of Stock") {
                sql += " AND s.quantity = 0";
            } else if (stockStatus === "Low Stock") {
                sql += `
                    AND s.quantity > 0
AND(s.quantity - s.reserved_quantity) <= s.low_stock_alert
    `;
            } else {
                sql += `
AND(s.quantity - s.reserved_quantity) > s.low_stock_alert
    `;
            }
        }

        // low_stock=1 returns only stock at/below its alert threshold.
        if (lowStockAlert !== null && lowStockAlert !== "") {
            if (!["0", "1"].includes(lowStockAlert)) {
                return NextResponse.json(
                    { success: false, message: "low_stock must be 0 or 1." },
                    { status: 400 }
                );
            }

            if (lowStockAlert === "1") {
                sql += `
AND(s.quantity - s.reserved_quantity) <= s.low_stock_alert
    `;
            } else {
                sql += `
AND(s.quantity - s.reserved_quantity) > s.low_stock_alert
    `;
            }
        }

        sql += " ORDER BY s.id DESC";

        const [stocks] = await db.execute(sql, params);

        return NextResponse.json({
            success: true,
            total: stocks.length,
            data: stocks,
        });
    } catch (error) {
        console.error("Get product stock error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch product stock." },
            { status: 500 }
        );
    }
}

// POST: Create stock for a product and branch
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            product_id,
            branch_id,
            quantity = 0,
            reserved_quantity = 0,
            low_stock_alert = 5,
        } = body;

        const productId = Number(product_id);
        const branchId = Number(branch_id);
        const stockQuantity = Number(quantity);
        const reservedQuantity = Number(reserved_quantity);
        const alertQuantity = Number(low_stock_alert);

        if (
            !Number.isInteger(productId) || productId <= 0 ||
            !Number.isInteger(branchId) || branchId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid product_id and branch_id are required.",
                },
                { status: 400 }
            );
        }

        const isValidUnsignedInt = (value) =>
            Number.isInteger(value) && value >= 0 && value <= 4294967295;

        if (
            !isValidUnsignedInt(stockQuantity) ||
            !isValidUnsignedInt(reservedQuantity) ||
            !isValidUnsignedInt(alertQuantity)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Stock quantities must be valid unsigned integers.",
                },
                { status: 400 }
            );
        }

        if (reservedQuantity > stockQuantity) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Reserved quantity cannot exceed total quantity.",
                },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [products] = await connection.execute(
            `SELECT id
             FROM cst_products
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [productId]
        );

        if (products.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Product not found." },
                { status: 404 }
            );
        }

        const [branches] = await connection.execute(
            `SELECT id
             FROM cst_branch
             WHERE id = ?
    LIMIT 1`,
            [branchId]
        );

        if (branches.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Branch not found." },
                { status: 404 }
            );
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_product_stock
    (
        product_id,
        branch_id,
        quantity,
        reserved_quantity,
        low_stock_alert
    )
VALUES(?, ?, ?, ?, ?)`,
            [
                productId,
                branchId,
                stockQuantity,
                reservedQuantity,
                alertQuantity,
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Product stock created successfully.",
                data: {
                    id: result.insertId,
                    product_id: productId,
                    branch_id: branchId,
                    quantity: stockQuantity,
                    reserved_quantity: reservedQuantity,
                    available_quantity: stockQuantity - reservedQuantity,
                    low_stock_alert: alertQuantity,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Stock already exists for this product and branch.",
                },
                { status: 409 }
            );
        }

        console.error("Create product stock error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to create product stock." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}