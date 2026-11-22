import fs from 'fs';
import path from 'path';

const panelDir = path.resolve('src/app/next_panel');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        walk(full, files);
      }
    } else if (/\.(jsx|js|tsx|ts)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(panelDir);
const plainAsterisks = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check if label contains plain * without text-danger
    if (/<label[^>]*>[^<]*\*[a-zA-Z0-9_\s]*<\/label>/i.test(line) && !line.includes('text-danger')) {
      plainAsterisks.push({
        file: path.relative(process.cwd(), file),
        lineNum: idx + 1,
        text: line.trim()
      });
    }
  });
}

console.log(`Found ${plainAsterisks.length} plain asterisk occurrences:`);
plainAsterisks.forEach(p => console.log(`${p.file}:${p.lineNum} -> ${p.text}`));
