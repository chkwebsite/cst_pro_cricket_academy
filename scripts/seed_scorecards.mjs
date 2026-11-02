import pool from "../src/app/components/lib/db.js";

async function main() {
    console.log("=== SEEDING MATCH SCORECARDS & BOWLING SCORECARDS ===");
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Get Match 2 or any match with players
        const [matches] = await connection.query("SELECT id, team_a_id, team_b_id FROM cst_matches");
        for (const m of matches) {
            // Check or create innings
            const [innings] = await connection.query("SELECT id, innings_no FROM cst_match_innings WHERE match_id = ?", [m.id]);
            let inn1Id, inn2Id;

            if (innings.length === 0) {
                const [i1] = await connection.query(
                    `INSERT INTO cst_match_innings (match_id, innings_no, batting_team_id, bowling_team_id, total_runs, total_wickets, total_overs, total_balls, extras, innings_status, created_at)
                     VALUES (?, 1, ?, ?, 165, 5, 20.0, 120, 10, 'Completed', NOW())`,
                    [m.id, m.team_a_id, m.team_b_id]
                );
                inn1Id = i1.insertId;

                const [i2] = await connection.query(
                    `INSERT INTO cst_match_innings (match_id, innings_no, batting_team_id, bowling_team_id, total_runs, total_wickets, total_overs, total_balls, extras, target_runs, innings_status, created_at)
                     VALUES (?, 2, ?, ?, 166, 4, 19.2, 116, 6, 166, 'Completed', NOW())`,
                    [m.id, m.team_b_id, m.team_a_id]
                );
                inn2Id = i2.insertId;
            } else {
                inn1Id = innings[0].id;
                inn2Id = innings[1]?.id || inn1Id;
            }

            // Ensure match has players for both teams
            const [existingMPs] = await connection.query("SELECT id, team_id FROM cst_match_players WHERE match_id = ?", [m.id]);
            let mps = existingMPs;

            if (mps.length === 0) {
                // Fetch admission players / users to add as match players
                const [users] = await connection.query("SELECT id FROM cst_users WHERE user_type = 'Player' LIMIT 6");
                for (let i = 0; i < users.length; i++) {
                    const u = users[i];
                    const tId = i % 2 === 0 ? m.team_a_id : m.team_b_id;
                    const [res] = await connection.query(
                        `INSERT INTO cst_match_players (match_id, team_id, user_id, jersey_no, playing_11, captain, wicket_keeper, player_fee, paid_amount, payment_status, status, created_at)
                         VALUES (?, ?, ?, ?, 1, ?, 0, 500.00, 500.00, 'Paid', 1, NOW())`,
                        [m.id, tId, u.id, String(10 + i), i === 0 ? 1 : 0]
                    );
                    mps.push({ id: res.insertId, team_id: tId });
                }
            }

            // Seed batting scorecards
            for (let i = 0; i < mps.length; i++) {
                const mp = mps[i];
                const [sc] = await connection.query("SELECT id FROM cst_match_scorecard WHERE match_id = ? AND match_player_id = ?", [m.id, mp.id]);
                const targetInnings = mp.team_id === m.team_a_id ? inn1Id : inn2Id;

                if (sc.length === 0) {
                    const runs = 25 + (i * 12);
                    const balls = runs - 2;
                    const fours = Math.floor(runs / 7);
                    const sixes = Math.floor(runs / 15);
                    const sr = ((runs / balls) * 100).toFixed(2);
                    const dismissal = i % 2 === 0 ? "Caught" : "Not Out";

                    await connection.query(
                        `INSERT INTO cst_match_scorecard (match_id, innings_id, match_player_id, batting_position, runs, balls, fours, sixes, strike_rate, dismissal_type, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                        [m.id, targetInnings, mp.id, i + 1, runs, balls, fours, sixes, sr, dismissal]
                    );
                }

                // Seed bowling scorecards
                const [bsc] = await connection.query("SELECT id FROM cst_match_bowling_scorecard WHERE match_id = ? AND match_player_id = ?", [m.id, mp.id]);
                if (bsc.length === 0 && i < 4) {
                    const oppInnings = targetInnings === inn1Id ? inn2Id : inn1Id;
                    await connection.query(
                        `INSERT INTO cst_match_bowling_scorecard (match_id, innings_id, match_player_id, overs, balls_bowled, maidens, runs_conceded, wickets, economy, created_at)
                         VALUES (?, ?, ?, 4.0, 24, 1, 24, 2, 6.00, NOW())`,
                        [m.id, oppInnings, mp.id]
                    );
                }
            }
        }

        await connection.commit();
        console.log("=== SCORECARDS SEEDED SUCCESSFULLY ===");
    } catch (err) {
        await connection.rollback();
        console.error("Scorecards seed error:", err);
    } finally {
        connection.release();
        await pool.end();
        process.exit(0);
    }
}

main();
