import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";


// GET: Single Gallery Album
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
ga.*,
    gc.category_name,
    a.academy_name,
        b.branch_name,
        CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
             FROM cst_gallery_albums ga
             LEFT JOIN cst_gallery_categories gc
                ON gc.id = ga.category_id
                AND gc.is_deleted = 0
             LEFT JOIN cst_academy a
                ON a.id = ga.academy_id
             LEFT JOIN cst_branch b
                ON b.id = ga.branch_id
             LEFT JOIN cst_users u
                ON u.id = ga.created_by
             WHERE ga.id = ?
    AND ga.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Gallery album not found"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("GET Single Gallery Album Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch gallery album"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// PUT: Update Gallery Album
export async function PUT(request, { params }) {
    let connection;
    let newCoverImagePath = null;

    try {
        const { id } = await params;
        const formData = await request.formData();

        const academy_id = formData.get("academy_id") || null;
        const category_id = formData.get("category_id") || null;
        const branch_id = formData.get("branch_id") || null;

        const album_title = formData.get("album_title")?.trim();
        const slug = formData.get("slug")?.trim();
        const description = formData.get("description")?.trim() || null;
        const event_date = formData.get("event_date") || null;
        const location = formData.get("location")?.trim() || null;

        const is_featured = formData.get("is_featured") ?? 0;
        const sort_order = formData.get("sort_order") || 0;
        const status = formData.get("status") ?? 1;
        const created_by = formData.get("created_by") || null;

        const cover_image = formData.get("cover_image");

        if (!album_title || !slug) {
            return NextResponse.json({
                success: false,
                message: "Album title and slug are required"
            }, { status: 400 });
        }

        // Upload new cover image if provided
        if (
            cover_image &&
            typeof cover_image === "object" &&
            typeof cover_image.arrayBuffer === "function" &&
            cover_image.size > 0
        ) {
            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(cover_image.type)) {
                return NextResponse.json({
                    success: false,
                    message: "Only JPG, PNG and WEBP images are allowed"
                }, { status: 400 });
            }

            if (cover_image.size > 2 * 1024 * 1024) {
                return NextResponse.json({
                    success: false,
                    message: "Cover image must not exceed 2MB"
                }, { status: 400 });
            }

            const uploadDir = path.join(
                process.cwd(),
                "public",
                "images",
                "uploads",
                "gallery-albums"
            );

            await fs.mkdir(uploadDir, { recursive: true });

            const extension = path.extname(cover_image.name).toLowerCase();
            const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;

            await fs.writeFile(
                path.join(uploadDir, fileName),
                Buffer.from(await cover_image.arrayBuffer())
            );

            newCoverImagePath = `/images/uploads/gallery-albums/${fileName}`;
        }

        connection = await pool.getConnection();

        const [existingRows] = await connection.execute(
            `SELECT *
    FROM cst_gallery_albums
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Gallery album not found"
            }, { status: 404 });
        }

        const oldAlbum = existingRows[0];

        // Validate academy
        if (academy_id !== null) {
            const [academyRows] = await connection.execute(
                `SELECT id FROM cst_academy WHERE id = ? LIMIT 1`,
                [academy_id]
            );

            if (academyRows.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "Invalid academy_id"
                }, { status: 400 });
            }
        }

        // Validate branch and academy relationship
        if (branch_id !== null) {
            const [branchRows] = await connection.execute(
                `SELECT id, academy_id
                 FROM cst_branch
                 WHERE id = ?
    LIMIT 1`,
                [branch_id]
            );

            if (branchRows.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "Invalid branch_id"
                }, { status: 400 });
            }

            if (
                academy_id !== null &&
                Number(branchRows[0].academy_id) !== Number(academy_id)
            ) {
                return NextResponse.json({
                    success: false,
                    message: "Selected branch does not belong to the selected academy"
                }, { status: 400 });
            }
        }

        // Validate category
        if (category_id !== null) {
            const [categoryRows] = await connection.execute(
                `SELECT id, academy_id
                 FROM cst_gallery_categories
                 WHERE id = ?
    AND is_deleted = 0
                 LIMIT 1`,
                [category_id]
            );

            if (categoryRows.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "Invalid gallery category"
                }, { status: 400 });
            }

            if (
                academy_id !== null &&
                categoryRows[0].academy_id !== null &&
                Number(categoryRows[0].academy_id) !== Number(academy_id)
            ) {
                return NextResponse.json({
                    success: false,
                    message: "Selected category does not belong to the selected academy"
                }, { status: 400 });
            }
        }

        // Check duplicate slug
        const [duplicateSlug] = await connection.execute(
            `SELECT id
             FROM cst_gallery_albums
             WHERE slug = ? AND id != ?
    LIMIT 1`,
            [slug, id]
        );

        if (duplicateSlug.length > 0) {
            return NextResponse.json({
                success: false,
                message: "This album slug already exists"
            }, { status: 409 });
        }

        await connection.execute(
            `UPDATE cst_gallery_albums
SET
academy_id = ?,
    category_id = ?,
    branch_id = ?,
    album_title = ?,
    slug = ?,
    description = ?,
    cover_image = ?,
    event_date = ?,
    location = ?,
    is_featured = ?,
    sort_order = ?,
    status = ?,
    created_by = ?
        WHERE id = ? AND is_deleted = 0`,
            [
                academy_id,
                category_id,
                branch_id,
                album_title,
                slug,
                description,
                newCoverImagePath || oldAlbum.cover_image,
                event_date,
                location,
                is_featured,
                sort_order,
                status,
                created_by,
                id
            ]
        );

        // Delete previous image after successful update
        if (newCoverImagePath && oldAlbum.cover_image) {
            await fs.unlink(
                path.join(
                    process.cwd(),
                    "public",
                    oldAlbum.cover_image.replace(/^\//, "")
                )
            ).catch(() => { });
        }

        return NextResponse.json({
            success: true,
            message: "Gallery album updated successfully"
        });

    } catch (error) {
        console.error("PUT Gallery Album Error:", error);

        if (newCoverImagePath) {
            await fs.unlink(
                path.join(
                    process.cwd(),
                    "public",
                    newCoverImagePath.replace(/^\//, "")
                )
            ).catch(() => { });
        }

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({
                success: false,
                message: "Album slug already exists"
            }, { status: 409 });
        }

        return NextResponse.json({
            success: false,
            message: "Failed to update gallery album"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// DELETE: Soft Delete Gallery Album
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT id
             FROM cst_gallery_albums
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Gallery album not found"
            }, { status: 404 });
        }

        await connection.execute(
            `UPDATE cst_gallery_albums
             SET is_deleted = 1
             WHERE id = ? `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Gallery album deleted successfully"
        });

    } catch (error) {
        console.error("DELETE Gallery Album Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete gallery album"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}