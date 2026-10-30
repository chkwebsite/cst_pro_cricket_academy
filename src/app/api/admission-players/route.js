import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";
import { syncOnUserProgramInsert, syncOnUserProgramUpdate } from "@/app/components/lib/playerFlowSync.js";
import { syncPlayerUserAndRole } from "@/app/components/lib/playerUserSync.js";
import { ensurePlayerAccess } from "@/app/components/lib/playerAccessInit.js";

const uploadDir = path.join(
    process.cwd(),
    "public",
    "images",
    "uploads",
    "admission-players"
);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
];

const ALLOWED_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
];

/* =========================================================
   HELPERS
========================================================= */

function toNullable(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return value;
}

function toNumberOrNull(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

async function saveAadhaarFile(file) {
    if (
        !file ||
        typeof file !== "object" ||
        !file.name
    ) {
        return null;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error(
            "Only JPG, PNG, WEBP and PDF files are allowed"
        );
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(
            "Aadhaar card file must be less than 2MB"
        );
    }

    const extension = path.extname(file.name).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        throw new Error(
            "Invalid Aadhaar card file extension"
        );
    }

    await fs.mkdir(uploadDir, {
        recursive: true,
    });

    const fileName =
        `aadhaar_${Date.now()}_${Math.floor(
            Math.random() * 1000000
        )}${extension}`;

    const filePath = path.join(
        uploadDir,
        fileName
    );

    const buffer = Buffer.from(
        await file.arrayBuffer()
    );

    await fs.writeFile(
        filePath,
        buffer
    );

    return {
        url: `/uploads/admission-players/${fileName}`,
        filePath,
    };
}

async function deleteFileByUrl(fileUrl) {
    if (!fileUrl) {
        return;
    }

    try {
        const relativePath = fileUrl.startsWith("/")
            ? fileUrl.substring(1)
            : fileUrl;

        const filePath = path.join(
            process.cwd(),
            "public",
            relativePath
        );

        await fs.unlink(filePath);
    } catch (error) {
        // File may already be deleted.
        console.warn(
            "Unable to delete file:",
            fileUrl,
            error.message
        );
    }
}

async function validateBranchRoleProgram(
    connection,
    branch_id,
    role_id,
    program_id
) {
    /* -----------------------------
       BRANCH
    ----------------------------- */

    const [branches] = await connection.query(
        `
        SELECT id
        FROM cst_branch
        WHERE id = ?
          AND status = 1
        LIMIT 1
        `,
        [branch_id]
    );

    if (branches.length === 0) {
        throw new Error("Branch not found");
    }

    /* -----------------------------
       ROLE
    ----------------------------- */

    const [roles] = await connection.query(
        `
        SELECT id
        FROM cst_roles
        WHERE id = ?
          AND status = 1
        LIMIT 1
        `,
        [role_id]
    );

    if (roles.length === 0) {
        throw new Error("Role not found");
    }

    /* -----------------------------
       PROGRAM
       IMPORTANT:
       Program must belong to branch
    ----------------------------- */

    const [programs] = await connection.query(
        `
        SELECT id
        FROM cst_programs
        WHERE id = ?
          AND status = 1
          AND branch_id = ?
        LIMIT 1
        `,
        [program_id, branch_id]
    );

    if (programs.length === 0) {
        throw new Error(
            "Program not found for the selected branch"
        );
    }
}

async function validateUser(connection, user_id) {
    if (!user_id) {
        return;
    }

    const [users] = await connection.query(
        `
        SELECT id
        FROM cst_users
        WHERE id = ?
        LIMIT 1
        `,
        [user_id]
    );

    if (users.length === 0) {
        throw new Error("User not found");
    }
}

