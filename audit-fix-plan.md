# SEO Audit Tool — Combined Fix Plan (From 6 Audits)

## Overview

Consolidated findings from 6 deep audits (auth, SEO analyzers, indexing logic, translations, mobile UI, sidebar). Prioritized by severity into phases. Each phase is a separate Claude Code session with its own git branch.

## Git Workflow

```bash
git checkout master && git pull
git checkout -b phase-X-description
# work, commit often
git add -A && git commit -m "phase X: description"
git push origin phase-X-description
# when done: merge
git checkout master
git merge phase-X-description
git push origin master
git branch -d phase-X-description
git push origin -d phase-X-description
```

---

## Phase 1: Critical Security Fixes

**Branch:** `phase-1-security-fixes`

These are exploitable vulnerabilities. Fix immediately.

### 1.1 Cron endpoints bypass auth when CRON_SECRET is unset

- **Files:** `frontend/src/app/api/cron/daily-indexing/route.ts:33`, `frontend/src/app/api/cron/retry-failed/route.ts:62`, `frontend/src/app/api/indexing/cron/route.ts:15`, `frontend/src/app/api/cron/weekly-resync/route.ts:24-29`
- **Problem:** All four cron routes use `if (cronSecret) { ... }` — if env var is unset, auth is entirely skipped. Anyone can trigger mass indexing, consume credits, send emails.
- **Fix:** Invert the logic: if `CRON_SECRET` is not set, reject with 500 "CRON_SECRET not configured". Never allow unauthenticated access as fallback.
- Also: use `crypto.timingSafeEqual()` for the secret comparison (currently only `daily-indexing/route.ts:35` uses simple string comparison — the Lemon Squeezy webhook handler already does this correctly, copy that pattern).

### 1.2 Self-serve plan upgrade with no payment verification

- **File:** `frontend/src/app/api/user/plan/route.ts:34-63`
- **Problem:** `PATCH /api/user/plan` lets any authenticated user switch to any plan (including "agency") by sending `{ planId: "agency" }`. No payment check.
- **Fix:** Remove the self-serve PATCH endpoint entirely, or gate it behind a verified Lemon Squeezy webhook. Plan changes should only happen via admin action or payment webhook.

### 1.3 `allowDangerousEmailAccountLinking: true`

- **File:** `frontend/src/lib/auth.ts:18`
- **Problem:** Allows any Google account to auto-link to an existing user if emails match, without ownership verification. Account takeover risk.
- **Fix:** Remove `allowDangerousEmailAccountLinking: true`. If needed for migration, add email verification before linking.

### 1.4 Dev login endpoint relies only on NODE_ENV

- **File:** `frontend/src/app/api/auth/dev-login/route.ts:11`
- **Problem:** If production build ships with `NODE_ENV=development`, anyone gets full admin access via `/api/auth/dev-login`.
- **Fix:** Add an explicit `DEV_LOGIN_ENABLED` env flag, or remove the endpoint entirely from production builds.

### 1.5 OAuth tokens stored in plaintext

- **File:** `frontend/prisma/schema.prisma:59-60`
- **Problem:** `access_token` and `refresh_token` stored as plaintext `@db.Text`. Database compromise = full Google account access for all users.
- **Fix:** Encrypt tokens at rest using AES-256-GCM with an app-level encryption key from env. Decrypt on read in the Google auth helper. Write a migration to encrypt existing tokens.

**Commit message:** `phase 1: critical security fixes — cron auth, plan upgrade, email linking, dev login, token encryption`

---

## Phase 2: Critical Data Integrity Fixes

**Branch:** `phase-2-data-integrity`

Bugs that cause data loss, wrong numbers, or wasted credits.

### 2.1 GSC sync can delete ALL user data on empty API response

- **File:** `frontend/src/app/api/indexing/sites/sync/route.ts:113-119`
- **Problem:** If GSC returns empty `siteEntry` array (temporary glitch, permission change), `prisma.site.deleteMany({ where: { domain: { notIn: [] } } })` deletes ALL sites + cascade-deletes every `IndexedUrl`, `DailyReport`, etc.
- **Fix:** If `eligible.length === 0`, skip the cleanup step entirely. Or: if GSC returned fewer sites than currently in DB, require explicit confirmation.

### 2.2 Double DailyReport writes — metrics get doubled

