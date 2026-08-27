/* One-off SEO audit over the public HTML pages.
   Reports missing/duplicate title, description, canonical, OG/Twitter tags,
   H1 count and which schema.org @types each page declares. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP = /^(admin|admin-biz|og-mockups|bag-|triakar_animated|hero-print|_)/;

function collect(dir, out = []) {
  for (const f of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (f.isDirectory()) continue;
    if (!f.name.endsWith('.html')) continue;
    if (SKIP.test(f.name)) continue;
    out.push(dir ? `${dir}/${f.name}` : f.name);
  }
  return out;
}

const pages = [
  ...collect(''),
  ...['services', 'gifts', 'guides'].filter(d => existsSync(join(ROOT, d))).flatMap(d => collect(d)),
].sort();

const one = (re, s) => { const m = s.match(re); return m ? m[1].trim() : null; };

const rows = [];
for (const p of pages) {
  const s = readFileSync(join(ROOT, p), 'utf8');
  const head = s.split(/<\/head>/i)[0] || s;
  const types = [...s.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const listTypes = [...s.matchAll(/"@type"\s*:\s*\[([^\]]+)\]/g)].map(m => m[1].replace(/"/g, ''));
  rows.push({
    page: p,
    title: one(/<title>([^<]*)<\/title>/i, head),
    desc: one(/<meta\s+name="description"\s+content="([^"]*)"/i, head),
    // canonical may carry an id (product-detail/story set it from JS), so do
    // not assume href follows rel immediately
    canonical: one(/<link\s+rel="canonical"[^>]*\shref="([^"]*)"/i, head),
    ogTitle: /property="og:title"/i.test(head),
    ogImage: /property="og:image"/i.test(head),
    twCard: /name="twitter:card"/i.test(head),
    robots: one(/<meta\s+name="robots"\s+content="([^"]*)"/i, head),
    h1: (s.match(/<h1[\s>]/gi) || []).length,
    schema: [...new Set([...types, ...listTypes])].join(','),
  });
}

const problems = [];
const seenTitle = new Map(), seenDesc = new Map();
for (const r of rows) {
  const idx = r.robots && /noindex/.test(r.robots);
  if (!r.title) problems.push(`${r.page}: NO <title>`);
  else if (r.title.length > 65) problems.push(`${r.page}: title ${r.title.length} chars (>65, truncates in SERP)`);
  if (!r.desc) problems.push(`${r.page}: NO meta description`);
  else if (r.desc.length > 165) problems.push(`${r.page}: description ${r.desc.length} chars (>165)`);
  else if (r.desc.length < 70) problems.push(`${r.page}: description only ${r.desc.length} chars (thin)`);
  if (!r.canonical && !idx) problems.push(`${r.page}: NO canonical`);
  if (!r.ogTitle && !idx) problems.push(`${r.page}: no og:title`);
  if (!r.ogImage && !idx) problems.push(`${r.page}: no og:image`);
  if (!r.twCard && !idx) problems.push(`${r.page}: no twitter:card`);
  if (r.h1 === 0 && !idx) problems.push(`${r.page}: NO <h1>`);
  if (r.h1 > 1) problems.push(`${r.page}: ${r.h1} <h1> tags (should be 1)`);
  if (r.title && !idx) { if (seenTitle.has(r.title)) problems.push(`${r.page}: DUPLICATE title with ${seenTitle.get(r.title)}`); else seenTitle.set(r.title, r.page); }
  if (r.desc && !idx) { if (seenDesc.has(r.desc)) problems.push(`${r.page}: DUPLICATE description with ${seenDesc.get(r.desc)}`); else seenDesc.set(r.desc, r.page); }
  if (r.canonical && seenTitle.size) { /* canonical dupes checked below */ }
}

const canon = new Map();
for (const r of rows) {
  if (!r.canonical) continue;
  if (canon.has(r.canonical)) problems.push(`${r.page}: shares canonical ${r.canonical} with ${canon.get(r.canonical)}`);
  else canon.set(r.canonical, r.page);
}

console.log(`Pages audited: ${rows.length}\n`);
console.log('PAGE'.padEnd(46), 'H1', 'ROBOTS'.padEnd(18), 'SCHEMA');
for (const r of rows) {
  console.log(r.page.padEnd(46), String(r.h1).padEnd(2), (r.robots || '-').padEnd(18), r.schema || '(none)');
}
console.log(`\n--- ${problems.length} PROBLEMS ---`);
problems.forEach(p => console.log('  ' + p));
