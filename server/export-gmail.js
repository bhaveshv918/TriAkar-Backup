// One-time utility — run from the server/ directory:
//   node export-gmail.js
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'assets', 'logo');
mkdirSync(OUT, { recursive: true });

const gloridaB64 = readFileSync(join(ROOT, 'assets', 'fonts', 'Glorida.woff2')).toString('base64');
const fontFace = `@font-face{font-family:'Glorida';src:url('data:font/woff2;base64,${gloridaB64}') format('woff2');font-weight:100 900;}`;

function buildSVG(w, h, bg, triColor, akarColor, hiColor) {
  const mainSz = Math.round(w * 0.165);
  const hiSz   = Math.round(w * 0.068);
  const ls     = Math.round(mainSz * 0.18);
  const cx     = w / 2;
  const mainY  = Math.round(h * 0.44);
  const hiY    = Math.round(h * 0.62);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
  <style>${fontFace}</style>
</defs>
<rect width="${w}" height="${h}" fill="${bg}"/>
<text x="${cx}" y="${mainY}"
  font-family="Glorida,'Helvetica Neue',Arial,sans-serif"
  font-size="${mainSz}" font-weight="700"
  letter-spacing="${ls}"
  text-anchor="middle" dominant-baseline="central">
  <tspan fill="${triColor}">TRI</tspan><tspan fill="${akarColor}">AKAR</tspan>
</text>
<text x="${cx}" y="${hiY}"
  font-family="'Noto Sans Devanagari',Mangal,sans-serif"
  font-size="${hiSz}" font-weight="300"
  fill="${hiColor}"
  text-anchor="middle" dominant-baseline="central">त्रिआकार</text>
</svg>`;
}

console.log('\nTriAkar — exporting Gmail logo (500×500)…\n');

const svg = buildSVG(500, 500, '#F4F2EC', '#C4622A', '#161614', '#88847E');
await sharp(Buffer.from(svg)).png({ quality: 100 }).toFile(join(OUT, 'triakar-gmail-500.png'));
console.log('  ✓  triakar-gmail-500.png');

console.log('\nDone — saved to assets/logo/\n');
