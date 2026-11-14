const fs = require('fs');
const mysql = require('mysql2/promise');

const env = fs.readFileSync('.env.local', 'utf8');
const parseEnv = (key) => {
    const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim() : null;
};

const host = parseEnv('DB_HOST');
const port = parseInt(parseEnv('DB_PORT') || '3306', 10);
const user = parseEnv('DB_USER');
const password = parseEnv('DB_PASSWORD');
const database = parseEnv('DB_NAME');
const ssl = parseEnv('DB_SSL') === 'true' ? { rejectUnauthorized: false } : undefined;

(async () => {
    let conn;
    try {
        conn = await mysql.createConnection({
            host, port, user, password, database, ssl
        });

        const [colsMatches] = await conn.query('DESCRIBE cst_matches');
        console.log('cst_matches columns:', colsMatches.map(c => `${c.Field} (${c.Type})`));

        const [colsMatchTeams] = await conn.query('DESCRIBE cst_match_teams');
        console.log('cst_match_teams columns:', colsMatchTeams.map(c => `${c.Field} (${c.Type})`));

        const [colsMatchPlayers] = await conn.query('DESCRIBE cst_match_players');
        console.log('cst_match_players columns:', colsMatchPlayers.map(c => `${c.Field} (${c.Type})`));

        const [matches] = await conn.query('SELECT * FROM cst_matches LIMIT 3');
        console.log('Matches count:', matches.length);
        if (matches.length) console.log('Sample match:', matches[0]);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        if (conn) await conn.end();
    }
})();
