# TriAkar — Deployment Guide

**Frontend:** Vercel → `triakar.vercel.app`  
**Backend API:** Render → `https://triakar-api.onrender.com`  
**Database / Auth:** Supabase  
**Payments:** Stripe

---

## Prerequisites

- GitHub repo exists and this code is pushed to the `main` branch
- Supabase project created at [supabase.com](https://supabase.com)
- Stripe account created at [stripe.com](https://stripe.com) (test mode keys ready)
- Vercel account linked to the GitHub repo
- Render account at [render.com](https://render.com)

---

## Step 1 — Run the Supabase Schema

1. Open your Supabase project → **SQL Editor**
2. Open the file `server/db/schema.sql` from this repo
3. Paste the entire contents into the SQL editor and click **Run**
4. Confirm these tables were created: `profiles`, `products`, `orders`, `order_items`, `carts`, `corporate_inquiries`
5. Confirm the `decrement_stock` function was created under **Database → Functions**

---

## Step 2 — Deploy the Backend on Render

### 2a — Create a new Web Service

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub account if not already connected
3. Select the **TriAkar** repository
4. Fill in the service settings:

| Field | Value |
|-------|-------|
| **Name** | `triakar-api` |
| **Region** | Singapore (closest to India) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Plan** | Free |

5. Click **Create Web Service** — do NOT add env vars yet

### 2b — Add Environment Variables

Once the service is created, go to **Environment** tab and add these key/value pairs one by one:

| Key | Value |
|-----|-------|
| `PORT` | `10000` |
| `FRONTEND_URL` | `https://triakar.vercel.app` |
| `SUPABASE_URL` | Your Supabase project URL (Settings → API → Project URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key (Settings → API → service_role, click reveal) |
| `STRIPE_SECRET_KEY` | `sk_test_…` from Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | See Step 2c below |

### 2c — Get the Stripe Webhook Secret

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://triakar-api.onrender.com/api/payments/webhook`
4. Select events: `checkout.session.completed`, `checkout.session.expired`
5. Click **Add endpoint**
6. Click the endpoint → **Signing secret** → **Reveal** → copy the `whsec_…` value
7. Paste it as `STRIPE_WEBHOOK_SECRET` in Render

### 2d — Trigger a redeploy

After adding all env vars, go to **Manual Deploy** → **Deploy latest commit**.  
Wait for the build to complete (usually 2–3 minutes on first deploy).

### 2e — Verify the backend is live

Visit: `https://triakar-api.onrender.com/health`

Expected response:
```json
{ "status": "ok", "brand": "TriAkar" }
```

> **Note:** Render free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. This is expected on the free plan.

---

## Step 3 — Confirm Vercel Auto-Deploy

1. Go to [vercel.com](https://vercel.com) → your **TriAkar** project
2. Confirm the project is connected to the `main` branch of the GitHub repo
3. If not yet connected: **New Project** → Import Git Repository → select repo → Framework Preset: **Other** → Root Directory: `/` (repo root) → Deploy
4. Once deployed, visit `https://triakar.vercel.app` — the homepage should load

---

## Step 4 — Set Admin Role in Supabase

After creating your account on the live site:

1. Go to Supabase → **SQL Editor** and run:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';
```

2. Replace `your-email@example.com` with your actual account email
3. Log out and log back in on the site — the `admin.html` panel should now be accessible

---

## Step 5 — End-to-End Test Checklist

Run through this in order after both services are live:

### Auth
- [ ] Go to `triakar.vercel.app/account` → create a new account
- [ ] Check email for Supabase verification link → confirm
- [ ] Log in → dashboard shows "Welcome back, [name]"

### Products
- [ ] Go to `triakar.vercel.app/products` → products load from API (not hardcoded)
- [ ] Add a product via `triakar.vercel.app/admin` → it appears on products page

### Cart & Checkout
- [ ] Add a product to cart → cart sidebar opens, item shown
- [ ] Click Checkout → redirected to Stripe hosted checkout
- [ ] Use test card: `4242 4242 4242 4242`, any future expiry, any CVV
- [ ] After payment → redirected to `order-confirmation.html` with order details

### Orders
- [ ] Go to Account page → order appears in history with correct status
- [ ] Go to Admin → Orders tab → order visible, change status to `confirmed`

### Enquiry Form
- [ ] Go to `triakar.vercel.app/custom` → fill in and submit the enquiry form
- [ ] Check Supabase → **Table Editor** → `corporate_inquiries` → row should appear

### Admin
- [ ] Visit `triakar.vercel.app/admin` as non-admin → "Access denied" shown
- [ ] Visit as admin → products and orders load correctly

---

## Environment Variables Reference

### Render (backend)

| Key | Where to find |
|-----|--------------|
| `PORT` | Set to `10000` (Render's default) |
| `FRONTEND_URL` | `https://triakar.vercel.app` |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → Signing secret |

### Vercel (frontend)

No environment variables needed — the frontend is static HTML/JS. The Render API URL is hardcoded in the JS as `https://triakar-api.onrender.com`.

---

## Common Issues

**CORS errors in browser console**  
→ Make sure `FRONTEND_URL` on Render is set to exactly `https://triakar.vercel.app` (no trailing slash)

**Auth is not defined**  
→ Cleared in the latest commit — `js/auth.js` now loads with `defer` and inline scripts wait for `DOMContentLoaded`

**Stripe webhook returning 400**  
→ Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe dashboard for the exact endpoint URL

**Render backend returning 500**  
→ Check Render **Logs** tab — usually a missing env var. All 5 keys must be set.

**Products page shows nothing**  
→ Confirm the schema SQL was run and `products` table has rows — add one via the admin panel first

---

*Last updated: 2026-05-17 | Stack: Node + Supabase + Stripe + Vercel + Render*
