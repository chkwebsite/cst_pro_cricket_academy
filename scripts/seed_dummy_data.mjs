import pool from "../src/app/components/lib/db.js";
import bcrypt from "bcryptjs";

async function main() {
    console.log("=== STARTING COMPLETE DUMMY DATA SEEDING ===");
    const passwordHash = await bcrypt.hash("Password@123", 10);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. ACADEMIES
        console.log("1. Checking Academies...");
        const [academies] = await connection.query("SELECT id, academy_name FROM cst_academy");
        let acad1Id = 1;
        let acad2Id = 2;
        if (academies.length === 0) {
            const [res1] = await connection.query(
                `INSERT INTO cst_academy (academy_name, academy_code, email, phone, status, is_deleted) 
                 VALUES ('CST Pro Cricket Academy', 'CST-ACAD-01', 'contact@cstcricket.com', '9876543210', 1, 0)`
            );
            acad1Id = res1.insertId;
            const [res2] = await connection.query(
                `INSERT INTO cst_academy (academy_name, academy_code, email, phone, status, is_deleted) 
                 VALUES ('Sports Mantra Cricket Academy', 'SM-ACAD-02', 'info@sportsmantra.com', '9876543211', 1, 0)`
            );
            acad2Id = res2.insertId;
        } else {
            acad1Id = academies[0].id;
            acad2Id = academies[1]?.id || academies[0].id;
        }

        // 2. BRANCHES
        console.log("2. Checking Branches...");
        const [branches] = await connection.query("SELECT id, branch_name, academy_id FROM cst_branch");
        let b1 = branches.find(b => b.academy_id === acad1Id);
        let b2 = branches.find(b => b.academy_id === acad1Id && b.id !== b1?.id);
        let b3 = branches.find(b => b.academy_id === acad2Id);

        if (!b2) {
            const [res] = await connection.query(
                `INSERT INTO cst_branch (academy_id, branch_name, branch_code, email, phone, address, city, state, pin_code, status, is_deleted)
                 VALUES (?, 'CST South City Branch', 'CST-BR-02', 'cstsouth@cstcricket.com', '9876543212', 'Sector 49', 'Gurugram', 'Haryana', '122018', 1, 0)`,
                [acad1Id]
            );
            b2 = { id: res.insertId, academy_id: acad1Id };
        }

        if (!b3) {
            const [res] = await connection.query(
                `INSERT INTO cst_branch (academy_id, branch_name, branch_code, email, phone, address, city, state, pin_code, status, is_deleted)
                 VALUES (?, 'Sports Mantra Kadirpur Branch', 'SM-BR-01', 'smkadirpur@sportsmantra.com', '9876543213', 'Kadirpur', 'Gurugram', 'Haryana', '122002', 1, 0)`,
                [acad2Id]
            );
            b3 = { id: res.insertId, academy_id: acad2Id };
        }

        const b1Id = b1 ? b1.id : 1;
        const b2Id = b2.id;
        const b3Id = b3.id;

        console.log(`Academies: [${acad1Id}, ${acad2Id}], Branches: [B1:${b1Id}, B2:${b2Id}, B3:${b3Id}]`);

        // 3. ROLES & PERMISSIONS
        console.log("3. Ensuring Roles & Permissions...");
        const rolesList = [
            { name: "Super Admin", desc: "Full System Access", acad: null, br: null },
            { name: "Academy Admin(CST)", desc: "Academy 1 Admin", acad: acad1Id, br: b1Id },
            { name: "Academy Admin(SM)", desc: "Academy 2 Admin", acad: acad2Id, br: b3Id },
            { name: "Branch Admin(CST-1)", desc: "Branch 1 Admin", acad: acad1Id, br: b1Id },
            { name: "Branch Admin(CST-2)", desc: "Branch 2 Admin", acad: acad1Id, br: b2Id },
            { name: "Branch Admin(SM-1)", desc: "Branch 3 Admin", acad: acad2Id, br: b3Id },
            { name: "Accountent(CST)", desc: "Finance & Fee Management", acad: acad1Id, br: b1Id },
            { name: "Management(CST)", desc: "Operations & Management", acad: acad1Id, br: b1Id },
            { name: "Coach(CST)", desc: "Cricket Coach", acad: acad1Id, br: b1Id },
            { name: "Staff(CST)", desc: "General Support Staff", acad: acad1Id, br: b1Id },
            { name: "Ground Staff(CST)", desc: "Ground Operations", acad: acad1Id, br: b1Id },
            { name: "Player(CST)", desc: "Player Role", acad: acad1Id, br: b1Id }
        ];

        for (const r of rolesList) {
            const [existing] = await connection.query("SELECT id FROM cst_roles WHERE role_name = ? LIMIT 1", [r.name]);
            if (existing.length === 0) {
                await connection.query(
                    `INSERT INTO cst_roles (role_name, role_desc, academy_id, branch_id, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
                    [r.name, r.desc, r.acad, r.br]
                );
            }
        }

        // Map canonical roles
        const [allRoles] = await connection.query("SELECT id, role_name FROM cst_roles");
        const getRoleId = (prefix) => allRoles.find(r => r.role_name.toLowerCase().includes(prefix.toLowerCase()))?.id;

        // 4. USERS
        console.log("4. Seeding Users for ALL roles...");
        const usersToSeed = [
            {
                email: "superadmin@gmail.com",
                first_name: "Super",
                last_name: "Admin",
                user_type: "Super Admin",
                phone: "9999900001",
                academy_id: null,
                branch_id: null,
                role_name: "Super Admin"
            },
            {
                email: "chandan@gmail.com",
                first_name: "Chandan",
                last_name: "Keshri",
                user_type: "Academy Admin",
                phone: "8285831503",
                academy_id: acad1Id,
                branch_id: b1Id,
                role_name: "Academy Admin(CST)"
            },
            {
                email: "academyadmin2@gmail.com",
                first_name: "Virender",
                last_name: "Sharma",
                user_type: "Academy Admin",
                phone: "9811122233",
                academy_id: acad2Id,
                branch_id: b3Id,
                role_name: "Academy Admin(SM)"
            },
            {
                email: "rajneesh@gmail.com",
                first_name: "Rajneesh",
                last_name: "Kumar",
                user_type: "Branch Admin",
                phone: "7894561230",
                academy_id: acad1Id,
                branch_id: b1Id,
                role_name: "Branch Admin"
            },
            {
                email: "branchadmin2@gmail.com",
                first_name: "Amit",
                last_name: "Verma",
                user_type: "Branch Admin",
                phone: "9822233344",
                academy_id: acad1Id,
                branch_id: b2Id,
                role_name: "Branch Admin"
            },
            {
                email: "branchadmin3@gmail.com",
                first_name: "Ramesh",
                last_name: "Yadav",
                user_type: "Branch Admin",
                phone: "9833344455",
                academy_id: acad2Id,
                branch_id: b3Id,
                role_name: "Branch Admin"
            },
            {
                email: "accountant@gmail.com",
                first_name: "Suresh",
                last_name: "Gupta",
                user_type: "Accountant",
                phone: "9844455566",
                academy_id: acad1Id,
                branch_id: b1Id,
                role_name: "Accountent"
            },
            {
                email: "management@gmail.com",
                first_name: "Manish",
                last_name: "Aggarwal",
                user_type: "Management",
                phone: "9855566677",
                academy_id: acad1Id,
                branch_id: b1Id,
                role_name: "Management"
            },
            {
                email: "deepakwalia@gmail.com",
                first_name: "Deepak",
                last_name: "Walia",
                user_type: "Coach",
                phone: "8877887710",
                academy_id: acad1Id,
                branch_id: b2Id,
                role_name: "Coach"
            },
            {
                email: "coachrajesh@gmail.com",
                first_name: "Rajesh",
                last_name: "Pawar",
                user_type: "Coach",
                phone: "9866677788",
                academy_id: acad1Id,
                branch_id: b1Id,
                role_name: "Coach"
            },
            {
                email: "sumit@gmail.com",
                first_name: "Sumit",
                last_name: "Kumar",
                user_type: "Ground Staff",
                phone: "8811772218",
                academy_id: acad1Id,
                branch_id: b1Id,
                role_name: "Ground Staff"
            },
            {
                email: "staffsunil@gmail.com",
                first_name: "Sunil",
                last_name: "Mishra",
                user_type: "Staff",
                phone: "9877788899",
                academy_id: acad2Id,
                branch_id: b3Id,
                role_name: "Staff"
            },
            {
                email: "player11@gmail.com",
                first_name: "Player11",
                last_name: "Kumar",
                user_type: "Player",
                phone: "7894563210",
                academy_id: acad1Id,
                branch_id: b1Id,
                role_name: "Player"
            },
            {
                email: "player10@gmail.com",
                first_name: "Player10",
                last_name: "Sharma",
                user_type: "Player",
                phone: "9977118818",
                academy_id: acad2Id,
                branch_id: b3Id,
                role_name: "Player"
            }
        ];

        const userMap = new Map();

        for (const u of usersToSeed) {
            const [rows] = await connection.query("SELECT id FROM cst_users WHERE email = ? LIMIT 1", [u.email]);
            let uid;
            if (rows.length > 0) {
                uid = rows[0].id;
                // update password to ensure testing login works
                await connection.query(
                    `UPDATE cst_users SET password = ?, status = 1, is_deleted = 0, user_type = ?, academy_id = ?, branch_id = ? WHERE id = ?`,
                    [passwordHash, u.user_type, u.academy_id, u.branch_id, uid]
                );
            } else {
                const appointmentNo = `APT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;
                const [ins] = await connection.query(
                    `INSERT INTO cst_users (appointment_no, first_name, last_name, email, phone, password, user_type, academy_id, branch_id, status, is_deleted, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
                    [appointmentNo, u.first_name, u.last_name, u.email, u.phone, passwordHash, u.user_type, u.academy_id, u.branch_id]
                );
                uid = ins.insertId;
            }
            userMap.set(u.email, uid);

            // Link user role in cst_user_roles
            const rId = getRoleId(u.role_name);
            if (rId) {
                const [ur] = await connection.query("SELECT id FROM cst_user_roles WHERE user_id = ? AND role_id = ?", [uid, rId]);
                if (ur.length === 0) {
                    await connection.query("INSERT INTO cst_user_roles (user_id, role_id, created_at) VALUES (?, ?, NOW())", [uid, rId]);
                }
            }

            // Link user branch in cst_user_branches if branch_id is present
            if (u.branch_id) {
                const [ub] = await connection.query("SELECT id FROM cst_user_branches WHERE user_id = ? AND branch_id = ?", [uid, u.branch_id]);
                if (ub.length === 0) {
                    const [[userRow]] = await connection.query("SELECT appointment_no FROM cst_users WHERE id = ?", [uid]);
                    const aptNo = userRow?.appointment_no || `APT-UB-${uid}-${u.branch_id}`;
                    await connection.query("INSERT INTO cst_user_branches (user_id, branch_id, appointment_no, created_at) VALUES (?, ?, ?, NOW())", [uid, u.branch_id, aptNo]);
                }
            }
        }
        console.log(`Users seeded/verified: ${userMap.size}`);

        // 5. FACILITIES
        console.log("5. Seeding cst_facilities...");
        const facilities = [
            { name: "Turf Match Pitch", desc: "BCCI standard natural turf wicket" },
            { name: "Floodlights Practice Nets", desc: "Night training high-lux LED nets" },
            { name: "Automated Bowling Machine", desc: "Speed adjustable from 80km/h to 150km/h" },
            { name: "Video Analysis Lab", desc: "High-speed camera biomechanics feedback" },
            { name: "Fitness & Strength Gym", desc: "Cricket-specific athletic conditioning center" },
            { name: "Cement Pitch Nets", desc: "Hard ball high bounce training" }
        ];
        for (const f of facilities) {
            await connection.query(
                `INSERT INTO cst_facilities (facility_name, description, status, created_at, updated_at)
                 VALUES (?, ?, 1, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE description = VALUES(description)`,
                [f.name, f.desc]
            );
        }

        // 6. TOURNAMENT FACILITIES
        console.log("6. Seeding cst_tournament_facilities...");
        const [tournaments] = await connection.query("SELECT id FROM cst_tournaments LIMIT 2");
        const [facList] = await connection.query("SELECT id FROM cst_facilities LIMIT 3");
        if (tournaments.length > 0 && facList.length > 0) {
            for (const t of tournaments) {
                for (const f of facList) {
                    const [tf] = await connection.query(
                        "SELECT id FROM cst_tournament_facilities WHERE tournament_id = ? AND facility_id = ?",
                        [t.id, f.id]
                    );
                    if (tf.length === 0) {
                        await connection.query(
                            `INSERT INTO cst_tournament_facilities (tournament_id, facility_id, quantity, amount, description, status, created_at)
                             VALUES (?, ?, 1, 2500.00, 'Tournament standard facility provision', 1, NOW())`,
                            [t.id, f.id]
                        );
                    }
                }
            }
        }

        // 7. GALLERY VIDEOS
        console.log("7. Seeding cst_gallery_videos...");
        const [albums] = await connection.query("SELECT id FROM cst_gallery_albums LIMIT 2");
        const albumId = albums[0]?.id || null;
        const [videos] = await connection.query("SELECT id FROM cst_gallery_videos");
        if (videos.length === 0) {
            const videoData = [
                { title: "Power Hitting Masterclass", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", type: "YouTube", duration: "12:45" },
                { title: "Fast Bowling Biomechanics", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", type: "YouTube", duration: "18:20" },
                { title: "U-16 Championship Highlights", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", type: "YouTube", duration: "08:15" }
            ];
            for (let i = 0; i < videoData.length; i++) {
                const v = videoData[i];
                await connection.query(
                    `INSERT INTO cst_gallery_videos (album_id, video_title, video_url, video_type, duration, sort_order, status, is_deleted, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
                    [albumId, v.title, v.url, v.type, v.duration, i + 1]
                );
            }
        }

        // 8. INDIVIDUAL TRAINING
        console.log("8. Seeding cst_individual_training...");
        const [trainings] = await connection.query("SELECT id FROM cst_individual_training");
        if (trainings.length === 0) {
            const [programs] = await connection.query("SELECT id FROM cst_user_programs LIMIT 2");
            const coachDeepakId = userMap.get("deepakwalia@gmail.com") || 7;
            const coachRajeshId = userMap.get("coachrajesh@gmail.com") || coachDeepakId;

            if (programs.length > 0) {
                await connection.query(
                    `INSERT INTO cst_individual_training (academy_id, branch_id, user_program_id, coach_user_id, training_days, start_time, end_time, start_date, session_duration, status, remarks, is_deleted, created_at, updated_at)
                     VALUES (?, ?, ?, ?, 'Monday,Wednesday,Friday', '06:30:00', '07:30:00', '2026-11-01', 60, 'Active', 'Specialized spin bowling coaching', 0, NOW(), NOW())`,
                    [acad1Id, b1Id, programs[0].id, coachRajeshId]
                );

                if (programs[1]) {
                    await connection.query(
                        `INSERT INTO cst_individual_training (academy_id, branch_id, user_program_id, coach_user_id, training_days, start_time, end_time, start_date, session_duration, status, remarks, is_deleted, created_at, updated_at)
                         VALUES (?, ?, ?, ?, 'Tuesday,Thursday,Saturday', '16:00:00', '17:00:00', '2026-11-01', 60, 'Active', 'Top order batting alignment drills', 0, NOW(), NOW())`,
                        [acad1Id, b2Id, programs[1].id, coachDeepakId]
                    );
                }
            }
        }

        // 9. MATCH INNINGS, SCORECARD & BOWLING SCORECARD
        console.log("9. Seeding Match Innings & Scorecards...");
        const [matches] = await connection.query("SELECT id, team_a_id, team_b_id FROM cst_matches LIMIT 2");
        if (matches.length > 0) {
            const m = matches[0];
            const [innings] = await connection.query("SELECT id, innings_no FROM cst_match_innings WHERE match_id = ?", [m.id]);
            let inn1Id, inn2Id;

            if (innings.length === 0) {
                const [i1] = await connection.query(
                    `INSERT INTO cst_match_innings (match_id, innings_no, batting_team_id, bowling_team_id, total_runs, total_wickets, total_overs, total_balls, extras, innings_status, created_at)
                     VALUES (?, 1, ?, ?, 185, 4, 20.0, 120, 12, 'Completed', NOW())`,
                    [m.id, m.team_a_id, m.team_b_id]
                );
                inn1Id = i1.insertId;

                const [i2] = await connection.query(
                    `INSERT INTO cst_match_innings (match_id, innings_no, batting_team_id, bowling_team_id, total_runs, total_wickets, total_overs, total_balls, extras, target_runs, innings_status, created_at)
                     VALUES (?, 2, ?, ?, 172, 8, 20.0, 120, 8, 186, 'Completed', NOW())`,
                    [m.id, m.team_b_id, m.team_a_id]
                );
                inn2Id = i2.insertId;
            } else {
                inn1Id = innings[0].id;
                inn2Id = innings[1]?.id || inn1Id;
            }

            // Match Players
            const [matchPlayers] = await connection.query("SELECT id, team_id FROM cst_match_players WHERE match_id = ?", [m.id]);
            const [existingScorecards] = await connection.query("SELECT id FROM cst_match_scorecard WHERE match_id = ?", [m.id]);

            if (existingScorecards.length === 0 && matchPlayers.length > 0) {
                for (let idx = 0; idx < Math.min(matchPlayers.length, 6); idx++) {
                    const mp = matchPlayers[idx];
                    const targetInnings = mp.team_id === m.team_a_id ? inn1Id : inn2Id;
                    const runs = (idx + 1) * 18;
                    const balls = runs + 4;
                    const fours = Math.floor(runs / 8);
                    const sixes = Math.floor(runs / 20);
                    const sr = ((runs / balls) * 100).toFixed(2);

                    await connection.query(
                        `INSERT INTO cst_match_scorecard (match_id, innings_id, match_player_id, batting_position, runs, balls, fours, sixes, strike_rate, dismissal_type, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Out', NOW())`,
                        [m.id, targetInnings, mp.id, idx + 1, runs, balls, fours, sixes, sr]
                    );

                    // Also bowling scorecard for some players
                    if (idx < 3) {
                        const oppInnings = targetInnings === inn1Id ? inn2Id : inn1Id;
                        await connection.query(
                            `INSERT INTO cst_match_bowling_scorecard (match_id, innings_id, match_player_id, overs, balls_bowled, maidens, runs_conceded, wickets, economy, created_at)
                             VALUES (?, ?, ?, 4.0, 24, 0, 28, 2, 7.00, NOW())`,
                            [m.id, oppInnings, mp.id]
                        );
                    }
                }
            }
        }

        // 10. CART & CART ITEMS
        console.log("10. Seeding cst_cart & cst_cart_items...");
        const [publicUsers] = await connection.query("SELECT id FROM cst_public_users LIMIT 1");
        const pubUserId = publicUsers[0]?.id || null;
        const [carts] = await connection.query("SELECT id FROM cst_cart");
        let cartId;
        if (carts.length === 0) {
            const playerUid = userMap.get("player11@gmail.com") || 11;
            const [cRes] = await connection.query(
                `INSERT INTO cst_cart (customer_user_id, public_user_id, created_at, updated_at)
                 VALUES (?, ?, NOW(), NOW())`,
                [playerUid, pubUserId]
            );
            cartId = cRes.insertId;

            const [products] = await connection.query("SELECT id FROM cst_products LIMIT 2");
            for (const prod of products) {
                await connection.query(
                    `INSERT INTO cst_cart_items (cart_id, product_id, quantity, created_at, updated_at)
                     VALUES (?, ?, 1, NOW(), NOW())`,
                    [cartId, prod.id]
                );
            }
        }

        // 11. PASSWORD RESETS
        console.log("11. Seeding cst_password_resets...");
        const [resets] = await connection.query("SELECT id FROM cst_password_resets");
        if (resets.length === 0) {
            const coachId = userMap.get("deepakwalia@gmail.com") || 7;
            await connection.query(
                `INSERT INTO cst_password_resets (user_id, identifier, identifier_type, otp_code, academy_id, branch_id, status, expires_at, created_at)
                 VALUES (?, 'deepakwalia@gmail.com', 'email', '123456', ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW())`,
                [coachId, acad1Id, b2Id]
            );
            await connection.query(
                `INSERT INTO cst_password_resets (user_id, identifier, identifier_type, otp_code, academy_id, branch_id, status, expires_at, created_at)
                 VALUES (?, '8877887710', 'phone', '654321', ?, ?, 'used', NOW(), NOW())`,
                [coachId, acad1Id, b2Id]
            );
        }

        // 12. ENQUIRIES & FOLLOWUPS
        console.log("12. Seeding Student Enquiries & Followups...");
        const [enq] = await connection.query("SELECT id FROM cst_student_enquiries");
        if (enq.length > 0) {
            for (const e of enq) {
                const [ef] = await connection.query("SELECT id FROM cst_student_enquiries_flowup WHERE enquiry_id = ?", [e.id]);
                if (ef.length === 0) {
                    const staffId = userMap.get("staffsunil@gmail.com") || userMap.get("chandan@gmail.com") || 5;
                    await connection.query(
                        `INSERT INTO cst_student_enquiries_flowup (enquiry_id, follow_up_no, follow_up_date, enquiry_status, remarks, next_follow_up_date, created_by, created_at)
                         VALUES (?, 1, NOW(), 'Interested', 'Discussed weekend batch timing with parent; schedule trial session', DATE_ADD(NOW(), INTERVAL 3 DAY), ?, NOW())`,
                        [e.id, staffId]
                    );
                }
            }
        }

        await connection.commit();
        console.log("=== COMPLETE DUMMY DATA SEEDING FINISHED SUCCESSFULLY ===");
    } catch (err) {
        await connection.rollback();
        console.error("ERROR during dummy data seeding:", err);
    } finally {
        connection.release();
        await pool.end();
        process.exit(0);
    }
}

main();