async function generateAdmissionNumber(connection) {
    const year = new Date().getFullYear();

    /*
     * Random admission number.
     * Database should also have UNIQUE(admission_no)
     * to completely protect against concurrent requests.
     */

    for (let attempt = 0; attempt < 20; attempt++) {
        const random = Math.floor(
            100000 + Math.random() * 900000
        );

        const admissionNo =
            `ADM-${year}-${random}`;

        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_admission_players
            WHERE admission_no = ?
            LIMIT 1
            `,
            [admissionNo]
        );

        if (existing.length === 0) {
            return admissionNo;
        }
    }

    throw new Error(
        "Unable to generate unique admission number"
    );
}

function validateRequiredFields(
    first_name,
    branch_id,
    role_id,
    program_id
) {
    if (!first_name || !String(first_name).trim()) {
        throw new Error("First name is required");
    }

    if (!branch_id) {
        throw new Error("Branch ID is required");
    }

    if (!role_id) {
        throw new Error("Role ID is required");
    }

    if (!program_id) {
        throw new Error("Program ID is required");
    }
}

/* =========================================================
   GET ALL PLAYERS
========================================================= */

export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } =
            new URL(request.url);

        const branch_id =
            searchParams.get("branch_id");

        const academy_id =
            searchParams.get("academy_id");

        const role_id =
            searchParams.get("role_id");

        const status =
            searchParams.get("status");

        const under_age =
            searchParams.get("under_age");

        const search =
            searchParams.get("search");

        let sql = `
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

            WHERE p.is_deleted = 0
        `;

        const values = [];

        if (academy_id) {
            const academyIdNumber = Number(academy_id);

            if (!Number.isInteger(academyIdNumber) || academyIdNumber <= 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid academy ID",
                    },
                    { status: 400 }
                );
            }

            sql += `
                AND b.academy_id = ?
            `;

            values.push(academyIdNumber);
        }

        if (branch_id) {
            sql += `
                AND p.branch_id = ?
            `;

            values.push(branch_id);
        }

        if (role_id) {
            sql += `
                AND p.role_id = ?
            `;

            values.push(role_id);
        }

        if (
            status !== null &&
            status !== ""
        ) {
            sql += `
                AND p.status = ?
            `;

            values.push(status);
        }

        if (
            under_age !== null &&
            under_age !== ""
        ) {
            sql += `
                AND p.under_age = ?
            `;

            values.push(under_age);
        }

        if (search) {
            sql += `
                AND (
                    p.admission_no LIKE ?
                    OR p.first_name LIKE ?
                    OR p.last_name LIKE ?
                    OR p.father_name LIKE ?
                    OR p.phone LIKE ?
                    OR p.email LIKE ?
                )
            `;

            const searchValue =
                `%${search}%`;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        sql += `
            ORDER BY p.id DESC
        `;

        const [rows] =
            await connection.query(
                sql,
                values
            );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });

    } catch (error) {
        console.error(
            "GET ADMISSION PLAYERS ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to fetch admission players",
            },
            {
                status: 500,
            }
        );

    } finally {
        connection.release();
    }
}

/* =========================================================
   CREATE PLAYER
========================================================= */

export async function POST(request) {
    const connection =
        await pool.getConnection();

    let uploadedFile = null;

    try {
        const formData =
            await request.formData();

        const user_id =
            toNumberOrNull(
                formData.get("user_id")
            );

        const program_id =
            toNumberOrNull(
                formData.get("program_id")
            );

        const first_name =
            formData.get("first_name");

        const last_name =
            formData.get("last_name");

        const father_name =
            formData.get("father_name");

        const mother_name =
            formData.get("mother_name");

        const email =
            formData.get("email");

        const phone =
            formData.get("phone");

        const address =
            formData.get("address");

        const city =
            formData.get("city");

        const state =
            formData.get("state");

        const pin_code =
            formData.get("pin_code");

        const under_age =
            toNumberOrNull(
                formData.get("under_age")
            ) ?? 0;

        const gender =
            formData.get("gender");

        const aadhaar_no =
            formData.get("aadhaar_no");

        const playing_academy =
            formData.get("playing_academy");

        const branch_id =
            toNumberOrNull(
                formData.get("branch_id")
            );

        const role_id =
            toNumberOrNull(
                formData.get("role_id")
            );



        const start_date =
            toNullable(
                formData.get("start_date")
            );

        const end_date =
            toNullable(
                formData.get("end_date")
            );

        const status =
            toNumberOrNull(
                formData.get("status")
            ) ?? 1;

        const paid_amount =
            toNumberOrNull(
                formData.get("paid_amount") ||
                formData.get("initial_payment")
            );

        const payment_mode =
            formData.get("payment_mode") || "Cash";

        const transaction_no =
            formData.get("transaction_no") || null;

        const payment_remarks =
            formData.get("payment_remarks") || null;

        const discount_amount =
            toNumberOrNull(
                formData.get("discount_amount")
            ) || 0;

        const aadhaarFile =
            formData.get("aadhaar_card");

        /* -----------------------------
           VALIDATION
        ----------------------------- */

        validateRequiredFields(
            first_name,
            branch_id,
            role_id,
            program_id
        );

        await validateBranchRoleProgram(
            connection,
            branch_id,
            role_id,
            program_id
        );

        await validateUser(
            connection,
            user_id
        );

        /* -----------------------------
           UPLOAD FILE
        ----------------------------- */

        if (
            aadhaarFile &&
            typeof aadhaarFile === "object" &&
            aadhaarFile.name
        ) {
            uploadedFile =
                await saveAadhaarFile(
                    aadhaarFile
                );
        }

        /* -----------------------------
           ADMISSION NUMBER
        ----------------------------- */

        const admissionNo =
            await generateAdmissionNumber(
                connection
            );

        /* -----------------------------
           TRANSACTION
        ----------------------------- */

        await connection.beginTransaction();

        try {
            await ensurePlayerAccess(connection);

            const { userId: syncedUserId } = await syncPlayerUserAndRole({
                connection,
                admissionNo,
                userId: user_id,
                firstName: first_name,
                lastName: last_name,
                email,
                phone,
                branchId: branch_id,
                roleId: role_id,
                status,
            });

            const [result] =
                await connection.query(
                    `
                    INSERT INTO cst_admission_players
                    (
                        user_id,
                        program_id,
                        admission_no,

                        first_name,
                        last_name,
                        father_name,
                        mother_name,

                        email,
                        phone,

                        address,
                        city,
                        state,
                        pin_code,

                        under_age,
                        gender,

                        aadhaar_no,
                        aadhaar_card,

                        playing_academy,

                        branch_id,
                        role_id,

                        status
                    )
                    VALUES
                    (
                        ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?,
                        ?, ?, ?, ?,
                        ?, ?,
                        ?, ?,
                        ?,
                        ?, ?,
                        ?
                    )
                    `,
                    [
                        syncedUserId,
                        program_id,
                        admissionNo,

                        String(first_name).trim(),
                        toNullable(last_name),
                        toNullable(father_name),
                        toNullable(mother_name),

                        toNullable(email),
                        toNullable(phone),

                        toNullable(address),
                        toNullable(city),
                        toNullable(state),
                        toNullable(pin_code),

                        under_age,
                        toNullable(gender),

                        toNullable(aadhaar_no),
                        uploadedFile
                            ? uploadedFile.url
                            : null,

                        toNullable(
                            playing_academy
                        ),

                        branch_id,
                        role_id,

                        status,
                    ]
                );

            const insertedPlayerId =
                result.insertId;

            /* -----------------------------
               PROGRAM ENROLLMENT
            ----------------------------- */

            const [userProgramResult] = await connection.query(
                `
                INSERT INTO cst_user_programs
                (
                    user_id,
                    appointment_no,
                    program_id,
                    branch_id,
                    admission_players_id,
                    start_date,
                    end_date,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    syncedUserId,
                    admissionNo,
                    program_id,
                    branch_id,
                    insertedPlayerId,
                    start_date,
                    end_date,
                    status,
                ]
            );

            await connection.query(`
                INSERT INTO cst_user_branches (
                    branch_id,
                    appointment_no,
                    user_id
                ) VALUES (?, ?, ?)
                `, [Number(branch_id), admissionNo, syncedUserId]);

            // Automatically sync fee invoice, initial payment (if any), and player attendance
            try {
                await syncOnUserProgramInsert({
                    connection,
                    userProgramId: userProgramResult.insertId,
                    admissionPlayersId: insertedPlayerId,
                    programId: program_id,
                    branchId: branch_id,
                    userId: syncedUserId,
                    startDate: start_date,
                    endDate: end_date,
                    status,
                    initialPayment: paid_amount ? {
                        paid_amount,
                        payment_mode,
                        transaction_no,
                        remarks: payment_remarks,
                        discount_amount,
                    } : null,
                });
            } catch (syncErr) {
                console.error("ADMISSION PLAYER FLOW SYNC ERROR:", syncErr);
            }

            await connection.commit();

            /* -----------------------------
               GET CREATED PLAYER
            ----------------------------- */

            const [rows] =
                await connection.query(
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
                    [insertedPlayerId]
                );

            return NextResponse.json(
                {
                    success: true,
                    message:
                        "Admission player created and enrolled successfully",
                    data: rows[0],
                },
                {
                    status: 201,
                }
            );

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (error) {
        console.error(
            "CREATE ADMISSION PLAYER ERROR:",
            error
        );

        /* Delete uploaded file if DB operation failed */
        if (uploadedFile?.url) {
            await deleteFileByUrl(
                uploadedFile.url
            );
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    error.message ||
                    "Failed to create admission player",
            },
            {
                status: 500,
            }
        );

    } finally {
        connection.release();
    }
}

