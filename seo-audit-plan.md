# SEO Audit Online — Development Plan

> **IMPORTANT: Execute tasks ONE BY ONE, sequentially. Do not combine multiple tasks. Finish one completely before starting the next. AI agents lose focus on large tasks — smaller, focused steps produce better results.**

---

## Phase 1: Fix & Polish Existing Product

### Task 1.1 — Pricing Restructure
Change pricing tiers:
- **Free:** $0/mo — 3 audits/month, up to 20 pages, PDF export only (with watermark)
- **Pro:** $9/mo — Unlimited audits, up to 200 pages, PDF + HTML export, no watermark
- **Agency:** $29/mo — Unlimited audits, up to 1000 pages, PDF + HTML + DOCX, white-label reports, branding customization

Update:
- [ ] /dashboard/plans page with new prices, limits, and feature comparison
- [ ] Plan enforcement logic (middleware/backend) to match new limits

---

### Task 1.2 — Payment Integration (Lemon Squeezy)
- [ ] Create Lemon Squeezy account, configure store
- [ ] Create 2 subscription products (Pro $9/mo, Agency $29/mo)
- [ ] Implement checkout flow (JS overlay — user stays on site)
- [ ] Build webhook endpoint: `POST /api/webhooks/lemonsqueezy`
  - Handle: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_payment_failed`
  - Verify webhook signature
  - Update user plan in DB
- [ ] Add subscription fields to users table: `plan`, `plan_expires_at`, `ls_customer_id`, `ls_subscription_id`
- [ ] Customer portal link (manage/cancel subscription) — Lemon Squeezy provides this free
- [ ] Handle plan downgrade gracefully (if Agency → Pro, keep data but restrict features)

---

### Task 1.3 — Sidebar Restructure
- [ ] Move Branding page inside Settings as a tab (Settings → General | Branding)
- [ ] Remove Branding as separate sidebar item
- [ ] Add "Indexing" item to sidebar (placeholder for now, link to coming soon or empty state)
- [ ] Final sidebar order:
  ```
  📊 Dashboard
  + New Audit
  🔍 Indexing
  📋 Plans
  ⚙️ Settings (with tabs: General | Branding)
  ```

---

### Task 1.4 — Sidebar Animation
- [ ] Smooth sidebar entrance animation: translateX(-100%) → translateX(0)
- [ ] Content area should animate in sync

---

### Task 1.5 — Route Structure & Layouts
- [ ] Create marketing layout (no sidebar, public access, header + footer)
- [ ] Create app layout (sidebar + header, auth required)
- [ ] Route structure:
  ```
  /                  → marketing layout (main landing)
  /indexing           → marketing layout (indexing landing — Phase 2)
  /pricing            → marketing layout (combined pricing)
  /dashboard/*        → app layout (auth required)
  ```
- [ ] Next.js route groups: `(marketing)/` and `(app)/dashboard/`
- [ ] Landing pages accessible to everyone (logged in or not)
- [ ] Header logic:
  - Not logged in: Logo + nav + "Sign Up" / "Log In"
  - Logged in: Logo + nav + "Dashboard" / Avatar

---

### Task 1.6 — Landing Page (SEO Audit)
Path: `/`

Sections:
1. **Hero (50/50 split):**
   - Left: Heading + description + CTA buttons ("Start Free Audit", "View Pricing")
   - Right: Dashboard screenshot
   - Add "Try free audit" URL input in hero — enter URL, get mini audit without registration
2. **Features:** Key selling points, how it works (3 steps)
3. **Pricing:** 3 tiers (Free / Pro / Agency) with clear comparison table
4. **FAQ:** Common questions
5. **Footer**

Design specs:
- Font: Ubuntu (main app font)
- Color scheme: Match https://lvdev.co exactly
- Buttons: Replicate lvdev.co button styles 1:1
- Header: Consistent with dashboard header style
- Responsive (mobile-first)

---

### Task 1.7 — UI Polish
- [ ] Consistent Ubuntu font across all pages (landing + app)
- [ ] lvdev.co color scheme applied globally
- [ ] Button styles matching lvdev.co 1:1
- [ ] Responsive landing page

---

## Phase 2: Indexing Product

### Task 2.1 — Indexing Backend (Python)
- [ ] Google Indexing API integration
  - Service account setup
  - URL submission endpoint
  - Rate limiting (200 requests/day per account)
- [ ] IndexNow protocol integration (Bing/Yandex/DuckDuckGo)
  - API key generation
  - Batch URL submission
- [ ] Crawl site to discover URLs (sitemap.xml parsing + basic crawler)
- [ ] Track indexing status per URL (submitted / indexed / failed / pending)
- [ ] 404 detection

---

### Task 2.2 — Credits System
- [ ] Add `indexing_credits` field to users table
- [ ] Create credit packs in Lemon Squeezy (one-time products):
  - Starter: 50 credits — $5
  - Growth: 200 credits — $15
  - Scale: 1000 credits — $39
- [ ] Webhook handler for `order_created` → add credits to user
- [ ] Decrement credits on each URL submit (1 credit = 1 URL)
- [ ] "Not enough credits" gate + "Buy more" CTA
- [ ] Credits remaining indicator in dashboard

---

### Task 2.3 — Indexing Dashboard (Frontend)
- [ ] Indexing page in sidebar (replace placeholder from Task 1.3)
- [ ] Add site URL → crawl → show discovered pages
- [ ] Select pages to index / "Index All"
- [ ] Status table: URL | Status (pending/submitted/indexed) | Last checked
- [ ] Credits remaining display
- [ ] Daily report view (indexed vs pending vs failed)

---

### Task 2.4 — Indexing Cron Jobs
- [ ] Daily auto-submit for active indexing jobs
- [ ] Email alerts: indexing complete, 404 detected, credits running low

---

### Task 2.5 — Indexing Landing Page
Path: `/indexing`

Same marketing layout as main landing. Sections:
1. **Hero:** "Get your pages indexed by Google in hours, not weeks"
2. **How it works:** 3 steps (add site → we submit → track progress)
3. **Pricing:** Credit packs (Starter / Growth / Scale)
4. **FAQ**
5. **Footer**

Optional: buy separate domain (e.g., indexfast.io) → redirect to seo-audit.online/indexing

---

## Phase 3: Launch & Marketing

### Task 3.1 — Pre-launch
- [ ] SEO blog posts: "free seo audit tool", "google indexing tool", "how to index website faster"
- [ ] Submit to directories: alternativeto.net, SaaSHub, ToolHunt, ProductHunt upcoming
- [ ] Prepare Product Hunt assets (screenshots, description, maker comment)

### Task 3.2 — Launch
- [ ] Product Hunt launch (audit tool first)
- [ ] X/Twitter build-in-public posts
- [ ] Reddit: r/SideProject, r/SaaS, r/Entrepreneur (story format, not promo)
- [ ] 2-3 weeks later: separate Product Hunt launch for indexing tool

### Task 3.3 — Post-launch
- [ ] Monitor conversion funnel (landing → signup → free → paid)
- [ ] Collect feedback, iterate
- [ ] Raise prices after 100+ paying users

---

## Tech Stack
- **Frontend:** Next.js (existing)
- **Backend:** Python (existing)
- **Auth:** Google OAuth (existing)
- **Payments:** Lemon Squeezy (subscriptions + one-time credit packs)
- **Indexing APIs:** Google Indexing API + IndexNow
- **DB:** Existing — add subscription + credits fields

## Execution Order
```
1.1 Pricing Restructure
  ↓
1.2 Payment Integration
  ↓
1.3 Sidebar Restructure
  ↓
1.4 Sidebar Animation
  ↓
1.5 Route Structure & Layouts
  ↓
1.6 Landing Page
  ↓
1.7 UI Polish
  ↓
2.1 Indexing Backend
  ↓
2.2 Credits System
  ↓
2.3 Indexing Dashboard
  ↓
2.4 Indexing Cron Jobs
  ↓
2.5 Indexing Landing Page
  ↓
3.1 Pre-launch
  ↓
3.2 Launch
  ↓
3.3 Post-launch
```

One task at a time. No shortcuts.
