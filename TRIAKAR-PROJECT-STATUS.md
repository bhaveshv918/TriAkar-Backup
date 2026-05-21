# TriAkar — Project Status & Handoff

> Single source of truth for the current state of the TriAkar website.
> Read this top-to-bottom and you can continue the work without asking questions.

---

## SECTION 1 — PROJECT OVERVIEW

**What is TriAkar**
- A premium Indian **3D printing service & design brand** based in Greater Noida West.
- Sells 3D‑printed desk accessories, home décor, personalised gifts, custom replacement parts, prototypes, and corporate/bulk gifting.
- **Location / shop:** Shop No. 25, Karan Singh Market, Chhoti Milak, Greater Noida West, Gautam Buddha Nagar, Uttar Pradesh – 201318.
- **Serving:** Delhi NCR (Noida, Greater Noida, Faridabad, Gurugram, Delhi) + shipping across India.
- **Phone:** +91 92175 55833 (open all days, 11 AM – 9 PM).
- **Email:** hello@triakar.com (admin/notification address). *(Note: some older instruction files still reference hello@triakar.in.)*
- **Brand line history:** "Designed globally. Made responsibly in India." — **retired/removed** from all live surfaces.

**What the website does**
- E‑commerce (browse products, cart, checkout, Razorpay payment, order tracking).
- Services / custom orders (custom enquiry form, callback requests, corporate/bulk gifting).
- User accounts (signup/login, profile, saved addresses, order history, password reset).
- Admin panel for managing orders, customers, products, messages, enquiries, callbacks, and a recycle bin.

**Current live URLs**
- Primary domain: **https://triakar.com** (and www).
- Legacy domain: https://triakar.in (kept as CORS fallback during migration).
- Vercel preview: https://triakar.vercel.app
- Backend API: **https://triakar.onrender.com** (health: `/health`).

**Tech stack**
- **Frontend:** Static HTML5 + CSS3 + vanilla JavaScript (no framework). Hosted on **Vercel** (auto‑deploys from GitHub `main`).
- **Backend:** **Node.js + Express (ES Modules, `"type":"module"`)**. Hosted on **Render** (`triakar-api`, free tier). Entry: `server/index.js`.
- **Database + Auth:** **Supabase** (PostgreSQL + Supabase Auth). Project ref: `qarjbmogersuaerkhlcu` (`https://qarjbmogersuaerkhlcu.supabase.co`). Frontend uses the **anon key** (public) via `getSB()` in `shared.js`; backend uses the **service‑role key**.
- **Payments:** **Razorpay** (currently test keys).
- **Repo:** GitHub `bhaveshv918/TriAkar`. Frontend files live at repo root; backend in `/server`.

**Third‑party services connected**
| Service | Purpose |
|---|---|
| Supabase | Database, auth, row data for all forms/orders |
| Render | Backend API hosting |
| Vercel | Frontend hosting + domain |
| Razorpay | Online payments (test mode) |
| Resend | Transactional emails (order/enquiry/contact/callback) |
| Google Analytics 4 | Traffic + e‑commerce event analytics (`G-FDM00KSRD5`) |
| Sentry | Frontend JS error monitoring (loader id `4f9ce894558c957a725b20eee4dd58eb`) |
| Cloudinary | Product image CDN (cloud `dtpibsruo`) |
| UptimeRobot | Uptime monitoring + keeps Render awake (setup guide only) |
| Google Search Console | SEO indexing (setup guide only) |
| Hostinger / Cloudflare | Domain DNS + email routing (managed by owner) |

---

## SECTION 2 — COMPLETE FILE INVENTORY

