# TriAkar — E-Commerce Transformation Report

> **Scope:** Make TriAkar a world-class, buyer-friendly e-commerce experience.
> **Strategy chosen:** *Additive & safe* — build only genuine gaps, reuse every working
> backend (promos, reviews, cart, payments, webhooks), never rebuild or break a working system.
> **Date:** 2026-05-29
> **Branch:** `main`

---

## 1. Guiding Principles

This upgrade was executed under an explicit **additive & safe** mandate:

- **Reuse, don't rebuild.** Existing backends were kept as the source of truth:
  the `reviews` table, the `promo_codes` table + `/api/promo/validate`, the DB-backed
  cart (`/api/cart`), and the Razorpay payment + webhook flow were all left intact and
  wired into the new UI rather than replaced.
- **No schema conflicts.** The original spec proposed a second `product_reviews` table and
  an alternate `promo_codes` shape. These were **deliberately not created** — they would
  have collided with the live tables. The existing schema is the canonical one.
- **No breakage.** Every change is additive UI/markup or a new optional file. No working
  route, table, or page behaviour was removed.
- **Brand-consistent.** All new UI follows the premium, minimal, dark/ivory TriAkar
  aesthetic. No placeholder content, no off-palette colours, no inline styles where a
  CSS class exists.

---

## 2. What Shipped — by Section

### Part 1 · Catalog & Discovery (`products.html`)
- Product cards now carry a **wishlist heart** and a **Quick View** button (image hover).
- **Quick View modal** reads from an in-memory product map — view price, category,
  description and add to cart without leaving the grid.
- **Advanced filter row**: price range slider (max auto-computed from catalog) and an
  **in-stock-only** toggle, layered on top of the existing category/sort filters.
- All injected values pass through the shared `_esc()` HTML-escape helper.

### Part 2 · Product Detail (`product-detail.html`)
- **Save to Wishlist** button alongside the buy actions, with painted heart state.
- **Recently viewed** section (localStorage, max 12, newest first).
- **Product + BreadcrumbList JSON-LD** injected dynamically from live product data —
  price, currency (INR), availability, condition, seller, optional `aggregateRating`,
  and a Home › Shop › Product breadcrumb. Makes product pages eligible for Google
  rich results.

### Part 3 · Cart & Checkout
- Cart sidebar gained a **free-shipping progress bar** (threshold ₹999): shows
  "Add ₹X more for free shipping" and switches to an "unlocked free shipping" state.
- Richer **empty-cart state** with icon and a "Browse products" CTA.
- **Promo handling was reused, not duplicated** — `checkout.html` already validates codes
  via `/api/promo/validate`, so the cart deliberately does not re-implement it.

### Part 4 · Wishlist
- Wishlist module (in `shared.js`) — add/remove/toggle/has/count, server sync on login,
  guest→server merge, live heart painting, nav badge.
- Dedicated `wishlist.html` page and nav wishlist button with live count.

### Part 5 · Reviews & Ratings
- Reuses the existing `reviews` backend. Product-detail review UI is wired to it.
- *(No second reviews table was created — see Deferred.)*

### Part 6 · Promotions
- Reuses the existing `promo_codes` table + `/api/promo/validate`. Seed codes provided.

### Part 7 · Order Tracking
- `track-order.html` already ships a complete 5-step timeline
  (Confirmed → Printing → Quality Check → Dispatched → Delivered) with done/active dot
  states, order summary, item list, price breakdown, shipping address and courier info.
  Verified complete — no changes required.

### Part 8 · Account Dashboard (`account.html`)
- New **Saved Items** tab: loads the server-synced wishlist, renders product cards with
  add-to-cart and remove actions, an empty state, and `#saved` hash routing.

### Part 9 · Mobile + Bottom Nav
- App-style **mobile bottom nav** (Home · Shop · Saved · Cart · Account), injected
  site-wide via `partials.js`. Cart and wishlist badges reuse the existing
  `.cart-badge` / `.wishlist-badge` classes, so they stay in sync automatically.
