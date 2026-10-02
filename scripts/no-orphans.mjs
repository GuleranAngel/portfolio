// No orphans: joins the last two words of every heading, paragraph, list item and caption
// with a non-breaking space, so a single word never sits alone on the last line.
// CSS text-wrap: balance / pretty does this in modern browsers; this is the fallback for the rest.
// Runs on the built HTML in dist/ after `astro build`.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

const DIST = new URL('../dist/', import.meta.url).pathname;
const TARGETS = 'h1, h2, h3, h4, h5, h6, p, li, dd, dt, blockquote, figcaption, figcaption > span, .val, span.d-only, span.m-only';
const SKIP = new Set(['script', 'style', 'svg', 'pre', 'code', 'textarea', 'noscript']);
const NBSP = ' ';
const BREAK = Symbol('br');

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

// Text nodes of an element in reading order, with <br> marked as a hard break
function textNodes(el, out = []) {
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out.push(n);
    else if (n.nodeType === 1) {
      const tag = n.rawTagName?.toLowerCase();
      if (tag === 'br') out.push(BREAK);
      else if (!SKIP.has(tag)) textNodes(n, out);
    }
  }
  return out;
}

function joinLastTwo(el, html, edits) {
  const nodes = textNodes(el);
  // Walk backwards: skip trailing whitespace, then the last word, then find the space before it
  let seenWord = false;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n === BREAK) return false; // the last line is already a forced break
    const t = n.rawText;
    for (let j = t.length - 1; j >= 0; j--) {
      const c = t[j];
      const isSpace = c === ' ' || c === '\n' || c === '\t';
      if (!isSpace) { seenWord = true; continue; }
      if (!seenWord) continue; // trailing whitespace
      // Found the gap before the last word. Collapse it into one non-breaking space.
      let k = j;
      while (k > 0 && (t[k - 1] === ' ' || t[k - 1] === '\n' || t[k - 1] === '\t')) k--;
      if (k === 0 && i === 0) return false; // only one word
      // Edit the original source in place (no re-serialising, so the rest of the HTML stays byte-identical)
      const [start, end] = n.range ?? [];
      if (start === undefined || html.slice(start, end) !== t) return false;
      edits.push({ from: start + k, to: start + j + 1 });
      return true;
    }
  }
  return false;
}

let changed = 0;
for await (const file of walk(DIST)) {
  const html = await readFile(file, 'utf8');
  const root = parse(html, { comment: true, blockTextElements: { script: true, noscript: true, style: true, pre: true } });
  const targets = root.querySelectorAll(TARGETS);
  const edits = [];
  for (const el of targets) {
    // A block that contains another target is handled through that child
    if (el.querySelectorAll(TARGETS).length) continue;
    if (joinLastTwo(el, html, edits)) changed++;
  }
  let out = html;
  for (const e of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + NBSP + out.slice(e.to);
  await writeFile(file, out);
}
console.log(`no-orphans: joined the last two words in ${changed} text blocks.`);
