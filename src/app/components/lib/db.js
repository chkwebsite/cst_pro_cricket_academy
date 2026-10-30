import mysql from 'mysql2/promise';

const isRemoteHost =
    process.env.DB_HOST &&
    !['localhost', '127.0.0.1'].includes(process.env.DB_HOST.trim().toLowerCase());

const useSsl =
    process.env.DB_SSL === 'true' ||
    process.env.DB_SSL === '1' ||
    (isRemoteHost && process.env.DB_SSL !== 'false');

// Cache pool globally across Next.js dev reloads to prevent connection exhaustion
const globalForDb = globalThis;

if (!globalForDb._mysqlPool) {
    globalForDb._mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_NAME || process.env.DB_DATABASE || '',
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 15,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        dateStrings: true,
        connectTimeout: 15000,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
}

const pool = globalForDb._mysqlPool;

export default pool;
