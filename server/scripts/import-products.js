// ═══════════════════════════════════════════════════════════════════
// TriAkar — Bulk product importer
//
//   node server/scripts/import-products.js path/to/product-intake.csv
//   node server/scripts/import-products.js path/to/intake.csv --publish
//
// Reads the intake CSV (see product-intake.csv at repo root), computes a
// rule-based price from size/material/print-time, validates category /
// occasions / size_class, and UPSERTs into Supabase `products` by slug.
//
// Safe by design:
//   • Imported rows are DRAFTS (is_active=false) unless --publish is passed.
//   • commercial_ok defaults to false → shows the licence-review flag in admin.
//   • Re-runnable: upsert on slug, so fixing a row and re-importing is fine.
//
// Requires migration 004 (occasions / licence / pricing columns) to be run.
// See PRODUCT-LISTING-PROCESS.md §6 and §8.
// ═══════════════════════════════════════════════════════════════════
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import TriakarPricing from '../../pricing.js'; // single source of truth (see pricing.js)

const CATEGORIES = ['desk', 'home', 'gifting', 'custom'];
const OCCASIONS = ['birthday', 'anniversary', 'corporate', 'housewarming', 'last-minute'];
const SIZES = ['S', 'M', 'L', 'XL'];

// Price every product through the shared pricing engine.
function computePrice(row) {
  const q = TriakarPricing.quote({
    grams: row.est_grams,
    hours: row.est_print_hours,
    material: row.material || 'PLA+',
    size: row.size_class || 'M',
  });
  return { price: q.price, compare_at_price: q.compare_at_price, _quote: q };
}

// ── Minimal CSV parser (handles quoted fields, commas, newlines, "" escapes) ──
function parseCSV(text) {
  const rows = [];
  let field = '', row = [], inQuotes = false;
  text = text.replace(/^﻿/, ''); // strip BOM
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => String(v).trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const splitPipes = (v) => (v ? v.split('|').map((s) => s.trim()).filter(Boolean) : []);
const parseJSONcell = (v, fallback) => {
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};
const truthy = (v) => /^(1|true|yes|y)$/i.test(String(v).trim());

async function main() {
  const file = process.argv[2];
  const publish = process.argv.includes('--publish');
  if (!file) {
    console.error('Usage: node server/scripts/import-products.js <intake.csv> [--publish]');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    console.error('  Set them in server/.env (see server/.env.example), then re-run.');
    process.exit(1);
  }
  // Load the DB client only after env is validated (avoids a raw crash on missing env).
  const { default: supabase } = await import('../db/supabaseClient.js');

  const csvPath = path.resolve(file);
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  console.log(`Read ${rows.length} row(s) from ${csvPath}\n`);

  let ok = 0, failed = 0, liveCount = 0;
  const warnings = [];

  for (const r of rows) {
    if (!r.slug || !r.name) { warnings.push(`SKIP: row missing slug/name → ${JSON.stringify(r).slice(0, 80)}`); failed++; continue; }

    // Validate taxonomies (warn, don't block — owner reviews in admin)
    if (!CATEGORIES.includes(r.category)) warnings.push(`${r.slug}: category "${r.category}" not in ${CATEGORIES.join('|')}`);
    const occ = splitPipes(r.occasions);
    const badOcc = occ.filter((o) => !OCCASIONS.includes(o));
    if (badOcc.length) warnings.push(`${r.slug}: unknown occasion(s) ${badOcc.join(', ')}`);
    if (r.size_class && !SIZES.includes(r.size_class.toUpperCase())) warnings.push(`${r.slug}: size_class "${r.size_class}" not in ${SIZES.join('|')}`);

    const commercial_ok = truthy(r.commercial_ok);
    if (!commercial_ok) warnings.push(`${r.slug}: ⚠ commercial_ok=false (licence: ${r.license || 'unknown'}) → flagged for review in admin`);

    // Only price a product when it has real print specs. Without grams + hours we
    // refuse to invent a price: price stays 0 and the row is forced to draft.
    const hasSpecs = Number(r.est_grams) > 0 && Number(r.est_print_hours) > 0;
    const { price, compare_at_price, _quote } = hasSpecs
      ? computePrice(r)
      : { price: 0, compare_at_price: null, _quote: null };
    if (!hasSpecs) warnings.push(`${r.slug}: ⚠ no print specs (grams/hours) → not priced, kept as draft`);

    const product = {
      slug: r.slug,
      name: r.name,
      category: CATEGORIES.includes(r.category) ? r.category : 'gifting',
      occasions: occ,
      price,
      compare_at_price,
      is_customizable: truthy(r.is_customizable),
      customization_fields: parseJSONcell(r.customization_fields, []),
      short_description: r.short_description || null,
      long_description: r.long_description || null,
      description: r.short_description || r.long_description || '',
      bullet_points: splitPipes(r.bullet_points),
      use_case: r.use_case || null,
      target_audience: r.target_audience || null,
      material: r.material || 'PLA+',
      stock_status: r.stock_status || 'Made to Order',
      sku: r.sku || null,
      // tags column is Postgres text[] — send an array, not a comma string
      tags: r.tags ? r.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      images: splitPipes(r.images),
      designer: r.designer || null,
      source_url: r.source_url || null,
      license: r.license || null,
      commercial_ok,
      est_grams: r.est_grams ? Number(r.est_grams) : null,
      est_print_hours: r.est_print_hours ? Number(r.est_print_hours) : null,
      size_class: r.size_class ? r.size_class.toUpperCase() : null,
      stock_qty: r.stock_qty ? Number(r.stock_qty) : 99,
      // Drafts by default; also forced to draft when unpriced (no specs) or licence not cleared.
      is_active: publish && hasSpecs && commercial_ok ? true : false,
    };

    const { error } = await supabase.from('products').upsert(product, { onConflict: 'slug' });
    if (error) { warnings.push(`${r.slug}: DB error — ${error.message}`); failed++; continue; }
    const liveState = product.is_active ? 'LIVE' : 'draft';
    const priceStr = hasSpecs
      ? `cost ₹${_quote.cost}+ship ₹${_quote.shipping} → list ₹${price}  MRP ₹${compare_at_price} (-${_quote.discountPct}%)`
      : 'unpriced (needs grams/hours)';
    console.log(`  ✓ ${r.slug.padEnd(34)} ${priceStr}  [${liveState}]`);
    if (product.is_active) liveCount++;
    ok++;
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Imported: ${ok}   Live: ${liveCount}   Drafts: ${ok - liveCount}   Failed: ${failed}`);
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} warning(s) — review in admin:`);
    warnings.forEach((w) => console.log('   • ' + w));
  }
  if (liveCount < ok) {
    console.log('\nDrafts stay hidden until: (a) they have print specs (grams/hours), and');
    console.log('(b) you clear the licence — set commercial_ok in the CSV, or flip Active in admin.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
