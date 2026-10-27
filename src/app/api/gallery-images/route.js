import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

async function saveImage(file) {
    if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0) {
        throw Object.assign(new Error("Image file is required"), { statusCode: 400 });
    }
    if (!ALLOWED_TYPES[file.type]) {
        throw Object.assign(new Error("Only JPG, PNG and WEBP images are allowed"), { statusCode: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
        throw Object.assign(new Error("Image must not exceed 5MB"), { statusCode: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "images", "uploads", "gallery-images");
    await fs.mkdir(uploadDir, { recursive: true });

    const fileName = `gallery-${Date.now()}-${crypto.randomUUID()}${ALLOWED_TYPES[file.type]}`;
    await fs.writeFile(
        path.join(uploadDir, fileName),
        Buffer.from(await file.arrayBuffer()),
        { flag: "wx" }
    );
    return `/images/uploads/gallery-images/${fileName}`;
}

// GET /api/gallery-images?album_id=1&status=1
export async function GET(request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const album_id = searchParams.get("album_id");
        const status = searchParams.get("status");
        const search = (searchParams.get("search") || "").trim();

        connection = await pool.getConnection();
        let sql = `
            SELECT gi.*, ga.album_title, ga.category_id, CONCAT_WS(' ', u.first_name, u.last_name) AS uploaded_by_name
            FROM cst_gallery_images gi
            INNER JOIN cst_gallery_albums ga ON ga.id = gi.album_id AND ga.is_deleted = 0
            LEFT JOIN cst_users u ON u.id = gi.uploaded_by
            WHERE gi.is_deleted = 0
        `;
        const values = [];

        if (album_id) {
            sql += " AND gi.album_id = ?";
            values.push(album_id);
        }
        if (status !== null && status !== "") {
            sql += " AND gi.status = ?";
            values.push(status);
        }
        if (search) {
            sql += " AND (gi.image_caption LIKE ? OR gi.alt_text LIKE ?)";
            values.push(`%${search}%`, `%${search}%`);
        }
        sql += " ORDER BY gi.sort_order ASC, gi.id DESC";

        const [rows] = await connection.execute(sql, values);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error("GET Gallery Images Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch gallery images" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST /api/gallery-images — multipart/form-data
// Required: album_id, image. Optional: image_caption, alt_text, sort_order, status, uploaded_by.
export async function POST(request) {
    let connection;
    let imagePath = null;
    try {
        const formData = await request.formData();
        const album_id = formData.get("album_id");
        const image = formData.get("image");
        const image_caption = formData.get("image_caption")?.toString().trim() || null;
        const alt_text = formData.get("alt_text")?.toString().trim() || null;
        const sort_order = formData.get("sort_order")?.toString() || "0";
        const status = formData.get("status")?.toString() || "1";
        const uploaded_by = formData.get("uploaded_by")?.toString() || null;

        if (!album_id) {
            return NextResponse.json({ success: false, message: "album_id is required" }, { status: 400 });
        }
        if (!image || typeof image.arrayBuffer !== "function" || image.size <= 0) {
            return NextResponse.json({ success: false, message: "Image file is required" }, { status: 400 });
        }

        connection = await pool.getConnection();
        const [albumRows] = await connection.execute(
            "SELECT id FROM cst_gallery_albums WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [album_id]
        );
        if (!albumRows.length) {
            return NextResponse.json({ success: false, message: "Gallery album not found" }, { status: 404 });
        }

        // Validate uploader when supplied, so the foreign key error is handled cleanly.
        if (uploaded_by) {
            const [userRows] = await connection.execute(
                "SELECT id FROM cst_users WHERE id = ? LIMIT 1", [uploaded_by]
            );
            if (!userRows.length) {
                return NextResponse.json({ success: false, message: "Invalid uploaded_by user" }, { status: 400 });
            }
        }

        imagePath = await saveImage(image);
        const [result] = await connection.execute(
            `INSERT INTO cst_gallery_images
                (album_id, image_path, image_caption, alt_text, sort_order, status, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [album_id, imagePath, image_caption, alt_text, Number(sort_order), Number(status), uploaded_by]
        );

        return NextResponse.json({
            success: true,
            message: "Gallery image uploaded successfully",
            data: { id: result.insertId, album_id: Number(album_id), image_path: imagePath }
        }, { status: 201 });
    } catch (error) {
        console.error("POST Gallery Image Error:", error);
        if (imagePath) {
            await fs.unlink(path.join(process.cwd(), "public", imagePath.replace(/^\//, ""))).catch(() => {});
        }
        if (error.statusCode) {
            return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
        }
        return NextResponse.json({ success: false, message: "Failed to upload gallery image" }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
