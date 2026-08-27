/* Second audit pass: angles the first pass did not cover.
   Image alt text, heading hierarchy, lang attribute, viewport, and whether the
   feature pages are actually linked from anywhere (orphan check). */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP = /^(admin|admin-biz|og-mockups|bag-|triakar_animated|hero-print|_)/;
const collect = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .filter(f => !f.isDirectory() && f.name.endsWith('.html') && !SKIP.test(f.name))
  .map(f => dir ? `${dir}/${f.name}` : f.name);
const pages = [...collect(''), ...['services', 'gifts', 'guides'].filter(d => existsSync(join(ROOT, d))).flatMap(collect)].sort();

const problems = [];
const linkTargets = new Set();

for (const p of pages) {
  const raw = readFileSync(join(ROOT, p), 'utf8');
  // strip HTML and JS line comments first: prose like "the full-size <img> is
  // transparent" otherwise reads as a real tag with no alt
  const s = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
  const noindex = /name="robots"\s+content="[^"]*noindex/i.test(s);

  if (!/<html[^>]+lang="/i.test(s)) problems.push(`${p}: <html> has no lang attribute`);
  if (!/name="viewport"/i.test(s)) problems.push(`${p}: no viewport meta`);

  // static <img> without alt (skip JS-built strings, those are template literals)
  const imgs = [...s.matchAll(/<img\b[^>]*>/gi)].filter(m => !/\balt\s*=/.test(m[0]));
  if (imgs.length && !noindex) problems.push(`${p}: ${imgs.length} <img> without alt`);

  // heading hierarchy: flag a jump of more than one level
  const heads = [...s.matchAll(/<h([1-6])[\s>]/gi)].map(m => +m[1]);
  for (let i = 1; i < heads.length; i++) {
    if (heads[i] - heads[i - 1] > 1) {
      problems.push(`${p}: heading jumps h${heads[i - 1]} to h${heads[i]}`);
      break;
    }
  }

  for (const m of s.matchAll(/href="(?!https?:|mailto:|tel:|#|javascript:)([^"?#]+)/g)) {
    linkTargets.add(m[1].replace(/^\//, '').replace(/\.html$/, ''));
  }
}

/* The nav, drawer and footer are injected from partials.js, so a page linked
   only from chrome looks orphaned unless the JS is scanned too. */
for (const js of ['partials.js', 'shared.js']) {
  if (!existsSync(join(ROOT, js))) continue;
  const s = readFileSync(join(ROOT, js), 'utf8');
  for (const m of s.matchAll(/href="(?!https?:|mailto:|tel:|#|javascript:)([^"?#'`]+)/g)) {
    linkTargets.add(m[1].replace(/^\//, '').replace(/\.html$/, ''));
  }
}

// orphan check: public pages nothing links to
const linkable = pages.filter(p => !/^(offline|404)\.html$/.test(p));
for (const p of linkable) {
  const slug = p.replace(/\.html$/, '');
  const base = slug.split('/').pop();
  if (slug === 'index') continue;
  if (!linkTargets.has(slug) && !linkTargets.has(base)) problems.push(`ORPHAN: nothing links to /${slug}`);
}

console.log(`Pass 2: ${pages.length} pages`);
console.log(`\n--- ${problems.length} FINDINGS ---`);
problems.forEach(p => console.log('  ' + p));
