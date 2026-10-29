
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import pool from "@/app/components/lib/db";
import { ensurePlayerAccess } from "@/app/components/lib/playerAccessInit.js";


// =====================================================
// GET ALL USERS
// =====================================================

export async function GET(request) {

    const connection = await pool.getConnection();

    try {
        await ensurePlayerAccess(connection);

        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const user_type = searchParams.get("user_type");
        const status = searchParams.get("status");
        const search = searchParams.get("search");


        let sql = `
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

            WHERE u.is_deleted = 0
    `;

        const values = [];


        // =====================================================
        // ACADEMY FILTER
        // =====================================================

        if (academy_id) {

            sql += `
                AND u.academy_id = ?
    `;

            values.push(academy_id);
        }


        // =====================================================
        // BRANCH FILTER
        // =====================================================

        if (branch_id) {

            sql += `
                AND u.branch_id = ?
    `;

            values.push(branch_id);
        }


        // =====================================================
        // USER TYPE FILTER
        // =====================================================

        if (user_type) {
            if (user_type.toLowerCase() === "player" || user_type === "7") {
                sql += `
                    AND (LOWER(u.user_type) = 'player' OR u.user_type = '7')
                `;
            } else {
                sql += `
                    AND (LOWER(u.user_type) = LOWER(?) OR u.user_type = ?)
                `;
                values.push(user_type, user_type);
            }
        }


        // =====================================================
        // STATUS FILTER
        // =====================================================

        if (status !== null && status !== "") {

            sql += `
                AND u.status = ?
    `;

            values.push(status);
        }


        // =====================================================
        // SEARCH
        // =====================================================

        if (search) {

            sql += `
                AND(
        u.appointment_no LIKE ?
        OR u.first_name LIKE ?
        OR u.last_name LIKE ?
        OR u.email LIKE ?
        OR u.phone LIKE ?
        OR u.user_type LIKE ?
                )
    `;

            const searchValue = `% ${search}% `;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }


        // =====================================================
        // QUERY
        // =====================================================

        sql += `
            ORDER BY u.id DESC
    `;


        const [rows] = await connection.query(
            sql,
            values
        );


        return NextResponse.json({

            success: true,

            message: "Users fetched successfully",

            count: rows.length,

            data: rows

        });


    } catch (error) {

        console.error(
            "Get Users Error:",
            error
        );

        return NextResponse.json({

            success: false,

            message: "Failed to fetch users",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        }, {
            status: 500
        });


    } finally {

        connection.release();

    }
}


// =====================================================
// POST - CREATE USER
// =====================================================





export async function POST(request) {

    const connection = await pool.getConnection();

    let uploadedFilePath = null;
    let transactionStarted = false;

    try {

        const formData = await request.formData();


        // =====================================================
        // FORM DATA
        // =====================================================

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

        const password =
            formData.get("password")
                ?.toString();

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
                { status: 400 }
            );

        }


        if (!first_name) {

            return NextResponse.json(
                {
                    success: false,
                    message: "First name is required"
                },
                { status: 400 }
            );

        }


        if (!password) {

            return NextResponse.json(
                {
                    success: false,
                    message: "Password is required"
                },
                { status: 400 }
            );

        }


        if (!user_type) {

            return NextResponse.json(
                {
                    success: false,
                    message: "User type is required"
                },
                { status: 400 }
            );

        }


        // =====================================================
        // PLAYER CHECK
        // IMPORTANT:
        // FormData always gives string
        // =====================================================

        const isPlayer =
            user_type === "7" ||
            user_type.toLowerCase() === "player";


        // =====================================================
        // DUPLICATE APPOINTMENT NUMBER
        // =====================================================

        const [existingUser] =
            await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE appointment_no = ?
    LIMIT 1
        `,
                [appointment_no]
            );


        if (existingUser.length > 0) {

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Appointment number already exists"
                },
                { status: 409 }
            );

        }


        // =====================================================
        // DUPLICATE EMAIL
        // =====================================================

        if (email) {

            const [existingEmail] =
                await connection.query(
                    `
                    SELECT id
                    FROM cst_users
                    WHERE email = ?
    LIMIT 1
        `,
                    [email]
                );


            if (existingEmail.length > 0) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Email already exists"
                    },
                    { status: 409 }
                );

            }

        }


        // =====================================================
        // CHECK RELATED RECORD
        // =====================================================

        if (isPlayer) {

            // -------------------------------------------------
            // PLAYER
            // -------------------------------------------------

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
                    { status: 404 }
                );

            }


            if (
                playerRows[0].user_id !== null
            ) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This player is already linked with a user"
                    },
                    { status: 409 }
                );

            }

        } else {

            // -------------------------------------------------
            // STAFF / ADMIN / OTHER USER
            // -------------------------------------------------

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
                    { status: 404 }
                );

            }


            if (
                staffRows[0].user_id !== null
            ) {

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This staff is already linked with a user"
                    },
                    { status: 409 }
                );

            }

        }


        // =====================================================
        // PASSWORD HASH
        // =====================================================

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        // =====================================================
        // IMAGE UPLOAD
        // =====================================================

        let imageName = null;


        if (
            profile_image &&
            typeof profile_image === "object" &&
            profile_image.size > 0
        ) {

            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            ];


            // -------------------------------------------------
            // FILE TYPE
            // -------------------------------------------------

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
                    { status: 400 }
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
                    { status: 400 }
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
            // FILE NAME
            // IMPORTANT:
            // No space at the end
            // -------------------------------------------------

            imageName =
                `${Date.now()} -${Math.round(
                    Math.random() * 1000000
                )
                }${extension.toLowerCase()} `;


            uploadedFilePath =
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
                uploadedFilePath,
                buffer
            );

        }


        // =====================================================
        // START TRANSACTION
        // =====================================================

        await connection.beginTransaction();

        transactionStarted = true;


        // =====================================================
        // INSERT USER
        // =====================================================

        const [result] =
            await connection.query(
                `
                INSERT INTO cst_users
    (
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
    )
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    status
                ]
            );


        const userId =
            result.insertId;


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
    WHERE admission_no = ?
        AND is_deleted = 0
            `,
                    [
                        userId,
                        appointment_no
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
            // -------------------------------------------------

            await connection.query(
                `
                UPDATE cst_user_programs
                SET user_id = ?
    WHERE appointment_no = ?
        AND is_deleted = 0
            `,
                [
                    userId,
                    appointment_no
                ]
            );

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
        // SUCCESS
        // =====================================================

        return NextResponse.json(
            {
                success: true,

                message:
                    "User created successfully",

                data: {
                    id: userId,

                    appointment_no:
                        appointment_no,

                    user_type:
                        user_type,

                    profile_image:
                        imageName
                            ? `/ images / uploads / users / ${imageName} `
                            : null
                }
            },
            {
                status: 201
            }
        );


    } catch (error) {

        // =====================================================
        // ROLLBACK
        // =====================================================

        if (transactionStarted) {

            try {
                await connection.rollback();
            } catch { }

        }


        // =====================================================
        // DELETE UPLOADED IMAGE
        // =====================================================

        if (uploadedFilePath) {

            try {

                await fs.unlink(
                    uploadedFilePath
                );

            } catch { }

        }


        console.error(
            "Create User Error:",
            error
        );


        return NextResponse.json(
            {
                success: false,

                message:
                    error.message ||
                    "Failed to create user",

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

        connection.release();

    }

}



