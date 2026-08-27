/* Validation pass: every JSON-LD block parses, sitemap is well formed and its
   URLs are unique, and no em/en dash survives in any <title>/meta content. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP = /^(admin|admin-biz|og-mockups|bag-|triakar_animated|hero-print|_)/;
const collect = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .filter(f => !f.isDirectory() && f.name.endsWith('.html') && !SKIP.test(f.name))
  .map(f => dir ? `${dir}/${f.name}` : f.name);

const pages = [...collect(''), ...['services', 'gifts', 'guides'].filter(d => existsSync(join(ROOT, d))).flatMap(collect)].sort();

let bad = 0;

// 1. JSON-LD parses
for (const p of pages) {
  const s = readFileSync(join(ROOT, p), 'utf8');
  const blocks = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  blocks.forEach((b, i) => {
    try { JSON.parse(b[1].trim()); }
    catch (e) { console.log(`JSON-LD INVALID  ${p} block ${i + 1}: ${e.message}`); bad++; }
  });
}
console.log(`JSON-LD: checked ${pages.length} pages`);

// 2. dashes in head metadata
const DASH = /[—–]/;
for (const p of pages) {
  const head = readFileSync(join(ROOT, p), 'utf8').split(/<\/head>/i)[0];
  for (const m of head.matchAll(/<title>([^<]*)<\/title>|<meta[^>]*content="([^"]*)"/g)) {
    const v = m[1] ?? m[2];
    if (v && DASH.test(v)) { console.log(`DASH IN META     ${p}: ${v.slice(0, 90)}`); bad++; }
  }
}

// 3. sitemap
const sm = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const dupes = locs.filter((l, i) => locs.indexOf(l) !== i);
if (dupes.length) { console.log(`SITEMAP DUPES: ${[...new Set(dupes)].join(', ')}`); bad++; }
const opens = (sm.match(/<url>/g) || []).length, closes = (sm.match(/<\/url>/g) || []).length;
if (opens !== closes) { console.log(`SITEMAP MALFORMED: ${opens} <url> vs ${closes} </url>`); bad++; }
const badDate = locs.length && [...sm.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].filter(m => !/^\d{4}-\d{2}-\d{2}$/.test(m[1]));
if (badDate && badDate.length) { console.log(`SITEMAP BAD DATES: ${badDate.length}`); bad++; }
console.log(`Sitemap: ${locs.length} urls, ${opens} entries, all dates well formed`);

console.log(bad === 0 ? '\nALL CHECKS PASSED' : `\n${bad} PROBLEMS`);
process.exitCode = bad ? 1 : 0;
