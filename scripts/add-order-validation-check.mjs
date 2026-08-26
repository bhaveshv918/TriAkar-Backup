/* Exercises the new Add Order validator, the shortcut map and the Website Orders header
   against the file on disk. The preview's service worker keeps serving a cached page, so
   the source is pulled out and run directly, which also means a mistake in the page fails
   here rather than passing on stale code. */
import { readFile } from 'node:fs/promises';
const src = await readFile('admin-biz.html', 'utf8');

let fails = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) fails++;
  console.log('  %s %s%s', cond ? 'PASS' : 'FAIL', label, extra ? '  ' + extra : '');
};

// ── 1. Shortcuts ──────────────────────────────────────────────────────────────────
// NAV_CONFIG is not the whole story: Task is unshifted into the list at runtime and holds
// its own key. Scanning only NAV_CONFIG is what let Products and Task both claim T, so the
// scan covers every `shortcut:` in the file, wherever it is declared.
const a = src.indexOf('const NAV_CONFIG = [');
const b = src.indexOf('\n];', a);
const NAV_CONFIG = new Function(src.slice(a, b + 3) + '\nreturn NAV_CONFIG;')();

const keys = {};
const claim = (id, shortcut) => {
  if (!shortcut) return;
  for (const k of shortcut.split('/')) (keys[k] ||= []).push(id);
};
for (const sec of NAV_CONFIG) for (const it of sec.items) claim(it.id, it.shortcut);

// Anything declaring a shortcut outside NAV_CONFIG, e.g. the injected Task entry.
for (const m of src.matchAll(/\{\s*id:\s*'([a-z]+)'\s*,[^}]*?shortcut:\s*'([^']+)'/g)) {
  const [, id, key] = m;
  if (NAV_CONFIG.some(sec => sec.items.some(it => it.id === id && it.shortcut))) continue;
  claim(id, key);
}

// R drives the header refresh button, so no destination may take it.
const RESERVED = { r: 'refresh' };

console.log('shortcuts');
ok('Website Orders is W', keys['w']?.length === 1 && keys['w'][0] === 'weborders',
   JSON.stringify(keys['w'] || null));
ok('Task keeps T', keys['t']?.length === 1 && keys['t'][0] === 'openorders',
   JSON.stringify(keys['t'] || null));
ok('Products claims no key', !Object.values(keys).some(v => v.includes('products')));
ok('R stays free for refresh', !keys['r']);
ok('nothing claims a reserved key', !Object.keys(RESERVED).some(k => keys[k]));
ok('no key claimed twice', Object.values(keys).every(v => v.length === 1),
   JSON.stringify(Object.entries(keys).filter(([, v]) => v.length > 1)));

// ── 2. Add Order validation ───────────────────────────────────────────────────────
const grab = (from, to) => {
  const i = src.indexOf(from), j = src.indexOf(to, i);
  return src.slice(i, j);
};
const vsrc = grab('let _qaProblems=[];', 'function flagInvalidFields(formId){');

// Stub the page globals the validator reaches for.
const harness = `
  let _items=[];
  const esc=x=>String(x==null?'':x);
  function flagInvalidFields(){ return (globalThis.__missing||[]); }
  // The real renderQaProblems/qaJumpToProblem are pulled in below and touch the DOM, so a
  // minimal document keeps them running headlessly instead of being stubbed away, which
  // would stop the test exercising the code that actually ships.
  const document={ getElementById:()=>null, querySelector:()=>null };
  ${vsrc}
  return { set:v=>{_items=v;}, qaItemProblems, qaValidate, get:()=>_qaProblems };
`;
const V = new Function(harness)();

console.log('\nAdd Order validation');
globalThis.__missing = [];

V.set([{ itemType: 'product', name: '', qty: 1, rate: 100 }]);
V.qaValidate();
ok('unnamed item is caught', V.get().some(p => /needs a name/.test(p.msg)), JSON.stringify(V.get().map(p => p.msg)));

V.set([{ itemType: 'spool', spoolSaleId: null, qty: 1, rate: 100 }]);
V.qaValidate();
ok('spool line with no spool caught', V.get().some(p => /pick which spool/.test(p.msg)));

V.set([{ itemType: 'product', name: 'Planter', qty: 0, rate: 100 }]);
V.qaValidate();
ok('zero quantity caught', V.get().some(p => /quantity must be at least 1/.test(p.msg)));

V.set([{ itemType: 'product', name: 'Planter', qty: 1, rate: 0 }]);
V.qaValidate();
ok('a free line is allowed', !V.get().some(p => /needs a rate/.test(p.msg)));

V.set([{ itemType: 'product', name: 'Planter', qty: 1, rate: '' }]);
V.qaValidate();
ok('blank rate caught', V.get().some(p => /needs a rate/.test(p.msg)));

V.set([]);
V.qaValidate();
ok('empty item list caught', V.get().some(p => /Add at least one item/.test(p.msg)));

V.set([{ itemType: 'product', name: 'Planter', qty: 2, rate: 500 }]);
ok('a good order passes', V.qaValidate() === true, JSON.stringify(V.get().map(p => p.msg)));

// Several problems at once should all be listed, not just the first.
V.set([{ itemType: 'product', name: '', qty: 0, rate: '' }, { itemType: 'product', name: '', qty: 1, rate: 5 }]);
V.qaValidate();
ok('every problem listed at once', V.get().length >= 4, V.get().length + ' problems');

// ── 3. Wiring ─────────────────────────────────────────────────────────────────────
console.log('\nwiring');
ok('all save paths use qaValidate', (src.match(/if\(!qaValidate\(\)\) return;/g) || []).length === 4,
   (src.match(/if\(!qaValidate\(\)\) return;/g) || []).length + ' call sites');
ok('old toast-only guard gone', !src.includes('if(invalid.length){ reportInvalid(invalid); return; }'));
ok('db error goes to the panel', src.includes('if(error){ showQaSaveError(error); return; }'));
ok('stars render from required attr', src.includes('form.querySelectorAll(\'[required]\').forEach') && src.includes('req-star'));
ok('due date prefills', src.includes('function prefillPayDueDate()'));
ok('panel markup present', src.includes('id="qaProblems"'));

// ── 4. Website Orders header ──────────────────────────────────────────────────────
console.log('\nWebsite Orders header');
ok('duplicate KPI tiles removed', !src.includes('id="woKpi"'));
ok('exception strip added', src.includes('id="woAlerts"'));
ok('strip hides when clean', src.includes('alerts.innerHTML=bits.length?'));
ok('courier name normalised', src.includes('function woCourierLabel(v)'));

console.log(fails ? '\n' + fails + ' FAILURES' : '\nall checks passed');
process.exit(fails ? 1 : 0);
