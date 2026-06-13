/**
 * One-time migration: Supabase Storage product images → Cloudinary
 *
 * What it does:
 *   1. Fetches all products that have Supabase Storage image URLs
 *   2. Downloads each image from Supabase
 *   3. Uploads it to Cloudinary under triakar/products/
 *   4. Updates the product row with the new Cloudinary URL
 *
 * Run from the server/ directory:
 *   node scripts/migrate-images-to-cloudinary.js
 *
 * Safe to re-run — skips images already on Cloudinary.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

// ── Config ────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const SUPABASE_STORAGE_HOST = process.env.SUPABASE_URL.replace('https://', '');

function isSupabaseUrl(url) {
  return typeof url === 'string' && url.includes(SUPABASE_STORAGE_HOST) && url.includes('/storage/');
}

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
}

// ── Upload a URL directly to Cloudinary (no local download needed) ────────────

function uploadUrlToCloudinary(imageUrl) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      imageUrl,
      {
        folder:         'triakar/products',
        fetch_format:   'auto',
        quality:        'auto',
        resource_type:  'image',
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Fetching all products…');
  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, name, images');

  if (error) { console.error('Failed to fetch products:', error.message); process.exit(1); }

  const toMigrate = products.filter(p =>
    Array.isArray(p.images) && p.images.some(isSupabaseUrl)
  );

  console.log(`Total products: ${products.length}`);
  console.log(`Products with Supabase Storage images: ${toMigrate.length}\n`);

  if (!toMigrate.length) {
    console.log('Nothing to migrate. All images are already on Cloudinary or have no images.');
    return;
  }

  let totalMigrated = 0;
  let totalSkipped  = 0;
  let totalFailed   = 0;

  for (const product of toMigrate) {
    console.log(`\n── ${product.name} (${product.slug})`);
    const newImages = [];

    for (const url of product.images) {
      if (!url) continue;

      if (isCloudinaryUrl(url)) {
        console.log(`  ✓ Already on Cloudinary — skipping`);
        newImages.push(url);
        totalSkipped++;
        continue;
      }

      if (!isSupabaseUrl(url)) {
        console.log(`  ? External URL — keeping as-is: ${url.slice(0, 60)}`);
        newImages.push(url);
        totalSkipped++;
        continue;
      }

      try {
        process.stdout.write(`  ↑ Migrating ${url.split('/').pop()} … `);
        const newUrl = await uploadUrlToCloudinary(url);
        console.log('done');
        newImages.push(newUrl);
        totalMigrated++;
      } catch (err) {
        console.log(`FAILED — ${err.message}`);
        newImages.push(url); // keep old URL so product doesn't break
        totalFailed++;
      }
    }

    // Update product only if at least one URL changed
    const changed = newImages.some((u, i) => u !== product.images[i]);
    if (changed) {
      const { error: upErr } = await supabase
        .from('products')
        .update({ images: newImages })
        .eq('id', product.id);

      if (upErr) {
        console.log(`  ✗ DB update failed for ${product.slug}: ${upErr.message}`);
      } else {
        console.log(`  ✓ DB updated`);
      }
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`Migrated : ${totalMigrated}`);
  console.log(`Skipped  : ${totalSkipped}`);
  console.log(`Failed   : ${totalFailed}`);
  console.log('─────────────────────────────────');
  if (totalFailed === 0) {
    console.log('\nAll done. You can now delete the product-images bucket from Supabase Storage.');
  } else {
    console.log('\nSome images failed. Re-run the script — it skips already-migrated images.');
  }
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
