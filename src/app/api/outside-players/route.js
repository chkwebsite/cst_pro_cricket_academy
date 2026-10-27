import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import pool from "@/app/components/lib/db";

export async function GET(request) {
    const connection = await pool.getConnection();

    try {
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

        let sql = `
            SELECT
                outside_player.id,
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
            LEFT JOIN cst_age_groups AS age_group
                ON age_group.id = outside_player.age_group_id
            WHERE 1 = 1
        `;

        const params = [];

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
    const connection = await pool.getConnection();

    try {
        const formData = await request.formData();

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

        // VALIDATION
        if (!player_name || !player_name.toString().trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Player name is required"
                },
                { status: 400 }
            );
        }

        // Check duplicate phone
        if (phone && phone.toString().trim()) {
            const [existingPhone] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE phone = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [phone.toString().trim()]
            );

            if (existingPhone.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Phone number already exists"
                    },
                    { status: 409 }
                );
            }
        }

        // Check duplicate email
        if (email && email.toString().trim()) {
            const [existingEmail] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE email = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [email.toString().trim()]
            );

            if (existingEmail.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Email already exists"
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

            // FULL PATH SAVE IN DATABASE
            profileImagePath =
                `/images/uploads/outside-players/${fileName}`;
        }

        const [result] = await connection.query(
            `
            INSERT INTO cst_outside_players (
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
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