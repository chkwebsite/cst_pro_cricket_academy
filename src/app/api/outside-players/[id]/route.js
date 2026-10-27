import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import pool from "@/app/components/lib/db";


/*
|--------------------------------------------------------------------------
| GET SINGLE OUTSIDE PLAYER
|--------------------------------------------------------------------------
*/

export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(Number(id))) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid player ID is required"
                },
                { status: 400 }
            );
        }

        const [rows] = await connection.query(
            `
            SELECT
                id,
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
                status,
                is_deleted,
                created_at,
                updated_at
            FROM cst_outside_players
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [Number(id)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Outside player not found"
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Outside player fetched successfully",
            data: rows[0]
        });

    } catch (error) {
        console.error("GET SINGLE OUTSIDE PLAYER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch outside player",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| UPDATE OUTSIDE PLAYER
|--------------------------------------------------------------------------
*/

export async function PUT(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(Number(id))) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid player ID is required"
                },
                { status: 400 }
            );
        }

        const playerId = Number(id);

        const [existingRows] = await connection.query(
            `
            SELECT *
            FROM cst_outside_players
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
                    message: "Outside player not found"
                },
                { status: 404 }
            );
        }

        const existingPlayer = existingRows[0];

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

        // REQUIRED PLAYER NAME
        if (!player_name || !player_name.toString().trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Player name is required"
                },
                { status: 400 }
            );
        }

        // CHECK PHONE DUPLICATE
        if (phone && phone.toString().trim()) {
            const [existingPhone] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE phone = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    phone.toString().trim(),
                    playerId
                ]
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

        // CHECK EMAIL DUPLICATE
        if (email && email.toString().trim()) {
            const [existingEmail] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE email = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    email.toString().trim(),
                    playerId
                ]
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

        let profileImagePath = existingPlayer.profile_image;

        /*
        |--------------------------------------------------------------------------
        | IMAGE UPLOAD
        |--------------------------------------------------------------------------
        */

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

            const filePath = path.join(
                uploadDir,
                fileName
            );

            const bytes = await profileImage.arrayBuffer();

            fs.writeFileSync(
                filePath,
                Buffer.from(bytes)
            );

            profileImagePath =
                `/images/uploads/outside-players/${fileName}`;

            /*
            |--------------------------------------------------------------------------
            | DELETE OLD IMAGE
            |--------------------------------------------------------------------------
            */

            if (existingPlayer.profile_image) {
                const oldImagePath = path.join(
                    process.cwd(),
                    "public",
                    existingPlayer.profile_image.replace(
                        /^\/+/,
                        ""
                    )
                );

                if (
                    fs.existsSync(oldImagePath) &&
                    fs.statSync(oldImagePath).isFile()
                ) {
                    try {
                        fs.unlinkSync(oldImagePath);
                    } catch (deleteError) {
                        console.error(
                            "OLD IMAGE DELETE ERROR:",
                            deleteError
                        );
                    }
                }
            }
        }

        /*
        |--------------------------------------------------------------------------
        | UPDATE
        |--------------------------------------------------------------------------
        */

        await connection.query(
            `
            UPDATE cst_outside_players
            SET
                player_name = ?,
                age_group_id = ?,
                phone = ?,
                email = ?,
                date_of_birth = ?,
                gender = ?,
                batting_style = ?,
                bowling_style = ?,
                address = ?,
                profile_image = ?,
                status = ?
            WHERE id = ?
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
                    : existingPlayer.status,
                playerId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Outside player updated successfully",
            data: {
                id: playerId,
                profile_image: profileImagePath
            }
        });

    } catch (error) {
        console.error("UPDATE OUTSIDE PLAYER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update outside player",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| DELETE OUTSIDE PLAYER - SOFT DELETE
|--------------------------------------------------------------------------
*/

export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id || isNaN(Number(id))) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid player ID is required"
                },
                { status: 400 }
            );
        }

        const playerId = Number(id);

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_outside_players
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
                    message: "Outside player not found"
                },
                { status: 404 }
            );
        }

        await connection.query(
            `
            UPDATE cst_outside_players
            SET
                is_deleted = 1,
                status = 0
            WHERE id = ?
            `,
            [playerId]
        );

        return NextResponse.json({
            success: true,
            message: "Outside player deleted successfully"
        });

    } catch (error) {
        console.error("DELETE OUTSIDE PLAYER ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete outside player",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}