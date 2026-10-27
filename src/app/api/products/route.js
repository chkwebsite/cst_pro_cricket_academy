import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

export const runtime = "nodejs";

// GET: Product list with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const academyId = searchParams.get("academy_id");
        const categoryId = searchParams.get("category_id");
        const slug = searchParams.get("slug")?.trim();
        const search = searchParams.get("search")?.trim();
        const status = searchParams.get("status");
        const minPrice = searchParams.get("min_price");
        const maxPrice = searchParams.get("max_price");
        const minTax = searchParams.get("min_tax");
        const maxTax = searchParams.get("max_tax");

        let sql = `
SELECT
    p.id,
    p.academy_id,
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
    COALESCE((SELECT SUM(GREATEST(0, s.quantity - s.reserved_quantity)) FROM cst_product_stock s WHERE s.product_id = p.id), 0) AS total_stock,
    (
        SELECT GROUP_CONCAT(DISTINCT CONCAT(b.branch_name, IF(b.city IS NOT NULL AND b.city != '', CONCAT(' (', b.city, ')'), '')) SEPARATOR ', ')
        FROM cst_product_stock s
        JOIN cst_branch b ON b.id = s.branch_id
        WHERE s.product_id = p.id AND (s.quantity - s.reserved_quantity) > 0 AND b.status = 1 AND b.is_deleted = 0
    ) AS available_branches
FROM cst_products p
LEFT JOIN cst_product_categories c
    ON c.id = p.category_id
WHERE p.is_deleted = 0
    `;

        const params = [];

        // Exact slug filter
        if (slug) {
            sql += " AND p.slug = ?";
            params.push(slug);
        }

        // Academy filter: academy_id=null means global products only
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

        // Category filter: category_id=null means uncategorized products
        if (categoryId !== null && categoryId !== "") {
            if (categoryId === "null") {
                sql += " AND p.category_id IS NULL";
            } else {
                const value = Number(categoryId);

                if (!Number.isInteger(value) || value <= 0) {
                    return NextResponse.json(
                        { success: false, message: "Invalid category_id." },
                        { status: 400 }
                    );
                }

                sql += " AND p.category_id = ?";
                params.push(value);
            }
        }

        // Search product name, slug, code or description
        if (search) {
            sql += `
AND (
    p.product_name LIKE ?
    OR p.slug LIKE ?
    OR p.product_code LIKE ?
    OR p.description LIKE ?
)
    `;

            const value = `%${search}%`;
            params.push(value, value, value, value);
        }

        // Status: 1 active, 0 inactive
        if (status !== null && status !== "") {
            if (!["0", "1"].includes(status)) {
                return NextResponse.json(
                    { success: false, message: "Status must be 0 or 1." },
                    { status: 400 }
                );
            }

            sql += " AND p.status = ?";
            params.push(Number(status));
        }

        // Minimum and maximum product price
        if (minPrice !== null && minPrice !== "") {
            const value = Number(minPrice);

            if (!Number.isFinite(value) || value < 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid min_price." },
                    { status: 400 }
                );
            }

            sql += " AND COALESCE(p.sale_price, p.price) >= ?";
            params.push(value);
        }

        if (maxPrice !== null && maxPrice !== "") {
            const value = Number(maxPrice);

            if (!Number.isFinite(value) || value < 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid max_price." },
                    { status: 400 }
                );
            }

            sql += " AND COALESCE(p.sale_price, p.price) <= ?";
            params.push(value);
        }

        // Tax percentage range
        if (minTax !== null && minTax !== "") {
            const value = Number(minTax);

            if (!Number.isFinite(value) || value < 0 || value > 100) {
                return NextResponse.json(
                    { success: false, message: "min_tax must be between 0 and 100." },
                    { status: 400 }
                );
            }

            sql += " AND p.tax_percent >= ?";
            params.push(value);
        }

        if (maxTax !== null && maxTax !== "") {
            const value = Number(maxTax);

            if (!Number.isFinite(value) || value < 0 || value > 100) {
                return NextResponse.json(
                    { success: false, message: "max_tax must be between 0 and 100." },
                    { status: 400 }
                );
            }

            sql += " AND p.tax_percent <= ?";
            params.push(value);
        }

        sql += " ORDER BY p.id DESC";

        const [products] = await db.execute(sql, params);

        return NextResponse.json({
            success: true,
            total: products.length,
            data: products,
        });
    } catch (error) {
        console.error("Get products error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch products." },
            { status: 500 }
        );
    }
}

// POST: Create product
export async function POST(request) {
    try {
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

        const parseNullableId = (value, fieldName) => {
            if (value === undefined || value === null || value === "") {
                return null;
            }

            const parsed = Number(value);

            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new Error(`Invalid ${ fieldName }.`);
            }

            return parsed;
        };

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

        const [result] = await db.execute(
            `INSERT INTO cst_products
    (
        academy_id,
        category_id,
        product_name,
        slug,
        product_code,
        description,
        price,
        sale_price,
        tax_percent,
        status
    )
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            ]
        );

        // Auto-initialize stock records for active branches
        try {
            const [activeBranches] = await db.execute("SELECT id FROM cst_branch WHERE is_deleted = 0 AND status = 1");
            for (const b of activeBranches) {
                await db.execute(
                    "INSERT IGNORE INTO cst_product_stock (product_id, branch_id, quantity, reserved_quantity, low_stock_alert) VALUES (?, ?, 0, 0, 5)",
                    [result.insertId, b.id]
                );
            }
        } catch {
            /* non-fatal */
        }

        return NextResponse.json(
            {
                success: true,
                message: "Product created successfully.",
                data: {
                    id: result.insertId,
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
            },
            { status: 201 }
        );
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
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

        console.error("Create product error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to create product." },
            { status: 500 }
        );
    }
}