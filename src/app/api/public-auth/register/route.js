import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "@/app/components/lib/db";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";

async function ensurePublicUsersTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS cst_public_users (
                id INT NOT NULL AUTO_INCREMENT,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                profile_image VARCHAR(255) DEFAULT NULL,
                user_type VARCHAR(50) NOT NULL DEFAULT 'Public User',
                status TINYINT NOT NULL DEFAULT 1,
                is_deleted TINYINT NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uniq_email (email),
                UNIQUE KEY uniq_phone (phone)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        try {
            const [cols] = await db.query(`SHOW COLUMNS FROM cst_public_users LIKE 'user_type'`);
            if (cols.length === 0) {
                await db.query(`ALTER TABLE cst_public_users ADD COLUMN user_type VARCHAR(50) NOT NULL DEFAULT 'Public User' AFTER profile_image`);
            }
        } catch (_) {}
    } catch (e) {
        console.error("ensurePublicUsersTable warning:", e.message);
    }
}

async function handlePublicLogin(body) {
    const login = String(body.login || body.email || body.phone || "").trim();
    const password = String(body.password || "");

    if (!login) {
        return NextResponse.json(
            { success: false, message: "Email or mobile number is required." },
            { status: 400 }
        );
    }
    if (!password) {
        return NextResponse.json(
            { success: false, message: "Password is required." },
            { status: 400 }
        );
    }

    const cleanLogin = login.replace(/[^0-9]/g, "");

    const [users] = await db.query(
        `SELECT id, name, email, phone, password, profile_image, user_type, status, is_deleted
         FROM cst_public_users
         WHERE (LOWER(email) = LOWER(?) OR phone = ? OR (length(?) >= 10 AND phone = ?))
         LIMIT 1`,
        [login, login, cleanLogin, cleanLogin]
    );

    if (users.length === 0) {
        return NextResponse.json(
            { success: false, message: "Invalid email/mobile number or password." },
            { status: 401 }
        );
    }

    const user = users[0];

    if (Number(user.is_deleted) === 1) {
        return NextResponse.json(
            { success: false, message: "This account has been deactivated." },
            { status: 403 }
        );
    }
    if (Number(user.status) !== 1) {
        return NextResponse.json(
            { success: false, message: "Your account is inactive. Please contact support." },
            { status: 403 }
        );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return NextResponse.json(
            { success: false, message: "Invalid email/mobile number or password." },
            { status: 401 }
        );
    }

    const userPayload = {
        id: user.id,
        name: user.name,
        first_name: user.name.split(" ")[0] || user.name,
        last_name: user.name.split(" ").slice(1).join(" ") || "",
        email: user.email,
        phone: user.phone,
        user_type: user.user_type || "Public User",
        profile_image: user.profile_image || null,
        is_public: true,
    };

    const session = {
        user: userPayload,
        permissions: ["public_user", "ground_booking"],
    };

    const jwtSecret = process.env.JWT_SECRET || "cst_public_auth_secret_token_2026";
    const token = jwt.sign(
        { public_user_id: user.id, email: user.email, name: user.name, user_type: "public" },
        jwtSecret,
        { expiresIn: "30d" }
    );

    const response = NextResponse.json({
        success: true,
        message: "Login successful!",
        user: userPayload,
        session,
        token,
    });

    response.cookies.set("public_auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
    });

    return response;
}

