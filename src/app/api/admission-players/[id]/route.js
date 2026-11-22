import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";
import { syncOnUserProgramInsert, syncOnUserProgramUpdate } from "@/app/components/lib/playerFlowSync.js";
import { syncPlayerUserAndRole } from "@/app/components/lib/playerUserSync.js";
import { ensurePlayerAccess } from "@/app/components/lib/playerAccessInit.js";
import { getAuthUser } from "@/app/components/lib/rbac.js";


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
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized. Authentication required."
        }, { status: 401 });
    }

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
    p.age_group_id,
    ag.age_group,
    p.gender,

    p.aadhaar_no,
    p.aadhaar_card,

    p.playing_academy,
    p.date_of_joining,
    p.date_of_appointment,

    p.branch_id,
    b.branch_name,
    b.academy_id,

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

            LEFT JOIN cst_age_groups ag
                ON ag.id = p.age_group_id

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

        const player = rows[0];

        // Multi-Tenant & Role Isolation
        if (authUser.isPlayer && Number(player.user_id) !== Number(authUser.id)) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You can only view your own admission record."
            }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (Number(player.branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(player.academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot access player records from another branch."
            }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(player.academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot access player records from another academy."
            }, { status: 403 });
        }


        return NextResponse.json({
            success: true,
            data: player
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
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized. Authentication required."
        }, { status: 401 });
    }

    if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
        return NextResponse.json({
            success: false,
            message: "Forbidden. Only administrators can update player admissions."
        }, { status: 403 });
    }

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
        const age_group_id = formData.get("age_group_id");
        const gender = formData.get("gender");

        const aadhaar_no = formData.get("aadhaar_no");
        const playing_academy = formData.get("playing_academy");
        const date_of_joining = formData.get("date_of_joining") || null;
        const date_of_appointment = formData.get("date_of_appointment") || null;

        const branch_id = formData.get("branch_id");
        const role_id = formData.get("role_id");

        const status = formData.get("status");
        const program_id = formData.get("program_id");
        const paid_amount = formData.get("paid_amount") || formData.get("initial_payment");
        const payment_mode = formData.get("payment_mode") || "Cash";
        const transaction_no = formData.get("transaction_no") || null;
        const payment_remarks = formData.get("payment_remarks") || null;

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

        if (!email || !String(email).trim()) {
            return NextResponse.json({
                success: false,
                message: "Email is required"
            }, { status: 400 });
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(String(email).trim())) {
            return NextResponse.json({
                success: false,
                message: "Invalid email format"
            }, { status: 400 });
        }

        if (!phone || !String(phone).trim()) {
            return NextResponse.json({
                success: false,
                message: "Phone number is required"
            }, { status: 400 });
        }

        const phoneDigits = String(phone).replace(/\D/g, "");
        if (phoneDigits.length < 10) {
            return NextResponse.json({
                success: false,
                message: "Phone number must have at least 10 digits"
            }, { status: 400 });
        }

        if (!address || !String(address).trim()) {
            return NextResponse.json({
                success: false,
                message: "Address is required"
            }, { status: 400 });
        }

        if (under_age === null || under_age === undefined || under_age === "" || (Number(under_age) !== 0 && Number(under_age) !== 1)) {
            return NextResponse.json({
                success: false,
                message: "Under Age selection is required (Yes or No)"
            }, { status: 400 });
        }

        if (!age_group_id || Number(age_group_id) <= 0) {
            return NextResponse.json({
                success: false,
                message: "Age Group is required"
            }, { status: 400 });
        }

        const [ageGroupRows] = await connection.query(
            "SELECT id FROM cst_age_groups WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1",
            [Number(age_group_id)]
        );
        if (ageGroupRows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Selected age group does not exist"
            }, { status: 400 });
        }

        if (!aadhaar_no || !String(aadhaar_no).trim()) {
            return NextResponse.json({
                success: false,
                message: "Aadhaar number is required"
            }, { status: 400 });
        }


        // =================================================
        // CHECK PLAYER
        // =================================================

        const [existingPlayer] = await connection.query(
            `
            SELECT
                p.id,
                p.user_id,
                p.admission_no,
                p.branch_id,
                b.academy_id,
                p.role_id,
                p.email,
                p.phone,
                p.aadhaar_card
            FROM cst_admission_players p
            INNER JOIN cst_branch b ON b.id = p.branch_id
            WHERE p.id = ?
              AND p.is_deleted = 0
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

        // Multi-Tenant Isolation on Existing Record
        if (authUser.isBranchAdmin && (Number(existingPlayer[0].branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(existingPlayer[0].academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot edit a player from another branch."
            }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(existingPlayer[0].academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot edit a player from another academy."
            }, { status: 403 });
        }


        // =================================================
        // CHECK BRANCH
        // =================================================

        const [branch] = await connection.query(
            `
            SELECT id, academy_id
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

        // Target Branch Scope Validation
        if (authUser.isBranchAdmin && Number(branch[0].id) !== Number(authUser.branch_id)) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot transfer a player to another branch."
            }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(branch[0].academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot transfer a player to another academy."
            }, { status: 403 });
        }


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


            if (aadhaarFile.size > 2 * 1024 * 1024) {
                return NextResponse.json({
                    success: false,
                    message: "Aadhaar card file must be less than 2MB"
                }, { status: 400 });
            }


            await fs.mkdir(uploadDir, {
                recursive: true
            });


            const extension = path.extname(aadhaarFile.name);

            const fileName =
                `aadhaar_${Date.now()}_${Math.floor(Math.random() * 100000)}${extension}`;

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


            aadhaarCardPath = `/images/uploads/admission-players/${fileName}`;


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

        await ensurePlayerAccess(connection);

        const { userId: syncedUserId } = await syncPlayerUserAndRole({
            connection,
            admissionPlayerId: id,
            admissionNo: admission_no || existingPlayer[0].admission_no,
            userId: user_id || existingPlayer[0].user_id,
            firstName: first_name,
            lastName: last_name,
            email,
            phone,
            branchId: branch_id,
            roleId: role_id,
            status,
        });

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
    age_group_id = ?,
    gender = ?,

    aadhaar_no = ?,
    aadhaar_card = ?,

    playing_academy = ?,
    date_of_joining = ?,
    date_of_appointment = ?,

    branch_id = ?,
    role_id = ?,

    status = ?

        WHERE id = ?
            `,
            [
                syncedUserId || null,
                admission_no || existingPlayer[0].admission_no || null,
                String(first_name).trim(),
                last_name || null,
                father_name || null,
                mother_name || null,

                String(email).trim(),
                String(phone).trim(),

                String(address).trim(),
                city || null,
                state || null,
                pin_code || null,

                Number(under_age),
                Number(age_group_id),
                gender || null,

                String(aadhaar_no).trim(),
                aadhaarCardPath,

                playing_academy || null,
                date_of_joining,
                date_of_appointment,

                branch_id,
                role_id,

                status ?? 1,

                id
            ]
        );

        if (date_of_joining) {
            await connection.query(
                `UPDATE cst_user_programs
                 SET start_date = COALESCE(start_date, ?)
                 WHERE admission_players_id = ?`,
                [date_of_joining, id]
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
    p.age_group_id,
    ag.age_group,
    p.gender,

    p.aadhaar_no,
    p.aadhaar_card,

    p.playing_academy,
    p.date_of_joining,
    p.date_of_appointment,

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

            LEFT JOIN cst_age_groups ag
                ON ag.id = p.age_group_id

            WHERE p.id = ?

    LIMIT 1
        `,
            [id]
        );
        //GET BRANCH

        const [GetBranchRows] = await connection.query(`SELECT * from cst_user_branches WHERE branch_id = ?
            LIMIT 1`, [branch_id]);

        if (GetBranchRows.length > 0) {
            await connection.query(
                `UPDATE cst_user_branches
                 SET branch_id = ?, user_id = COALESCE(?, user_id)
                 WHERE id = ?`,
                [
                    Number(branch_id),
                    syncedUserId,
                    GetBranchRows[0].id,
                ]
            );
        } else {
            await connection.query(
                `INSERT INTO cst_user_branches (branch_id, appointment_no, user_id)
                 VALUES (?, ?, ?)`,
                [Number(branch_id), admission_no || existingPlayer[0].admission_no, syncedUserId]
            );
        }

        const [getUserProgramsRows] = await connection.query(
            `SELECT * FROM cst_user_programs WHERE admission_players_id = ? OR appointment_no = ? LIMIT 1`,
            [id, admission_no || existingPlayer[0].admission_no]
        );
        if (getUserProgramsRows.length > 0) {
            const upId = getUserProgramsRows[0].id;
            const targetProgramId = program_id ? Number(program_id) : getUserProgramsRows[0].program_id;
            await connection.query(
                `UPDATE cst_user_programs
                 SET appointment_no = ?, branch_id = ?, program_id = ?, user_id = ?, status = ?
                 WHERE id = ?`,
                [
                    admission_no || getUserProgramsRows[0].appointment_no,
                    Number(branch_id),
                    targetProgramId,
                    syncedUserId,
                    status !== undefined ? Number(status) : 1,
                    upId,
                ]
            );

            // Automatically sync updated fees and attendance
            try {
                await syncOnUserProgramUpdate({
                    connection,
                    userProgramId: upId,
                    admissionPlayersId: Number(id),
                    programId: targetProgramId,
                    branchId: Number(branch_id),
                    userId: syncedUserId,
                    status: status !== undefined ? Number(status) : 1,
                    paymentInfo: paid_amount
                        ? {
                              paid_amount: Number(paid_amount),
                              payment_mode,
                              transaction_no,
                              remarks: payment_remarks,
                          }
                        : null,
                });
            } catch (syncErr) {
                console.error("ADMISSION PLAYER SYNC ON UPDATE ERROR:", syncErr);
            }
        }

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
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized. Authentication required."
        }, { status: 401 });
    }

    if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
        return NextResponse.json({
            success: false,
            message: "Forbidden. Only administrators can delete players."
        }, { status: 403 });
    }

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
            SELECT p.id, p.branch_id, b.academy_id
            FROM cst_admission_players p
            INNER JOIN cst_branch b ON b.id = p.branch_id
            WHERE p.id = ?
              AND p.is_deleted = 0
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

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && (Number(existing[0].branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot delete a player from another branch."
            }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({
                success: false,
                message: "Forbidden. You cannot delete a player from another academy."
            }, { status: 403 });
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
