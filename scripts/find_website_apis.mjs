import fs from 'fs';
import path from 'path';

function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            results = results.concat(getFiles(full));
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(full);
        }
    });
    return results;
}

const files = getFiles('src/app/(website)');
const apis = new Set();
const regex = /fetch\(\s*[`'"](\/api\/[^`'"?#\s]+)/g;

for (const f of files) {
    const code = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = regex.exec(code)) !== null) {
        apis.add(m[1]);
    }
}

console.log('Website called APIs:', Array.from(apis).sort());
