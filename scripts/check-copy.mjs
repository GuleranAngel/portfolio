// Fails the build if any em dash (or en dash used as punctuation) slips into the published copy.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BAD = [
  { ch: '—', name: 'em dash' },
  { ch: '–', name: 'en dash' },
];

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(html|xml|txt|json|webmanifest)$/.test(e.name)) yield p;
  }
}

let problems = 0;
for await (const file of walk(DIST)) {
  const text = await readFile(file, 'utf8');
  // Strip scripts and styles: only visible copy and metadata matter
  const copy = text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for (const { ch, name } of BAD) {
    let i = copy.indexOf(ch);
    while (i !== -1) {
      problems++;
      const ctx = copy.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, ' ');
      console.error(`${file.replace(DIST, 'dist/')}: ${name} in "...${ctx}..."`);
      i = copy.indexOf(ch, i + 1);
    }
  }
}
if (problems) {
  console.error(`\ncheck-copy: ${problems} dash problem(s). Replace them with a comma, colon, full stop or hyphen.`);
  process.exit(1);
}
console.log('check-copy: no em or en dashes in the published copy.');