### Frontend (repo root)
| File | What it does | State | Notes/Issues |
|---|---|---|---|
| `index.html` | Homepage: hero + animation, "What We Make" 3‑group section, reviews, FAQ, footer. GA4+Sentry+LocalBusiness schema in head. | Complete | Featured products are hardcoded (4 cards), not from `products-data.js`. |
| `products.html` | Shop listing. Renders product grid from `products-data.js` (instant) then background API sync. Filters, sort, MRP/discount on cards. | Complete | `loadFromLocal` + `syncFromAPI` (3s timeout). |
| `product-detail.html` | Single product page. **Has its own `PRODS` object** (separate from products-data.js). Priced variants, MRP/discount, colour selector. | Complete | ⚠ Detail page only knows products in its own `PRODS` map — must add new products here too for a detail page. |
| `products-data.js` | Master product catalog (`PRODUCTS` object) used by the shop grid + Cloudinary `getProductImage()`. | Complete | Source of truth for the grid only. |
| `cart` (in `shared.js`) | Cart add/remove/qty, localStorage + server sync. | Complete | — |
| `checkout.html` | Standalone checkout page (address + Razorpay). Uses `Auth.authHeader()`. | Complete | The in‑cart **modal** in shared.js is the primary checkout path. |
| `account.html` | Auth (login/signup/forgot/reset), dashboard (orders, profile, addresses, settings), change‑password modal, password rules, DOB 18+, Glorida font embedded. | Complete | Profile mobile relies on `fix-trigger.sql` being run. |
| `admin.html` | Admin panel. Tabs: Callbacks, Orders, Customers, Products, Messages, Custom Enquiries, Categories, Security Logs, **Recycle Bin**. Own login (Supabase auth + `ADMIN_EMAILS` whitelist + IP lockout). | Complete | Reads/writes Supabase directly (mostly bypasses `/api/admin`). |
| `custom.html` | Custom order page: enquiry form → `custom_enquiries`, callback modal → `callback_requests`. Generates `TRK-CUS-…`/`TRK-CALL-…` refs. | Complete | WhatsApp auto‑open after enquiry was **removed** (per request). |
| `contact.html` | Contact form → `contact_submissions` (12‑digit ref), merged single form, FAQ, map. | Complete | — |
| `track-order.html` | Order tracking via `track_order_public` RPC (by TRK order_id). | Complete | — |
| `stories.html` | "Real orders" stories/case studies page. | Complete | — |
| `about.html` | About page. Animated triangle (rotation, no centre dot), 3 Hindi lines, trust section. | Complete | — |
| `order-confirmation.html` | Post‑order confirmation page. | Complete | — |
| `privacy.html` / `terms.html` / `refund-policy.html` | Legal pages. "Last updated: April 2026". | Complete | — |
| `updates.html` | Updates/changelog page. | Complete | Not in sitemap. |
| `shared.js` | Core JS: Supabase `getSB()`, GA4 `gtagEvent`, nav active state, cart, checkout modal + `placeOrder` (Razorpay), address resolver, phone field, callback modal, Sentry init, `addToCartBtn`. | Complete | Single most important frontend file. |
| `shared.css` | Global styles, CSS variables, nav, footer, buttons (`.btn-magnetic`, `.add-to-cart-btn`), FAQ, checkout modal, saved‑address picker. | Complete | — |
| `js/auth.js` | `Auth` module: signup/login/logout/getUser/getToken/authHeader (talks to backend `/api/auth`). | Complete | — |
| `hero-print-animation.{js,css,html}` | The homepage 3D‑printer animation. LAYERS/MATERIAL labels removed. | Complete | — |
| `sitemap.xml` / `robots.txt` | SEO. URLs on triakar.com. robots disallows /admin.html, /account.html. | Complete | — |
| Setup `.txt` files | `RENDER-ENV-UPDATE.txt`, `RENDER-NEW-ENV-VARS.txt` (gitignored — secrets), `SUPABASE-CONFIG-STEPS.txt`, `UPTIMEROBOT-SETUP.txt`, `SEARCH-CONSOLE-SETUP.txt`. | Reference | Manual owner steps. |
| `CLAUDE.md` | Project briefing / brand bible. | Reference | — |
| `README.md`, `DEPLOYMENT.md` | Repo docs. | Reference | — |

