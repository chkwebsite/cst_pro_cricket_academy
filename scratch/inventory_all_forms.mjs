import fs from 'fs';
import path from 'path';

const panelDir = path.resolve('src/app/next_panel');

function findFiles(dir) {
    let files = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (!['node_modules', '.next'].includes(item.name)) {
                files = files.concat(findFiles(full));
            }
        } else if (item.name.endsWith('.jsx') || item.name.endsWith('.js')) {
            files.push(full);
        }
    }
    return files;
}

const allFiles = findFiles(panelDir);

// Filter files that are Form components or pages with forms
const forms = [];

for (const file of allFiles) {
    const rel = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf8');

    // A file is considered a form if:
    // 1. It ends with 'Form.jsx'
    // 2. OR it contains <form
    // 3. OR it has inputs and handles submission (e.g. modal forms or direct page forms)
    const isFormFile = path.basename(file).endsWith('Form.jsx') || 
                       /<form[\s>]/.test(content) || 
                       (/handleSubmit|onSubmit|saveData|handleCreate|handleUpdate/i.test(content) && /<input\b|<select\b|<textarea\b/i.test(content));

    if (isFormFile) {
        // extract API endpoints called: fetch('/api/...')
        const apiMatches = [...content.matchAll(/fetch\(\s*[`'"](\/api\/[^`'"?]+)/g)].map(m => m[1]);
        const uniqueApis = [...new Set(apiMatches)];
        
        // Count inputs
        const inputs = [...content.matchAll(/<input[^>]+name=["']([^"']+)["']/g)].map(m => m[1]);
        const selects = [...content.matchAll(/<select[^>]+name=["']([^"']+)["']/g)].map(m => m[1]);
        const textareas = [...content.matchAll(/<textarea[^>]+name=["']([^"']+)["']/g)].map(m => m[1]);

        forms.push({
            file: rel,
            name: path.basename(file),
            apis: uniqueApis,
            fields: [...new Set([...inputs, ...selects, ...textareas])],
            hasOptional: /\(?optional\)?/i.test(content),
            hasAsterisk: /\*/.test(content)
        });
    }
}

console.log(`Found ${forms.length} form files across next_panel:\n`);
forms.forEach((f, idx) => {
    console.log(`${idx + 1}. ${f.file} -> APIs: [${f.apis.join(', ')}] Fields count: ${f.fields.length}`);
});

fs.writeFileSync('scratch/forms_inventory.json', JSON.stringify(forms, null, 2));
