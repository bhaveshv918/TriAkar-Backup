// node export-linkedin.js  (run from server/ directory)
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'assets', 'logo');
mkdirSync(OUT, { recursive: true });

const gloridaB64 = readFileSync(join(ROOT, 'assets', 'fonts', 'Glorida.woff2')).toString('base64');
const fontFace   = `@font-face{font-family:'Glorida';src:url('data:font/woff2;base64,${gloridaB64}') format('woff2');font-weight:100 900;}`;

const W = 1584, H = 396;

// ── Isometric cube wireframe ──────────────────────────────────────────────
function cube(cx, cy, h) {
  const hx = +(h * Math.sqrt(3)).toFixed(1);
  const hy = h;
  const p  = (x, y) => `${+x.toFixed(1)},${+y.toFixed(1)}`;
  const T  = p(cx, cy - 2*hy);
  const TR = p(cx + hx, cy - hy);
  const TL = p(cx - hx, cy - hy);
  const BR = p(cx + hx, cy + hy);
  const BL = p(cx - hx, cy + hy);
  const B  = p(cx, cy + 2*hy);
  const C  = p(cx, cy);

  const faces = {
    top:   `M${T}L${TR}L${C}L${TL}Z`,
    right: `M${TR}L${BR}L${B}L${C}Z`,
    left:  `M${TL}L${C}L${B}L${BL}Z`,
  };
  const edges = [
    [T,TR],[T,TL],[TR,C],[TL,C],
    [TR,BR],[TL,BL],[BR,B],[BL,B],[C,B]
  ].map(([a,b]) => `M${a}L${b}`).join('');

  return { faces, edges };
}

// ── SVG builder ───────────────────────────────────────────────────────────
function makeSVG(dark) {
  const bg    = dark ? '#161614' : '#F4F2EC';
  const tri   = '#C4622A';
  const akar  = dark ? '#F4F2EC' : '#161614';
  const stone = '#88847E';
  const head  = dark ? '#F4F2EC' : '#161614';
  const dim   = dark ? 'rgba(244,242,236,0.28)' : 'rgba(22,22,20,0.28)';
  const rule  = dark ? 'rgba(244,242,236,0.08)' : 'rgba(22,22,20,0.08)';

  const cs    = dark ? 'rgba(196,98,42,0.30)' : 'rgba(196,98,42,0.20)';   // cube stroke
  const ctop  = dark ? 'rgba(196,98,42,0.07)' : 'rgba(196,98,42,0.04)';
  const cside = dark ? 'rgba(196,98,42,0.03)' : 'rgba(196,98,42,0.02)';

  const bb    = dark ? 'rgba(196,98,42,0.40)' : 'rgba(22,22,20,0.18)';    // badge border
  const bt    = dark ? 'rgba(196,98,42,0.88)' : 'rgba(22,22,20,0.45)';    // badge text
  const fw    = dark ? '#C8C4BC' : '#AAAAAA';                              // flag white band

  const { faces, edges } = cube(1445, 198, 130);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <style>${fontFace}</style>
  <clipPath id="bc"><rect width="${W}" height="${H}"/></clipPath>
</defs>

<!-- Background -->
<rect width="${W}" height="${H}" fill="${bg}"/>

<!-- Cube decoration -->
<g clip-path="url(#bc)">
  <path d="${faces.top}"   fill="${ctop}"/>
  <path d="${faces.right}" fill="${cside}"/>
  <path d="${faces.left}"  fill="${cside}"/>
  <path d="${edges}" fill="none" stroke="${cs}" stroke-width="1.2" stroke-linejoin="round"/>
</g>

<!-- ── Logo (left) ── -->
<text x="72" y="155"
  font-family="Glorida,'Helvetica Neue',Arial,sans-serif"
  font-size="48" font-weight="700" letter-spacing="9">
  <tspan fill="${tri}">TRI</tspan><tspan fill="${akar}">AKAR</tspan>
</text>
<text x="72" y="191"
  font-family="'Noto Sans Devanagari',Mangal,sans-serif"
  font-size="21" font-weight="300" fill="${stone}">त्रिआकार</text>
<line x1="72" y1="220" x2="132" y2="220" stroke="${rule}" stroke-width="1"/>
<text x="72" y="244"
  font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
  font-size="11" font-weight="400" letter-spacing="1.8" fill="${dim}">www.triakar.com</text>

<!-- Vertical rule -->
<line x1="332" y1="78" x2="332" y2="318" stroke="${rule}" stroke-width="1"/>

<!-- ── Headline (centre-left) ── -->
<text x="368" y="148"
  font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
  font-size="40" font-weight="700" fill="${head}">Premium 3D-printed objects for</text>
<text x="368" y="202"
  font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
  font-size="40" font-weight="700" fill="${tri}">modern homes.</text>

<!-- ── Category strip ── -->
<text x="368" y="336"
  font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
  font-size="11" font-weight="600" letter-spacing="2.2" fill="${dim}">HOME DÉCOR  ·  GIFTING  ·  CUSTOM PARTS  ·  WALL ART</text>

<!-- ── MADE IN INDIA badge ── -->
<rect x="1186" y="28" width="168" height="28" rx="14"
  fill="none" stroke="${bb}" stroke-width="1"/>
<!-- Tricolour flag (tiny) -->
<rect x="1202" y="38.5" width="16" height="3.2" rx="0.5" fill="#FF9933"/>
<rect x="1202" y="41.7" width="16" height="3.2" rx="0.5" fill="${fw}"/>
<rect x="1202" y="44.9" width="16" height="3.2" rx="0.5" fill="#138808"/>
<!-- Badge text -->
<text x="1226" y="48"
  font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
  font-size="10" font-weight="600" letter-spacing="1.6"
  fill="${bt}" dominant-baseline="middle">MADE IN INDIA</text>
</svg>`;
}

async function save(svg, name, bg) {
  const buf = Buffer.from(svg);
  await sharp(buf).png({ quality: 100 }).toFile(join(OUT, `${name}.png`));
  await sharp(buf).flatten({ background: bg }).jpeg({ quality: 95 }).toFile(join(OUT, `${name}.jpg`));
  console.log(`  ✓  ${name}.png + .jpg`);
}

console.log('\nTriAkar — exporting LinkedIn banners (1584 × 396)…\n');
await save(makeSVG(true),  'triakar-linkedin-dark',  '#161614');
await save(makeSVG(false), 'triakar-linkedin-light', '#F4F2EC');
console.log('\nDone — saved to assets/logo/\n');
