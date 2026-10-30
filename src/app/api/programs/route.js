import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "images", "uploads", "programs");
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif"
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

async function saveProgramImage(file) {
    if (!file || typeof file !== "object" || !file.name || typeof file.arrayBuffer !== "function") {
        return null;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error("Only JPG, JPEG, PNG, WEBP and GIF images are allowed");
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error("Program image must be less than 2MB");
    }

    const extension = (path.extname(file.name) || ".jpg").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        throw new Error("Invalid program image extension");
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const fileName = `program_${Date.now()}_${Math.floor(Math.random() * 1000000)}${extension}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    return {
        dbPath: `/images/uploads/programs/${fileName}`,
        filePath
    };
}

// =====================================================
// GET ALL PROGRAMS
// =====================================================
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const status = searchParams.get("status");

        let sql = `
            SELECT
                p.id,
                p.academy_id,
                a.academy_name,

                p.branch_id,
                b.branch_name,

                p.program_name,
                p.program_code,
                p.program_features,
                p.program_image,
                p.description,

                p.program_fee,
                p.registration_fee,
                p.daily_fee,
                p.kit_fee,

                p.status,
                p.is_deleted,

                p.created_at,
                p.updated_at

            FROM cst_programs p

            INNER JOIN cst_academy a
                ON a.id = p.academy_id

            LEFT JOIN cst_branch b
                ON b.id = p.branch_id

            WHERE p.is_deleted = 0
        `;

        const values = [];

        // Academy filter
        if (academy_id) {
            sql += ` AND p.academy_id = ? `;
            values.push(academy_id);
        }

        // Branch filter
        if (branch_id) {
            sql += ` AND p.branch_id = ? `;
            values.push(branch_id);
        }

        // Status filter
        if (status !== null && status !== "") {
            sql += ` AND p.status = ? `;
            values.push(status);
        }

        sql += ` ORDER BY p.id DESC`;

        const [rows] = await connection.query(sql, values);

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET PROGRAMS ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch programs"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}


// =====================================================
// CREATE PROGRAM
// =====================================================
export async function POST(request) {
    const connection = await pool.getConnection();
    let uploadedFilePath = null;

    try {
        const contentType = request.headers.get("content-type") || "";

        let academy_id;
        let branch_id;
        let program_name;
        let program_code;
        let program_features;
        let description;
        let program_fee;
        let registration_fee;
        let daily_fee;
        let kit_fee;
        let status;
        let programImageFile = null;
        let programImageString = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            academy_id = formData.get("academy_id");
            branch_id = formData.get("branch_id");
            program_name = formData.get("program_name");
            program_code = formData.get("program_code");
            program_features = formData.get("program_features");
            description = formData.get("description");
            program_fee = formData.get("program_fee");
            registration_fee = formData.get("registration_fee");
            daily_fee = formData.get("daily_fee");
            kit_fee = formData.get("kit_fee");
            status = formData.get("status");

            const img = formData.get("program_image");
            if (img && typeof img === "object" && img.size > 0) {
                programImageFile = img;
            } else if (typeof img === "string" && img.trim() && img.trim() !== "null") {
                programImageString = img.trim();
            }
        } else {
            const body = await request.json();
            academy_id = body.academy_id;
            branch_id = body.branch_id;
            program_name = body.program_name;
            program_code = body.program_code;
            program_features = body.program_features;
            description = body.description;
            program_fee = body.program_fee;
            registration_fee = body.registration_fee;
            daily_fee = body.daily_fee;
            kit_fee = body.kit_fee;
            status = body.status;

            if (typeof body.program_image === "string" && body.program_image.trim() && body.program_image.trim() !== "null") {
                programImageString = body.program_image.trim();
            }
        }

        // =================================================
        // VALIDATION
        // =================================================

        if (!academy_id) {
            return NextResponse.json({
                success: false,
                message: "Academy ID is required"
            }, { status: 400 });
        }

        if (!program_name || !program_name.trim()) {
            return NextResponse.json({
                success: false,
                message: "Program name is required"
            }, { status: 400 });
        }


        // =================================================
        // CHECK ACADEMY
        // =================================================

        const [academy] = await connection.query(
            `
            SELECT id
            FROM cst_academy
            WHERE id = ?
                AND status = 1
                AND is_deleted = 0
            LIMIT 1
            `,
            [academy_id]
        );

        if (academy.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Academy not found"
            }, { status: 404 });
        }


        // =================================================
        // CHECK BRANCH
        // =================================================

        if (branch_id) {
            const [branch] = await connection.query(
                `
                SELECT id
                FROM cst_branch
                WHERE id = ?
                    AND academy_id = ?
                    AND status = 1
                    AND is_deleted = 0
                LIMIT 1
                `,
                [
                    branch_id,
                    academy_id
                ]
            );

            if (branch.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "Branch does not belong to this academy"
                }, { status: 400 });
            }
        }


        // =================================================
        // CHECK PROGRAM CODE
        // =================================================

        if (program_code && program_code.trim()) {
            const [existingCode] = await connection.query(
                `
                SELECT id
                FROM cst_programs
                WHERE academy_id = ?
                    AND program_code = ?
                    AND is_deleted = 0
                LIMIT 1
                `,
                [
                    academy_id,
                    program_code.trim()
                ]
            );

            if (existingCode.length > 0) {
                return NextResponse.json({
                    success: false,
                    message: "Program code already exists"
                }, { status: 409 });
            }
        }

        // =================================================
        // HANDLE IMAGE UPLOAD
        // =================================================

        let savedImagePath = null;

        if (programImageFile) {
            const uploadRes = await saveProgramImage(programImageFile);
            if (uploadRes) {
                savedImagePath = uploadRes.dbPath;
                uploadedFilePath = uploadRes.filePath;
            }
        } else if (programImageString) {
            savedImagePath = programImageString;
        }

        // =================================================
        // INSERT PROGRAM
        // =================================================

        const [result] = await connection.query(
            `
            INSERT INTO cst_programs
            (
                academy_id,
                branch_id,
                program_name,
                program_code,
                program_features,
                program_image,
                description,
                program_fee,
                registration_fee,
                daily_fee,
                kit_fee,
                status
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                academy_id,
                branch_id || null,
                program_name.trim(),
                program_code ? program_code.trim() : null,
                program_features ? program_features.trim() : null,
                savedImagePath,
                description ? description.trim() : null,
                program_fee !== undefined && program_fee !== "" && program_fee !== null ? Number(program_fee) : 0,
                registration_fee !== undefined && registration_fee !== "" && registration_fee !== null ? Number(registration_fee) : 0,
                daily_fee !== undefined && daily_fee !== "" && daily_fee !== null ? Number(daily_fee) : 0,
                kit_fee !== undefined && kit_fee !== "" && kit_fee !== null ? Number(kit_fee) : 0,
                status !== undefined && status !== "" && status !== null ? Number(status) : 1
            ]
        );


        // =================================================
        // GET CREATED PROGRAM
        // =================================================

        const [rows] = await connection.query(
            `
            SELECT
                p.id,
                p.academy_id,
                a.academy_name,

                p.branch_id,
                b.branch_name,

                p.program_name,
                p.program_code,
                p.program_features,
                p.program_image,
                p.description,

                p.program_fee,
                p.registration_fee,
                p.daily_fee,
                p.kit_fee,

                p.status,
                p.is_deleted,

                p.created_at,
                p.updated_at

            FROM cst_programs p

            INNER JOIN cst_academy a
                ON a.id = p.academy_id

            LEFT JOIN cst_branch b
                ON b.id = p.branch_id

            WHERE p.id = ?
            LIMIT 1
            `,
            [result.insertId]
        );


        return NextResponse.json({
            success: true,
            message: "Program created successfully",
            data: rows[0]
        }, { status: 201 });


    } catch (error) {
        if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath).catch(() => { });
        }

        console.error("CREATE PROGRAM ERROR:", error);

        return NextResponse.json({
            success: false,
            message: error.message || "Failed to create program"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}
