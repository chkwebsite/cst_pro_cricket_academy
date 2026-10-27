import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";


// =====================================================
// UPLOAD DIRECTORY
// =====================================================
const uploadDir = path.join(
    process.cwd(),
    "public",
    "images",
    "uploads",
    "admission-players"
);


// =====================================================
// GET SINGLE PLAYER
// =====================================================
export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Player ID is required"
            }, { status: 400 });
        }


        const [rows] = await connection.query(
            `
SELECT
p.id,
    p.user_id,
    p.admission_no,

    p.first_name,
    p.last_name,
    p.father_name,
    p.mother_name,

    p.email,
    p.phone,

    p.address,
    p.city,
    p.state,
    p.pin_code,

    p.under_age,
    p.gender,

    p.aadhaar_no,
    p.aadhaar_card,

    p.playing_academy,

    p.branch_id,
    b.branch_name,

    p.role_id,
    r.role_name,

    p.status,
    p.is_deleted,

    p.created_at,
    p.updated_at

            FROM cst_admission_players p

            INNER JOIN cst_branch b
                ON b.id = p.branch_id

            INNER JOIN cst_roles r
                ON r.id = p.role_id

            WHERE p.id = ?
    AND p.is_deleted = 0

            LIMIT 1
    `,
            [id]
        );


        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Admission player not found"
            }, { status: 404 });
        }


        return NextResponse.json({
            success: true,
            data: rows[0]
        });


    } catch (error) {
        console.error("GET SINGLE PLAYER ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch player"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}


// =====================================================
// UPDATE PLAYER
// =====================================================
export async function PUT(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        const formData = await request.formData();

        const user_id = formData.get("user_id");
        const admission_no = formData.get("admission_no");
        const first_name = formData.get("first_name");
        const last_name = formData.get("last_name");
        const father_name = formData.get("father_name");
        const mother_name = formData.get("mother_name");

        const email = formData.get("email");
        const phone = formData.get("phone");

        const address = formData.get("address");
        const city = formData.get("city");
        const state = formData.get("state");
        const pin_code = formData.get("pin_code");

        const under_age = formData.get("under_age");
        const gender = formData.get("gender");

        const aadhaar_no = formData.get("aadhaar_no");
        const playing_academy = formData.get("playing_academy");

        const branch_id = formData.get("branch_id");
        const role_id = formData.get("role_id");

        const status = formData.get("status");

        const aadhaarFile = formData.get("aadhaar_card");


        // =================================================
        // VALIDATION
        // =================================================

        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Player ID is required"
            }, { status: 400 });
        }

        if (!admission_no || !String(admission_no).trim()) {
            return NextResponse.json({
                success: false,
                message: "Admission number is required"
            }, { status: 400 });
        }

        if (!first_name || !String(first_name).trim()) {
            return NextResponse.json({
                success: false,
                message: "First name is required"
            }, { status: 400 });
        }

        if (!branch_id) {
            return NextResponse.json({
                success: false,
                message: "Branch ID is required"
            }, { status: 400 });
        }

        if (!role_id) {
            return NextResponse.json({
                success: false,
                message: "Role ID is required"
            }, { status: 400 });
        }


        // =================================================
        // CHECK PLAYER
        // =================================================

        const [existingPlayer] = await connection.query(
            `
SELECT
id,
    aadhaar_card
            FROM cst_admission_players
            WHERE id = ?
    AND is_deleted = 0
            LIMIT 1
    `,
            [id]
        );


        if (existingPlayer.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Admission player not found"
            }, { status: 404 });
        }


        // =================================================
        // CHECK DUPLICATE ADMISSION NO
        // =================================================

        const [duplicateAdmission] = await connection.query(
            `
            SELECT id
            FROM cst_admission_players
            WHERE admission_no = ?
    AND id != ?
        LIMIT 1
            `,
            [
                String(admission_no).trim(),
                id
            ]
        );


        if (duplicateAdmission.length > 0) {
            return NextResponse.json({
                success: false,
                message: "Admission number already exists"
            }, { status: 409 });
        }


        // =================================================
        // CHECK BRANCH
        // =================================================

        const [branch] = await connection.query(
            `
            SELECT id
            FROM cst_branch
            WHERE id = ?
    AND status = 1
            LIMIT 1
    `,
            [branch_id]
        );


        if (branch.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Branch not found"
            }, { status: 404 });
        }


        // =================================================
        // CHECK ROLE
        // =================================================

        const [role] = await connection.query(
            `
            SELECT id
            FROM cst_roles
            WHERE id = ?
    AND status = 1
            LIMIT 1
    `,
            [role_id]
        );


        if (role.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Role not found"
            }, { status: 404 });
        }


        // =================================================
        // CHECK USER
        // =================================================

        if (user_id) {

            const [user] = await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE id = ?
    LIMIT 1
                `,
                [user_id]
            );


            if (user.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "User not found"
                }, { status: 404 });
            }
        }


        // =================================================
        // FILE
        // =================================================

        let aadhaarCardPath = existingPlayer[0].aadhaar_card;


        if (
            aadhaarFile &&
            typeof aadhaarFile === "object" &&
            aadhaarFile.name
        ) {

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "application/pdf"
            ];


            if (!allowedTypes.includes(aadhaarFile.type)) {
                return NextResponse.json({
                    success: false,
                    message: "Only JPG, PNG, WEBP and PDF files are allowed"
                }, { status: 400 });
            }


            if (aadhaarFile.size > 5 * 1024 * 1024) {
                return NextResponse.json({
                    success: false,
                    message: "Aadhaar card file must be less than 5MB"
                }, { status: 400 });
            }


            await fs.mkdir(uploadDir, {
                recursive: true
            });


            const extension = path.extname(aadhaarFile.name);

            const fileName =
                `aadhaar_${Date.now()}_${Math.floor(Math.random() * 100000)}${extension} `;

            const filePath = path.join(
                uploadDir,
                fileName
            );


            const buffer = Buffer.from(
                await aadhaarFile.arrayBuffer()
            );


            await fs.writeFile(
                filePath,
                buffer
            );


            aadhaarCardPath =
                `/ images/uploads/admission-players/${fileName} `;


            // DELETE OLD FILE
            if (existingPlayer[0].aadhaar_card) {

                const oldFile = path.join(
                    process.cwd(),
                    "public",
                    existingPlayer[0].aadhaar_card.replace(/^\//, "")
                );

                try {
                    await fs.unlink(oldFile);
                } catch (error) {
                    console.log("Old Aadhaar file not found");
                }
            }
        }


        // =================================================
        // UPDATE
        // =================================================

        await connection.query(
            `
            UPDATE cst_admission_players
SET
user_id = ?,
    admission_no = ?,

    first_name = ?,
    last_name = ?,
    father_name = ?,
    mother_name = ?,

    email = ?,
    phone = ?,

    address = ?,
    city = ?,
    state = ?,
    pin_code = ?,

    under_age = ?,
    gender = ?,

    aadhaar_no = ?,
    aadhaar_card = ?,

    playing_academy = ?,

    branch_id = ?,
    role_id = ?,

    status = ?

        WHERE id = ?
            `,
            [
                user_id || null,
                String(admission_no).trim(),

                String(first_name).trim(),
                last_name || null,
                father_name || null,
                mother_name || null,

                email || null,
                phone || null,

                address || null,
                city || null,
                state || null,
                pin_code || null,

                under_age ?? 0,
                gender || null,

                aadhaar_no || null,
                aadhaarCardPath,

                playing_academy || null,

                branch_id,
                role_id,

                status ?? 1,

                id
            ]
        );

        const [GetBranchRows] = await connection.query(`SELECT * from cst_user_branches WHERE branch_id = ?
            LIMIT 1`, [branch_id]);

        if (GetBranchRows.length > 0) {
            const [UpdBranchRows] = await connection.query(
                `UPDATE cst_user_branches
         SET branch_id = ?
         WHERE id = ?`,
                [
                    Number(branch_id),
                    GetBranchRows[0].id,
                ]
            );
        }

        // =================================================
        // GET UPDATED PLAYER
        // =================================================

        const [rows] = await connection.query(
            `
            SELECT
p.id,
    p.user_id,
    p.admission_no,

    p.first_name,
    p.last_name,
    p.father_name,
    p.mother_name,

    p.email,
    p.phone,

    p.address,
    p.city,
    p.state,
    p.pin_code,

    p.under_age,
    p.gender,

    p.aadhaar_no,
    p.aadhaar_card,

    p.playing_academy,

    p.branch_id,
    b.branch_name,

    p.role_id,
    r.role_name,

    p.status,
    p.is_deleted,

    p.created_at,
    p.updated_at

            FROM cst_admission_players p

            INNER JOIN cst_branch b
                ON b.id = p.branch_id

            INNER JOIN cst_roles r
                ON r.id = p.role_id

            WHERE p.id = ?

    LIMIT 1
        `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Admission player updated successfully",
            data: rows[0]
        });


    } catch (error) {
        console.error("UPDATE PLAYER ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to update admission player"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}


// =====================================================
// DELETE PLAYER - SOFT DELETE
// =====================================================
export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;


        if (!id) {
            return NextResponse.json({
                success: false,
                message: "Player ID is required"
            }, { status: 400 });
        }


        // =================================================
        // CHECK PLAYER
        // =================================================

        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_admission_players
            WHERE id = ?
    AND is_deleted = 0
            LIMIT 1
    `,
            [id]
        );


        if (existing.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Admission player not found"
            }, { status: 404 });
        }


        // =================================================
        // SOFT DELETE
        // =================================================

        await connection.query(
            `
            UPDATE cst_admission_players
SET
is_deleted = 1,
    status = 0
            WHERE id = ?
    `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Admission player deleted successfully"
        });


    } catch (error) {
        console.error("DELETE PLAYER ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete admission player"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}
