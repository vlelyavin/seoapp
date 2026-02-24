# SEO Audit UI Tasks — Full Batch

All changes are in `/var/www/seo-audit/frontend`.

After completing all tasks:
```
git add -A
git commit -m "ui: auth flow, headers, branding, tabs, admin, indexnow, pricing, landing"
git push
```

---

## 1. Remove separate login page — trigger Google OAuth directly

The app only supports Google sign-in. Remove the friction of a dedicated login page.

**Changes:**
- In `src/components/layout/marketing-header.tsx`: change the "Sign in" / "Sign up" links (currently point to `/login`) into a single `<button>` that calls `signIn("google", { callbackUrl: "/${locale}/dashboard" })` from `next-auth/react`. Show Google SVG icon + text `{t("signIn")}`.
- In `src/components/layout/header.tsx`: same — the "Login" link → button calling `signIn("google")`.
- The login page at `src/app/[locale]/(auth)/login/page.tsx` can be kept as a fallback redirect (just call `signIn("google")` on mount via `useEffect`) or deleted — whichever is simpler.

---

## 2. Marketing header — logged-in state with user avatar

File: `src/components/layout/marketing-header.tsx`

**When not logged in:**
- Single `<button>` with Google SVG icon + `{t("signIn")}` text, styled: `rounded-md border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800 flex items-center gap-2`

**When logged in:**
- Left side: `Dashboard` link (keep existing, but change from `bg-white text-black` to `bg-gradient-to-r from-copper to-copper-light text-white`)
- Right side: user avatar (circular, from `session.user.image`) + display name + logout button
- Avatar: `<Image src={session.user.image} width={28} height={28} className="rounded-full" />`; if no image, show initials in a dark circle
- Layout: `flex items-center gap-2`

---

## 3. Dashboard app header — add user avatar

File: `src/components/layout/header.tsx`

Currently shows: name + logout icon.

Add user avatar before the name:
- `<Image src={session.user.image} width={28} height={28} className="rounded-full" />` (with fallback to initials circle if no image)
- Keep name and logout icon as-is

Also: change the not-logged-in Login button from `bg-white text-black` to match the copper theme: `bg-gradient-to-r from-copper to-copper-light text-white`.

---

## 4. Fix vertical overflow scrollbar on all tab strips

Every tab strip in the app shows a vertical scrollbar on the right side. Fix all occurrences.

**Settings layout** (`src/app/[locale]/(dashboard)/dashboard/settings/layout.tsx`): the tab nav container needs `overflow-hidden` on its wrapper so the border-bottom of the container doesn't create a scrollable area.

Search the entire `src/` for tab nav patterns (border-b + flex + tab buttons) and add `overflow-hidden` to the immediate wrapper div in each case. Reference: `indexing/page.tsx` line ~1372.

---

## 5. Rename "General" settings tab to "Profile"

File: `src/app/[locale]/(dashboard)/dashboard/settings/layout.tsx` — tab uses `t("tabGeneral")`.

In `messages/en.json`, `messages/ru.json`, `messages/uk.json` (in `settings` namespace):
- en: `"tabGeneral": "Profile"`
- ru: `"tabGeneral": "Профиль"`
- uk: `"tabGeneral": "Профіль"`

---

## 6. Branding page redesign

File: `src/app/[locale]/(dashboard)/dashboard/settings/branding/page.tsx`

### 6a. Remove description paragraph
Remove `<p className="text-sm text-gray-400">{t("description")}</p>` and delete `"description"` key from `branding` namespace in all 3 translation files.

### 6b. Add "Branding" heading inside the form
Add as first child of `<form>`:
```tsx
<h2 className="mb-4 text-lg font-semibold text-white">{t("title")}</h2>
```
Add `"title"` key: en `"Branding"`, ru `"Брендинг"`, uk `"Брендинг"`.

### 6c. Add field descriptions
Under each `<label>`, before the input, add a `<p className="mb-2 text-xs text-gray-500">`:
- Company Name: en `"Your company name will appear in the header of exported PDF, HTML, and DOCX reports."`
- Logo: en `"Your logo will appear at the top of exported reports. Recommended: 250×80px, PNG or SVG."`
Add `companyNameDescription` and `logoDescription` keys to all 3 translation files.

### 6d. Redesign logo upload as a drop zone (no button)

