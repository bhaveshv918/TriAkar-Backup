// Regenerates every favicon / app icon.
// Browser tab favicons → assets/icons/favicon-source.svg  (white box, orange त्रि)
// App icons (PWA + apple-touch) → assets/logo/triakar-mark.svg  (orange & black split)
// Run: node scripts/gen-icons.js
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', 'server', 'node_modules', 'sharp'));

const ROOT = path.join(__dirname, '..');
const FAV_SRC = path.join(ROOT, 'assets', 'icons', 'favicon-source.svg');  // white box
const APP_SRC = path.join(ROOT, 'assets', 'logo', 'triakar-mark.svg');     // orange & black
const ICONS = path.join(ROOT, 'assets', 'icons');

// Browser tab favicons — white box source
const FAV_PNGS = { 16: 'favicon-16x16.png', 32: 'favicon-32x32.png', 96: 'favicon-96x96.png' };
// App icons — orange & black source
const APP_PNGS = { 180: 'apple-touch-icon.png', 192: 'icon-192x192.png', 512: 'icon-512x512.png' };

function render(src, size) {
  return sharp(src, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Build a PNG-embedded .ico (16/32/48) — supported by all modern browsers + Windows.
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type = icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  const blobs = [];
  entries.forEach((e, i) => {
    const o = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 0); // width
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1); // height
    dir.writeUInt8(0, o + 2);            // palette
    dir.writeUInt8(0, o + 3);            // reserved
    dir.writeUInt16LE(1, o + 4);         // color planes
    dir.writeUInt16LE(32, o + 6);        // bits per pixel
    dir.writeUInt32LE(e.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.data.length;
    blobs.push(e.data);
  });
  return Buffer.concat([header, dir, ...blobs]);
}

(async () => {
  // Browser tab favicons — white box
  for (const [size, name] of Object.entries(FAV_PNGS)) {
    const buf = await render(FAV_SRC, Number(size));
    fs.writeFileSync(path.join(ICONS, name), buf);
    console.log('wrote', name, `(${buf.length}b)`);
  }

  // App icons — orange & black split
  for (const [size, name] of Object.entries(APP_PNGS)) {
    const buf = await render(APP_SRC, Number(size));
    fs.writeFileSync(path.join(ICONS, name), buf);
    console.log('wrote', name, `(${buf.length}b)`);
  }

  // Multi-size favicon.ico (white box, browser tab sizes 16/32/48)
  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const s of icoSizes) icoEntries.push({ size: s, data: await render(FAV_SRC, s) });
  const ico = buildIco(icoEntries);
  fs.writeFileSync(path.join(ICONS, 'favicon.ico'), ico);
  console.log('wrote favicon.ico', `(${ico.length}b, sizes ${icoSizes.join('/')})`);

  // Root favicon.svg = white box (browser tab)
  fs.copyFileSync(FAV_SRC, path.join(ROOT, 'favicon.svg'));
  console.log('wrote favicon.svg (white box)');
})();