// POST: Public User Registration & Login Fallback
export async function POST(request) {
    try {
        await ensurePublicUsersTable();

        const contentType = request.headers.get("content-type") || "";
        let body = {};
        let profileImage = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            for (const [key, value] of formData.entries()) {
                if (key === "profile_image" && value && typeof value === "object" && "arrayBuffer" in value && value.size > 0) {
                    const ext = value.type === "image/png" ? "png" : value.type === "image/webp" ? "webp" : "jpg";
                    const bytes = Buffer.from(await value.arrayBuffer());
                    const uploadDir = path.join(process.cwd(), "public", "images", "uploads", "public-users");
                    await fs.mkdir(uploadDir, { recursive: true });
                    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
                    await fs.writeFile(path.join(uploadDir, fileName), bytes);
                    profileImage = `/images/uploads/public-users/${fileName}`;
                } else {
                    body[key] = value;
                }
            }
        } else {
            body = await request.json().catch(() => ({}));
        }

        const action = String(body.action || "").toLowerCase().trim();

        // If action is login or login credentials given without name
        if (action === "login" || (body.login && body.password && !body.name)) {
            return await handlePublicLogin(body);
        }

        // REGISTRATION
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const phone = String(body.phone || "").trim();
        const password = String(body.password || "");

        if (!name) {
            return NextResponse.json({ success: false, message: "Full Name is required." }, { status: 400 });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ success: false, message: "A valid email address is required." }, { status: 400 });
        }
        if (!phone || phone.replace(/[^0-9]/g, "").length < 10) {
            return NextResponse.json({ success: false, message: "A valid 10-digit mobile number is required." }, { status: 400 });
        }
        if (!password || password.length < 6) {
            return NextResponse.json({ success: false, message: "Password must be at least 6 characters long." }, { status: 400 });
        }

        const cleanPhone = phone.replace(/[^0-9]/g, "");

        // Check duplicate email or phone
        const [existing] = await db.query(
            "SELECT id, email, phone FROM cst_public_users WHERE email = ? OR phone = ? LIMIT 1",
            [email, cleanPhone]
        );

        if (existing.length > 0) {
            if (existing[0].email.toLowerCase() === email.toLowerCase()) {
                return NextResponse.json({ success: false, message: "This email address is already registered." }, { status: 409 });
            }
            return NextResponse.json({ success: false, message: "This mobile number is already registered." }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [insertRes] = await db.query(
            `INSERT INTO cst_public_users (name, email, phone, password, profile_image, user_type, status, is_deleted)
             VALUES (?, ?, ?, ?, ?, 'Public User', 1, 0)`,
            [name, email, cleanPhone, hashedPassword, profileImage]
        );

        const newUserId = insertRes.insertId;

        const userPayload = {
            id: newUserId,
            name,
            first_name: name.split(" ")[0] || name,
            last_name: name.split(" ").slice(1).join(" ") || "",
            email,
            phone: cleanPhone,
            user_type: "Public User",
            profile_image: profileImage,
            is_public: true,
        };

        const session = {
            user: userPayload,
            permissions: ["public_user", "ground_booking"],
        };

        const jwtSecret = process.env.JWT_SECRET || "cst_public_auth_secret_token_2026";
        const token = jwt.sign(
            { public_user_id: newUserId, email, name, user_type: "public" },
            jwtSecret,
            { expiresIn: "30d" }
        );

        const response = NextResponse.json({
            success: true,
            message: "Public account registered successfully!",
            user: userPayload,
            session,
            token,
        }, { status: 201 });

        response.cookies.set("public_auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
        });

        return response;
    } catch (error) {
        console.error("Public Register POST error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to register account." },
            { status: 500 }
        );
    }
}

// GET: Current Public User Profile
export async function GET(request) {
    try {
        await ensurePublicUsersTable();

        const token = request.cookies.get("public_auth_token")?.value;
        const authHeader = request.headers.get("authorization");
        const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const effectiveToken = token || bearerToken;

        if (!effectiveToken) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        const jwtSecret = process.env.JWT_SECRET || "cst_public_auth_secret_token_2026";
        const decoded = jwt.verify(effectiveToken, jwtSecret);

        const [users] = await db.query(
            `SELECT id, name, email, phone, profile_image, user_type, status, created_at
             FROM cst_public_users
             WHERE id = ? AND status = 1 AND is_deleted = 0
             LIMIT 1`,
            [decoded.public_user_id]
        );

        if (users.length === 0) {
            return NextResponse.json(
                { success: false, message: "User not found" },
                { status: 404 }
            );
        }

        const u = users[0];
        return NextResponse.json({
            success: true,
            user: {
                id: u.id,
                name: u.name,
                first_name: u.name.split(" ")[0],
                last_name: u.name.split(" ").slice(1).join(" "),
                email: u.email,
                phone: u.phone,
                user_type: u.user_type || "Public User",
                profile_image: u.profile_image,
                is_public: true,
                created_at: u.created_at,
            },
        });
    } catch (err) {
        return NextResponse.json(
            { success: false, message: "Invalid or expired session" },
            { status: 401 }
        );
    }
}

