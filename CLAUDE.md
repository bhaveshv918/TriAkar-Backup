# TriAkar : Claude Code Project Briefing

> This file is the single source of truth for Claude Code working on the TriAkar project.
> Read this fully before making any changes to any file.

---

## What is TriAkar?

TriAkar is a **premium Indian design and manufacturing brand** built around 3D-printed products,
custom solutions, home decor, utility products, gifting items, and creative problem-solving
through technology and design.

It is not a generic marketplace. It is a **design-first company** that creates products people
actually want to keep, combining modern global aesthetics with responsible Indian manufacturing.

**Name meaning:**
TriAkar (त्रिआकार) means "Crafting the Third Dimension," from त्रि (three) and आकार (form, shape).
This meaning should inform brand storytelling wherever the "About" or "Our Story" context appears,
alongside the tagline below.

**Logo / wordmark styling (exact, do not deviate):**
The brand name is always written as one word, split by color. **TRI** appears in TRI orange
(`#C4622A`), immediately followed by **AKAR** in the dark AKAR color (near-black), forming
"TRIAKAR" as a single visual unit, not two separate words and not with a space between them.
Below the main wordmark, a smaller Hindi rendering "त्रिआकार" appears, also color-split to match
(त्रि in orange, आकार in the dark color). This applies to the header logo and anywhere else the
full wordmark is used. Do not render the name as plain single-color text.

**Brand tagline:**
> "Crafting the Third Dimension"

In UI, the word "Third" is always TRI orange (`#C4622A`), the rest of the tagline is the
surrounding ink color, and the whole phrase is set in the Glorida wordmark font. Hindi
rendering: "तीसरे आयाम का निर्माण" ("तीसरे", meaning "third", in TRI orange).

**Positioning line** (used on the homepage badge, and consistent wherever brand positioning is shown):
> "Made in India · Designed for the World"

Physical location: Shop No. 25, Karan Singh Market, Greater Noida West, UP.
Channels: triakar.com (primary), Amazon, Flipkart.

---

## Project Type & Current State

Full-stack e-commerce and business operations platform. **This is not a pre-backend project.
The backend is live and in active use.**

- **Frontend:** Vercel, deployed
- **Backend:** Node.js + Express, hosted on Render, deployed and live
- **Database:** Supabase (PostgreSQL), live, RLS enabled across all tables
- **Auth:** Supabase Auth + Google OAuth, working
- **Payments:** Razorpay, integrated, verification working
- **Email:** Resend (SMTP configured)
- **Media storage:** Cloudinary
- **Current phase:** Admin Panel and Business OS overhaul (active sprint)

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

## Brand Rules, Non-Negotiable

| Element | Rule |
|---|---|
| Primary color | TRI orange `#C4622A` |
| Overall site theme | **Light theme.** White/cream backgrounds are the default across the site (shop, product pages, cart, etc). This is not a dark-mode site. |
| AKAR color (dark accent) | Near-black, not charcoal grey. Used for intentional dark sections (About page, footer, testimonials/trust section) and dark text elements, not the whole site background. |
| Reverse/inverted elements | Within a dark section, any element that flips against that dark background uses white, not grey |
| Font | Glorida |
| Aesthetic | Liquid glass. This is the primary visual language, not just an accent. Every new UI surface should be evaluated for liquid glass treatment first. |
| Punctuation | No em dashes anywhere: not in code comments, UI copy, database content, or generated text. See "Em Dash Cleanup" section below for the one-time full-codebase sweep. |
| Checkout | No COD (Cash on Delivery). Never implement or display this option. |
| Guarantee copy | "7-Day Reprint Guarantee," exact phrasing, use consistently |
| Prices | Always in INR with ₹ symbol |

**Never produce:**
- Cluttered UI or excessive visual noise
- Cheap-looking components or low-effort placeholders
- Generic marketplace-style layouts
- Inconsistent typography or color usage
- Hacked together code; every piece should be intentional
- Em dashes, in any file, ever, including in this file itself

---

## Technical Stack (Actual, Live)

### Frontend
- Deployed on Vercel
- Component structure in active use (not vanilla-only anymore)

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Hosting:** Render
- **Database:** Supabase (PostgreSQL), RLS policies enabled on all tables
- **Authentication:** Supabase Auth + Google OAuth
- **Payments:** Razorpay, webhook and signature verification implemented
- **Email:** Resend
- **File/image storage:** Cloudinary

### Environment Files
- Never commit `.env` files
- Always use `.env.example` to document required keys

---

## Em Dash Cleanup, Pending One-Time Task

Historically some em dashes have slipped into the codebase (UI copy, database seed content,
product descriptions, admin panel text, comments). This needs a dedicated sweep, separate from
regular feature work:

- [ ] Run a full-codebase and full-database search for em dashes and replace with appropriate
      punctuation (comma, period, colon, or restructure the sentence; never a silent swap to an
      en dash or hyphen)
