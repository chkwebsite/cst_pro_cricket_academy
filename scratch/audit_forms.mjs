import fs from 'fs';
import path from 'path';

const panelDir = path.resolve('src/app/next_panel');

function findFiles(dir, exts = ['.jsx', '.js']) {
    let results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (item.name !== 'node_modules' && item.name !== '.next') {
                results = results.concat(findFiles(fullPath, exts));
            }
        } else if (exts.some(ext => item.name.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

const files = findFiles(panelDir);
console.log(`Found ${files.length} js/jsx files in ${panelDir}`);

const formFiles = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const isForm = /<form\b|Form|handleSubmit|onSubmit|formData/i.test(path.basename(file)) ||
                   /<form[\s>]/i.test(content) ||
                   (/onSubmit=/i.test(content) && (/<input\b/i.test(content) || /<select\b/i.test(content)));
    
    // Check if it has input, select, textarea
    const hasInputs = /<input\b|<select\b|<textarea\b/i.test(content);
    
    // Check for "optional"
    const hasOptional = /\boptional\b/i.test(content);
    
    // Check for asterisk
    const hasAsterisk = /\*/.test(content);

    if (isForm || hasInputs) {
        formFiles.push({
            file: path.relative(process.cwd(), file),
            hasFormTag: /<form[\s>]/.test(content),
            hasInputs,
            hasOptional,
            hasAsterisk,
            baseName: path.basename(file)
        });
    }
}

console.log(`Identified ${formFiles.length} files with forms or input controls:`);
for (const f of formFiles) {
    console.log(`- ${f.file} (FormTag: ${f.hasFormTag}, Optional: ${f.hasOptional}, Asterisk: ${f.hasAsterisk})`);
}
