# TriAkar — Product Listing Process (MakerWorld-style catalogue)

> The repeatable, "proper way" to bulk-list 3D-printed / customisable products on the
> live site — with correct images, descriptions, categories, occasions, **rule-based
> pricing**, and **designer credit**. Written first; execution happens later against this doc.

**Decisions locked in (2026-06):**
- **Source:** list *everything*; the system **flags** licence concerns on the admin panel — the
  owner decides per product (modify / remove / keep). No hard block in code.
- **Batch size:** 60+ products → build a bulk CSV import script.
- **Designer credit:** show the **designer name only** on products (no outbound link per designer).
  A single site-wide **Credits & Attribution page** carries the generous, protective legal language.
- **Pricing:** **rule-based** from size / material / print-time (formula in §6).

---

## 1. Reality check — what already exists (reuse, don't rebuild)

The backend is already built. We are **populating and lightly extending**, not starting fresh.

| Already in place | Where |
|---|---|
| `products` table with `designer`, `use_case`, `target_audience`, `tags`, `category`, `images[]`, `short_description`, `long_description`, `bullet_points`, `is_customizable`, `customization_fields`, `sku`, `stock_status` | `server/db/schema.sql` |
| `categories` table (desk / home / gifting / custom-parts) | `server/db/product-management-schema.sql` |
| Admin product form with **Designer** + **Use case** fields; sample generator seeded with real MakerWorld handles | `admin.html` (~line 2400, 2660) |
| Storefront filtering by **category** + **occasion** pills | `products.html` |
| Cloudinary image pipeline (`res.cloudinary.com/dtpibsruo`) | `products-data.js`, `cloudinaryService.js` |
| Local fallback catalogue + "Import products from local data" | `products-data.js`, admin Products tab |

**Gaps to close:** (a) occasions are JS-guessed, not stored; (b) designer is a bare name with no
licence/source record; (c) no bulk import path; (d) no pricing rule; (e) no Credits page.

---

## 2. Licence handling — flag, don't block

We list everything. For each product we **store** its licence + source so the admin panel can
**surface a warning** when a product's licence looks non-commercial. The owner then decides.

- Each product stores: `license`, `source_url` (admin-only, not shown publicly), `commercial_ok` (boolean).
- **Admin behaviour:** if `commercial_ok = false` (or licence unknown), the product row shows a
  ⚠️ "Licence: review" badge in the admin Products list. It still saves and can still publish —
  the owner takes the call (modify / remove / keep).
- **Public site:** never shows licence or source link. Only the designer **name** is shown,
  plus the global Credits page (§7).
- The **Credits & Attribution page** (§7) carries blanket, generous attribution + a takedown/contact
  notice — the protective layer that covers the catalogue as a whole.

> Net effect: nothing is blocked in code; risk is made *visible* in admin so the owner acts.

---

## 3. Data model — additive migration

New file at execution time: `server/db/migrations/004_listing_designer_occasions.sql`

```sql
-- Occasions: stored, multi-value, drives the storefront occasion filter
ALTER TABLE products ADD COLUMN IF NOT EXISTS occasions TEXT[] DEFAULT '{}';
-- allowed: birthday | anniversary | corporate | housewarming | last-minute

-- Designer credit + licence record (licence/source are ADMIN-ONLY, never shown publicly)
-- `designer` (name, shown publicly) already exists.
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url    TEXT;     -- original model page (admin ref)
ALTER TABLE products ADD COLUMN IF NOT EXISTS license       TEXT;     -- e.g. 'CC-BY', 'CC-BY-NC', 'unknown'
ALTER TABLE products ADD COLUMN IF NOT EXISTS commercial_ok BOOLEAN DEFAULT false;

-- Pricing inputs (so the rule in §6 can compute / recompute price)
ALTER TABLE products ADD COLUMN IF NOT EXISTS est_grams      NUMERIC(10,2);  -- filament grams
ALTER TABLE products ADD COLUMN IF NOT EXISTS est_print_hours NUMERIC(10,2); -- print time
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_class     TEXT;           -- S | M | L | XL
```

All additive with safe defaults → no existing row or page breaks.
`enrichProduct()` keeps deriving `occasion` **only as a fallback** when `occasions[]` is empty.

