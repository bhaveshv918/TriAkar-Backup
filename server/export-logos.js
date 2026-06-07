// One-time utility — run from the server/ directory:
//   node export-logos.js
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'assets', 'logo');

mkdirSync(OUT, { recursive: true });

async function save(svgFile, outName, w, h, bg) {
  const svg = readFileSync(join(ROOT, 'assets', 'logo', svgFile));
  const base = join(OUT, outName);
  await sharp(svg).resize(w, h).png({ quality: 100 }).toFile(`${base}.png`);
  await sharp(svg).resize(w, h).flatten({ background: bg }).jpeg({ quality: 94 }).toFile(`${base}.jpg`);
  console.log(`  ✓  ${outName}.png  +  .jpg`);
}

console.log('\nTriAkar — exporting logos…\n');

// WhatsApp DP / app icon
await save('triakar-mark.svg', 'triakar-mark-640',  640,  640,  '#C4622A');
await save('triakar-mark.svg', 'triakar-mark-1024', 1024, 1024, '#C4622A');
await save('triakar-mark.svg', 'triakar-mark-256',  256,  256,  '#C4622A');

// Full logo — dark background
await save('triakar-logo-dark.svg',  'triakar-logo-dark-1200',  1200, 400, '#161614');
await save('triakar-logo-dark.svg',  'triakar-logo-dark-600',    600, 200, '#161614');

// Full logo — light background
await save('triakar-logo-light.svg', 'triakar-logo-light-1200', 1200, 400, '#F4F2EC');
await save('triakar-logo-light.svg', 'triakar-logo-light-600',   600, 200, '#F4F2EC');

console.log('\nDone — files saved to assets/logo/\n');
