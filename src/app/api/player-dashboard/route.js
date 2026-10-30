import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { ensurePlayerAccess } from "@/app/components/lib/playerAccessInit.js";

function formatDismissal(dismissalType, bowlerName, fielderName) {
    const dt = String(dismissalType || "").trim();
    if (!dt || dt.toLowerCase() === "not out") return "not out";
    if (dt.toLowerCase().includes("caught & bowled") || dt.toLowerCase() === "c & b") {
        return bowlerName ? `c & b ${bowlerName}` : "c & b";
    }
    if (dt.toLowerCase() === "caught" || dt.toLowerCase() === "c") {
        if (fielderName && bowlerName) {
            if (fielderName.toLowerCase() === bowlerName.toLowerCase()) return `c & b ${bowlerName}`;
            return `c ${fielderName} b ${bowlerName}`;
        }
        if (bowlerName) return `c ? b ${bowlerName}`;
        if (fielderName) return `c ${fielderName}`;
        return "caught";
    }
    if (dt.toLowerCase() === "bowled" || dt.toLowerCase() === "b") {
        return bowlerName ? `b ${bowlerName}` : "bowled";
    }
    if (dt.toLowerCase() === "lbw") {
        return bowlerName ? `lbw b ${bowlerName}` : "lbw";
    }
    if (dt.toLowerCase().includes("run out")) {
        return fielderName ? `run out (${fielderName})` : "run out";
    }
    if (dt.toLowerCase().includes("stump")) {
        if (fielderName && bowlerName) return `st ${fielderName} b ${bowlerName}`;
        if (bowlerName) return `st ? b ${bowlerName}`;
        return "stumped";
    }
    if (dt.toLowerCase().includes("hit wicket")) {
        return bowlerName ? `hit wicket b ${bowlerName}` : "hit wicket";
    }
    return bowlerName ? `${dt} b ${bowlerName}` : dt;
}

export const dynamic = "force-dynamic";

