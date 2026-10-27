import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import pool from "@/app/components/lib/db";


// =====================================================
// GET SINGLE IMAGE
// GET /api/ground-images/1
// =====================================================
export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid image ID is required",
                },
                { status: 400 }
            );
        }

        const [rows] = await connection.query(
            `SELECT
                id,
                ground_id,
                ground_image,
                is_primary,
                status,
                created_at
             FROM cst_ground_images
             WHERE id = ?
             AND status = 1
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground image not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                data: rows[0],
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("GET GROUND IMAGE ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground image",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// UPDATE IMAGE
// PUT /api/ground-images/1
// FormData
// ground_id
// ground_image
// is_primary
// status
// =====================================================
export async function PUT(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid image ID is required",
                },
                { status: 400 }
            );
        }

        const formData = await request.formData();

        const ground_id = formData.get("ground_id");
        const is_primary = formData.get("is_primary");
        const status = formData.get("status");
        const file = formData.get("ground_image");

        // ------------------------------------------
        // CHECK EXISTING IMAGE
        // ------------------------------------------
        const [existingRows] = await connection.query(
            `SELECT
                id,
                ground_id,
                ground_image,
                is_primary,
                status
             FROM cst_ground_images
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground image not found",
                },
                { status: 404 }
            );
        }

        const existingImage = existingRows[0];

        // ------------------------------------------
        // GROUND ID
        // ------------------------------------------
        const finalGroundId =
            ground_id || existingImage.ground_id;

        // ------------------------------------------
        // CHECK GROUND
        // ------------------------------------------
        const [groundRows] = await connection.query(
            `SELECT id
             FROM cst_ground
             WHERE id = ?
             AND status = 1
             AND is_deleted = 0
             LIMIT 1`,
            [finalGroundId]
        );

        if (groundRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground not found",
                },
                { status: 404 }
            );
        }

        // ------------------------------------------
        // VALUES
        // ------------------------------------------
        const finalPrimary =
            is_primary !== null
                ? Number(is_primary)
                : existingImage.is_primary;

        const finalStatus =
            status !== null
                ? Number(status)
                : existingImage.status;

        // ------------------------------------------
        // VALIDATE PRIMARY
        // ------------------------------------------
        if (![0, 1].includes(finalPrimary)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "is_primary must be 0 or 1",
                },
                { status: 400 }
            );
        }

        // ------------------------------------------
        // VALIDATE STATUS
        // ------------------------------------------
        if (![0, 1].includes(finalStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "status must be 0 or 1",
                },
                { status: 400 }
            );
        }

        await connection.beginTransaction();

        let finalImagePath = existingImage.ground_image;

        // =================================================
        // IF NEW IMAGE UPLOADED
        // =================================================
        if (
            file &&
            typeof file.arrayBuffer === "function" &&
            file.size > 0
        ) {
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
                        message:
                            "Only JPG, JPEG, PNG and WEBP images are allowed",
                    },
                    { status: 400 }
                );
            }

            // 5 MB
            if (file.size > 5 * 1024 * 1024) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Image size must be less than 5MB",
                    },
                    { status: 400 }
                );
            }

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

            const extension =
                path.extname(file.name).toLowerCase() || ".jpg";

            const fileName =
                `${Date.now()}-${Math.floor(
                    Math.random() * 1000000
                )}${extension}`;

            const filePath = path.join(
                uploadDir,
                fileName
            );

            const buffer = Buffer.from(
                await file.arrayBuffer()
            );

            await fs.writeFile(
                filePath,
                buffer
            );

            finalImagePath =
                `/images/uploads/grounds/${fileName}`;

            // ------------------------------------------
            // DELETE OLD IMAGE FILE
            // ------------------------------------------
            if (existingImage.ground_image) {
                const oldImagePath = path.join(
                    process.cwd(),
                    "public",
                    existingImage.ground_image.replace(
                        /^\/+/,
                        ""
                    )
                );

                try {
                    await fs.unlink(oldImagePath);
                } catch (error) {
                    console.log(
                        "Old image not found:",
                        error.message
                    );
                }
            }
        }

        // =================================================
        // IF SETTING THIS IMAGE AS PRIMARY
        // REMOVE PRIMARY FROM OTHER IMAGES
        // =================================================
        if (finalPrimary === 1) {
            await connection.query(
                `UPDATE cst_ground_images
                 SET is_primary = 0
                 WHERE ground_id = ?
                 AND id != ?`,
                [
                    finalGroundId,
                    id,
                ]
            );
        }

        // =================================================
        // UPDATE DATABASE
        // =================================================
        await connection.query(
            `UPDATE cst_ground_images
             SET
                ground_id = ?,
                ground_image = ?,
                is_primary = ?,
                status = ?
             WHERE id = ?`,
            [
                finalGroundId,
                finalImagePath,
                finalPrimary,
                finalStatus,
                id,
            ]
        );

        await connection.commit();

        // ------------------------------------------
        // GET UPDATED RECORD
        // ------------------------------------------
        const [updatedRows] = await connection.query(
            `SELECT
                id,
                ground_id,
                ground_image,
                is_primary,
                status,
                created_at
             FROM cst_ground_images
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Ground image updated successfully",
                data: updatedRows[0],
            },
            { status: 200 }
        );

    } catch (error) {
        await connection.rollback();

        console.error(
            "UPDATE GROUND IMAGE ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update ground image",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// DELETE IMAGE
// DELETE /api/ground-images/1
// =====================================================
export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid image ID is required",
                },
                { status: 400 }
            );
        }

        // ------------------------------------------
        // FIND IMAGE
        // ------------------------------------------
        const [rows] = await connection.query(
            `SELECT
                id,
                ground_id,
                ground_image,
                is_primary
             FROM cst_ground_images
             WHERE id = ?
             AND status = 1
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground image not found",
                },
                { status: 404 }
            );
        }

        const image = rows[0];

        await connection.beginTransaction();

        // ------------------------------------------
        // SOFT DELETE
        // ------------------------------------------
        await connection.query(
            `UPDATE cst_ground_images
             SET status = 0,
                 is_primary = 0
             WHERE id = ?`,
            [id]
        );

        // ------------------------------------------
        // DELETE PHYSICAL FILE
        // ------------------------------------------
        if (image.ground_image) {
            const imagePath = path.join(
                process.cwd(),
                "public",
                image.ground_image.replace(/^\/+/, "")
            );

            try {
                await fs.unlink(imagePath);
            } catch (error) {
                console.log(
                    "Image file not found:",
                    error.message
                );
            }
        }

        // ------------------------------------------
        // IF PRIMARY IMAGE WAS DELETED
        // MAKE ANOTHER IMAGE PRIMARY
        // ------------------------------------------
        if (image.is_primary === 1) {
            const [nextImage] = await connection.query(
                `SELECT id
                 FROM cst_ground_images
                 WHERE ground_id = ?
                 AND status = 1
                 ORDER BY id ASC
                 LIMIT 1`,
                [image.ground_id]
            );

            if (nextImage.length > 0) {
                await connection.query(
                    `UPDATE cst_ground_images
                     SET is_primary = 1
                     WHERE id = ?`,
                    [nextImage[0].id]
                );
            }
        }

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Ground image deleted successfully",
            },
            { status: 200 }
        );

    } catch (error) {
        await connection.rollback();

        console.error(
            "DELETE GROUND IMAGE ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete ground image",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}