### Backend (`/server`)
| File | What it does | State |
|---|---|---|
| `index.js` | Express app: env validation, helmet+CSP, CORS allow‑list, rate limiters, body limit 10kb, xss/mongo‑sanitize/hpp, timeout, routes, 404, error handler. | Complete |
| `routes/*.js` | products, orders, auth, payments, cart, admin, inquiries, addresses, notify. | Complete |
| `controllers/*.js` | product, order, payment, address, admin, cart, inquiry controllers. | Complete |
| `middleware/` | `authMiddleware.js` (requireAuth), `requireAdmin.js`, `errorHandler.js` (CORS→403, prod hides messages). | Complete |
| `services/emailService.js` | Resend emails (6 functions). ESM. | Complete |
| `services/cloudinaryService.js` | Cloudinary URL helpers. ESM. | Complete |
| `db/supabaseClient.js` | Supabase service‑role client. | Complete |
| `db/*.sql` | schema.sql, schema-v2.sql, admin-setup.sql, contact-schema.sql, custom-enquiries-schema.sql, callbacks-schema.sql, fix-trigger.sql, recycle-bin-schema.sql. | Complete (some need to be RUN in Supabase) |
| `render.yaml` | Render service config (NODE_ENV=production, PORT 10000, env var declarations). | Complete |
| `.env` / `.env.example` | Local secrets (gitignored) / template. | `.env` set locally |

---

## SECTION 3 — FEATURES BUILT AND STATUS

| # | Feature | Status | Files | Notes / Pending |
|---|---|---|---|---|
| 1 | Homepage | Working | index.html, shared.* | Featured products hardcoded. |
| 2 | Products page | Working | products.html, products-data.js | Instant local render + API sync; MRP/discount on cards. |
| 3 | Product detail | Working | product-detail.html | Separate `PRODS` map — add new products here too. |
| 4 | Cart system | Working | shared.js, shared.css | localStorage + server sync. |
| 5 | Checkout flow | Working | shared.js (modal), checkout.html | Login required (gate). Saved‑address picker, address resolver. |
| 6 | Razorpay payment | Working (test) | shared.js, server/controllers/paymentController.js | Needs Razorpay live keys for production. |
| 7 | WhatsApp order option | Working | shared.js | Checkout offers Razorpay + WhatsApp Order (COD removed). |
| 8 | Auth (signup/login/logout) | Working | account.html, js/auth.js, server/routes/auth.js | Backend uses Supabase admin createUser. |
| 9 | Forgot/reset password | Working* | account.html | *Reset link domain depends on Supabase Site URL config (see Section 8). Generic message for security. |
| 10 | Account dashboard | Working | account.html | Orders/Profile/Addresses/Settings tabs. |
| 11 | Saved addresses | Working | account.html, server/controllers/addressController.js | Used by checkout picker. |
| 12 | Order history | Working | account.html, server/routes/orders.js | — |
| 13 | Personal details/profile | Working | account.html | DOB 18+, unique mobile, read‑only mobile w/ Update, no alternate mobile. |
| 14 | Admin panel | Working | admin.html | All tabs + Recycle Bin. Inquiries tab removed. |
| 15 | Custom order form | Working | custom.html | → custom_enquiries; GA4 lead + /api/notify email. |
| 16 | Contact form | Working | contact.html | → contact_submissions; GA4 lead + /api/notify email. |
| 17 | Callback request | Working | custom.html, shared.js | → callback_requests; admin Callbacks tab; email alert. |
| 18 | Track order | Working | track-order.html | RPC track_order_public. |
| 19 | Stories page | Working | stories.html | — |
| 20 | About page | Working | about.html | Animated triangle. |
| 21 | Custom order page | Working | custom.html | — |
| 22 | Email notifications (Resend) | Working* | server/services/emailService.js, routes/notify.js, paymentController.js | *Requires RESEND_API_KEY on Render + verified sending domain. |
| 23 | Google Analytics 4 | Working | all HTML heads, shared.js events | add_to_cart, begin_checkout, purchase, generate_lead. |
| 24 | Sentry | Working | all HTML heads, shared.js init | — |
| 25 | Cloudinary | Working | products-data.js, server/services/cloudinaryService.js | Add `cloudinaryId` to a product → real photo shows. |
| 26 | Security | Working | server/index.js, middleware | helmet, CORS, rate limits, sanitization, timeouts. |
| 27 | SEO | Working | all HTML, sitemap.xml, robots.txt, index schema | LocalBusiness JSON‑LD on index. |
| 28 | Domain (triakar.com primary) | Working* | all files, server CORS | *DNS/Vercel domain + Supabase/Razorpay URL config are owner manual steps. |
| 29 | Recycle Bin (soft delete) | Working* | admin.html | *Requires `recycle-bin-schema.sql` run in Supabase. |

