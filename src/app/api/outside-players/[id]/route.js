import { NextResponse } from "next/server";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

/*
|--------------------------------------------------------------------------
| GET SINGLE OUTSIDE PLAYER
|--------------------------------------------------------------------------
*/

export async function GET(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

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
            WHERE outside_player.id = ?
            AND outside_player.is_deleted = 0
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

        const player = rows[0];

        // Tenant authorization check
        if (!authUser.isSuperAdmin) {
            if (authUser.academy_id && Number(player.academy_id) !== Number(authUser.academy_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Forbidden: You cannot access outside players from another academy."
                    },
                    { status: 403 }
                );
            }

            if (authUser.isBranchAdmin && authUser.branch_id && player.branch_id && Number(player.branch_id) !== Number(authUser.branch_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Forbidden: You cannot access outside players from another branch."
                    },
                    { status: 403 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: "Outside player fetched successfully",
            data: player
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
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden: Players cannot update outside players." },
            { status: 403 }
        );
    }

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

        // Tenant authorization check
        if (!authUser.isSuperAdmin) {
            if (authUser.academy_id && Number(existingPlayer.academy_id) !== Number(authUser.academy_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Forbidden: You cannot modify outside players from another academy."
                    },
                    { status: 403 }
                );
            }

            if (authUser.isBranchAdmin && authUser.branch_id && existingPlayer.branch_id && Number(existingPlayer.branch_id) !== Number(authUser.branch_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Forbidden: You cannot modify outside players from another branch."
                    },
                    { status: 403 }
                );
            }
        }

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

        // Resolve updated academy_id and branch_id
        let targetAcademyId = existingPlayer.academy_id || 1;
        let targetBranchId = existingPlayer.branch_id || null;

        if (authUser.isSuperAdmin) {
            if (formAcademyId) targetAcademyId = Number(formAcademyId);
            if (formBranchId !== null && formBranchId !== undefined) {
                targetBranchId = formBranchId ? Number(formBranchId) : null;
            }
        } else if (authUser.isAcademyAdmin) {
            targetAcademyId = Number(authUser.academy_id);
            if (formBranchId !== null && formBranchId !== undefined) {
                targetBranchId = formBranchId ? Number(formBranchId) : null;
            }
        } else {
            // Branch Admin / Staff: keep assigned
            targetAcademyId = Number(authUser.academy_id);
            if (authUser.branch_id) targetBranchId = Number(authUser.branch_id);
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

        // CHECK PHONE DUPLICATE WITHIN ACADEMY
        if (phone && phone.toString().trim()) {
            const [existingPhone] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE phone = ?
                AND academy_id = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    phone.toString().trim(),
                    targetAcademyId,
                    playerId
                ]
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

        // CHECK EMAIL DUPLICATE WITHIN ACADEMY
        if (email && email.toString().trim()) {
            const [existingEmail] = await connection.query(
                `
                SELECT id
                FROM cst_outside_players
                WHERE email = ?
                AND academy_id = ?
                AND id != ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [
                    email.toString().trim(),
                    targetAcademyId,
                    playerId
                ]
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

        let profileImagePath = existingPlayer.profile_image;

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

            if (!fsSync.existsSync(uploadDir)) {
                fsSync.mkdirSync(uploadDir, {
                    recursive: true
                });
            }

            const extension = path.extname(profileImage.name);
            const fileName = `${Date.now()}-${Math.floor(
                Math.random() * 1000000
            )}${extension}`;

            const filePath = path.join(uploadDir, fileName);
            const bytes = await profileImage.arrayBuffer();

            await fs.writeFile(filePath, Buffer.from(bytes));

            profileImagePath = `/images/uploads/outside-players/${fileName}`;

            // DELETE OLD IMAGE
            if (existingPlayer.profile_image) {
                const oldImagePath = path.join(
                    process.cwd(),
                    "public",
                    existingPlayer.profile_image.replace(/^\/+/, "")
                );

                if (fsSync.existsSync(oldImagePath) && fsSync.statSync(oldImagePath).isFile()) {
                    try {
                        await fs.unlink(oldImagePath);
                    } catch (deleteError) {
                        console.error("OLD IMAGE DELETE ERROR:", deleteError);
                    }
                }
            }
        }

        // UPDATE
        await connection.query(
            `
            UPDATE cst_outside_players
            SET
                academy_id = ?,
                branch_id = ?,
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
                    : existingPlayer.status,
                playerId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Outside player updated successfully",
            data: {
                id: playerId,
                academy_id: targetAcademyId,
                branch_id: targetBranchId,
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
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden: Players cannot delete outside players." },
            { status: 403 }
        );
    }

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
            SELECT id, academy_id, branch_id
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

        // Authorization check
        if (!authUser.isSuperAdmin) {
            if (authUser.academy_id && Number(existingPlayer.academy_id) !== Number(authUser.academy_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Forbidden: You cannot delete outside players from another academy."
                    },
                    { status: 403 }
                );
            }

            if (authUser.isBranchAdmin && authUser.branch_id && existingPlayer.branch_id && Number(existingPlayer.branch_id) !== Number(authUser.branch_id)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Forbidden: You cannot delete outside players from another branch."
                    },
                    { status: 403 }
                );
            }
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