---

## 4. Taxonomies (fixed — do not invent new values)

**Categories** (match storefront pills): `desk` · `home` · `gifting` · `custom`
**Occasions** (match `products.html` pills): `birthday` · `anniversary` · `corporate` · `housewarming` · `last-minute`
**Size class** (drives pricing): `S` · `M` · `L` · `XL`

A product may have multiple occasions. `use_case` (free text) stays as human copy;
`occasions[]` is the machine-filterable set.

---

## 5. Per-product intake template (`product-intake.csv`)

One row per product. Columns:

```
name, slug, category, occasions, size_class, material, est_grams, est_print_hours,
is_customizable, customization_fields, short_description, long_description, bullet_points,
use_case, target_audience, stock_status, sku, tags, images,
designer, source_url, license, commercial_ok
```

- `slug` — kebab-case, unique. `occasions` — pipe-separated (`birthday|corporate`).
- `images` — pipe-separated Cloudinary public IDs (`triakar/<slug>-1|triakar/<slug>-2`).
- `price` is **not** in the sheet — it is **computed** by the §6 rule from `size_class`,
  `material`, `est_grams`, `est_print_hours`.
- `customization_fields` / `bullet_points` — JSON in the cell, or simple `;`-separated lists we parse.

**Quality bar:** no Lorem Ipsum; short description is a written hook (not a truncation);
≥1 real image to publish; designer name always present.

---

## 6. Pricing engine — `pricing.js` (single source of truth)

One cost-up engine prices every product. It lives in **`pricing.js`** at the repo root and is
used by both the bulk importer (`server/scripts/import-products.js`) and the admin "Auto-calculate
price" button — so there is exactly one formula, no drift. `quote()` returns a full breakdown, so
every price is explainable.

**The flow (matches the brief):**

```
1. COST   = SETUP + (grams × MATERIAL_RATE[material]) + (hours × MACHINE_RATE)
                  + SIZE_HANDLING[size]
            cost ×= (1 + WASTE_BUFFER_PCT)            // failed prints / supports / waste
2. + SHIPPING[size]                                   // per-size shipping, baked into the price
3. × MARGIN_MULTIPLIER                                // profit
   listed price = max( roundUp(…, ROUND_TO), PRICE_FLOOR )
4. MRP (compare_at_price) = roundUp( listed × MRP_MULTIPLIER )   // the 2–3× "was" price
```

**Config defaults (`PRICING_CONFIG` in `pricing.js`) — ₹, India market; owner to confirm:**

| Constant | Default | Meaning |
|---|---|---|
| `SETUP` | ₹40 | fixed labour/handling per item (slicing, plate prep, QC) |
| `MATERIAL_RATE` | PLA/PLA+ ₹2.0 · PETG ₹2.5 · ABS ₹2.3 · TPU ₹4.0 · ASA ₹3.0 · RESIN ₹6.0 (per g) | filament cost per gram |
| `MACHINE_RATE` | ₹25 /hr | electricity + printer depreciation + maintenance |
| `SIZE_HANDLING` | S ₹20 · M ₹40 · L ₹80 · XL ₹150 | post-processing / packing |
| `WASTE_BUFFER_PCT` | +10% | covers failed prints / supports / waste |
| `SHIPPING` | S ₹50 · M ₹70 · L ₹110 · XL ₹180 | per-size shipping, baked into the listed price |
| `MARGIN_MULTIPLIER` | ×1.8 | profit (1.8 = 80% margin on cost+shipping) |
| `PRICE_FLOOR` | ₹149 | never list below this |
| `ROUND_TO` | ₹10 | round listed price up to nearest ₹10 |
| `MRP_MULTIPLIER` | ×2.5 | MRP = listed × this (keep in the 2–3 range) → shows ~60% off |

**Worked example** (`grams 180, hours 6.5, PLA+, size M`):
Material ₹360 + Machine ₹163 + Setup ₹40 + Handling ₹40 = ₹603, +10% waste = **cost ₹663**;
+ shipping ₹70 = ₹733; × 1.8 margin → **listed ₹1,320**; × 2.5 → **MRP ₹3,300 (−60%)**.