- **Files:** `frontend/src/lib/auto-indexer.ts:445-478` AND `frontend/src/app/api/cron/daily-indexing/route.ts:112-152`
- **Problem:** Both `runAutoIndexForSite()` and the cron caller upsert the same DailyReport with `{ increment: ... }`. When auto-indexing runs via cron, every metric is doubled.
- **Fix:** Remove the DailyReport write from `auto-indexer.ts` — let the caller handle it.

### 2.3 Indexed URL count overcounted with `contains: "indexed"`

- **File:** `frontend/src/app/api/indexing/sites/route.ts:39`
- **Problem:** `gscStatus: { contains: "indexed" }` matches "Crawled - currently not indexed". Inflates indexed count.
- **Fix:** Use `gscStatus: { in: ["Submitted and indexed", "Indexed", "Indexed, not submitted in sitemap"] }` — exact match list.

### 2.4 Stats endpoint undercounts indexed URLs

- **File:** `frontend/src/app/api/indexing/sites/[siteId]/stats/route.ts:47-52`
- **Problem:** Only matches `"Submitted and indexed"` — misses `"Indexed"` and `"Indexed, not submitted in sitemap"`.
- **Fix:** Use the same status list as 2.3 above. Make this list a shared constant.

### 2.5 Submission method overwrite on dual-engine submit

- **Files:** `frontend/src/app/api/indexing/sites/[siteId]/submit/route.ts:198-206,263-270`, `frontend/src/lib/auto-indexer.ts`
- **Problem:** When submitting to both Google and Bing, Bing overwrites `submissionMethod` to `"indexnow"`, making dual-submitted URLs appear Bing-only in stats.
- **Fix:** Don't overwrite `submissionMethod` if already set for this submission cycle. Or support comma-separated: `"google_api,indexnow"`.

### 2.6 GSC disconnect clears OAuth tokens used for sign-in

- **File:** `frontend/src/app/api/indexing/gsc/disconnect/route.ts:37-45`
- **Problem:** Clears `access_token`, `refresh_token`, `expires_at`, `scope` from Account record. If user signed up via Google OAuth (not credentials), this breaks their ability to sign in.
- **Fix:** Store GSC-specific tokens separately from sign-in OAuth tokens (separate fields or a dedicated table). Only clear GSC tokens on disconnect.

### 2.7 GSC Search Analytics errors silently swallowed during sync

- **File:** `frontend/src/app/api/indexing/sites/[siteId]/sync-urls/route.ts:67-68`
- **Problem:** If GSC API returns error, the loop breaks silently. All URLs get marked "not indexed" even if they're actually indexed. Could trigger unnecessary re-submissions and waste credits.
- **Fix:** Capture the error, log it, and include a warning in the response so the UI can inform the user.

**Commit message:** `phase 2: data integrity — prevent data wipe, fix double counting, fix status matching, fix disconnect`

---

## Phase 3: Race Conditions & Credit Safety

**Branch:** `phase-3-race-conditions`

### 3.1 Quota check not atomic with submission

- **Files:** `frontend/src/app/api/indexing/sites/[siteId]/submit/route.ts:152-158`, `frontend/src/lib/auto-indexer.ts:203-204`
- **Problem:** Quota check and increment are separate DB operations. Two concurrent submissions can both pass the check and exceed the 200/day Google limit.
- **Fix:** Use atomic check-and-increment: `UPDATE ... SET googleSubmissions = googleSubmissions + N WHERE googleSubmissions + N <= limit` in a transaction.

### 3.2 Credit check not atomic in auto-indexer

- **File:** `frontend/src/lib/auto-indexer.ts:210-221`
- **Problem:** Credit balance check and `deductCredits` are separated by the API submission. Concurrent auto-index runs can drive balance negative.
- **Fix:** Use the deduct-before-submit-refund-on-failure pattern (already used in `submit/route.ts` — copy it to auto-indexer).

### 3.3 No server-side concurrency guard on sync/auto-index

- **Files:** `frontend/src/app/api/indexing/sites/[siteId]/sync-urls/route.ts`, `frontend/src/app/api/indexing/sites/[siteId]/run-auto-index/route.ts`
- **Problem:** Frontend disables buttons via state, but second tab or rapid clicks can trigger duplicates. Two concurrent syncs = duplicate URLs, two auto-index runs = double-deducted credits.
- **Fix:** Add `syncInProgress: Boolean` and `autoIndexInProgress: Boolean` timestamp fields on the `Site` model. Check and set atomically at operation start. Treat locks older than 10 minutes as stale.

### 3.4 Auto-indexer increments quota even when credit deduction fails

