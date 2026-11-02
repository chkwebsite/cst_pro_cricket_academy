import fs from 'fs';
import path from 'path';

function getFiles(dir, filter = (f) => true) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(file, filter));
        } else if (filter(file)) {
            results.push(file);
        }
    });
    return results;
}

const files = getFiles('src/app/next_panel', (f) => f.endsWith('.jsx') || f.endsWith('.js'));
const apiEndpoints = new Set();
const fetchRegex = /fetch\(\s*[`'"](\/api\/[^`'"?#\s]+)/g;

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = fetchRegex.exec(content)) !== null) {
        let endpoint = match[1];
        // normalize dynamic parts like ${id} or similar
        endpoint = endpoint.replace(/\$\{[^}]+\}/g, '[id]');
        apiEndpoints.add(endpoint);
    }
}

console.log('Detected frontend fetch endpoints:');
const sorted = Array.from(apiEndpoints).sort();
for (const ep of sorted) {
    // Check if route exists under src/app
    let routePath = path.join('src', 'app', ep, 'route.js');
    let routePathJsx = path.join('src', 'app', ep, 'route.jsx');
    let exists = fs.existsSync(routePath) || fs.existsSync(routePathJsx);
    if (!exists) {
        // Try replacing numeric segments or [id]
        const segments = ep.split('/').slice(2); // drop /api/
        let checkPath = path.join('src', 'app', 'api', ...segments, 'route.js');
        let checkPathJsx = path.join('src', 'app', 'api', ...segments, 'route.jsx');
        exists = fs.existsSync(checkPath) || fs.existsSync(checkPathJsx);
    }
    console.log(`${ep} => ${exists ? 'EXISTS' : 'NOT FOUND / MISMATCH'}`);
}
