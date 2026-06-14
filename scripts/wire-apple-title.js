// Idempotently add apple-mobile-web-app-title (+capable) after the theme-color
// meta on every page that already has the favicon wiring. Run once.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ANCHOR = '<meta name="theme-color" content="#FAF9F6">';
const ADD =
  '<meta name="apple-mobile-web-app-title" content="TriAkar">' +
  '<meta name="apple-mobile-web-app-capable" content="yes">' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.claude') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes(ANCHOR)) continue;
  if (html.includes('apple-mobile-web-app-title')) continue;
  html = html.replace(ANCHOR, ANCHOR + ADD);
  fs.writeFileSync(file, html);
  changed++;
  console.log('updated', path.relative(ROOT, file));
}
console.log(`\ndone — ${changed} updated`);
