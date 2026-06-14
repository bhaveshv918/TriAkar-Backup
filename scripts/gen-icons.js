// Regenerates every favicon / app icon from the single canonical brand mark.
// Source of truth: assets/icons/favicon-source.svg  (white box, orange त्रि)
// Run: node scripts/gen-icons.js
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', 'server', 'node_modules', 'sharp'));

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icons', 'favicon-source.svg');
const ICONS = path.join(ROOT, 'assets', 'icons');

// size -> output path (relative to ICONS unless absolute)
const PNGS = {
  16:  'favicon-16x16.png',
  32:  'favicon-32x32.png',
  96:  'favicon-96x96.png',
  180: 'apple-touch-icon.png',
  192: 'icon-192x192.png',
  512: 'icon-512x512.png',
};

// Render the SVG crisply at a given square size.
function render(size) {
  return sharp(SRC, { density: 384 })
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
  // PNGs
  for (const [size, name] of Object.entries(PNGS)) {
    const buf = await render(Number(size));
    fs.writeFileSync(path.join(ICONS, name), buf);
    console.log('wrote', name, `(${buf.length}b)`);
  }

  // Multi-size favicon.ico
  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const s of icoSizes) icoEntries.push({ size: s, data: await render(s) });
  const ico = buildIco(icoEntries);
  fs.writeFileSync(path.join(ICONS, 'favicon.ico'), ico);
  console.log('wrote favicon.ico', `(${ico.length}b, sizes ${icoSizes.join('/')})`);

  // Remove stale unused leftovers (old plain-circle design)
  for (const stale of ['icon-192.png', 'icon-512.png']) {
    const p = path.join(ICONS, stale);
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('removed stale', stale); }
  }

  // Root favicon.svg = canonical mark (so the SVG tab icon matches the rest)
  fs.copyFileSync(SRC, path.join(ROOT, 'favicon.svg'));
  console.log('wrote favicon.svg (= triakar-mark.svg)');
})();