---

## SECTION 4 — DATABASE SCHEMA (Supabase / PostgreSQL)

> Defined across `server/db/schema.sql`, `schema-v2.sql`, and the per‑feature migration files. RLS is enabled on all tables.

- **profiles** — `id uuid PK (FK auth.users)`, `full_name text`, `phone text`, `mobile text`*, `email text`*, `nickname`, `gender`, `date_of_birth`, `anniversary_date`, `created_at`. *(`mobile`/`email` added by `fix-trigger.sql`.)* RLS: users read/insert/update own. `handle_new_user()` trigger fills full_name+mobile+email from auth metadata on signup.
- **products** — `id uuid PK`, `name`, `slug`, `description`, `price numeric`, `category`, `stock_qty`, `images[]`, `is_customizable`, `is_active`, `created_at`. RLS: public read active.
- **orders** — `id uuid PK`, `user_id`, `address_id`, `status`, `total_amount`, `razorpay_order_id`, `razorpay_payment_id`, `shipping_address jsonb`, `created_at` (v1) **plus** v2 cols: `order_id text` (TRK id), `customer_name/email/phone`, `items jsonb`, `subtotal`, `shipping_charge`, `payment_method`, `payment_status`, `order_status`, `tracking_number`, `tracking_vendor`, `admin_notes`, `deleted_at`*, `deleted_by`*. RLS: users own. *(soft‑delete cols from `recycle-bin-schema.sql`.)*
- **order_items** — `id uuid PK`, `order_id FK`, `product_id FK`, `quantity`, `unit_price`, `customization_notes`.
- **carts** — per‑user cart persistence (`user_id`, `items jsonb`). Used by `/api/cart`.
- **user_addresses** — `id uuid PK`, `user_id`, `full_name`, `phone`, `address_line1/2`, `landmark`, `city`, `district`, `state`, `pincode`, `country`, `is_default`, `created_at`. RLS: users own.
- **contact_submissions** — `id`, `name`, `email`, `phone`, `subject`, `message`, `reference_id`, `is_existing_customer`, `order_id`, `is_read`, `deleted_at`*, `deleted_by`*, `created_at`. RLS: anon insert, authenticated select/update/delete.
- **custom_enquiries** — `id`, `reference_id`, `name`, `email`, `phone`, `what_needed`, `material_preference`, `budget_range`, `source`, `is_read`, `deleted_at`*, `deleted_by`*, `created_at`. RLS: anon insert, authenticated select/update/delete.
- **corporate_inquiries** — `id`, `company_name`, `contact_name`, `email`, `phone`, `product_interest`, `message`, `is_responded`, `created_at`. Written by backend `/api/inquiries`. *(Admin "Inquiries" tab was removed; table still exists.)*
- **callback_requests** — `id`, `reference_id`, `name`, `phone`, `topic`, `preferred_time`, `is_called`, `deleted_at`*, `deleted_by`*, `created_at`. RLS: anon insert, authenticated select/update/delete.
- **admin_logs** — admin login attempts / security logs (used by admin.html login + Security Logs tab).

*Columns marked \* require the corresponding migration SQL to be run.*

---

## SECTION 5 — API ROUTES (Express, base `/api`)

