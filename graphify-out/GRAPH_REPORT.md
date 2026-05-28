# Graph Report - Triakar  (2026-05-26)

## Corpus Check
- 63 files · ~480,991 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 395 nodes · 540 edges · 30 communities (22 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `83fb1354`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]

## God Nodes (most connected - your core abstractions)
1. `TriAkar — Claude Code Project Briefing` - 15 edges
2. `TriAkar — Project Status & Handoff` - 15 edges
3. `requireAuth()` - 11 edges
4. `TriAkar — Deployment Guide` - 10 edges
5. `shell()` - 9 edges
6. `btn()` - 9 edges
7. `sendOrderConfirmation()` - 9 edges
8. `sendAdminOrderAlert()` - 9 edges
9. `row()` - 8 edges
10. `send()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `verifyPayment()` --calls--> `sendOrderConfirmation()`  [INFERRED]
  server/controllers/paymentController.js → server/services/emailService.js
- `verifyPayment()` --calls--> `sendAdminOrderAlert()`  [INFERRED]
  server/controllers/paymentController.js → server/services/emailService.js

## Communities (30 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (37): addToCartBtn(), attachPincodeAutofill(), btn, Cart, checkout(), closeCart(), COUNTRY_CODES, drawer (+29 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (25): createAddress(), deleteAddress(), getAddresses(), getDefaultAddress(), setDefault(), updateAddress(), getCart(), saveCart() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (26): dependencies, cloudinary, connect-timeout, cors, dotenv, express, express-mongo-sanitize, express-rate-limit (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (25): 2a — Create a new Web Service, 2b — Add Environment Variables, 2c — Get Razorpay API Keys, 2d — Trigger a redeploy, 2e — Verify the backend is live, Admin, Auth, Cart & Checkout (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (19): a, ageCard(), cardList, cardsRow, ctxOk(), dropCard(), host, makeCard() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.28
Nodes (19): verifyPayment(), router, validTypes, btn(), esc(), formatAddress(), inr(), itemsTable() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (15): createInquiry(), errorHandler(), router, _agent, request, router, allowedOrigins, app (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (21): Backend (to be built), Brand Personality — Always Keep This in Mind, code:block1 (triakar/), code:block2 (feat: add Razorpay webhook handler), Core Product Categories, Current Priority Order (Build Sequence), Database Schema (Supabase / PostgreSQL), Environment Files (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (19): Backend (`/server`), code:block1 (# 1. Clone), code:block2 (git add <files>), Frontend (repo root), SECTION 10 — WHAT STILL NEEDS TO BE DONE (priority order), SECTION 11 — HOW TO RUN LOCALLY, SECTION 12 — DEPLOYMENT PROCESS, SECTION 13 — BRAND GUIDELINES SUMMARY (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (14): createProduct(), deleteProduct(), getAdminOrders(), getAdminProducts(), updateOrderPayment(), updateOrderStatus(), updateProduct(), createCategory() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (17): CFG, depositEffect(), depositLayer(), drip, gantry, gantryTopForLayer(), glow, head (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (9): createReview(), deleteReview(), getAllReviews(), getReviews(), patchStatus(), updateReview(), router, upload (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (11): esc(), fetchSugs(), init(), injectCSS(), normaliseState(), parseResult(), renderSugs(), selectResult() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (12): action, default_popup, default_title, background, service_worker, content_scripts, description, host_permissions (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.43
Nodes (6): createPromoCode(), deletePromoCode(), getPromoCodes(), updatePromoCode(), validatePromo(), router

### Community 15 - "Community 15"
Cohesion: 0.48
Nodes (5): getAllProducts(), getProductBySlug(), getProductsByCategory(), upsertProduct(), router

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (5): ensureOffscreen(), handleOffscreenMsg(), pushToTab(), startCapture(), transcribeAndAnswer()

### Community 17 - "Community 17"
Cohesion: 0.53
Nodes (5): chunks, cleanup(), push(), startRecording(), stopRecording()

### Community 18 - "Community 18"
Cohesion: 0.40
Nodes (3): keyInput, saveBtn, savedMsg

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (4): code:bash (git init && git add . && git commit -m "TriAkar v5"), Deploy, Key fixes in this version, TriAkar v5

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (4): cleanUrls, headers, rewrites, trailingSlash

## Knowledge Gaps
- **178 isolated node(s):** `CFG`, `root`, `scene`, `gantry`, `head` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireAuth()` connect `Community 1` to `Community 9`, `Community 11`, `Community 14`, `Community 15`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `verifyPayment()` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `CFG`, `root`, `scene` to the rest of the system?**
  _178 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05052790346907994 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09206349206349207 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._