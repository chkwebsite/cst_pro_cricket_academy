import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(
    process.cwd(),
    "public",
    "images",
    "uploads",
    "product-images"
);

const UPLOAD_URL = "/images/uploads/product-images/";

async function saveImage(file) {
    if (!file || file.size === 0) {
        throw new Error("Please select an image.");
    }

    if (file.size > 2 * 1024 * 1024) {
        throw new Error("Image size must not exceed 2MB.");
    }

    const allowedTypes = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    };

    const extension = allowedTypes[file.type];

    if (!extension) {
        throw new Error("Only JPG, PNG and WebP images are allowed.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const validSignature =
        (extension === "jpg" &&
            buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff) ||
        (extension === "png" &&
            buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
            )) ||
        (extension === "webp" &&
            buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP");

    if (!validSignature) {
        throw new Error("Invalid image file.");
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const fileName =
        `${Date.now()}_${crypto.randomBytes(12).toString("hex")}.${extension}`;

    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

    return `${UPLOAD_URL}${fileName}`;
}

async function removeImage(imagePath) {
    if (!imagePath || !imagePath.startsWith(UPLOAD_URL)) return;

    const fileName = imagePath.slice(UPLOAD_URL.length);

    if (!fileName || path.basename(fileName) !== fileName) return;

    try {
        await fs.unlink(path.join(UPLOAD_DIR, fileName));
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Image file deletion failed:", error);
        }
    }
}

function validStatus(value) {
    return ["0", "1"].includes(String(value));
}

// GET: Product images with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const productId = searchParams.get("product_id");
        const isPrimary = searchParams.get("is_primary");
        const status = searchParams.get("status");
        const search = searchParams.get("search")?.trim();

        let sql = `
SELECT
pi.id,
    pi.product_id,
    pi.image_path,
    pi.image_alt,
    pi.is_primary,
    pi.sort_order,
    pi.status,
    pi.created_at,
    pi.updated_at,
    p.product_name,
    p.academy_id,
    p.category_id
            FROM cst_product_images pi
            INNER JOIN cst_products p
                ON p.id = pi.product_id
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

            sql += " AND pi.product_id = ?";
            params.push(value);
        }

        if (isPrimary !== null && isPrimary !== "") {
            if (!validStatus(isPrimary)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "is_primary must be 0 or 1.",
                    },
                    { status: 400 }
                );
            }

            sql += " AND pi.is_primary = ?";
            params.push(Number(isPrimary));
        }

        if (status !== null && status !== "") {
            if (!validStatus(status)) {
                return NextResponse.json(
                    { success: false, message: "Status must be 0 or 1." },
                    { status: 400 }
                );
            }

            sql += " AND pi.status = ?";
            params.push(Number(status));
        }

        if (search) {
            sql += `
AND(
    pi.image_alt LIKE ?
    OR p.product_name LIKE ?
)
    `;

            const value = `%${search}%`;
            params.push(value, value);
        }

        // Optional product academy filter
        const academyId = searchParams.get("academy_id");

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

        sql += " ORDER BY pi.sort_order ASC, pi.id DESC";

        const [images] = await db.execute(sql, params);

        return NextResponse.json({
            success: true,
            total: images.length,
            data: images,
        });
    } catch (error) {
        console.error("Get product images error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch product images." },
            { status: 500 }
        );
    }
}

// POST: Upload a product image
export async function POST(request) {
    let imagePath = null;
    let connection;

    try {
        const formData = await request.formData();

        const productId = Number(formData.get("product_id"));
        const imageAlt = formData.get("image_alt")?.trim() || null;
        const primaryValue = formData.get("is_primary") ?? "0";
        const sortOrderValue = formData.get("sort_order") ?? "0";
        const statusValue = formData.get("status") ?? "1";
        const image = formData.get("image");

        if (!Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json(
                { success: false, message: "Valid product_id is required." },
                { status: 400 }
            );
        }

        if (imageAlt && imageAlt.length > 255) {
            return NextResponse.json(
                { success: false, message: "image_alt cannot exceed 255 characters." },
                { status: 400 }
            );
        }

        if (!validStatus(primaryValue) || !validStatus(statusValue)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "is_primary and status must be 0 or 1.",
                },
                { status: 400 }
            );
        }

        const isPrimary = Number(primaryValue);
        const status = Number(statusValue);
        const sortOrder = Number(sortOrderValue);

        if (!Number.isInteger(sortOrder)) {
            return NextResponse.json(
                { success: false, message: "Invalid sort_order." },
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

        imagePath = await saveImage(image);

        // A product should have at most one primary image.
        if (isPrimary === 1) {
            await connection.execute(
                `UPDATE cst_product_images
                 SET is_primary = 0
                 WHERE product_id = ? `,
                [productId]
            );
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_product_images
    (
        product_id,
        image_path,
        image_alt,
        is_primary,
        sort_order,
        status
    )
VALUES(?, ?, ?, ?, ?, ?)`,
            [
                productId,
                imagePath,
                imageAlt,
                isPrimary,
                sortOrder,
                status,
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Product image uploaded successfully.",
                data: {
                    id: result.insertId,
                    product_id: productId,
                    image_path: imagePath,
                    image_alt: imageAlt,
                    is_primary: isPrimary,
                    sort_order: sortOrder,
                    status,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        if (imagePath) {
            await removeImage(imagePath);
        }

        if (
            error.message?.includes("Image size") ||
            error.message?.includes("Only JPG") ||
            error.message?.includes("Invalid image") ||
            error.message?.includes("Please select")
        ) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        console.error("Upload product image error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to upload product image." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}