| Method + Path | Purpose | Auth | Status |
|---|---|---|---|
| GET `/health` | Health check | No | Working |
| GET `/api/products` | All products | No | Working |
| GET `/api/products/category/:category` | Products by category | No | Working |
| GET `/api/products/:slug` | Product by slug | No | Working |
| POST `/api/auth/signup` | Create user (Supabase admin createUser + profile upsert) | No | Working |
| POST `/api/auth/login` | Login (returns access_token + user) | No | Working |
| POST `/api/auth/logout` | Logout | Bearer | Working |
| GET `/api/cart` | Get saved cart | Yes | Working |
| PUT `/api/cart` | Save cart | Yes | Working |
| POST `/api/orders` | Create order | Yes | Working |
| GET `/api/orders` | User's orders | Yes | Working |
| GET `/api/orders/:id` | Single order | Yes | Working |
| POST `/api/payments/create-order` | Create Razorpay order (requires `address_id`) | Yes | Working |
| POST `/api/payments/verify` | Verify payment signature + confirm + send emails | Yes | Working |
| GET `/api/addresses` | List addresses | Yes | Working |
| GET `/api/addresses/default` | Default address | Yes | Working |
| POST `/api/addresses` | Create address | Yes | Working |
| PUT `/api/addresses/:id` | Update address | Yes | Working |
| DELETE `/api/addresses/:id` | Delete address | Yes | Working |
| PUT `/api/addresses/:id/default` | Set default | Yes | Working |
| POST `/api/inquiries` | Corporate inquiry → corporate_inquiries | No | Working |
| POST `/api/notify` | Send contact/enquiry/callback admin emails | No (rate‑limited) | Working |
| GET `/api/admin/products` … | Admin product CRUD + order status | Yes + admin role | Working (admin.html mostly uses Supabase directly) |

Rate limits: general 100/15min; `/api/auth` 10/15min; `/api/payments` 20/hr; `/api/inquiries`,`/api/addresses` 5/hr; `/api/notify` 10/hr.

---

## SECTION 6 — ENVIRONMENT VARIABLES (names only)

| Variable | Service | Where | Status |
|---|---|---|---|
| `NODE_ENV` | Node | Render + render.yaml | SET (render.yaml); verify on Render |
| `PORT` | Node | Render (10000) / local | SET |
| `FRONTEND_URL` | CORS | Render / local | SET (triakar.com) |
| `SUPABASE_URL` | Supabase | Render / local | SET locally; verify Render |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Render / local | SET locally; verify Render |
| `SUPABASE_ANON_KEY` | Supabase | (frontend uses hardcoded anon in shared.js) | N/A backend |
| `RAZORPAY_KEY_ID` | Razorpay | Render / local | SET (test) |
| `RAZORPAY_KEY_SECRET` | Razorpay | Render / local | SET (test) |
| `RESEND_API_KEY` | Resend | Render / local | SET locally; **NEEDS to be set on Render** |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | Render / local | SET locally; **NEEDS to be set on Render** |
| `CLOUDINARY_API_KEY` | Cloudinary | Render / local | SET locally; **NEEDS to be set on Render** |
| `CLOUDINARY_API_SECRET` | Cloudinary | Render / local | SET locally; **NEEDS to be set on Render** |

`server/.env` and `RENDER-NEW-ENV-VARS.txt` are **gitignored** (contain real secrets). Never commit them.

---

## SECTION 7 — THIRD‑PARTY SERVICES

| Service | Purpose | Account | Dashboard | Status | Manual steps pending |
|---|---|---|---|---|---|
| Supabase | DB + Auth | owner | supabase.com (ref qarjbmogersuaerkhlcu) | Active | Run pending SQL (see Section 10); set Auth Site URL = triakar.com + redirect URLs |
| Render | Backend host | owner | dashboard.render.com (triakar-api) | Active | Add RESEND_API_KEY + CLOUDINARY_* + NODE_ENV; redeploy |
| Vercel | Frontend host | owner | vercel.com | Active | Add triakar.com as domain |
| Razorpay | Payments | owner | dashboard.razorpay.com | Active (test) | Switch to live keys; set website URL |
| Resend | Emails | triakarform@gmail.com (per dashboard) | resend.com | Domain **verified** (triakar.com) | Confirm RESEND_API_KEY on Render; from‑address is hello@triakar.in (consider switching to .com) |
| Google Analytics 4 | Analytics | owner | analytics.google.com (G-FDM00KSRD5) | Active | — |
| Sentry | Error monitoring | owner | sentry.io | Active | — |
| Cloudinary | Image CDN | owner (cloud dtpibsruo) | cloudinary.com | Active | Upload product photos, add cloudinaryId |
| UptimeRobot | Uptime + keep‑awake | owner | uptimerobot.com | Not set up | Follow UPTIMEROBOT-SETUP.txt |
| Google Search Console | SEO | owner | search.google.com/search-console | Not set up | Follow SEARCH-CONSOLE-SETUP.txt; submit sitemap |
| Hostinger / DNS | Domain + email | owner | — | Active | Confirm DNS → Vercel; email routing for hello@triakar.com |

