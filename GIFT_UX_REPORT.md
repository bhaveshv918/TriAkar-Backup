# TriAkar — Gift-First UX Transformation Report

A 14-feature, gift-first, buyer-friendly upgrade based on live visual analysis of
thegiftstudio.com and theobroma.in. All changes are **additive and safe** — existing
backends were reused, no working code was rebuilt or broken.

**Hard rules honoured:** never said "food safe"; brand colours & identity unchanged
(`--accent #C4622A` / `--charcoal #161614` / `--ivory #F4F2EC`, Manrope + Glorida);
every change works at 375px mobile and on desktop; every file read before editing.

---

## 1. Features Implemented

| # | Feature | File(s) | Where |
|---|---------|---------|-------|
| F1 | Top contact bar (tel + WhatsApp + corporate CTA, rotating notices) | `partials.js` | New IIFE before PWA IIFE — injects `#taTopbar` + `<style id="taTopbarCSS">` (hides per-page `.notice-bar`) |
| F2 | Premium product card (badges, brand, rating, delivery pill, sold-out overlay) | `products.html` | CSS after `.prod-card.is-sold`; `buildCard()` className + badge/star/delivery/brand injection |
| F3 | "Corporate Order →" nav pill | `partials.js` | `.nav-corp` anchor added to `_NAV_HTML` before cart-btn |
| F4 | Collection filter bar (occasion / budget / material pills) | `products.html` | `.collection-bar` markup after filter-row2; `_initCollectionFilters()`, `_applyOccasionFromURL()`, `_occMatch()`, `_matMatch()`; `applyFilters()` extended |
| F5 | "Shop by Occasion" tiles (6) | `index.html` | `.occ-sec` markup after `.shop-cats`; CSS `.occ-grid`/`.occ-tile` |
| F6 | Mobile sticky bottom bar | — | **Skipped** — existing 5-tab `taBottomNav` already provides this (see §6) |
| F7 | Products page hero (◆◆◆ eyebrow + title + sub + count) | `products.html` | `.shop-header` markup + `.shop-eyebrow`/`.shop-sub` CSS |
| F8 | First-order promo hint (TRIAKAR10) at checkout | `checkout.html` | `.ck-firstorder` markup before promo row; `ckApplyFirstOrder()` JS |
| F9 | Cart free-shipping progress bar | `shared.js` | Pre-existing (lines ~255-277, `FREE_SHIP_MIN=999`) — verified |
| F10 | Working WhatsApp float (was permanently hidden) | `shared.css`, `shared.js` | `.wa-float` → `display:flex` + pulse + responsive; `wa.href` prefilled message |
| F11 | Gift order: checkbox + 150-char gift message | `checkout.html`, `paymentController.js`, `emailService.js` | Checkout `.ck-gift` + `ckToggleGift()`/`ckGiftCount()`; payload `is_gift`/`gift_message`; controller writes columns; admin email shows 🎁 |
| F12 | Numbers / trust bar (4 stats) | `index.html` | `.num-bar` markup after hero; `.num-stat` CSS |
| F13 | products-data.js gift fields + normalizer | `products-data.js` | `enrichProduct()` + `window.enrichProduct` applied to local + API products |
| F14 | 3 SEO gift landing pages + sitemap | `gifts/*.html`, `sitemap.xml` | See §5 |

---

## 2. New Files Created

| File | Purpose |
|------|---------|
| `server/db/migrations/002_gift_fields.sql` | Adds `orders.is_gift`, `orders.gift_message`; seeds TRIAKAR10 promo (idempotent) |
| `gifts/birthday-gifts-noida.html` | SEO landing — birthday gifts, Noida |
| `gifts/corporate-gifts-noida.html` | SEO landing — corporate/bulk gifting, Noida |
| `gifts/housewarming-gifts.html` | SEO landing — housewarming gifts, pan-India |
| `GIFT_UX_REPORT.md` | This report |

---

## 3. products-data.js — Fields Added

`enrichProduct(p, slug)` normalizes the following gift fields onto **every** product
(local fallback *and* live API products, via `window.enrichProduct` called in `buildCard()`):

- `occasion` — comma list (birthday, anniversary, corporate, housewarming, …) → drives F4 occasion filter & `?occasion=` deep-links
- `recipient` — target audience tag
- `material` — PLA / ABS / PETG → drives F4 material filter
- `ready` — `1` = in-stock / ships fast → drives F4 "Last Minute" filter + F2 fast-delivery pill
- `badge` — bestseller / new / custom / fast → F2 card badge
- `rating` + `rating_count` — F2 star display
- `brand` — F2 brand line

