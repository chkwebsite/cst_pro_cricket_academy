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

async function getId(context) {
    const params = await context.params;
    const id = Number(params.id);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function validBit(value) {
    return ["0", "1"].includes(String(value));
}

async function saveImage(file) {
    if (!file || file.size === 0) {
        throw new Error("Please select an image.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image size must not exceed 5MB.");
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

// GET: Single image
export async function GET(request, context) {
    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid image ID." },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `SELECT
                pi.*,
                p.product_name,
                p.academy_id,
                p.category_id
             FROM cst_product_images pi
             INNER JOIN cst_products p
                ON p.id = pi.product_id
             WHERE pi.id = ? AND p.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Product image not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get product image error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch product image." },
            { status: 500 }
        );
    }
}

// PUT: Update image details or replace image
export async function PUT(request, context) {
    let newImagePath = null;
    let connection;

    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid image ID." },
                { status: 400 }
            );
        }

        const contentType = request.headers.get("content-type") || "";
        let imageAlt = null;
        let primaryValue = null;
        let sortOrderValue = null;
        let statusValue = null;
        let image = null;

        if (contentType.includes("application/json")) {
            const body = await request.json().catch(() => ({}));
            imageAlt = body.image_alt !== undefined ? String(body.image_alt || "").trim() || null : null;
            primaryValue = body.is_primary !== undefined && body.is_primary !== null ? String(body.is_primary) : null;
            sortOrderValue = body.sort_order !== undefined && body.sort_order !== null ? String(body.sort_order) : null;
            statusValue = body.status !== undefined && body.status !== null ? String(body.status) : null;
        } else {
            const formData = await request.formData().catch(() => new FormData());
            imageAlt = formData.get("image_alt")?.trim() || null;
            primaryValue = formData.get("is_primary");
            sortOrderValue = formData.get("sort_order");
            statusValue = formData.get("status");
            image = formData.get("image");
        }

        if (imageAlt && imageAlt.length > 255) {
            return NextResponse.json(
                { success: false, message: "image_alt cannot exceed 255 characters." },
                { status: 400 }
            );
        }

        if (
            primaryValue !== null && !validBit(primaryValue) ||
            statusValue !== null && !validBit(statusValue)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "is_primary and status must be 0 or 1.",
                },
                { status: 400 }
            );
        }

        const sortOrder =
            sortOrderValue === null || sortOrderValue === ""
                ? 0
                : Number(sortOrderValue);

        if (!Number.isInteger(sortOrder)) {
            return NextResponse.json(
                { success: false, message: "Invalid sort_order." },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT *
             FROM cst_product_images
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Product image not found." },
                { status: 404 }
            );
        }

        const existing = rows[0];

        let imagePath = existing.image_path;

        if (image && typeof image.arrayBuffer === "function" && image.size > 0) {
            newImagePath = await saveImage(image);
            imagePath = newImagePath;
        }

        const isPrimary =
            primaryValue === null
                ? existing.is_primary
                : Number(primaryValue);

        const status =
            statusValue === null
                ? existing.status
                : Number(statusValue);

        // Only one primary image per product.
        if (isPrimary === 1) {
            await connection.execute(
                `UPDATE cst_product_images
                 SET is_primary = 0
                 WHERE product_id = ? AND id <> ?`,
                [existing.product_id, id]
            );
        }

        await connection.execute(
            `UPDATE cst_product_images
             SET
                image_path = ?,
                image_alt = ?,
                is_primary = ?,
                sort_order = ?,
                status = ?
             WHERE id = ?`,
            [
                imagePath,
                imageAlt,
                isPrimary,
                sortOrder,
                status,
                id,
            ]
        );

        await connection.commit();

        if (newImagePath && existing.image_path) {
            await removeImage(existing.image_path);
        }

        return NextResponse.json({
            success: true,
            message: "Product image updated successfully.",
            data: {
                id,
                product_id: existing.product_id,
                image_path: imagePath,
                image_alt: imageAlt,
                is_primary: isPrimary,
                sort_order: sortOrder,
                status,
            },
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        if (newImagePath) {
            await removeImage(newImagePath);
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

        console.error("Update product image error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update product image." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Delete image record and its local file
export async function DELETE(request, context) {
    let connection;

    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid image ID." },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT id, image_path
             FROM cst_product_images
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Product image not found." },
                { status: 404 }
            );
        }

        const imagePath = rows[0].image_path;

        await connection.execute(
            "DELETE FROM cst_product_images WHERE id = ?",
            [id]
        );

        await connection.commit();

        await removeImage(imagePath);

        return NextResponse.json({
            success: true,
            message: "Product image deleted successfully.",
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Delete product image error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete product image." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}