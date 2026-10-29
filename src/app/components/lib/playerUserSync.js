import bcrypt from "bcryptjs";

/**
 * Ensures a player in cst_admission_players is linked to a user in cst_users and a role in cst_user_roles.
 * If user does not exist, creates them with default credentials (password = phone || admissionNo || 123456).
 * If user exists, updates their details and role.
 * Returns { userId, roleName, roleId, academyId }
 */
export async function syncPlayerUserAndRole({
    connection,
    admissionPlayerId = null,
    admissionNo = null,
    userId = null,
    firstName,
    lastName = null,
    email = null,
    phone = null,
    branchId,
    roleId,
    status = 1,
}) {
    // 1. Get branch academy_id
    let academyId = 1;
    if (branchId) {
        const [bRows] = await connection.query(
            "SELECT id, academy_id FROM cst_branch WHERE id = ? LIMIT 1",
            [branchId]
        );
        if (bRows.length > 0 && bRows[0].academy_id) {
            academyId = bRows[0].academy_id;
        }
    }

    // 2. Get role name
    let roleName = "Player";
    if (roleId) {
        const [rRows] = await connection.query(
            "SELECT id, role_name FROM cst_roles WHERE id = ? LIMIT 1",
            [roleId]
        );
        if (rRows.length > 0 && rRows[0].role_name) {
            roleName = rRows[0].role_name;
        }
    }

    // 3. Resolve user_id if not provided
    let finalUserId = userId ? Number(userId) : null;

    if (!finalUserId && admissionPlayerId) {
        const [pRows] = await connection.query(
            "SELECT user_id, admission_no, email, phone FROM cst_admission_players WHERE id = ? LIMIT 1",
            [admissionPlayerId]
        );
        if (pRows.length > 0) {
            if (pRows[0].user_id) finalUserId = Number(pRows[0].user_id);
            if (!admissionNo) admissionNo = pRows[0].admission_no;
            if (!email) email = pRows[0].email;
            if (!phone) phone = pRows[0].phone;
        }
    }

    if (!finalUserId && admissionNo) {
        const [uByAppt] = await connection.query(
            "SELECT id FROM cst_users WHERE appointment_no = ? LIMIT 1",
            [admissionNo]
        );
        if (uByAppt.length > 0) {
            finalUserId = uByAppt[0].id;
        }
    }

    if (!finalUserId && email) {
        const [uByEmail] = await connection.query(
            "SELECT id FROM cst_users WHERE email = ? LIMIT 1",
            [email]
        );
        if (uByEmail.length > 0) {
            finalUserId = uByEmail[0].id;
        }
    }

    if (!finalUserId && phone) {
        const [uByPhone] = await connection.query(
            "SELECT id FROM cst_users WHERE phone = ? LIMIT 1",
            [phone]
        );
        if (uByPhone.length > 0) {
            finalUserId = uByPhone[0].id;
        }
    }

    // 4. Create or Update user in cst_users
    const cleanFirstName = String(firstName || "").trim() || "Player";
    const cleanLastName = lastName ? String(lastName).trim() : null;
    const cleanEmail = email ? String(email).trim() : null;
    const cleanPhone = phone ? String(phone).trim() : null;
    const userStatus = status !== undefined && status !== null ? Number(status) : 1;

    if (!finalUserId) {
        // Create new user in cst_users (default password is standard 123456)
        const defaultPassword = "123456";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const [insertRes] = await connection.query(
            `INSERT INTO cst_users (
                appointment_no, academy_id, branch_id, first_name, last_name,
                email, phone, password, user_type, status, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                admissionNo,
                academyId,
                branchId || null,
                cleanFirstName,
                cleanLastName,
                cleanEmail,
                cleanPhone,
                hashedPassword,
                roleName,
                userStatus,
            ]
        );

        finalUserId = insertRes.insertId;
    } else {
        // Update existing user
        await connection.query(
            `UPDATE cst_users
             SET first_name = ?,
                 last_name = ?,
                 email = COALESCE(?, email),
                 phone = COALESCE(?, phone),
                 branch_id = COALESCE(?, branch_id),
                 academy_id = COALESCE(?, academy_id),
                 user_type = ?,
                 status = ?
             WHERE id = ?`,
            [
                cleanFirstName,
                cleanLastName,
                cleanEmail,
                cleanPhone,
                branchId || null,
                academyId || null,
                roleName,
                userStatus,
                finalUserId,
            ]
        );
    }

    // 5. Ensure user role is mapped in cst_user_roles
    if (finalUserId && roleId) {
        const [existingRole] = await connection.query(
            "SELECT id FROM cst_user_roles WHERE user_id = ? AND role_id = ? LIMIT 1",
            [finalUserId, roleId]
        );

        if (existingRole.length === 0) {
            const [anyRole] = await connection.query(
                "SELECT id FROM cst_user_roles WHERE user_id = ? LIMIT 1",
                [finalUserId]
            );

            if (anyRole.length > 0) {
                await connection.query(
                    "UPDATE cst_user_roles SET role_id = ? WHERE id = ?",
                    [roleId, anyRole[0].id]
                );
            } else {
                await connection.query(
                    "INSERT INTO cst_user_roles (user_id, role_id) VALUES (?, ?)",
                    [finalUserId, roleId]
                );
            }
        }
    }

    return {
        userId: finalUserId,
        roleName,
        roleId,
        academyId,
    };
}