- **File:** `frontend/src/lib/auto-indexer.ts:261-266`
- **Problem:** If `deductCredits` fails, quota is still incremented. Credit accounting is wrong.
- **Fix:** Move quota increment inside the same transaction as credit deduction. If credits fail, don't increment quota.

### 3.5 Retry-failed cron doesn't use deduct-before-submit pattern

- **File:** `frontend/src/app/api/cron/retry-failed/route.ts:134-145`
- **Problem:** Credits deducted after submission. If deduction fails, user gets free submissions.
- **Fix:** Deduct before submit, refund on failure.

### 3.6 Removal requests bypass quota tracking

- **File:** `frontend/src/app/api/indexing/sites/[siteId]/request-removal/route.ts`
- **Problem:** URL removal requests use Google Indexing API but don't check/increment daily quota. Excessive removals can hit Google rate limits.
- **Fix:** Track in a separate quota counter, or count against submission quota.

**Commit message:** `phase 3: race conditions — atomic quota/credits, concurrency guards, deduct-before-submit`

---

## Phase 4: Error Handling & Robustness

**Branch:** `phase-4-error-handling`

### 4.1 URL checker treats network errors as submittable

- **Files:** `frontend/src/lib/url-checker.ts:39-48`, `frontend/src/lib/auto-indexer.ts:168-197`
- **Problem:** Network-unreachable URLs (`isAlive: false`) still get submitted to Google, wasting credits.
- **Fix:** Skip URLs where `isAlive === false`, not just `is404 === true`.

### 4.2 submitUrlsBatchToGoogle continues after 429 rate limit

- **File:** `frontend/src/lib/indexing-api.ts:84-106`
- **Problem:** After first 429, continues trying remaining URLs. All will fail, wasting time.
- **Fix:** After first 429, add all remaining URLs to `rateLimited` and break the outer loop.

### 4.3 No request body validation on POST routes

- **Files:** `frontend/src/app/api/indexing/sites/[siteId]/submit/route.ts:43`, `frontend/src/app/api/indexing/sites/[siteId]/inspect/route.ts:34`
- **Problem:** `await req.json()` without try-catch. Malformed JSON = unhandled 500.
- **Fix:** Wrap in try-catch or use `.catch(() => ({}))`.

### 4.4 `new URL()` can throw for malformed domains

- **Files:** `frontend/src/lib/auto-indexer.ts:383`, `frontend/src/app/api/cron/retry-failed/route.ts:227`
- **Problem:** Unhandled throw crashes entire auto-index run for that site.
- **Fix:** Wrap in try-catch (like `submit/route.ts:244-249` already does).

### 4.5 Middleware auth uses cookie presence only

- **File:** `frontend/src/middleware.ts:13-18`
- **Problem:** `hasSessionCookie()` only checks if cookie exists, not JWT validity. Dummy cookie = broken dashboard UX.
- **Fix:** Low priority but could add JWT signature check or at least validate cookie format.

### 4.6 JWT callback queries DB on every request

- **File:** `frontend/src/lib/auth.ts:48-76`
- **Problem:** 1-2 DB queries per request for role/planId lookup.
- **Fix:** Cache role/planId in JWT, refresh periodically (e.g., every 5 minutes) instead of every request.

### 4.7 Log tab missing action labels

- **File:** `frontend/src/app/api/indexing/sites/[siteId]/logs/route.ts:7-15`
- **Problem:** Missing labels for `"synced"`, `"status_updated"`, `"inspected"`. Show as raw strings.
- **Fix:** Add: `synced: "URLs synced from GSC"`, `status_updated: "Status updated"`, `inspected: "URL inspected"`.

### 4.8 Polling doesn't refresh quota display

- **File:** `frontend/src/app/[locale]/(dashboard)/dashboard/indexing/page.tsx:432-443`
- **Problem:** 10-second polling refreshes sites/credits/stats but not quota data. Quota bar stays stale after submissions.
- **Fix:** Add `loadSiteQuota` to the polling interval when a site is expanded.

### 4.9 IndexedUrl.url field is VarChar(500) — URLs >500 chars fail

- **File:** `frontend/prisma/schema.prisma:152`
- **Fix:** Increase to `VarChar(2048)` or add validation before DB write.

### 4.10 Sitemap parser doesn't handle gzipped sitemaps

- **File:** `frontend/src/lib/sitemap-parser.ts:19-35`
- **Problem:** Claims to handle `.xml.gz` but does plain `res.text()` with no decompression.
- **Fix:** Check Content-Encoding or URL extension, decompress gzipped responses before parsing.

