import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';

// Nirmala UI — Windows' native Devanagari font, properly shapes conjuncts via HarfBuzz
// AdobeDevanagari does not load correctly into Skia on this platform

const OUT = 'assets/icons';
mkdirSync(OUT, { recursive: true });

// Design constants
const ORANGE  = '#C4622A';
const BLACK   = '#161614';
const WHITE   = '#FFFFFF';
const TEXT    = 'त्रि'; // त्रि — explicit Unicode codepoints

// SPLIT: 'lr' = left/right, 'tb' = top/bottom
const SPLIT = 'tb';

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');

  const half = size / 2;
  const r    = (340 / 512) * size / 2; // circle radius scaled from 512 master

  // Background split
  if (SPLIT === 'lr') {
    ctx.fillStyle = ORANGE;
    ctx.fillRect(0, 0, half, size);
    ctx.fillStyle = BLACK;
    ctx.fillRect(half, 0, half, size);
  } else {
    ctx.fillStyle = ORANGE;
    ctx.fillRect(0, 0, size, half);
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, half, size, half);
  }

  // White circle
  ctx.beginPath();
  ctx.arc(half, half, r, 0, Math.PI * 2);
  ctx.fillStyle = WHITE;
  ctx.fill();

  // त्रि — scale font proportionally from 160px at 512
  const fontSize = Math.round((160 / 512) * size);
  ctx.font      = `bold ${fontSize}px "Nirmala UI"`;
  ctx.fillStyle = ORANGE;
  ctx.textAlign = 'left'; // we'll compute x manually for precision

  // measureText for exact centering inside circle
  const m = ctx.measureText(TEXT);
  const textW = m.width;
  const textH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

  const x = half - textW / 2;
  const y = half + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;

  ctx.fillText(TEXT, x, y);

  return canvas.toBuffer('image/png');
}

const sizes = [
  { name: 'icon-512x512.png',  size: 512 },
  { name: 'icon-192x192.png',  size: 192 },
  { name: 'favicon-96x96.png', size: 96  },
  { name: 'favicon-32x32.png', size: 32  },
  { name: 'favicon-16x16.png', size: 16  },
];

for (const { name, size } of sizes) {
  writeFileSync(`${OUT}/${name}`, drawIcon(size));
  console.log(`✓ ${name}`);
}

console.log('\nAll icons written to', OUT, `(split: ${SPLIT})`);
