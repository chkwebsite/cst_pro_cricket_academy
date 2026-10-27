import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";

// GET: All Gallery Categories
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search") || "";
        const academy_id = searchParams.get("academy_id");
        const status = searchParams.get("status");

        connection = await pool.getConnection();

        let sql = `
SELECT
gc.*,
    a.academy_name,
        CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
            FROM cst_gallery_categories gc
            LEFT JOIN cst_academy a ON a.id = gc.academy_id
            LEFT JOIN cst_users u ON u.id = gc.created_by
            WHERE gc.is_deleted = 0
    `;

        const values = [];

        if (academy_id !== null && academy_id !== "") {
            sql += ` AND gc.academy_id = ? `;
            values.push(academy_id);
        }

        if (status !== null && status !== "") {
            sql += ` AND gc.status = ? `;
            values.push(status);
        }

        if (search.trim()) {
            sql += `
                AND(
        gc.category_name LIKE ?
        OR gc.slug LIKE ?
        OR gc.description LIKE ?
                )
    `;

            const searchValue = `%${search.trim()}%`;
            values.push(searchValue, searchValue, searchValue);
        }

        sql += ` ORDER BY gc.sort_order ASC, gc.id DESC`;

        const [categories] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            data: categories
        });

    } catch (error) {
        console.error("GET Gallery Categories Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch gallery categories"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// POST: Create Gallery Category
export async function POST(request) {
    let connection;
    let imagePath = null;

    try {
        const formData = await request.formData();

        const academy_id = formData.get("academy_id") || null;
        const category_name = formData.get("category_name")?.trim();
        const slug = formData.get("slug")?.trim();
        const description = formData.get("description")?.trim() || null;
        const sort_order = formData.get("sort_order") || 0;
        const status = formData.get("status") ?? 1;
        const created_by = formData.get("created_by") || null;
        const featured_image = formData.get("featured_image");

        if (!category_name || !slug) {
            return NextResponse.json({
                success: false,
                message: "Category name and slug are required"
            }, { status: 400 });
        }

        // Featured image upload
        if (featured_image && typeof featured_image === "object" &&
            typeof featured_image.arrayBuffer === "function" &&
            featured_image.size > 0) {

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

            imagePath = `/images/uploads/gallery-categories/${fileName}`;
        }

        connection = await pool.getConnection();

        // Check duplicate slug
        const [existing] = await connection.execute(
            `SELECT id FROM cst_gallery_categories WHERE slug = ? LIMIT 1`,
            [slug]
        );

        if (existing.length > 0) {
            if (imagePath) {
                await fs.unlink(
                    path.join(process.cwd(), "public", imagePath.replace(/^\//, ""))
                ).catch(() => {});
            }

            return NextResponse.json({
                success: false,
                message: "This slug already exists"
            }, { status: 409 });
        }

        // Validate academy
        if (academy_id !== null) {
            const [academy] = await connection.execute(
                `SELECT id FROM cst_academy WHERE id = ? LIMIT 1`,
                [academy_id]
            );

            if (academy.length === 0) {
                if (imagePath) {
                    await fs.unlink(
                        path.join(process.cwd(), "public", imagePath.replace(/^\//, ""))
                    ).catch(() => {});
                }

                return NextResponse.json({
                    success: false,
                    message: "Invalid academy_id"
                }, { status: 400 });
            }
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_gallery_categories
    (
        academy_id,
        category_name,
        slug,
        description,
        featured_image,
        sort_order,
        status,
        created_by
    )
VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                academy_id,
                category_name,
                slug,
                description,
                imagePath,
                sort_order,
                status,
                created_by
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Gallery category created successfully",
            id: result.insertId
        }, { status: 201 });

    } catch (error) {
        console.error("POST Gallery Category Error:", error);

        if (imagePath) {
            await fs.unlink(
                path.join(process.cwd(), "public", imagePath.replace(/^\//, ""))
            ).catch(() => {});
        }

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({
                success: false,
                message: "Category slug already exists"
            }, { status: 409 });
        }

        return NextResponse.json({
            success: false,
            message: "Failed to create gallery category"
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}