export async function GET(request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        let requestedUserId = searchParams.get("user_id");

        // 1. Identify authenticated user from JWT token
        let authUser = null;
        try {
            const cookieStore = await cookies();
            const token = cookieStore.get("auth_token")?.value;
            if (token && process.env.JWT_SECRET) {
                authUser = jwt.verify(token, process.env.JWT_SECRET);
            }
        } catch {
            // Token parse error or expired
        }

        connection = await pool.getConnection();

        // Ensure database access, roles, and unlinked player sync
        try {
            await ensurePlayerAccess(connection);
        } catch (initErr) {
            console.warn("playerAccessInit error:", initErr?.message);
        }

        // Fetch authenticated user details to determine role and organization scope
        let currentLoggedInUser = null;
        if (authUser?.id) {
            const [authRows] = await connection.query(
                `SELECT u.id, u.academy_id, u.branch_id, u.user_type, a.academy_name, b.branch_name
                 FROM cst_users u
                 LEFT JOIN cst_academy a ON a.id = u.academy_id
                 LEFT JOIN cst_branch b ON b.id = u.branch_id
                 WHERE u.id = ? AND u.is_deleted = 0
                 LIMIT 1`,
                [authUser.id]
            );
            if (authRows.length > 0) {
                currentLoggedInUser = authRows[0];
            }
        }

        const userTypeStr = String(currentLoggedInUser?.user_type || authUser?.user_type || "").trim().toLowerCase();
        const isSuperAdmin = userTypeStr.includes("super") || userTypeStr === "1";
        const isAcademyAdmin = !isSuperAdmin && userTypeStr.includes("academy");
        const isBranchAdmin = !isSuperAdmin && !isAcademyAdmin && userTypeStr.includes("branch");
        const isStaff = isSuperAdmin || isAcademyAdmin || isBranchAdmin || userTypeStr.includes("admin") || userTypeStr.includes("coach") || userTypeStr.includes("staff");

        let adminRoleLabel = "Staff";
        let scopeTitle = "All Academy Players";
        if (isSuperAdmin) {
            adminRoleLabel = "Super Admin";
            scopeTitle = "All Academy Players (All Academies & Branches)";
        } else if (isAcademyAdmin) {
            adminRoleLabel = "Academy Admin";
            scopeTitle = `All Players — ${currentLoggedInUser?.academy_name || "Academy"}`;
        } else if (isBranchAdmin) {
            adminRoleLabel = "Branch Admin";
            scopeTitle = `All Players — ${currentLoggedInUser?.branch_name || "Branch"}`;
        }

        // Fetch player list for dropdown based on Admin role:
        // - Super Admin: all players across all academies
        // - Academy Admin: all players of that academy
        // - Branch Admin: all players of that branch
        let playerOptions = [];
        if (isStaff) {
            try {
                if (isSuperAdmin) {
                    const [rows] = await connection.query(
                        `SELECT 
                            u.id, 
                            CONCAT_WS(' ', u.first_name, u.last_name) AS name, 
                            u.email, 
                            u.phone,
                            COALESCE(ap.admission_no, u.appointment_no) AS admission_no,
                            COALESCE(b.branch_name, ub.branch_name) AS branch_name,
                            COALESCE(a.academy_name, ua.academy_name) AS academy_name
                         FROM cst_users u
                         LEFT JOIN cst_admission_players ap ON ap.user_id = u.id AND ap.is_deleted = 0
                         LEFT JOIN cst_branch b ON b.id = ap.branch_id
                         LEFT JOIN cst_academy a ON a.id = b.academy_id
                         LEFT JOIN cst_branch ub ON ub.id = u.branch_id
                         LEFT JOIN cst_academy ua ON ua.id = u.academy_id
                         WHERE (LOWER(u.user_type) = 'player' OR u.user_type = '7' OR ap.id IS NOT NULL)
                           AND u.is_deleted = 0
                         ORDER BY u.first_name ASC
                         LIMIT 500`
                    );
                    playerOptions = rows;
                } else if (isAcademyAdmin && currentLoggedInUser?.academy_id) {
                    const [rows] = await connection.query(
                        `SELECT 
                            u.id, 
                            CONCAT_WS(' ', u.first_name, u.last_name) AS name, 
                            u.email, 
                            u.phone,
                            COALESCE(ap.admission_no, u.appointment_no) AS admission_no,
                            COALESCE(b.branch_name, ub.branch_name) AS branch_name,
                            COALESCE(a.academy_name, ua.academy_name) AS academy_name
                         FROM cst_users u
                         LEFT JOIN cst_admission_players ap ON ap.user_id = u.id AND ap.is_deleted = 0
                         LEFT JOIN cst_branch b ON b.id = ap.branch_id
                         LEFT JOIN cst_academy a ON a.id = b.academy_id
                         LEFT JOIN cst_branch ub ON ub.id = u.branch_id
                         LEFT JOIN cst_academy ua ON ua.id = u.academy_id
                         WHERE (LOWER(u.user_type) = 'player' OR u.user_type = '7' OR ap.id IS NOT NULL)
                           AND u.is_deleted = 0
                           AND (
                               COALESCE(b.academy_id, ub.academy_id, u.academy_id) = ?
                               OR ap.playing_academy = ?
                               OR ap.playing_academy = ?
                           )
                         ORDER BY u.first_name ASC
                         LIMIT 500`,
                        [
                            currentLoggedInUser.academy_id,
                            String(currentLoggedInUser.academy_id),
                            currentLoggedInUser.academy_name || "",
                        ]
                    );
                    playerOptions = rows;
                } else if (isBranchAdmin && currentLoggedInUser?.branch_id) {
                    const [rows] = await connection.query(
                        `SELECT 
                            u.id, 
                            CONCAT_WS(' ', u.first_name, u.last_name) AS name, 
                            u.email, 
                            u.phone,
                            COALESCE(ap.admission_no, u.appointment_no) AS admission_no,
                            COALESCE(b.branch_name, ub.branch_name) AS branch_name,
                            COALESCE(a.academy_name, ua.academy_name) AS academy_name
                         FROM cst_users u
                         LEFT JOIN cst_admission_players ap ON ap.user_id = u.id AND ap.is_deleted = 0
                         LEFT JOIN cst_branch b ON b.id = ap.branch_id
                         LEFT JOIN cst_academy a ON a.id = b.academy_id
                         LEFT JOIN cst_branch ub ON ub.id = u.branch_id
                         LEFT JOIN cst_academy ua ON ua.id = u.academy_id
                         WHERE (LOWER(u.user_type) = 'player' OR u.user_type = '7' OR ap.id IS NOT NULL)
                           AND u.is_deleted = 0
                           AND COALESCE(ap.branch_id, u.branch_id) = ?
                         ORDER BY u.first_name ASC
                         LIMIT 500`,
                        [currentLoggedInUser.branch_id]
                    );
                    playerOptions = rows;
                } else {
                    // Other staff without specific academy/branch
                    const [rows] = await connection.query(
                        `SELECT 
                            u.id, 
                            CONCAT_WS(' ', u.first_name, u.last_name) AS name, 
                            u.email, 
                            u.phone,
                            COALESCE(ap.admission_no, u.appointment_no) AS admission_no,
                            COALESCE(b.branch_name, ub.branch_name) AS branch_name,
                            COALESCE(a.academy_name, ua.academy_name) AS academy_name
                         FROM cst_users u
                         LEFT JOIN cst_admission_players ap ON ap.user_id = u.id AND ap.is_deleted = 0
                         LEFT JOIN cst_branch b ON b.id = ap.branch_id
                         LEFT JOIN cst_academy a ON a.id = b.academy_id
                         LEFT JOIN cst_branch ub ON ub.id = u.branch_id
                         LEFT JOIN cst_academy ua ON ua.id = u.academy_id
                         WHERE (LOWER(u.user_type) = 'player' OR u.user_type = '7' OR ap.id IS NOT NULL)
                           AND u.is_deleted = 0
                         ORDER BY u.first_name ASC
                         LIMIT 500`
                    );
                    playerOptions = rows;
                }
            } catch (pErr) {
                console.error("Error fetching player options for admin view:", pErr);
            }
        }

        // Determine target player user ID:
        let targetUserId = null;
        if (requestedUserId) {
            targetUserId = Number(requestedUserId);
        } else if (isStaff) {
            // For admins/staff, auto-select the first player in their scope
            targetUserId = playerOptions.length > 0 ? playerOptions[0].id : null;
        } else {
            // For regular players, use their own user id
            targetUserId = authUser?.id || null;
            if (!targetUserId && authUser?.appointment_no) {
                const [matchedUser] = await connection.query(
                    "SELECT id FROM cst_users WHERE appointment_no = ? AND is_deleted = 0 LIMIT 1",
                    [authUser.appointment_no]
                );
                if (matchedUser.length > 0) {
                    targetUserId = matchedUser[0].id;
                }
            }
        }

        // If admin/staff has no players in their scope yet, return graceful empty state
        if (!targetUserId && isStaff) {
            return NextResponse.json({
                success: true,
                data: {
                    user: null,
                    admission: null,
                    programs: [],
                    feeCalendar: {
                        year: selectedYear,
                        months: [],
                        summary: { total_fee: 0, total_paid: 0, total_due: 0 },
                    },
                    teams: [],
                    enrolledMatches: [],
                    enrolledTournaments: [],
                    liveMatches: [],
                    upcomingMatches: [],
                    upcomingTournaments: [],
                    matchAndTournamentFees: [],
                    performance: {
                        batting: {},
                        bowling: {},
                        recentScores: [],
                    },
                    playerOptions: [],
                    isStaffView: true,
                    adminRole: adminRoleLabel,
                    scopeTitle: scopeTitle,
                },
            });
        }

        if (!targetUserId) {
            return NextResponse.json(
                { success: false, message: "No player account found to display. Please enroll a player first." },
                { status: 404 }
            );
        }

        // 2. Fetch User Record
        const [users] = await connection.query(
            `SELECT 
                u.id,
                u.appointment_no,
                u.academy_id,
                u.branch_id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.profile_image,
                u.user_type,
                u.status,
                u.created_at,
                a.academy_name,
                b.branch_name
             FROM cst_users u
             LEFT JOIN cst_academy a ON a.id = u.academy_id
             LEFT JOIN cst_branch b ON b.id = u.branch_id
             WHERE u.id = ? AND u.is_deleted = 0
             LIMIT 1`,
            [targetUserId]
        );

        if (users.length === 0) {
            return NextResponse.json(
                { success: false, message: "Player user not found." },
                { status: 404 }
            );
        }

        const user = users[0];

        // 3. Fetch linked Admission Player record
        const [admissions] = await connection.query(
            `SELECT 
                ap.id,
                ap.user_id,
                ap.admission_no,
                ap.first_name,
                ap.last_name,
                ap.father_name,
                ap.mother_name,
                ap.email,
                ap.phone,
                ap.address,
                ap.city,
                ap.state,
                ap.pin_code,
                ap.under_age,
                ap.gender,
                ap.aadhaar_no,
                ap.playing_academy,
                ap.branch_id,
                b.branch_name,
                ap.role_id,
                r.role_name,
                ap.status,
                ap.created_at
             FROM cst_admission_players ap
             LEFT JOIN cst_branch b ON b.id = ap.branch_id
             LEFT JOIN cst_roles r ON r.id = ap.role_id
             WHERE (ap.user_id = ? 
                OR (ap.admission_no = ? AND ? IS NOT NULL AND ? != '')
                OR (ap.email = ? AND ? IS NOT NULL AND ? != '') 
                OR (ap.phone = ? AND ? IS NOT NULL AND ? != ''))
               AND ap.is_deleted = 0
             ORDER BY (ap.user_id = ?) DESC, ap.id DESC
             LIMIT 1`,
            [
                user.id,
                user.appointment_no, user.appointment_no, user.appointment_no,
                user.email, user.email, user.email,
                user.phone, user.phone, user.phone,
                user.id
            ]
        );

        const admission = admissions.length > 0 ? admissions[0] : null;
        const admissionPlayerId = admission?.id || null;

        // Auto-link admission player if user_id was not set
        if (admission && (!admission.user_id || Number(admission.user_id) !== Number(user.id))) {
            try {
                await connection.query(
                    "UPDATE cst_admission_players SET user_id = ? WHERE id = ?",
                    [user.id, admission.id]
                );
                await connection.query(
                    "UPDATE cst_user_programs SET user_id = ? WHERE (admission_players_id = ? OR appointment_no = ?) AND user_id IS NULL",
                    [user.id, admission.id, admission.admission_no]
                );
            } catch (_) {}
        }

        // 4. Fetch Enrolled Programs
        let programs = [];
        try {
            const [progRows] = await connection.query(
                `SELECT 
                    up.id,
                    up.program_id,
                    up.branch_id,
                    up.start_date,
                    up.end_date,
                    up.status,
                    up.created_at,
                    p.program_name,
                    p.program_fee,
                    p.registration_fee,
                    p.daily_fee,
                    p.kit_fee,
                    b.branch_name
                 FROM cst_user_programs up
                 LEFT JOIN cst_programs p ON p.id = up.program_id
                 LEFT JOIN cst_branch b ON b.id = up.branch_id
                 WHERE (up.user_id = ? OR (up.admission_players_id = ? AND ? IS NOT NULL) OR (up.appointment_no = ? AND ? IS NOT NULL))
                   AND up.is_deleted = 0
                 ORDER BY up.id DESC`,
                [user.id, admissionPlayerId, admissionPlayerId, user.appointment_no, user.appointment_no]
            );
            programs = progRows;
        } catch (progErr) {
            console.warn("Error fetching player programs:", progErr.message);
        }

        // 5. Fetch Monthly Fee Status (January to December for Current/Selected Year)
        const currentYear = new Date().getFullYear();
        const selectedYear = Number(searchParams.get("year")) || currentYear;

        let monthlyFees = [];
        try {
            const [feeRows] = await connection.query(
                `SELECT 
                    f.id,
                    f.user_program_id,
                    f.program_id,
                    f.fee_month,
                    MONTH(f.fee_month) AS month_num,
                    DATE_FORMAT(f.fee_month, '%b') AS month_short,
                    DATE_FORMAT(f.fee_month, '%M %Y') AS month_name,
                    f.fee_amount,
                    f.paid_amount,
                    f.due_amount,
                    f.discount_amount,
                    f.late_fee,
                    f.total_amount,
                    f.payment_status,
                    f.due_date,
                    f.remarks,
                    p.program_name
                 FROM cst_player_program_fees f
                 LEFT JOIN cst_programs p ON p.id = f.program_id
                 WHERE (f.admission_players_id = ? OR f.user_program_id IN (SELECT id FROM cst_user_programs WHERE user_id = ?))
                   AND YEAR(f.fee_month) = ?
                 ORDER BY f.fee_month ASC`,
                [admissionPlayerId || 0, user.id, selectedYear]
            );
            monthlyFees = feeRows;
        } catch (feeErr) {
            console.warn("Error fetching player program fees:", feeErr.message);
        }

        // Construct 12 Month Matrix (Jan to Dec)
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const feeCalendar = monthNames.map((name, index) => {
            const monthNum = index + 1;
            const feeRecord = monthlyFees.find((f) => Number(f.month_num) === monthNum);

            if (feeRecord) {
                return {
                    month_num: monthNum,
                    month_name: name,
                    fee_id: feeRecord.id,
                    program_name: feeRecord.program_name || "Coaching Program",
                    fee_amount: Number(feeRecord.total_amount || feeRecord.fee_amount || 0),
                    paid_amount: Number(feeRecord.paid_amount || 0),
                    due_amount: Number(feeRecord.due_amount || 0),
                    payment_status: feeRecord.payment_status || (Number(feeRecord.due_amount) <= 0 ? "Paid" : "Pending"),
                    due_date: feeRecord.due_date,
                    remarks: feeRecord.remarks || null,
                    is_billed: true,
                };
            }

            return {
                month_num: monthNum,
                month_name: name,
                fee_id: null,
                program_name: null,
                fee_amount: 0,
                paid_amount: 0,
                due_amount: 0,
                payment_status: "Upcoming",
                due_date: null,
                remarks: null,
                is_billed: false,
            };
        });

        // 6. Fetch Enrolled Teams
        let allEnrolledTeams = [];
        try {
            const [regularTeams] = await connection.query(
                `SELECT 
                    tp.id AS membership_id,
                    tp.team_id,
                    tp.jersey_no,
                    tp.player_role,
                    t.team_name,
                    t.team_code,
                    t.team_logo,
                    b.branch_name,
                    'Club / Academy Team' AS category
                 FROM cst_team_players tp
                 INNER JOIN cst_teams t ON t.id = tp.team_id
                 LEFT JOIN cst_branch b ON b.id = t.branch_id
                 WHERE tp.user_id = ?
                   AND tp.is_deleted = 0 AND t.is_deleted = 0`,
                [user.id]
            );

            const [tournamentTeams] = await connection.query(
                `SELECT 
                    ttp.id AS membership_id,
                    tt.team_id,
                    ttp.jersey_no,
                    ttp.player_role,
                    tm.team_name,
                    tm.team_code,
                    tm.team_logo,
                    t.tournament_name,
                    t.id AS tournament_id,
                    'Tournament Squad' AS category
                 FROM cst_tournament_team_players ttp
                 INNER JOIN cst_tournament_teams tt ON tt.id = ttp.tournament_team_id
                 INNER JOIN cst_teams tm ON tm.id = tt.team_id
                 INNER JOIN cst_tournaments t ON t.id = tt.tournament_id
                 WHERE ttp.user_id = ?
                   AND ttp.is_deleted = 0 AND tt.is_deleted = 0`,
                [user.id]
            );

            const combinedTeams = [...regularTeams, ...tournamentTeams];
            const teamMap = new Map();
            for (const item of combinedTeams) {
                if (!teamMap.has(item.team_id)) {
                    teamMap.set(item.team_id, item);
                }
            }
            allEnrolledTeams = Array.from(teamMap.values());
        } catch (teamErr) {
            console.warn("Error fetching enrolled teams:", teamErr.message);
        }

        // 7. Fetch My Enrolled Matches with Full Scorecard Details
        let enrolledMatches = [];
        try {
            const [matchRows] = await connection.query(
                `SELECT 
                    m.id,
                    m.match_no,
                    m.match_type,
                    m.match_date,
                    m.match_time,
                    m.status AS match_status,
                    m.toss_decision,
                    toss_t.team_name AS toss_winner_name,
                    t.tournament_name,
                    t.id AS tournament_id,
                    ta.team_name AS team_a_name,
                    tb.team_name AS team_b_name,
                    g.ground_name,
                    mp.id AS match_player_id,
                    mp.team_id AS my_team_id,
                    myt.team_name AS my_team_name,
                    CASE 
                        WHEN mp.captain = 1 THEN 'Captain'
                        WHEN mp.vice_captain = 1 THEN 'Vice Captain'
                        WHEN mp.wicket_keeper = 1 THEN 'Wicket Keeper'
                        WHEN mp.substitute = 1 THEN 'Substitute'
                        WHEN mp.playing_11 = 1 THEN 'Playing XI'
                        ELSE 'Player'
                    END AS player_role
                 FROM cst_match_players mp
                 INNER JOIN cst_matches m ON m.id = mp.match_id
                 LEFT JOIN cst_tournaments t ON t.id = m.tournament_id
                 LEFT JOIN cst_teams ta ON ta.id = m.team_a_id
                 LEFT JOIN cst_teams tb ON tb.id = m.team_b_id
                 LEFT JOIN cst_teams myt ON myt.id = mp.team_id
                 LEFT JOIN cst_teams toss_t ON toss_t.id = m.toss_winner_team_id
                 LEFT JOIN cst_ground g ON g.id = m.ground_id
                 WHERE mp.user_id = ?
                 ORDER BY m.match_date DESC, m.id DESC`,
                [user.id]
            );

            // Deduplicate matches
            const matchMap = new Map();
            for (const item of matchRows) {
                if (!matchMap.has(item.id)) {
                    matchMap.set(item.id, item);
                }
            }
            const uniqueMatchList = Array.from(matchMap.values());
            const matchIds = uniqueMatchList.map((m) => m.id);

            // Query Batting Scorecards for this player
            const [battingRecords] = await connection.query(
                `SELECT 
                    sc.id,
                    sc.match_id,
                    sc.innings_id,
                    sc.match_player_id,
                    sc.batting_position,
                    sc.runs,
                    sc.balls,
                    sc.fours,
                    sc.sixes,
                    sc.strike_rate,
                    sc.dismissal_type,
                    mi.innings_no,
                    COALESCE(CONCAT_WS(' ', bu.first_name, bu.last_name), bop.player_name) AS bowler_name,
                    COALESCE(CONCAT_WS(' ', fu.first_name, fu.last_name), fop.player_name) AS fielder_name
                 FROM cst_match_scorecard sc
                 INNER JOIN cst_match_players mp ON mp.id = sc.match_player_id
                 LEFT JOIN cst_match_innings mi ON mi.id = sc.innings_id
                 LEFT JOIN cst_match_players bmp ON bmp.id = sc.dismissed_by_player_id
                 LEFT JOIN cst_users bu ON bu.id = bmp.user_id
                 LEFT JOIN cst_outside_players bop ON bop.id = bmp.outside_player_id
                 LEFT JOIN cst_match_players fmp ON fmp.id = sc.fielder_player_id
                 LEFT JOIN cst_users fu ON fu.id = fmp.user_id
                 LEFT JOIN cst_outside_players fop ON fop.id = fmp.outside_player_id
                 WHERE mp.user_id = ?
                 ORDER BY sc.match_id DESC, mi.innings_no ASC`,
                [user.id]
            );

            // Query Bowling Scorecards for this player
            const [bowlingRecords] = await connection.query(
                `SELECT 
                    bs.id,
                    bs.match_id,
                    bs.innings_id,
                    bs.match_player_id,
                    bs.overs,
                    bs.balls_bowled,
                    bs.maidens,
                    bs.runs_conceded,
                    bs.wickets,
                    bs.wides,
                    bs.no_balls,
                    bs.economy,
                    mi.innings_no
                 FROM cst_match_bowling_scorecard bs
                 INNER JOIN cst_match_players mp ON mp.id = bs.match_player_id
                 LEFT JOIN cst_match_innings mi ON mi.id = bs.innings_id
                 WHERE mp.user_id = ?
                 ORDER BY bs.match_id DESC, mi.innings_no ASC`,
                [user.id]
            );

            // Query Fielding dismissals for this player (catches, run outs, stumpings)
            const [fieldingRecords] = await connection.query(
                `SELECT 
                    sc.id,
                    sc.match_id,
                    sc.dismissal_type,
                    sc.fielder_player_id,
                    sc.dismissed_by_player_id,
                    mi.innings_no
                 FROM cst_match_scorecard sc
                 LEFT JOIN cst_match_innings mi ON mi.id = sc.innings_id
                 WHERE sc.fielder_player_id IN (SELECT id FROM cst_match_players WHERE user_id = ?)
                    OR (sc.dismissed_by_player_id IN (SELECT id FROM cst_match_players WHERE user_id = ?) AND LOWER(sc.dismissal_type) LIKE '%caught%bowled%')`,
                [user.id, user.id]
            );

            // Query Team Innings scores for these matches
            let inningsRows = [];
            if (matchIds.length > 0) {
                const [inngData] = await connection.query(
                    `SELECT 
                        mi.match_id,
                        mi.innings_no,
                        mi.batting_team_id,
                        t.team_name AS batting_team_name,
                        mi.total_runs,
                        mi.total_wickets,
                        mi.total_overs,
                        mi.total_balls,
                        mi.extras
                     FROM cst_match_innings mi
                     LEFT JOIN cst_teams t ON t.id = mi.batting_team_id
                     WHERE mi.match_id IN (?)
                     ORDER BY mi.match_id, mi.innings_no ASC`,
                    [matchIds]
                );
                inningsRows = inngData;
            }

            // Group by match_id
            const battingByMatch = new Map();
            for (const b of battingRecords) {
                if (!battingByMatch.has(b.match_id)) battingByMatch.set(b.match_id, b);
            }

            const bowlingByMatch = new Map();
            for (const bw of bowlingRecords) {
                if (!bowlingByMatch.has(bw.match_id)) bowlingByMatch.set(bw.match_id, bw);
            }

            const fieldingByMatch = new Map();
            for (const f of fieldingRecords) {
                if (!fieldingByMatch.has(f.match_id)) fieldingByMatch.set(f.match_id, []);
                fieldingByMatch.get(f.match_id).push(f);
            }

            const inningsByMatch = new Map();
            for (const inng of inningsRows) {
                if (!inningsByMatch.has(inng.match_id)) inningsByMatch.set(inng.match_id, []);
                inningsByMatch.get(inng.match_id).push(inng);
            }

            // Construct enriched matches with individual scorecards
            enrolledMatches = uniqueMatchList.map((m) => {
                const b = battingByMatch.get(m.id) || null;
                const bw = bowlingByMatch.get(m.id) || null;
                const fList = fieldingByMatch.get(m.id) || [];
                const inngList = inningsByMatch.get(m.id) || [];

                let battingObj = null;
                if (b) {
                    const runs = Number(b.runs || 0);
                    const balls = Number(b.balls || 0);
                    const fours = Number(b.fours || 0);
                    const sixes = Number(b.sixes || 0);
                    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(2) : (b.strike_rate ? Number(b.strike_rate).toFixed(2) : "0.00");
                    const dismissalText = formatDismissal(b.dismissal_type, b.bowler_name, b.fielder_name);
                    battingObj = {
                        has_batted: true,
                        runs,
                        balls,
                        fours,
                        sixes,
                        strike_rate: sr,
                        batting_position: b.batting_position || 1,
                        dismissal_type: b.dismissal_type || "Not Out",
                        bowler_name: b.bowler_name || null,
                        fielder_name: b.fielder_name || null,
                        dismissal_text: dismissalText,
                        is_not_out: String(b.dismissal_type || "").toLowerCase() === "not out",
                    };
                }

                let bowlingObj = null;
                if (bw) {
                    const overs = Number(bw.overs || 0);
                    const ballsBowled = Number(bw.balls_bowled || Math.round(overs * 6));
                    const maidens = Number(bw.maidens || 0);
                    const runsConceded = Number(bw.runs_conceded || 0);
                    const wickets = Number(bw.wickets || 0);
                    const wides = Number(bw.wides || 0);
                    const noBalls = Number(bw.no_balls || 0);
                    const economy = overs > 0 ? (runsConceded / overs).toFixed(2) : (bw.economy ? Number(bw.economy).toFixed(2) : "0.00");
                    bowlingObj = {
                        has_bowled: true,
                        overs: overs.toFixed(1),
                        balls_bowled: ballsBowled,
                        maidens,
                        runs_conceded: runsConceded,
                        wickets,
                        wides,
                        no_balls: noBalls,
                        economy,
                    };
                }

                let catches = 0;
                let runOuts = 0;
                let stumpings = 0;
                for (const f of fList) {
                    const dt = String(f.dismissal_type || "").toLowerCase();
                    if (dt.includes("caught") || dt === "c" || dt === "c & b") catches++;
                    else if (dt.includes("run out")) runOuts++;
                    else if (dt.includes("stump")) stumpings++;
                }
                const totalDismissals = catches + runOuts + stumpings;
                const fieldingObj = {
                    has_fielded: totalDismissals > 0,
                    catches,
                    run_outs: runOuts,
                    stumpings,
                    total_dismissals: totalDismissals,
                };

                const inningsSummary = inngList.map((inng) => ({
                    innings_no: inng.innings_no,
                    batting_team_name: inng.batting_team_name || "Team",
                    runs: inng.total_runs || 0,
                    wickets: inng.total_wickets || 0,
                    overs: Number(inng.total_overs || 0).toFixed(1),
                    score_text: `${inng.total_runs || 0}/${inng.total_wickets || 0} (${Number(inng.total_overs || 0).toFixed(1)} ov)`,
                }));

                const hasScorecard = Boolean(battingObj || bowlingObj || fieldingObj.has_fielded);
                const isCompleted = String(m.match_status).toLowerCase() === "completed";

                return {
                    ...m,
                    has_scorecard: hasScorecard,
                    is_played: isCompleted || hasScorecard,
                    batting: battingObj,
                    bowling: bowlingObj,
                    fielding: fieldingObj,
                    innings_summary: inningsSummary,
                };
            });
        } catch (mErr) {
            console.warn("Error fetching enrolled matches:", mErr.message);
        }

        let enrolledTournaments = [];
        try {
            const [tournRows] = await connection.query(
                `SELECT DISTINCT 
                    t.id,
                    t.tournament_name,
                    t.tournament_code,
                    t.start_date,
                    t.end_date,
                    t.status AS tournament_status,
                    t.registration_fee,
                    tm.team_name
                 FROM cst_tournament_team_players ttp
                 INNER JOIN cst_tournament_teams tt ON tt.id = ttp.tournament_team_id
                 INNER JOIN cst_tournaments t ON t.id = tt.tournament_id
                 INNER JOIN cst_teams tm ON tm.id = tt.team_id
                 WHERE ttp.user_id = ? AND ttp.is_deleted = 0
                 ORDER BY t.start_date DESC`,
                [user.id]
            );

            // Deduplicate tournaments by tournament id (combine team names if multiple)
            const tournMap = new Map();
            for (const item of tournRows) {
                if (!tournMap.has(item.id)) {
                    tournMap.set(item.id, {
                        ...item,
                        team_names: [item.team_name].filter(Boolean),
                    });
                } else {
                    const existing = tournMap.get(item.id);
                    if (item.team_name && !existing.team_names.includes(item.team_name)) {
                        existing.team_names.push(item.team_name);
                        existing.team_name = existing.team_names.join(", ");
                    }
                }
            }
            enrolledTournaments = Array.from(tournMap.values());
        } catch (tErr) {
            console.warn("Error fetching enrolled tournaments:", tErr.message);
        }

        // 8. Fetch All Live & Upcoming Matches / Tournaments
        let liveMatches = [];
        let upcomingMatches = [];
        let upcomingTournaments = [];
        try {
            const [liveRows] = await connection.query(
                `SELECT 
                    m.id,
                    m.match_no,
                    m.match_type,
                    m.match_date,
                    m.match_time,
                    m.status,
                    ta.team_name AS team_a_name,
                    tb.team_name AS team_b_name,
                    g.ground_name,
                    t.tournament_name
                 FROM cst_matches m
                 LEFT JOIN cst_teams ta ON ta.id = m.team_a_id
                 LEFT JOIN cst_teams tb ON tb.id = m.team_b_id
                 LEFT JOIN cst_ground g ON g.id = m.ground_id
                 LEFT JOIN cst_tournaments t ON t.id = m.tournament_id
                 WHERE LOWER(m.status) IN ('live', 'ongoing', 'in progress')
                 ORDER BY m.match_date ASC
                 LIMIT 6`
            );
            liveMatches = liveRows;

            const [upcomingMRows] = await connection.query(
                `SELECT 
                    m.id,
                    m.match_no,
                    m.match_type,
                    m.match_date,
                    m.match_time,
                    m.status,
                    ta.team_name AS team_a_name,
                    tb.team_name AS team_b_name,
                    g.ground_name,
                    t.tournament_name
                 FROM cst_matches m
                 LEFT JOIN cst_teams ta ON ta.id = m.team_a_id
                 LEFT JOIN cst_teams tb ON tb.id = m.team_b_id
                 LEFT JOIN cst_ground g ON g.id = m.ground_id
                 LEFT JOIN cst_tournaments t ON t.id = m.tournament_id
                 WHERE LOWER(m.status) IN ('upcoming', 'scheduled')
                    OR (m.match_date >= CURDATE() AND LOWER(m.status) NOT IN ('completed', 'cancelled'))
                 ORDER BY m.match_date ASC, m.match_time ASC
                 LIMIT 10`
            );
            upcomingMatches = upcomingMRows;

            const [upcomingTRows] = await connection.query(
                `SELECT 
                    id,
                    tournament_name,
                    tournament_code,
                    start_date,
                    end_date,
                    status,
                    registration_fee
                 FROM cst_tournaments
                 WHERE is_deleted = 0 AND (LOWER(status) IN ('upcoming', 'ongoing', 'live', 'open') OR end_date >= CURDATE())
                 ORDER BY start_date ASC
                 LIMIT 6`
            );
            upcomingTournaments = upcomingTRows;
        } catch (fixErr) {
            console.warn("Error fetching fixtures:", fixErr.message);
        }

        // 9. Match & Tournament Fee Status
        let matchAndTournamentFees = [];
        try {
            const [feeStatusRows] = await connection.query(
                `SELECT 
                    fs.id,
                    fs.fee_type,
                    fs.fee_amount,
                    fs.paid_amount,
                    (fs.fee_amount - fs.paid_amount) AS due_amount,
                    fs.status,
                    fs.created_at,
                    fs.tournament_id,
                    fs.match_id,
                    t.tournament_name,
                    m.match_no,
                    m.match_date,
                    g.ground_name
                 FROM cst_fee_status fs
                 LEFT JOIN cst_tournaments t ON t.id = fs.tournament_id
                 LEFT JOIN cst_matches m ON m.id = fs.match_id
                 LEFT JOIN cst_ground_bookings gb ON gb.id = fs.ground_booking_id
                 LEFT JOIN cst_ground g ON g.id = gb.ground_id
                 WHERE fs.user_id = ?
                    OR fs.tournament_team_player_id IN (SELECT id FROM cst_tournament_team_players WHERE user_id = ?)
                    OR fs.match_player_id IN (SELECT id FROM cst_match_players WHERE user_id = ?)
                 ORDER BY fs.id DESC`,
                [user.id, user.id, user.id]
            );

            // Consolidate / Deduplicate multiple fee records for the same tournament or match
            const consolidatedFeeMap = new Map();

            for (const item of feeStatusRows) {
                // Key by event type and event reference
                const eventKey = item.fee_type === "Tournament Player"
                    ? `tournament_${item.tournament_id || item.tournament_name || item.id}`
                    : `match_${item.match_id || item.match_no || item.id}`;

                const feeAmt = Number(item.fee_amount || 0);
                const paidAmt = Number(item.paid_amount || 0);

                if (!consolidatedFeeMap.has(eventKey)) {
                    consolidatedFeeMap.set(eventKey, {
                        ...item,
                        fee_amount: feeAmt,
                        paid_amount: paidAmt,
                    });
                } else {
                    const existing = consolidatedFeeMap.get(eventKey);
                    // Add up payments made for this tournament / match
                    existing.paid_amount += paidAmt;
                    // Standardize fee_amount (take maximum of fee_amount)
                    existing.fee_amount = Math.max(existing.fee_amount, feeAmt);
                }
            }

            matchAndTournamentFees = Array.from(consolidatedFeeMap.values()).map((item) => {
                const dueAmt = Math.max(0, item.fee_amount - item.paid_amount);
                const computedStatus = dueAmt <= 0
                    ? "Paid"
                    : (item.paid_amount > 0 ? "Partial" : "Pending");

                return {
                    ...item,
                    due_amount: dueAmt,
                    status: computedStatus,
                };
            });
        } catch (feeStatusErr) {
            console.warn("Error fetching match/tournament fee status:", feeStatusErr.message);
        }

        // 10. Player Performance Statistics
        let batting = {};
        let bowling = {};
        let fielding = {};
        let recentScores = [];
        try {
            const [battingStatsRows] = await connection.query(
                `SELECT 
                    COUNT(sc.id) AS innings,
                    COALESCE(SUM(sc.runs), 0) AS total_runs,
                    COALESCE(SUM(sc.balls), 0) AS total_balls,
                    COALESCE(SUM(sc.fours), 0) AS total_fours,
                    COALESCE(SUM(sc.sixes), 0) AS total_sixes,
                    COALESCE(MAX(sc.runs), 0) AS highest_score,
                    COALESCE(SUM(CASE WHEN sc.runs >= 50 AND sc.runs < 100 THEN 1 ELSE 0 END), 0) AS fifties,
                    COALESCE(SUM(CASE WHEN sc.runs >= 100 THEN 1 ELSE 0 END), 0) AS hundreds,
                    COALESCE(SUM(CASE WHEN LOWER(sc.dismissal_type) != 'not out' AND sc.dismissal_type IS NOT NULL AND sc.dismissal_type != '' THEN 1 ELSE 0 END), 0) AS times_out
                 FROM cst_match_scorecard sc
                 INNER JOIN cst_match_players mp ON mp.id = sc.match_player_id
                 WHERE mp.user_id = ?`,
                [user.id]
            );

            const [bowlingStatsRows] = await connection.query(
                `SELECT 
                    COUNT(bs.id) AS innings_bowled,
                    COALESCE(SUM(bs.overs), 0) AS total_overs,
                    COALESCE(SUM(bs.maidens), 0) AS total_maidens,
                    COALESCE(SUM(bs.runs_conceded), 0) AS total_runs_conceded,
                    COALESCE(SUM(bs.wickets), 0) AS total_wickets,
                    COALESCE(MAX(bs.wickets), 0) AS best_wickets
                 FROM cst_match_bowling_scorecard bs
                 INNER JOIN cst_match_players mp ON mp.id = bs.match_player_id
                 WHERE mp.user_id = ?`,
                [user.id]
            );

            const [fieldingStatsRows] = await connection.query(
                `SELECT 
                    COALESCE(SUM(CASE WHEN LOWER(sc.dismissal_type) IN ('caught', 'c', 'caught & bowled') OR LOWER(sc.dismissal_type) LIKE '%caught%' THEN 1 ELSE 0 END), 0) AS total_catches,
                    COALESCE(SUM(CASE WHEN LOWER(sc.dismissal_type) LIKE '%run out%' THEN 1 ELSE 0 END), 0) AS total_run_outs,
                    COALESCE(SUM(CASE WHEN LOWER(sc.dismissal_type) LIKE '%stump%' THEN 1 ELSE 0 END), 0) AS total_stumpings
                 FROM cst_match_scorecard sc
                 WHERE sc.fielder_player_id IN (SELECT id FROM cst_match_players WHERE user_id = ?)
                    OR (sc.dismissed_by_player_id IN (SELECT id FROM cst_match_players WHERE user_id = ?) AND LOWER(sc.dismissal_type) LIKE '%caught%bowled%')`,
                [user.id, user.id]
            );

            batting = battingStatsRows[0] || {};
            bowling = bowlingStatsRows[0] || {};
            fielding = fieldingStatsRows[0] || {};

            const [recScores] = await connection.query(
                `SELECT 
                    m.id AS match_id,
                    m.match_no,
                    m.match_date,
                    m.match_type,
                    t.tournament_name,
                    ta.team_name AS team_a_name,
                    tb.team_name AS team_b_name,
                    sc.runs,
                    sc.balls,
                    sc.fours,
                    sc.sixes,
                    sc.strike_rate,
                    sc.dismissal_type,
                    COALESCE(ub.first_name, opb.player_name) AS bowler_name,
                    COALESCE(uf.first_name, opf.player_name) AS fielder_name,
                    bs.overs,
                    bs.balls_bowled,
                    bs.maidens,
                    bs.runs_conceded,
                    bs.wickets,
                    bs.wides,
                    bs.no_balls,
                    bs.economy
                 FROM cst_match_players mp
                 INNER JOIN cst_matches m ON m.id = mp.match_id
                 LEFT JOIN cst_tournaments t ON t.id = m.tournament_id
                 LEFT JOIN cst_teams ta ON ta.id = m.team_a_id
                 LEFT JOIN cst_teams tb ON tb.id = m.team_b_id
                 LEFT JOIN cst_match_scorecard sc ON sc.match_player_id = mp.id
                 LEFT JOIN cst_match_players mp_b ON mp_b.id = sc.dismissed_by_player_id
                 LEFT JOIN cst_users ub ON ub.id = mp_b.user_id
                 LEFT JOIN cst_outside_players opb ON opb.id = mp_b.outside_player_id
                 LEFT JOIN cst_match_players mp_f ON mp_f.id = sc.fielder_player_id
                 LEFT JOIN cst_users uf ON uf.id = mp_f.user_id
                 LEFT JOIN cst_outside_players opf ON opf.id = mp_f.outside_player_id
                 LEFT JOIN cst_match_bowling_scorecard bs ON bs.match_player_id = mp.id
                 WHERE mp.user_id = ? AND (sc.id IS NOT NULL OR bs.id IS NOT NULL)
                 ORDER BY m.match_date DESC
                 LIMIT 10`,
                [user.id]
            );

            recentScores = recScores.map((score) => {
                const runs = score.runs !== null ? Number(score.runs) : null;
                const balls = score.balls !== null ? Number(score.balls) : null;
                const sr = balls && balls > 0 ? ((runs / balls) * 100).toFixed(2) : (score.strike_rate ? Number(score.strike_rate).toFixed(2) : null);
                const dismissalText = score.runs !== null ? formatDismissal(score.dismissal_type, score.bowler_name, score.fielder_name) : null;

                const overs = score.overs !== null ? Number(score.overs) : null;
                const runsConceded = score.runs_conceded !== null ? Number(score.runs_conceded) : null;
                const econ = overs && overs > 0 ? (runsConceded / overs).toFixed(2) : (score.economy ? Number(score.economy).toFixed(2) : null);

                // Find fielding for this match
                const fMatch = (typeof fieldingByMatch !== "undefined" && fieldingByMatch.get(score.match_id)) || [];
                let ct = 0, ro = 0, st = 0;
                for (const f of fMatch) {
                    const dt = String(f.dismissal_type || "").toLowerCase();
                    if (dt.includes("caught") || dt === "c" || dt === "c & b") ct++;
                    else if (dt.includes("run out")) ro++;
                    else if (dt.includes("stump")) st++;
                }

                return {
                    ...score,
                    runs,
                    balls,
                    fours: score.fours !== null ? Number(score.fours) : null,
                    sixes: score.sixes !== null ? Number(score.sixes) : null,
                    strike_rate: sr,
                    dismissal_text: dismissalText,
                    overs: overs !== null ? overs.toFixed(1) : null,
                    maidens: score.maidens !== null ? Number(score.maidens) : null,
                    runs_conceded: runsConceded,
                    wickets: score.wickets !== null ? Number(score.wickets) : null,
                    wides: score.wides !== null ? Number(score.wides) : 0,
                    no_balls: score.no_balls !== null ? Number(score.no_balls) : 0,
                    economy: econ,
                    catches: ct,
                    run_outs: ro,
                    stumpings: st,
                    total_fielding: ct + ro + st,
                };
            });
        } catch (perfErr) {
            console.warn("Error fetching performance stats:", perfErr.message);
        }

        const totalRuns = Number(batting.total_runs || 0);
        const totalBalls = Number(batting.total_balls || 0);
        const timesOut = Number(batting.times_out || 0);
        const battingAverage = timesOut > 0 ? (totalRuns / timesOut).toFixed(2) : totalRuns.toString();
        const strikeRate = totalBalls > 0 ? ((totalRuns / totalBalls) * 100).toFixed(2) : "0.00";

        const totalOvers = Number(bowling.total_overs || 0);
        const totalWickets = Number(bowling.total_wickets || 0);
        const totalRunsConceded = Number(bowling.total_runs_conceded || 0);
        const economy = totalOvers > 0 ? (totalRunsConceded / totalOvers).toFixed(2) : "0.00";
        const bowlingAverage = totalWickets > 0 ? (totalRunsConceded / totalWickets).toFixed(2) : "—";

        const totalCatches = Number(fielding.total_catches || 0);
        const totalRunOuts = Number(fielding.total_run_outs || 0);
        const totalStumpings = Number(fielding.total_stumpings || 0);
        const totalFieldDismissals = totalCatches + totalRunOuts + totalStumpings;

        return NextResponse.json({
            success: true,
            data: {
                user,
                admission,
                programs,
                feeCalendar: {
                    year: selectedYear,
                    months: feeCalendar,
                    summary: {
                        total_fee: feeCalendar.reduce((sum, m) => sum + m.fee_amount, 0),
                        total_paid: feeCalendar.reduce((sum, m) => sum + m.paid_amount, 0),
                        total_due: feeCalendar.reduce((sum, m) => sum + m.due_amount, 0),
                    },
                },
                teams: allEnrolledTeams,
                enrolledMatches,
                enrolledTournaments,
                liveMatches,
                upcomingMatches,
                upcomingTournaments,
                matchAndTournamentFees,
                performance: {
                    batting: {
                        matches: enrolledMatches.length,
                        innings: Number(batting.innings || 0),
                        runs: totalRuns,
                        balls: totalBalls,
                        fours: Number(batting.fours || 0),
                        sixes: Number(batting.sixes || 0),
                        highest_score: Number(batting.highest_score || 0),
                        average: battingAverage,
                        strike_rate: strikeRate,
                        fifties: Number(batting.fifties || 0),
                        hundreds: Number(batting.hundreds || 0),
                    },
                    bowling: {
                        overs: totalOvers,
                        maidens: Number(bowling.total_maidens || 0),
                        wickets: totalWickets,
                        runs_conceded: totalRunsConceded,
                        best_wickets: Number(bowling.best_wickets || 0),
                        economy: economy,
                        average: bowlingAverage,
                    },
                    fielding: {
                        catches: totalCatches,
                        run_outs: totalRunOuts,
                        stumpings: totalStumpings,
                        total_dismissals: totalFieldDismissals,
                    },
                    recentScores,
                },
                playerOptions,
                isStaffView: Boolean(isStaff),
                adminRole: adminRoleLabel,
                scopeTitle: scopeTitle,
            },
        });
    } catch (error) {
        console.error("Error in player dashboard API:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to load player dashboard" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
