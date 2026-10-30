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
    "product-categories"
);

const UPLOAD_URL = "/images/uploads/product-categories/";

async function saveCategoryImage(file) {
    if (!file || file.size === 0) return null;

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

async function removeCategoryImage(imagePath) {
    if (!imagePath || !imagePath.startsWith(UPLOAD_URL)) return;

    const fileName = imagePath.slice(UPLOAD_URL.length);

    if (!fileName || path.basename(fileName) !== fileName) return;

    try {
        await fs.unlink(path.join(UPLOAD_DIR, fileName));
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Image deletion failed:", error);
        }
    }
}

function isDuplicateError(error) {
    return error.code === "ER_DUP_ENTRY";
}

async function getId(context) {
    const params = await context.params;
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

// GET: Single category
export async function GET(request, context) {
    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid category ID." },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `SELECT
id,
    academy_id,
    category_name,
    slug,
    description,
    category_image,
    sort_order,
    status,
    is_deleted,
    created_at,
    updated_at
             FROM cst_product_categories
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Category not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get single category error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch category." },
            { status: 500 }
        );
    }
}

// PUT: Update category
export async function PUT(request, context) {
    let uploadedImage = null;

    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid category ID." },
                { status: 400 }
            );
        }

        const [existingRows] = await db.execute(
            `SELECT id, category_image
             FROM cst_product_categories
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Category not found." },
                { status: 404 }
            );
        }

        const existing = existingRows[0];
        const formData = await request.formData();

        const academyIdValue = formData.get("academy_id");
        const categoryName = formData.get("category_name")?.trim();
        const slug = formData.get("slug")?.trim().toLowerCase();
        const description = formData.get("description")?.trim() || null;
        const sortOrderValue = formData.get("sort_order");
        const statusValue = formData.get("status");
        const image = formData.get("category_image");

        if (!categoryName || !slug) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Category name and slug are required.",
                },
                { status: 400 }
            );
        }

        if (categoryName.length > 150 || slug.length > 180) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Category name or slug is too long.",
                },
                { status: 400 }
            );
        }

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Slug must contain lowercase letters, numbers and hyphens.",
                },
                { status: 400 }
            );
        }

        let academyId = null;

        if (
            academyIdValue !== null &&
            academyIdValue !== "" &&
            academyIdValue !== "null"
        ) {
            academyId = Number(academyIdValue);

            if (!Number.isInteger(academyId) || academyId <= 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid academy_id." },
                    { status: 400 }
                );
            }
        }

        const sortOrder =
            sortOrderValue === null || sortOrderValue === ""
                ? 0
                : Number(sortOrderValue);

        const status =
            statusValue === null || statusValue === ""
                ? 1
                : Number(statusValue);

        if (!Number.isInteger(sortOrder)) {
            return NextResponse.json(
                { success: false, message: "Invalid sort_order." },
                { status: 400 }
            );
        }

        if (![0, 1].includes(status)) {
            return NextResponse.json(
                { success: false, message: "Status must be 0 or 1." },
                { status: 400 }
            );
        }

        let categoryImage = existing.category_image;

        if (image && typeof image.arrayBuffer === "function" && image.size > 0) {
            uploadedImage = await saveCategoryImage(image);
            categoryImage = uploadedImage;
        }

        await db.execute(
            `UPDATE cst_product_categories
SET
academy_id = ?,
    category_name = ?,
    slug = ?,
    description = ?,
    category_image = ?,
    sort_order = ?,
    status = ?
        WHERE id = ? AND is_deleted = 0`,
            [
                academyId,
                categoryName,
                slug,
                description,
                categoryImage,
                sortOrder,
                status,
                id,
            ]
        );

        // Remove the old image only after the DB update succeeds.
        if (uploadedImage && existing.category_image) {
            await removeCategoryImage(existing.category_image);
        }

        return NextResponse.json({
            success: true,
            message: "Category updated successfully.",
            data: {
                id,
                academy_id: academyId,
                category_name: categoryName,
                slug,
                description,
                category_image: categoryImage,
                sort_order: sortOrder,
                status,
            },
        });
    } catch (error) {
        if (uploadedImage) {
            await removeCategoryImage(uploadedImage);
        }

        if (isDuplicateError(error)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This slug already exists. Please use a unique slug.",
                },
                { status: 409 }
            );
        }

        if (
            error.message?.includes("Image size") ||
            error.message?.includes("Only JPG") ||
            error.message?.includes("Invalid image")
        ) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        console.error("Update product category error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update category." },
            { status: 500 }
        );
    }
}

// DELETE: Soft delete category
export async function DELETE(request, context) {
    try {
        const id = await getId(context);

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Invalid category ID." },
                { status: 400 }
            );
        }

        const [result] = await db.execute(
            `UPDATE cst_product_categories
             SET is_deleted = 1
             WHERE id = ? AND is_deleted = 0`,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: "Category not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Category deleted successfully.",
        });
    } catch (error) {
        console.error("Delete product category error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete category." },
            { status: 500 }
        );
    }
}