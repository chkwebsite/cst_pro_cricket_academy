import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import pool from "@/app/components/lib/db";

// =====================================================
// GET SINGLE USER
// =====================================================

export async function GET(
    request,
    { params }
) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        const [rows] = await connection.query(
            `
            SELECT
                u.id,
                u.appointment_no,
                u.academy_id,
                a.academy_name,
                u.branch_id,
                b.branch_name,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.profile_image,
                u.user_type,
                u.status,
                u.is_deleted,
                u.last_login_at,
                u.created_at,
                u.updated_at
            FROM cst_users u
            LEFT JOIN cst_academy a
                ON a.id = u.academy_id
            LEFT JOIN cst_branch b
                ON b.id = u.branch_id
            WHERE u.id = ?
            AND u.is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User not found"
                },
                {
                    status: 404
                }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "User fetched successfully",
                data: rows[0]
            },
            {
                status: 200
            }
        );

    } catch (error) {

        console.error(
            "Get Single User Error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch user",
                error:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined
            },
            {
                status: 500
            }
        );

    } finally {

        if (connection) {
            connection.release();
        }
    }
}


// =====================================================
// PUT - UPDATE USER
// =====================================================






export async function PUT(request, { params }) {

    const connection = await pool.getConnection();

    let transactionStarted = false;

    // New uploaded image
    let newUploadedFilePath = null;

    // Old image path
    let oldImagePath = null;


    try {

        // =====================================================
        // GET USER ID
        // =====================================================

        const { id } = await params;

        const userId = Number(id);


        if (!userId || Number.isNaN(userId)) {

            return NextResponse.json(
                {
                    success: false,
                    message: "Valid user id is required"
                },
                {
                    status: 400
                }
            );

        }


        // =====================================================
        // FORM DATA
        // =====================================================

        const formData = await request.formData();


        const appointment_no =
            formData.get("appointment_no")
                ?.toString()
                .trim();


        const academy_id =
            formData.get("academy_id") || null;


        const branch_id =
            formData.get("branch_id") || null;


        const first_name =
            formData.get("first_name")
                ?.toString()
                .trim();


        const last_name =
            formData.get("last_name")
                ?.toString()
                .trim() || null;


        const email =
            formData.get("email")
                ?.toString()
                .trim() || null;


        const phone =
            formData.get("phone")
                ?.toString()
                .trim() || null;


        const passwordValue =
            formData.get("password");


        const password =
            passwordValue
                ? passwordValue.toString()
                : null;


        const user_type =
            formData.get("user_type")
                ?.toString()
                .trim();


        const status =
            formData.get("status") !== null
                ? Number(formData.get("status"))
                : 1;


        const profile_image =
            formData.get("profile_image");


        // =====================================================
        // VALIDATION
        // =====================================================

        if (!appointment_no) {

            return NextResponse.json(
                {
                    success: false,
                    message: "Appointment number is required"
                },
                {
                    status: 400
                }
            );

        }


        if (!first_name) {

            return NextResponse.json(
                {
                    success: false,
                    message: "First name is required"
                },
                {
                    status: 400
                }
            );

        }


        if (!user_type) {

            return NextResponse.json(
                {
                    success: false,
                    message: "User type is required"
                },
                {
                    status: 400
                }
            );

        }


        // =====================================================
        // PLAYER CHECK
        // FormData always returns string
        // =====================================================

        const isPlayer =
            user_type === "7" ||
            user_type.toLowerCase() === "player";


        // =====================================================
        // GET EXISTING USER
        // =====================================================

        const [existingRows] =
            await connection.query(
                `
                SELECT
                    id,
                    appointment_no,
                    academy_id,
                    branch_id,
                    first_name,
                    last_name,
                    email,
                    phone,
                    password,
                    profile_image,
                    user_type,
                    status
                FROM cst_users
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [userId]
            );


        if (existingRows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message: "User not found"
                },
                {
                    status: 404
                }
            );

        }


        const existingUser = existingRows[0];


        // =====================================================
        // SAVE OLD IMAGE PATH
        // =====================================================

        if (existingUser.profile_image) {

            oldImagePath =
                path.join(
                    process.cwd(),
                    "public",
                    existingUser.profile_image
                        .replace(/^\/+/, "")
                        .replace(/\//g, path.sep)
                );

        }


        // =====================================================
        // DUPLICATE APPOINTMENT NUMBER
        // Exclude current user
        // =====================================================

        const [appointmentRows] =
            await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE appointment_no = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    appointment_no,
                    userId
                ]
            );


        if (appointmentRows.length > 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Appointment number already exists"
                },
                {
                    status: 409
                }
            );

        }


        // =====================================================
        // DUPLICATE EMAIL
        // =====================================================

        if (email) {

            const [emailRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM cst_users
                    WHERE email = ?
                    AND id != ?
                    AND is_deleted = 0
                    LIMIT 1
                    `,
                    [
                        email,
                        userId
                    ]
                );


            if (emailRows.length > 0) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Email already exists"
                    },
                    {
                        status: 409
                    }
                );

            }

        }


        // =====================================================
        // CHECK RELATED RECORD
        // =====================================================

        let playerId = null;


        if (isPlayer) {

            // =================================================
            // PLAYER
            // =================================================

            const [playerRows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        admission_no,
                        user_id
                    FROM cst_admission_players
                    WHERE admission_no = ?
                    AND is_deleted = 0
                    LIMIT 1
                    `,
                    [appointment_no]
                );


            if (playerRows.length === 0) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Player admission not found"
                    },
                    {
                        status: 404
                    }
                );

            }


            playerId =
                playerRows[0].id;


            // -------------------------------------------------
            // Check another user is already linked
            // -------------------------------------------------

            if (
                playerRows[0].user_id !== null &&
                Number(playerRows[0].user_id) !== userId
            ) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This player is already linked with another user"
                    },
                    {
                        status: 409
                    }
                );

            }

        } else {

            // =================================================
            // STAFF / ADMIN / OTHER
            // =================================================

            const [staffRows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        appointment_no,
                        user_id
                    FROM cst_staff
                    WHERE appointment_no = ?
                    AND is_deleted = 0
                    LIMIT 1
                    `,
                    [appointment_no]
                );


            if (staffRows.length === 0) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Staff record not found"
                    },
                    {
                        status: 404
                    }
                );

            }


            // -------------------------------------------------
            // Check another user is already linked
            // -------------------------------------------------

            if (
                staffRows[0].user_id !== null &&
                Number(staffRows[0].user_id) !== userId
            ) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This staff is already linked with another user"
                    },
                    {
                        status: 409
                    }
                );

            }

        }


        // =====================================================
        // PASSWORD
        // =====================================================

        let hashedPassword =
            existingUser.password;


        if (password) {

            hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

        }


        // =====================================================
        // IMAGE UPLOAD
        // =====================================================

        let imageName =
            existingUser.profile_image || null;


        if (
            profile_image &&
            typeof profile_image === "object" &&
            profile_image.size > 0
        ) {

            // -------------------------------------------------
            // ALLOWED TYPES
            // -------------------------------------------------

            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            ];


            if (
                !allowedTypes.includes(
                    profile_image.type
                )
            ) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Only JPG, JPEG, PNG and WEBP images are allowed"
                    },
                    {
                        status: 400
                    }
                );

            }


            // -------------------------------------------------
            // FILE SIZE
            // -------------------------------------------------

            if (
                profile_image.size >
                5 * 1024 * 1024
            ) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Image size must be less than 5MB"
                    },
                    {
                        status: 400
                    }
                );

            }


            // -------------------------------------------------
            // UPLOAD DIRECTORY
            // -------------------------------------------------

            const uploadDir =
                path.join(
                    process.cwd(),
                    "public",
                    "images",
                    "uploads",
                    "users"
                );


            await fs.mkdir(
                uploadDir,
                {
                    recursive: true
                }
            );


            // -------------------------------------------------
            // EXTENSION
            // -------------------------------------------------

            const extension =
                path.extname(
                    profile_image.name
                ) || ".jpg";


            // -------------------------------------------------
            // NEW FILE NAME
            // IMPORTANT:
            // No spaces
            // -------------------------------------------------

            imageName =
                `${Date.now()}-${Math.round(
                    Math.random() * 1000000
                )}${extension.toLowerCase()}`;


            newUploadedFilePath =
                path.join(
                    uploadDir,
                    imageName
                );


            // -------------------------------------------------
            // SAVE FILE
            // -------------------------------------------------

            const bytes =
                await profile_image.arrayBuffer();


            const buffer =
                Buffer.from(bytes);


            await fs.writeFile(
                newUploadedFilePath,
                buffer
            );

        }


        // =====================================================
        // START TRANSACTION
        // =====================================================

        await connection.beginTransaction();

        transactionStarted = true;


        // =====================================================
        // UPDATE USER
        // =====================================================

        await connection.query(
            `
            UPDATE cst_users
            SET
                appointment_no = ?,
                academy_id = ?,
                branch_id = ?,
                first_name = ?,
                last_name = ?,
                email = ?,
                phone = ?,
                password = ?,
                profile_image = ?,
                user_type = ?,
                status = ?
            WHERE id = ?
            `,
            [
                appointment_no,
                academy_id,
                branch_id,
                first_name,
                last_name,
                email,
                phone,
                hashedPassword,
                imageName,
                user_type,
                status,
                userId
            ]
        );


        // =====================================================
        // CLEAN OLD USER MAPPING
        //
        // Important when user_type is changed
        // player -> staff
        // staff -> player
        // =====================================================

        // -----------------------------------------------------
        // Remove current user from player mapping
        // -----------------------------------------------------

        await connection.query(
            `
            UPDATE cst_admission_players
            SET user_id = NULL
            WHERE user_id = ?
            `,
            [userId]
        );


        // -----------------------------------------------------
        // Remove current user from staff mapping
        // -----------------------------------------------------

        await connection.query(
            `
            UPDATE cst_staff
            SET user_id = NULL
            WHERE user_id = ?
            `,
            [userId]
        );


        // -----------------------------------------------------
        // Remove current user from programs
        // -----------------------------------------------------

        await connection.query(
            `
            UPDATE cst_user_programs
            SET user_id = NULL
            WHERE user_id = ?
            `,
            [userId]
        );


        // =====================================================
        // PLAYER
        // =====================================================

        if (isPlayer) {

            // -------------------------------------------------
            // UPDATE PLAYER
            // -------------------------------------------------

            const [playerUpdate] =
                await connection.query(
                    `
                    UPDATE cst_admission_players
                    SET user_id = ?
                    WHERE id = ?
                    AND is_deleted = 0
                    `,
                    [
                        userId,
                        playerId
                    ]
                );


            if (
                playerUpdate.affectedRows === 0
            ) {

                throw new Error(
                    "Player user mapping failed"
                );

            }


            // -------------------------------------------------
            // UPDATE USER BRANCH
            //
            // Your current POST API uses
            // appointment_no in cst_user_branches
            // -------------------------------------------------

            const [branchUpdate] =
                await connection.query(
                    `
                    UPDATE cst_user_branches
                    SET user_id = ?
                    WHERE appointment_no = ?
                    `,
                    [
                        userId,
                        appointment_no
                    ]
                );


            if (
                branchUpdate.affectedRows === 0
            ) {

                throw new Error(
                    "User branch mapping failed"
                );

            }


            // -------------------------------------------------
            // UPDATE USER PROGRAMS
            //
            // cst_user_programs uses
            // admission_players_id
            // -------------------------------------------------

            const [programUpdate] =
                await connection.query(
                    `
                    UPDATE cst_user_programs
                    SET user_id = ?
                    WHERE admission_players_id = ?
                    AND is_deleted = 0
                    `,
                    [
                        userId,
                        playerId
                    ]
                );


            // -------------------------------------------------
            // Program record may not exist
            // so don't throw error here
            // -------------------------------------------------


        } else {

            // =================================================
            // STAFF / ADMIN / OTHER USER
            // =================================================

            // -------------------------------------------------
            // UPDATE STAFF
            // -------------------------------------------------

            const [staffUpdate] =
                await connection.query(
                    `
                    UPDATE cst_staff
                    SET user_id = ?
                    WHERE appointment_no = ?
                    AND is_deleted = 0
                    `,
                    [
                        userId,
                        appointment_no
                    ]
                );


            if (
                staffUpdate.affectedRows === 0
            ) {

                throw new Error(
                    "Staff user mapping failed"
                );

            }


            // -------------------------------------------------
            // UPDATE USER BRANCH
            // -------------------------------------------------

            const [branchUpdate] =
                await connection.query(
                    `
                    UPDATE cst_user_branches
                    SET user_id = ?
                    WHERE appointment_no = ?
                    `,
                    [
                        userId,
                        appointment_no
                    ]
                );


            if (
                branchUpdate.affectedRows === 0
            ) {

                throw new Error(
                    "User branch mapping failed"
                );

            }

        }


        // =====================================================
        // COMMIT
        // =====================================================

        await connection.commit();

        transactionStarted = false;


        // =====================================================
        // DELETE OLD IMAGE
        // Only after successful DB update
        // =====================================================

        if (
            newUploadedFilePath &&
            oldImagePath &&
            oldImagePath !== newUploadedFilePath
        ) {

            try {

                await fs.unlink(
                    oldImagePath
                );

            } catch {

                // Old image may not exist
            }

        }


        // =====================================================
        // SUCCESS
        // =====================================================

        return NextResponse.json(
            {
                success: true,

                message:
                    "User updated successfully",

                data: {
                    id: userId,

                    appointment_no:
                        appointment_no,

                    academy_id:
                        academy_id,

                    branch_id:
                        branch_id,

                    first_name:
                        first_name,

                    last_name:
                        last_name,

                    email:
                        email,

                    phone:
                        phone,

                    user_type:
                        user_type,

                    status:
                        status,

                    profile_image:
                        imageName
                            ? `/images/uploads/users/${imageName}`
                            : null
                }
            },
            {
                status: 200
            }
        );


    } catch (error) {

        // =====================================================
        // ROLLBACK
        // =====================================================

        if (transactionStarted) {

            try {

                await connection.rollback();

            } catch {}

        }


        // =====================================================
        // DELETE NEW UPLOADED IMAGE
        // =====================================================

        if (newUploadedFilePath) {

            try {

                await fs.unlink(
                    newUploadedFilePath
                );

            } catch {}

        }


        // =====================================================
        // ERROR
        // =====================================================

        console.error(
            "Update User Error:",
            error
        );


        return NextResponse.json(
            {
                success: false,

                message:
                    error.message ||
                    "Failed to update user",

                error:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined
            },
            {
                status: 500
            }
        );


    } finally {

        // =====================================================
        // RELEASE CONNECTION
        // =====================================================

        connection.release();

    }

}