---

## SECTION 8 — KNOWN BUGS AND ISSUES

| Issue | Affected | Priority | Status |
|---|---|---|---|
| Password reset email link can point to localhost if Supabase **Site URL** not set to triakar.com | Supabase Auth config | High | Code fixed; **needs dashboard config** (SUPABASE-CONFIG-STEPS.txt) |
| Mobile number not in admin Customers until `fix-trigger.sql` run | profiles / signup | High | Code ready; **needs SQL run** |
| Recycle Bin delete buttons error until `recycle-bin-schema.sql` run | admin.html | High | Code ready; **needs SQL run** |
| `custom_enquiries` / `callback_requests` tables must exist for those forms to save | custom.html | High | Code ready; **needs SQL run** (schemas provided) |
| RESEND_API_KEY + CLOUDINARY_* not yet on Render → emails/images won't work in prod | server | High | **Needs Render env vars** |
| Product detail page uses a **separate `PRODS` map** from `products-data.js` — new products need adding in both | product-detail.html | Medium | By design; documented |
| Homepage featured products are hardcoded (not data‑driven) | index.html | Low | Cosmetic/curation |
| `corporate_inquiries` table orphaned (admin Inquiries tab removed) | admin | Low | Intentional |
| Razorpay still in **test mode** | payments | Medium (pre‑launch) | Switch to live before real sales |
| MRP/discount is displayed at ~65% off (auto) — keep MRP defensible for Legal Metrology compliance | products | Low | Business decision |

No known *broken* features. Everything builds and the server boots clean.

---

## SECTION 9 — WHAT WAS DONE IN THIS SESSION (chronological)

**Frontend**
1. v6 UX overhaul on the live codebase: 2‑colour logo (TRI accent / AKAR charcoal) sitewide, hero stats, merged "What We Make", 6 authentic reviews, footer "Delhi NCR" updates, Hindi font sizing, "Shop Now"→"Login" nav.
2. Per‑PDF fixes: nav orphan items removed, products SHOP spacing, track‑order spacing + WhatsApp card removal, contact page merged into one form + FAQ + studio text + phone format, about page (stats removed, triangle bugs, Delhi NCR).
3. Mobile nav parity (Login + Cart visible, drawer cleaned). About page triangle: text removed then **restored 3 Hindi lines**, rotation animation, centre dot removed.
4. Account page: forgot/reset password flow, signup 4 mandatory fields, unique mobile check, in‑page change‑password modal, live password‑rules checklist, DOB 18+ validation, alternate mobile removed (primary mobile read‑only + Update), Glorida @font‑face embedded.
5. Nav active‑state rewritten for clean URLs (/about etc.). Hero "Gifting from ₹149" stat aligned.
6. Checkout: strict login gate + redirect/resume, saved‑address picker (visible radios + auto‑select), close button + backdrop + Esc, **address_id** sent to create‑order, single‑order enrichment (no duplicate).
7. GA4 + Sentry added to all 15 HTML heads; GA4 events + Sentry init + callback notify in shared.js; Cloudinary `getProductImage` in products‑data.js; product cards use Cloudinary with SVG fallback.
8. Removed WhatsApp auto‑open after custom enquiry. Removed em‑dash connectors / grammar audit / capitalisation fixes. Removed COD everywhere.
9. **Recycle Bin** in admin: soft delete + multi‑select + restore + permanent delete across Messages/Custom Enquiries/Callbacks/Orders. Admin full‑message viewer. Removed Inquiries tab.
10. Added **Custom 3D Name Letters** product (gifting) with priced variants (1 Name ₹499 / 2 Names ₹799 / With Logo ₹1199), colour options, and sitewide **MRP strike‑through + % OFF** display (~65%).

