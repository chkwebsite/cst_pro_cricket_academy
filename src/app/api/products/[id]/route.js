import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

export const runtime = "nodejs";

async function getProductId(context) {
    const params = await context.params;
    const id = Number(params.id);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function parseNullableId(value, fieldName) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid ${fieldName}.`);
    }

    return id;
}

function isDuplicateError(error) {
    return error.code === "ER_DUP_ENTRY";
}

// GET: Single product (supports numeric ID or slug)
export async function GET(request, context) {
    try {
        const params = await context.params;
        const identifier = String(params.id || "").trim();

        if (!identifier) {
            return NextResponse.json(
                { success: false, message: "Invalid product identifier." },
                { status: 400 }
            );
        }

        const isNumeric = Number.isInteger(Number(identifier)) && Number(identifier) > 0;

        const [rows] = await db.execute(
            `SELECT
                p.id,
                p.academy_id,
                COALESCE(ac.academy_name, 'CST Pro Cricket Academy') AS academy_name,
                p.category_id,
                p.product_name,
                p.slug,
                p.product_code,
                p.description,
                p.price,
                p.sale_price,
                p.tax_percent,
                p.status,
                p.is_deleted,
                p.created_at,
                p.updated_at,
                c.category_name,
                c.category_image,
                COALESCE(
                    (SELECT pi.image_path FROM cst_product_images pi WHERE pi.product_id = p.id AND pi.status = 1 AND pi.is_primary = 1 LIMIT 1),
                    (SELECT pi.image_path FROM cst_product_images pi WHERE pi.product_id = p.id AND pi.status = 1 ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
                    c.category_image
                ) AS primary_image,
                COALESCE((SELECT SUM(GREATEST(0, s.quantity - s.reserved_quantity)) FROM cst_product_stock s WHERE s.product_id = p.id), 0) AS total_stock
             FROM cst_products p
             LEFT JOIN cst_academy ac
                ON ac.id = p.academy_id
             LEFT JOIN cst_product_categories c
                ON c.id = p.category_id
             WHERE (p.id = ? OR p.slug = ?) AND p.is_deleted = 0
             LIMIT 1`,
            [isNumeric ? Number(identifier) : 0, identifier]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Product not found." },
                { status: 404 }
            );
        }

        const product = rows[0];

        // Fetch all active images for this product
        const [images] = await db.execute(
            `SELECT id, product_id, image_path, image_alt, is_primary, sort_order, status
             FROM cst_product_images
             WHERE product_id = ? AND status = 1
             ORDER BY is_primary DESC, sort_order ASC, id ASC`,
            [product.id]
        );

        // Fetch stock records by branch for this product
        const [stocks] = await db.execute(
            `SELECT 
                s.id, 
                s.branch_id, 
                b.branch_name, 
                b.city,
                b.state,
                b.address,
                b.phone AS branch_phone,
                b.academy_id,
                COALESCE(a.academy_name, 'CST Pro Cricket Academy') AS academy_name,
                s.quantity, 
                s.reserved_quantity, 
                GREATEST(0, s.quantity - s.reserved_quantity) AS available_quantity
             FROM cst_product_stock s
             INNER JOIN cst_branch b ON b.id = s.branch_id
             LEFT JOIN cst_academy a ON a.id = b.academy_id
             WHERE s.product_id = ? AND b.status = 1 AND b.is_deleted = 0
             ORDER BY available_quantity DESC, b.branch_name ASC`,
            [product.id]
        );

        return NextResponse.json({
            success: true,
            data: {
                ...product,
                images: images || [],
                stocks: stocks || [],
            },
        });
    } catch (error) {
        console.error("Get single product error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch product." },
            { status: 500 }
        );
    }
}

// PUT: Update product
export async function PUT(request, context) {
    try {
        const id = await getProductId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid product ID." },
                { status: 400 }
            );
        }

        const [existingRows] = await db.execute(
            `SELECT id
             FROM cst_products
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Product not found." },
                { status: 404 }
            );
        }

        const body = await request.json();

        const {
            academy_id,
            category_id,
            product_name,
            slug,
            product_code,
            description,
            price,
            sale_price,
            tax_percent,
            status,
        } = body;

        const name = typeof product_name === "string"
            ? product_name.trim()
            : "";

        const productSlug = typeof slug === "string"
            ? slug.trim().toLowerCase()
            : "";

        if (!name || !productSlug) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product name and slug are required.",
                },
                { status: 400 }
            );
        }

        if (name.length > 200 || productSlug.length > 220) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product name or slug is too long.",
                },
                { status: 400 }
            );
        }

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Slug must use lowercase letters, numbers and hyphens.",
                },
                { status: 400 }
            );
        }

        let academyId;
        let categoryId;

        try {
            academyId = parseNullableId(academy_id, "academy_id");
            categoryId = parseNullableId(category_id, "category_id");
        } catch (error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        const productPrice = price === undefined || price === ""
            ? 0
            : Number(price);

        const salePrice =
            sale_price === undefined || sale_price === null || sale_price === ""
                ? null
                : Number(sale_price);

        const taxPercent =
            tax_percent === undefined || tax_percent === ""
                ? 0
                : Number(tax_percent);

        const productStatus =
            status === undefined || status === ""
                ? 1
                : Number(status);

        if (!Number.isFinite(productPrice) || productPrice < 0) {
            return NextResponse.json(
                { success: false, message: "Price must be zero or greater." },
                { status: 400 }
            );
        }

        if (
            salePrice !== null &&
            (!Number.isFinite(salePrice) || salePrice < 0)
        ) {
            return NextResponse.json(
                { success: false, message: "Sale price must be zero or greater." },
                { status: 400 }
            );
        }

        if (
            !Number.isFinite(taxPercent) ||
            taxPercent < 0 ||
            taxPercent > 100
        ) {
            return NextResponse.json(
                { success: false, message: "Tax must be between 0 and 100." },
                { status: 400 }
            );
        }

        if (![0, 1].includes(productStatus)) {
            return NextResponse.json(
                { success: false, message: "Status must be 0 or 1." },
                { status: 400 }
            );
        }

        const productCode =
            typeof product_code === "string" && product_code.trim()
                ? product_code.trim()
                : null;

        if (productCode && productCode.length > 80) {
            return NextResponse.json(
                { success: false, message: "Product code is too long." },
                { status: 400 }
            );
        }

        const productDescription =
            typeof description === "string" && description.trim()
                ? description.trim()
                : null;

        await db.execute(
            `UPDATE cst_products
SET
academy_id = ?,
    category_id = ?,
    product_name = ?,
    slug = ?,
    product_code = ?,
    description = ?,
    price = ?,
    sale_price = ?,
    tax_percent = ?,
    status = ?
        WHERE id = ? AND is_deleted = 0`,
            [
                academyId,
                categoryId,
                name,
                productSlug,
                productCode,
                productDescription,
                productPrice,
                salePrice,
                taxPercent,
                productStatus,
                id,
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Product updated successfully.",
            data: {
                id,
                academy_id: academyId,
                category_id: categoryId,
                product_name: name,
                slug: productSlug,
                product_code: productCode,
                description: productDescription,
                price: productPrice,
                sale_price: salePrice,
                tax_percent: taxPercent,
                status: productStatus,
            },
        });
    } catch (error) {
        if (isDuplicateError(error)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Slug or product code already exists.",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "The selected academy or category does not exist.",
                },
                { status: 400 }
            );
        }

        console.error("Update product error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update product." },
            { status: 500 }
        );
    }
}

// DELETE: Soft delete product
export async function DELETE(request, context) {
    try {
        const id = await getProductId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid product ID." },
                { status: 400 }
            );
        }

        const [result] = await db.execute(
            `UPDATE cst_products
             SET is_deleted = 1
             WHERE id = ? AND is_deleted = 0`,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: "Product not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Product deleted successfully.",
        });
    } catch (error) {
        console.error("Delete product error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete product." },
            { status: 500 }
        );
    }
}