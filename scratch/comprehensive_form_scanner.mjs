import fs from 'fs';
import path from 'path';

const panelDir = path.resolve('src/app/next_panel');

function getAllFiles(dir, exts = ['.jsx', '.js']) {
    let files = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (!['node_modules', '.next', '.git'].includes(item.name)) {
                files = files.concat(getAllFiles(fullPath, exts));
            }
        } else if (exts.some(ext => item.name.endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}

const allFiles = getAllFiles(panelDir);

// 1. Find all files with "optional" (case-insensitive)
const optionalOccurrences = [];
for (const file of allFiles) {
    const rel = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        // match (Optional), (optional), Optional in labels or text, but avoid matching variable names like `isOptional`
        if (/\(?optional\)?/i.test(line)) {
            // Check if it's in UI text / label
            if (/<label|placeholder|<span|<p|<small|text-|form-text|\(\s*optional\s*\)/i.test(line)) {
                optionalOccurrences.push({
                    file: rel,
                    lineNum: idx + 1,
                    text: line.trim()
                });
            }
        }
    });
}

console.log(`=== FOUND ${optionalOccurrences.length} OCCURRENCES OF OPTIONAL IN UI ===`);
optionalOccurrences.forEach(o => {
    console.log(`${o.file}:${o.lineNum} -> ${o.text}`);
});
