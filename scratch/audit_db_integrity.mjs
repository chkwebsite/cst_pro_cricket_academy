import mysql from 'mysql2/promise';

async function auditDatabase() {
    console.log('====================================================');
    console.log('   FULL DATABASE INTEGRITY & ORPHAN AUDIT           ');
    console.log('====================================================');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'mysql-9490c4b-chandankeshri100-fdcb.b.aivencloud.com',
        user: process.env.DB_USER || 'avnadmin',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'defaultdb',
        port: Number(process.env.DB_PORT) || 22222,
        ssl: { rejectUnauthorized: false }
    });

    const conn = await pool.getConnection();

    try {
        const issues = [];

        // Helper to check orphans
        async function checkOrphans(childTable, childCol, parentTable, parentCol, label) {
            try {
                const [rows] = await conn.query(`
                    SELECT c.id, c.${childCol}
                    FROM ${childTable} c
                    LEFT JOIN ${parentTable} p ON c.${childCol} = p.${parentCol}
                    WHERE c.${childCol} IS NOT NULL AND c.${childCol} != 0 AND p.${parentCol} IS NULL
                    LIMIT 10
                `);
                if (rows.length > 0) {
                    console.log(`[ORPHAN FOUND] ${label}: ${rows.length} records in ${childTable} have invalid ${childCol} referencing missing ${parentTable}.${parentCol}`);
                    issues.push({ type: 'ORPHAN', childTable, childCol, parentTable, parentCol, count: rows.length, sample: rows });
                } else {
                    console.log(`[PASS] ${label}: 0 orphans`);
                }
            } catch (err) {
                console.error(`[ERROR] Checking ${label}:`, err.message);
            }
        }

        console.log('\n--- 1. ORGANIZATIONAL & USER INTEGRITY ---');
        await checkOrphans('cst_branch', 'academy_id', 'cst_academy', 'id', 'Branch -> Academy');
        await checkOrphans('cst_users', 'academy_id', 'cst_academy', 'id', 'Users -> Academy');
        await checkOrphans('cst_users', 'branch_id', 'cst_branch', 'id', 'Users -> Branch');
        await checkOrphans('cst_staff', 'user_id', 'cst_users', 'id', 'Staff -> Users');
        await checkOrphans('cst_user_roles', 'user_id', 'cst_users', 'id', 'User Roles -> Users');
        await checkOrphans('cst_user_roles', 'role_id', 'cst_roles', 'id', 'User Roles -> Roles');
        await checkOrphans('cst_user_branches', 'user_id', 'cst_users', 'id', 'User Branches -> Users');
        await checkOrphans('cst_user_branches', 'branch_id', 'cst_branch', 'id', 'User Branches -> Branch');

        console.log('\n--- 2. PROGRAMS, BATCHES & ADMISSIONS INTEGRITY ---');
        await checkOrphans('cst_user_programs', 'user_id', 'cst_users', 'id', 'User Programs -> Users');
        await checkOrphans('cst_user_programs', 'program_id', 'cst_programs', 'id', 'User Programs -> Programs');
        await checkOrphans('cst_admission_players', 'user_id', 'cst_users', 'id', 'Admission Players -> Users');
        await checkOrphans('cst_admission_players', 'program_id', 'cst_programs', 'id', 'Admission Players -> Programs');
        await checkOrphans('cst_batches', 'program_id', 'cst_programs', 'id', 'Batches -> Programs');
        await checkOrphans('cst_batches', 'branch_id', 'cst_branch', 'id', 'Batches -> Branch');
        await checkOrphans('cst_batch_players', 'batch_id', 'cst_batches', 'id', 'Batch Players -> Batches');
        await checkOrphans('cst_batch_players', 'user_id', 'cst_users', 'id', 'Batch Players -> Users');
        await checkOrphans('cst_batch_coaches', 'batch_id', 'cst_batches', 'id', 'Batch Coaches -> Batches');
        await checkOrphans('cst_batch_coaches', 'coach_user_id', 'cst_users', 'id', 'Batch Coaches -> Users');

        console.log('\n--- 3. GROUNDS & BOOKINGS INTEGRITY ---');
        await checkOrphans('cst_ground', 'academy_id', 'cst_academy', 'id', 'Ground -> Academy');
        await checkOrphans('cst_ground', 'branch_id', 'cst_branch', 'id', 'Ground -> Branch');
        await checkOrphans('cst_ground_slots', 'ground_id', 'cst_ground', 'id', 'Ground Slots -> Ground');
        await checkOrphans('cst_ground_bookings', 'ground_id', 'cst_ground', 'id', 'Ground Bookings -> Ground');
        await checkOrphans('cst_ground_bookings', 'slot_id', 'cst_ground_slots', 'id', 'Ground Bookings -> Slots');

        console.log('\n--- 4. TEAMS, MATCHES & SCORECARDS INTEGRITY ---');
        await checkOrphans('cst_teams', 'academy_id', 'cst_academy', 'id', 'Teams -> Academy');
        await checkOrphans('cst_teams', 'branch_id', 'cst_branch', 'id', 'Teams -> Branch');
        await checkOrphans('cst_team_players', 'team_id', 'cst_teams', 'id', 'Team Players -> Teams');
        await checkOrphans('cst_team_players', 'user_id', 'cst_users', 'id', 'Team Players -> Users');
        await checkOrphans('cst_matches', 'team_a_id', 'cst_teams', 'id', 'Matches -> Team A');
        await checkOrphans('cst_matches', 'team_b_id', 'cst_teams', 'id', 'Matches -> Team B');
        await checkOrphans('cst_matches', 'ground_id', 'cst_ground', 'id', 'Matches -> Ground');
        await checkOrphans('cst_match_players', 'match_id', 'cst_matches', 'id', 'Match Players -> Matches');
        await checkOrphans('cst_match_players', 'team_id', 'cst_teams', 'id', 'Match Players -> Teams');
        await checkOrphans('cst_match_innings', 'match_id', 'cst_matches', 'id', 'Match Innings -> Matches');
        await checkOrphans('cst_match_scorecard', 'match_id', 'cst_matches', 'id', 'Match Scorecard -> Matches');
        await checkOrphans('cst_match_bowling_scorecard', 'match_id', 'cst_matches', 'id', 'Bowling Scorecard -> Matches');

        console.log('\n--- 5. TOURNAMENTS INTEGRITY ---');
        await checkOrphans('cst_tournaments', 'academy_id', 'cst_academy', 'id', 'Tournaments -> Academy');
        await checkOrphans('cst_tournament_teams', 'tournament_id', 'cst_tournaments', 'id', 'Tournament Teams -> Tournaments');
        await checkOrphans('cst_tournament_teams', 'team_id', 'cst_teams', 'id', 'Tournament Teams -> Teams');
        await checkOrphans('cst_tournament_matches', 'tournament_id', 'cst_tournaments', 'id', 'Tournament Matches -> Tournaments');

        console.log('\n--- 6. FINANCE & SALARY INTEGRITY ---');
        await checkOrphans('cst_fee_payments', 'user_id', 'cst_users', 'id', 'Fee Payments -> Users');
        await checkOrphans('cst_fee_status', 'user_id', 'cst_users', 'id', 'Fee Status -> Users');
        await checkOrphans('cst_staff_salary', 'staff_id', 'cst_staff', 'id', 'Staff Salary -> Staff');
        await checkOrphans('cst_staff_salary_payments', 'staff_id', 'cst_staff', 'id', 'Salary Payments -> Staff');

        console.log('\n--- 7. OUTSIDE PLAYERS INTEGRITY ---');
        await checkOrphans('cst_outside_players', 'academy_id', 'cst_academy', 'id', 'Outside Players -> Academy');
        await checkOrphans('cst_outside_players', 'branch_id', 'cst_branch', 'id', 'Outside Players -> Branch');
        await checkOrphans('cst_outside_players', 'age_group_id', 'cst_age_groups', 'id', 'Outside Players -> Age Groups');

        console.log('\n--- 8. PERMISSIONS & MENUS INTEGRITY ---');
        await checkOrphans('cst_role_permissions', 'role_id', 'cst_roles', 'id', 'Role Permissions -> Roles');
        await checkOrphans('cst_role_permissions', 'permission_id', 'cst_permissions', 'id', 'Role Permissions -> Permissions');
        await checkOrphans('cst_menu_permissions', 'role_id', 'cst_roles', 'id', 'Menu Permissions -> Roles');
        await checkOrphans('cst_menu_permissions', 'menu_id', 'cst_menu', 'id', 'Menu Permissions -> Menu');

        console.log('\n--- 9. E-COMMERCE / PRODUCTS INTEGRITY ---');
        await checkOrphans('cst_products', 'category_id', 'cst_product_categories', 'id', 'Products -> Categories');
        await checkOrphans('cst_order_items', 'order_id', 'cst_orders', 'id', 'Order Items -> Orders');
        await checkOrphans('cst_order_items', 'product_id', 'cst_products', 'id', 'Order Items -> Products');

        console.log('\n--- 10. GALLERY INTEGRITY ---');
        await checkOrphans('cst_gallery_albums', 'category_id', 'cst_gallery_categories', 'id', 'Gallery Albums -> Categories');
        await checkOrphans('cst_gallery_images', 'album_id', 'cst_gallery_albums', 'id', 'Gallery Images -> Albums');
        await checkOrphans('cst_gallery_videos', 'album_id', 'cst_gallery_albums', 'id', 'Gallery Videos -> Albums');

        console.log('\n====================================================');
        console.log(`TOTAL RELATIONSHIPS AUDITED: 38`);
        console.log(`TOTAL INTEGRITY ISSUES FOUND: ${issues.length}`);
        console.log('====================================================');

    } finally {
        conn.release();
        await pool.end();
    }
}

auditDatabase().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
});
