# TriAkar — System Map

> Rule: change only the file that owns the feature.
> Read this before touching any code.

---

## Feature Ownership

| Feature | Owns | Files |
|---------|------|-------|
| Cart (local + server sync) | `shared.js` → `Cart` IIFE | `shared.js`, `server/routes/cart.js` |
| Wishlist | `shared.js` → `Wishlist` IIFE | `shared.js`, `server/routes/wishlist.js` |
| Auth (login/signup/OTP/refresh) | `js/auth.js` → `Auth` object | `js/auth.js`, `server/routes/auth.js` |
| Token refresh | `js/auth.js` → `_maybeRefresh()` | `js/auth.js:53-84` |
| Nav auth dropdown | `shared.js` → `updateNavAuth()` | `shared.js` |
| Checkout flow | `checkout.html` inline script | `checkout.html`, `server/routes/payments.js` |
| Payment order creation | `server/controllers/paymentController.js` → `createOrder()` | `paymentController.js:19-188` |
| Payment verification + stock | `server/controllers/paymentController.js` → `verifyPayment()` | `paymentController.js:191-290` |
| Razorpay webhook | `server/controllers/webhookController.js` | `webhookController.js`, `server/routes/webhooks.js` |
| Order history (user) | `server/controllers/orderController.js` → `getOrdersByUser()` | `orderController.js:114-162` |
| Order detail | `server/controllers/orderController.js` → `getOrderById()` | `orderController.js:164-193` |
| WhatsApp order | `server/controllers/orderController.js` → `createWhatsAppOrder()` | `orderController.js:45-112` |
| Track order (public) | `server/index.js` → `GET /api/track/:id` | `index.js:213-239`, `track-order.html` |
| Admin panel | `admin.html` inline script | `admin.html`, `server/routes/admin.js`, `server/controllers/adminController.js` |
| Admin auth check | `server/middleware/requireAdmin.js` | `requireAdmin.js` |
| Product listing | `products.html` inline script | `products.html`, `server/routes/products.js` |
| Product detail | `product-detail.html` inline script | `product-detail.html`, `server/routes/products.js` |
| Pincode autofill | `shared.js` → `lookupPincode()`, `attachPincodeAutofill()` | `shared.js`, `server/routes/pincode.js` |
| Saved addresses | `server/routes/addresses.js` | `addresses.js` |
| Promo codes | `server/routes/promo.js` | `promo.js`, `paymentController.js:55-80` |
| Product reviews | `server/routes/reviews.js` | `reviews.js` |
| Email (order confirm, admin alert) | `server/services/emailService.js` | `emailService.js` |
| Phone OTP send/verify | `server/routes/auth.js` | `auth.js:17-92` |
| Search overlay | `shared.js` → search IIFE | `shared.js:795+` |
| Callback modal | `shared.js` → `openCallbackModal()` | `shared.js` |
| Corporate inquiry | `server/routes/inquiries.js` | `inquiries.js` |
| Notify (owner alerts) | `server/routes/notify.js` | `notify.js` |
| Categories | `server/routes/categories.js` | `categories.js` |

---

## Environment Variables by Feature

| Feature | Required Env Vars |
|---------|-------------------|
| Supabase DB + Auth | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Razorpay payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Razorpay webhook | `RAZORPAY_WEBHOOK_SECRET` |
| Frontend CORS | `FRONTEND_URL` |
| Email (Resend) | `RESEND_API_KEY` |
| Phone OTP (Fast2SMS) | `FAST2SMS_API_KEY` |
| Image upload (Cloudinary) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Admin access | `ADMIN_EMAILS` (default: `bhaveshv918@gmail.com`) |
| Keepalive ping | `RENDER_EXTERNAL_URL` (optional, auto-set by Render) |
| Port | `PORT` (default: 3000) |
| Environment | `NODE_ENV` (`production` enables error masking + keepalive) |

---

## Correct Order to Test After Any Change

1. **Server starts** — `node server/index.js` — must print "All environment variables verified."
2. **Health check** — `GET /health` returns `{ status: "ok" }`
3. **Products load** — `GET /api/products` returns products array
4. **Auth** — sign up → log in → JWT stored in `localStorage.ta_token`
5. **Cart** — add item → cart badge updates → server sync via `PUT /api/cart`
6. **Checkout step 1** — fill address form → saved address loads for returning users
7. **Checkout step 2** — review + promo code → totals correct
8. **Payment** — Razorpay modal opens → payment captured → order confirmed in DB
9. **Webhook** — Razorpay dashboard sends test event → order status updates idempotently
10. **Order history** — account page shows the new order with items
11. **Track order** — enter TRK ID → status timeline renders
12. **Admin** — log into `admin.html` → orders and products load

---

## Rules

- **Change only the file that owns the feature.** If checkout is broken, fix `checkout.html` or `paymentController.js` — not `shared.js`.
- **Never edit `shared.js` for page-specific logic.** shared.js owns: Cart, Wishlist, nav, search, pincode, phone validation, toast. Everything else belongs on its own page.
- **Never put secrets in frontend JS.** The Supabase anon key (`SUPABASE_ANON` in shared.js) is the only key allowed in frontend — it is intentionally public per Supabase's design. All other keys stay in `server/.env`.
- **Webhook must use raw body.** The `/api/webhooks` route is mounted BEFORE `express.json()` in `index.js` — do not change this order.
- **Promo validation is server-side only.** The frontend sends the promo code string; discount amounts are calculated in `paymentController.createOrder()`, never trusted from the client.
- **Stock is decremented only after confirmed payment.** `decrement_stock` RPC is called only inside `verifyPayment()` and `webhookController.confirmOrderByRazorpayId()`, after `status = 'confirmed'` is written.
- **Admin email allowlist** is in `ADMIN_EMAILS` env var (comma-separated). Changing who is admin means updating that env var — not the code.

---

## Database Schema Location

- Main schema: `server/db/schema.sql` (idempotent, safe to re-run)
- RLS hardening migration: `supabase/migrations/20260604_rls_hardening.sql`
- New columns: added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in the migration files

---

*Last updated: 2026-06-04 — post-audit stabilisation pass*
