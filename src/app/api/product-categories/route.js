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

    // Validate actual file signature, not only the MIME type.
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

    // Accept only a filename, never a path supplied by the client.
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

// GET: List categories
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const academyId = searchParams.get("academy_id");
        const search = searchParams.get("search")?.trim();
        const status = searchParams.get("status");

        let sql = `
SELECT
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
            WHERE is_deleted = 0
    `;

        const params = [];

        if (academyId !== null && academyId !== "") {
            if (academyId === "null") {
                sql += " AND academy_id IS NULL";
            } else {
                const parsedId = Number(academyId);

                if (!Number.isInteger(parsedId) || parsedId <= 0) {
                    return NextResponse.json(
                        { success: false, message: "Invalid academy_id." },
                        { status: 400 }
                    );
                }

                sql += " AND academy_id = ?";
                params.push(parsedId);
            }
        }

        if (search) {
            sql += `
AND(
    category_name LIKE ?
    OR slug LIKE ?
    OR description LIKE ?
                )
    `;

            const searchValue = `%${search}%`;
            params.push(searchValue, searchValue, searchValue);
        }

        if (status !== null && status !== "") {
            if (!["0", "1"].includes(status)) {
                return NextResponse.json(
                    { success: false, message: "Invalid status." },
                    { status: 400 }
                );
            }

            sql += " AND status = ?";
            params.push(Number(status));
        }

        sql += " ORDER BY sort_order ASC, id DESC";

        const [categories] = await db.query(sql, params);

        return NextResponse.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        console.error("Get product categories error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch categories." },
            { status: 500 }
        );
    }
}

// POST: Create category
export async function POST(request) {
    let uploadedImage = null;

    try {
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

        // Slugs are URL-friendly: cricket-kits, batting-gloves, etc.
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

        if (image && typeof image.arrayBuffer === "function" && image.size > 0) {
            uploadedImage = await saveCategoryImage(image);
        }

        const [result] = await db.execute(
            `INSERT INTO cst_product_categories
    (
        academy_id,
        category_name,
        slug,
        description,
        category_image,
        sort_order,
        status
    )
VALUES(?, ?, ?, ?, ?, ?, ?)`,
            [
                academyId,
                categoryName,
                slug,
                description,
                uploadedImage,
                sortOrder,
                status,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Category created successfully.",
                data: {
                    id: result.insertId,
                    academy_id: academyId,
                    category_name: categoryName,
                    slug,
                    description,
                    category_image: uploadedImage,
                    sort_order: sortOrder,
                    status,
                },
            },
            { status: 201 }
        );
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

        console.error("Create product category error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to create category." },
            { status: 500 }
        );
    }
}