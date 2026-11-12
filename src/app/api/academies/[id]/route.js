import pool from "@/app/components/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAuthUser } from "@/app/components/lib/rbac";

// GET SINGLE ACADEMY LIST

export async function GET(req, { params }) {
    const authUser = await getAuthUser(req);
    const { id } = await params;

    if (authUser && !authUser.isSuperAdmin && Number(authUser.academy_id) !== Number(id)) {
        return NextResponse.json({
            success: false,
            message: "Access denied: You can only access your own academy records"
        }, { status: 403 });
    }

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(`
            SELECT * from cst_academy WHERE id = ? AND is_deleted = 0 LIMIT 1 `, [id]);
        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Academy not found"
            }, { status: 404 })
        }
        const academy = rows[0];
        if (academy.logo) {
            academy.logo = `/images/uploads/academy/${academy.logo}`;
        }
        return NextResponse.json({
            success: true,
            message: "Academy fetched successfully",
            data: academy
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch academy",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// UPDATE SINGLE ACADEMY LIST

export async function PUT(req, { params }) {
    const authUser = await getAuthUser(req);
    const { id } = await params;

    if (authUser && !authUser.isSuperAdmin && Number(authUser.academy_id) !== Number(id)) {
        return NextResponse.json({
            success: false,
            message: "Access denied: You can only edit your own academy records"
        }, { status: 403 });
    }

    const connection = await pool.getConnection();
    try {
        const formData = await req.formData();

        const academy_name = formData.get("academy_name");
        const academy_code = formData.get("academy_code");
        const contact_person= formData.get("contact_person");
        const email = formData.get("email");
        const phone = formData.get("phone");
        const website = formData.get("website");
        const address = formData.get("address");
        const city = formData.get("city");
        const state = formData.get("state");
        const pin_code = formData.get("pin_code");
        const gst_no = formData.get("gst_no");
        const pan_no = formData.get("pan_no");
        const status = formData.get("status") || 1;

        const logo = formData.get("logo");

        const [existingRows] = await connection.query(`
            SELECT * from cst_academy WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]);

        if (existingRows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Academy not found"
            }, { status: 404 })
        }

        const existingAcademy = existingRows[0];

        let logoName = existingAcademy.logo;

        // New Logo Upload
        if (logo && typeof logo !== "string" && logo.size > 0) {
            const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
            if (!allowedTypes.includes(logo.type)) {
                return NextResponse.json({
                    success: false,
                    message: "Only JPG, PNG, WEBP and GIF images are allowed"
                }, { status: 400 })
            }

            if (logo.size > 2 * 1024 * 1024) {
                return NextResponse.json({
                    success: false,
                    message: "Logo size must be less than 2MB"
                }, { status: 400 });
            }

            const uploadDir = path.join(
                process.cwd(),
                "public", "images", "uploads", "academy"
            )

            await fs.mkdir(uploadDir, { recursive: true });
            const extension = path.extname(logo.name);
            const newLogoName = `academy_${Date.now()}_${Math.random().toString(10).substring(2, 8)}${extension}`;
            const filePath = path.join(uploadDir, newLogoName);
            const bytes = await logo.arrayBuffer();
            const buffer = Buffer.from(bytes);
            await fs.writeFile(filePath, buffer);

            if (existingAcademy.logo) {
                const oldLogoPath = path.join(uploadDir, existingAcademy.logo);
                try {
                    await fs.unlink(oldLogoPath)
                } catch (unlinkError) {
                    console.log("Old logo not found", unlinkError.message)
                }
            }
            logoName = newLogoName;
        }

        await connection.query(
            `
        UPDATE cst_academy
        SET
          academy_name = ?,
            academy_code = ?,
            contact_person = ?,
            logo = ?,
            email = ?,
            phone = ?,
            website = ?,
            address = ?,
            city = ?,
            state = ?,
            pin_code = ?,
            gst_no = ?, 
            pan_no = ?,
            status = ?
        WHERE id = ?
      `,
            [
                academy_name?.trim() || existingAcademy.academy_name,
                academy_code || null,
                contact_person || null,
                logoName,
                email || null,
                phone || null,
                website || null,
                address || null,
                city || null,
                state || null,
                pin_code || null,
                gst_no || null, 
                pan_no || null,
                status !== null && status !== ""
                    ? status
                    : existingAcademy.status,
                id,
            ]
        );
        return NextResponse.json({
            success: true,
            message: "Academy updated successfully",
            data: {
                id,
                academy_name:
                    academy_name?.trim() || existingAcademy.academy_name,
                logo: logoName
                    ? `/images/uploads/academy/${logoName}`
                    : null,
            },
        });

    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                message: "Failed to update academy",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// DELETE - Soft Delete
// =========================
export async function DELETE(request, { params }) {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.isSuperAdmin) {
        return NextResponse.json({
            success: false,
            message: "Only Super Admin can delete academies"
        }, { status: 403 });
    }

    const connection = await pool.getConnection();
    try {
        const { id } = await params;

        const [rows] = await connection.query(
            `
        SELECT id, logo
        FROM cst_academy
        WHERE id = ?
        AND is_deleted = 0
        LIMIT 1
      `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy not found",
                },
                { status: 404 }
            );
        }

        // Soft delete
        await connection.query(
            `
        UPDATE cst_academy
        SET is_deleted = 1,
            status = 0
        WHERE id = ?
      `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Academy deleted successfully",
        });
    } catch (error) {
        console.error("DELETE Academy Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete academy",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// GET / api / academy	All academies
// GET / api / academy ? id = 1	Academy by ID
// GET / api / academy / 1	Academy by ID
// GET / api / academy ? search = Delhi	Search
// GET / api / academy ? status = 1	Active academies
// POST / api / academy	Create + logo upload
// PUT / api / academy / 1	Update + optional new logo
// DELETE / api / academy / 1	Soft delete
