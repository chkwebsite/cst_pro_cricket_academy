import bcrypt from "bcryptjs";

let hasInitialized = false;

/**
 * Ensures Player role, Player Dashboard menu, and permissions are properly configured.
 * Also automatically links any existing unlinked admission players to cst_users and cst_user_roles.
 */
export async function ensurePlayerAccess(connection) {
    if (hasInitialized) {
        return;
    }

    try {
        // 1. Ensure Player Role exists in cst_roles
        const [playerRoles] = await connection.query(
            "SELECT id, role_name FROM cst_roles WHERE LOWER(role_name) = 'player' LIMIT 1"
        );

        let playerRoleId = playerRoles.length > 0 ? playerRoles[0].id : null;

        if (!playerRoleId) {
            const [insertRole] = await connection.query(
                "INSERT INTO cst_roles (role_name, status) VALUES ('Player', 1)"
            );
            playerRoleId = insertRole.insertId;
        }

        // 2. Ensure Player Dashboard menu exists in cst_menu
        const [existingMenu] = await connection.query(
            "SELECT id FROM cst_menu WHERE menu_url = '/next_panel/player-dashboard' OR menu_key = 'player-dashboard' LIMIT 1"
        );

        let menuId = existingMenu.length > 0 ? existingMenu[0].id : null;

        if (!menuId) {
            const [insertMenu] = await connection.query(
                `INSERT INTO cst_menu (
                    parent_id, menu_key, menu_name, menu_title, menu_icon, menu_url,
                    menu_type, menu_order, is_sidebar, is_active, status, is_deleted
                ) VALUES (
                    NULL, 'player-dashboard', 'Player Dashboard', 'Player Dashboard', 'player-dashboard', '/next_panel/player-dashboard',
                    'link', 1, 1, 1, 1, 0
                )`
            );
            menuId = insertMenu.insertId;
        }

        // 3. Ensure Player Dashboard Permission exists in cst_permissions
        const [existingPerm] = await connection.query(
            "SELECT id FROM cst_permissions WHERE permission_name = 'view_player_dashboard' LIMIT 1"
        );

        let permId = existingPerm.length > 0 ? existingPerm[0].id : null;

        if (!permId) {
            const [insertPerm] = await connection.query(
                `INSERT INTO cst_permissions (module_name, permission_name, status)
                 VALUES ('Player Dashboard', 'view_player_dashboard', 1)`
            );
            permId = insertPerm.insertId;
        }

        // 4. Ensure menu_permission mapping exists
        if (menuId && permId) {
            const [existingMenuPerm] = await connection.query(
                "SELECT id FROM cst_menu_permissions WHERE menu_id = ? AND permission_id = ? LIMIT 1",
                [menuId, permId]
            );

            if (existingMenuPerm.length === 0) {
                await connection.query(
                    "INSERT INTO cst_menu_permissions (menu_id, permission_id) VALUES (?, ?)",
                    [menuId, permId]
                );
            }
        }

        // 5. Ensure role_permission mapping exists for Player Role
        if (playerRoleId && permId) {
            const [existingRolePerm] = await connection.query(
                "SELECT id FROM cst_role_permissions WHERE role_id = ? AND permission_id = ? LIMIT 1",
                [playerRoleId, permId]
            );

            if (existingRolePerm.length === 0) {
                await connection.query(
                    "INSERT INTO cst_role_permissions (role_id, permission_id) VALUES (?, ?)",
                    [playerRoleId, permId]
                );
            }
        }

        // 6. Migrate/link any orphan admission players that have user_id IS NULL
        const [orphanPlayers] = await connection.query(
            `SELECT 
                p.id,
                p.admission_no,
                p.first_name,
                p.last_name,
                p.email,
                p.phone,
                p.branch_id,
                p.role_id,
                p.status,
                b.academy_id,
                r.role_name
             FROM cst_admission_players p
             LEFT JOIN cst_branch b ON b.id = p.branch_id
             LEFT JOIN cst_roles r ON r.id = p.role_id
             WHERE p.user_id IS NULL AND p.is_deleted = 0
             LIMIT 100`
        );

        for (const player of orphanPlayers) {
            try {
                // Check if user already exists with appointment_no = admission_no or email or phone
                let foundUserId = null;

                const [existingByAppt] = await connection.query(
                    "SELECT id FROM cst_users WHERE appointment_no = ? LIMIT 1",
                    [player.admission_no]
                );

                if (existingByAppt.length > 0) {
                    foundUserId = existingByAppt[0].id;
                } else if (player.email) {
                    const [existingByEmail] = await connection.query(
                        "SELECT id FROM cst_users WHERE email = ? LIMIT 1",
                        [player.email]
                    );
                    if (existingByEmail.length > 0) {
                        foundUserId = existingByEmail[0].id;
                    }
                } else if (player.phone) {
                    const [existingByPhone] = await connection.query(
                        "SELECT id FROM cst_users WHERE phone = ? LIMIT 1",
                        [player.phone]
                    );
                    if (existingByPhone.length > 0) {
                        foundUserId = existingByPhone[0].id;
                    }
                }

                if (!foundUserId) {
                    const defaultPassword = "123456";
                    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
                    const userType = player.role_name || "Player";

                    const [userRes] = await connection.query(
                        `INSERT INTO cst_users (
                            appointment_no, academy_id, branch_id, first_name, last_name,
                            email, phone, password, user_type, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            player.admission_no,
                            player.academy_id || 1,
                            player.branch_id,
                            player.first_name,
                            player.last_name || null,
                            player.email || null,
                            player.phone || null,
                            hashedPassword,
                            userType,
                            player.status ?? 1,
                        ]
                    );

                    foundUserId = userRes.insertId;
                }

                if (foundUserId) {
                    // Update cst_admission_players
                    await connection.query(
                        "UPDATE cst_admission_players SET user_id = ? WHERE id = ?",
                        [foundUserId, player.id]
                    );

                    // Update cst_user_programs
                    await connection.query(
                        "UPDATE cst_user_programs SET user_id = ? WHERE admission_players_id = ? OR appointment_no = ?",
                        [foundUserId, player.id, player.admission_no]
                    );

                    // Update cst_user_branches
                    await connection.query(
                        "UPDATE cst_user_branches SET user_id = ? WHERE appointment_no = ?",
                        [foundUserId, player.admission_no]
                    );

                    // Ensure user_roles
                    const targetRoleId = player.role_id || playerRoleId;
                    if (targetRoleId) {
                        const [hasRole] = await connection.query(
                            "SELECT id FROM cst_user_roles WHERE user_id = ? AND role_id = ? LIMIT 1",
                            [foundUserId, targetRoleId]
                        );

                        if (hasRole.length === 0) {
                            await connection.query(
                                "INSERT INTO cst_user_roles (user_id, role_id) VALUES (?, ?)",
                                [foundUserId, targetRoleId]
                            );
                        }
                    }
                }
            } catch (orphanErr) {
                console.warn("ensurePlayerAccess: failed to sync orphan player:", player.id, orphanErr?.message);
            }
        }

        hasInitialized = true;
    } catch (err) {
        console.error("ensurePlayerAccess error:", err);
    }
}