// PUT: Update Public User Profile
export async function PUT(request) {
    let uploadedFilePath = null;

    try {
        await ensurePublicUsersTable();

        const token = request.cookies.get("public_auth_token")?.value;
        const authHeader = request.headers.get("authorization");
        const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const effectiveToken = token || bearerToken;

        let userId = null;
        const jwtSecret = process.env.JWT_SECRET || "cst_public_auth_secret_token_2026";

        if (effectiveToken) {
            try {
                const decoded = jwt.verify(effectiveToken, jwtSecret);
                userId = decoded.public_user_id;
            } catch (_) {}
        }

        const contentType = request.headers.get("content-type") || "";
        let name = "";
        let email = "";
        let phone = "";
        let profileImage = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            name = String(formData.get("name") || "").trim();
            email = String(formData.get("email") || "").trim().toLowerCase();
            phone = String(formData.get("phone") || "").trim();
            if (!userId) userId = formData.get("id");

            const image = formData.get("profile_image");
            if (image && typeof image === "object" && "arrayBuffer" in image && image.size > 0) {
                const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
                const bytes = Buffer.from(await image.arrayBuffer());
                const uploadDir = path.join(process.cwd(), "public", "images", "uploads", "public-users");
                await fs.mkdir(uploadDir, { recursive: true });
                const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
                const absolutePath = path.join(uploadDir, fileName);
                await fs.writeFile(absolutePath, bytes);
                uploadedFilePath = absolutePath;
                profileImage = `/images/uploads/public-users/${fileName}`;
            }
        } else {
            const jsonBody = await request.json().catch(() => ({}));
            name = String(jsonBody.name || "").trim();
            email = String(jsonBody.email || "").trim().toLowerCase();
            phone = String(jsonBody.phone || "").trim();
            if (!userId) userId = jsonBody.id;
        }

        if (!userId) {
            return NextResponse.json(
                { success: false, message: "User identification required. Please login." },
                { status: 401 }
            );
        }

        if (!name || !email || !phone) {
            return NextResponse.json(
                { success: false, message: "Name, email and phone are required." },
                { status: 400 }
            );
        }

        const cleanPhone = phone.replace(/[^0-9]/g, "");

        // Check duplicate email or phone for other user
        const [existing] = await db.query(
            "SELECT id FROM cst_public_users WHERE (email = ? OR phone = ?) AND id <> ? LIMIT 1",
            [email, cleanPhone, userId]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, message: "Email or phone number is already in use by another account." },
                { status: 409 }
            );
        }

        // Fetch old image if not uploading new one
        if (!profileImage) {
            const [cur] = await db.query(
                "SELECT profile_image FROM cst_public_users WHERE id = ? LIMIT 1",
                [userId]
            );
            if (cur.length > 0) {
                profileImage = cur[0].profile_image;
            }
        }

        await db.query(
            `UPDATE cst_public_users
             SET name = ?, email = ?, phone = ?, profile_image = ?
             WHERE id = ? AND status = 1 AND is_deleted = 0`,
            [name, email, cleanPhone, profileImage, userId]
        );

        const updatedUser = {
            id: Number(userId),
            name,
            first_name: name.split(" ")[0] || name,
            last_name: name.split(" ").slice(1).join(" ") || "",
            email,
            phone: cleanPhone,
            user_type: "Public User",
            profile_image: profileImage,
            is_public: true,
        };

        return NextResponse.json({
            success: true,
            message: "Profile updated successfully.",
            data: updatedUser,
            user: updatedUser,
        });
    } catch (error) {
        if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath).catch(() => {});
        }
        console.error("Public profile update error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to update profile." },
            { status: 500 }
        );
    }
}