- [ ] Check static content: product descriptions, category text, policy pages, email templates
- [ ] Check dynamic content: anything pulled from Supabase tables (product names, descriptions, etc.)
- [ ] Check transactional/status copy, not just marketing copy (see known instance below)
- [ ] This should be run as its own focused session, not mixed into an unrelated feature prompt

**Known live instances to check first (confirms this needs a real sweep, not just a going-forward rule):**
- Testimonials/social-proof section headline: "Neither did we, until we made it." currently has an
  em dash where the comma is shown here
- Order status message on the account/orders page: "Placed via WhatsApp, payment pending. We'll
  confirm on WhatsApp." currently has an em dash where the comma is shown here

---

## What's Already Built (Do Not Rebuild, Extend Instead)

- Supabase RLS across all tables
- XSS fixes site-wide
- Razorpay payment verification
- Admin login and auth flow
- Order flow (cart to checkout to order creation)
- Product grid and listing pages
- PWA install prompt
- Skeleton loading screens
- Site-wide copy standardization (brand voice; em dash sweep still pending, see above)
- Google OAuth via Supabase
- Resend SMTP email flow (incl. OTP)
- Payment tracking system
- SLA tracking and overhaul
- Money ledger
- Balance sheet
- Returns lifecycle management
- State-wise analytics
- Security audit completed, medium-severity issues resolved
- Filament inventory (61 items) migrated to Supabase
- GST Filing Automation (GSTR-1 reconciliation engine): reconciles Amazon MTR B2B/B2C CSV +
  Flipkart GSTR-1/8 XLSX into GSTR-1 tables (B2B, B2CS, HSN, Documents Issued). Engine at
  `server/services/gst-reconciliation.js`, CSV export (GST Offline Tool format) at
  `server/services/gst-export-templates.js`, API in `server/controllers/gstController.js`
  (mounted under `/api/admin/gst/*`), tables `biz_gst_calc_periods` /
  `biz_gst_calc_line_items` / `biz_gst_calc_flags` (migration
  `supabase/migrations/20260711_gst_reconciliation.sql`, **must be run in the Supabase SQL
  Editor before this feature works**), admin UI as the "GSTR-1 Auto-File" tab in
  `admin-biz.html`. Regression-tested with synthetic fixture data
  (`server/scripts/gst-regression-check.mjs`), not yet against a real month's files. CSV
  export column headers are best-effort (no internet access to verify against the real GST
  Offline Tool template); round-trip test against the actual tool before relying on it for
  a real filing. No automatic filing to the GST portal (by design, out of scope).

- Passkey sign-in (WebAuthn): passwordless login with fingerprint, face or device PIN,
  plus a "quick sign-in" account picker on `account.html`. Server verification via
  `@simplewebauthn/server` in `server/services/webauthn.js` +
  `server/controllers/passkeyController.js`, routes at `/api/auth/passkeys/*`
  (`server/routes/passkeys.js`), browser side in `js/passkey.js` (no external
  dependency) with remembered-profile helpers in `js/auth.js`. Tables `user_passkeys` /
  `webauthn_challenges` (migration `supabase/migrations/20260829_passkeys.sql`, **must be
  run in the Supabase SQL Editor before this feature works**). Key facts: sign-in is
  discoverable-credential only (no email is ever sent up, so there is no account
  enumeration surface); a verified passkey does NOT become the session, the server mints a
  normal Supabase session from it, so RLS and `requireAuth` are untouched; the picker
  stores display info only, never a token; a passkey is bound to one domain, so ones made
  on triakar.com will not work on triakar.in. Password login, Google OAuth and email OTP
  are all unchanged. Not yet exercised against a real authenticator on production.

- Admin two-factor (TOTP): Google Authenticator style 6-digit code on top of the admin
  password login, on both `admin.html` and `admin-biz.html`. Client side in
  `js/admin-mfa.js` (`AdminMFA.gate` at login and session restore, `AdminMFA.mountSettings`
  for the enrol / turn off card in admin Settings), server side in
  `server/middleware/requireAdmin.js`, which reads the `aal` claim off the access token and
  rejects admin API calls from any session that has not passed the code. Uses Supabase's
  built-in MFA, so there is no new table and no migration to run. Key facts: enforcement is
  conditional, nothing changes until a factor is actually enrolled and verified, so turning
  it on cannot lock the owner out midway; the customer-facing site is unaffected because
  Supabase does not force MFA on other sign-in routes; both admin pages share one Supabase
  session, so verifying in either satisfies both. **Not yet covered:** the admin panels also
  read and write Supabase directly with the anon key, and those RLS policies still only check
  `auth.email()`. Adding `AND (auth.jwt()->>'aal')='aal2'` to every admin policy is a separate
  migration sweep. Also note Supabase issues no backup codes, so the TOTP secret must be kept
  offline or the only way back in is the service role from the Supabase dashboard.

**Before building something new, check if it already exists.** Grep/search the codebase first.

**Note:** All of the above is functionally built and live. The current need is more likely
optimization, refinement, or bug fixing on existing systems than net-new construction. Default
to "improve what exists" over "build from scratch" unless explicitly told otherwise.

---

## Current Priority: Admin Panel & Business OS Overhaul