### 4.11 Weekly resync doesn't re-check previously indexed URLs

- **File:** `frontend/src/app/api/cron/weekly-resync/route.ts:60-66`
- **Problem:** Only re-checks "submitted" URLs. If Google de-indexes a page, the app never detects the regression. Indexed count stays inflated.
- **Fix:** Periodically re-check a sample of "indexed" URLs (e.g., 10% per weekly run), or add a separate monthly full re-inspection cron.

**Commit message:** `phase 4: error handling — network checks, rate limit handling, body validation, URL length, gzip sitemaps`

---

## Phase 5: SEO Analyzer Fixes

**Branch:** `phase-5-analyzer-fixes`

### 5.1 Favicon analyzer crashes with wrong constructor

- **File:** `app/analyzers/favicon.py:61-68`
- **Problem:** Uses wrong `AnalyzerResult` kwargs when soup is None. Throws `ValidationError`.
- **Fix:** Use `self.create_result(severity=SeverityLevel.ERROR, summary=..., issues=[], data={})`.

### 5.2 Headings analyzer uses wrong variable in loop

- **File:** `app/analyzers/headings.py:183`
- **Problem:** References `page.h1_tags` from previous loop scope instead of current URL's page.
- **Fix:** Change `page.h1_tags[0]` → `pages[url].h1_tags[0]`.

### 5.3 Security analyzer `headers_present` count uses translated strings

- **File:** `app/analyzers/security.py:244-247`
- **Problem:** Counts headers by checking if status string `.startswith("✓")` — but strings are translated. Count can be wrong in non-English locales.
- **Fix:** Track with a dedicated counter during check loop, not by string-matching after.

### 5.4 Overall score formula masks critical failures

- **File:** `app/models.py:165-171`
- **Problem:** Simple average means 1 ERROR in 21 analyzers = 95/100 score. Critical failure nearly invisible.
- **Fix:** Cap score at max 70 if any analyzer is ERROR. Or use multiplicative penalty.

### 5.5 `total_issues` count inflated by SUCCESS issues

- **File:** `app/main.py:1011-1017`
- **Problem:** Counts SUCCESS-level "issues" (positive findings like "cms_detected") in total.
- **Fix:** Only count ERROR, WARNING, and INFO in `total_issues`.

### 5.6 Update outdated thresholds

