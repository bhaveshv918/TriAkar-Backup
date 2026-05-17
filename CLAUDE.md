# TriAkar — Claude Code Project Briefing

> This file is the single source of truth for Claude Code working on the TriAkar project.
> Read this fully before making any changes to any file.

---

## What is TriAkar?

TriAkar is a **premium Indian design and manufacturing brand** built around 3D-printed products,
custom solutions, home decor, utility products, gifting items, and creative problem-solving
through technology and design.

It is not a generic marketplace. It is a **design-first company** that creates products people
actually want to keep — combining modern global aesthetics with responsible Indian manufacturing.

**Brand tagline:**
> "Designed globally. Made responsibly in India. Because good design should not cost the earth."

---

## Project Type

Full-stack e-commerce website.

- **Current state:** Frontend only — HTML, CSS, vanilla JavaScript
- **Goal:** Add a complete backend with database, authentication, payments, admin panel,
  and all e-commerce functionality
- **Target stack:** Node.js + Express, Supabase (DB + Auth), Razorpay (payments), Vercel (hosting)

---

## Core Product Categories

- 3D Printed Home Decor
- Wall Art & Panels
- Personalized / Custom Products
- Corporate Gifting
- Utility Products
- Custom Design Solutions
- Tech-Based Creative Products

---

## Brand Personality — Always Keep This in Mind

Every file, component, and UI element you create must feel:

- **Premium** — world-class quality, not generic
- **Innovative** — forward-thinking, tech-driven
- **Modern** — clean, current, not dated
- **Minimal** — nothing unnecessary
- **Smart** — functional design decisions
- **Indian yet globally appealing** — proud origin, universal quality

**Never produce:**
- Cluttered UI or excessive visual noise
- Cheap-looking components or low-effort placeholders
- Generic marketplace-style layouts
- Inconsistent typography or color usage
- Hacked together code — every piece should be intentional

---

## Visual Direction (Apply to All Frontend Work)

| Property        | Direction                                      |
|-----------------|------------------------------------------------|
| Color palette   | Dark backgrounds, grey, black, white, subtle accents |
| Aesthetic       | Minimal luxury — think premium product brand   |
| Typography      | Clean, modern, strong hierarchy                |
| Product images  | High-quality renders, never low-res            |
| UI style        | Interactive, smooth, modern — not static       |
| Layout          | Spacious, product-focused, intentional         |

When in doubt: less is more. Whitespace is not wasted space.

---

## Technical Stack

### Frontend
- HTML5, CSS3, Vanilla JavaScript (existing)
- Will evolve toward a cleaner component structure

### Backend (to be built)
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Payments:** Razorpay
- **File storage:** Supabase Storage (for product images)
- **Hosting:** Vercel (frontend) + Render or Railway (backend API)

### Environment Files
- Never commit `.env` files
- Always use `.env.example` to document required keys
- Required env vars will be listed in `/server/.env.example`

---

## Folder Structure (Target)

```
triakar/
├── CLAUDE.md                  ← you are here
├── .gitignore
├── .env.example
├── README.md
│
├── index.html                 ← homepage
├── products.html              ← product listing
├── product-detail.html        ← single product page
├── cart.html                  ← shopping cart
├── checkout.html              ← checkout flow
├── account.html               ← user account / orders
│
├── css/
│   ├── main.css
│   ├── components.css
│   └── responsive.css
│
├── js/
│   ├── main.js
│   ├── cart.js
│   ├── auth.js
│   └── checkout.js
│
├── assets/
│   ├── images/
│   └── fonts/
│
└── server/
    ├── index.js               ← Express entry point
    ├── .env.example
    ├── package.json
    ├── routes/
    │   ├── products.js
    │   ├── orders.js
    │   ├── auth.js
    │   └── payments.js
    ├── controllers/
    │   ├── productController.js
    │   ├── orderController.js
    │   └── paymentController.js
    ├── middleware/
    │   ├── authMiddleware.js
    │   └── errorHandler.js
    └── db/
        ├── supabaseClient.js
        └── schema.sql
```

---

## Database Schema (Supabase / PostgreSQL)

### Tables to build:

**products**
- id, name, slug, description, price, category, stock_qty, images[], is_customizable,
  is_active, created_at

**orders**
- id, user_id (FK), status, total_amount, razorpay_payment_id, shipping_address,
  created_at

**order_items**
- id, order_id (FK), product_id (FK), quantity, unit_price, customization_notes

**users** (managed by Supabase Auth, extend with profiles table)
- id, email, full_name, phone, created_at

**corporate_inquiries**
- id, company_name, contact_name, email, phone, message, product_interest, created_at

---

## Key Business Rules

1. **Products can be customizable** — flag `is_customizable` triggers a custom notes field at checkout
2. **Corporate gifting is a separate inquiry flow** — not a standard cart checkout
3. **All prices in INR** — display with ₹ symbol
4. **Stock management matters** — decrement on order, block checkout if out of stock
5. **Order statuses:** `pending → confirmed → processing → shipped → delivered`
6. **No guest checkout** — users must create an account (keeps repeat customer data clean)

---

## What NOT to Do

- Do not create duplicate files — check what exists before creating new ones
- Do not break existing frontend without replacing it with something better
- Do not use any placeholder Lorem Ipsum content — TriAkar content only
- Do not use random colors outside the brand palette
- Do not skip error handling — all API routes must have try/catch
- Do not expose API keys or secrets in frontend JS files
- Do not use inline styles in HTML if there is already a CSS file for it

---

## When Making Changes — Follow This Order

1. Read this file first
2. Check which files already exist (`ls` the directory)
3. Make the smallest change that solves the problem
4. Test it before moving to the next change
5. Commit with a clear message: `feat: add product route` / `fix: cart quantity bug`

---

## Git Commit Style

Use conventional commits:

```
feat: add Razorpay webhook handler
fix: resolve cart total rounding issue
style: update product card layout for mobile
refactor: extract auth logic into middleware
chore: add .env.example with required keys
```

---

## Current Priority Order (Build Sequence)

- [ ] 1. Set up Express server and folder structure
- [ ] 2. Connect Supabase — create DB schema, test connection
- [ ] 3. Build product API routes — GET all, GET by slug, GET by category
- [ ] 4. Connect frontend product listing to live API
- [ ] 5. Implement Supabase Auth — signup, login, session handling
- [ ] 6. Build persistent cart (DB-backed, not just localStorage)
- [ ] 7. Razorpay integration — payment intent, checkout, webhook
- [ ] 8. Order creation and confirmation flow
- [ ] 9. User account page — order history
- [ ] 10. Admin panel — manage products, view orders
- [ ] 11. Corporate gifting inquiry form + email notification
- [ ] 12. Performance, SEO, and deployment

---

*Last updated: Phase 2 setup — pre-backend build*
*Brand: TriAkar | Stack: Node + Supabase + Razorpay | Style: Premium minimal dark*
