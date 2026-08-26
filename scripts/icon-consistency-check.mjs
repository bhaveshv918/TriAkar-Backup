/* Runs the icon set and NAV_CONFIG straight out of admin-biz.html, so the check is against
   the file on disk rather than whatever the preview's service worker is still serving. */
import { readFile } from 'node:fs/promises';

const src = await readFile('admin-biz.html', 'utf8');

const grab = (startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error('block not found: ' + startMarker);
  return src.slice(a, b);
};

const icons = grab('const NAV_ICON_PATHS={', 'const ICO_VIEW=');
const nav = grab('const NAV_CONFIG = [', '\n// ── Header nav');

const { NAV_ICON_PATHS, navIcon, NAV_CONFIG } = new Function(
  icons + '\n' + nav + '\n; return {NAV_ICON_PATHS, navIcon, NAV_CONFIG};')();

let fails = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) fails++;
  console.log('  %s %s%s', cond ? 'PASS' : 'FAIL', label, extra ? '  ' + extra : '');
};

const items = NAV_CONFIG.flatMap(s => s.items);
console.log('icons defined: %d   nav items: %d\n', Object.keys(NAV_ICON_PATHS).length, items.length);

console.log('every nav icon is one system');
ok('all render as <svg>', items.every(i => /^<svg /.test(String(i.icon || ''))),
   items.filter(i => !/^<svg /.test(String(i.icon || ''))).map(i => i.id).join(',') || '');
ok('no emoji left anywhere',
   !items.some(i => /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(String(i.icon || ''))));
ok('none hardcodes a colour',
   !items.some(i => /(fill|stroke)="(#|rgb)/.test(String(i.icon || ''))));
ok('all inherit currentColor', items.every(i => String(i.icon).includes('stroke="currentColor"')));
ok('all share one viewBox', items.every(i => String(i.icon).includes('viewBox="0 0 24 24"')));
ok('all share one stroke width', items.every(i => String(i.icon).includes('stroke-width="1.9"')));
ok('all marked aria-hidden', items.every(i => String(i.icon).includes('aria-hidden="true"')));

console.log('\nhelper behaviour');
ok('unknown name returns empty, not "undefined"', navIcon('nope') === '');
ok('size is settable', navIcon('globe', 16).includes('width="16"'));
ok('defaults to 15', navIcon('globe').includes('width="15"'));

console.log('\nevery item got a distinct, sensible icon');
const used = items.map(i => {
  const m = String(i.icon).match(/aria-hidden="true">(.*)<\/svg>/s);
  return m ? m[1] : '';
});
ok('no item left with an empty icon', used.every(Boolean));
const byPath = new Map();
used.forEach((d, n) => byPath.set(d, (byPath.get(d) || []).concat(items[n].id)));
const dupes = [...byPath.values()].filter(v => v.length > 1);
console.log('  note: shared icons (fine if intentional):', dupes.map(d => d.join('+')).join(', ') || 'none');

// Every path must actually be drawable: SVG child elements only, nothing stray.
console.log('\npaths are well formed');
const badPath = Object.entries(NAV_ICON_PATHS).filter(([, d]) =>
  !/^(<(path|line|circle|rect|polyline|polygon)\b[^>]*\/>)+$/.test(d));
ok('all paths are self-closing svg primitives', badPath.length === 0,
   badPath.map(([k]) => k).join(',') || '');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall icon checks passed');
process.exit(fails ? 1 : 0);