- **File:** `app/config.py`
- Changes:
  - `TITLE_MIN_LENGTH`: 50 → 30 (titles 30-50 are common and acceptable)
  - `DESCRIPTION_MIN_LENGTH`: 150 → 70 (Google shows 120-char descriptions)
  - Desktop FCP target: 1.0s → 1.8s (matches Google's "Good" threshold)
  - Desktop LCP target: 1.5s → 2.5s (matches Google's "Good" threshold)
  - Desktop Speed Index target: 1.0s → 3.4s (matches Google's "Good" threshold)
  - Content MIN_CONTENT_WORDS: keep 300 for WARNING, add INFO for 100-300 range

### 5.7 Remove obsolete Flash detection

- **File:** `app/analyzers/mobile.py:69-88`
- **Problem:** Flash has been dead since 2020. Wasted CPU.
- **Fix:** Remove Flash detection code.

### 5.8 Links analyzer false positives from HEAD requests

- **Files:** `app/analyzers/links.py:99-101`, `app/crawler.py:434-447`
- **Problem:** Some servers return 403/405 for HEAD but 200 for GET. Flagged as "broken."
- **Fix:** Fall back to GET if HEAD returns 4xx/5xx.

**Commit message:** `phase 5: analyzer fixes — crashes, score formula, thresholds, false positives, dead code`

---

## Phase 6: Indexing Page Translations (Highest i18n Priority)

**Branch:** `phase-6-indexing-translations`

### 6.1 Add ~80+ translation keys for the indexing page

- **File:** `frontend/src/app/[locale]/(dashboard)/dashboard/indexing/page.tsx`
- **Problem:** This file has ~80+ hardcoded English strings. Ukrainian and Russian users see a mixed-language interface.
- **Fix:** Add all missing keys to `frontend/messages/{en,ru,uk}.json` under the `indexing` namespace. Replace every hardcoded string with `t()` calls. Categories to translate:
  - Status labels: "Indexed", "Not indexed", "Submitted", "Failed", "Pending", "Unknown", etc.
  - Relative time: "just now", "m ago", "h ago", "d ago" — use `Intl.RelativeTimeFormat` or translation keys
  - Toast messages: all success/error toasts
  - Modal content: Disconnect GSC, IndexNow verification (titles, descriptions, buttons)
  - Tab/filter labels: "Log", "All", "Google", "Bing", "Failed", etc.
  - Run Now panel: all status text, summary labels
  - Tooltips: all tooltip strings
  - Table headers, pagination text, empty states
  - Section heading: "Google Search Console"
  - QuotaBar labels: "used", "limit"

### 6.2 GSC tips library

- **File:** `frontend/src/lib/gsc-tips.ts`
- **Problem:** 14 hardcoded English tip strings + 2 fallbacks.
- **Fix:** Move all tips to translation files. Accept a `t` function parameter or use `useTranslations` at the call site.

### 6.3 Admin page hardcoded plan/role names

- **Files:** `frontend/src/app/[locale]/(dashboard)/dashboard/admin/page.tsx`, `frontend/src/app/[locale]/(dashboard)/dashboard/admin/users/page.tsx`, `frontend/src/components/layout/sidebar.tsx`
- **Problem:** "Free", "Pro", "Agency", "admin", "user" hardcoded in multiple places.
- **Fix:** Use existing translation keys (`plans.free`, `plans.pro`, `plans.agency`). Add role translation keys.

### 6.4 Other hardcoded strings

- Fix remaining hardcoded strings in: settings pages ("Email", "Upload failed"), audit/new ("Failed to start audit", "Connection error..."), audit-results ("Export failed"), branding (alt text).

### 6.5 Remove unused frontend translation keys

- Remove ~60 unused keys (listed in audit): unused `auth.*`, `dashboard.*`, `audit.*`, `settings.*`, `branding.*`, `indexing.*`, `marketing.*` keys.
- Remove entire `analyzer_content` section from frontend messages files (~460 keys per locale) — it's a duplicate of backend translations and never used by the frontend.

### 6.6 Remove unused backend translation keys

- Remove 8 unused `report.*` keys from `app/locales/{en,ru,uk}.json`.

**Commit message:** `phase 6: i18n — translate indexing page, remove unused keys, fix hardcoded strings`

---

## Phase 7: Mobile UI Fixes

**Branch:** `phase-7-mobile-fixes`

### 7.1 iOS auto-zoom on inputs (CRITICAL)

- **Problem:** All `<input>` and `<select>` use `text-sm` (14px). iOS Safari auto-zooms on focus.
- **Fix:** Change all input/select to `text-base md:text-sm` (16px on mobile, 14px on desktop). Affects: login, new audit, settings, branding, admin, export dialog, audit results search, landing hero. Full file list in mobile audit.

### 7.2 `h-screen` → `h-dvh` on dashboard layout

- **File:** `frontend/src/app/[locale]/(dashboard)/layout.tsx:74,63`
- **Problem:** `100vh` is taller than visible viewport on mobile browsers with address bars.
- **Fix:** Change `h-screen` to `h-dvh` (Tailwind v4 supports this).

### 7.3 Login form overflow at 375px

- **File:** `frontend/src/app/[locale]/(auth)/login/page.tsx:20`
- **Problem:** `max-w-sm` (384px) exceeds available width at 375px.
- **Fix:** Change to `max-w-[calc(100%-2rem)]` or `w-full max-w-sm mx-4`.

### 7.4 Touch targets — systematic fix

Apply minimum 44x44px touch targets across the app:

- All modal close buttons (X): change from `p-1` to `p-2` minimum — affects `confirm-dialog.tsx`, `export-dialog.tsx`, indexing page modals
- Header sidebar toggle: `h-8 w-8` → `h-10 w-10`
- Header logout: `p-2` → `p-3`
- Dashboard delete audit: `p-1` → `p-2`
- Admin "more" menu: `p-1.5` → `p-2.5`
- Indexing clear selection: `p-1` → `p-2`
- Issue card external links: increase icon size + wrapper
- Pagination prev/next: `px-3 py-1.5` → `px-4 py-2.5`
- Locale switcher items: `py-1.5` → `py-2.5`
- Admin inline selects: `py-0.5` → `py-1.5`
- Settings/branding save buttons: `py-2` → `py-3`
- Admin credits pencil: add `opacity-100 lg:opacity-0 lg:group-hover/credits:opacity-100`

### 7.5 Admin users table — add responsive handling

- **File:** `frontend/src/app/[locale]/(dashboard)/dashboard/admin/users/page.tsx:82-130`
- **Fix:** Add `hidden sm:table-cell` / `hidden md:table-cell` to non-essential columns. Add `truncate max-w-[200px]` to email column.

### 7.6 Admin action menu — mobile fix

- **File:** `frontend/src/app/[locale]/(dashboard)/dashboard/admin/page.tsx:514-597`
- **Fix:** Convert to modal/bottom sheet on mobile with backdrop and close button.

### 7.7 Audit progress stage labels overflow

- **File:** `frontend/src/components/audit/audit-progress.tsx:93-122`
- **Fix:** Remove `whitespace-nowrap` from labels, or use abbreviated labels on mobile.

### 7.8 Analyzer table — responsive treatment

- **File:** `frontend/src/components/audit/analyzer-table.tsx:62-172`
- **Fix:** Change URL cell `max-w-[300px]` → `max-w-[200px] sm:max-w-[300px]`. Add responsive column hiding.

### 7.9 Layout tweaks

- Audit results filter bar: remove `min-w-max`, allow wrap or add scroll indicator
- Settings tab nav: add `overflow-x-auto` or `flex-wrap`
- Branding logo: add `flex-wrap`
- Activity log label: `w-40` → `w-24 sm:w-40`
- Indexing site card header: `px-6` → `px-3 sm:px-6`
- New audit analyzer grid: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`

### 7.10 Add sticky table headers

- All tables: add `sticky top-0 z-10 bg-gray-950` to `<thead>` elements.

**Commit message:** `phase 7: mobile — iOS zoom fix, touch targets, responsive tables, layout fixes`

---

## Phase 8: Cleanup & Minor Improvements

**Branch:** `phase-8-cleanup`

### 8.1 Remove dead Session model

- **File:** `frontend/prisma/schema.prisma:71-77`
- **Problem:** Session table exists but JWT strategy is used. Dead code.
- **Fix:** Remove Session model from schema, run migration.

### 8.2 Add rate limiting to auth endpoints

- **Files:** NextAuth handler, dev-login, settings password change
- **Fix:** Add rate limiting middleware (e.g., `upstash/ratelimit` or custom token-bucket). IP-based + user-based limits.

### 8.3 Password change — add minimum length validation

- **File:** `frontend/src/app/api/settings/route.ts:21-43`
- **Fix:** Add `if (newPassword.length < 8)` check.

### 8.4 Admin page — add server-side layout protection

- **File:** `frontend/src/app/[locale]/(dashboard)/dashboard/admin/`
- **Fix:** Add server-side `auth()` check in a layout.tsx wrapper for the admin route group.

### 8.5 Remove duplicate cron route

- **Problem:** Both `/api/indexing/cron` and `/api/cron/daily-indexing` do essentially the same thing. The simpler one appears to be legacy.
- **Fix:** Remove `/api/indexing/cron` if it's not used by any external timer. Update the systemd timer if needed.

### 8.6 Crawler improvements (lower priority)

- Strip known tracking parameters (utm\_\*, fbclid, gclid) during URL normalization
- Add optional rate limiting / back-off on 429 responses
- Add size limit to GET fallback for image size checks
- Consider respecting robots.txt (or document that intentional ignoring is by design)

**Commit message:** `phase 8: cleanup — dead code, rate limiting, password validation, admin protection`

---

## Phase Summary & Recommended Order

| Phase | Branch                          | Focus                                                                                   | Est. Effort  |
| ----- | ------------------------------- | --------------------------------------------------------------------------------------- | ------------ |
| 1     | `phase-1-security-fixes`        | Critical security (cron auth, plan upgrade, email linking, dev login, token encryption) | Medium       |
| 2     | `phase-2-data-integrity`        | Data loss prevention (empty sync wipe, double counting, status matching, disconnect)    | Medium       |
| 3     | `phase-3-race-conditions`       | Atomic operations (quota, credits, concurrency guards)                                  | Medium-Hard  |
| 4     | `phase-4-error-handling`        | Robustness (network checks, 429 handling, body validation, gzip, URL length)            | Medium       |
| 5     | `phase-5-analyzer-fixes`        | Backend analyzers (crashes, score formula, thresholds, false positives)                 | Medium       |
| 6     | `phase-6-indexing-translations` | i18n (80+ hardcoded strings, unused keys, GSC tips)                                     | Large        |
| 7     | `phase-7-mobile-fixes`          | Mobile UI (iOS zoom, touch targets, responsive tables, layout)                          | Large        |
| 8     | `phase-8-cleanup`               | Housekeeping (dead code, rate limiting, password validation, admin protection)          | Small-Medium |

**Execute in order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**

all tasks should be sequential