**Backend**
11. Resend email service (6 templated emails) + `/api/notify` route; order emails wired into `verifyPayment`.
12. Cloudinary service. Email template fixes (real phone, Georgia serif logo, tagline removed, "design team"→"team").

**Config**
13. Migrated all URLs to **triakar.com** (canonical, og, schema, sitemap, robots, CORS allow‑list, .env.example), kept triakar.in as CORS fallback. Copyright → © 2026. Policies → "Last updated: April 2026".

**Security**
14. Helmet + CSP, strict CORS, rate limiters, body size limit, xss‑clean/mongo‑sanitize/hpp, request timeout, trust proxy, env validation, prod‑safe error handler, 404 handler.

**SaaS / DB**
15. SQL migrations authored: `contact-schema.sql`, `custom-enquiries-schema.sql`, `callbacks-schema.sql`, `fix-trigger.sql`, `recycle-bin-schema.sql`. Instruction files for Render/Supabase/UptimeRobot/Search Console.

**Declined (kept safe):** Did NOT list Batman/MakerWorld or One Piece HueForge products (copyright/trademark + non‑commercial licence risk). Only listed the generic customizable Name Letters product.

---

## SECTION 10 — WHAT STILL NEEDS TO BE DONE (priority order)

1. **Run pending SQL in Supabase** — `fix-trigger.sql`, `recycle-bin-schema.sql`, `custom-enquiries-schema.sql`, `callbacks-schema.sql`, `contact-schema.sql`. *Why:* forms/admin features depend on these tables/columns. *Complexity:* Simple. *Dependency:* none.
2. **Set Render env vars** — RESEND_API_KEY, CLOUDINARY_* , NODE_ENV. *Why:* emails + images + prod errors. *Simple.*
3. **Supabase Auth URL config** — Site URL = triakar.com + redirect URLs. *Why:* password reset links. *Simple.*
4. **Verify Resend from‑address** — switch hello@triakar.in → hello@triakar.com if domain moved. *Simple.*
5. **Razorpay live keys** before taking real payments. *Medium.* Dependency: business KYC.
6. **Add real product photos** to Cloudinary + `cloudinaryId` per product. *Simple.* Ongoing.
7. **Add more products** (data‑drive homepage featured; add detail‑page `PRODS` entries). *Medium.*
8. **UptimeRobot + Search Console** setup. *Simple.*
9. Optional: make homepage featured products data‑driven; unify product detail with `products-data.js`. *Complex.*

---

## SECTION 11 — HOW TO RUN LOCALLY

**Prerequisites:** Node 18+, Git, a static server (or VS Code Live Server), Supabase project, Razorpay test keys.

```
# 1. Clone
git clone https://github.com/bhaveshv918/TriAkar.git
cd TriAkar

# 2. Backend deps
cd server
npm install

# 3. Create server/.env (see server/.env.example) with:
#    NODE_ENV=development, PORT=3000, FRONTEND_URL=http://localhost:5500
#    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#    RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
#    RESEND_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

# 4. Start the API
npm start            # or: npm run dev   (node --watch)
# → "TriAkar server running on port 3000"

# 5. Serve the frontend (repo root) on port 5500
#    e.g. VS Code Live Server, or:  npx http-server . -p 5500 -c-1
#    Open http://localhost:5500/index.html
```
Frontend auto‑detects localhost and points the API at `http://localhost:3000`.

---

## SECTION 12 — DEPLOYMENT PROCESS

- **Frontend (Vercel):** push to GitHub **`main`** → Vercel auto‑deploys the static site. Hard‑refresh (Ctrl+Shift+R) to bypass cache.
- **Backend (Render):** Render auto‑deploys from `main` (`server/` rootDir, `npm install` build, `node index.js` start). Or trigger a manual deploy in the Render dashboard.
- **Typical flow:**
  ```
  git add <files>
  git commit -m "type: message"
  git push origin <branch>:main      # or push main directly
  ```
