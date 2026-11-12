import fs from 'fs';
import path from 'path';

function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            results = results.concat(getFiles(full));
        } else if (file.startsWith('route.') && (file.endsWith('.js') || file.endsWith('.jsx'))) {
            results.push(full);
        }
    });
    return results;
}

const files = getFiles('src/app/api');
console.log(`Auditing ${files.length} API route files...`);

const issues = [];

for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(process.cwd(), file);

    // 1. Check for un-awaited params (Next.js 15+ / 16 requires await params)
    const paramsSyncMatch = code.match(/function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\{\s*params\s*\}[^)]*\)\s*\{([^}]*)\}/gs);
    if (paramsSyncMatch) {
        for (const block of paramsSyncMatch) {
            if (block.includes('params.') && !block.includes('await params') && !block.includes('Promise.resolve(params)')) {
                issues.push({ file: relPath, type: 'SYNC_PARAMS', desc: 'Direct property access on un-awaited params' });
            }
        }
    }

    // 2. Check for password exposure in SQL queries
    if (/SELECT\s+\*\s+FROM\s+cst_users/i.test(code)) {
        issues.push({ file: relPath, type: 'PASSWORD_EXPOSURE', desc: 'SELECT * FROM cst_users may expose password hashes' });
    }

    // 3. Check for SQL string concatenation (SQL injection vulnerability)
    const sqlConcat = code.match(/query\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g);
    if (sqlConcat) {
        for (const sc of sqlConcat) {
            // Check if interpolation is not just table name or limit/offset
            if (!sc.includes('${tableName}') && !sc.includes('${whereSql}') && !sc.includes('${limit}') && !sc.includes('${offset}') && !sc.includes('${sortSql}')) {
                issues.push({ file: relPath, type: 'SQL_INJECTION_RISK', desc: `Possible SQL string interpolation: ${sc.slice(0, 60)}...` });
            }
        }
    }

    // 4. Check for connection leak (getConnection without try/finally release)
    if (code.includes('pool.getConnection()') && !code.includes('connection.release()') && !code.includes('conn.release()')) {
        issues.push({ file: relPath, type: 'CONNECTION_LEAK', desc: 'pool.getConnection() called without connection.release()' });
    }
}

console.log(`Total issues identified: ${issues.length}`);
console.table(issues);