Replace the entire logo upload UI with a drop zone:
- Size: `w-[250px] h-[180px]`
- Styles: `rounded-xl bg-gray-900 border border-gray-700`
- On hover + on `dragOver`: `border-copper ring-2 ring-copper/20`
- Handle `onDragOver` / `onDragLeave` / `onDrop`
- Entire area = `<label>` wrapping hidden `<input type="file">`

**No logo:** centered `ImageIcon` (h-8 w-8 text-gray-500) + title `{t("uploadPrompt")}` + instruction `{t("uploadInstruction")}` (en: `"Click to upload or drag & drop"`)

**Logo uploaded:** logo image centered (`object-contain p-3`), "Replace" overlay button at bottom-center on hover (`group-hover:opacity-100`)

**Uploading:** spinner overlay

### 6e. Add "Remove logo" button
When a logo is uploaded, show a small text button below the drop zone:
```tsx
<button type="button" onClick={handleRemoveLogo} className="text-xs text-gray-500 hover:text-red-400 transition-colors mt-1">
  {t("removeLogo")}
</button>
```
`handleRemoveLogo`: calls `DELETE /api/settings/branding/logo` (create this endpoint — it clears `logoUrl` in the DB for the user), then clears `logoUrl` and `previewUrl` state.

Create `src/app/api/settings/branding/logo/route.ts` with `DELETE` handler (auth check, clear `logoUrl` in `BrandSettings`).

Add `"removeLogo"` key: en `"Remove logo"`, ru `"Удалить логотип"`, uk `"Видалити логотип"`.

---

## 7. Remove italic from landing section subtitles

In the following files, replace `italic` with `not-italic` in the small copper-colored subtitle `<p>` tags above section headings:
- `src/components/landing/indexing-how-it-works.tsx`
- `src/components/landing/pricing-section.tsx`
- `src/components/landing/hero-section.tsx`
- `src/components/landing/faq-section.tsx`
- `src/components/landing/indexing-features-section.tsx`
- `src/components/landing/features-section.tsx`
- `src/components/landing/indexing-pricing-section.tsx`
- `src/components/landing/indexing-hero-section.tsx`
- `src/components/landing/indexing-faq-section.tsx`

---

## 8. Landing page — remove section borders + add feature card icons

### 8a. Remove borders between sections
Find `border-t` or `border-b` dividers between landing page sections (not card borders, just the full-width section separators) and remove them.

### 8b. Add icons to feature cards
File: `src/components/landing/features-section.tsx`

Each feature card (`20+ SEO Metrics`, `Real-Time Progress`, `Multi-Language Reports`, `Export Formats`, `Actionable Insights`, `Fast & Accurate`) should have a lucide-react icon at the top-left of the card. Pick the most fitting icon per card. Suggested:
- 20+ SEO Metrics → `BarChart3`
- Real-Time Progress → `Activity`
- Multi-Language Reports → `Globe`
- Export Formats → `FileDown`
- Actionable Insights → `Lightbulb`
- Fast & Accurate → `Zap`

Icon size: `h-5 w-5 text-copper`, placed above the card title.

---

## 9. URLs tab — desktop layout + active tab gradient + remove min-height

File: `src/app/[locale]/(dashboard)/dashboard/indexing/page.tsx`, URLs tab section (~line 1652).

### 9a. Desktop layout (md+): one row, tabs left / search right
```tsx
<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
  <div className="flex flex-wrap gap-1">{/* filter tabs */}</div>
  <div className="flex items-center gap-2">{/* search + refresh */}</div>
</div>
```
Mobile: keep stacked layout (unchanged).

### 9b. Active tab: gradient instead of solid
Replace `bg-copper` with `bg-gradient-to-r from-copper to-copper-light` on the active filter tab button.

### 9c. Remove min-height
Remove `min-h-[36px]` from filter tab button className.

---

## 10. Pricing page — plan card icons + button icons

File: `src/components/landing/pricing-section.tsx` (and any dashboard plans page).

Add lucide-react icon to each plan card header (above/beside plan name, `h-6 w-6`):
- Free → `Zap` (text-gray-400)
- Pro → `Rocket` (text-copper)
- Agency → `Building2` (text-copper)

Plan action buttons:
- "Current plan" button → add `<Check className="h-4 w-4" />` before text
- "Select plan" / "Get started" → add `<ArrowRight className="h-4 w-4" />` before text

---

## 11. CTA buttons in modals/popups — font size + icons

### 11a. Font size
All CTA buttons inside modals/popups (any `fixed inset-0` overlay component) should use `text-sm` minimum — match the button size from indexing page modals.

