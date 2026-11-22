import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'mysql-9490c4b-chandankeshri100-fdcb.b.aivencloud.com',
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    port: Number(process.env.DB_PORT) || 22222,
    ssl: { rejectUnauthorized: false }
});

const conn = await pool.getConnection();

// Check fee status dangling with user_id IS NOT NULL
const [fsDangling] = await conn.query(`
    SELECT fs.id, fs.user_id
    FROM cst_fee_status fs
    LEFT JOIN cst_users u ON fs.user_id = u.id
    WHERE fs.user_id IS NOT NULL AND u.id IS NULL
`);
console.log('fs with user_id dangling:', fsDangling.length);

// Check user branches with user_id IS NOT NULL and branch_id against cst_branch
const [ubDangling] = await conn.query(`
    SELECT ub.id, ub.user_id, ub.branch_id
    FROM cst_user_branches ub
    LEFT JOIN cst_users u ON ub.user_id = u.id
    LEFT JOIN cst_branch b ON ub.branch_id = b.id
    WHERE (ub.user_id IS NOT NULL AND u.id IS NULL)
       OR (ub.branch_id IS NOT NULL AND b.id IS NULL)
`);
console.log('ub with user_id or branch_id dangling:', ubDangling.length);

await conn.release();
await pool.end();
