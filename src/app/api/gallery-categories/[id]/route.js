import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";


// GET: Single Gallery Category
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
gc.*,
    a.academy_name,
        CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
             FROM cst_gallery_categories gc
             LEFT JOIN cst_academy a ON a.id = gc.academy_id
             LEFT JOIN cst_users u ON u.id = gc.created_by
             WHERE gc.id = ?
    AND gc.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Gallery category not found"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("GET Single Gallery Category Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch gallery category"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// PUT: Update Gallery Category
export async function PUT(request, { params }) {
    let connection;
    let newImagePath = null;

    try {
        const { id } = await params;
        const formData = await request.formData();

        const academy_id = formData.get("academy_id");
        const category_name = formData.get("category_name")?.trim();
        const slug = formData.get("slug")?.trim();
        const description = formData.get("description")?.trim() || null;
        const sort_order = formData.get("sort_order");
        const status = formData.get("status");
        const created_by = formData.get("created_by");
        const featured_image = formData.get("featured_image");

        if (!category_name || !slug) {
            return NextResponse.json({
                success: false,
                message: "Category name and slug are required"
            }, { status: 400 });
        }

        // Upload new image if provided
        if (
            featured_image &&
            typeof featured_image === "object" &&
            typeof featured_image.arrayBuffer === "function" &&
            featured_image.size > 0
        ) {
            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(featured_image.type)) {
                return NextResponse.json({
                    success: false,
                    message: "Only JPG, JPEG, PNG and WEBP images are allowed"
                }, { status: 400 });
            }

            if (featured_image.size > 5 * 1024 * 1024) {
                return NextResponse.json({
                    success: false,
                    message: "Image size must be less than or equal to 5MB"
                }, { status: 400 });
            }

            const uploadDir = path.join(
                process.cwd(),
                "public",
                "images",
                "uploads",
                "gallery-categories"
            );

            await fs.mkdir(uploadDir, { recursive: true });

            const extension = path.extname(featured_image.name).toLowerCase();
            const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;

            await fs.writeFile(
                path.join(uploadDir, fileName),
                Buffer.from(await featured_image.arrayBuffer())
            );

            newImagePath = `/images/uploads/gallery-categories/${fileName}`;
        }

        connection = await pool.getConnection();

        const [existingRows] = await connection.execute(
            `SELECT id, featured_image
             FROM cst_gallery_categories
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (existingRows.length === 0) {
            if (newImagePath) {
                await fs.unlink(
                    path.join(process.cwd(), "public", newImagePath.replace(/^\//, ""))
                ).catch(() => { });
            }

            return NextResponse.json({
                success: false,
                message: "Gallery category not found"
            }, { status: 404 });
        }

        const oldImagePath = existingRows[0].featured_image;

        // Check duplicate slug
        const [duplicateSlug] = await connection.execute(
            `SELECT id
             FROM cst_gallery_categories
             WHERE slug = ? AND id != ?
    LIMIT 1`,
            [slug, id]
        );

        if (duplicateSlug.length > 0) {
            if (newImagePath) {
                await fs.unlink(
                    path.join(process.cwd(), "public", newImagePath.replace(/^\//, ""))
                ).catch(() => { });
            }

            return NextResponse.json({
                success: false,
                message: "This slug already exists"
            }, { status: 409 });
        }

        const finalAcademyId =
            academy_id === null || academy_id === "" ? null : academy_id;

        if (finalAcademyId !== null) {
            const [academy] = await connection.execute(
                `SELECT id FROM cst_academy WHERE id = ? LIMIT 1`,
                [finalAcademyId]
            );

            if (academy.length === 0) {
                if (newImagePath) {
                    await fs.unlink(
                        path.join(process.cwd(), "public", newImagePath.replace(/^\//, ""))
                    ).catch(() => { });
                }

                return NextResponse.json({
                    success: false,
                    message: "Invalid academy_id"
                }, { status: 400 });
            }
        }

        await connection.execute(
            `UPDATE cst_gallery_categories
SET
academy_id = ?,
    category_name = ?,
    slug = ?,
    description = ?,
    featured_image = ?,
    sort_order = ?,
    status = ?,
    created_by = ?
        WHERE id = ? AND is_deleted = 0`,
            [
                finalAcademyId,
                category_name,
                slug,
                description,
                newImagePath || oldImagePath,
                sort_order === null || sort_order === "" ? 0 : sort_order,
                status === null || status === "" ? 1 : status,
                created_by === null || created_by === "" ? null : created_by,
                id
            ]
        );

        // Delete old image only after successful DB update
        if (newImagePath && oldImagePath) {
            const oldFilePath = path.join(
                process.cwd(),
                "public",
                oldImagePath.replace(/^\//, "")
            );

            await fs.unlink(oldFilePath).catch(() => { });
        }

        return NextResponse.json({
            success: true,
            message: "Gallery category updated successfully"
        });

    } catch (error) {
        console.error("PUT Gallery Category Error:", error);

        if (newImagePath) {
            await fs.unlink(
                path.join(process.cwd(), "public", newImagePath.replace(/^\//, ""))
            ).catch(() => { });
        }

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({
                success: false,
                message: "Category slug already exists"
            }, { status: 409 });
        }

        return NextResponse.json({
            success: false,
            message: "Failed to update gallery category"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// DELETE: Soft Delete Gallery Category
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT id
             FROM cst_gallery_categories
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Gallery category not found"
            }, { status: 404 });
        }

        // Category with active albums cannot be deleted
        const [albums] = await connection.execute(
            `SELECT id
             FROM cst_gallery_albums
             WHERE category_id = ?
    AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (albums.length > 0) {
            return NextResponse.json({
                success: false,
                message: "Please move or delete this category's albums before deleting the category"
            }, { status: 409 });
        }

        await connection.execute(
            `UPDATE cst_gallery_categories
             SET is_deleted = 1
             WHERE id = ? `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Gallery category deleted successfully"
        });

    } catch (error) {
        console.error("DELETE Gallery Category Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete gallery category"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}