- **Post‑deploy steps:** ensure Render env vars exist; run any new SQL migrations in Supabase; for new SaaS keys, add to Render then redeploy.
- **Branches:** product‑listing work currently on **`feature/listings`**; production tracks **`main`**.

---

## SECTION 13 — BRAND GUIDELINES SUMMARY

**Colours (CSS variables in shared.css `:root`)**
- `--ivory #F4F2EC`, `--ivory-2 #EAE7DF`, `--white #FAFAF8`
- `--charcoal #161614`, `--char-2 #252522`
- `--stone #88847E`, `--stone-l #C0BCB4`, `--stone-p #E2DED7`, `--warm #645F59`
- **`--accent #C4622A`** (brand orange), `--accent-l #D98B50`
- Discount/savings green used in UI: `#2D8A4E`

**Fonts**
- `--font-g` = **"Glorida"** (custom serif, base64 @font‑face embedded; fallback Georgia, serif) — used for the logo + display headings.
- `--font-b` = **"Manrope"** (body).
- `--font-h` = **"Noto Sans Devanagari"** (Hindi त्रिआकार text).

**Logo rules**
- Wordmark: `TRI` in **#C4622A (accent)**, `AKAR` in **#161614 (charcoal)** — uppercase, letter‑spaced.
- Hindi त्रिआकार below in Devanagari, smaller.
- In dark‑background emails the logo is TRI white / AKAR accent (Glorida → Georgia fallback since email clients strip custom fonts).

**Tone of voice**
- Premium, minimal, confident, human. Short direct sentences. Indian yet globally appealing.

**Copy rules (must follow)**
- **No em‑dash connectors** in body copy — use comma/period/colon.
- No AI‑sounding filler. Write like a person.
- Always capitalise: **3D, PLA+, WhatsApp, Razorpay, Noida**.
- Prices in **₹ (INR)** only — **no USD anywhere**.
- Footer serving line: "Serving Delhi NCR: Noida, Greater Noida, Faridabad, Gurugram, Delhi. Shipping across India."
- Do **not** reintroduce: "Designed globally, made responsibly", COD/Cash on Delivery, the "Inquiries" admin tab.

**What NOT to do**
- No copyrighted‑character / licensed‑IP products (Batman, anime/One Piece, etc.) or other creators' non‑commercial 3D models.
- No cluttered UI, no Lorem Ipsum, no random colours outside the palette.
- Never expose secrets in frontend or commits.

---

## SECTION 14 — IMPORTANT DECISIONS MADE

- **Soft‑delete over hard delete** in admin: items go to a Recycle Bin (recoverable); only contact/enquiry/callback can be permanently deleted; **orders are restore‑only** (never truly destroyed — financial records). Deletions recorded via `deleted_at` + `deleted_by`.
- **Login required for checkout** (strict, both client gate + modal guard). No guest checkout.
- **Single order record** for online payments: the server `create-order` row is enriched after payment (TRK id, customer fields) rather than creating a second RPC order — avoids duplicates.
- **COD removed** entirely; payment options are Razorpay (online) + WhatsApp Order only.
- **triakar.com is primary**; triakar.in retained only as a CORS fallback during migration.
- **Secrets never committed**: `server/.env` and `RENDER-NEW-ENV-VARS.txt` are gitignored; all backend keys read from `process.env`; GA4 ID, Sentry loader, Cloudinary cloud name are public client‑side IDs (safe in HTML).
- **Product detail page keeps its own `PRODS` map** (richer per‑product data: variants, specs, thumbnails) separate from the grid's `products-data.js` — intentional, but means new products are added in two places.
- **MRP/discount display** auto‑computes ~65% off when no explicit `mrp` is set, per the owner's "always show 50–70% off" rule — kept defensible MRP values.
- **Declined copyrighted/licensed product listings** (Batman, One Piece HueForge) for legal safety; only generic/own designs (e.g. Name Letters) are listed.
- **Email templates** use Georgia serif (closest web‑safe match to Glorida, since email clients strip custom fonts) and the real phone +91 92175 55833.

---

Last updated: 20 May 2026 | Generated by Claude Code from project files
