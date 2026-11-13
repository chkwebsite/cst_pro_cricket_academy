import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";

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
        const authResult = await getAuthenticatedUser(request);
        const authUser = authResult?.user?.id ? authResult.user : (authResult?.id ? authResult : null);
        const { searchParams } = new URL(request.url);

        const academyId = searchParams.get("academy_id");
        const search = searchParams.get("search")?.trim();
        const status = searchParams.get("status");

        let sql = `
SELECT
    c.id,
    c.academy_id,
    COALESCE(ac.academy_name, 'All Academies / CST') AS academy_name,
    c.category_name,
    c.slug,
    c.description,
    c.category_image,
    c.sort_order,
    c.status,
    c.is_deleted,
    c.created_at,
    c.updated_at
FROM cst_product_categories c
LEFT JOIN cst_academy ac ON ac.id = c.academy_id
WHERE c.is_deleted = 0
    `;

        const params = [];

        if (authUser) {
            if (authUser.isSuperAdmin) {
                if (academyId !== null && academyId !== "" && academyId !== undefined) {
                    if (academyId === "null") {
                        sql += " AND c.academy_id IS NULL";
                    } else {
                        const parsedId = Number(academyId);
                        if (!Number.isInteger(parsedId) || parsedId <= 0) {
                            return NextResponse.json(
                                { success: false, message: "Invalid academy_id." },
                                { status: 400 }
                            );
                        }
                        sql += " AND c.academy_id = ?";
                        params.push(parsedId);
                    }
                }
            } else if (authUser.academy_id) {
                sql += " AND (c.academy_id = ? OR c.academy_id IS NULL)";
                params.push(authUser.academy_id);
            }
        } else {
            sql += " AND c.status = 1";
            if (academyId !== null && academyId !== "") {
                if (academyId === "null") {
                    sql += " AND c.academy_id IS NULL";
                } else {
                    const parsedId = Number(academyId);
                    if (Number.isInteger(parsedId) && parsedId > 0) {
                        sql += " AND (c.academy_id = ? OR c.academy_id IS NULL)";
                        params.push(parsedId);
                    }
                }
            }
        }

        if (search) {
            sql += `
AND (
    c.category_name LIKE ?
    OR c.slug LIKE ?
    OR c.description LIKE ?
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

            sql += " AND c.status = ?";
            params.push(Number(status));
        }

        sql += " ORDER BY c.sort_order ASC, c.id DESC";

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
        const authUser = await getAuthenticatedUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Only administrators can create product categories." },
                { status: 403 }
            );
        }

        const contentType = request.headers.get("content-type") || "";
        let academyIdValue, categoryName, slug, description, sortOrderValue, statusValue, image = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            academyIdValue = formData.get("academy_id");
            categoryName = formData.get("category_name")?.trim();
            slug = formData.get("slug")?.trim().toLowerCase();
            description = formData.get("description")?.trim() || null;
            sortOrderValue = formData.get("sort_order");
            statusValue = formData.get("status");
            image = formData.get("category_image");
        } else {
            const body = await request.json();
            academyIdValue = body.academy_id;
            categoryName = body.category_name?.trim();
            slug = (body.slug || body.category_name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))?.trim();
            description = body.description?.trim() || null;
            sortOrderValue = body.sort_order;
            statusValue = body.status;
        }

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

        if (!authUser.isSuperAdmin) {
            academyId = authUser.academy_id;
        } else if (
            academyIdValue !== null &&
            academyIdValue !== undefined &&
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
            sortOrderValue === null || sortOrderValue === undefined || sortOrderValue === ""
                ? 0
                : Number(sortOrderValue);

        const status =
            statusValue === null || statusValue === undefined || statusValue === ""
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