/* =========================================================
   UPDATE PLAYER
   Frontend calls:
   PUT /api/admission-players/:id
========================================================= */

export async function PUT(request, context) {
    const connection =
        await pool.getConnection();

    let uploadedFile = null;

    try {
        const { id } = await context.params;

        const playerId =
            Number(id);

        if (
            !Number.isInteger(playerId) ||
            playerId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid player ID",
                },
                {
                    status: 400,
                }
            );
        }

        const formData =
            await request.formData();

        const user_id =
            toNumberOrNull(
                formData.get("user_id")
            );
        const program_id = toNumberOrNull(
            formData.get("program_id")
        );
        const first_name =
            formData.get("first_name");

        const last_name =
            formData.get("last_name");

        const father_name =
            formData.get("father_name");

        const mother_name =
            formData.get("mother_name");

        const email =
            formData.get("email");

        const phone =
            formData.get("phone");

        const address =
            formData.get("address");

        const city =
            formData.get("city");

        const state =
            formData.get("state");

        const pin_code =
            formData.get("pin_code");

        const under_age =
            toNumberOrNull(
                formData.get("under_age")
            ) ?? 0;

        const gender =
            formData.get("gender");

        const aadhaar_no =
            formData.get("aadhaar_no");

        const playing_academy =
            formData.get("playing_academy");

        const branch_id =
            toNumberOrNull(
                formData.get("branch_id")
            );

        const role_id =
            toNumberOrNull(
                formData.get("role_id")
            );



        const start_date =
            toNullable(
                formData.get("start_date")
            );

        const end_date =
            toNullable(
                formData.get("end_date")
            );

        const status =
            toNumberOrNull(
                formData.get("status")
            ) ?? 1;

        const paid_amount =
            toNumberOrNull(
                formData.get("paid_amount") ||
                formData.get("initial_payment")
            );

        const payment_mode =
            formData.get("payment_mode") || "Cash";

        const transaction_no =
            formData.get("transaction_no") || null;

        const payment_remarks =
            formData.get("payment_remarks") || null;

        const discount_amount =
            toNumberOrNull(
                formData.get("discount_amount")
            ) || 0;

        const aadhaarFile =
            formData.get("aadhaar_card");

        /* -----------------------------
           VALIDATION
        ----------------------------- */

        validateRequiredFields(
            first_name,
            branch_id,
            role_id,
            program_id
        );

        /* -----------------------------
           GET EXISTING PLAYER
        ----------------------------- */

        const [existingRows] =
            await connection.query(
                `
                SELECT
                    id,
                    admission_no,
                    aadhaar_card
                FROM cst_admission_players
                WHERE id = ?
                  AND is_deleted = 0
                LIMIT 1
                `,
                [playerId]
            );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Admission player not found",
                },
                {
                    status: 404,
                }
            );
        }

        const existingPlayer =
            existingRows[0];

        /* -----------------------------
           VALIDATE REFERENCES
        ----------------------------- */

        await validateBranchRoleProgram(
            connection,
            branch_id,
            role_id,
            program_id
        );

        await validateUser(
            connection,
            user_id
        );

        /* -----------------------------
           OPTIONAL NEW AADHAAR
        ----------------------------- */

        if (
            aadhaarFile &&
            typeof aadhaarFile === "object" &&
            aadhaarFile.name
        ) {
            uploadedFile =
                await saveAadhaarFile(
                    aadhaarFile
                );
        }

        await connection.beginTransaction();

        try {
            await ensurePlayerAccess(connection);

            const { userId: syncedUserId } = await syncPlayerUserAndRole({
                connection,
                admissionPlayerId: playerId,
                admissionNo: existingPlayer.admission_no,
                userId: user_id,
                firstName: first_name,
                lastName: last_name,
                email,
                phone,
                branchId: branch_id,
                roleId: role_id,
                status,
            });

            /* -----------------------------
               UPDATE PLAYER
            ----------------------------- */

            await connection.query(
                `
                UPDATE cst_admission_players
                SET
                    user_id = ?,

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
                  AND is_deleted = 0
                `,
                [
                    syncedUserId,

                    String(first_name).trim(),
                    toNullable(last_name),
                    toNullable(father_name),
                    toNullable(mother_name),

                    toNullable(email),
                    toNullable(phone),

                    toNullable(address),
                    toNullable(city),
                    toNullable(state),
                    toNullable(pin_code),

                    under_age,
                    toNullable(gender),

                    toNullable(aadhaar_no),

                    uploadedFile
                        ? uploadedFile.url
                        : existingPlayer.aadhaar_card,

                    toNullable(
                        playing_academy
                    ),

                    branch_id,
                    role_id,

                    status,

                    playerId,
                ]
            );

            /* -----------------------------
               UPDATE PROGRAM ENROLLMENT
            ----------------------------- */

            const [programRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM cst_user_programs
                    WHERE admission_players_id = ?
                    LIMIT 1
                    `,
                    [playerId]
                );

            if (programRows.length > 0) {
                await connection.query(
                    `
                    UPDATE cst_user_programs
                    SET
                        user_id = ?,
                        program_id = ?,
                        branch_id = ?,
                        start_date = ?,
                        end_date = ?,
                        status = ?
                    WHERE admission_players_id = ?
                    `,
                    [
                        syncedUserId,
                        program_id,
                        branch_id,
                        start_date,
                        end_date,
                        status,
                        playerId,
                    ]
                );

                await connection.query(
                    `UPDATE cst_user_branches
                     SET branch_id = ?, user_id = COALESCE(?, user_id)
                     WHERE appointment_no = ?`,
                    [Number(branch_id), syncedUserId, existingPlayer.admission_no]
                );

                // Automatically sync updated fees and attendance
                try {
                    await syncOnUserProgramUpdate({
                        connection,
                        userProgramId: programRows[0].id,
                        admissionPlayersId: playerId,
                        programId: program_id,
                        branchId: branch_id,
                        userId: syncedUserId,
                        startDate: start_date,
                        endDate: end_date,
                        status,
                    });
                } catch (syncErr) {
                    console.error("ADMISSION PLAYER UPDATE SYNC ERROR:", syncErr);
                }
            } else {
                const [newProgResult] = await connection.query(
                    `
                    INSERT INTO cst_user_programs
                    (
                        user_id,
                        program_id,
                        branch_id,
                        admission_players_id,
                        start_date,
                        end_date,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        user_id,
                        program_id,
                        branch_id,
                        playerId,
                        start_date,
                        end_date,
                        status,
                    ]
                );

                try {
                    await syncOnUserProgramInsert({
                        connection,
                        userProgramId: newProgResult.insertId,
                        admissionPlayersId: playerId,
                        programId,
                        branchId: branch_id,
                        userId: user_id,
                        startDate: start_date,
                        endDate: end_date,
                        status,
                    });
                } catch (syncErr) {
                    console.error("ADMISSION PLAYER INSERT SYNC ERROR:", syncErr);
                }
            }

            await connection.commit();

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

        /* -----------------------------
           DELETE OLD FILE
           ONLY AFTER SUCCESSFUL COMMIT
        ----------------------------- */

        if (
            uploadedFile &&
            existingPlayer.aadhaar_card &&
            existingPlayer.aadhaar_card !==
            uploadedFile.url
        ) {
            await deleteFileByUrl(
                existingPlayer.aadhaar_card
            );
        }

        /* -----------------------------
           GET UPDATED PLAYER
        ----------------------------- */

        const [rows] =
            await connection.query(
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
                [playerId]
            );

        return NextResponse.json(
            {
                success: true,
                message:
                    "Admission player updated successfully",
                data: rows[0],
            },
            {
                status: 200,
            }
        );

    } catch (error) {
        console.error(
            "UPDATE ADMISSION PLAYER ERROR:",
            error
        );

        /*
         * New file was uploaded but DB update failed.
         * Remove it so we don't leave orphan files.
         */
        if (uploadedFile?.url) {
            await deleteFileByUrl(
                uploadedFile.url
            );
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    error.message ||
                    "Failed to update admission player",
            },
            {
                status: 500,
            }
        );

    } finally {
        connection.release();
    }
}

/* =========================================================
   DELETE PLAYER
   Soft delete
========================================================= */

export async function DELETE(request, context) {
    const connection =
        await pool.getConnection();

    try {
        const { id } = await context.params;

        const playerId =
            Number(id);

        if (
            !Number.isInteger(playerId) ||
            playerId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid player ID",
                },
                {
                    status: 400,
                }
            );
        }

        const [result] =
            await connection.query(
                `
                UPDATE cst_admission_players
                SET
                    is_deleted = 1
                WHERE id = ?
                  AND is_deleted = 0
                `,
                [playerId]
            );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Admission player not found",
                },
                {
                    status: 404,
                }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "Admission player deleted successfully",
        });

    } catch (error) {
        console.error(
            "DELETE ADMISSION PLAYER ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to delete admission player",
            },
            {
                status: 500,
            }
        );

    } finally {
        connection.release();
    }
}