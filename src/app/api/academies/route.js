import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";
import { getAuthUser } from "@/app/components/lib/rbac";


// GET ACADEMY LIST WITH FILTER
export async function GET(request) {
    const connection = await pool.getConnection();
    try {

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const search = searchParams.get("search");
        const status = searchParams.get("status");

        let sql = `
      SELECT
       id,
        academy_name,
        academy_code,
        logo,
        contact_person,
        email,
        phone,
        website,
        address,
        city,
        state ,
        pin_code,
        gst_no,
        pan_no,
        status,
        is_deleted,
        created_at,
        updated_at
      FROM cst_academy
      WHERE is_deleted = 0
    `;

        const params = [];

        const authUser = await getAuthUser(request);
        if (authUser && !authUser.isSuperAdmin && authUser.academy_id) {
            sql += ` AND id = ?`;
            params.push(authUser.academy_id);
        } else if (id) {
            sql += ` AND id = ?`;
            params.push(id);
        }
        if (search) {
            sql += `AND (academy_name LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ? OR state LIKE ?)`;
            const searchValue = `%${search}%`;
            params.push(searchValue, searchValue, searchValue, searchValue, searchValue);
        }
        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }
        sql += `ORDER BY id DESC`;

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Academy list fetched successfully",
            data: rows
        }, { status: 200 })
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: error.message,
        }, { status: 500 })
    } finally {
        connection.release();
    }
}

// POST ACADEMY

export async function POST(request) {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.isSuperAdmin) {
        return NextResponse.json(
            { success: false, message: "Only Super Admin can register new academies" },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();
    try {
        const formData = await request.formData();

        
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

        if (!academy_name || !academy_name.trim()) {
            return NextResponse.json({
                success: false,
                message: "Academy name is required"
            }, { status: 400 })
        }

        if (!academy_code || !academy_code.trim()) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Academy code is required",
                },
                { status: 400 }
            );
        }

        const [existing] =
            await connection.query(
                `
                SELECT id
                FROM cst_academy
                WHERE academy_code = ?
                LIMIT 1
                `,
                [academy_code]
            );


        if (existing.length > 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Academy code already exists",
                },
                { status: 409 }
            );
        }

        let logoName = null;
        if (logo && typeof logo !== "string" && logo.size > 0) {
            const allowedType = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
            if (!allowedType.includes(logo.type)) {
                return NextResponse.json({
                    success: false,
                    message: "Only JPG, PNG, WEBP and GIF images are allowed"
                }, { status: 400 })
            }

            if (logo.size > 2 * 1024 * 1024) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Logo size must be less than 2MB",
                    },
                    { status: 400 }
                );
            }

            const uploadDir = path.join(
                process.cwd(),
                "public", "images", "uploads", "academy"
            );

            await fs.mkdir(uploadDir, { recursive: true });

            const extension = path.extname(logo.name);
            logoName = `academy_${Date.now()}_${Math.random().toString(10).substring(2, 8)}${extension}`;

            const filePath = path.join(uploadDir, logoName);

            const bytes = await logo.arrayBuffer();
            const buffer = Buffer.from(bytes);
            await fs.writeFile(filePath, buffer);
        }

        const [result] = await connection.query(`
            INSERT INTO cst_academy (
            academy_name,
            academy_code,
            contact_person,
            logo,
            email,
            phone,
            website,
            address,
            city,
            state,
            pin_code,
            gst_no, 
            pan_no,
            status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,[
            academy_name.trim(),
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
            status,
            ]);

        return NextResponse.json(
            {
                success: true,
                message: "Academy created successfully",
                data: {
                    id: result.insertId,
                    academy_name,
                    logo: logoName
                        ? `/images/uploads/academy/${logoName}`
                        : null,
                },
            },
            { status: 201 }
        );

    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                message: "Failed to create academy",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
