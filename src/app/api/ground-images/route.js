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

// ======================================================
// GET GROUND IMAGES
// ======================================================
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const groundId = searchParams.get("ground_id")?.trim() || "";
        const academyId = searchParams.get("academy_id")?.trim() || "";
        const branchId = searchParams.get("branch_id")?.trim() || "";

        let sql = `
            SELECT
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
            WHERE gi.status = 1 AND g.is_deleted = 0
        `;

        const values = [];

        // If authenticated user, apply scoping unless public
        const authHeader = request.headers.get("authorization");
        if (authHeader) {
            const { user: authUser } = await getAuthenticatedUser(request);
            if (authUser && !authUser.isSuperAdmin && !authUser.isPlayer) {
                sql += " AND g.academy_id = ?";
                values.push(authUser.academy_id);
                if (authUser.isBranchAdmin && authUser.branch_id) {
                    sql += " AND g.branch_id = ?";
                    values.push(authUser.branch_id);
                } else if (!authUser.isAcademyAdmin) {
                    const allowed = authUser.assignedBranchIds || [authUser.branch_id];
                    sql += ` AND g.branch_id IN (${allowed.map(() => "?").join(",")})`;
                    values.push(...allowed);
                }
            }
        }

        if (groundId) {
            if (isNaN(groundId)) {
                return NextResponse.json(
                    { success: false, message: "Invalid ground ID" },
                    { status: 400 }
                );
            }
            sql += ` AND gi.ground_id = ?`;
            values.push(groundId);
        }

        if (academyId && !isNaN(academyId)) {
            sql += ` AND g.academy_id = ?`;
            values.push(academyId);
        }

        if (branchId && !isNaN(branchId)) {
            sql += ` AND g.branch_id = ?`;
            values.push(branchId);
        }

        sql += ` ORDER BY gi.is_primary DESC, gi.id DESC`;

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
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot upload ground images." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const formData = await request.formData();

        const ground_id = formData.get("ground_id");
        const files = formData.getAll("ground_images");

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

        // Check ground ownership
        const ownership = await verifyGroundOwnership(connection, ground_id, authUser);
        if (!ownership.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: ownership.notFound ? "Ground not found" : "Unauthorized: Ground does not belong to your academy/branch",
                },
                { status: ownership.notFound ? 404 : 403 }
            );
        }

        // Upload directory
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

        // Check if ground already has an active primary image
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

        for (const file of files) {
            if (!file || typeof file.arrayBuffer !== "function") {
                continue;
            }

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

            if (file.size > 2 * 1024 * 1024) {
                await connection.rollback();
                return NextResponse.json(
                    {
                        success: false,
                        message: `${file.name} exceeds 2MB limit`,
                    },
                    { status: 400 }
                );
            }

            const extension =
                path.extname(file.name).toLowerCase() || ".jpg";

            const fileName =
                `${Date.now()}-${Math.floor(Math.random() * 1000000)}${extension}`;

            const filePath = path.join(uploadDir, fileName);

            const buffer = Buffer.from(
                await file.arrayBuffer()
            );

            await fs.writeFile(filePath, buffer);

            const isPrimary =
                !hasPrimary && uploadedImages.length === 0 ? 1 : 0;

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
