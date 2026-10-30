import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";


// GET: All Gallery Albums
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search") || "";
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const category_id = searchParams.get("category_id");
        const status = searchParams.get("status");
        const is_featured = searchParams.get("is_featured");

        connection = await pool.getConnection();

        let sql = `
SELECT
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
            WHERE ga.is_deleted = 0
    `;

        const values = [];

        if (academy_id !== null && academy_id !== "") {
            sql += ` AND ga.academy_id = ? `;
            values.push(academy_id);
        }

        if (branch_id !== null && branch_id !== "") {
            sql += ` AND ga.branch_id = ? `;
            values.push(branch_id);
        }

        if (category_id !== null && category_id !== "") {
            sql += ` AND ga.category_id = ? `;
            values.push(category_id);
        }

        if (status !== null && status !== "") {
            sql += ` AND ga.status = ? `;
            values.push(status);
        }

        if (is_featured !== null && is_featured !== "") {
            sql += ` AND ga.is_featured = ? `;
            values.push(is_featured);
        }

        if (search.trim()) {
            sql += `
                AND(
        ga.album_title LIKE ?
        OR ga.slug LIKE ?
        OR ga.description LIKE ?
        OR ga.location LIKE ?
        OR gc.category_name LIKE ?
                )
    `;

            const searchValue = `%${search.trim()}%`;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        sql += ` ORDER BY ga.sort_order ASC, ga.id DESC`;

        const [albums] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            data: albums
        });

    } catch (error) {
        console.error("GET Gallery Albums Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch gallery albums"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// POST: Create Gallery Album
export async function POST(request) {
    let connection;
    let coverImagePath = null;

    try {
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

        // Validate and upload cover image
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

            coverImagePath = `/images/uploads/gallery-albums/${fileName}`;
        }

        connection = await pool.getConnection();

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
        const [slugRows] = await connection.execute(
            `SELECT id FROM cst_gallery_albums WHERE slug = ? LIMIT 1`,
            [slug]
        );

        if (slugRows.length > 0) {
            return NextResponse.json({
                success: false,
                message: "This album slug already exists"
            }, { status: 409 });
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_gallery_albums
    (
        academy_id,
        category_id,
        branch_id,
        album_title,
        slug,
        description,
        cover_image,
        event_date,
        location,
        is_featured,
        sort_order,
        status,
        created_by
    )
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                academy_id,
                category_id,
                branch_id,
                album_title,
                slug,
                description,
                coverImagePath,
                event_date,
                location,
                is_featured,
                sort_order,
                status,
                created_by
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Gallery album created successfully",
            id: result.insertId
        }, { status: 201 });

    } catch (error) {
        console.error("POST Gallery Album Error:", error);

        if (coverImagePath) {
            await fs.unlink(
                path.join(
                    process.cwd(),
                    "public",
                    coverImagePath.replace(/^\//, "")
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
            message: "Failed to create gallery album"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}