import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";

// GET /api/gallery-images/:id
export async function GET(request, { params }) {
    let connection;
    try {
        const { id } = await params;
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            `SELECT gi.*, ga.album_title, CONCAT_WS(' ', u.first_name, u.last_name) AS uploaded_by_name
             FROM cst_gallery_images gi
             INNER JOIN cst_gallery_albums ga ON ga.id = gi.album_id AND ga.is_deleted = 0
             LEFT JOIN cst_users u ON u.id = gi.uploaded_by
             WHERE gi.id = ? AND gi.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (!rows.length) {
            return NextResponse.json({ success: false, message: "Gallery image not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("GET Single Gallery Image Error:", error);
        return NextResponse.json({ success: false, message: "Failed to fetch gallery image" }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// PUT /api/gallery-images/:id — update image details (and optionally replace the image file)
export async function PUT(request, { params }) {
    let connection;
    let newImagePath = null;
    try {
        const { id } = await params;
        const formData = await request.formData();
        const album_id = formData.get("album_id");
        const image_caption = formData.get("image_caption")?.toString().trim() || null;
        const alt_text = formData.get("alt_text")?.toString().trim() || null;
        const sort_order = formData.get("sort_order")?.toString() || "0";
        const status = formData.get("status")?.toString() || "1";
        const imageFile = formData.get("image");

        connection = await pool.getConnection();
        const [existing] = await connection.execute(
            "SELECT * FROM cst_gallery_images WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [id]
        );
        if (!existing.length) {
            return NextResponse.json({ success: false, message: "Gallery image not found" }, { status: 404 });
        }
        const currentRecord = existing[0];
        const targetAlbumId = album_id || currentRecord.album_id;

        if (album_id) {
            const [albumRows] = await connection.execute(
                "SELECT id FROM cst_gallery_albums WHERE id = ? AND is_deleted = 0 LIMIT 1",
                [targetAlbumId]
            );
            if (!albumRows.length) {
                return NextResponse.json({ success: false, message: "Gallery album not found" }, { status: 404 });
            }
        }

        if (imageFile && typeof imageFile.arrayBuffer === "function" && imageFile.size > 0) {
            const ALLOWED_TYPES = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp",
            };
            if (!ALLOWED_TYPES[imageFile.type]) {
                return NextResponse.json({ success: false, message: "Only JPG, PNG and WEBP images are allowed" }, { status: 400 });
            }
            if (imageFile.size > 5 * 1024 * 1024) {
                return NextResponse.json({ success: false, message: "Image must not exceed 5MB" }, { status: 400 });
            }
            const uploadDir = path.join(process.cwd(), "public", "images", "uploads", "gallery-images");
            await fs.mkdir(uploadDir, { recursive: true });
            const fileName = `gallery-${Date.now()}-${crypto.randomUUID()}${ALLOWED_TYPES[imageFile.type]}`;
            await fs.writeFile(
                path.join(uploadDir, fileName),
                Buffer.from(await imageFile.arrayBuffer()),
                { flag: "wx" }
            );
            newImagePath = `/images/uploads/gallery-images/${fileName}`;
        }

        await connection.execute(
            `UPDATE cst_gallery_images
             SET album_id = ?, image_path = ?, image_caption = ?, alt_text = ?, sort_order = ?, status = ?
             WHERE id = ? AND is_deleted = 0`,
            [
                targetAlbumId,
                newImagePath || currentRecord.image_path,
                image_caption,
                alt_text,
                Number(sort_order),
                Number(status),
                id,
            ]
        );

        if (newImagePath && currentRecord.image_path) {
            const uploadPrefix = "/images/uploads/gallery-images/";
            if (currentRecord.image_path.startsWith(uploadPrefix)) {
                const oldFile = path.basename(currentRecord.image_path);
                await fs.unlink(path.join(process.cwd(), "public", "images", "uploads", "gallery-images", oldFile)).catch(() => {});
            }
        }

        return NextResponse.json({ success: true, message: "Gallery image updated successfully" });
    } catch (error) {
        console.error("PUT Gallery Image Error:", error);
        if (newImagePath) {
            const fileName = path.basename(newImagePath);
            await fs.unlink(path.join(process.cwd(), "public", "images", "uploads", "gallery-images", fileName)).catch(() => {});
        }
        return NextResponse.json({ success: false, message: "Failed to update gallery image" }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// DELETE /api/gallery-images/:id — soft delete the database record and remove its file.
export async function DELETE(request, { params }) {
    let connection;
    try {
        const { id } = await params;
        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            "SELECT id, image_path FROM cst_gallery_images WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [id]
        );
        if (!rows.length) {
            return NextResponse.json({ success: false, message: "Gallery image not found" }, { status: 404 });
        }

        await connection.execute(
            "UPDATE cst_gallery_images SET is_deleted = 1 WHERE id = ? AND is_deleted = 0",
            [id]
        );

        // Best-effort file cleanup after the DB update.
        const imagePath = rows[0].image_path;
        const uploadPrefix = "/images/uploads/gallery-images/";
        if (imagePath && imagePath.startsWith(uploadPrefix)) {
            const fileName = path.basename(imagePath);
            await fs.unlink(path.join(process.cwd(), "public", "images", "uploads", "gallery-images", fileName)).catch(() => {});
        }

        return NextResponse.json({ success: true, message: "Gallery image deleted successfully" });
    } catch (error) {
        console.error("DELETE Gallery Image Error:", error);
        return NextResponse.json({ success: false, message: "Failed to delete gallery image" }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