- Hidden on product-detail pages (which have their own sticky buy-bar) and on desktop.
- Respects iOS safe-area insets; lifts the accessibility FAB clear of the bar.

### Part 10 · SEO + GEO + Structured Data
- Homepage already carries LocalBusiness/Organization, WebSite, FAQPage and Service
  JSON-LD; `products.html` has CollectionPage/ItemList; `about.html` has
  AboutPage + BreadcrumbList. **The missing piece — Product schema on product pages —
  was added** (Part 2 above).

### Part 11 · Trust Architecture
- Verified already strong: homepage trust strip (4 cards) + hero stats + testimonial
  trust bar; `about.html` "Why customers trust TriAkar" grid, values section and stats.
  No fabricated content was added.

### Part 12 · Performance / PWA
- **`manifest.json`** — installable PWA with name, icons, theme colour, and app shortcuts
  (Shop / Track / Account).
- **`offline.html`** — branded offline fallback that auto-reloads when the connection
  returns.
- **Service worker** (`sw.js`, already present) bumped to `ta-v5`, now pre-caches and
  serves `offline.html` as the HTML fallback. Registered site-wide via `partials.js`,
  which also injects the manifest link, `theme-color`, and Apple PWA meta tags.
- **`vercel.json`** — `no-cache` header for `sw.js` so updates propagate immediately;
  correct `application/manifest+json` content type.

### Part 13 · Backend Audit
- Existing routes (products, cart, orders, payments, promos, wishlist) reviewed and left
  as the source of truth. New UI consumes them; no endpoints were altered.

### Part 14 · Database
- No destructive changes. The `ecom-upgrade-schema.sql` (wishlists, order timeline) and
  promo seeds remain the additive migrations. The conflicting spec tables were not created.

### Part 15 · This Report
- You're reading it.

---

## 3. Files Touched

| File | Change |
|------|--------|
| `products.html` | Wishlist hearts, Quick View, advanced filters |
| `product-detail.html` | Wishlist save, recently viewed, Product/Breadcrumb JSON-LD |
| `account.html` | Saved Items dashboard tab |
| `shared.js` | Search overlay, cart free-ship progress + empty state, wishlist module |
| `shared.css` | Search overlay, cart progress, saved-items grid, mobile bottom nav |
| `partials.js` | PWA registration + meta injection, mobile bottom nav |
| `sw.js` | Cache bump, offline.html precache + fallback |
| `manifest.json` | **New** — PWA manifest |
| `offline.html` | **New** — offline fallback page |
| `vercel.json` | SW no-cache + manifest content-type headers |

---

## 4. Deliberately Deferred (and why)

These were out of the *additive & safe* scope because they require **new backend work**
that does not exist yet — building them blind would risk shipping broken UI:

- **"My Reviews" account tab** — no endpoint returns a user's own reviews. The `reviews`
  table exists, but a `GET /api/reviews?user=…` route would need to be built first.
- **"Notifications" account tab** — there is no notifications table or endpoint.

Both are good follow-ups once the corresponding backend routes are added. A **founder bio**
on `about.html` was also left out rather than fabricated — it needs real copy from the owner.

---

## 5. Verification

- `node --check` passes on `partials.js`, `sw.js`, `shared.js`.
- `manifest.json` and `vercel.json` parse as valid JSON.
- All new injected values are HTML-escaped (`_esc`, `_esc2`).
- Badges, cart, wishlist and promo flows continue to use their existing backends.

---

## 6. Commit Trail

```
feat: inject Product + BreadcrumbList JSON-LD on product detail pages
feat: add PWA (manifest, offline page, SW registration) + mobile bottom nav
feat: add Saved Items (wishlist) tab to account dashboard
feat: add free-shipping progress bar and richer empty state to cart
feat: add site-wide search overlay with live results and / shortcut
feat: add wishlist hearts, quick view, and advanced filters to products page
feat: add wishlist (saved items) — module, page, nav
feat: add wishlist API (per-user saved items)
feat: add ecom-upgrade schema (wishlists, order timeline) + promo seeds
```

*All work committed to `main` and pushed to the deploy remote (Vercel auto-deploys the
frontend; Render serves the API).*
