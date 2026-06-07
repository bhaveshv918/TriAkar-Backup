// Run from server/ directory:  node export-wordmark.js
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'assets', 'logo');
mkdirSync(OUT, { recursive: true });

// Embed Glorida font so Sharp/librsvg renders it correctly
const gloridaB64 = readFileSync(join(ROOT, 'assets', 'fonts', 'Glorida.woff2')).toString('base64');
const fontFace = `@font-face{font-family:'Glorida';src:url('data:font/woff2;base64,${gloridaB64}') format('woff2');font-weight:100 900;}`;

function buildSVG(w, h, bg, triColor, akarColor, hiColor) {
  const mainSz  = Math.round(w * 0.165);
  const hiSz    = Math.round(w * 0.068);
  const ls      = Math.round(mainSz * 0.18);   // letter-spacing matches .18em
  const cx      = w / 2;
  const mainY   = Math.round(h * 0.44);
  const hiY     = Math.round(h * 0.62);

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

async function save(svgStr, name, bg) {
  const buf = Buffer.from(svgStr);
  await sharp(buf).png({ quality: 100 }).toFile(join(OUT, `${name}.png`));
  await sharp(buf).flatten({ background: bg }).jpeg({ quality: 95 }).toFile(join(OUT, `${name}.jpg`));
  console.log(`  ✓  ${name}.png + .jpg`);
}

console.log('\nTriAkar — exporting wordmark logos…\n');

// Light (ivory) — exact navbar colours
await save(buildSVG(640,  640,  '#F4F2EC', '#C4622A', '#161614', '#88847E'), 'triakar-wordmark-light-640',  '#F4F2EC');
await save(buildSVG(1200, 400,  '#F4F2EC', '#C4622A', '#161614', '#88847E'), 'triakar-wordmark-light-1200', '#F4F2EC');

// Dark — inverted for better contrast
await save(buildSVG(640,  640,  '#161614', '#C4622A', '#F4F2EC', '#88847E'), 'triakar-wordmark-dark-640',  '#161614');
await save(buildSVG(1200, 400,  '#161614', '#C4622A', '#F4F2EC', '#88847E'), 'triakar-wordmark-dark-1200', '#161614');

console.log('\nDone — files saved to assets/logo/\n');
