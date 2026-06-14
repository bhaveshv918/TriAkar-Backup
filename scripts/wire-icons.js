// Idempotently add SVG favicon + apple-touch-icon + manifest + theme-color
// to every page that has the legacy favicon block but is missing them.
// Run: node scripts/wire-icons.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ANCHOR = '<link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png">';
const ADD =
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg">' +
  '<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">' +
  '<link rel="manifest" href="/manifest.json">' +
  '<meta name="theme-color" content="#FAF9F6">';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.claude') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0, skipped = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes(ANCHOR)) continue;
  if (html.includes('rel="manifest"')) { skipped++; continue; }
  html = html.replace(ANCHOR, ANCHOR + ADD);
  fs.writeFileSync(file, html);
  changed++;
  console.log('wired', path.relative(ROOT, file));
}
console.log(`\ndone — ${changed} updated, ${skipped} already wired`);
