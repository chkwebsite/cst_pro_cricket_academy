import fs from 'fs';
import path from 'path';

const schema = JSON.parse(fs.readFileSync('scratch/db_schema.json', 'utf8'));

export function inspectModule(formPath, apiPath, tableName) {
    console.log(`\n========================================`);
    console.log(`MODULE: ${formPath}`);
    console.log(`API: ${apiPath}`);
    console.log(`TABLE: ${tableName}`);
    console.log(`========================================`);

    const table = schema[tableName];
    if (table) {
        console.log(`-- Table Columns (${table.columns.length}) --`);
        table.columns.forEach(c => {
            const req = c.null === 'NO' && c.default === null && c.extra !== 'auto_increment';
            console.log(`  ${c.field}: type=${c.type}, null=${c.null}, default=${c.default}, key=${c.key} ${req ? ' [REQUIRED DB]' : ''}`);
        });
    } else {
        console.log(`-- Table ${tableName} NOT FOUND in DB schema! --`);
    }

    if (fs.existsSync(formPath)) {
        const formContent = fs.readFileSync(formPath, 'utf8');
        console.log(`-- Form Inspection --`);
        const labels = [...formContent.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
        console.log(`  Labels found (${labels.length}):`, labels);
        
        const optionals = [...formContent.matchAll(/([^\n]*\(?optional\)?[^\n]*)/gi)].map(m => m[1].trim());
        console.log(`  Optional occurrences (${optionals.length}):`, optionals);

        const asterisks = [...formContent.matchAll(/([^\n]*\*[^\n]*)/g)].map(m => m[1].trim());
        console.log(`  Asterisk occurrences (${asterisks.length}):`, asterisks);
    }
}

const target = process.argv[2];
if (target) {
    const modules = JSON.parse(fs.readFileSync('scratch/modules_audit_report.json', 'utf8'));
    const found = modules.find(m => m.name.toLowerCase().includes(target.toLowerCase()) || m.formFile.toLowerCase().includes(target.toLowerCase()));
    if (found) {
        inspectModule(found.formFile, found.apiRoute, found.table);
    } else {
        console.log(`Module matching ${target} not found`);
    }
}
