import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

let schemaEnsured = false;
async function ensureOutsidePlayersSchema(connection) {
    if (schemaEnsured) return;
    try {
        const [academyCols] = await connection.query(
            "SHOW COLUMNS FROM cst_outside_players LIKE 'academy_id'"
        );
        if (academyCols.length === 0) {
            await connection.query(
                "ALTER TABLE cst_outside_players ADD COLUMN academy_id INT NULL AFTER id"
            );
        }

        const [branchCols] = await connection.query(
            "SHOW COLUMNS FROM cst_outside_players LIKE 'branch_id'"
        );
        if (branchCols.length === 0) {
            await connection.query(
                "ALTER TABLE cst_outside_players ADD COLUMN branch_id INT NULL AFTER academy_id"
            );
        }

        await connection.query(`
            UPDATE cst_outside_players
            SET
                academy_id = COALESCE(NULLIF(academy_id, 0), 1),
                branch_id = COALESCE(NULLIF(branch_id, 0), 1)
            WHERE academy_id IS NULL OR academy_id = 0 OR branch_id IS NULL OR branch_id = 0
        `);

        schemaEnsured = true;
    } catch (err) {
        console.error("ensureOutsidePlayersSchema error:", err.message);
    }
}

export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    const connection = await pool.getConnection();

    try {
        await ensureOutsidePlayersSchema(connection);

        const { searchParams } = new URL(request.url);

        const player_name = searchParams.get("player_name") || "";
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        const age_group_id = searchParams.get("age_group_id") || "";
        const gender = searchParams.get("gender") || "";
        const batting_style = searchParams.get("batting_style") || "";
        const bowling_style = searchParams.get("bowling_style") || "";
        const status = searchParams.get("status");
        const is_deleted = searchParams.get("is_deleted");
        const academy_id_param = searchParams.get("academy_id");
        const branch_id_param = searchParams.get("branch_id");

        let sql = `
            SELECT
                outside_player.id,
                outside_player.academy_id,
                academy.academy_name,
                outside_player.branch_id,
                branch.branch_name,
                outside_player.player_name,
                outside_player.age_group_id,
                age_group.age_group,
                outside_player.phone,
                outside_player.email,
                outside_player.date_of_birth,
                outside_player.gender,
                outside_player.batting_style,
                outside_player.bowling_style,
                outside_player.address,
                outside_player.profile_image,
                outside_player.status,
                outside_player.is_deleted,
                outside_player.created_at,
                outside_player.updated_at
            FROM cst_outside_players AS outside_player
            LEFT JOIN cst_academy AS academy
                ON academy.id = outside_player.academy_id
            LEFT JOIN cst_branch AS branch
                ON branch.id = outside_player.branch_id
            LEFT JOIN cst_age_groups AS age_group
                ON age_group.id = outside_player.age_group_id
            WHERE 1 = 1
        `;

        const params = [];

        // Tenant Isolation
        if (authUser.isSuperAdmin) {
            if (academy_id_param) {
                sql += ` AND outside_player.academy_id = ?`;
                params.push(Number(academy_id_param));
            }
            if (branch_id_param) {
                sql += ` AND outside_player.branch_id = ?`;
                params.push(Number(branch_id_param));
            }
        } else if (authUser.isAcademyAdmin) {
            sql += ` AND outside_player.academy_id = ?`;
            params.push(Number(authUser.academy_id));
            if (branch_id_param) {
                sql += ` AND outside_player.branch_id = ?`;
                params.push(Number(branch_id_param));
            }
        } else if (authUser.isBranchAdmin) {
            sql += ` AND outside_player.academy_id = ?`;
            params.push(Number(authUser.academy_id));
            if (authUser.branch_id) {
                sql += ` AND outside_player.branch_id = ?`;
                params.push(Number(authUser.branch_id));
            }
        } else {
            // Other staff / coach / players
            if (authUser.academy_id) {
                sql += ` AND outside_player.academy_id = ?`;
                params.push(Number(authUser.academy_id));
            }
            if (Array.isArray(authUser.assigned_branch_ids) && authUser.assigned_branch_ids.length > 0) {
                const placeholders = authUser.assigned_branch_ids.map(() => "?").join(",");
                sql += ` AND outside_player.branch_id IN (${placeholders})`;
                params.push(...authUser.assigned_branch_ids.map(Number));
            } else if (authUser.branch_id) {
                sql += ` AND outside_player.branch_id = ?`;
                params.push(Number(authUser.branch_id));
            }
        }

        if (player_name) {
            sql += ` AND outside_player.player_name LIKE ?`;
            params.push(`%${player_name}%`);
        }

        if (phone) {
            sql += ` AND outside_player.phone LIKE ?`;
            params.push(`%${phone}%`);
        }

        if (email) {
            sql += ` AND outside_player.email LIKE ?`;
            params.push(`%${email}%`);
        }

        if (age_group_id) {
            sql += ` AND outside_player.age_group_id = ?`;
            params.push(Number(age_group_id));
        }

        if (gender) {
            sql += ` AND outside_player.gender = ?`;
            params.push(gender);
        }

        if (batting_style) {
            sql += ` AND outside_player.batting_style LIKE ?`;
            params.push(`%${batting_style}%`);
        }

        if (bowling_style) {
            sql += ` AND outside_player.bowling_style LIKE ?`;
            params.push(`%${bowling_style}%`);
        }

        if (status !== null && status !== "") {
            sql += ` AND outside_player.status = ?`;
            params.push(Number(status));
        }

        if (is_deleted !== null && is_deleted !== "") {
            sql += ` AND outside_player.is_deleted = ?`;
            params.push(Number(is_deleted));
        } else {
            sql += ` AND outside_player.is_deleted = 0`;
        }

        sql += ` ORDER BY outside_player.id DESC`;

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Outside players fetched successfully",
            data: rows
        });

    } catch (error) {
        console.error("GET OUTSIDE PLAYERS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch outside players",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden: Players cannot create outside players." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        await ensureOutsidePlayersSchema(connection);

        const formData = await request.formData();

        const formAcademyId = formData.get("academy_id");
        const formBranchId = formData.get("branch_id");
        const player_name = formData.get("player_name");
        const age_group_id = formData.get("age_group_id");
        const phone = formData.get("phone");
        const email = formData.get("email");
        const date_of_birth = formData.get("date_of_birth");
        const gender = formData.get("gender");
        const batting_style = formData.get("batting_style");
        const bowling_style = formData.get("bowling_style");
        const address = formData.get("address");
        const status = formData.get("status");
        const profileImage = formData.get("profile_image");

        // VALIDATION: Player Name
        if (!player_name || !player_name.toString().trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Player name is required"
                },
                { status: 400 }
            );
        }

        // Resolve academy_id and branch_id
        let targetAcademyId = null;
        let targetBranchId = null;

        if (authUser.isSuperAdmin) {
            targetAcademyId = formAcademyId ? Number(formAcademyId) : 1;
            targetBranchId = formBranchId ? Number(formBranchId) : null;
        } else if (authUser.isAcademyAdmin) {
            targetAcademyId = Number(authUser.academy_id);
            targetBranchId = formBranchId ? Number(formBranchId) : (authUser.branch_id ? Number(authUser.branch_id) : null);
        } else {
            // Branch Admin / Staff
            targetAcademyId = Number(authUser.academy_id);
            targetBranchId = authUser.branch_id ? Number(authUser.branch_id) : (formBranchId ? Number(formBranchId) : null);
        }

        if (!targetAcademyId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy is required to create an outside player"
                },
                { status: 400 }
            );
        }

        // Verify branch belongs to academy if provided
        if (targetBranchId) {
            const [branchCheck] = await connection.query(
                "SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? AND is_deleted = 0 LIMIT 1",
                [targetBranchId, targetAcademyId]
            );
            if (branchCheck.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Selected branch does not belong to the authorized academy"
                    },
                    { status: 400 }
                );
            }
        }

        // Check duplicate phone within academy
        if (phone && phone.toString().trim()) {
            const [existingPhone] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE phone = ?
                AND academy_id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [phone.toString().trim(), targetAcademyId]
            );

            if (existingPhone.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Phone number already exists in this academy"
                    },
                    { status: 409 }
                );
            }
        }

        // Check duplicate email within academy
        if (email && email.toString().trim()) {
            const [existingEmail] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE email = ?
                AND academy_id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [email.toString().trim(), targetAcademyId]
            );

            if (existingEmail.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Email already exists in this academy"
                    },
                    { status: 409 }
                );
            }
        }

        let profileImagePath = null;

        // IMAGE UPLOAD
        if (
            profileImage &&
            typeof profileImage === "object" &&
            profileImage.size > 0
        ) {
            const allowedTypes = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(profileImage.type)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Only JPG, JPEG, PNG and WEBP images are allowed"
                    },
                    { status: 400 }
                );
            }

            if (profileImage.size > 2 * 1024 * 1024) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Profile image must be less than 2MB"
                    },
                    { status: 400 }
                );
            }

            const uploadDir = path.join(
                process.cwd(),
                "public",
                "images",
                "uploads",
                "outside-players"
            );

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, {
                    recursive: true
                });
            }

            const extension = path.extname(profileImage.name);
            const fileName = `${Date.now()}-${Math.floor(
                Math.random() * 1000000
            )}${extension}`;

            const filePath = path.join(uploadDir, fileName);
            const bytes = await profileImage.arrayBuffer();

            fs.writeFileSync(
                filePath,
                Buffer.from(bytes)
            );

            profileImagePath = `/images/uploads/outside-players/${fileName}`;
        }

        const [result] = await connection.query(
            `
            INSERT INTO cst_outside_players (
                academy_id,
                branch_id,
                player_name,
                age_group_id,
                phone,
                email,
                date_of_birth,
                gender,
                batting_style,
                bowling_style,
                address,
                profile_image,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                targetAcademyId,
                targetBranchId || null,
                player_name.toString().trim(),
                age_group_id || null,
                phone ? phone.toString().trim() : null,
                email ? email.toString().trim() : null,
                date_of_birth || null,
                gender ? gender.toString().trim() : null,
                batting_style
                    ? batting_style.toString().trim()
                    : null,
                bowling_style
                    ? bowling_style.toString().trim()
                    : null,
                address ? address.toString().trim() : null,
                profileImagePath,
                status !== null && status !== ""
                    ? Number(status)
                    : 1
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Outside player created successfully",
                data: {
                    id: result.insertId,
                    academy_id: targetAcademyId,
                    branch_id: targetBranchId,
                    profile_image: profileImagePath
                }
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("CREATE OUTSIDE PLAYER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create outside player",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