### 11b. Icons on all CTA buttons
Every primary/destructive action button in a modal should have a relevant lucide-react icon before the text. Examples:
- Save / Confirm → `Save` or `Check`
- Delete / Remove / Revoke → `Trash2`
- Verify / Check → `ShieldCheck`
- Download → `Download`
- Submit → `Send`
- Connect → `Link`
- Proceed / Continue → `ArrowRight`

**Exception:** Cancel / Close / Back buttons — no icon needed.

### 11c. IndexNow verification modal — equalise button styles
In `IndexNowVerifyModal` (~line 2637 of `indexing/page.tsx`):
- "Download key file" button and "Verify" button must have **identical** styles: same size, same background (use the secondary/outline style, NOT the orange CTA gradient), both `text-xs`
- Currently "Download key file" is oversized with accent background — make it match "Verify": `rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 flex items-center gap-1.5`
- "Download key file" icon: `Download className="h-3.5 w-3.5"`
- "Verify" icon: `ShieldCheck className="h-3.5 w-3.5"`

---

## 12. Admin page — fix context menu + table layout

File: `src/app/[locale]/(dashboard)/dashboard/admin/page.tsx`

### 12a. Fix context menu clipping
The "..." actions dropdown (~line 515) is clipped by the `overflow-x-auto` table wrapper. Fix by rendering the dropdown with `position: fixed` relative to the viewport instead of `absolute` relative to the row.

Replace the dropdown positioning from `lg:absolute lg:right-0 lg:top-full` to use a fixed-position approach: calculate the button's `getBoundingClientRect()` on open and position the dropdown relative to viewport. Use a `useRef` on the trigger button and a `useEffect` / `useState` to track position.

Alternatively, if simpler: move the `overflow-x-auto` to wrap only the `<table>` element (not the entire card), and ensure the actions column has enough right margin so the dropdown has room to render.

### 12b. Remove extra border at bottom
Find and remove the extra `border-b` on the last row or the table container bottom.

### 12c. Add table inner padding
Wrap the `<table>` in a container with `px-4 pb-4` (or similar) so the table has breathing room from the card edges. This also makes it easier to manage the dropdown positioning.

---

## 13. IndexNow key download endpoint + verification fix

### 13a. Create download endpoint
Create `src/app/api/indexing/sites/[siteId]/download-key/route.ts`:
```ts
// GET — returns {key}.txt as downloadable file
// Auth check + site ownership check (same pattern as verify-key route)
// Response: new NextResponse(site.indexnowKey, {
//   headers: {
//     "Content-Type": "text/plain",
//     "Content-Disposition": `attachment; filename="${site.indexnowKey}.txt"`
//   }
// })
```

### 13b. Update IndexNowVerifyModal — Step 1: download instead of copy

Replace the "copy key value" step with a download button:
```tsx
<a
  href={`/api/indexing/sites/${site.id}/download-key`}
  download
  className="rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 flex items-center gap-1.5 w-fit"
>
  <Download className="h-3.5 w-3.5" />
  {t("downloadKeyFile")}
</a>
```
Add `"downloadKeyFile"`: en `"Download key file"`, ru `"Скачать файл ключа"`, uk `"Завантажити файл ключа"`.

Step 2 instruction stays: shows the URL where the file must be accessible.
Step 3 (Verify button) stays.

### 13c. Fix re-verify race condition

**Bug:** After clicking "Re-verify" when file is missing, UI briefly shows failure then flips back to "verified".

**Fix:**
1. In `reVerify()` (~line 1275): on failure, instead of just showing a toast, call `onVerifyFail()` AND open the IndexNow modal (`setIndexNowModal({ action: () => {} })`). Remove the failure toast — the modal is the feedback.
2. Check if there's any polling/refetch that could overwrite `indexnowKeyVerified` state after a failure. If the site list is re-fetched from the server periodically, ensure the fetch also reads the updated DB value (the `verify-key` endpoint already writes `false` to DB on failure, so a fresh fetch should return `false` — verify this is the case).
3. Remove any optimistic `setVerified(true)` calls that might fire before the API responds.

### 13d. Ensure all IndexNow actions use the guard
Confirm `withIndexNowGuard` is applied to every Bing-related action: "Submit All Not Indexed (Bing)", per-URL Bing submit, "Enable Auto-index via Bing" toggle, bulk submit. The guard opens the modal (not a toast) when the file is missing.