> All values are tunable in one place (`PRICING_CONFIG`). Because the engine reads stored inputs
> (`est_grams`, `est_print_hours`, `material`, `size_class`), re-pricing the whole catalogue after
> a cost change is a single importer re-run. **§10 Q1:** confirm your real ₹ numbers before publishing.

---

## 7. Designer credit — name + a single Credits page

- **Product card** (`products.html`): small line "Design: **<designer>**" (plain text, no link).
- **Product detail** (`product-detail.html`): "Designed by **<designer>**" (plain text) + a small
  link "About design credits →" pointing to the global Credits page.
- **New page `credits.html`** — "Design Credits & Attribution":
  - Generous blanket attribution: TriAkar celebrates the global maker community; products may be
    based on or inspired by community designs; all credited creators retain their rights to their
    original works.
  - A clear **contact / takedown notice**: any designer who wants a listing changed, credited
    differently, or removed can email us and we act promptly.
  - This single page is the protective legal layer for the whole catalogue (no per-product legal text).
  - Link `credits.html` from the footer (`partials.js` / `shared.js`) so it's reachable site-wide.

---

## 8. End-to-end workflow (bulk, 60+)

1. **Fill** `product-intake.csv` (§5) — one row per product.
2. **Images** → upload to Cloudinary (`triakar/<slug>-n`), paste IDs into the `images` column.
3. **Import** → run `node server/scripts/import-products.js product-intake.csv`:
   - validates category/occasion/size against §4,
   - computes `price` via §6,
   - sets `commercial_ok` from the sheet (defaults false → triggers admin ⚠️),
   - upserts into Supabase `products` by `slug` (safe to re-run).
4. **Admin review** → Products tab shows ⚠️ on any `commercial_ok = false`/unknown-licence rows;
   owner modifies / removes / keeps.
5. **QA per product:** category+occasion valid · price computed & sane · ≥1 real image ·
   descriptions written · designer name present · renders on card + detail + correct occasion pill.
6. **Publish** → set `is_active = true`. Spot-check `products.html` + a couple of detail pages.

---

## 9. Execution plan (phased) — STATUS

- [x] **Phase A — Schema:** `server/db/migrations/004_listing_designer_occasions.sql` written (§3).
      *(Owner action: run it in Supabase SQL Editor.)*
- [x] **Phase B — Read path:** `productController.js` already `select('*')`; `upsertProduct` now
      persists occasions/source_url/license/commercial_ok/est_grams/est_print_hours/size_class.
      `enrichProduct()` prefers stored `occasions[]`, derives only as fallback. ✓ verified.
- [x] **Phase C — Display:** card "Design: …" line (`products.html`) + detail "Designed by …"
      with credits link (`product-detail.html`); `credits.html` built and linked from footer
      (`partials.js`). ✓ verified in preview.
- [x] **Phase D — Admin:** Occasions (multi-select), Size Class, Est. grams, Est. print hours,
      Source URL, Licence, Commercial-OK added to the product form; ⚠ licence-review badge added
      to the Products list. Save path persists them (graceful column-strip until migration runs).
- [x] **Phase E — Importer:** `server/scripts/import-products.js` + `product-intake.csv` template +
      §6 pricing function (coefficients in one config block). CSV parser verified.
- [ ] **Phase F — First batch:** confirm pricing coefficients (§10), fill the CSV with the 60+
      products, upload images, run the importer, QA, publish. *(Needs owner inputs — see §10.)*

Nothing live breaks — every change is additive with safe defaults; admin save strips unknown
columns automatically until the migration is applied.

---

## 10. Open inputs needed before Phase F

1. **Pricing coefficients (§6):** confirm/replace the draft numbers (your real filament ₹/g,
   machine ₹/hr, markup, floor). Without these, prices stay clearly-marked placeholders.
2. **The actual product list / data source:** the MakerWorld set (names, designers, sizes,
   materials, est. grams & print hours) — as a CSV/export, or we capture it into `product-intake.csv`.
3. **Images:** do we have render/photo files to upload, or do we list with placeholders first
   and add images per product later?
4. **Credits page wording:** approve the blanket attribution + takedown text, or tweak the tone.
```
