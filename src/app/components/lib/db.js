import mysql from 'mysql2/promise';

const isRemoteHost =
    process.env.DB_HOST &&
    !['localhost', '127.0.0.1'].includes(process.env.DB_HOST.trim().toLowerCase());

const useSsl =
    process.env.DB_SSL === 'true' ||
    process.env.DB_SSL === '1' ||
    (isRemoteHost && process.env.DB_SSL !== 'false');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || process.env.DB_DATABASE || '',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 2,
    queueLimit: 0,
    dateStrings: true,
    connectTimeout: 10000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});


export default pool;
