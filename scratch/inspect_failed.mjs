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

console.log('--- cst_fee_status ---');
const [fsCols] = await conn.query('DESCRIBE cst_fee_status');
console.log('Columns:', fsCols.map(c => c.Field));
const [fsAll] = await conn.query('SELECT * FROM cst_fee_status LIMIT 5');
console.log('Sample rows:', fsAll);

const [fsDangling] = await conn.query(`
    SELECT fs.*
    FROM cst_fee_status fs
    LEFT JOIN cst_users u ON fs.user_id = u.id
    WHERE u.id IS NULL
`);
console.log('fsDangling count:', fsDangling.length, fsDangling);

console.log('\n--- cst_user_branches ---');
const [ubCols] = await conn.query('DESCRIBE cst_user_branches');
console.log('Columns:', ubCols.map(c => c.Field));
const [ubAll] = await conn.query('SELECT * FROM cst_user_branches LIMIT 5');
console.log('Sample rows:', ubAll);

const [ubDangling] = await conn.query(`
    SELECT ub.*
    FROM cst_user_branches ub
    LEFT JOIN cst_users u ON ub.user_id = u.id
    LEFT JOIN cst_branches b ON ub.branch_id = b.id
    WHERE u.id IS NULL OR b.id IS NULL
`);
console.log('ubDangling count:', ubDangling.length, ubDangling);

await conn.release();
await pool.end();
