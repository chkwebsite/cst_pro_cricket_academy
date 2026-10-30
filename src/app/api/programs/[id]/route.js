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

async function deleteOldImage(imagePath) {
    if (!imagePath || typeof imagePath !== "string") return;
    try {
        const relative = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
        if (relative.startsWith("images/uploads/programs/")) {
            const filePath = path.join(process.cwd(), "public", relative);
            await fs.unlink(filePath);
        }
    } catch {
        // non-fatal
    }
}

// =====================================================
// GET SINGLE PROGRAM
// =====================================================
export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Program ID is required"
            }, { status: 400 });
        }


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
                AND p.is_deleted = 0

            LIMIT 1
            `,
            [id]
        );


        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Program not found"
            }, { status: 404 });
        }


        return NextResponse.json({
            success: true,
            data: rows[0]
        });


    } catch (error) {
        console.error("GET SINGLE PROGRAM ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch program"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}



// =====================================================
// UPDATE PROGRAM
// =====================================================
export async function PUT(request, { params }) {
    const connection = await pool.getConnection();
    let uploadedFilePath = null;

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Program ID is required"
            }, { status: 400 });
        }

        // =================================================
        // CHECK PROGRAM
        // =================================================

        const [existingProgram] = await connection.query(
            `
            SELECT id, program_image, academy_id, branch_id, program_name, program_code, program_features, description, program_fee, registration_fee, daily_fee, kit_fee, status
            FROM cst_programs
            WHERE id = ?
                AND is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (existingProgram.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Program not found"
            }, { status: 404 });
        }

        const current = existingProgram[0];

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
        let hasImageField = false;
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

            if (formData.has("program_image")) {
                hasImageField = true;
                const img = formData.get("program_image");
                if (img && typeof img === "object" && img.size > 0) {
                    programImageFile = img;
                } else if (typeof img === "string") {
                    programImageString = img.trim();
                }
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

            if ("program_image" in body) {
                hasImageField = true;
                if (typeof body.program_image === "string") {
                    programImageString = body.program_image.trim();
                } else if (body.program_image === null) {
                    programImageString = "";
                }
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

        if (!program_name || !String(program_name).trim()) {
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
        // CHECK DUPLICATE PROGRAM CODE
        // =================================================

        if (program_code && String(program_code).trim()) {
            const [duplicateCode] = await connection.query(
                `
                SELECT id
                FROM cst_programs
                WHERE academy_id = ?
                    AND program_code = ?
                    AND id != ?
                    AND is_deleted = 0
                LIMIT 1
                `,
                [
                    academy_id,
                    String(program_code).trim(),
                    id
                ]
            );

            if (duplicateCode.length > 0) {
                return NextResponse.json({
                    success: false,
                    message: "Program code already exists"
                }, { status: 409 });
            }
        }

        // =================================================
        // HANDLE IMAGE UPDATE
        // =================================================

        let finalImagePath = current.program_image;

        if (programImageFile) {
            const uploadRes = await saveProgramImage(programImageFile);
            if (uploadRes) {
                finalImagePath = uploadRes.dbPath;
                uploadedFilePath = uploadRes.filePath;

                if (current.program_image) {
                    await deleteOldImage(current.program_image);
                }
            }
        } else if (hasImageField) {
            if (!programImageString || programImageString === "null") {
                finalImagePath = null;
                if (current.program_image) {
                    await deleteOldImage(current.program_image);
                }
            } else {
                finalImagePath = programImageString;
            }
        }


        // =================================================
        // UPDATE
        // =================================================

        await connection.query(
            `
            UPDATE cst_programs
            SET
                academy_id = ?,
                branch_id = ?,
                program_name = ?,
                program_code = ?,
                program_features = ?,
                program_image = ?,
                description = ?,
                program_fee = ?,
                registration_fee = ?,
                daily_fee = ?,
                kit_fee = ?,
                status = ?
            WHERE id = ?
            `,
            [
                academy_id,
                branch_id || null,
                String(program_name).trim(),
                program_code ? String(program_code).trim() : null,
                program_features ? String(program_features).trim() : null,
                finalImagePath,
                description ? String(description).trim() : null,
                program_fee !== undefined && program_fee !== "" && program_fee !== null ? Number(program_fee) : 0,
                registration_fee !== undefined && registration_fee !== "" && registration_fee !== null ? Number(registration_fee) : 0,
                daily_fee !== undefined && daily_fee !== "" && daily_fee !== null ? Number(daily_fee) : 0,
                kit_fee !== undefined && kit_fee !== "" && kit_fee !== null ? Number(kit_fee) : 0,
                status !== undefined && status !== "" && status !== null ? Number(status) : 1,
                id
            ]
        );


        // =================================================
        // GET UPDATED PROGRAM
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
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Program updated successfully",
            data: rows[0]
        });


    } catch (error) {
        if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath).catch(() => {});
        }

        console.error("UPDATE PROGRAM ERROR:", error);

        return NextResponse.json({
            success: false,
            message: error.message || "Failed to update program"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}



// =====================================================
// DELETE PROGRAM - SOFT DELETE
// =====================================================
export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;


        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Program ID is required"
            }, { status: 400 });
        }


        // =================================================
        // CHECK PROGRAM
        // =================================================

        const [existingProgram] = await connection.query(
            `
            SELECT id
            FROM cst_programs
            WHERE id = ?
                AND is_deleted = 0
            LIMIT 1
            `,
            [id]
        );


        if (existingProgram.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Program not found"
            }, { status: 404 });
        }


        // =================================================
        // SOFT DELETE
        // =================================================

        await connection.query(
            `
            UPDATE cst_programs
            SET
                is_deleted = 1,
                status = 0
            WHERE id = ?
            `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Program deleted successfully"
        });


    } catch (error) {
        console.error("DELETE PROGRAM ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete program"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}