These map to `data-occasion / data-recipient / data-material / data-ready / data-price`
attributes on each card for client-side filtering.

---

## 4. SQL to Run in Supabase

Run **`server/db/migrations/002_gift_fields.sql`** in the Supabase SQL Editor
(safe to re-run — every statement is idempotent):

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift      BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message TEXT;

INSERT INTO promo_codes
  (code, description, discount_type, discount_value, min_order_amount, max_uses, is_active)
VALUES
  ('TRIAKAR10', '10% off your first order (min ₹999)', 'percent', 10, 999, NULL, true)
ON CONFLICT (code) DO NOTHING;
```

**Verify:**
```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name='orders' AND column_name IN ('is_gift','gift_message');
SELECT code, discount_type, discount_value, min_order_amount
  FROM promo_codes WHERE code='TRIAKAR10';
```

> Until this migration runs, gift orders still succeed — `paymentController` only writes
> `is_gift`/`gift_message` when present, but the columns must exist for the values to persist.

---

## 5. SEO Pages Created

All three clone the existing `3d-printed-gifts-delhi.html` template: GA4 + Sentry +
OG/Twitter meta + canonical + `partials.js` injection + cart sidebar + `.gift-hero`
with `◆ ◆ ◆` separator + keyword H1 + product grid (links to `products.html?occasion=…`)
+ "Why TriAkar" 3-card grid + 5 FAQs + closing WhatsApp/Shop CTA band.
Served at clean URLs via Vercel `cleanUrls:true` (no rewrite entries needed).

| Page | Primary keyword | Schema (@graph) | FAQs | Approx words |
|------|-----------------|-----------------|------|--------------|
| `gifts/birthday-gifts-noida.html` | "birthday gifts in Noida" | LocalBusiness + Service + FAQPage | 5 | ~520 |
| `gifts/corporate-gifts-noida.html` | "corporate gifts in Noida" | LocalBusiness + Service + FAQPage | 5 | ~540 |
| `gifts/housewarming-gifts.html` | "housewarming gifts" | LocalBusiness + Service + FAQPage | 5 | ~530 |

**sitemap.xml:** all three added at `priority 0.8`, `changefreq monthly`, `lastmod 2026-05-29`.

---

## 6. Pending / Skipped

| Item | Status | Reason |
|------|--------|--------|
| F6 — mobile sticky bottom bar | **Skipped** | Existing `taBottomNav` (5-tab bottom nav in `partials.js`) already provides mobile Shop + Cart access. A second bar would overlap/clutter and duplicate function. |
| F9 — cart shipping progress | **Already present** | Lives in `shared.js` (cart is a site-wide sidebar; no `cart.html` exists). Verified, no change needed. |
| 002 migration | **Manual action required** | Must be run once in Supabase SQL Editor (see §4). |

---

## 7. Testing Checklist

- [ ] Run `002_gift_fields.sql` in Supabase; confirm columns + TRIAKAR10 exist (§4 verify queries).
- [ ] **Mobile 375px:** top contact bar collapses to single line; nav corporate pill hidden; WhatsApp float visible above bottom nav, not overlapping.
- [ ] **Desktop:** top contact bar shows both lines; rotating notices cycle every 3s.
- [ ] Products page: occasion / budget / material pills filter the grid; count updates; `products.html?occasion=birthday` activates the Birthday pill on load.
- [ ] Product cards: badges, rating stars, delivery pill, and SOLD OUT overlay render; sold-out cards show overlay.
- [ ] Homepage: 6 occasion tiles link correctly (birthday/anniversary/housewarming → `products.html?occasion=…`; corporate/custom → `custom.html`; last-minute → `?occasion=last-minute`); 4-stat numbers bar renders (2-col on mobile).
- [ ] Checkout: "First order? TRIAKAR10" button applies the 10% promo (min ₹999); gift checkbox reveals message box with live 150-char counter.
- [ ] Place a test gift order → `orders.is_gift=true` + `gift_message` saved; admin email subject shows 🎁 and lists the gift message.
- [ ] WhatsApp float opens chat with prefilled message; hidden when buy-bar present on product pages.
- [ ] SEO pages load at `/gifts/birthday-gifts-noida`, `/gifts/corporate-gifts-noida`, `/gifts/housewarming-gifts`; nav/footer/cart inject; CTAs + FAQs work; validate JSON-LD in Google Rich Results Test.
- [ ] `sitemap.xml` validates and lists the 3 new gift URLs.

---

*TriAkar — Designed globally. Made responsibly in India.*
