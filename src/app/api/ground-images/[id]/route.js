import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

async function verifyGroundOwnership(connection, groundId, authUser) {
    const [rows] = await connection.query(
        `SELECT id, academy_id, branch_id FROM cst_ground WHERE id = ? AND is_deleted = 0 LIMIT 1`,
        [groundId]
    );
    if (rows.length === 0) return { allowed: false, notFound: true };
    const g = rows[0];
    if (authUser.isSuperAdmin) return { allowed: true, ground: g };
    if (authUser.isPlayer) return { allowed: false, ground: g };
    if (Number(g.academy_id) !== Number(authUser.academy_id)) return { allowed: false, ground: g };
    if (authUser.isAcademyAdmin) return { allowed: true, ground: g };
    if (authUser.isBranchAdmin) return { allowed: Number(g.branch_id) === Number(authUser.branch_id), ground: g };
    const allowedBranches = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
    return { allowed: allowedBranches.includes(Number(g.branch_id)), ground: g };
}

// =====================================================
// GET SINGLE IMAGE
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
                gi.id,
                gi.ground_id,
                gi.ground_image,
                gi.is_primary,
                gi.status,
                gi.created_at,
                g.academy_id,
                g.branch_id
             FROM cst_ground_images gi
             INNER JOIN cst_ground g ON g.id = gi.ground_id
             WHERE gi.id = ?
             AND gi.status = 1
             AND g.is_deleted = 0
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
// =====================================================
export async function PUT(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot update ground images." },
            { status: 403 }
        );
    }

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
        // CHECK EXISTING IMAGE & PERMISSION
        // ------------------------------------------
        const [existingRows] = await connection.query(
            `SELECT
                gi.id,
                gi.ground_id,
                gi.ground_image,
                gi.is_primary,
                gi.status,
                g.academy_id,
                g.branch_id
             FROM cst_ground_images gi
             INNER JOIN cst_ground g ON g.id = gi.ground_id
             WHERE gi.id = ?
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
        const ownership = await verifyGroundOwnership(connection, existingImage.ground_id, authUser);
        if (!ownership.allowed) {
            return NextResponse.json(
                { success: false, message: "Access denied for this ground image" },
                { status: 403 }
            );
        }

        const finalGroundId = ground_id || existingImage.ground_id;

        // If target ground is different, check permission
        if (Number(finalGroundId) !== Number(existingImage.ground_id)) {
            const targetOwnership = await verifyGroundOwnership(connection, finalGroundId, authUser);
            if (!targetOwnership.allowed) {
                return NextResponse.json(
                    { success: false, message: "Target ground does not belong to authorized academy/branch" },
                    { status: 403 }
                );
            }
        }

        const finalPrimary =
            is_primary !== null
                ? Number(is_primary)
                : existingImage.is_primary;

        const finalStatus =
            status !== null
                ? Number(status)
                : existingImage.status;

        if (![0, 1].includes(finalPrimary)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "is_primary must be 0 or 1",
                },
                { status: 400 }
            );
        }

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
                        message: "Only JPG, JPEG, PNG and WEBP images are allowed",
                    },
                    { status: 400 }
                );
            }

            if (file.size > 2 * 1024 * 1024) {
                await connection.rollback();
                return NextResponse.json(
                    {
                        success: false,
                        message: "Image size must be less than 2MB",
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
                `${Date.now()}-${Math.floor(Math.random() * 1000000)}${extension}`;

            const filePath = path.join(uploadDir, fileName);

            const buffer = Buffer.from(await file.arrayBuffer());
            await fs.writeFile(filePath, buffer);

            finalImagePath = `/images/uploads/grounds/${fileName}`;

            if (existingImage.ground_image) {
                const oldImagePath = path.join(
                    process.cwd(),
                    "public",
                    existingImage.ground_image.replace(/^\/+/, "")
                );

                try {
                    await fs.unlink(oldImagePath);
                } catch (error) {
                    console.log("Old image not found:", error.message);
                }
            }
        }

        if (finalPrimary === 1) {
            await connection.query(
                `UPDATE cst_ground_images
                 SET is_primary = 0
                 WHERE ground_id = ?
                 AND id != ?`,
                [finalGroundId, id]
            );
        }

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
        console.error("UPDATE GROUND IMAGE ERROR:", error);

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
// =====================================================
export async function DELETE(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot delete ground images." },
            { status: 403 }
        );
    }

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
                gi.id,
                gi.ground_id,
                gi.ground_image,
                gi.is_primary,
                g.academy_id,
                g.branch_id
             FROM cst_ground_images gi
             INNER JOIN cst_ground g ON g.id = gi.ground_id
             WHERE gi.id = ?
             AND gi.status = 1
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
        const ownership = await verifyGroundOwnership(connection, image.ground_id, authUser);
        if (!ownership.allowed) {
            return NextResponse.json(
                { success: false, message: "Access denied: Unauthorized to delete this ground image" },
                { status: 403 }
            );
        }

        await connection.beginTransaction();

        await connection.query(
            `UPDATE cst_ground_images
             SET status = 0,
                 is_primary = 0
             WHERE id = ?`,
            [id]
        );

        if (image.ground_image) {
            const imagePath = path.join(
                process.cwd(),
                "public",
                image.ground_image.replace(/^\/+/, "")
            );

            try {
                await fs.unlink(imagePath);
            } catch (error) {
                console.log("Image file not found:", error.message);
            }
        }

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
        console.error("DELETE GROUND IMAGE ERROR:", error);

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
