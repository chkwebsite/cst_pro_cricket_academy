import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import pool from "@/app/components/lib/db";


// ======================================================
// GET GROUND IMAGES
// GET /api/ground-images
// GET /api/ground-images?ground_id=1
// ======================================================
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const groundId = searchParams.get("ground_id")?.trim() || "";
        const academyId = searchParams.get("academy_id")?.trim() || "";

        let sql = `
            SELECT
                id,
                ground_id,
                ground_image,
                is_primary,
                status,
                created_at
            FROM cst_ground_images
            WHERE status = 1
        `;

        const values = [];

        // ==========================================
        // GROUND ID FILTER
        // ==========================================

        if (groundId) {

            if (isNaN(groundId)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid ground ID"
                    },
                    { status: 400 }
                );
            }

            sql += ` AND ground_id = ?`;
            values.push(groundId);
        }

        if (academyId) {
            if (isNaN(academyId)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid academy ID"
                    },
                    { status: 400 }
                );
            }

            sql += ` AND ground_id IN (
                SELECT id
                FROM cst_ground
                WHERE academy_id = ?
                AND is_deleted = 0
            )`;
            values.push(academyId);
        }

        sql += `
            ORDER BY
                is_primary DESC,
                id DESC
        `;

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            message: "Ground images fetched successfully",
            data: rows,
            total: rows.length
        });

    } catch (error) {

        console.error("GET GROUND IMAGES ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground images",
                error: error.message
            },
            { status: 500 }
        );

    } finally {

        if (connection) {
            connection.release();
        }
    }
}



export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const formData = await request.formData();

        const ground_id = formData.get("ground_id");
        const files = formData.getAll("ground_images");

        // -----------------------------
        // VALIDATION
        // -----------------------------
        if (!ground_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground ID is required",
                },
                { status: 400 }
            );
        }

        if (!files || files.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "At least one image is required",
                },
                { status: 400 }
            );
        }

        // Check ground
        const [ground] = await connection.query(
            `SELECT id
             FROM cst_ground
             WHERE id = ?
             AND status = 1
             AND is_deleted = 0
             LIMIT 1`,
            [ground_id]
        );

        if (ground.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground not found",
                },
                { status: 404 }
            );
        }

        // -----------------------------
        // UPLOAD DIRECTORY
        // -----------------------------
        const uploadDir = path.join(
            process.cwd(),
            "public",
            "images",
            "uploads",
            "grounds"
        );

        await fs.mkdir(uploadDir, {
            recursive: true,
        });

        // Does this ground already have an active primary image?
        const [primaryRows] = await connection.query(
            `SELECT id
             FROM cst_ground_images
             WHERE ground_id = ?
             AND status = 1
             AND is_primary = 1
             LIMIT 1`,
            [ground_id]
        );
        const hasPrimary = primaryRows.length > 0;

        await connection.beginTransaction();

        const uploadedImages = [];

        // -----------------------------
        // MULTIPLE FILE UPLOAD
        // -----------------------------
        for (const file of files) {
            if (!file || typeof file.arrayBuffer !== "function") {
                continue;
            }

            // Check image type
            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
            ];

            if (!allowedTypes.includes(file.type)) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: `Invalid image type: ${file.name}`,
                    },
                    { status: 400 }
                );
            }

            // 5 MB limit
            if (file.size > 5 * 1024 * 1024) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: `${file.name} exceeds 5MB limit`,
                    },
                    { status: 400 }
                );
            }

            // Extension
            const extension =
                path.extname(file.name).toLowerCase() || ".jpg";

            // Unique filename
            const fileName =
                `${Date.now()}-${Math.floor(Math.random() * 1000000)}${extension}`;

            const filePath = path.join(uploadDir, fileName);

            // Save file
            const buffer = Buffer.from(
                await file.arrayBuffer()
            );

            await fs.writeFile(filePath, buffer);

            // First uploaded image becomes primary only if the
            // ground does not already have a primary image
            const isPrimary =
                !hasPrimary && uploadedImages.length === 0 ? 1 : 0;

            // Database path
            const imagePath =
                `/images/uploads/grounds/${fileName}`;

            const [result] = await connection.query(
                `INSERT INTO cst_ground_images
                (
                    ground_id,
                    ground_image,
                    is_primary,
                    status
                )
                VALUES (?, ?, ?, 1)`,
                [
                    ground_id,
                    imagePath,
                    isPrimary,
                ]
            );

            uploadedImages.push({
                id: result.insertId,
                ground_id: Number(ground_id),
                ground_image: imagePath,
                is_primary: isPrimary,
            });
        }

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Ground images uploaded successfully",
                data: uploadedImages,
            },
            { status: 201 }
        );
    } catch (error) {
        await connection.rollback();

        console.error("GROUND IMAGE UPLOAD ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to upload ground images",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}