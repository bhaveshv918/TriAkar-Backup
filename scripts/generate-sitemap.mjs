#!/usr/bin/env node
// TriAkar — sitemap.xml generator.
//
// Static marketing/policy pages are hand-maintained below (they change rarely and their
// priority/changefreq is a deliberate editorial choice). Products and Stories live in
// Supabase and are fetched from the public API at run time, so the sitemap can never
// silently drift out of sync with what's actually live (the 2026-08-20 audit found the
// checked-in sitemap.xml had 0 of 17 live products and only 12 of 21 live stories).
//
// Run before each deploy: node scripts/generate-sitemap.mjs
// Requires network access to the live API (defaults to production; override with
// API_BASE=http://localhost:3000 for local testing against a dev server).

import { writeFileSync } from 'fs';

const API_BASE = process.env.API_BASE || 'https://triakar.onrender.com';
const SITE = 'https://www.triakar.com';
const today = new Date().toISOString().slice(0, 10);

const STATIC_PAGES = [
  { loc: '/', lastmod: '2026-06-04', changefreq: 'weekly', priority: '1.0' },
  { loc: '/products', lastmod: today, changefreq: 'weekly', priority: '0.9' },
  { loc: '/custom', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.9' },
  { loc: '/services/corporate-gifting', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.9' },
  { loc: '/services/personalized-gifts', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.9' },
  { loc: '/services/replacement-parts', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/about', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/contact', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/stories', lastmod: today, changefreq: 'weekly', priority: '0.7' },
  { loc: '/reviews', lastmod: '2026-06-09', changefreq: 'weekly', priority: '0.8' },
  { loc: '/how-it-works', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.7' },
  { loc: '/materials', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.7' },
  { loc: '/guides/which-3d-printing-material-to-choose', lastmod: '2026-06-13', changefreq: 'yearly', priority: '0.6' },
  { loc: '/guides/how-to-get-a-replacement-plastic-part-3d-printed', lastmod: '2026-06-13', changefreq: 'yearly', priority: '0.6' },
  { loc: '/guides/diwali-corporate-gifting-guide', lastmod: '2026-06-13', changefreq: 'yearly', priority: '0.6' },
  { loc: '/faq', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.6' },
  { loc: '/order', lastmod: '2026-06-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/instant-quote', lastmod: '2026-08-16', changefreq: 'weekly', priority: '0.9' },
  { loc: '/track-order', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.5' },
  { loc: '/refund-policy', lastmod: '2026-06-04', changefreq: 'yearly', priority: '0.3' },
  { loc: '/terms', lastmod: '2026-06-04', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy', lastmod: '2026-06-04', changefreq: 'yearly', priority: '0.3' },
  { loc: '/3d-printing-noida', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/3d-printing-greater-noida', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/replacement-parts-noida', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.7' },
  { loc: '/3d-printed-gifts-delhi', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.7' },
  { loc: '/gifts/birthday-gifts-noida', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/gifts/corporate-gifts-noida', lastmod: '2026-06-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/gifts/housewarming-gifts', lastmod: '2026-06-04', changefreq: 'monthly', priority: '0.8' },
];

async function fetchJson(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url><loc>${SITE}${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

async function main() {
  const [productsRaw, storiesRaw] = await Promise.all([
    fetchJson('/api/products'),
    fetchJson('/api/stories/public/all'),
  ]);
  const products = Array.isArray(productsRaw) ? productsRaw : (productsRaw.products || productsRaw.data || []);
  const stories = Array.isArray(storiesRaw) ? storiesRaw : (storiesRaw.stories || storiesRaw.data || []);

  const productEntries = products
    .filter(p => p.slug)
    .map(p => urlEntry({ loc: `/products/${p.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.7' }));

  const storyEntries = stories
    .filter(s => s.slug)
    .map(s => urlEntry({ loc: `/stories/${s.slug}`, lastmod: today, changefreq: 'monthly', priority: '0.6' }));

  const staticEntries = STATIC_PAGES.map(urlEntry);

  const body = [...staticEntries, ...storyEntries, ...productEntries].join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  writeFileSync(new URL('../sitemap.xml', import.meta.url), xml);
  console.log(`sitemap.xml written: ${STATIC_PAGES.length} static + ${storyEntries.length} stories + ${productEntries.length} products = ${STATIC_PAGES.length + storyEntries.length + productEntries.length} URLs`);
}

main().catch(err => {
  console.error('generate-sitemap failed:', err.message);
  process.exit(1);
});
