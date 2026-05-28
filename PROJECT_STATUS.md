# TriAkar — Project Status

_Last updated: 2026-05-28_

A living snapshot of what is built, what is pending, and what needs manual
action. Read alongside `CLAUDE.md` (brand + engineering rules).

---

## Stack & Hosting

| Layer        | Technology                                   | Where it runs                  |
|--------------|----------------------------------------------|--------------------------------|
| Frontend     | Static HTML5 + CSS3 + vanilla JS             | Vercel — www.triakar.com       |
| Backend API  | Node.js + Express                            | Render — triakar.onrender.com  |
| Database     | Supabase (PostgreSQL + RLS)                  | qarjbmogersuaerkhlcu.supabase.co |
| Auth         | Supabase Auth (email/password)               | Supabase                       |
| Payments     | Razorpay (INR only)                          | —                              |
| Email        | Resend (from hello@triakar.com)              | —                              |
| Media        | Cloudinary                                   | —                              |
| Analytics    | Google Analytics 4 (G-FDM00KSRD5) + Vercel   | —                              |
| Monitoring   | Sentry                                        | —                              |

**Routing note:** `vercel.json` sets `cleanUrls:true` and `trailingSlash:false`.
Canonical URLs are extension-less (`/about`, not `/about.html`); `.html` URLs
308-redirect to the clean form. Always use clean URLs in sitemap, canonicals,
and internal JSON-LD.

---

## Completed

### Backend / data
- Orders migration `server/db/migrations/001_orders_invoice_and_indexes.sql`
  (invoice columns, backfill, indexes, `decrement_stock` RPC) — **idempotent**.
- `GET /api/payments/key` route (auth-guarded) returns Razorpay public key id.
- Order confirmation emails retry once on transient Resend failure.
- Invoice numbers (`TRK-YYYYMMDD-XXXX`) surfaced in Razorpay dashboard notes.
- Confirmation email resolves customer email when a saved address is used.

### Frontend bug fixes
- Order-confirmation page queries Supabase directly (RLS via `setSession`),
  falls back to Express API; items render from `items` or `order_items`.
- Order-ID copy button (clipboard API + textarea fallback).
- Track-order page: awaits auth session before query; query corrected.
- **BUG 5 — auth token expiry:** `js/auth.js` now has `isExpired()`,
  `apiFetch()` (401 → force-refresh → retry → graceful expire), proactive
  near-expiry refresh in `init()`, and a `ta-auth-expired` event.
  `shared.js` calls `Auth.init()` on load; account page uses `Auth.apiFetch`
  and shows a "session expired, sign in again" message instead of failing.

### SEO / GEO
- `sitemap.xml` rewritten with clean URLs + `lastmod`.
- `robots.txt` with AI-crawler allow-list; private/preview pages disallowed.
- `llm.txt` with structured brand/entity context.
- Per-page JSON-LD across content pages; homepage schema expanded.
- Local landing pages: `3d-printing-noida`, `3d-printing-greater-noida`,
  `replacement-parts-noida`, `3d-printed-gifts-delhi`.

### Content pages (new)
- `faq.html` — 12-item CSS accordion, FAQPage + BreadcrumbList JSON-LD.
- `materials.html` — PLA+/ABS/PETG guide, WebPage + BreadcrumbList JSON-LD.
- `how-it-works.html` — 5-step order process, HowTo + BreadcrumbList JSON-LD.
- All three registered in `sitemap.xml`.

### Architecture / performance
- Nav, drawer, and footer extracted into `partials.js`
  (`window._NAV_HTML` / `_DRAWER_HTML` / `_FOOTER_HTML`), injected pre-paint.
- Service worker, lazy Supabase load, deferred scripts.
- Lazy-loaded images on homepage, product-detail, and product-listing grids.

---

## Pending / Not Yet Built

- **Admin panel** — partial; full product + order management not complete.
- **Corporate gifting inquiry flow** — separate from cart; email notification
  not wired end-to-end.
- **DB-backed persistent cart** — cart is currently localStorage only.
- **Razorpay webhook** — verify/confirm payment server-side via webhook.
- Broader automated test coverage.

---

## ⚠️ Required Manual Action

1. **Run the DB migration.** Open Supabase → SQL Editor and execute
   `server/db/migrations/001_orders_invoice_and_indexes.sql`. It is idempotent
   (safe to re-run). Until this runs, invoice numbers and stock decrement RPC
   are unavailable in production.
2. **Confirm env vars on Render** (Razorpay keys, Resend key, Supabase service
   role) — never commit `.env`; document keys in `server/.env.example`.

---

## Conventions

- Prices in INR, displayed with ₹.
- No guest checkout — account required.
- Order statuses: `pending → confirmed → processing → shipped → delivered`.
- Conventional commits (`feat:`, `fix:`, `perf:`, `style:`, `docs:`…).
- Visual design, palette, and layout are locked — content/logic changes only.
