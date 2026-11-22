import fs from 'fs';
import path from 'path';

const panelDir = path.resolve('src/app/next_panel');

function getFiles(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!['node_modules', '.next', '.git'].includes(entry.name)) {
                results = results.concat(getFiles(full));
            }
        } else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) {
            results.push(full);
        }
    }
    return results;
}

const all = getFiles(panelDir);

const formComponents = [];
const pageForms = [];

for (const file of all) {
    const rel = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf8');

    if (file.endsWith('Form.jsx')) {
        formComponents.push({
            path: rel,
            lines: content.split('\n').length
        });
    } else if (/<form[\s>]/.test(content)) {
        pageForms.push({
            path: rel,
            lines: content.split('\n').length
        });
    }
}

console.log(`=== Form Components (${formComponents.length}) ===`);
formComponents.forEach(f => console.log(f.path));

console.log(`\n=== Pages / Modals with <form> tag (${pageForms.length}) ===`);
pageForms.forEach(f => console.log(f.path));