Active sprint areas:
- [ ] Continue Admin Panel UI/UX improvements
- [ ] Extend Business OS features as directed per session
- [ ] Maintain SLA, ledger, balance sheet, returns systems already in place
- [ ] **Known issue:** Admin Panel and Admin Biz OS are not properly responsive on mobile/phone
      screens. A fix has been attempted once; working status not yet confirmed. Treat this as an
      open item until explicitly confirmed fixed. Test any admin UI change on mobile viewport,
      not just desktop.
- [ ] Customer-facing site should build a sense of curiosity and intrigue during browsing, not
      just transactional product listing. Look for opportunities (micro-interactions, reveal
      animations, liquid glass transitions) that make exploring the site itself feel engaging.
- [ ] **Mobile-first, app-like interaction model.** Most customers browse and buy on phone, not
      desktop. The site should feel and behave like a native mobile app, not a responsive website
      that happens to shrink. This means:
      - Touch-first interactions: swipe gestures, tap targets sized for thumbs, bottom-anchored
        primary actions (cart, buy now) instead of top-only navigation, and swipeable galleries
        for product image browsing
      - Smooth transitions between screens/pages, not hard reloads; should feel like navigating
        an app, not loading a new webpage
      - Bottom navigation bar or similar app-pattern navigation should be considered for mobile,
        not just a shrunk desktop header
      - This is also forward-looking. TriAkar plans to eventually wrap this into a native app.
        Building mobile interactions the app-native way now means the future app conversion will
        reuse patterns instead of starting over. Keep this in mind for any new component.

(Update this checklist per sprint. Do not let it go stale like the old version did.)

---

## Key Business Rules

1. **Products can be customizable.** Flag `is_customizable` triggers a custom notes field at checkout
2. **Corporate gifting is a separate inquiry flow,** not a standard cart checkout
3. **All prices in INR,** display with ₹ symbol
4. **Stock management matters.** Decrement on order, block checkout if out of stock
5. **Order statuses:** `pending → confirmed → processing → shipped → delivered`
6. **No guest checkout.** Users must create an account
7. **No COD.** Razorpay only
8. GST compliance applies (GSTR-1 filed for B2C transactions)
9. **WhatsApp is a valid parallel ordering channel,** separate from standard site checkout. Orders
   placed this way show a "placed via WhatsApp, payment pending" status in the customer's order
   history and are tagged accordingly. Do not treat WhatsApp-sourced orders as errors, incomplete
   data, or something to "fix." This is intentional business behavior. If working on order-related
   features (admin panel, order list, analytics), account for this channel explicitly rather than
   assuming Razorpay-only checkout is the sole order source.
10. **Customization confirmation is mandatory before production.** For any customizable product,
    the order does not enter production until the customer has personally confirmed the final
    customization details. This is manual, human confirmation, not an automated checkbox. Product
    pages should reflect this ("Nothing goes into production until you are 100% happy with the
    plan") and any customization-related feature must preserve this confirmation step rather than
    auto-approving or skipping it for speed.
11. **Reviews and ratings have two distinct sources; do not conflate them.** Per-product review
    counts (for example, a specific product showing 4.7 from 3 reviews) are separate from the
    site-wide testimonial/trust section (for example, the homepage showing 4.9 from 127+ reviews).
    These numbers will differ and that is expected. The site-wide figure aggregates across all
    verified customer feedback, not just one product's reviews. Do not "fix" this as an inconsistency.

---

## What NOT to Do

- Do not create duplicate files; check what exists before creating new ones
- Do not break existing live functionality without replacing it with something better
- Do not use placeholder Lorem Ipsum content; TriAkar content only
- Do not use colors outside the brand palette
- Do not skip error handling; all API routes must have try/catch
- Do not expose API keys or secrets in frontend JS files
- Do not use inline styles when a CSS file already handles it
- Do not use em dashes anywhere
- Do not implement or suggest COD

---

## When Making Changes, Follow This Order

1. Read this file first
2. Check which files already exist (`ls` the directory, grep for existing implementations)
3. Make the smallest change that solves the problem
4. Test it before moving to the next change
5. Commit with a clear message: `feat: add product route` / `fix: cart quantity bug`

---

## Git Commit Style

Conventional commits:

```
feat: add Razorpay webhook handler
fix: resolve cart total rounding issue
style: update product card layout for mobile
refactor: extract auth logic into middleware
chore: add .env.example with required keys
```

---

## Graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure,
and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` **only if**
  `graphify-out/graph.json` exists and is reasonably current. If it does not exist or is stale,
  skip straight to grep/search; do not attempt graphify first and fall back after failure.
- Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for
  focused concepts.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review, or when
  query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- If unsure whether the graph is current, ask before relying on it rather than assuming.

---

*Last updated: current sprint, Admin Panel & Business OS overhaul*
*Brand: TriAkar | Stack: Node + Express (Render) + Supabase + Razorpay + Vercel | Style: Light theme base, TRI orange accents, near-black AKAR sections for intentional dark contrast, liquid glass as primary visual language, no em dashes anywhere including this file*