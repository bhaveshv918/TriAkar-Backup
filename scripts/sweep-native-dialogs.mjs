/* One-off sweep: replace every native confirm()/prompt()/alert() in an HTML file
   with the in-app bizConfirm/bizPrompt/bizAlert dialogs, then walk the parser's
   "await is only valid in async functions" errors and mark each enclosing
   function async until the file parses clean.

   Run:  node scripts/sweep-native-dialogs.mjs admin-biz.html
   Prints every function it made async so the list can be reviewed by hand. */
import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/sweep-native-dialogs.mjs <file.html>'); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');

// Only inside the inline <script> bodies, never in comments-as-prose or markup.
const SCRIPT_RE = /(<script(?![^>]*src=)[^>]*>)([\s\S]*?)(<\/script>)/g;

let replaced = 0;
src = src.replace(SCRIPT_RE, (all, open, code, close) => {
  const out = code
    // Preceded by a non-identifier, non-dot char so confirmIqOrder( / this.alert( are untouched.
    .replace(/([^A-Za-z0-9_$.])confirm\(/g, (m, p) => { replaced++; return p + 'await bizConfirm('; })
    .replace(/([^A-Za-z0-9_$.])prompt\(/g,  (m, p) => { replaced++; return p + 'await bizPrompt('; })
    .replace(/([^A-Za-z0-9_$.])alert\(/g,   (m, p) => { replaced++; return p + 'await bizAlert('; })
    // The definitions themselves must not be rewritten into calls on themselves.
    .replace(/async function await biz(Confirm|Prompt|Alert)\(/g, (m, n) => `async function biz${n}(`);
  return open + out + close;
});
console.log('replaced call sites:', replaced);

// Nearest enclosing function header, scanning back from the offending line.
const FN_START = [
  /^(\s*)(export\s+)?function\s/,          // function foo(
  /(^|[^\w$])function\s*\(/,               // function(
  /=>\s*\{?\s*$/,                          // ...=> {
  /\)\s*=>/,                               // (a)=>
  /[:=]\s*function\s*\(/,                  // x: function(
];
const madeAsync = [];
for (let pass = 0; pass < 400; pass++) {
  const scripts = [...src.matchAll(SCRIPT_RE)];
  let err = null;
  for (const m of scripts) {
    const offset = m.index + m[1].length;
    const lineOffset = src.slice(0, offset).split('\n').length - 1;
    try { new vm.Script(m[2], { filename: 'x' }); }
    catch (e) {
      const lm = /x:(\d+)/.exec(e.stack || '');
      if (!lm) { console.error('unparsed error:', e.message); process.exit(1); }
      err = { line: lineOffset + Number(lm[1]), message: e.message };
      break;
    }
  }
  if (!err) { console.log('parses clean after', pass, 'fixes'); break; }
  // In a non-async function `await bizConfirm(x)` parses as two identifiers, so
  // V8 reports "Unexpected identifier 'bizConfirm'" rather than the friendlier
  // "await is only valid in async functions". Both mean the same thing here.
  if (!/await is only valid|await is not defined|Unexpected identifier 'biz(Confirm|Prompt|Alert)'/.test(err.message)) {
    console.error('line', err.line, ':', err.message);
    process.exit(1);
  }
  const lines = src.split('\n');
  let i = err.line - 1, fixed = false;
  for (; i >= 0 && err.line - i < 400; i--) {
    const L = lines[i];
    if (/\basync\b/.test(L) && FN_START.some(r => r.test(L))) { fixed = true; break; }   // already async, keep looking outward
    if (!FN_START.some(r => r.test(L))) continue;
    if (/^\s*(export\s+)?function\s/.test(L))      lines[i] = L.replace(/^(\s*)(export\s+)?function\s/, '$1$2async function ');
    else if (/[:=]\s*function\s*\(/.test(L))       lines[i] = L.replace(/([:=]\s*)function\s*\(/, '$1async function (');
    else if (/(^|[^\w$])function\s*\(/.test(L))    lines[i] = L.replace(/(^|[^\w$])function\s*\(/, '$1async function (');
    else if (/\)\s*=>/.test(L))                    lines[i] = L.replace(/(\(?[^()]*\)?)\s*=>/, 'async $1=>');
    else if (/=>\s*\{?\s*$/.test(L))               lines[i] = L.replace(/([\w$)\]]+)\s*=>/, 'async $1=>');
    madeAsync.push((i + 1) + ': ' + lines[i].trim().slice(0, 110));
    fixed = true;
    break;
  }
  if (!fixed) { console.error('could not find an enclosing function for line', err.line, lines[err.line - 1]); process.exit(1); }
  src = lines.join('\n');
}
fs.writeFileSync(file, src);
console.log('\nfunctions made async (' + madeAsync.length + '):');
madeAsync.forEach(l => console.log('  ' + l));
