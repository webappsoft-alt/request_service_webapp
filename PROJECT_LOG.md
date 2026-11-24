# Request Service — Project Log

What this project is and every change to the website and portals. **Every change gets a line in
the [Change log](#change-log)** (newest first): what changed, why, and the files. The API has its
own log in `request-service-backend/PROJECT_LOG.md`; a feature that touches both is logged in both.

---

## 1. What the project is

A home-services marketplace plus a CRM for service businesses ("Pros"). Homeowners find a Pro, ask
for quotes, book services, sign estimates, and pay invoices. Pros run their whole business in the
pro portal, and give their technicians and subcontractors their own logins.

| App | Folder | Stack | Runs on |
|---|---|---|---|
| Website + all portals | `request_service_webapp/` | Next.js 16 (App Router), React 19, Tailwind v4, Redux Toolkit, socket.io-client | `localhost:3000` |
| API | `request-service-backend/` | Node.js, Express 5, MongoDB (Mongoose 8), Redis, socket.io, Twilio, OpenAI, Firebase (push) | `src/server.js` |
| Super admin console | `admin/` | Vite + React 19, Tailwind v4, Redux Toolkit | `localhost:5173` |

> Next.js 16 has breaking changes. Before writing Next code, read the guide in
> `request_service_webapp/node_modules/next/dist/docs/`.

## 2. Who uses what

| User | Where | Route group / prefix |
|---|---|---|
| Visitors | Public website, pro landing pages | `app/(marketing)` — `/`, `/services/*`, `/find-a-professional`, `/get-a-quote`, `/for-pros`, `/for-pros-v1` |
| Customers | Customer dashboard | `app/(customer)` — `/account/dashboard/*` |
| Pros (owner / office) | Pro portal | `app/(portal)` — `/pro/dashboard/*` |
| Technicians | Technician portal | `app/(technician)` — `/technical/*` |
| Subcontractors | Contractor portal | `app/(contractor)` — `/contractor/*` |
| Platform admins | Super admin | `admin/` (separate app) |

**Pro portal sidebar** (`lib/data/portal-nav.ts`): Dashboard, Pipeline · People: Customers, Employees,
Contractors, Vendors, Timesheets, Employee tracking, Reminders · Work: Leads, Messages, Estimate,
Jobs, Tasks, Schedules, Fixed service orders · Money: Invoices, Payments · Office: Business
Profile, Subscription, AI Receptionist, Portfolio, Service areas, Fixed services, Utilities, Reports.

## 3. Backend

Modules, layout, notification channels and API conventions: see
`request-service-backend/PROJECT_LOG.md`.

## 4. Conventions worth knowing

- **Reset / verification codes go by SMS to the phone** — never email, never in an API response.
- **Fixed services** are filed only under the Pro's own categories.
- **Redux slices** use `createAsyncThunk` with `condition` and soft loading (keep cached data on
  screen while refreshing; no full-page spinner after the first load).
- **Pro sidebar badges** come from unread notifications grouped by section
  (`modules/notification/sections.js`), pushed over the socket as `provider:inbox-counts`.
- **Customer-visible invoices** are only `sent`, `partially_paid`, `paid`, `overdue` — drafts are
  never linked or shown to the customer.
- **Dark mode** for light tints (`bg-amber-50`, `text-amber-800`, …) is handled globally by
  `app/dark-tints.css` (generated). Light mock-ups opt out with `data-light`.
- Schedule module entry points: `lib/api/crm-client.ts` (`querySchedule`, `assignSchedule`),
  `lib/api/crm-mappers.ts` (`mapScheduleEvent`), `components/portal/event-calendar.tsx`.
- Read-only database checks: a temporary script in `request-service-backend/scripts/` named
  `_*.tmp.mjs`, run once, then deleted. Atlas DNS can fail once — connect with a retry loop.

---

## Change log

Newest first. Format: **what** — why · files.

### 2026-11-24
- **Admin `/tax`: one unified tax table (replaces the City / State tabs)**
  - **Why:** client request. Admins wanted one list with every rule, so nothing is re-entered.
  - **Data:** frontend only. No backend or database change. The two existing record types are read from their APIs (`GET /admin/tax`, `GET /admin/tax/cities`) and merged. Nothing is migrated, rewritten or reset: all 48 state records and Huntsville, AL are untouched. Backend priority is unchanged: City + State rule → state rule → 0.
  - **Table:**
    - Columns: City, State, Code, Tax Rate (%), Status, Actions.
    - State-wide rows show an "All cities" badge with "State default". City rows show the city name (editable inline) and "Overrides state X%" or "No state-wide rate".
    - Sorted by state: the state-wide row first, then its cities.
    - Inline edit: the rate on every row (saves on blur, Enter or Save), and the city name on city rows (Enter / Save; duplicates are refused).
    - Delete always goes through the confirmation dialog, naming the exact rule and what applies next.
  - **KPIs:** state-wide rates, city rates, average rate, states without a state-wide rate.
  - **Add tax rate (one dialog):**
    - An "Applies to" choice: a specific city (State + City with suggestions) or the whole state (all cities).
    - A whole-state rate for a state that already has one is blocked, with a hint to edit it in the table.
  - **Settings → Tax rates:** renders the same panel (no tabs).
  - **Verified in a headless browser** against the running admin dev server. The page's API calls were intercepted in the browser, so **no write reached the server**, and no admin login was used. Real rates came from the read-only public `/api/public/tax-rate`.
    - One table with 49 rules (48 state-wide + Huntsville, AL); old tabs gone.
    - Add a city (Aurora, CO, via suggestions), edit its rate and rename it inline, delete it through the confirmation dialog.
    - The whole-state add is blocked for Colorado.
    - The real data compared identical before and after.
  - **Files:** `admin/src/pages/tax.jsx`.
- **City-based sales tax: admin `/tax` City Tax Rates + delete confirmation; Pro previews use the city rate**
  - **Why:** client request. Tax was state-only. The backend now resolves City rate → State rate → 0 (see backend log).
  - **Admin** (`admin/src/pages/tax.jsx`, `admin/src/store/api/taxApi.js`):
    - The page is now "Sales Tax Rates" with two tabs. The header button adds to the active tab.
    - **City Tax Rates** (default) has columns City (with the state rate under it), State, Code, Tax Rate (%), Status and Actions. Its KPIs are city rates, states covered, average city rate, and states with a fallback.
    - **State Tax Rates (fallback)** is the old table plus a "City overrides" KPI and a per-state city count.
    - Both tabs have inline edit + Save, and search by city, state or code.
    - The Add City dialog has State, City (suggestions from `/public/us-cities`, cities already configured hidden) and Rate, plus a hint naming the state rate it replaces.
    - **Fix:** the trash icon in both tables no longer deletes instantly. It opens a `DeleteConfirmDialog` naming the exact rule (e.g. "Austin, Texas (TX) · 8.30%") and what applies next, with Cancel / Confirm Delete.
    - Settings → Tax rates embeds the same tabs.
  - **Pro portal:**
    - `lib/tax/state-tax.ts` `fetchTaxRatePercent` accepts an address `{ city, state }` (a plain state still works) and sends `city`.
    - Callers now pass the city: estimate workspace (rate reuse keyed on state|city), create estimate / job dialogs, job costing, job file, and record detail (quote property address). Previews now match what the backend saves.
  - **Tested live** (admin UI on a test dev server against the test API):
    - Added Austin, TX at 8.25% via the modal and its suggestions.
    - Inline-edited it to 8.30%; the lookup returned 8.30 (city).
    - Trash → Cancel kept the rate; Trash → Confirm Delete removed it and Austin fell back to TX 8.20%.
    - State tab: trash opens the confirmation; Cancel left Alaska unchanged.
  - **Files:**
    - `admin/src/pages/tax.jsx`, `admin/src/store/api/taxApi.js`, `lib/tax/state-tax.ts`;
    - `components/portal/{create-work-dialogs,job-costing,job-file}.tsx`;
    - `components/portal/views/record-detail-views.tsx`;
    - `components/portal/estimate-v2/new-estimate-workspace-view.tsx`.
- **Kitchen & Bath Design style cards redone as compact cards**
  - **Why:** client feedback ("not good UI"). The tall cards with a finish table and chips were too busy, and styles without finishes (Minimalist, Japandi) left big empty cards.
  - **New card:**
    - a framed photo (inset, rounded) with the room tag on hover;
    - the name with a "Try →" pill, which fills on hover;
    - a two-line summary: the description, else the default finish names, else "The <style> <room> look, ready to customize.";
    - a slim segmented palette bar with the color names under it, or a dashed bar with "Choose your own finishes" when there's no palette.
  - Every card is the same height. The room switch's active tab is now solid primary. Behavior is unchanged: switching rooms, and a click selects the style in the designer (verified). Desktop, dark mode and 375px were checked.
  - **Files:** `components/ai-redesigner/kitchen-bath-sections.tsx`.
- **Kitchen & Bath Design page: site container width + original style-library cards**
  - **Why:** client request. The page used `max-w-6xl px-4` (narrower than the navbar), and the style grid's dark name/swatch pill over each photo looked too close to an outside reference site.
  - **Container:** every section (hero, live designer, how it works, style library, quote bridge, FAQ) now uses `container-site`, the same wrapper as the header and Home. Checked live: section edges match the navbar at 1440 (143–1283px), 820 (32–773px) and 375 (20–355px), with no horizontal overflow.
  - **Style library:** new copy ("Explore curated kitchen & bath styles" / "Pick a starting aesthetic, then customize cabinetry, surfaces, fixtures and finishes in the designer."). Each card now has:
    - the photo on top, with a room/finish tag in the top-left on hover;
    - a card footer with the style name and description;
    - the first 3 default finishes (e.g. "Cabinets: Shaker · Greige"), resolved from the catalog's finishes and room labels;
    - labeled color chips from the default color finishes, falling back to the style's swatches;
    - a "Try this style →" row.
  - **Room switch:** the Kitchen/Bathroom switch is restyled as a segmented control. Behavior is unchanged: switching rooms, and clicking a card selects that room and style in the designer and scrolls to it (verified). Dark mode and 375px were checked.
  - **Files:** `app/(marketing)/kitchen-bath-design/page.tsx`, `components/ai-redesigner/kitchen-bath-sections.tsx` (`StyleShowcase` now takes `finishes` + `rooms`).
- **Pro marketing site moved `/for-pros` → `/pros` (trade pages at `/pros/trades/<trade>`)**
  - **Why:** client request. `/pros/<slug>` already is the public Pro profile (customer page), so a separate `/pros/[trade]` route is impossible (Next.js can't have two dynamic segments at one level). The user chose "trades under /pros/trades".
  - **Routes** (folders moved):

    | Old | New |
    |---|---|
    | `(marketing)/for-pros/page.tsx` | `(marketing)/pros/page.tsx` |
    | `for-pros/pricing` | `pros/pricing` |
    | `for-pros/blog/**` | `pros/blog/**` |
    | `for-pros/locations/[state]/[city]` | `pros/locations/[state]/[city]` |
    | `for-pros/[trade]` | `pros/trades/[trade]` |
    | `(auth)/for-pros/join` | `(auth)/pros/join` |

    The `/for-pros-v1` preview page (which only redirected) was removed.
  - **Paths:**
    - `lib/pro-paths.ts`: `home /pros`, `pricing /pros/pricing`, new `blog /pros/blog`, `join` / `register /pros/join`, `trade(t) → /pros/trades/t`, `location → /pros/locations/…`.
    - New `PRO_SITE_SECTIONS` (pricing, join, blog, locations, trades). `isProMarketingPath` is true for `/pros` and those sections only, never for `/pros/<profile-slug>`.
    - Header, logo, footer, route guard, bot exclusion, session scope (`lib/session-scope.ts`) and public-data cache (`public-data-sync.tsx`) all go through it, so profiles stay customer pages.
  - **Redirects** (`next.config.ts`, permanent = 308):
    - `/for-pros` → `/pros`; `/for-pros/pricing`, `/join`, `/blog(/…)`, `/locations/…` → same under `/pros`;
    - `/for-pros/<trade>` → `/pros/trades/<trade>`; any other `/for-pros/…` → `/pros/…`;
    - `/for-pros-v1` → `/pros`;
    - the older `/pro`, `/pro/pricing`, `/pro/register`, `/for-providers` and `/providers/register` now go straight to `/pros…` (no chains).
  - **SEO:**
    - Canonical / `og:url` follow `proPaths`. The sitemap section is renamed `for-pros` → `pro-site` (`/sitemaps/sitemap/pro-site.xml`, old id still answered) and lists `/pros`, `/pros/pricing`, `/pros/join`, `/pros/trades/…`, `/pros/locations/…`.
    - `llms.txt` links are updated, and the auth-page check in `apiFuntions.ts` uses `/pros/join`.
  - **Comments** across blog / pro / data files updated. The only `for-pros` strings left are the legacy redirect rules and the old-path fallback / notes (`session-scope.ts`, `pro-paths.ts`, `marketing-shell.tsx`, `sitemap-entries.ts`).
  - **Checked live:**
    - all 9 legacy URLs return 308 to the right page;
    - `/pros`, `/pros/pricing`, `/pros/join`, `/pros/blog`, `/pros/trades/plumbers`, `/pros/locations/tx/austin` return 200 with canonical / `og:url` on `/pros…`;
    - in the browser, Pro pages show the Pro header and `/pros/apex-advisory-group` (a profile) shows the customer header;
    - source type check clean (`.next/types` regenerates on the next build).
  - **Files:**
    - `next.config.ts`
    - `lib/pro-paths.ts`
    - `lib/session-scope.ts`
    - `lib/sitemap-entries.ts`
    - `app/llms.txt/route.ts`
    - `components/api/apiFuntions.ts`
    - `components/layout/marketing-shell.tsx`
    - `components/realtime/public-data-sync.tsx`
    - the moved `app/(marketing)/pros/*` and `app/(auth)/pros/join` pages, plus comments in blog / pro / data files.
- **Pricing: "Compare plans" feature matrix; signed-in Pros could not open Pro marketing pages; stage time hint**
  - **Compare plans** (new `components/pro/compare-plans.tsx`, under the plan cards on `/for-pros/pricing`, `#compare`):
    - Columns are the live plans from admin → Subscription Plans (Free · Starter · Growth · Scale today).
    - Every cell is computed from that plan's own settings (`modules`, crew seats, AI voice minutes), so the table follows admin edits. ✓ / – / limits such as "Owner only", "Up to 5", "Unlimited", "500 min / mo".
    - 6 groups, 24 features, all original copy covering only real Request Services features: Core Access & Team · Lead & Client Management · Scheduling & Dispatching · Job & Project Management · Estimates, Invoicing & Payments · Pro Co-pilot & AI Tools.
    - Each feature name / chevron opens a 1–2 sentence explanation (smooth grid-rows animation, `aria-expanded` / `aria-controls`).
    - The plan header row (name, price for the billing toggle, CTA) is sticky under the 68px header. CTAs match the plan cards: guest → register with the plan, signed-in Pro → Subscription.
    - Phones: plan tabs show one plan column at a time (popular plan first).
    - `ProSubscriptionPlan` gains `modules` (portal, leads, orders/jobs, estimates/invoices, schedules/timesheets, crew logins, subcontractors, mobile app) from the API.
    - The landing page's "Compare plans" link now goes to `#compare`.
  - **Fix** (`components/auth/auth-route-guard.tsx`): a signed-in Pro got a blank page on Pro marketing pages (`/for-pros/pricing`, trade pages…). The guard hid every non-dashboard page but only redirected from customer pages, the Pro login and the Pro landing. Hiding now uses the same condition as the redirect. Existing redirects are unchanged (`/for-pros` → dashboard).
  - **Stage time dialog** (`estimate-v2/project-stages.tsx`): with 0 days and some hours it now says "0 days is fine — this stage goes on the Schedule as one day, starting 9 AM." (0 d + 1 h already saved correctly; see the backend log.)
  - **Checked live:**
    - guest: 4 plans, 6 groups / 24 rows, accordion 0 → 66px, sticky header at 68px;
    - 375px: tabs, no horizontal scroll;
    - signed-in Pro: page renders, CTAs → `/pro/dashboard/subscription`.
    - Type check and lint clean.
  - **Files:**
    - `components/pro/compare-plans.tsx` (new)
    - `components/pro/pro-pricing-view.tsx`
    - `lib/constants/subscription-plans.ts`
    - `components/auth/auth-route-guard.tsx`
    - `components/portal/estimate-v2/project-stages.tsx`
- **Schedule calendar shows the Pro's closed days; drag / drop and hour changes follow them**
  - **Month view** (`event-calendar.tsx`):
    - Closed weekdays come from Business Profile → Working hours (auth provider `settings.workingHours`).
    - Their cells get a "Closed" tag and a light hatch.
    - Multi-day work bars break around closed days (e.g. JOB-930 now shows Mon–Fri and no longer runs over Saturday / Sunday). Single-day items keep their day.
  - **Drag / drop / resize:** work dropped on a closed day moves to the next open day right away (same rule as the API), with a toast: "Saturday is closed in your Working hours — moved to Monday, Dec 14."
  - **Profile editor** (`profile-view.tsx`): when changing the closed days re-planned the schedule, a toast says so ("Schedule updated for your new hours: 1 project re-planned, …").
  - **Checked live:** November 2026 showed 9 Closed tags on Sat / Sun, and JOB-930 stopped at Friday. Type check and lint clean (6 existing warnings in `event-calendar.tsx`).
- **Schedule month view: previous / next-month days keep their borders, light grey fill; stage dialog note**
  - **Month view** (`components/portal/event-calendar.tsx`):
    - Leading / trailing days of other months now use the same solid grid line as the month (`outMonthLine = inMonthLine`; it was `var(--border-soft)`, so their boxes looked borderless).
    - Fill is light grey `#f1f3f6` (was `bg-muted/30`), and the date is muted `text-slate-400`.
    - In-month weekends (pink), today and the drag / selected states are unchanged.
  - **Stages dialog** (`estimate-v2/project-stages.tsx`): adds "Days marked Closed in your Working hours are skipped." next to the start date. Off-day skipping itself is in the API (see the backend log).
  - **Checked live:** December 2026 shows Nov 29–30 and Jan 1–2 as grey boxes with full borders; February 2027 shows Jan 31 and Mar 1–6 the same way. Type check and lint clean.
- **Business Profile follow-up: gallery mosaic; edit page back arrow + actions on the step row**
  - **Gallery** (`business-profile-detail-view.tsx`):
    - The banner is on the left. The other photos fill a block of the same height on the right (26rem on desktop), with a tile layout per count (`GALLERY_TILE_GRID`: 1 → one tile, 2 → two tall tiles, 3 → one wide tile + 2, 4 → 2×2, 5 → one wide tile + 4, 6 → 3×2), so there are never empty cells.
    - The banner has a "Main banner" tag; with no other photos it shows wide (21:9).
    - Previous: square thumbnails that left a gap beside the banner (user feedback, "image sequence not good").
  - **Edit header** (`profile-view.tsx`):
    - "Cancel" removed; a back arrow beside "Public listing / Edit business profile" (`backHref`) goes back to the profile.
    - Update and Next / Submit moved from the header to their own row right under the step tabs, right-aligned, same size (h-10, min-w-28). At first they were on the tab line; the user asked for them after the tabs instead.
  - **Checked live:**
    - 1600px: buttons 112×40, on the same line as the tabs;
    - 375px: no horizontal scroll;
    - gallery at 1600 and 375 with no overflow;
    - type check and lint clean.
- **Business Profile: balanced view layout; edit page with clickable step tabs and top-right actions**
  - **Why:** client feedback. The view page had a large empty gap under Working hours. In the editor, the Pro had to click Next through every step, and the bottom-right Update / Next buttons sat under the floating Pro Co-pilot pill.
  - **View** (`/pro/dashboard/settings`, `business-profile-detail-view.tsx`): "Main business gallery" moved out of the right column into a full-width card under both columns.
    - The banner is 16:9 with the photos beside it (2-up on wide screens), stacked on phones.
    - Measured at 1600px: left column ends at 1396px, right at 1413px. Before, the gallery made the right column about 500px longer.
  - **Edit** (`/pro/dashboard/profile`, `profile-view.tsx`):
    - Every step (Account · Business · Profile · Hours · Services · Sub-services · Portfolio) is a button (`nav[aria-label="Profile steps"]`, `aria-current="step"`, hover state) that jumps straight to that step. Edits stay on the page across steps, and Update / Submit still validate the required fields (names, company name, 3–7 gallery photos).
    - **Update** and **Next / Submit** moved to the page header (top-right), next to a "Cancel" link back to the profile (the header used to have a "Back" link only).
    - The bottom bar keeps only Back (previous step), bottom-left.
  - **Checked live** (`provider@gmail.com`):
    - the Hours and Services tabs opened directly (`?step=hours`, `?step=categories`);
    - on Portfolio the header shows Cancel / Update / Submit at the top-right, with no overlap with the Co-pilot pill;
    - 375px: no horizontal scroll;
    - type check and lint clean.
  - **Files:**
    - `components/portal/views/business-profile-detail-view.tsx`
    - `components/portal/views/profile-view.tsx`
- **Customer AI assistant (Home Service Helper): Maximize now fills 90% of the screen.**
  - **What:** `.bot-panel[data-expanded="true"]` is now 90vw × 90dvh, centred. It was min(64rem, 100vw - 4rem) × min(52rem, 100dvh - 4rem).
  - **Why:** to match the Pro Co-pilot's Expand.
  - **Unchanged:** the docked panel and the full-screen phone layout.
  - **File:** `app/globals.css`.
- **Pro Co-pilot: sectioned draft estimate card + expand to 90% of the screen**
  - **Why:** client feedback. The `DRAFT ESTIMATE` card showed every line in one flat "Line items" list, and Expand opened a small window (min(64rem, 100vw - 4rem), under 40% of a wide screen).
  - **Sections on the card** (`estimate-draft-card.tsx`): lines are grouped by work / trade section the same way as the builder (`line-sections.ts`: first-seen order, "" = General). Each section has:
    - a header with name, item count, subtotal, rename (pencil) and remove (hidden when it is the only section);
    - its labor and material lines together;
    - "+ Add item" (labor) and "+ Material";
    - a section subtotal.
  - **"Add section"** (dashed input + button) adds a section, and duplicate names are blocked. The footer shows the estimate total across sections.
  - **Create** sends each line's `section`, section by section, so the estimate opens in the builder with the same sections. Lines keep a local key for stable rows.
  - **Wide layout:** the card is a size container. When it is wide (`@2xl`, the expanded co-pilot), each line is one table row: Description · Type · Qty + unit · Rate · Total · remove, with column labels. In the normal panel and on phones it keeps the two-row layout. The rate input is narrower on small cards so totals fit at 375px.
  - **Type pills:** Labor is sky, Material is amber.
  - **Expand** (`pro-assistant.css`): the panel is now 90vw × 90dvh, centred (desktop ≥640px only). The message column widens to max-w-7xl (was max-w-3xl), and site photos in the chat are larger when expanded. The normal floating panel and the full-screen phone layout are unchanged.
  - **Type:** `PaDraftItem.section`.
  - **Checked:**
    - type check and lint clean;
    - live as `provider@gmail.com`: the expanded panel measured 1440 × 810 on a 1600 × 900 viewport (90% / 90%), and the bathroom remodel showed separate Shower and Flooring sections with Plumbing / Electrical / Demolition;
    - Create opened the sectioned estimate in the builder;
    - at 375px: no horizontal scroll and no clipped totals (17 rows checked).
    - Backend side: see the backend log.
  - **Files:**
    - `components/pro-assistant/estimate-draft-card.tsx`
    - `components/pro-assistant/pro-assistant.tsx`
    - `components/pro-assistant/pro-assistant.css`
    - `components/pro-assistant/pro-assistant-api.ts`

### 2026-11-23
- **Pro Co-pilot: one-tap scope / tier chips, customer pills, customer kept across edits**
  - **One-tap chips:** new `revise` quick-reply kind (`PaQuickReply.value` = the instruction, plus icon) for "+ Haul-away & disposal", "+ Subfloor / Permit allowance", "Budget option" and "Premium option" under a priced draft. A tap sends `visionAction: { kind: "revise", value }`, and the chip label shows as the Pro's message.
  - **Customer pills:** when the customer named in a voice note / message matches several customers, the draft card shows them as one-tap pills under Customer ("Matching customers"); a tap links the customer and property.
  - **Customer kept across edits:** the customer picked on a draft card is kept when the draft is changed in chat. Previously each updated card started empty. This uses `initialCustomer` / `onCustomerChange` on `EstimateDraftCard`, keyed by draft title in `pro-assistant.tsx`.
  - **Type:** `PaVisionAction` gains `revise` / `set_customer`.
  - **Checked:** type check and lint clean, and verified live as part of the backend stress test (see the backend log).
  - **Files:**
    - `components/pro-assistant/pro-assistant.tsx`
    - `components/pro-assistant/estimate-draft-card.tsx`
    - `components/pro-assistant/site-scope-card.tsx`
    - `components/pro-assistant/pro-assistant-api.ts`
- **Pro Co-pilot: new photos from the input box start a fresh job**
  - Backend fix (see the backend log): only the "Upload 2–3 more photos" / "Add more photos" chip adds photos to the current job. A declined service (e.g. roofing) no longer absorbs the next photo.
  - No UI change needed: the chip already sends `more_photos`; plain uploads send none.
  - Verified live: roof → declined → bathroom photo = new Bathroom job, 1 photo.
- **Pro Co-pilot Vision Estimator: live-test fixes (UI)** — the backend fixes and the full test list are in the backend log.
  - **Superseded drafts:** when a draft is changed in chat, older uncreated drafts with the same title collapse to "Earlier version of '…' — replaced by the updated draft below", so the same job can't be created twice.
  - **Phone (375 px) checked:** thumbnails, scope card, chips, inline dimension input and the itemized card. No overflow or clipped text.
    - Tap targets enlarged on phones only (`max-sm:`): scope and suggestion chips `min-h-9`, inline dimension input / Use `h-10`, "Remove line" `size-9`, "Add line" `min-h-9`. Desktop unchanged.
  - **Small fix:** photo thumbnails use `size-18` (was `size-[4.5rem]`).
  - **Checked:** type check and lint clean.
  - **Files:**
    - `components/pro-assistant/pro-assistant.tsx`
    - `components/pro-assistant/site-scope-card.tsx`
    - `components/pro-assistant/estimate-draft-card.tsx`
- **Pro Co-pilot: priced site-photo estimates (Vision Estimator, Phases 2 + 3)**
  - **Card note:** the estimate draft card shows how the AI priced it, under the title (pin icon), e.g. "Priced for Austin, TX market rates • calibrated to your last 15 estimates • Based on 10 × 12 ft · 120 sq ft · edit anything below".
  - **Unchanged:** lines, quantities and rates stay editable, and "Create estimate" works as before.
  - **Type:** `PaEstimateDraft.pricing`.
  - **Pricing:** done on the backend (see the backend log).
  - **Files:**
    - `components/pro-assistant/estimate-draft-card.tsx`
    - `components/pro-assistant/pro-assistant-api.ts`
- **Pro Co-pilot: site photos + AI scope chips (AI Vision Estimator, Phase 1)**
  - **Input bar:**
    - An attach button, plus paste and drag & drop (drop overlay), up to 6 JPG / PNG / WebP photos of 15 MB or less.
    - Each photo uploads immediately through the existing `uploadFile` → `/upload-image`. Thumbnails show a spinner, an error and an × button.
    - Send waits for uploads; photos-only messages are allowed. The placeholder changes when photos are attached.
  - **Chat:** photos appear in the user's bubble (a grid, or one larger image) and open full-size on click.
  - **`SiteScopeCard`:** trade · area, photo count, summary, finding pills, likely scope (once ready), and dimensions with their source (AI approximate / Your dimensions) and a confidence badge plus the visual cues used.
  - **`QuickReplies` chips:**
    - Confirm, Draft, Use AI dimensions → `visionAction`.
    - Enter dimensions → inline "12x14 ft" input.
    - Upload more → opens the picker and shows a hint; those photos are sent as `more_photos`.
    - "No, it's something else" → prefills "It's a ".
  - **Plumbing:** the socket and REST send `images` and `visionAction` (75s timeout for photo turns). New types: `PaQuickReply`, `PaVisionAction`, `PaSiteScope`, `PaSendExtras`.
  - **Checked:** type check and lint clean.
  - **Files:**
    - `components/pro-assistant/pro-assistant-input.tsx`
    - `components/pro-assistant/pro-assistant.tsx`
    - `components/pro-assistant/site-scope-card.tsx` (new)
    - `components/pro-assistant/pro-assistant-api.ts`
    - `components/pro-assistant/use-pro-assistant-socket.ts`
- **AI designer: placeholders on the contact fields**
  - Name "e.g. Jane Smith", ZIP "e.g. 80202", Email "you@example.com", Phone "(555) 123-4567". They show only while a field is empty; logged-in users still get their own details prefilled.
  - UI only; validation and payload unchanged.
  - Files: `components/ai-redesigner/redesigner-steps.tsx`.
- **AI designer: lighter status polling + no duplicate generations**
  - **Polling, as found:** one chained `setTimeout` loop per run id (3s, no overlap), cleaned up on unmount or new run, and stopped on done / failed / 6 min. There were no duplicate loops; the ~22 GETs per run are expected for a ~60–70s run, and the 304s are ETag "not modified" replies.
  - **Polling, changed:**
    - The first check waits 10s (`FIRST_POLL_MS`).
    - Checks pause while the tab is hidden and resume immediately when it is visible again.
    - `finish()` marks the run cancelled, so nothing can schedule another check after done / failed.
  - **Duplicate runs:** a snapshot `designKey` covers photo URL, room, style, the four finishes (style + colour) and notes. Contact details and consent are left out because they don't change the image.
    - It is stored per run id at start and becomes `generatedKey` when that run finishes `done`; a failed run still allows a retry.
    - While the inputs match, step 4's button is disabled and shows "Design generated" with a check icon and a hint, and `create()` refuses as well.
    - Any change re-enables it as "Design a new version" (previously "Design my kitchen again", even with nothing changed).
  - **Files:** `components/ai-redesigner/redesigner-wizard.tsx`.
- **Fix: "Session expired, please login again" on Design my kitchen while logged in**
  - **Cause:** `startRedesign` (`POST ai-redesigner/generations`, the only login-only call on the page) passed `skipLogoutOn401: true`. In `unwrapWithRefresh` that flag also skips the refresh-token retry, so an expired access token failed straight away with the backend's TokenExpiredError 401. The header still showed the user as logged in from saved auth, and the page's public calls (categories, FAQs, catalog) kept working because they send no token.
  - **Fix:** the flag is removed, so an expired token is refreshed and the request retried like every portal call.
  - **If the refresh also fails:** the wizard saves the draft and shows the normal login prompt instead of the raw error.
  - **Unchanged:** backend and guest flow.
  - **Files:** `lib/api/ai-redesigner-client.ts`, `components/ai-redesigner/redesigner-wizard.tsx`.
- **Kitchen & Bath Design: full multi-section page at `/kitchen-bath-design`**
  - **Route:** the page moved from `/ai-kitchen-redesign` to `/kitchen-bath-design`, which matches the navbar label.
    - `/ai-kitchen-redesign` and `/ai-kitchen-bath-designer` both `permanentRedirect` (308) to it.
    - `AI_DESIGNER_PATH`, the navbar href and the sitemap are updated.
  - **Sections, top to bottom:**
    1. **Hero:** the SEO `<h1>` "AI Kitchen & Bathroom Design Tool" and a two-line value line.
       - "Try It Now" smooth-scrolls to `#demo` (it is a plain link without JavaScript, and respects reduced motion). "Get a free quote" sits beside it, with trust points under both.
       - The `BeforeAfterSlider` shows the admin's showcase pair (`catalog.section.showcase`), or a local still photo if there is no pair.
    2. **`#demo`:** the live designer in `max-w-6xl`.
    3. **How it works:** 3 steps.
    4. **Styles showcase** ("A real design studio. Not a filter."):
       - The admin's styles per room, with a Kitchen / Bathroom toggle and up to 8 cards each, showing photo, swatches and description.
       - Styles without a photo use a gradient of their own swatches.
       - Clicking a card sends `rs-ai-designer:pick-style`. The designer then selects that room and style with its default finishes, goes to the Style step if a photo is uploaded (otherwise it stays on Photo with a toast "Upload a photo… to continue"), and scrolls to `#demo`.
    5. **Quote bridge:** a navy `#0B3B70` banner, "Love your new design? Get real quotes from verified local kitchen & bath contractors", linking to `/get-a-quote`.
    6. **FAQ:** the admin-managed FAQ, unchanged.
  - **Server rendering:** the catalog is fetched on the server (`lib/data/public-ai-redesigner.ts`, revalidates every 5 min), so the slider and styles are in the HTML.
  - **Designer:** no more inner scrollbars. The fixed desktop height and the two panel `overflow-y-auto`s are removed, so the card grows with its content, and the photo stage is a 4:3 frame.
  - **Checked:**
    - Redirects return 308, there is one h1, and the designer has 0 inner scroll areas.
    - A style click selects the style and scrolls.
    - Screenshots at 1440 / 390.
    - Type check and lint clean.
  - **Files:**
    - `app/(marketing)/kitchen-bath-design/page.tsx` (new)
    - `app/(marketing)/ai-kitchen-redesign/page.tsx` (now a redirect)
    - `components/ai-redesigner/kitchen-bath-sections.tsx` (new)
    - `components/ai-redesigner/designer-events.ts` (new)
    - `components/ai-redesigner/redesigner-wizard.tsx`
    - `lib/data/public-ai-redesigner.ts` (new)
    - `lib/api/ai-redesigner-client.ts`
    - `lib/data/navigation.ts`
    - `lib/sitemap-entries.ts`
- **Kitchen & Bath Design page: the live AI designer is back, no login wall**
  - **Page:** `/ai-kitchen-redesign` keeps its URL and is rebuilt. It has:
    - a breadcrumb "Home / Kitchen & Bath Design";
    - a centered SEO `<h1>` "AI Kitchen & Bathroom Design Tool" with a two-line intro;
    - the interactive `RedesignerWizard` (`showHeader={false}`, new prop that hides the wizard's own logo / h1) inside a centered `max-w-6xl px-4` container;
    - an admin-managed FAQ.
  - **Metadata:** title "AI Kitchen & Bathroom Design Tool".
  - **What it replaced:** the info page (photo hero, benefits, styles, rooms, static FAQ, closing CTA) that pushed visitors to log in first.
  - **Old URL:** `/ai-kitchen-bath-designer` now `permanentRedirect`s (308) here. `AI_DESIGNER_PATH` is now `/ai-kitchen-redesign`, so login "next" links and the home section point here.
  - **Renames:** navbar label "AI Kitchen Redesign" → "Kitchen & Bath Design". The page was added to the sitemap.
  - **No login wall:** guests can upload a photo (`/upload-image` is public), switch Kitchen / Bathroom, and pick a style and finishes.
    - Only "Design my kitchen" asks for an account, because `POST /ai-redesigner/generations` requires a login and has a 5-per-day quota (backend unchanged).
    - Before the login prompt, the guest's room, style, finishes, notes, photo URL and step are saved to sessionStorage (`rs-ai-designer:draft:v1`) and restored when they come back.
    - The toast now reads "Log in or create a free account to generate your design" and returns to the page they were on.
    - A small note under the button tells guests an account is needed only to generate.
  - **Before / after:** the `BeforeAfterSlider` is restored for finished designs; it had been commented out earlier on client feedback.
  - **FAQ:**
    - Loaded on the server from the existing `GET public/faqs?audience=customer&domain=kitchen-bath-design` (`lib/data/public-faqs.ts`, revalidates every 5 min), and also emitted as FAQPage JSON-LD.
    - Admins manage these FAQs in Admin → FAQs with Domain / Category `kitchen-bath-design` and audience Customer; Sort order sets the order.
    - Until any exist, five built-in display-only answers are shown. No DB writes or seeds.
  - **Checked:** at 1440 / 390 px; type check and lint clean.
  - **Files:**
    - `app/(marketing)/ai-kitchen-redesign/page.tsx`
    - `app/(marketing)/ai-kitchen-bath-designer/page.tsx`
    - `components/ai-redesigner/redesigner-wizard.tsx`
    - `components/ai-redesigner/login-guard.ts`
    - `components/ai-redesigner/redesign-start-cta.tsx` (comment only, now unused)
    - `lib/api/ai-redesigner-client.ts`
    - `lib/data/public-faqs.ts` (new)
    - `lib/data/navigation.ts`
    - `lib/sitemap-entries.ts`
- **Pro Co-pilot bubble no longer moves by itself** — removed the "smart collision" lift, which slid the pill up to 280px whenever a button or card was under it, so it ended up floating mid-screen over the Invoices / Paid column. It now sits fixed 24px from the bottom-right corner (`bottom-6 right-6`, z-40). Still kept: the Pro can drag it up or down (the spot is saved in localStorage), it fades while a dialog or sheet is open, and it is clamped on screen when the window resizes. The per-scroll re-check is gone too. Files: `components/pro-assistant/pro-assistant-bubble.tsx`.
- **Pipeline board readability** — UI only; drag and drop, move menu, search, "See more" and the booking dialog are unchanged.
  - Columns: each is its own soft surface (`bg-slate-50/80`, `dark:bg-white/3`, rounded, `p-3`). Gap is 4 and columns are 300px wide; on 2xl they sit in a `minmax(290px,1fr)` grid and scroll sideways instead of squishing.
  - Column headers: title, count pill and value sit on one row, and the description is clamped to two lines (`min-h-[2lh]`) so all five headers line up. The "Total: / Value:" row is gone.
  - Sub-stages (New leads, Never sent, Booked…): plain sections with an uppercase label and hairline, value plus a count badge; no longer boxed.
  - Cards:
    - `p-3.5`, `space-y-2.5`, `rounded-lg`.
    - The title is the prominent line (13.5px semibold). The number is muted metadata, or prominent when there is no title.
    - The category is a small tag, the amount is bold, and customer, address and date are muted xs.
    - The blocker hint is a compact amber pill.
  - Empty states: shorter (`py-1.5`).
  - Theme tokens instead of raw slate text colours, so dark mode keeps working.
  - Files: `components/portal/pipeline/pipeline-board.tsx`.
- **Pro Co-pilot: estimate starter chips from the Pro's categories** — the hard-coded "Create an estimate for a bathroom leak" chip is replaced by one "Create an estimate for {Category}" chip per category in the Pro profile (`authProvider.services.categoryIds` → `getServiceCategoryById`, de-duplicated; the same source the estimate draft card uses). With up to 4 categories, all show. With 5 or more, the first 3 show plus a dashed "+N more" / "Show less" pill, so the welcome area doesn't push the input off-screen. With no categories (or while the profile is loading) there is one "Create a new estimate" chip. The operational chips ("How's business today?", "Show overdue invoices", "Who should take my next job?") are unchanged. Clicking a chip sends its exact text through `ask()`, like the other chips. The chips are built at render time for the welcome message, so a welcome already saved in sessionStorage picks them up. No API changes. Files: `components/pro-assistant/pro-assistant.tsx`.

### 2026-11-20
- **Hero: more of the house visible (desktop)** — the full-width hero is a little taller on desktop (`lg:h-[26rem] xl:h-[28rem]`, was 22 / 24rem) and centred (`lg:object-[50%_50%]`), so about 45% of the photo's height shows instead of ~37%: both roof peaks, the dormer and the full porch, with no stretching or upscaling. A split layout (photo on the right ~62% fading into a navy block) was tried and rejected by the client — back to the full-width photo with the same navy scrim. Phones / tablets unchanged. Checked at 1440 / 1024 px. Files: `components/home/hero-section.tsx`.
- **Table toolbar on phones: search and Export on one line** — `PortalDataTable`: without a filter, the search box and Export share the first line (Export on the right, top-aligned with the search; was Export alone on its own row); with a filter, search stays on top and filter + Export share the next line. sm+ unchanged. Checked at 390 / 1280 px on a temporary page (deleted). Files: `components/portal/portal-data-table.tsx`.
- **Customer landing hero: natural home photo (local asset)** — new `public/images/home/hero-banner.jpg` (3200×2133 daylight photo of a shingle-style family home with porch and lawn; Unsplash photo 1570129477492, Unsplash License — downloaded once, served locally, no hotlink) and `HERO_BANNER_IMAGE` in `lib/site.ts`, used only by `components/home/hero-section.tsx` (`HERO_HOME_IMAGE` stays the fallback for categories / provider media / auth / seed chats). Framing `object-[55%_60%] lg:object-[50%_58%]` (roof to porch), quality 80 (Next serves sized AVIF/WebP). The photo is brighter than the old one, so the navy scrim is a touch stronger for white-text contrast: phones 0.55 → 0.66 flat; desktop gradient carries further (0.88 → 0.74 @30% → 0.46 @54% → 0.14 @74%). Checked at 1440 / 820 / 390 px. No search / location / API changes. Files: `public/images/home/hero-banner.jpg` (new), `lib/site.ts`, `components/home/hero-section.tsx`.
- **Refresh buttons removed (all screen sizes)** — the browser reload covers it and these lists update live: Pro Fixed service orders header "Refresh", Pro Messages "↻" next to the conversation count and the empty-state "Refresh messages" button ("View incoming leads" stays), AI call history "Refresh" (the pipeline's was already removed). Kept on purpose: error "Try again" (plans), failed-message "Retry" (chat), AI designer "New photo". Leftover handler / icon imports removed. Files: `components/portal/views/{orders-view,messages-view}.tsx`, `components/ai-calling/ai-call-history.tsx`.
- **Estimate tab strip: swiped tabs no longer touch the card border** — the strip's side space was padding inside the scroll box, so it scrolled away and tabs ran into the card edge; it's now margin (`mx-3.5`, was `px-3.5`), so the visible area stays inset. Files: `components/portal/estimate-v2/project-lifecycle-nav.tsx`.
- **Smaller type on phones in all dashboards + "More actions" label**. Below 640 px on portal pages (`:root:has(.portal-app)` — customer, Pro, technician, contractor, incl. dialogs / sheets / menus) Tailwind's type variables are one step smaller: xs 12→11, sm 14→13, lg 18→17, xl 20→18, 2xl 24→21, 3xl 30→24 px. `--text-base` stays 16 px (inputs on phones; iOS zooms into fields under 16 px). Verified with computed styles at 390 / 1280 px on a temporary page (deleted): phone smaller, desktop unchanged, inputs 16 px; the public site is unaffected. The estimate's "⋯ More" button is now "More actions ⌄" like every other menu. Estimate tab strip: dropped the extra baseline and added bottom spacing so the active underline no longer sits on the card's edge. Files: `app/globals.css`, `components/portal/estimate-v2/{new-estimate-workspace-view,project-lifecycle-nav}.tsx`.
- **Table toolbar, dropdowns, estimate tabs, crew card (phones)**. (1) `PortalDataTable` toolbar: on phones the filter dropdown stretches on the left and **Export is always on the right** (was both on the left); sm+ unchanged. (2) Dropdowns match the outline buttons: `SelectTrigger` gets `bg-background` (was transparent) and the faint `border-border-soft` override is removed from 15 select triggers (jobs / invoices / estimates status filters, technician + contractor job filters, calendar, customer detail, tasks …) so they use the normal `border-input` like Export. (3) Estimate workspace section strip (Summary / Parts & Labour / Preview / Photos & files …) on phones / tablets uses the portal's underline tabs (was rounded pills); desktop side menu unchanged. (4) Job "Assigned technician" card: Chat / Change / Remove are equal-width on phones, Remove is an outline destructive button (was ghost), and when the crew is locked (technician checked in / job closed) the reason shows as text with a lock icon on phones (tooltips don't work on touch). Files: `components/portal/portal-data-table.tsx`, `components/ui/select.tsx`, `components/portal/estimate-v2/project-lifecycle-nav.tsx`, `components/portal/views/record-detail-views.tsx`, plus the 15 triggers in `components/{portal,technician,contractor}/…`.
- **Estimate action bar → "More" menu on phones**. The estimate workspace's in-card bar (Save draft / Preview & send / Notes & updates / More, and Build estimate / Create invoice … by status) uses `MobileActionsMenu`: on phones only "More" shows and its menu lists those buttons first (`MoreActionsMenuContent`); tablet/desktop unchanged. Audit of every portal for 3+ button rows (scratch script): every other "More" dropdown is already converted; page-header actions (customer invoice / payment / order, new estimate, Pro / crew detail pages) collapse via `PortalPage` / `RecordWorkspace`; left as-is on purpose: status-driven pairs (order quick-view sheet shows 2 at a time), time-clock controls, share-link controls, estimate Accept / Decline, editor / calendar toolbars, dialog footers. Files: `components/portal/estimate-v2/new-estimate-workspace-view.tsx`.
- **Chat ticks: sent / delivered / seen (all portals)**. Customer, Pro, technician and contractor chats show ✓ grey = sent (recipient's app not connected), ✓✓ grey = delivered to their app, ✓✓ blue = seen (was: a single ✓ until read). Uses the API's new `deliveredAt`; live updates via `CHAT_THREAD_UPDATED` (customer ↔ Pro) and the new `techchat:delivered` socket event (tech chats). Thread merges (`use-chat-threads` mergeThreads, customer `upsertThread`) now refresh receipts on messages already on screen via `withLatestReceipts` (they only appended new messages, so ✓✓ / seen updates to existing messages were dropped). Seen colour: sky blue (customer / Pro bubbles), sky-300 on the technician / contractor accent bubbles. Files: `components/shared/chat-panel.tsx`, `components/tech-chat/tech-chat-conversation.tsx`, `lib/booking/chat-store.ts`, `lib/api/{crm-mappers,technician-chat-client}.ts`, `components/socket/socket-api.ts`, `components/portal/use-chat-threads.ts`, `components/account/customer-messages-view.tsx`.
- **Chat screen redesign (phones)**. Tech / contractor conversation header is one app-style row: back-arrow icon (phones) · profile photo (new `technicianAvatar` / `providerAvatar` from the API; blue initials circle when none) · name + badge with the record (job / estimate / pay icon + label, or "typing…") · compact "Open" link to the record. Replaces the name bar + separate "About pay" context bar + "All conversations" bar (embedded `showHeader={false}` use keeps the context bar). Pill-shaped composer with safe-area bottom padding. Pro Messages: the "Customers & leads / Technicians & contractors" switch is hidden on phones while a conversation is open (technician chats via `?thread=`, customer chats via a new `onChatOpenChange` callback from `CustomerMessages`), and comes back on the list. Files: `components/tech-chat/tech-chat-conversation.tsx`, `components/portal/views/messages-view.tsx`, `lib/api/technician-chat-client.ts`.
- **Technician / contractor chat: instant send + mobile polish**. Sending a message (POST `/{provider|technician}/tech-chats/:id/messages`) used to wait for the API before showing anything (draft kept, send button spinning). Now it's optimistic: the bubble shows immediately with a clock icon and the box clears, so messages can go out back-to-back; the API result (or its socket echo, whichever comes first) swaps in the saved message with the ✓ / ✓✓ ticks, without duplicates. A failed send becomes a red bubble ("Not sent · Tap to retry"). Phones: the back arrow sits in the conversation's name row (was a separate "All conversations" bar), bubbles use 85% width, round send button, and the floating Pro AI launcher is hidden on the Messages / team-chat pages so it no longer covers the send button and quick replies (it stays on other pages, and on tablet/desktop). The customer chat (`ChatPanel`) was already optimistic. Files: `components/tech-chat/{tech-chat-conversation,tech-chat-inbox}.tsx`, `components/pro-assistant/pro-assistant-launcher.tsx`.
- **Header "Close" button removed (all screen sizes)**. The record-header "Close" link (back to the list) is gone from the lead, customer and task detail pages; the back arrow / sidebar already do that. Dialog Close / Cancel buttons are untouched. Files: `components/portal/views/{request-detail-view,customer-detail-view,tasks-view}.tsx`.
- **Phone header menu: one list, no Close**. Follow-up to the ⋮ menu: if a header has a "More actions" dropdown, phones now show only that button and its menu lists the header's other buttons first (e.g. View estimate, Chat — then a divider — Schedule visit, Create task …); no separate ⋮ / stacked-button card. Headers without a dropdown keep ⋮, which now opens a plain menu list (not stacked buttons). "Close" is hidden on phones (back arrow / menu instead); tablet/desktop keep it. Menu items click the real hidden buttons, so links, dialogs and disabled states are unchanged. New `MoreActionsMenuContent` (drop-in for `DropdownMenuContent`) used by the More actions menus on customer, employee, contractor, vendor / partner, record (job / estimate / invoice …), lead and task detail pages; phone styles in `globals.css` (`[data-mobile-actions]`). Verified at 390 / 1280 px on a temporary test page (deleted). Files: `components/portal/mobile-actions-menu.tsx`, `app/globals.css`, `components/portal/views/{contractor-detail-view,customer-detail-view,employee-detail-view,partner-detail-views,record-detail-views,request-detail-view,tasks-view}.tsx`.
- **Page-header actions → "⋮" menu on phones (all dashboards)**. New `MobileActionsMenu`: below 640 px, when a header has 2+ actions they collapse into a ⋮ button that opens a card with every action stacked full-width (e.g. Open calendar / Location history / Timesheets / More actions). One action (e.g. "+ Create employee") stays as a button; tablet/desktop unchanged. Actions render once and are only hidden with CSS, so the dialogs / dropdowns they own keep working; picking an action closes the menu, a dropdown trigger ("More actions") keeps it open so its menu stays anchored; outside tap / Esc closes. Used by `RecordWorkspace` (every Pro detail page — title left, ⋮ right) and `PortalPage` (⋮ pinned to the header card corner; customer, technician and contractor pages too). Verified at 390 / 1280 px on a temporary test page (deleted): ⋮ opens, More actions dropdown opens inside, Open calendar opens its dialog and closes the menu, single CTA stays, desktop row unchanged, no overflow. Replaces the "share each row evenly" header layout from the entry below. Files: `components/portal/mobile-actions-menu.tsx` (new), `components/portal/record-workspace.tsx`, `components/portal/portal-page.tsx`.
- **Pro portal on phones: buttons + tabs (UI only, < 640 px; tablet/desktop unchanged)**. (1) `RecordWorkspace` (customer / employee / contractor / vendor / job / estimate / invoice / … detail pages): header actions (Close / Save / More actions, Open calendar / Timesheets …) are left-aligned and share each row evenly (`max-sm:*:flex-auto`) instead of ragged right-aligned rows; the record tabs (Profile, Estimates, Jobs …) are one swipeable row that keeps the active tab in view (baseline is an inset shadow so the active tab still sits on it) instead of 3–4 wrapped rows. (2) `ModuleSubnav` (People: Customers … Reminders; Work: Leads … Schedules) is one swipeable row that scrolls the current section into view. (3) `LocalFilterTabs` and the `PortalDataTable` A–Z letter row swipe instead of wrapping / running off-screen. (4) Same action-row treatment on the estimate workspace action bar, "Write estimate for this request" and the order detail header. (Dashboard drawer width fix is in the entry below.) Files: `components/portal/{record-workspace,people-subnav,local-filter-tabs,portal-data-table}.tsx`, `components/portal/estimate-v2/new-estimate-workspace-view.tsx`, `components/portal/views/{new-estimate-view,order-detail-page-view}.tsx`.
- **Footer: download buttons + bottom space (tablet)**. Below desktop the App Store / Google Play buttons stretched across the whole footer (`flex-1`); from sm they're a fixed 240 px column beside the QR (phones still fill the space next to the QR; desktop unchanged). The extra bottom padding under the © / legal row is now phones only (`pb-20 sm:pb-5`) — tablets had a big empty band. Checked 390 / 640 / 768 / 864 / 940 / 1000 / 1024 / 1280 / 1440 px: no overflow. Files: `components/layout/site-footer.tsx`.
- **Drawer widths + mobile-menu Dashboard button**. Every dashboard's mobile/tablet sidebar drawer (customer, Pro, technician, contractor) and the site / Pro header menus were 75% of the screen: the shared `Sheet` sets `data-[side=left|right]:w-3/4`, which out-ranks the plain `w-72` / `w-80` the shells passed. Each now sets the width on the same variant (`data-[side=left]:w-72`, `data-[side=right]:w-80`, max 85vw) — 288 px dashboard drawers, 320 px header menus (verified 320 px at 390 and 864 px). The site menu's customer "Dashboard" button had its label pushed left (`justify-between`); it's centred like Messages / Settings with the count badge pinned to the right edge. UI only. Files: `components/account/customer-shell.tsx`, `components/portal/portal-shell.tsx`, `components/contractor/contractor-shell.tsx`, `components/technician/technician-shell.tsx`, `components/pro/pro-header.tsx`, `components/layout/site-header.tsx`.
- **Customer mobile polish (UI / CSS only)**. Audited at 390 px via headless Chrome (no horizontal overflow on home, services, get-a-quote, find-a-professional, how-it-works, login). Fixes: (1) `container-site` is a 20 px gutter below 640 px (was 80% width → ~39 px dead space per side on phones; tablet/desktop unchanged). (2) Home hero is content-sized on phones (`min-h-72` + top padding) — the eyebrow/headline no longer clip under the header. (3) Customer dashboard feature tabs (Overview … Support) are one swipeable row on phones that keeps the active tab in view (was 4 ragged centred rows); sm+ unchanged. (4) RS AI Assistant launcher is just the round RS badge on phones (label from sm up) so it stops covering cards/text. (5) `PortalDataTable`: the Options column is pinned right on phones while the table scrolls sideways. (6) `PortalPage` header card / gaps tighter on phones. (7) Customer dashboard hero stats: 2-column on phones (Balance due full-width). (8) Customer invoice / payment / quote-request / change-order detail KPI tiles: 2×2 on phones with smaller values (was 4–5 full-width stacked cards). (9b) Tablets (640–1023 px): `container-site` uses a 32 px gutter (was 80% → ~86 px dead space per side at 864 px); desktop 1024+ keeps 80%. Swept home, services, how-it-works, find-a-professional, get-a-quote, contact, request-service, about at 864 px — no overflow. (9) Site footer bottom row has extra bottom padding on phones and tablets (desktop unchanged) so the floating RS button no longer covers Privacy / Terms / Sitemap. Second sweep (no overflow): about, contact, faq, services (plumbing), locations, city page, blog, request-service, register, privacy, ai-kitchen-redesign. No logic, API, data or state changes. Files: `app/globals.css`, `components/layout/site-footer.tsx`, `components/home/{hero-section,customer-feature-tabs}.tsx`, `components/bot-ai/BotWidget.tsx`, `components/portal/{portal-data-table,portal-page}.tsx`, `components/account/{customer-dashboard-advanced,customer-dashboard-widgets,customer-payment-detail-dashboard-view,customer-invoice-detail-dashboard-view,customer-quote-request-detail-view,customer-change-order-detail-view}.tsx`.
- **App icon matches native macOS apps (rounded)**. The installed app showed a flat square "RS" tile in the Dock (macOS doesn't round web-app icons). `app/icon.tsx` now draws a macOS-style icon: brand-navy rounded square on Apple's icon grid (412/512 body, ~22% radius, transparent margin), soft gradient + drop shadow. New `app/apple-icon.tsx` (180 px full-bleed — iOS rounds it) and `app/maskable-icon/route.tsx` (512 px full-bleed for Android launchers); `manifest.ts` lists `/icon` (purpose any) + `/maskable-icon` (purpose maskable). Installed apps pick up the new icon after reinstalling (or when Chrome refreshes the manifest). Files: `app/icon.tsx`, `app/apple-icon.tsx` (new), `app/maskable-icon/route.tsx` (new), `app/manifest.ts`.
- **Payout detail pages + professional payout receipts (technician + contractor)**. Clicking a payment in technician **My payments** (`/technical/payments/[id]`) or contractor **Payouts** (`/contractor/payouts/[id]`) opens a detail page (shared `PayoutDetailView`): amount with paid date / method / reference and the PAID seal with the business name; "Paid for" (job / order / estimate link, status, pay rate); "Balance for this work" (earned · paid to you · pending + progress bar); "Time sessions" table (date, start, end, duration, pay + totals); every payment on that work; notes. **Print / PDF** prints a receipt with all of it — `PaymentReceiptDocument` gained optional `payRate`, `summary` (earned / paid to date / pending) and `sessions` (+ total). The technician list's receipts now use the real company name (was "The business"); rows have "View details". Files: `components/time-tracking/payout-detail.tsx` (new), `components/technician/views/technician-payment-detail-view.tsx` (new), `components/contractor/views/contractor-payout-detail-view.tsx` (new), `app/(technician)/technical/payments/[id]/page.tsx` (new), `app/(contractor)/contractor/payouts/[id]/page.tsx` (new), `components/print/payment-receipt.tsx`, `components/time-tracking/timesheet-ui.tsx`, `components/technician/views/technician-payments-view.tsx`, `components/contractor/views/contractor-payouts-view.tsx`, `lib/api/{technician-client,contractor-portal-client}.ts`, `lib/{technician-paths,contractor-paths}.ts`, `components/api/ApiRoutesFile.ts`.
- **Pay technicians / contractors for fixed service orders**. Ledger rows and payouts carry fixed service orders next to jobs / estimates: `RecordKind` adds `"order"`, `LedgerRow` / `TechnicianPaymentRecord` get `orderId` / `order`, `ledgerRowKey` includes the order, `ledgerRowRecord` picks job / order / estimate. "Pay technician" now names the order (was "for this estimate") and sends `orderId` (was refused: "A job or estimate is required"). Contractors: `ContractorPayRow` / payments get `kind` / `orderId` / `order`; the Pay dialog pays orders by `orderId`; the Pro contractor timesheet shows order rows; contractor Payouts links order rows / payments to `/contractor/orders/:id`. Order links in every time / pay table open the order (Pro `/pro/dashboard/orders/:id`, technician `/technical/orders/:id`). Orders count as jobs in the Jobs / Estimates filter. Files: `lib/api/{technician-client,contractor-portal-client}.ts`, `components/time-tracking/{timesheet-ui,time-tracking-panel}.tsx`, `components/portal/job-crew.tsx`, `components/contractor/views/contractor-payouts-view.tsx`, `components/portal/views/{timesheets-view,employee-detail-view,contractor-detail-view,record-detail-views}.tsx`, `components/technician/views/{technician-payments-view,technician-time-view,technician-estimates-view,technician-job-detail-view}.tsx`.
- **PAID seal: business name + brand navy**. `PaidStamp` takes `company`: the business name runs around the top of the seal ("THANK YOU" stays at the bottom; long names shrink to fit, 30+ chars are cut), on every screen and print — Pro invoice / payment, customer invoice / payment, printed invoice (`data.company.name`) and payment / payout receipts (`from.name`). Ink is the platform brand navy `#003F7D` (same as the invoice letterhead and print headers; was red) with a lighter worn texture so small text stays readable. `InvoiceSummaryTab` got an optional `companyName` prop. Files: `components/print/{paid-stamp,payment-receipt}.tsx`, `components/invoice/invoice-print-document.tsx`, `components/portal/invoice-file.tsx`, `components/portal/views/record-detail-views.tsx`, `components/account/{customer-invoice-detail-dashboard-view,customer-payment-detail-dashboard-view}.tsx`.
- **PAID stamp redesigned + moved off the corners**. `PaidStamp` is now an SVG seal like the client's reference: red serrated edge, double ring, "THANK YOU" around the top and bottom, side dots, a big "PAID" band across the middle (paid date under it when known), worn-ink texture; prints in colour (was a plain green rotated box). Placement: Pro invoice — beside the totals in Labour & Material (was absolute top-right over "Balance due"); Pro payment — in the Payment summary header between the title and the Amount box (was over the Amount box); printed receipt — next to the amount (was over the letterhead line). Customer invoice / payment and the printed invoice keep their spots. Files: `components/print/{paid-stamp,payment-receipt}.tsx`, `components/portal/{invoice-file,payment-file}.tsx`, `components/portal/views/record-detail-views.tsx`.
- **PAID stamp + Print / PDF receipts (invoices, payments, payouts)**. New `PaidStamp` (rubber-stamp "PAID" + date, prints in colour) and `PaymentReceiptDocument` / `PrintReceiptButton` (receipt with letterhead, payer / payee, amount, status, method, date, reference, invoice, job; prints through the existing `PrintPortal` — "Save as PDF" in the print dialog downloads it, no new tab). Invoices: printed invoice (`InvoicePrintDocument`) shows PAID beside the totals when paid in full; on screen the customer invoice (beside the totals) and the Pro invoice (Summary tab) show it too — both already had Print / PDF. Payments: customer payment page and Pro payment page get **Print / PDF** + PAID stamp when succeeded (Pro: not while awaiting confirmation). Crew: technician "My payments" (and the Pro's employee payment history, same table) get a **Receipt (print / PDF)** row action; contractor payouts get a **Receipt** column — payout receipts with PAID. Files: `components/print/{paid-stamp,payment-receipt}.tsx` (new), `components/invoice/invoice-print-document.tsx`, `components/account/{customer-invoice-detail-dashboard-view,customer-payment-detail-dashboard-view}.tsx`, `components/portal/views/record-detail-views.tsx`, `components/time-tracking/timesheet-ui.tsx`, `components/contractor/views/contractor-payouts-view.tsx`.
- **Pro order Change Orders tab: table + detail page**. Change orders sent to the customer are now a table (CO-01… numbered like the customer sees them · status Awaiting approval / Approved / Declined · source Office / From crew request · sent · customer response · amount; search + export) — was one card per change order. A row opens the new page `/pro/dashboard/orders/[id]/change-orders/[changeOrderId]`: header with number, title, status and amount; order / customer / sent / customer response; line items with total; reason, customer note and the crew request it came from; photos. Read-only (the customer approves in their portal). Crew view of the tab unchanged. `ProviderChangeOrderItem` gained `customerNote`. Files: `components/portal/orders/order-change-orders-table.tsx` (new), `components/portal/views/order-change-order-detail-view.tsx` (new), `app/(portal)/pro/dashboard/orders/[id]/change-orders/[changeOrderId]/page.tsx` (new), `components/portal/views/order-detail-page-view.tsx`, `lib/types/provider-order.ts`, `store/providerOrdersSlice.ts`.
- **Customer order page: no duplicate-key warning on assigned crew**. "Assigned service personnel" keys fall back to `employee-<i>` / `contractor-<i>` when a row has no id (was `undefined` for every card → "Each child in a list should have a unique key"). The API now also sends names for fixed orders (backend log). Files: `components/account/customer-order-detail-view.tsx`.
- **Fixed orders: crew "Mark complete" uses the job's dialog**. Technician / contractor on an order now get the same "Mark as complete" dialog as on a job (proof photos required, optional "Notes for the office", "Submit for approval"; "Resubmit completed work" + the office's re-work note after a rejection) — was the Pro-style "Submit Work Completion" modal (notes required, before / after photo sections). `CompleteJobDialog` got an optional `submit` override (jobs don't pass it — unchanged); orders submit via new `crewCompleteOrder` (same `PUT …/orders/:id/complete`, still goes to the office for approval). The Pro keeps its own modal. Files: `components/contractor/complete-job-dialog.tsx`, `components/portal/views/order-detail-page-view.tsx`, `lib/api/order-crew-client.ts`.
- **Fixed orders: crew scope change works exactly like a job; customer change orders are separate** (supersedes "Send to customer" below). Requests tab → crew scope request → **Approve & add scope** with the job's labour / material / equipment line editor (internal, "not billed to the customer") or **Decline**; it never goes to the customer by itself. The crew sees the job's "Scope update · Accept updated scope" cards (no prices) on the order Summary and Change Orders tab. Pro ↔ customer is separate: Change Orders tab → **New change order for customer** (existing form), and an approved crew request can optionally be **Sent to customer as change order** from its dialog. Pro's Change Orders tab lists customer change orders only. Files: `components/portal/orders/order-requests-tab.tsx`, `components/portal/views/order-detail-page-view.tsx`, `lib/api/order-crew-client.ts`, `components/api/ApiRoutesFile.ts`, `lib/types/provider-order.ts`, `store/providerOrdersSlice.ts`.
- **Multiple employees and contractors; only the checked-in person is locked** (refines the entry below). Order header: **Assign → Add employee / Add contractor** (adds alongside, never blocked). Each employee row has **Change** (replace that person) + Remove; each contractor row has Replace + Remove — disabled only while that person is checked in ("X is checked in right now…"). Job page: header **Add contractor** (was Change contractor replacing everyone), **Change technician** locked only while the lead is clocked in, extra technicians / contractors locked per person. `useJobCrewOnClock` reloads only on this job's clock events. Files: `components/portal/orders/order-crew.tsx`, `components/portal/job-crew.tsx`, `components/portal/job-technician-crew.tsx`, `components/portal/views/record-detail-views.tsx`.
- **Assign / Change crew, locked while someone is clocked in (orders + jobs)**. Order header: "Assign employee / contractor" become "Change employee / contractor" once someone is assigned (Change replaces the current person); job header: "Assign contractor" → "Change contractor" the same way ("Change technician" already existed). While anyone is clocked in, the header buttons, the technician card's Change / Remove, extra technicians and contractor Remove are disabled with "X is checked in… change the crew after they check out"; after check-out they work again (was: anyone who had ever started could never be removed, and nothing was locked while working). Order page reloads on this order's `TIME_ENTRY_UPDATED`; jobs use `useJobCrewOnClock` (`GET provider/jobs/:id/crew-status`, live on `TIME_ENTRY_UPDATED`). The shared contractor dialog got `changing` labels and shows the API's real error text. Files: `components/portal/orders/order-crew.tsx`, `components/portal/job-crew.tsx`, `components/portal/views/{record-detail-views,order-detail-page-view}.tsx`, `lib/api/{contractor-portal-client,order-crew-client}.ts`, `lib/types/provider-order.ts`, `store/providerOrdersSlice.ts`, `components/api/ApiRoutesFile.ts`.
- **Fixed orders: "Request scope change" is the job's dialog**. Technician / contractor on an order now get the same dialog as on a job (Reason dropdown + Description, "No price needed — the office adds the items and cost"), was the priced "Propose In-App Change Order" form. The Pro sees it on the order's **Requests** tab ("Scope change", Pending provider review) and either **Send to customer** with an amount (+ wording) or **Declines** it with a note; the Change Orders tab shows "Awaiting office" / "Declined by office". Files: `components/portal/orders/order-requests-tab.tsx`, `components/portal/views/order-detail-page-view.tsx`, `lib/api/order-crew-client.ts`, `components/api/ApiRoutesFile.ts`, `lib/types/provider-order.ts`, `store/providerOrdersSlice.ts`.
- **Fixed service orders list no longer refetches in a loop** (bug). Opening `/pro/dashboard/orders?status=BOOKING_REQUESTED` fired "All" and "Requested" together; the late "All" response wrote `statusFilter = ""` back into Redux, the URL sync set it to Requested again, and the two lists kept refetching (count flipping 4 ↔ 14). Now a response for an older query only fills its cache page and leaves the current filter alone, and the list waits for the URL tab to sync before fetching. Files: `store/providerOrdersSlice.ts`, `components/portal/views/orders-view.tsx`.
- **Fixed orders show Invoiced / Paid like a job** (client). Status pills use the API's `displayStatus`: after the Pro sends the invoice the order shows **Invoiced**, once paid **Paid**, after the customer's sign-off **Settled** (was stuck on "Work completed"). Applied on the Pro orders list + order page and the customer orders list + order page (new `INVOICED` / `PAID` pill styles and labels). Pro list Quick Action for completed orders: **Convert to invoice** (no invoice yet) → "Invoice draft — send it" → "Awaiting payment" → "Awaiting sign-off" (was always "Awaiting Sign-off"). Files: `components/portal/orders/order-status-pill.tsx`, `lib/orders/order-status.ts`, `components/portal/views/{orders-view,order-detail-page-view}.tsx`, `components/account/{customer-orders-dashboard-view,customer-order-detail-view}.tsx`, `store/{providerOrdersSlice,ordersSlice}.ts`, `lib/types/{provider-order,order-booking}.ts`.

### 2026-11-19
- **Fixed orders: Convert to invoice → customer pays → sign-off** (client). Pro order page header: **Convert to invoice** once the completed work is approved (opens the new draft invoice to send), afterwards **INV-… · Draft / Sent / Paid** linking to it; Summary banner tells the Pro the next step (convert / send / waiting for sign-off). Customer order page: while the order is Work completed and the invoice isn't paid, "Order actions" shows **Pay your invoice** (INV-… · $ due · Pay invoice → `/account/dashboard/invoices/[id]`) or "Invoice on its way"; **Complete sign-off** only appears once it's paid. Pro jobs on the customer side unchanged. Files: `components/portal/orders/order-crew.tsx` (`OrderInvoiceAction`), `components/portal/views/order-detail-page-view.tsx`, `components/account/customer-order-detail-view.tsx`, `lib/types/{provider-order,order-booking}.ts` (`OrderInvoiceSummary`, `parseOrderInvoice`), `store/{providerOrdersSlice,ordersSlice}.ts`, `lib/api/order-crew-client.ts`, `components/api/ApiRoutesFile.ts`.
- **Pro order completion review now looks exactly like a job's Requests** (client). The inline "Completion submitted" card on the Pro's Summary is replaced by a **Requests** tab (pulsing count badge while pending) with the job's table — Requested by (+ Technician / Contractor tag), Type "Job completion" + status pill (Pending provider review / Approved / Re-work requested), Details (notes · photos · office note), Created at, options (View / Approve / Reject) — and the job's **Completion submitted** dialog (Job / Technician / Photos box, photo grid, technician notes, Note to the technician, Reject & Request Re-work with a required reason, Approve & Mark Job Complete). Summary banner points to the Requests tab while pending; the orders list's **Review completion** opens `?tab=requests`. Files: `components/portal/orders/order-requests-tab.tsx` (new), `components/portal/orders/order-crew.tsx` (inline card removed), `components/portal/views/{order-detail-page-view,orders-view}.tsx`.
- **Fixed orders: Pro reviews the crew's "Mark complete" (like a job)** (client). Pro order page Summary: "Completion submitted · Pending your review" card with the proof photos, the crew's notes, an optional note and **Reject & Request Re-work** / **Approve & Mark Job Complete**; Pro orders list Quick Action shows **Review completion** for those orders. Crew order screen: "Waiting for office approval" banner (Mark complete + Clock In locked) or "Re-work requested" with the office note (button becomes **Resubmit work**); success toast "Sent for approval…". Files: `components/portal/orders/order-crew.tsx` (`OrderCompletionReviewCard`, `CrewCompletionBanner`, clock lock), `components/portal/views/{order-detail-page-view,orders-view}.tsx`, `store/providerOrdersSlice.ts`, `lib/types/provider-order.ts` (`OrderCrewCompletion`), `lib/api/order-crew-client.ts`, `components/api/ApiRoutesFile.ts`.
- **Pro orders list: no field buttons in Quick Action** (client). `/pro/dashboard/orders` still offered Depart / Arrive / Start Work / Complete / + Change per row; those are the assigned crew's (Clock In in their portal). Now: Requested → Accept / Decline (unchanged); Confirmed / In transit / Arrived → **Assign** (opens the order) when nobody is assigned, else "Waiting for crew"; In progress → "Work in progress"; later states unchanged. Page description now about accepting, assigning and following orders. (The unused `order-detail-sheet.tsx` still has old buttons but isn't rendered anywhere.) Files: `components/portal/views/orders-view.tsx`.
- **Crew Jobs badge updates on a new order assignment** (client). Assigning / removing a worker only sends them a notification (no `ORDER_UPDATED`), so the shared order list — and the Jobs badge — didn't reload until a page refresh. `CrewOrdersSync` now also reloads on any `NEW_NOTIFICATION` whose data has an `orderId`. Files: `components/portal/orders/use-crew-open-orders.ts`.
- **Order crew errors show the real reason** (client). Clock In / Clock Out / assign errors showed axios's "Request failed with status code 400"; they now show the API message (`extractErrorMessage`, e.g. "You are 2.4 km from the job site…"). Files: `components/portal/orders/order-crew.tsx`.
- **No "In Transit" / "Arrived" for fixed-price work** (client). The crew clocks in on site like a job, so those steps no longer exist. Technician / contractor Jobs list + order screen show job-style statuses (`orderStatusAsJob`: Confirmed / In transit / Arrived → Scheduled, In progress / Change order pending → In progress, Work completed → Completed, Settled → Paid, Cancelled); the contractor status filter matches the same way. Pro Fixed service orders list: "In Transit" and "Arrived" tabs removed (older orders in those states still under All). An order already "In Transit" just needs Clock In on site. Files: `components/portal/orders/crew-work-list.tsx`, `components/portal/views/{order-detail-page-view,orders-view}.tsx`.
- **Technician job page: "My jobs" button → icon back arrow** (client). Same as the order screen and the contractor job page: the round back arrow left of the title returns to Jobs. Nothing else on the job page changed. Files: `components/technician/views/technician-job-detail-view.tsx`.
- **Crew order screen: "My jobs" button removed** (client). The round back arrow left of the title already returns to Jobs. Files: `components/portal/views/order-detail-page-view.tsx`.
- **Crew order screen works like a job** (client + API). On `/technical/orders/[id]` and `/contractor/orders/[id]` the crew now gets the same header and flow as a job: **Mark complete** (proof photos; enabled once work is in progress), **Chat with office** (technician), **Request scope change** (change order), **My jobs**; and a "Time on this job" card with **Clock In / Clock Out** (200 m, location on) instead of the stage banner. Clock In starts the work (the API marks the order arrived + in progress), Clock Out stops the clock. Removed for the crew: Depart, Arrive On-Site, Start Work and the separate Check in / Check out buttons. The Pro page is unchanged. Regular job pages / ClockControl untouched. Files: `components/portal/orders/order-crew.tsx` (`CrewOrderClockCard` replaces `CrewCheckButtons`), `components/portal/views/order-detail-page-view.tsx`.
- **Crew Jobs: one list, shared order cache, faster location, check-in only on site** (client + API).
  - *One list, no "fixed price" wording*: the Type dropdown (All work · Jobs · Fixed price) and the "Fixed price" tag are gone — technician and contractor Jobs show jobs + assigned orders together, newest first, with the status dropdown only (contractor's job-status filter maps onto order statuses, e.g. On site → Arrived). Job rows keep Clocked in, directions, requirements, completion state and Chat. Jobs load from the existing portal slices (`fetchTechJobs` / `fetchContractorJobs`, 100 per request, extra pages only if there are more).
  - *No repeated API calls*: new `store/crewOrdersSlice.ts` (`fetchCrewOrders`, one request at a time, reused for 30 s) is the single copy for the Jobs list, the Jobs nav badge and its hover card; `CrewOrdersSync` (once per shell) reloads it on `ORDER_UPDATED` / reconnect. Previously each of those fetched and subscribed on its own.
  - *Location*: the crew portals start watching the device position when they open (`CrewLocationWarmup` → `lib/location-cache.ts`) and keep the latest fix as the device moves; Depart / Arrive use it instantly (`getFastPosition`: warm fix, else a quick coarse reading, else one high-accuracy try) instead of a brand-new high-accuracy fix with `maximumAge: 0` and a 10 s timeout ("Location detection timed out"). Arrive only accepts a fix ≤ 30 s old (200 m geofence). `getDeviceLocation` (check in / clock in) also uses a warm fix ≤ 30 s old.
  - *Check in*: hidden until the order is Arrived (flow is Depart → Arrive, which checks you in → Start work); afterwards Check in / Check out stay for breaks.
  - Files: `store/{crewOrdersSlice,index}.ts`, `components/portal/orders/{crew-work-list.tsx,use-crew-open-orders.ts,order-crew.tsx,order-action-modals.tsx}`, `components/{technician/technician-shell,technician/views/technician-jobs-view,contractor/contractor-shell,contractor/views/contractor-jobs-view}.tsx`, `components/time-tracking/geofence-watch.tsx`, `lib/{location-cache,geolocation}.ts`.
- **Crew Jobs: filters as dropdowns; Jobs badge resets on visit** (client). Technician Jobs: the two button groups became dropdowns — Type (All work · Jobs · Fixed price) and Status (All statuses · Open · Completed). Contractor Assigned Jobs: Type dropdown next to the existing status dropdown. The Jobs sidebar badge's fixed-price part counted *every* open order, so it never cleared while on the page; it now counts open orders assigned since Jobs was last opened (`markCrewOrdersSeen` on open / new orders / leave, stored per portal in localStorage) and shows 0 while on Jobs — same behaviour as the job-updates part. Files: `components/portal/orders/{crew-work-list.tsx (WorkKindSelect),use-crew-open-orders.ts (useCrewUnseenOrders, markCrewOrdersSeen)}`, `components/technician/{technician-shell,views/technician-jobs-view}.tsx`, `components/contractor/{contractor-shell,views/contractor-jobs-view}.tsx`.
- **Crew portals: fixed-price orders live inside Jobs (no separate "Fixed Orders" nav)** (client). Technician (`/technical/jobs`) and contractor (`/contractor/jobs`) Jobs pages get an **All · Jobs · Fixed price** filter (default All). *Jobs* = the original jobs table, unchanged (server search / pages / scope or status filter, chat, clock-in). *All* = jobs (first 100) + assigned fixed-price orders in one list, newest first, client-side search / pages; order rows carry a small "Fixed price" tag and open the order screen (`/technical|contractor/orders/[id]`, unchanged — depart, check in/out, change orders, completion proof). *Fixed price* = orders only. Technician Open / Completed applies to orders too; the contractor job-status dropdown shows on *Jobs* only. Sidebar: "Fixed Orders" item removed; Jobs badge = new job updates + open fixed-price orders (hover card lists both); Jobs stays highlighted on order screens. The old `/technical/orders` and `/contractor/orders` list URLs redirect to Jobs; the order screen's back arrow returns to Jobs. Files: `components/portal/orders/crew-work-list.tsx` (new: `WorkKindToggle`, `CrewWorkTable`, `useCrewOrderRows`, `orderWorkRow`), `lib/api/order-crew-client.ts` (`listCrewOrders`), `components/technician/{technician-shell,views/technician-jobs-view}.tsx`, `components/contractor/{contractor-shell,views/contractor-jobs-view}.tsx`, `components/portal/views/order-detail-page-view.tsx`, `app/(technician)/technical/orders/page.tsx`, `app/(contractor)/contractor/orders/page.tsx`.
- **Orders search works across all orders (Pro + customer)** (client + API). Pro `/pro/dashboard/orders`: the search was already sent as `?search=` but the API ignored it, so every order came back — fixed in the API. Customer `/account/dashboard/orders`: search only filtered the 10 rows on the current page (count stayed "13 Orders", pages unchanged); it's now sent to the API (debounced 400 ms, back to page 1), so the count and pages reflect the matches. `fetchCustomerOrders` takes an optional `search` (part of the list cache key). Files: `store/ordersSlice.ts`, `components/account/customer-orders-dashboard-view.tsx`.
- **Fixed service orders: Pro assigns & manages, crew runs the field steps** (client). On `/pro/dashboard/orders/[id]` the Pro no longer sees Depart, Arrive On-Site, Start Work, Complete Work or Propose / + Change Order (header, Change Orders / Completion sub-bars and the empty Change Orders panel) — the assigned employee / contractor runs those from `/technical/orders/[id]` / `/contractor/orders/[id]`, like Estimate → Jobs. The Pro keeps Assign contractor / Assign employee, Accept / Decline, Cancel and all tabs. The stage banner on the Pro page now talks about assignment and the crew's progress (`getProStageBanner`) instead of "click Depart"; the empty crew card says "Assign an employee or contractor — they depart, check in on site and complete the work from their portal." Crew portal screens unchanged. UI only (backend still accepts the steps from the Pro). Files: `components/portal/views/order-detail-page-view.tsx`, `components/portal/orders/order-crew.tsx`.
- **Fixed service orders: "Unassigned" in list, icon back button, no Refresh on detail** (client). The orders list "Assigned" column showed "You" when nobody was assigned; it now says "Unassigned" (names only when someone is assigned). The order detail header drops the "Back to fixed service orders" and "Refresh" buttons; a round back-arrow icon sits left of the order title (RecordWorkspace `backHref`, same as other detail pages; the page still live-reloads on `ORDER_UPDATED`). Assign / Accept / Decline and tabs unchanged. Files: `components/portal/views/{orders-view,order-detail-page-view}.tsx`.
- **Fixed Service Orders: assign employees / contractors, crew portals, live sidebar badge** (client). Pro order page (`/pro/dashboard/orders/[id]`): "Assign contractor" + "Assign employee" in the header (same as a job), crew card on Summary in the job style (Assigned technician card, Contractors list with title / window / pay terms, Checked in / Started / Not started chips, Chat); Remove is locked (with reason) once that person started work or the order is finished; change orders show who raised them; the page reloads live on `ORDER_UPDATED` (crew ↔ Pro ↔ customer status sync). The job `AssignContractorDialog` is now generic (`ContractorAssignTarget`, `assign`, `recordLabel`) and reused for orders. Orders list gets an "Assigned" column. **Crew portals** reuse the same screens with `viewer`: `/technical/orders(/[id])` and `/contractor/orders(/[id])` — "Fixed Orders" nav item with a live open-orders badge; Depart → Arrive (200 m geofence, auto check-in) → Start → Change order → Complete with proof; Check in / Check out buttons; no accept / decline / cancel, payout, financials or crew editing; clocked-in pill links to the order. `providerOrdersSlice` has `setOrderApiScope("provider" | "technician" | "contractor")` so the thunks call that portal's API. **Sidebar badge**: "Fixed service orders" now shows live bookings awaiting Accept / Decline (stays until acted on) + unread order updates (crew check-ins, change orders answered, settled); previously only requests since the page was last opened. Customer proof review + sign-off → settlement was already in place. Files: `components/portal/orders/{order-crew.tsx,use-crew-open-orders.ts}`, `components/portal/views/{order-detail-page-view,orders-view}.tsx`, `components/portal/{job-crew,portal-shell,use-portal-inbox,portal-inbox-counts-store}.ts(x)`, `components/{technician/technician-shell,contractor/contractor-shell}.tsx`, `store/providerOrdersSlice.ts`, `lib/api/order-crew-client.ts`, `lib/{time-tracking,technician-paths,contractor-paths}.ts`, `lib/types/provider-order.ts`, `components/api/ApiRoutesFile.ts`, `app/(technician)/technical/orders/**`, `app/(contractor)/contractor/orders/**`.
- **Admin blog forms: audience follows the category (selector removed)** (client). The Target Audience buttons are gone from the "Write article" modal and the detail page's "Edit Article" dialog; on save the audience is always derived from the category (For Service Businesses → pro, Platform News → both, For Homeowners / Home Maintenance → customer). A subtle "Publishes to: …" line under Category shows the destination blog. Audience column + filter in the list kept. UI only — no seed run, no database changes. Files (admin app): `src/components/shared/blog-publish-fields.jsx` (`BlogAudienceHint`, date-only `BlogPublishFields`), `src/pages/blog-posts.jsx`, `src/pages/blog-detail.jsx`.
- **Separate Customer & Pro blogs, publish date label, dynamic Pro blog section** (client). Pro footer/menu "Blog" used to open the customer blog. Now: `/blog` = customer + "both" articles, new `/for-pros/blog` (+ `/[slug]`, `/category/[slug]`) = Pro + "both" (API `?audience=`). Article page moved to shared `components/blog/blog-article.tsx` (`BlogArticle` + `blogArticleMetadata`, per-blog breadcrumbs, related posts, sidebar CTA); an article opened on the wrong blog permanently redirects to its own (streamed meta-refresh in the page because of `loading.tsx`, also thrown from metadata); "both" articles are canonical on `/blog`. `/blog/category/service-business` → 308 to the Pro blog category. Cards/articles show "Published / Article published" + date and year only. Footer Company "Blog" → `/for-pros/blog` on Pro pages, plus "Pro Blog" under For Professionals; Pro header "From the desk" links → Pro blog. Pro landing (`/for-pros`) gets a live "Pro insights" `BlogSection site="pro"` (hidden when none). Sitemap/RSS use each article's canonical blog; llms.txt lists both blogs. Helpers: `lib/data/blog-audience.ts`. Files: `components/blog/{blog-article,blog-hero,blog-index}.tsx`, `components/shared/blog-card.tsx`, `components/home/blog-section.tsx`, `components/layout/site-footer.tsx`, `lib/data/{blog-audience,public-blogs,navigation,pro-nav}.ts`, `lib/types/index.ts`, `lib/sitemap-entries.ts`, `app/(marketing)/blog/{page,[slug]/page,category/[slug]/page,rss.xml/route}.tsx|ts`, `app/(marketing)/for-pros/{page.tsx,blog/**}`, `app/llms.txt/route.ts`.
- **Admin (admin.requestservice.com/blog-posts): Target Audience + Blog Date & Time** (client). Both the "Write article" modal and the detail page's "Edit Article" dialog get a Customers / Pros / Both selector (follows the category until picked) and a `datetime-local` Blog Date & Time with no min (backdating allowed); saved as `audience` / `publishedAt`. List: Audience column + audience filter, Published column shows date + time, column sorting now goes to the API (was a no-op in server mode). Detail page shows Audience and the publish date/time. Files (admin app): `src/lib/blog-audience.js`, `src/components/shared/blog-publish-fields.jsx`, `src/pages/blog-posts.jsx`, `src/pages/blog-detail.jsx`, `src/store/api/blogsApi.js`.
- **Home "Your customer dashboard": Change Orders tab + multi-estimate approval flow** (client). New **Change Orders** tab after Orders (mirrors `/account/dashboard/change-orders`): list of COs linked to jobs with +cost and Pending approval / Approved chips, plus a CO-112 detail card (photo, line items, original → new total, Decline / Review & approve → Approved, added to INV-559). **Estimates** scene rebuilt: one request receiving 1→3 competing estimates (price, rating, start day, warranty), Compare mode with per-pro highlights, then Approve one → others Declined, job booked. Subtitle now lists change orders. No separate Approvals / Scheduling / Reviews tabs — the customer panel has no such pages (approvals live in Estimates + Change Orders; scheduling in Orders/Messages), so the preview keeps mirroring the real sidebar. File: `components/home/customer-feature-tabs.tsx`.

### 2026-11-18
- **Headers: Refresh buttons removed, icon-only back arrow** (client). Refresh removed (commented) from Pro fixed-service orders list + order detail, AI call history, and the Pro messages refresh icon (data updates live). Verbose back buttons ("Back to fixed service orders", "All orders/invoices/payments/estimates", "Back to requests", "Back to lead", "Back to settings", "All assigned jobs") → the round icon-only arrow before the title (`backHref`, label kept as tooltip/aria-label); `RecordWorkspace` gained `backHref`/`backLabel` (same style as `PortalPage`). Not-found body links and wizard Back steps left as text. Files: `components/portal/record-workspace.tsx`, `portal/views/order-detail-page-view.tsx`, `orders-view.tsx`, `messages-view.tsx`, `new-estimate-view.tsx`, `ai-calling/ai-call-history.tsx`, `contractor/views/contractor-job-detail-view.tsx`, `account/customer-{estimate,invoice,payment}-detail-dashboard-view.tsx`, `customer-order-detail-view.tsx`, `customer-quote-request-detail-view.tsx`, `app/(portal)/pro/dashboard/ai-receptionist/test/page.tsx`.
- **Pro Co-pilot: text in → text out, voice in → voice out** (client). The speaker toggle read typed replies aloud too. Now replies (incl. confirm/cancel results) are spoken only when the message came from the mic; the speaker button just mutes/unmutes those voice replies (on by default, new key `rs-pro-assistant:voice-replies`; old "read everything aloud" setting ignored). Old logic kept as comments. File: `components/pro-assistant/pro-assistant.tsx`.
- **Pro Co-pilot: live voice transcript in the input** (client). The mic used to auto-send as soon as speech stopped, so the words flashed by; now recognition is continuous with interim results, the words appear live in the box (read-only while listening, pulsing "Listening" hint), and the text stays there to check/edit until Enter/Send (still sent as voice, so the reply is read aloud). Old auto-send kept as a comment. File: `components/pro-assistant/pro-assistant-input.tsx`.
- **Order detail: Review & approve for pending fixed-service change orders** (client bug: the order page only displayed them). Pending order change orders get a "Review & approve" button that opens the customer change-order page (now fed by the backend fix). Files: `components/account/customer-order-detail-view.tsx`.
- **Customer dashboard: Spending + Estimates moved under Active projects and redesigned** (client: they sat at the bottom and looked too busy). New calm cards `SpendingInsight` (total invoiced, % paid chip, one thin brand-blue bar, Paid / Outstanding mini tiles — replaces the big donut) and `EstimateInsight` (total, one muted stacked bar in brand-blue/grey shades, 4 mini tiles: To review, Approved, Declined, Other — replaces the orange/green/violet bar), placed right after Active projects / Estimates to review; the lists row follows. Old SpendingCard / StatusBreakdownCard kept in `customer-dashboard-widgets.tsx`. Files: `components/account/customer-dashboard-advanced.tsx`, `components/account/customer-dashboard-view.tsx`.
- **Customer dashboard refinements** (client). (1) Next visit moved out of the KPI grid into the greeting line under the title: a soft pill with a gently pulsing live dot (2s ping), "Next visit", date/time and service, linking to the order; "No visits booked yet" otherwise. (2) KPI row trimmed to four uniform cards — Balance due, Estimates, Orders, Invoices (`lg:grid-cols-4`); Requests and Messages removed (sidebar / header cover them). Calm tones: brand blue, amber only when a balance is due. (3) Active projects + Estimates to review restyled minimal: neutral icon tiles and counts, outline status chips, brand-blue progress bar and links, soft provider marks, outline Review buttons — no emerald / violet / saturated fills. Old code kept as comments. Files: `components/account/customer-dashboard-view.tsx`, `components/account/customer-active-projects.tsx`, `components/account/customer-dashboard-advanced.tsx`.
- **Customer dashboard polish** (client). (1) "Overview" renamed "Dashboard" (sidebar item + page eyebrow). (2) Dark navy summary band and "Needs your attention" removed (kept in `customer-dashboard-advanced.tsx`, not rendered); replaced by one compact row of soft KPI cards (`CompactStat`): Balance due, Next visit, Requests, Estimates, Orders, Invoices, Messages (7 across on xl, 4 on md, 2 on phones). A slim amber strip appears only when change orders need approval. (3) Active projects and Estimates to review are now distinct: **Active projects** = emerald project tiles (provider mark, current stage, progress bar, status badge, total, "View project") in a 2-col card spanning two thirds; **Estimates to review** = violet decision queue (only estimates waiting on the customer, New/Updated badge, price, solid Review button) in the last third — both with empty states. (4) Layout tightened: lists (Quote requests, Recent orders, Recent invoices) three across with compact rows (4 each), charts (Spending + Estimates breakdown) last and side by side. Old blocks kept as comments. Files: `components/account/customer-dashboard-view.tsx`, `components/account/customer-dashboard-advanced.tsx`, `components/account/customer-active-projects.tsx`, `lib/data/customer-nav.ts`.
- **Customer header icons like the technician portal; Messages moved to the header** (client). Top bar: Back to site · Messages icon (unread badge, same orange as the technician header) · dark-mode toggle · bell · avatar + arrow — plain ghost icons, no bordered pills (interim pill styling kept as comments). Customer avatar trigger is borderless (h-8, 28px avatar + chevron). Messages left the sidebar (Inbox group commented out); still in the avatar menu too. Files: `components/account/customer-shell.tsx`, `components/layout/user-account-menu.tsx`, `lib/data/customer-nav.ts`.
- **Customer dashboard header + sidebar tidy-up** (client). (1) Sidebar title: "CUSTOMER DASHBOARD" subtitle on one line (was wrapping). (2) Avatar menu for customers is now a pill with the avatar + a dropdown arrow (rotates when open); applies wherever customers see it (dashboard + site header). (3) Settings and Support moved out of the sidebar into that dropdown (Messages · Settings · Support · Log out); sidebar Help/Account groups → one "Inbox" group with Messages (old items kept as comments; routes unchanged). (4) Top bar reordered: Back to site · [bell + dark-mode toggle together in one rounded group] · avatar menu. Files: `components/account/customer-shell.tsx`, `components/layout/user-account-menu.tsx`, `lib/data/customer-nav.ts`.
- **Customer dashboard: name in the sidebar header + advanced overview** (client). Sidebar brand block now matches the technician portal: customer photo (or a house icon) + the customer's name + "CUSTOMER DASHBOARD" subtitle (was "RS" + "Customer Dashboard"). Overview gains (1) `CustomerHeroSummary`: navy band with balance due, next booked visit (soonest upcoming order), projects in progress / items needing you, and quick actions (Request a quote, Message a pro, Pay an invoice, Get support); (2) `CustomerActionCenter` "Needs your attention": one prioritised list of overdue / due invoices (Pay), change orders to approve (Review), estimates to review (Review) and unread messages (Reply). It replaces the change-orders-only banner (kept in code, disabled). Uses data the page already loads — no new API calls. Files: `components/account/customer-dashboard-advanced.tsx` (new), `components/account/customer-dashboard-view.tsx`, `components/account/customer-shell.tsx`.
- **Customer Quote Requests / Estimates: tab bar removed** (client: Quote Requests should show only quote requests; Estimates has its own sidebar link). The shared view no longer renders the "Quote requests (n) | Estimates (n)" tabs; /account/dashboard/requests shows only the requests table and /account/dashboard/estimates only estimates (`?tab=` links still work). Eyebrow Activity → Projects to match the sidebar group. Old tab bar and `setTab` kept as comments. Files: `components/account/customer-estimates-dashboard-view.tsx`.
- **Customer sidebar: Orders dropdown restored** (client: wanted Orders with All orders + Change orders inside, as before). Orders in the Projects group is a dropdown again (opens automatically on either page, combined badge when closed); the single-link `matchAlso` version is kept as a comment, and the Orders hover card no longer double-counts change orders. The new groups and the "All orders | Change orders" header switch stay. Files: `lib/data/customer-nav.ts`, `components/account/customer-shell.tsx`.
- **Customer dashboard sidebar streamlined** (client: too many / verbose options; clean SaaS customer-portal standard). Sidebar is now Overview · **Projects** (Quote Requests, Estimates, Orders) · **Billing** (Invoices, Payments) · **Help** (Messages, Support) · **Account** (Settings). Orders is a single link (no All orders / Change orders dropdown): new `matchAlso` keeps it highlighted on change-order pages and its badge / hover card include change orders to review; the Orders and Change orders pages get an "All orders | Change orders" switch in their header (`CustomerOrdersTabs`), so every route stays reachable. "Back to site" left the nav list (top-bar button already exists; added to the mobile menu footer beside Log out). Polish: RS mark + title in the sidebar header (h-14), roomier rows (py-2, gap-3) and groups (gap-5). No routes, queries or badge logic removed; previous nav config kept as a comment. Files: `lib/data/customer-nav.ts`, `components/account/customer-shell.tsx`, `components/account/customer-orders-tabs.tsx` (new), `components/account/customer-orders-dashboard-view.tsx`, `components/account/customer-change-orders-view.tsx`.
- **Avatars: photo first, else initials on one solid brand colour** (client). New shared `UserAvatar` (`components/shared/user-avatar.tsx`): uploaded picture when there is one (falls back if it fails to load), otherwise initials (`avatarInitials`) on `bg-primary`. Unified everywhere initials were coloured: `getAvatarColor` (chat lists / threads, request detail) now returns one brand colour instead of an 8-colour hash palette; shadcn `AvatarFallback` default is now solid brand (was grey); tinted / grey overrides in account settings, account menu, billing settings, business profile and blog comments switched to the same solid style; bot `ProviderAvatar` gradient → solid; home reviews (green/blue gradients) now use `UserAvatar` with an optional `avatar` per review. Old styles kept as comments. Files: `components/shared/user-avatar.tsx` (new), `lib/chat-format.ts`, `components/ui/avatar.tsx`, `components/home-concepts/customer-reviews-section.tsx`, `components/bot-ai/cards/ProviderAvatar.tsx`, `components/blog/blog-comments.tsx`, `components/account/account-settings-view.tsx`, `components/layout/user-account-menu.tsx`, `components/portal/views/billing-settings-view.tsx`, `components/portal/views/business-profile-detail-view.tsx`.
- **Customer header: logo slogan on every page** (client: only the home page showed "Find the Right Pro. Get the Job Done." under the logo). `CustomerSiteHeader` now always passes the tagline (was `pathname === "/"` only; old code kept as a comment). Pro header unchanged. Files: `components/layout/site-header.tsx`.
- **Customer dashboard showcase: a different animated scene per tab, like the Pro landing** (client: all tabs looked the same inside one panel frame). Each section now has its own composition filling the stage (container queries, floating cards): Overview = stat counters + active projects + quick actions + notifications; Quote Requests = request typed and sent, three pros slide in with prices; Estimates = itemized sheet + drawn signature + Approved stamp; Orders = full-stage map with the tech driving to the home, order progress card and a change order to approve; Invoices = the first-version pay-and-stamp card (client liked it); Payments = monthly chart + history + printed receipt; Messages = phone chat with a photo + web/mobile notifications; Support = ticket thread + resolution timeline. Files: `components/home/customer-feature-tabs.tsx`.
- **AI Kitchen Redesign page made fuller** (client: page too short). Added Styles to try (six style cards with palette swatches), What you can change (kitchen / bathroom finish lists + photo tips) and an FAQ (five questions, native details/summary) before the closing CTA. Files: `app/(marketing)/ai-kitchen-redesign/page.tsx`.
- **Customer dashboard showcase rebuilt to match the real customer panel** (client: too much empty space left/right; show what customers actually get). Tabs are now the customer panel's own sections in sidebar order — Overview, Quote Requests, Estimates, Orders (live status + change orders), Invoices, Payments, Messages, Support — and the visual is a small copy of the panel (blue "Customer Dashboard" sidebar with the active item, search/bell top bar, section content) filling the whole stage instead of a centred card. Copy column adds three check-point bullets per section. Files: `components/home/customer-feature-tabs.tsx`.
- **AI Kitchen Redesign page redone in the site's style** (client: hero didn't match, button too wide, no before/after section). Hero now follows the Get a quote hero (photo with navy gradient, breadcrumb, eyebrow, three step cards); start buttons keep their own width (`RedesignStartCta` wraps them, `inverse` = white button on dark); before/after slider removed; benefits card + "What happens next" / "Saved in your dashboard" side cards on the grey band, then a `#003F7D` closing CTA band. Files: `app/(marketing)/ai-kitchen-redesign/page.tsx`, `components/ai-redesigner/redesign-start-cta.tsx`.
- **Home page: before/after kitchen section → animated customer dashboard showcase** (client). The `RedesignerSection` showcase on `/` is commented out and replaced by `CustomerFeatureTabs` — same tab pattern as the Pro landing (sliding highlight, auto-advance while on screen) with six animated sample visuals: dashboard, estimates (approve), change orders (approve extra), invoices & payments (pay → paid), chat, live tracking (ETA → arrived). Files: `components/home/customer-feature-tabs.tsx` (new), `app/(marketing)/page.tsx`.
- **Navbar "AI Kitchen Redesign" + info page** (client). New customer nav item → `/ai-kitchen-redesign`: hero, six benefits, the before/after showcase (moved from home), three steps and CTAs. Guests get "Log in to start designing" / "Create a free account" (both return to `/ai-kitchen-bath-designer` via `?next=`); signed-in customers get "Start designing". Files: `lib/data/navigation.ts`, `app/(marketing)/ai-kitchen-redesign/page.tsx` (new), `components/ai-redesigner/redesign-start-cta.tsx` (new).
- **Get a quote: live categories + sub-services from the admin panel** (client: no static list). `RequestIntake` loads parent categories (`fetchParentCategories`) for the "What service do you need?" step, and picking one loads all its sub-services (`fetchSubcategories`, every page) for the "What kind of work" step; a category with no sub-services skips that step. The seeded `lib/data/services.ts` list is only the fallback while loading / if the API fails. The live category name is carried as `serviceName` so the sent request is labelled correctly. Files: `components/marketplace/request-intake.tsx`, `lib/booking/format-quote-answers.ts`.
- **Smart logo routing (Pro vs customer)** (client). `Logo` now picks its link from the page when no `href` is passed: Pro side (`/pro/*` incl. Pro login, `/for-pros/*`) → Pro landing `/for-pros`; customer side → `/`. Covers the Pro header, the Pro login panel and the footer. Verified in the served HTML. Files: `components/layout/logo.tsx`.

### 2026-11-17
- **Pro Co-pilot pill: right side only** (client: "not on the left, only right side"). Dragging now only moves it up / down along the right edge; drops and saved spots always land on the right (left-side snap code kept as comments). Smart collision unchanged. Files: `components/pro-assistant/pro-assistant-bubble.tsx`.
- **Pro Co-pilot pill: snaps to the right or left side, never the centre** (client: "only right side and left side, not in centre of screen"). On drop it snaps to the nearer side — right window edge, or the left edge of the page content (past the sidebar, so it never covers the menu); vertical position stays free and is saved. Saved spot is now `{ side, bottom }` (old `{ right, bottom }` spots convert to the nearer side). Smart collision unchanged. Previous free-x code kept as comments. Files: `components/pro-assistant/pro-assistant-bubble.tsx`.
- **Pro Co-pilot launcher: open pill by default** (client picked the pill screenshot "this one", not the round bubble + dark "Pro Co-pilot · Ctrl J" label). The draggable bubble now renders as the open pill — icon + "Pro Co-pilot" + "Ask · navigate · estimate" — always visible on ≥640px (round icon only on phones). Drag, saved spot (localStorage), and smart collision kept; clamping and collision sampling now use the pill's real width (ResizeObserver). Old round bubble + separate label kept as comments. Files: `components/pro-assistant/pro-assistant-bubble.tsx`.

- **Pro Co-pilot bubble: name label always shown** (client: “default open”). The “Pro Co-pilot · Ctrl J” label beside the bubble is visible by default (was hover-only), on the side with room; hidden on phones and while dragging. The label’s area is part of the smart collision check, so bubble + label slide up together off buttons / pagination. File: `components/pro-assistant/pro-assistant-bubble.tsx`.

- **Pro Co-pilot: smart draggable floating bubble (client spec; replaces the right-edge tab).** New `components/pro-assistant/pro-assistant-bubble.tsx`: round bubble, bottom-right by default; **drag anywhere** (free x / y, no side snapping; a drag never opens it), position saved in localStorage (`rs-pro-copilot-bubble:v1`, distance from the right / bottom edges) and clamped on resize. **Smart collision:** after scroll (any scroll container), resize, DOM changes or route changes (debounced 120 ms) it samples 9 points under the bubble with `elementsFromPoint`; if a button, link, field, tab, pagination… is there, it slides up smoothly (8 px steps, up to 280 px) to the nearest clear spot and back down when free. **Overlays:** fades out while a dialog / sheet is open (so their Save / Update buttons are never covered). Hover label “Pro Co-pilot · Ctrl J” on the side with room; Ctrl/⌘+J unchanged. Panel back to the bottom-right corner (`pro-assistant.css`); the edge tab and top-bar button stay in code, commented. tsc + eslint clean. Files: `components/pro-assistant/{pro-assistant-bubble.tsx (new),pro-assistant.tsx,pro-assistant.css}`.

- **Pro Co-pilot entry point → slim right-edge tab (client’s choice; the top-bar pill was not liked).** New `ProAssistantEdgeTab` (`pro-assistant-launcher.tsx`): a narrow vertical “Co-pilot” tab fixed to the middle of the right screen edge (rounded left side, widens slightly on hover, focus ring), hidden while the panel is open; Ctrl/⌘+J still toggles. The top-bar `ProAssistantHeaderButton` is no longer rendered (kept commented in `portal-shell.tsx`). The panel now sits beside the tab, vertically centred under the top bar, and slides in from the right (`pro-assistant.css`). Nothing sits over page bottoms (buttons / pagination). tsc + eslint clean. Files: `components/pro-assistant/{pro-assistant-launcher.tsx,pro-assistant.tsx,pro-assistant.css}`, `components/portal/portal-shell.tsx`.

- **Pro Co-pilot moved into the top bar (replaces the floating launcher).** The client didn’t like the floating button (round / pill) over the page. New `ProAssistantHeaderButton` (`pro-assistant-launcher.tsx`): a compact “Co-pilot” button with a Ctrl J hint, next to the theme toggle and notifications in `portal-shell.tsx`; it toggles the panel via a window event (`rs-pro-assistant:toggle`), Ctrl/⌘+J still works. The floating `ProAssistantLauncher` is no longer rendered (kept, commented in `pro-assistant.tsx`). The panel now opens just under the top bar, anchored top-right, and drops down (`pro-assistant.css`). Reverted the earlier workaround: portal `<main>` back to `py-3` (no `pb-24`), Messages inbox without `-mb-24`. Nothing floats over pages any more, so form buttons, tables and pagination are never covered. tsc + eslint clean. Files: `components/pro-assistant/{pro-assistant-launcher.tsx,pro-assistant.tsx,pro-assistant.css}`, `components/portal/portal-shell.tsx`, `components/portal/views/messages-view.tsx`.

- **Pro Co-pilot launcher no longer covers page buttons / pagination.** (1) Portal `<main>` now has bottom clearance (`pt-3 pb-24`, was `py-3`) so the last form buttons (Update, Save), pagination (Previous / Next) and table rows always scroll above the floating launcher. (2) The launcher is a compact round button when idle; the “Pro Co-pilot” label slides out on hover / keyboard focus (focus ring added) — far smaller footprint, same drag / dock behaviour, z-40 stays under dialogs and sheets (z-50). (3) Full-height chat pages (Messages, Team chat): the inbox cancels the new padding (`-mb-24`, layout unchanged) and the launcher sits at least 96px from the bottom so it never covers the message box / Send. tsc clean; lint shows only older errors in `messages-view.tsx` (refs during render, untouched). Files: `components/portal/portal-shell.tsx`, `components/pro-assistant/pro-assistant-launcher.tsx`, `components/portal/views/messages-view.tsx`.

- **Pro Co-pilot: Minimize button** (minus icon, next to Close) — hides the panel to the launcher and keeps the chat, the expanded size and the history panel as they were (Close also resets those). File: `components/pro-assistant/pro-assistant.tsx`.

- **Pro Co-pilot UI for the operations agent.** New `components/pro-assistant/action-cards.tsx`: live list card (rows open the record, totals, “See all”), facts card (timesheet summary, live status, business snapshot, suggestion) and Confirm card (details, Confirm / Cancel, result with link; nothing changes until confirmed). `pro-assistant.tsx`: renders them; voice confirm — saying “yes / go ahead” or “no / cancel” answers the waiting card; replies read aloud (speaker toggle in the header, remembered per device; always after a voice command; the mic stops speech); live-status answers open Employee tracking; new starters and welcome text. `pro-assistant-input.tsx`: tells the chat a message came from the mic. `pro-assistant-api.ts`: `list` / `info` / `confirm` action types, `confirmAssistantAction`, `cancelAssistantAction`. tsc + eslint clean.

- **Sidebar badges count the new `TASK_ASSIGNED` notification:** technician Schedule (`store/technicianSlice.ts`), contractor Jobs (`store/contractorPortalSlice.ts`) — same as the backend sections.

- **Sidebar: "Daily alerts" item renamed "Daily Alerts setting"** (user request), tooltip now "Settings for the morning briefing, customer reminders and missed check-ins". Old values kept in a comment. File: `lib/data/portal-nav.ts`.

- **Reverted the dashboard panel rename:** back to "Important actions" (user: only the sidebar item is named "Daily alerts"; the dashboard panel keeps its name). The remove-on-open behaviour stays. File: `components/portal/dashboard-action-center.tsx`.

- **Dashboard: "Important actions" panel renamed "Daily alerts"; opened items disappear at once.** Clicking View removes the item from the feed (`dismissDashboardActions` in `store/dashboardSlice.ts`, adjusts urgent/pending counts) and records it via `markDashboardActionsSeen` (`lib/api/crm-client.ts`, route `providerCrmApi.dashboardActionsSeen`). New `components/portal/dashboard-seen-tracker.tsx` (mounted in `crm-data-provider.tsx`, providers only) does the same when a lead / estimate / job / invoice page is opened from any table or link, and drops a lead when a `LEAD_STATUS_UPDATED` event says it was viewed. The sidebar item was already "Daily alerts". Files: `components/portal/dashboard-action-center.tsx`, `dashboard-seen-tracker.tsx` (new), `crm-data-provider.tsx`, `store/dashboardSlice.ts`, `lib/api/crm-client.ts`, `components/api/ApiRoutesFile.ts`.

### 2026-11-16

- **Fix: People → Reminders page restored; new page moved to `/pro/dashboard/alerts` ("Daily alerts")** — the new daily-alerts page had been written to the existing `/pro/dashboard/reminders` route and replaced the customer follow-up Reminders page. `app/(portal)/pro/dashboard/reminders/page.tsx` restored as it was (`RemindersView` in `PortalSuspense`, metadata "Reminders" / "Follow-ups tied to customer accounts.", confirmed from the last build); the new page now lives at `app/(portal)/pro/dashboard/alerts/page.tsx`, sidebar Office → "Daily alerts" (renamed from "Reminders & alerts" so it isn't confused with Reminders; email footers say "Office → Daily alerts"). Files: both page files, `lib/data/portal-nav.ts`, `components/portal/views/reminders-alerts-view.tsx`; backend `daily-alerts/{briefing,attendance}.js` (footer text).
- **Daily alerts page (daily alerts engine)** — client spec. New Pro page `/pro/dashboard/alerts` (Office → "Daily alerts" in the sidebar): settings cards for the morning briefing (me / each employee, 15–120 min before opening), customer reminders, and missed check-in alerts (alert after 5–60 min late, remind the employee) — each change saves immediately (optimistic, rolled back on error); a channels note (bell, push incl. mobile apps, email); and a **Today** panel: every item on today's calendar with time, customer, address, who gets it, "Sent" / "At 7:30 AM", each assignee's check-in state ("checked in" / "alert after 10:15 AM" / "you were alerted"), and change orders waiting for the customer. Shaped skeleton while loading. Technician badges: `TECH_SECTION_TYPES.schedule` also counts DAILY_BRIEFING + ATTENDANCE_REMINDER (same as the server). Files: `components/portal/views/reminders-alerts-view.tsx` (new), `app/(portal)/pro/dashboard/alerts/page.tsx` (new), `lib/data/portal-nav.ts`, `components/api/ApiRoutesFile.ts` (`providerApi.dailyAlerts`), `store/technicianSlice.ts`.

- **Customer quote answers: no boxes** — client: not box-style. In the `dense` layout (estimate workspace accordion) each answer is now label over value with a thin primary accent line on the left (`border-l-2 border-primary/30 pl-3`), no white box / border / background, `gap-x-6 gap-y-2.5`, still 3 / 2 / 1 columns; body padding back to `py-3`. Previous dense box kept as a comment. Other uses unchanged. Files: `components/portal/quote-answers-card.tsx`.
- **Estimate workspace: compact "Customer quote answers"** — client: the answer boxes (Captured by, Preferred timing, Urgency…) wasted vertical space. New `dense` option on `QuoteAnswersCard`, used by `QuoteAnswersAccordion`: each box `py-1.5` (was `py-2.5`), label and value tight with no gap (`leading-4` / `leading-5`), `gap-1.5`, and up to 3 columns on wide screens (2 on tablet, 1 on phone); the open body padding is `py-2.5` (was `py-3`). The accordion also gets dark-mode colours (it was light-only). Other uses of `QuoteAnswersCard` (job file, new estimate, request detail) are unchanged. Files: `components/portal/quote-answers-card.tsx`.
- **Work request → Internal notes: "View call log" card for AI receptionist estimates** — client: the raw yellow box dumped the call metadata + transcript. For an estimate with `source === "ai_receptionist"` the Internal notes section now shows a clean card (phone icon, "Created from an AI receptionist call", CALL-number · time · length, the one-line call summary) with a **View call log** button that opens that call's AI Receptionist detail page (`/pro/dashboard/ai-receptionist/calls/:id`, latest call linked to the estimate). Skeleton while loading; if no call is found it falls back to the notes box, with the transcript cut off (`withoutCallTranscript`). Other estimates are unchanged; the previous markup is kept as a comment. Theme tokens for light/dark. Files: `components/ai-calling/linked-call-button.tsx` (new `CallLogCard`), `components/portal/estimate-v2/project-panels.tsx` (RequestPanel).
- **AI call detail: the visit is shown as the draft estimate's site visit, not "Booked."** — client. The card now reads
  "Draft estimate EST-… / Site visit scheduled" (live visit status: scheduled, rescheduled, in progress, done,
  cancelled, no-show), the time + estimator, and "add prices and send the estimate after the visit"; chip "Scheduled a
  site visit", activity "Site visit scheduled for the estimate". File: `components/ai-calling/ai-call-log-detail.tsx`,
  `call-logs.ts`.

- **Technician sidebar: an estimate assigned with a booked visit also bumps the Schedule badge live** (same rule as the
  server). File: `store/technicianSlice.ts`.

- **AI Receptionist settings: real loading skeleton** — client. Shaped like the page (status bar, Phone line card with
  the AI number box and forwarding field, Voice & greeting card, test-call and How-it-works cards) instead of four
  plain blocks. File: `components/ai-calling/ai-calling-settings-panel.tsx` (`PanelSkeleton`).

- **Fix: app crashed on load ("Cannot access default export before initialization", store/index.ts)** — the new
  `aiCallsSlice` imported `components/ai-calling/call-logs.ts`, which imported `apiFuntions` (that imports the store):
  a circular init. `call-logs.ts` now uses the lazy `sliceHttp` helpers like every other slice (same requests).
  File: `components/ai-calling/call-logs.ts`.

- **AI call detail: Estimate / View on schedule / Lead buttons in the page header (right)** — client. The header
  (title, back arrow) is now rendered by `AiCallLogDetail` (calls/[id]/page.tsx only renders it) so the buttons can be
  its `actions`, across from "AI Receptionist / Call history". Files: `components/ai-calling/ai-call-log-detail.tsx`,
  `app/(portal)/pro/dashboard/ai-receptionist/calls/[id]/page.tsx`.

- **AI call history like the Leads table; real loading skeleton on the call page** — client.
  - Call history: the table sits straight on the page (no box inside a box) with search (customer, phone, service,
    lead / estimate number, call number), an "All calls" filter (Type: phone / test; Outcome: lead or estimate saved,
    transferred, hung up, out of scope, no response) next to Export, server paging. Search is debounced; each
    page + search + filter is cached in `aiCallsSlice` (key `aiCallsPageKey`).
  - Call detail: the first-load skeleton now mirrors the page (stats bar, chat bubbles, captured-detail rows, cards)
    instead of three plain blocks (`CallDetailSkeleton`); later visits show the cached call.
  - Files: `components/ai-calling/ai-call-history-table.tsx`, `ai-call-log-detail.tsx`, `call-logs.ts`,
    `store/aiCallsSlice.ts`, `app/(portal)/pro/dashboard/ai-receptionist/calls/page.tsx`.

- **AI Receptionist call history: portal table, cached in the store, buttons on the right** — client.
  - Call history uses `PortalDataTable` (like Estimates): same bordered card, columns Customer name / Call no. / Date &
    time / Summary, row opens the call, eye = "View call history", Delete in the row menu (confirm dialog), server
    paging (20 per page, count shown). The All / Phone / Test filter and the Refresh button are removed (all calls).
  - New `store/aiCallsSlice.ts` (registered as `aiCalls`, cleared on sign-out): pages and call details are cached, so
    going back to the list or reopening a call shows it at once and refreshes in the background (skeleton only the
    first time); delete removes the call from every cached page.
  - Call detail: Estimate / View on schedule / Lead buttons aligned right; data from the slice.
  - Files: `store/aiCallsSlice.ts` (new), `store/index.ts`, `components/ai-calling/ai-call-history-table.tsx`,
    `components/ai-calling/ai-call-log-detail.tsx`, `app/(portal)/pro/dashboard/ai-receptionist/calls/page.tsx`.

- **AI call detail: empty space under the page fixed, "All calls" button removed** — client. The conversation box's
  screen-reader labels (sr-only, absolutely positioned) were laid out along the full transcript outside the scroll box
  (it wasn't positioned), stretching the page; the box is now `relative`. The "All calls" button is commented out
  (header back arrow + sidebar do the same). File: `components/ai-calling/ai-call-log-detail.tsx`.

- **AI Receptionist: Settings / Call history are sidebar sub-items (like Estimate)** — client. The in-page tabs
  (`AiReceptionistTabs`) are commented out of both pages; the sidebar group opens with Settings and Call history
  (most specific link is highlighted, so a call detail page highlights Call history). The calls page header is
  "Call history" again. Files: `lib/data/portal-nav.ts`, `app/(portal)/pro/dashboard/ai-receptionist/page.tsx`,
  `calls/page.tsx`.

- **AI Receptionist: Settings / Call history tabs, call table, new call detail page, "View call" on estimates** — client.
  - Two tabs (`AiReceptionistTabs`): Settings = configuration only (the "Recent calls" card is commented out of
    `ai-calling-settings-panel.tsx`); Call history = a table (`AiCallHistoryTable`): customer name, call number, date &
    time, summary (outcome badge + what the AI did), "View call history" + delete (confirm dialog). The whole row opens
    the call (keyboard too). Filters (All / Phone / Test) and paging kept.
  - Call detail (`ai-call-log-detail.tsx`, rewritten after the reference, no audio player): stats bar (call length,
    details captured, distance, humans needed) + one-line summary; compact scrollable conversation with chips of what
    the AI did; activity log folded under it; right panel with the captured details (✓ each), the "Booked" card
    (time, estimator, visit / estimate) and the route-optimized slot card (miles from the nearest estimate / job on the
    calendar and from the business); links to the estimate, schedule and lead; delete. Old page kept as
    `ai-call-log-detail-legacy.tsx` (unused).
  - Estimate workspace: "View call" next to Scope of work on AI receptionist estimates (`LinkedCallButton`). Older AI
    notes that still end with the call transcript have it left out where they're copied into visit findings / the
    scope (`withoutCallTranscript`).
  - Files: `components/ai-calling/` (ai-receptionist-tabs, ai-call-history-table, ai-call-log-detail,
    ai-call-log-detail-legacy, linked-call-button — new or rewritten; call-logs.ts, index.ts, ai-calling-settings-panel),
    `app/(portal)/pro/dashboard/ai-receptionist/page.tsx`, `calls/page.tsx`, `calls/[id]/page.tsx`,
    `components/portal/estimate-v2/new-estimate-workspace-view.tsx`, `site-visits-panel.tsx`.

- **Schedule month cards show a time** — client. Cards without a booked time showed "DAY". Now: estimates, invoices,
  payments and tasks show their record's time of day (estimate date / site visit, invoice due-or-issued, payment
  paid, task due; local time; date-only values show none). Invoices / payments keep "Due: …" on the right and the
  time goes next to the date. Anything else without a time shows "All day" (was "Day"). Booked items keep
  their range. New optional `atTime` on `PortalCalendarEvent`. Files: `lib/data/portal.ts`, `lib/api/crm-client.ts`,
  `components/portal/views/schedule-view.tsx`, `components/portal/event-calendar.tsx` (old label kept as a comment).
  Backend: the Schedule API is faster (see backend log).

- **Pro Co-pilot launcher is draggable (like the customer RS AI launcher)** — client. It was fixed bottom-right
  and could cover page content (e.g. the estimate's Labour / Material / Equipment buttons). Now drag it anywhere:
  it snaps to the nearest side (left / right) at the height it was dropped and remembers the spot
  (localStorage `rs-pro-copilot-launcher-dock`, per browser; falls back to bottom-right if storage is blocked).
  A drag never opens the panel; a click still does, and Ctrl+J is unchanged. Same logic as
  `components/bot-ai/BotWidget.tsx`. The old fixed button is kept as a comment.
  Files: `components/pro-assistant/pro-assistant-launcher.tsx` (new), `components/pro-assistant/pro-assistant.tsx`.

### 2026-11-13

- **Estimate page loading skeleton: sidebar border matches the loaded page** — client. The left menu skeleton used
  `border-slate-200/70` (almost invisible); it now uses the same `border-[#94a3b8]` + light shadow as
  `ProjectLifecycleNav` and the main cards, and the header divider matches too. Old classes kept in a comment.
  File: `components/portal/estimate-v2/new-estimate-workspace-view.tsx`.

- **Customers list: no page prefetch per row** — client.
  - Each row's customer-name `<Link>` prefetched that customer's file in production: the `<id>?_rsc` requests,
    two per row. The link now has `prefetch={false}`.
  - The shared `PortalDataTable` prefetches a row's page on hover (`router.prefetch`), so opening a customer stays
    fast. This applies to every list built on that table.
  - Checks: tsc + eslint clean. Chrome with mocked APIs, 6/6: list renders, links kept, a row opens the customer
    file, detail renders.
  - Files: `components/portal/views/customers-view.tsx`, `components/portal/portal-data-table.tsx`.

- **Pipeline page: no prefetch per card, no double board load** — client.
  - Each card's `<Link>` prefetched its record page as it scrolled into view: about 12 `<id>?_rsc` requests on
    open, more while scrolling (production only). Cards now use `prefetch={false}` and prefetch on hover / focus /
    touch (`router.prefetch`), so opening a card stays fast. The same applies to the card menu's "Open" link.
  - The board reloaded on the first socket connect right after the initial load (a second board download).
    A reconnect within 5 s of a load is now skipped; real reconnects and stale-tab refreshes are unchanged.
  - Checks: tsc + eslint clean. Chrome with mocked APIs, 5/5: board renders, 1 board request on open, card links
    open. In that test the socket was blocked, so the reconnect skip was checked by reading the code.
  - Files: `components/portal/pipeline/pipeline-board.tsx`, `components/portal/pipeline/use-pipeline-board.ts`.

- **Pro dashboard: no duplicate / repeated API calls; Messages paged 10 at a time** — client.
  - Dashboard "Recent messages": one request for 10 threads (`limit=10&sort=unread`) instead of 100 full threads.
    Before, it was fetched again on every dashboard refresh, and the whole dashboard was refetched on every chat
    message. Chat socket events now update the rows in place; only a new conversation reloads the 10. Lead events
    still refresh the dashboard, coalesced. The old effects are kept as a comment.
  - Notification bell: loads once, then follows the socket. It no longer refetches:
    - on opening, while the socket is connected;
    - on the first connect right after the initial load;
    - when the tab becomes visible, while the socket is connected.
    A real reconnect still re-syncs once.
  - Live team map: a location ping from a worker the map doesn't have reloaded the whole map every time; now once,
    then a 2-minute cooldown for that worker. Switching tabs reloads only after 30 s away.
  - Messages page:
    - 10 conversations per page, unread first; more load on scroll, or with a "Load more conversations" button.
    - Search (debounced) and the All / Unread / Leads tabs run on the server.
    - Tab totals come from the server and cover every page.
    - A `?thread=` link to an older conversation fetches just that thread.
    - Removed the duplicate first request (commented out).
  - Lead detail → Messages tab: loads only that lead's thread (by request or customer email), not every thread.
  - Checks:
    - tsc clean. The remaining eslint errors in these files are in older code and appear without these changes too.
    - Chrome with mocked APIs, 18/18:
      - dashboard requests 10 chats, never 100; 1 notifications call; 0 requests while idle for 8 s;
      - Messages loads 10 → 20 → 25; tab totals 25 / 3 / 10;
      - one debounced search request;
      - an older-thread link opens that thread.
  - Files: `lib/api/chat-client.ts`, `components/portal/use-chat-threads.ts`,
    `components/portal/views/{dashboard-view,messages-view,request-detail-view}.tsx`,
    `components/notifications/notification-bell.tsx`, `components/tracking/use-live-workers.ts`.

- **Premium badge hidden on the customer side** — client request. Display only: Premium Pros still rank first in
  every listing, and the API still returns `isPremium` / `premium`. The badge is commented out (not deleted) on all three
  `ProviderCard` layouts (cover-image corner, title, list row) and the public profile header. The Pro portal (dashboard
  shortcut, Business Profile, Premium card) still shows it.
  - Files: `components/shared/provider-card.tsx`, `components/marketplace/provider-profile.tsx`.

### 2026-11-12

- **Pro co-pilot estimate card: proper customer list + Create-estimate fields** — client. Files in
  `components/pro-assistant/` only.
  - The customer picker shows the same customers as the Customers tab (no hidden visitor records), 20 at a time.
    Scrolling to the bottom loads the next page; typing searches; a footer shows "20 of 45 customers".
  - New fields, same as the portal's Create estimate (same helpers: the Pro's categories via
    `getServiceCategoryById`, sub-services via the estimate template catalog):
    - **Property**: the customer's service addresses.
    - **Service category**: required; only the Pro's own categories; preselected from the AI's reading of the scope.
    - **Sub-service**: optional.
    - **Line item type**: labor / material / equipment, editable.
  - The Create button names what's missing (customer, address, category, line item, title). The create request sends
    the property, category and sub-service.
  - Checks: tsc + eslint clean. Chrome with mocked APIs, 42/42 (adds: 20 → scroll → 40, search, 2 properties,
    category preselected and limited to the Pro's own, sub-service, create body).
  - Files: `components/pro-assistant/estimate-draft-card.tsx`, `pro-assistant-api.ts`.

- **Premium: cancel ends Premium immediately; no Resume** — client feedback.
  - Premium card: Resume auto-renew button and dialog removed (commented). The cancel modal now says the badge and top
    placement are removed right away, with the warning "No refund will be issued, and your Premium features end
    immediately. You can upgrade again any time."
    - This replaces the earlier client wording "…retain your Premium features until the end of your current billing
      period", which no longer matches the behaviour.
  - Cancel toast and the upgrade dialog text updated. The header pill shows "Active" (or "Complimentary") only while
    Premium.
  - After cancelling: the card goes back to Upgrade, the badge leaves the company name, and the dashboard shows the
    upgrade card instead of "Your business is Premium".
  - Checks: tsc + eslint clean; Chrome with mocked APIs, 40/40 (adds the after-cancel checks).
  - Files: `components/portal/premium-profile-card.tsx`.

- **Pro co-pilot: voice auto-send, auto-close after navigation, conversation history** — client. Files in
  `components/pro-assistant/` only.
  - Voice: when speech recognition ends, what was heard is sent automatically (no Send click).
  - After a page or record opens (reply navigation, picking from a list, creating an estimate), the co-pilot closes so
    the page is fully visible. The chat is kept, and reopening shows it.
  - History: a header History button opens the saved-conversation list (search, newest first, time + message count +
    preview). Open one to continue it, rename inline, delete with a confirm step, or start New. Deleting the open
    chat starts a fresh one.
  - The current conversation id is kept for this tab; messages and estimate creation send it, so drafts reopen as
    "created".
  - Checks: tsc + eslint clean. Chrome with mocked APIs and a mocked login, 34/34. Covered: auto-close after
    navigation / invoice / pick / estimate, conversationId sent, the voice command sent automatically and navigated,
    history list / rename / open / delete, Expand / Restore, phone.
  - Files: `components/pro-assistant/history-panel.tsx` (new), `pro-assistant.tsx`, `pro-assistant-input.tsx`,
    `estimate-draft-card.tsx`, `use-pro-assistant-socket.ts`, `pro-assistant-api.ts`.

- **Pro Co-pilot — operations assistant in the Pro portal (new folder `components/pro-assistant/`)** — client.
  - Separate from the customer bot (`components/bot-ai` untouched). One existing file changed: `portal-shell.tsx`
    renders `<ProAssistant />` (+ import). Shown to Pros only.
  - Launcher "Pro Co-pilot" bottom-right (Ctrl/⌘+J toggles). The panel uses the same look as the customer assistant:
    floating bottom-right, Expand / Restore to a large centred window (animated), full screen on phones, Esc closes.
  - Talks to the backend socket namespace `/pro-assistant` with the Pro's token (socket.io-client, same as the
    existing bot) and streams replies. Falls back to REST if the socket isn't connected.
  - Replies:
    - Opens pages and records automatically (expanded view shrinks so the page is visible), with a chip to reopen.
    - Several matches → a pick list.
    - Estimate drafts → an editable card: title, customer search, line items with qty × unit price = total, add /
      remove lines, notes, live total. "Create estimate" creates it and opens the new estimate.
  - Voice-to-text mic (browser speech recognition); Enter sends, Shift+Enter = new line.
  - The conversation is kept across pages and reloads in this tab (sessionStorage); "New conversation" clears it.
  - Only `/pro/dashboard/...` links are followed from replies.
  - Styles live in `components/pro-assistant/pro-assistant.css` (not globals.css).
  - Checks: tsc + eslint clean. Chrome with all APIs mocked and a mocked login, 21/21: launcher, Ctrl+J,
    time-tracking navigation, invoice INV-874, the choice list, estimate card → customer pick → price edit
    ($160) → Create (correct body) → opens the estimate, Expand / Restore, the conversation kept, phone full screen,
    no page errors.
  - Files (new): `components/pro-assistant/{pro-assistant.tsx,pro-assistant-input.tsx,estimate-draft-card.tsx,
    use-pro-assistant-socket.ts,pro-assistant-api.ts,pro-assistant.css}`; changed: `components/portal/portal-shell.tsx`.

- **AI assistant: Maximize / Restore button** — client (frontend only; no backend or AI logic touched).
  - New header button between History and Minimize: "Expand chat" (Maximize2 icon) / "Restore to small window"
    (Minimize2 icon, shown as pressed).
  - Expanded on 640px+: a large centred window (up to 64rem × 52rem, 2rem from the screen edges) with the page dimmed
    a little more. Width, height and position animate smoothly (420 ms ease-out) both ways; off for reduced motion.
  - Default unchanged: every open starts as the usual bottom-right floating widget. Minimize / close / Esc / outside
    click reset it.
  - Phones are already full screen, so the button is hidden below 640px.
  - The assistant is mounted once (marketing shell), so this covers customers and Pros alike.
  - Sizing moved from Tailwind classes to `.bot-panel` in `app/globals.css` (same 26.5rem × min(44rem, 100dvh − 2.5rem)
    at 1.25rem from the corner) so it can animate.
  - Checks: tsc + eslint clean. Chrome, 9/9: default 424px at 20px / 20px; expands to 1024px, centred, animated
    (width mid-transition 759px); Restore and reopen go back to the widget; phone full screen with the button hidden;
    no page errors.
  - Files: `components/bot-ai/BotHeader.tsx`, `components/bot-ai/BotModal.tsx`, `app/globals.css`.

- **Pro dashboard: animated "Upgrade to Premium" button** — client.
  - A soft gold shine sweeps across the button every 3.2s and the crown (now gold-filled) gives a small wiggle; both
    are faster on hover. Off for prefers-reduced-motion.
  - CSS only: `.premium-cta` / `.premium-cta-crown` with keyframes `premium-shine` / `premium-crown` in
    `app/globals.css`. Layout is unchanged.
  - Checks: eslint clean; Chrome with mocked APIs 39/39 (adds a check that both animations run).
  - Files: `app/globals.css`, `components/portal/premium-profile-card.tsx`.

- **Pro dashboard Premium shortcut: compact, light card** — client feedback ("too big, dark colour").
  - Replaced the large navy banner with a one-row white card in the dashboard card style: thin gold left accent, a small
    crown chip, the title "Be the first Pro customers see in your area" with a price pill, one short line, and an outline
    "Upgrade to Premium" button.
  - About 60px tall on desktop (was ~170px).
  - The Premium status strip uses the same white style ("Your business is Premium", Complimentary/Active, Manage Premium).
  - Checks: tsc + eslint clean; Chrome with mocked APIs 38/38.
  - Files: `components/portal/premium-profile-card.tsx`.

- **Premium: dashboard shortcut, selling line, exact cancel warning, complimentary Premium** — client.
  - Pro dashboard: new `PremiumDashboardShortcut` under the action alerts.
    - Not Premium: a navy / gold promo ("Get to the top of local searches — before every standard listing.") with the
      price and an "Upgrade to Premium" link to `/pro/dashboard/settings#premium`.
    - Premium: a gold status strip ("Your business is Premium", renews / ends date, Manage Premium).
    - Hidden while loading or when the admin has Premium switched off.
  - Premium card: the "Be the first business customers see" selling line for Pros who haven't upgraded, plus an
    `id="premium"` anchor.
  - Cancel modal shows the client's exact warning: "No refund will be issued, and you will retain your Premium
    features until the end of your current billing period."
  - Complimentary Premium (given by an admin): "Complimentary" badge, a note that nothing is charged, no cancel / resume
    buttons, and history rows "Given free · Free".
  - Checks: tsc clean; eslint clean on the changed files. Chrome with all APIs mocked, 38/38 (adds the dashboard promo
    and status, the exact cancel text and the complimentary state).
  - Files: `components/portal/premium-profile-card.tsx`, `components/portal/views/dashboard-view.tsx`,
    `store/providerPremiumSlice.ts`.

- **Premium Business Profile (Pro upgrade + badges)** — client.
  - Business Profile (/pro/dashboard/settings): a new `PremiumProfileCard` sits above the wallet card. It shows:
    - the admin price per period, benefits, the wallet balance, and an "Upgrade to Premium" confirm dialog (price,
      balance before and after; API errors shown inline; disabled with a note when the wallet can't cover it);
    - once Premium: active-until date, auto-renew, paid so far, and Cancel (optional reason; kept until the period
      ends) or Resume auto-renew;
    - the last 5 Premium payments.
  - A Premium badge sits next to the company name.
  - Wallet card: new money-out row "Premium Business Profile". The wallet refetches fresh after any Premium action.
  - Customer side: `PremiumBadge` (`components/shared/premium-badge.tsx`) on all three `ProviderCard` layouts (on the
    photo for photo cards) and beside the name on the public profile. Pros arrive premium-first from the API; the order
    is kept.
  - Data: `PublicProfessional` / `Provider` add `isPremium` + `premiumExpiresAt` (mapped from `isPremium` /
    `premium.expiresAt`). New `store/providerPremiumSlice.ts` and `providerCrmApi.premium*` routes; the wallet slice
    adds `premiumFees` / `platformFees`.
  - Checks: tsc clean; eslint clean on the changed files apart from the existing `provider-profile.tsx:91` errors.
    Chrome with all APIs mocked, 29/29: badges, premium-first order, the upgrade error and success paths, cancel with
    reason, resume, low balance, phone width. The Pro session came from the login form against a mocked API; .env was
    not read.
  - Files: `components/portal/premium-profile-card.tsx` (new), `components/shared/premium-badge.tsx` (new),
    `store/providerPremiumSlice.ts` (new), `store/index.ts`, `store/providerWalletSlice.ts`,
    `store/publicProfessionalsSlice.ts`, `lib/types/index.ts`, `components/api/ApiRoutesFile.ts`,
    `components/portal/views/business-profile-detail-view.tsx`, `components/portal/wallet-balance-card.tsx`,
    `components/shared/provider-card.tsx`, `components/marketplace/provider-profile.tsx`,
    `components/marketplace/public-professional-detail.tsx`.

- **Invoices show "Awaiting confirmation", not "Paid", until the Pro confirms; review card on the invoice page** — client.
  - New `components/portal/payment-review.tsx`:
    - `invoiceDisplayStatus()`: "Awaiting confirmation" (amber) while an invoice has unconfirmed customer-entered money.
    - `PaymentReviewCard`: an amber card with Confirm received / Not received per pending payment. Each action asks first, then refreshes payments, invoices and the wallet.
  - The correct status now shows on the invoices board column, the invoice page header and summary (3 spots in `invoice-file.tsx`), and the payment page's "Invoice status".
  - The invoice page shows the review card; the payment page uses the same card (replaces the inline copy).
  - Files: `components/portal/payment-review.tsx` (new), `components/portal/views/record-detail-views.tsx`, `components/portal/invoice-columns.tsx`, `components/portal/invoice-file.tsx`, `components/portal/payment-file.tsx`, `lib/types/index.ts`, `lib/api/crm-mappers.ts`.

- **Payment review: buttons only in the card; both actions ask first** — client feedback.
  - Removed the duplicate Confirm received / Not received buttons from the payment page header; they stay in the amber card.
  - Both actions open a confirmation dialog: Confirm received in green / primary, Not received in red. The Payments board row menu asks first too.
  - `DeleteConfirmDialog` gets an optional `tone="primary"` (green icon, primary button). The default red delete style is unchanged everywhere else.
  - Files: `components/portal/delete-confirm-dialog.tsx`, `components/portal/views/record-detail-views.tsx`, `components/portal/views/records-view.tsx`.

- **Payment page: Confirm received / Not received buttons; wallet card without minus signs** — client feedback.
  - The confirm actions were only in the Payments board row menu, so the client couldn't find them.
  - Payment page, while a customer-entered payment is pending:
    - an "Awaiting confirmation" pill replaces "Succeeded";
    - **Confirm received** and **Not received** buttons sit in the header (Not received asks first);
    - an amber banner on Summary explains it and repeats the buttons;
    - the body shows the status as Pending.
  - Payments board: pending rows show a **Review** button next to "Awaiting confirmation" that opens the payment.
  - Wallet card: "− $0.02" read like negative money. The rows now sit under **Money in** / **Money out**
    with no minus signs, and the last line reads "Wallet balance (money in − money out)".
  - Files: `components/portal/views/record-detail-views.tsx`, `components/portal/payment-columns.tsx`,
    `components/portal/wallet-balance-card.tsx`.

- **Payments board: confirm customer-entered payments; wallet shows what's awaiting confirmation** — client.
  - The Status column shows "Awaiting confirmation" for customer-entered payments not yet reviewed.
  - Row actions:
    - **Confirm received**: the payment is added to the wallet balance.
    - **Not received**: asks first, then takes the payment off the invoice so the balance is due again.
    - Both use `reviewPaymentThunk` → `PATCH provider/payments/:id/review`, then refresh payments,
      invoices and the wallet.
  - Wallet card: an amber note "$X from N customer-entered payments awaiting your confirmation — not in the
    balance yet" with a link to Payments.
  - `Payment.confirmationStatus`: the mapper treats customer entries with no review as pending.
  - Checked: tsc clean; lint shows only the existing `records-view.tsx:248` error. Not checked in a browser.
  - Files: `lib/types/index.ts`, `lib/api/crm-mappers.ts`, `lib/api/crm-client.ts`, `components/api/ApiRoutesFile.ts`,
    `store/paymentsSlice.ts`, `store/providerWalletSlice.ts`, `components/portal/payment-columns.tsx`,
    `components/portal/views/records-view.tsx`, `components/portal/wallet-balance-card.tsx`.

- **Wallet balance on Business Profile; payouts blocked above it; Mark paid records a payment** — client.
  - New read-only **Current wallet balance** card (`components/portal/wallet-balance-card.tsx`) at the top
    of the Business Profile's right column. It shows the balance, Collected from customers, Paid to
    technicians, Paid to contractors and Expenses. There's no input, and it carries a "Read-only" chip.
    The data comes from the new `store/providerWalletSlice.ts` (`GET provider/wallet`, forced refresh on
    mount).
  - Pay contractor (`job-crew.tsx`) and Pay technician (`timesheet-ui.tsx`) dialogs show the wallet
    balance. An amount above it shows "Insufficient balance to complete this payout. Wallet balance: $X."
    and disables Record payment. The API enforces the same rule, and the wallet refreshes after a payout.
  - Invoices list "Mark paid" now opens Record payment, pre-filled with the balance. The API no longer
    marks an invoice paid without a payment record.
  - Checked: tsc clean; lint shows only the existing `records-view.tsx:246` error. Not checked in a
    browser (a signed-in session would need the key from `.env`).
  - Files: `store/providerWalletSlice.ts` (new), `components/portal/wallet-balance-card.tsx` (new),
    `store/index.ts`, `components/api/ApiRoutesFile.ts`, `components/portal/views/business-profile-detail-view.tsx`,
    `components/portal/job-crew.tsx`, `components/time-tracking/timesheet-ui.tsx`, `components/portal/views/records-view.tsx`.

- **Performance follow-up: own-pro cover on the service detail page kept; parity verified** — client: no regressions.
  - `public-fixed-service-detail.tsx`: the cover lookup is restored for this package's own pro only. Its cover is the
    package photo; with no photo, the old code fell back to the pro's banner from their profile, which the
    package API doesn't send. Related pros still make no lookups.
  - Parity: the new backend list code was compared with the running old API on live data, read-only.
    33 requests (16 professionals, 17 fixed services; filters, sorts, pages, location, category, provider) and
    217 rows were all identical field by field. For every pro, the list and related banners match the profile
    banner, so the removed lookups never changed anything shown.
  - Files: `components/marketplace/public-fixed-service-detail.tsx`.

- **Customer side loads faster (home Pros list, Services page, pro / service detail)** — client: performance.
  - The Pros list no longer waits on browser location detection. That wait covered the permission prompt,
    up to 8 s, then a reverse geocode; if the prompt was ignored the skeleton never cleared. While
    detecting, it now loads all areas after `LOCATION_WAIT_MS` (1.2 s), and the local list replaces it
    when the location arrives. Same on the Services page. Old early-returns kept as comments.
  - Removed a client N+1: `attachMissingGalleries` fetched the full profile of every pro without a
    banner (up to 10 extra requests per page) and the list waited for them. The list API already returns
    `businessGallery` from the same data, so those calls never found a banner. The same applies to
    `hydrateProviderCardCovers` on the pro and service detail pages (related pros). Calls are commented
    out; the functions are kept.
  - Both public list slices: newest search wins (`latestRequestId`; an older response that lands later is
    dropped), and the in-flight key is the resolved one (`getPendingMeta`). The pros slice used to drop a
    new search while one was loading, which would have lost the local search above.
  - Measured with a mocked API and an ignored location prompt: before, the Pros section never loaded;
    after, cards show at about 2.8 s from navigation (dev server), with 0 profile requests. When the
    location arrives later, the local list replaces the all-areas list.
  - Files: `store/publicProfessionalsSlice.ts`, `store/publicFixedServicesSlice.ts`, `store/locationSlice.ts`,
    `components/home/featured-providers-section.tsx`, `components/marketplace/services-directory.tsx`,
    `components/marketplace/public-professional-detail.tsx`, `components/marketplace/public-fixed-service-detail.tsx`.

- **Services directory: "Clear all" also removes the location chip** — client.
  - Clear all now runs `resetFilters()` and `dispatch(clearLocation())`. The sidebar Reset and the empty
    state's "Reset filters" are unchanged (location kept). Pre-existing lint errors at lines 795 / 798
    (refs during render) left as they were.
  - Files: `components/marketplace/services-directory.tsx`.

- **Status bar tinted for every status, buttons moved into it; Site visits closed by default with a View visits toggle** — client.
  - `ApprovalStatus`: every status now gets the tinted style of the green bar (was a plain white box for
    drafts / leads). Green accepted / converted / won, blue sent, amber changes requested, red declined /
    expired / lost, indigo lead stages (new, assessment scheduled / completed), grey draft. Always a second
    line saying what's next (e.g. "A site visit is booked. Complete it, then build the estimate.").
    New `actions` slot on the right.
  - Assign contractor / Assign technician / Print / PDF moved from a loose row into that slot (old row
    commented out). Shown on Summary whenever the estimate card has no header of its own.
  - Site visits / Existing information start closed every time the page loads (was open when a prep path was
    chosen and there was no estimate; choosing a path still opens it).
  - Site visits header matches "Customer quote answers": icon, "Site visits · N visits", a one-line summary of
    the latest / open visit, and **View visits ⌄** on the right (**Hide visits ⌃** when open; the Collapse
    button and the left arrow are gone). View / Build estimate stays next to it when closed.
  - Chrome check with mocks: lead with a scheduled visit → indigo bar with the 3 buttons, Site visits closed,
    opens with the toggle; converted / sent / draft bars as expected.
  - Files: `components/portal/estimate-v2/project-panels.tsx`, `components/portal/estimate-v2/new-estimate-workspace-view.tsx`,
    `components/portal/estimate-v2/site-visits-panel.tsx`.

- **Estimate status always in the top banner, never in the sidebar header** — client.
  - `ApprovalStatus` now always renders (was only for accepted / signed estimates). Title = the estimate's
    status ("Sent to customer", "Draft", …), or the lead's status before there is an estimate ("Assessment
    scheduled", …). Tone by status: green accepted / converted, blue sent, amber changes requested, red
    declined / expired, neutral otherwise. One-line note on what's next; signatures, job / customer /
    company links only when that data exists. New optional `opportunity` prop.
  - Sidebar header: status pill removed (`SHOW_SIDEBAR_STATUS = false`, code kept); only the AI tag can show.
  - Chrome check with mocks: converted → green banner as before; draft → "Draft · Not sent to the customer
    yet."; sent → blue "Sent to customer · Waiting for the customer to review and sign."; sidebar header =
    number + title only.
  - Files: `components/portal/estimate-v2/project-panels.tsx`, `components/portal/estimate-v2/new-estimate-workspace-view.tsx`.

- **Photos & files tab always listed; Request progress removed from Work request; Budget tab hidden** — client.
  - Sidebar "Project files" → **Photos & files**, always shown (was only when files existed). The panel has
    the same name and an empty state explaining where files come from (customer request, Existing
    information, site visits, job). No count badge.
  - Work request: "Request progress" timeline removed (it repeated the status banner and Job tab); the
    photos block is titled "Photos & files from the customer" with an "All project photos & files →" link to
    the tab. `estimate` / `job` props on `RequestPanel` removed again; `onOpenFiles` added.
  - Budget sidebar item commented out (not deleted) so it can come back; `BudgetPanel` unchanged; the
    unused Wallet icon import removed (noted in the comment).
  - Chrome check with mocks. Files: `components/portal/estimate-v2/project-lifecycle-nav.tsx`,
    `components/portal/estimate-v2/project-panels.tsx`.

- **Work request card: no empty left column** — client.
  - Under Customer's request (and Quote questions when there are any) the card now shows **Request progress**
    (Request received → Estimate created → Sent to the customer → Accepted / Declined → Converted to job, each
    with its date / number, ticked when done), then **Photos & files** and **Internal notes** (moved inside the
    card from the separate cards below; each has a short note when empty).
  - `RequestPanel` now also gets `estimate` and `job`. Chrome check with mocks, desktop + phone width.
  - Files: `components/portal/estimate-v2/project-panels.tsx`.

- **Work request tab redesigned as one record card** — client ("not good, make it professional").
  - Header: "Work request" + status pill, title, "Category › Service", and Open lead / Customer profile on
    the right. Body in two columns: left = the customer's request (quoted) and the quote questions they
    answered (moved in from a separate card); right = Details (Reference, Received, Source, Service),
    Customer (initials avatar, tap-to-call phone, mailto email) and Service address with a View on map button.
    Photos & files and Internal notes stay as cards below. Stacks on phones (no sideways scroll).
  - "Request number" relabelled "Reference": it shows the estimate's own number (Est-…), not a lead number.
  - New small helpers `DetailRow` / `RequestHeading`; `Fact` kept for the commented-out grids. Unused icon
    imports removed.
  - Chrome check with mocks, desktop + 390px. Files: `components/portal/estimate-v2/project-panels.tsx`.

- **Sidebar group "Changes" renamed "Change management"** — client (wanted a professional CRM label).
  - Same items (Change requests, Scope changes). Chrome check: menu shows CHANGE MANAGEMENT.
  - Files: `components/portal/estimate-v2/project-lifecycle-nav.tsx`.

- **Estimate sidebar: own "Changes" group; "Change orders" renamed "Scope changes"** — client.
  - Change requests and Scope changes moved out of Production into a new "Changes" group (after Production,
    before Project). "Change orders" label → "Scope changes" (client's pick); section id unchanged.
  - Estimate-page wording updated to match (Change requests description, note on the Scope changes section).
    The shared job-page panel heading ("Change orders & scope changes") is unchanged.
  - Chrome check with mocks: menu shows PRODUCTION (Job, Schedule, Invoices, Budget) then CHANGES
    (Change requests 1, Scope changes).
  - Files: `components/portal/estimate-v2/project-lifecycle-nav.tsx`, `components/portal/estimate-v2/project-panels.tsx`.

- **Estimate sidebar: live blinking Change requests badge, actionable-only badges, Change requests vs Change orders labels** — client.
  - Change requests badge = requests still waiting for review only (was "N new" or the total), blue. It
    blinks while some arrived after the section was last opened; opening Change requests stops the blink,
    approve / decline lowers the count (it goes when none are left). Live from the existing socket chain
    (`contractor:requests` → `CONTRACTOR_REQUESTS_CHANGED` → `contractorReviews.version` → recount).
    "Seen" is kept per job in this browser (`rs-seen-requests:<jobId>`, try/catch) and only updated once the
    counts have loaded (new `jobRequestsLoaded` on `useProjectData`).
  - Badges only for actionable items: Change orders "N pending" (draft / waiting for customer), Invoices
    "1 due" (estimate invoice with a balance), Change requests count. Removed static counts on Parts &
    Labour, Selections, Schedule, Project files, Activity and the "Signed" tag on Preview (now a tooltip).
    Job keeps its job number.
  - Change requests listed above Change orders with tooltips; the requests table on the estimate page is
    titled "Change requests" with a line saying approving creates a change order (new optional `title` /
    `description` on `JobRequestsTab`; job page unchanged). The Change orders section has a note linking
    to Change requests.
  - Chrome check with mocks: load → "1" blue blinking; open → not blinking; reload → still not blinking;
    simulated socket push with 2 pending → "2" blinking; other badges gone.
  - Files: `components/portal/estimate-v2/project-lifecycle-nav.tsx`, `components/portal/estimate-v2/new-estimate-workspace-view.tsx`,
    `components/portal/estimate-v2/project-panels.tsx`, `components/portal/job-requests-tab.tsx`.

- **Job tab table: back to columns, clearer column labels** — client (wanted only the labels changed, not the table).
  - Reverted the one-row-per-detail version below (file restored to the side-by-side `PortalDataTable`).
  - Column labels: Start date, Due date, Assigned crew, Job total, Invoice status, Job address
    (were Scheduled, Due, Crew, Job value, Invoice, Job site). Values unchanged.
  - Chrome check with mocks. Files: `components/portal/estimate-v2/project-panels.tsx`.

- **(Reverted) Job tab details: one row per detail (label left, value right)** — client ("different label, easy to confirm").
  - Six columns side by side didn't fit and the table scrolled sideways (Job site cut off). Same
    `PortalDataTable`, now "Detail | Value" with a row each for Scheduled, Due, Crew, Job value, Invoice and
    Job site (icon + label on the left). Export gives the same label / value pairs. Count reads "6 Job details".
  - Chrome check with mocks, no sideways scroll. Files: `components/portal/estimate-v2/project-panels.tsx`.

- **Job tab facts use the project's table (`PortalDataTable`)** — client ("table that we have in our project").
  - Scheduled / Due / Crew / Job value / Invoice / Job site are columns of `PortalDataTable` (same component
    as Invoices and Change requests), one row for the job: count + Export on top, the usual footer below.
    Replaces the hand-made table from 2026-11-11. Unused icon imports removed.
  - Chrome check with mocks. Files: `components/portal/estimate-v2/project-panels.tsx`.

### 2026-11-11

- **Job tab: Scheduled / Due / Crew / Job value / Invoice / Job site as a table** — client.
  - The grid of boxes under the step tracker is now a bordered table: one grey header row (icon + label,
    same style as the app's tables) and one row of values. Scrolls sideways on narrow screens. Header,
    tracker, Review bar and Latest activity unchanged. Old grid kept commented out.
  - Chrome check with mocks. Files: `components/portal/estimate-v2/project-panels.tsx`.

- **Estimate header: "Notes & updates" button** — client.
  - Outline button with the notes icon next to Open job / Open invoice / More (any saved estimate).
    Click scrolls down to the Notes & updates card on Summary (same `openView(NOTES_VIEW)` as the sidebar item).
  - Chrome check: button shown, click scrolls the card into view.
  - Files: `components/portal/estimate-v2/new-estimate-workspace-view.tsx`.

- **Set schedule: outline button with blue border, only the clock icon blinks** — client.
  - Was a filled blue button that blinked as a whole. Now `variant="outline"` with `border-primary
    text-primary` while unscheduled, and `animate-pulse` on the `Clock3` icon only.
  - Chrome check: button animation none, icon "pulse", border / text rgb(0,63,125), white background.
  - Files: `components/portal/estimate-v2/project-stages.tsx`.

- **Status banner links animate continuously** — client ("animated").
  - Job / customer / company links: the ↗ arrow nudges up-right on a 1.6s loop and a faint underline
    breathes (35% → 100% → 35%, 2.4s). Hover / focus stops the loop and shows the full underline with the
    arrow raised. Keyframes `banner-link-nudge` / `banner-link-underline` and classes `.rs-banner-link`,
    `.rs-banner-link-arrow` added to `app/globals.css`; `BannerLink` uses them.
  - Chrome check: all three links run both animations; hover → underline 100%, arrow translate(2px,-2px).
  - Files: `app/globals.css`, `components/portal/estimate-v2/project-panels.tsx`.

- **Status banner: job, customer and company open their pages (animated); Set schedule blinks on every estimate; sidebar header aligned** — client.
  - New `BannerLink` in `ApprovalStatus`: blue, underline slides in on hover, arrow nudges up-right.
    JOB-… → `/pro/dashboard/jobs/:id`, customer name → `/pro/dashboard/customers/:customerId`,
    company signer → Business Profile (`/pro/dashboard/settings`).
  - Set schedule: blinks whenever the section has no schedule (`attention` now defaults on; was off for
    signed estimates) and uses plain `animate-pulse` (was `motion-safe:`, which hid it when Windows
    animation effects are off). Chrome check with reduced motion on: animation "pulse", blue fill.
  - Sidebar header: the empty badge row (signed estimates) no longer pushes the title up; title and back
    button are centred (`hasIdentityBadge`).
  - Files: `components/portal/estimate-v2/project-panels.tsx`, `components/portal/estimate-v2/project-stages.tsx`,
    `components/portal/estimate-v2/new-estimate-workspace-view.tsx`.

- **Estimate page: Set schedule (blinking, required to send), Notes & updates shortcut, no Optional column, job link, sidebar border** — client.
  - Section "Set time" button (stage time) is now **Set schedule**: blue + `motion-safe:animate-pulse`
    while the section has no time (only on editable estimates, new `attention` prop), **Change schedule · 2d**
    once saved. `sendNow` refuses while any section with line items has no schedule (toast names the
    sections and scrolls to the sheet); an unsaved estimate is told to build first. Sections without
    filled lines don't count.
  - Sidebar Details: **Notes & updates** (when the estimate exists). Opens Summary and scrolls to the
    Notes & updates card (`openView`, `notesSectionRef`); not a page of its own.
  - Line items: the Optional toggle column is gone (header / cell commented out, `colSpan` adjusted). Each
    row has a small "Mark optional" / "Include in total" link under the description (next to Add image),
    plus an "Optional · not in total" chip on optional rows. Selections / totals unchanged.
  - "Converted to job · JOB-…" under the estimate title is a bold blue link to the job; the banner's
    "Converted to job JOB-…" also links to it.
  - Project sidebar card border `#94a3b8` + the same light shadow as the main estimate card.
  - Chrome check with mocks: no Optional column / switches, chip shows, job links go to the job, Notes &
    updates in the menu and scrolls, nav border rgb(148,163,184). Blinking / send block not checked live
    (test estimate is signed).
  - Files: `components/portal/estimate-v2/project-stages.tsx`, `components/portal/estimate-v2/new-estimate-workspace-view.tsx`,
    `components/portal/estimate-v2/project-panels.tsx`, `components/portal/estimate-v2/project-lifecycle-nav.tsx`,
    `components/portal/line-items-editor.tsx`.

- **Estimate page Change orders tab = the job's full Change Orders tab** — client.
  - Was a short list (number, title, status, amount). Now renders the job page's `JobChangeOrdersPanel`
    inside the page card: Original / Approved / Pending / Rejected tiles, each change order card with its
    type (customer change order / internal scope update), status, who requested it, its lines, amount and
    "Not billed" / Create invoice, plus "Create change order". Same props and lock rule as the job page
    (no new change orders once the job is completed or invoiced).
  - New `replaceJob` on `useProjectData` so a created / approved change order shows at once (no reload).
    The old `ChangeOrdersPanel` list is kept, unused.
  - Checked in Chrome with mocks. Files: `components/portal/estimate-v2/project-panels.tsx`.

- **Site visit: black bold section titles, Reschedule hint on the Date / time label row** — client.
  - Photos, Measurements, Work items and Visit schedule history titles: `text-xs font-bold text-slate-900`
    uppercase (were 11px `slate-500` semibold). Work items title is in the shared `WorkItemsEditor`, so the
    Existing information panel matches.
  - "Use Reschedule to change time…" moved from under the date / time fields to the right of the
    "Date / time" label (wraps under it on narrow screens), removing the extra row.
  - Measurement field labels (What are you measuring? / Value / Unit) `slate-700` instead of grey; the other
    field labels already use the standard dark text.
  - Files: `components/portal/estimate-v2/site-visits-panel.tsx`, `components/portal/estimate-v2/work-items-editor.tsx`.

- **Dropdowns no longer open when their label is clicked (app-wide) + softer grey hints on site visits** — client.
  - Clicking a `<label>` makes the browser send a click to its field. Radix Select treats that click as
    a touch tap and opened; `PaginatedEntitySelect` opened on any click. Both now open only on a press
    on the field itself (pointer, touch or Enter / Space); a label click just focuses the field.
    `SelectTrigger` does this with a `pressedRef` + `preventDefault` (skips Radix's click handler), so
    every Select in the app gets it. Chrome check: label click → closed and focused; mouse click,
    Enter and touch tap → open.
  - Site visit: the Work items hint, Measurements hint, "Save or complete the visit…" note and the
    Visit schedule history lines use the muted `slate-400` (same as the "Use Reschedule…" note);
    history action words `slate-600` instead of near-black. Section titles were already one style
    (11px uppercase `slate-500` semibold), unchanged.
  - Files: `components/ui/select.tsx`, `components/portal/paginated-entity-select.tsx`,
    `components/portal/estimate-v2/work-items-editor.tsx`, `components/portal/estimate-v2/site-visits-panel.tsx`.

- **Searchable pickers (technician / contractor): menu now lines up with the field, like Select** — client.
  - `PaginatedEntitySelect` put the caller's `className` (border, padding, background) on its outer
    wrapper, not the field. That drew a second box around the field, and the menu, sized from the
    wrapper, came out ~16px wider on each side (seen in the site-visit dialogs).
  - `className` now goes on the field (button / search input), as `SelectTrigger` does; the wrapper is
    plain `relative w-full`. Applies everywhere the picker is used.
  - Files: `components/portal/paginated-entity-select.tsx`.

- **Change requests table: no reload / spinner when the request dialog is closed** — client.
  - Closing the review dialog always bumped a local `reload` counter, so the table refetched and
    showed its loading overlay even when nothing was decided.
  - The table now reads its rows from the existing `contractorReviews` slice (`fetchContractorReviews`,
    same `provider/contractor-requests` API). Approve / reject already replace the row there, so close
    makes no API call. Refetches still happen on open, filter / page change and socket updates
    (`version`), and keep the current rows on screen instead of the spinner.
  - The pending-count call now runs only where a badge uses it (`onCountsChange`) and after a decision.
    New `onDecided` callback on `ContractorReviewDialog` / `JobRequestsTab`; the estimate page uses it to
    refresh its "N new" count after a reject or a completion approval. `listKey` exported from the slice.
  - Checked in Chrome with mocks: 3 open/close rounds, 0 extra list calls.
  - Files: `components/portal/job-requests-tab.tsx`, `components/portal/contractor-review-dialog.tsx`,
    `store/contractorReviewsSlice.ts`, `components/portal/estimate-v2/project-panels.tsx`.

- **Site visits: "Schedule follow-up visit" blocked while a visit is still open** — client bug report.
  - The button is disabled while any visit is scheduled / rescheduled / in progress, with an amber note
    ("Visit #2 is still scheduled. Complete, cancel or reschedule it…") and an "Open Visit #N" link.
    Same rule is enforced by the API (409), see backend log.
  - Files: `components/portal/estimate-v2/site-visits-panel.tsx`.

- **Estimate page Job tab: Crew showed "Nobody assigned" though a technician was assigned** — client.
  - Crew names only came from the team list (`usePortalCrew().employeeLabel`), which returns "" when the
    person isn't in it / it hasn't loaded, and a job made without a copied technician had no crew at all.
  - Now falls back to the name saved on the job (`job.assignedTo`), then to the technician assigned on
    the estimate (passed in as `estimateTechnician` from the workspace's `technicianLabel`).
  - Files: `components/portal/estimate-v2/project-panels.tsx`, `components/portal/estimate-v2/new-estimate-workspace-view.tsx`.

- **Estimate page: status banner on every tab, no duplicate badge, richer Job tab** — client.
  - The accepted / converted banner now heads every tab (was Summary + Preview only) and reads
    "Converted to job JOB-… · accepted by <customer> · <date>" (the separate "Customer:" line is folded in;
    Company line kept). The sidebar status badge is hidden once accepted / converted (the banner shows it).
  - Job tab redesigned: header (job number, status, title, **Open job**), 5-step tracker (Booked → Scheduled
    → In progress → Completed → Invoiced; "cancelled" note), facts grid (Scheduled, Due, Crew technicians +
    contractors, Job value incl. approved change orders, Invoice link, Job site), an amber "N change requests
    waiting for your review" bar with **Review** (opens Change requests), then Stages and Latest activity.
  - Files: `components/portal/estimate-v2/project-panels.tsx`, `new-estimate-workspace-view.tsx`

- **Estimate page: estimate number, latest status, Job + Change requests sections** — client: the page showed
  the work-request number (Est-1677) while the list shows EST-248, still said "Accepted" after it became a job,
  and the technician's change-order request wasn't visible from the estimate.
  - Menu header shows the estimate's number (same as All estimates), the work-request number only when
    there's no estimate yet.
  - Status badge and card subtitle show the latest status incl. **Converted to job · JOB-…** (was hidden);
    the approval banner reads "Converted to job JOB-… · accepted by the customer".
  - Production: **Job** (was "Progress", meta = job number) with job status, progress, stages, latest
    activity and **Open job**; **Change requests** (when the job has any, meta "N new" while pending) with the
    same table as the job's Requests tab (approve / reject / create the change order; live via the socket);
    Change orders stays as before. New `jobRequests` + `reloadJob` in `useProjectData`.
  - Files: `components/portal/estimate-v2/project-panels.tsx`, `project-lifecycle-nav.tsx`,
    `new-estimate-workspace-view.tsx`

- **Per-role sessions: "/" and all public pages are the customer site** — client: opening `localhost:3000` in
  a new tab went to `/contractor/dashboard`, because public pages used the last-used session (a contractor
  signed in elsewhere) and the route guard then sent that contractor to their portal. Now the URL alone
  decides: `/technical/*` technician, `/contractor/*` contractor, `/pro/*` + Pro marketing / sign-up
  (`/for-pros*`, `/for-providers`) provider, estimate share links (`/e/…`, `/<uuid>`) keep the tab's own
  session, and everything else (`/`, `/account`, `/login`, `/register`, services, profiles, blog, quote…)
  uses the **customer** session only. A Pro / Technician / Contractor in another tab never takes over the
  customer site. Verified: page sweep with a Pro + Technician signed in (16 pages, all correct: e.g. `/`,
  `/services`, `/login` stay put, `/account/dashboard` → `/login`, `/technical/jobs` stays, `/contractor/jobs`
  → contractor login); multi-tab test 17/17; unit test all pass. · `lib/session-scope.ts`

- **Fix: Pro portal render loop ("Maximum update depth exceeded") when the business has no office hours** —
  client saw a blank "Rendering…" Pro dashboard in a new tab. `usePortalSettings` built a new
  `sourceHours` array on every render when the session had no working hours, and its effect copied it into
  state each time → endless re-render. `sourceHours` is now memoized. (Opening `/` while signed in as a Pro
  still goes to `/pro/dashboard` — the existing route-guard rule, unchanged.)
  · `components/portal/use-portal-settings.ts`

- **Per-role sessions: a Technician / Contractor / Customer / Pro in one tab no longer replaces another tab's
  session** — client: multi-role session isolation on the live site, additive and production-safe.
  - Cause: all portals shared one localStorage key (`persist:userData`). Signing in as another role in any
    tab overwrote every tab's session on its next reload / token refresh; signing out anywhere signed every
    tab out.
  - Now one saved session per role: `persist:userData:provider | :technician | :contractor | :customer`,
    chosen by URL — `/pro/*` Pro, `/technical/*` Technician, `/contractor/*` Contractor, `/account/*` +
    `/login`, `/register`, `/verify-otp`, forgot / reset → Customer. Public pages use the role this tab
    already uses (sessionStorage holds only the role name), else the last used session.
  - Writes go to the slot of the role inside the session (login, token refresh, profile update). Sign-out
    clears only that role's slot. Unknown roles (e.g. admin) use the shared key exactly as before.
  - Zero regression: `persist:userData` is still written ("last used") and read as a fallback; a session
    saved before this change is copied into its slot on first use, so live users are not signed out.
  - Security unchanged: slots hold the same AES-encrypted redux-persist value (`encryptData`,
    `NEXT_PUBLIC_ENCRYPTION_KEY`); auth state is still the encrypted Redux + redux-persist store; no token
    in sessionStorage; no API / backend change.
  - Cross-role URLs: a portal whose own session is missing shows its own login (e.g. a Technician URL in a
    tab where only a Pro is signed in → technician login, not the Pro dashboard). Gates and the route guard
    wait while a tab's session is being swapped (`useSessionSwitchPending`) instead of redirecting with the
    old one; `switchSession` swaps auth in one step and drops the previous user's cached lists / GETs.
  - Kill switch: build with `NEXT_PUBLIC_SCOPED_SESSIONS=off` → the single shared key, as before.
  - Verified: Chrome multi-tab test (same browser storage, mocked API, fake encrypted sessions) — 14 checks
    pass (legacy Pro session still works, technician login in tab B keeps Pro in tab A after reload, customer
    URL asks for customer login, new tabs open the right portal without re-login, technician sign-out keeps
    the Pro signed in); unit test of the storage adapter — 26 checks pass; estimate page regression run clean.
  - Files: `lib/session-scope.ts` (new), `components/auth/use-session-switch-pending.ts` (new),
    `store/index.ts`, `store/authSlice.ts`, `store/redux-provider.tsx`, `components/api/apiFuntions.ts`,
    `components/portal/portal-gate.tsx`, `components/technician/technician-gate.tsx`,
    `components/contractor/contractor-gate.tsx`, `components/account/customer-gate.tsx`,
    `components/auth/auth-route-guard.tsx`

- **Wrong-portal login: clear message + button to the right sign-in page** — client: a technician on the
  contractor login got a vague error. The API now says which account type it is and where to sign in (see the
  backend log); new `showLoginErrorToast` (`lib/login-portal-hint.ts`) shows that message for 10 s with a
  "Go to technician / contractor / Pro / customer sign-in" button when it names a sign-in path. Used by the
  contractor, technician and Pro / customer login forms. · `lib/login-portal-hint.ts`,
  `components/contractor/views/contractor-login-view.tsx`, `components/technician/views/technician-login-view.tsx`,
  `components/auth/auth-form.tsx`

- **Activity shows the time, not only the date** — client: activity entries only had the date. New
  `formatDateTime` in `lib/format.ts` ("November 11, 2026 · 10:42 AM"; a date-only value still shows just the
  date). Used in: estimate Activity tab, customer updates in the change-requests rail, Progress → Latest
  activity (job), customer detail History and Timeline, dashboard Recent activity. The job file activity feed
  already showed the time. · `lib/format.ts`, `components/portal/estimate-v2/new-estimate-workspace-view.tsx`,
  `project-panels.tsx`, `components/portal/views/customer-detail-view.tsx`, `dashboard-view.tsx`

- **Estimate card header: Print in More, no New estimate button** — client: the extra buttons pushed the
  actions under the title; New estimate belongs only in the app sidebar (Estimate → Create estimate). Print /
  PDF is now the first item in the More menu (same disabled rules); the New estimate button and More item and
  the top-bar New estimate button were removed. The actions sit on the right of the title again.
  · `components/portal/estimate-v2/new-estimate-workspace-view.tsx`

- **Searchable pickers look like the app Select (global)** — client: the technician / contractor / team
  dropdowns looked different from Visit type. `PaginatedEntitySelect` menu now matches `SelectContent` /
  `SelectItem`: 4px gap under the field (no longer glued to it), ring + shadow, padded list (`p-1`), rounded rows
  (`py-1.5 pl-2 pr-8`), `bg-accent` hover / selected, check mark on the chosen option; the "+ Add…" row uses
  the same row shape in primary text (no grey band). Behaviour, paging and search unchanged. Applies everywhere
  the picker is used (estimate crew, site visits, jobs, schedule dialogs…).
  · `components/portal/paginated-entity-select.tsx`

- **Preview & send: "Not now" on the template prompt opens the send dialog with no API calls** — client: after
  "Not now" the page created the estimate (POST `…/opportunities/:id/estimates`) and reloaded the opportunity
  and schedule before the dialog opened, which was slow. "Not now" itself never called the API; the calls came
  from `openSendDialog` creating the draft when the estimate didn't exist yet. Now the dialog opens immediately
  with a preview built from the sheet ("Send estimate for approval"); the draft is created by `prepareForSend`
  (no reload) only when **Send for approval** is clicked. Old code kept commented. Saving the template still
  calls the template API as before. · `components/portal/estimate-v2/new-estimate-workspace-view.tsx`

- **Site visits: time is typed in, not picked from a dropdown** — client: no 15-minute slot list. `DateTimeField`
  now pairs the date input with a native time input (any minute; keeps a draft while a segment is half-typed).
  Value is still the local `YYYY-MM-DDTHH:mm` string, sent as `scheduledAt` ISO as before, so no payload or
  backend change (the API takes any time). Used by the visit card, Schedule follow-up visit and Reschedule.
  · `components/ui/date-time-field.tsx`

- **Estimate page: Invoices tab is a table like the Invoices page** — client: the invoice document view wasn't
  wanted. The tab now shows Invoiced / Paid / Balance due tiles and the same `PortalDataTable` +
  `invoiceBoardColumns` as `/pro/dashboard/invoices` (invoice no., job no., issued, status, due, days overdue,
  customer, address, totals…, row opens the invoice; View / Record a payment / Open job). Rows: the estimate's
  invoice plus the job's change-order invoices (fetched with `getInvoice`). The `InvoicePrintDocument` view and
  the separate change-order table were removed. · `components/portal/estimate-v2/project-panels.tsx`

- **All estimates: table inside a bordered card** — client: Estimate templates has its search + table inside a
  bordered white card, All estimates didn't. Wrapped the estimates `PortalDataTable` in the same card
  (`rounded-2xl border border-[#94a3b8] bg-white p-4`). · `components/portal/estimate-v2/new-estimate-list-view.tsx`

- **Estimate page: Parts & Labour = real line items + summary; invoice document; detailed Work request;
  Create estimate in the menu** — client: the new Parts & Labour table "changed everything", the invoice tab
  wasn't good, Work request needed more detail, and there was no create option in the app menu. Front end only.
  - **Parts & Labour** now shows the estimate's own **Line items** card (same `SectionedLineItemsEditor`) and
    the **Estimate summary** card, nothing else (header, scope, approval, crew, visits, notes hidden). It is
    the same mounted sheet as Summary, so edits and auto-save are shared. The custom read-only table
    (`PartsLabourPanel`) and the `totals` prop were removed.
  - **Invoices**: the stat row plus the real invoice document (`InvoicePrintDocument`, the invoice page's print
    layout, shown on screen with `block`): letterhead, bill to, service address, items by section, totals,
    balance due, payment history. "Open invoice" in the header. Change-order invoices table kept.
  - **Work request**: status badge, title, "What the customer needs" box, a bordered facts grid (request no.,
    received, customer + phone/email, source, service address + View on map), Open lead / Customer profile,
    customer answers as a table, customer photos & files, internal notes (not shown to the customer).
  - App sidebar: **Estimate → Create estimate** (`/pro/dashboard/new-estimate/new`). The shell now marks only
    the most specific child active, so "All estimates" doesn't light up on that page.
  - Files: `components/portal/estimate-v2/new-estimate-workspace-view.tsx`, `project-panels.tsx`,
    `components/portal/portal-shell.tsx`, `lib/data/portal-nav.ts`.

- **Estimate page: Summary back on top, totals under Parts & Labour, Summary-style card borders, visible New
  estimate** — client correction of the pass below; front end only.
  - Menu: **Summary** is the first item again, **Parts & Labour** right under it; Budget stays last in Production.
  - Parts & Labour: under the line-items table, a **Summary** box (subtotal, discount, tax %, total) with the
    live numbers from the Summary sheet (new optional `totals` prop on `ProjectPanel`).
  - Borders: panel cards (Work request, Progress, Invoices…), side cards (Activity, Preparation) and the
    approval banner use the Summary card's outline `#94a3b8` (was `slate-300`).
  - **+ New estimate** is now a visible button in the estimate card header (next to Print / PDF), and still
    in the More menu.
  - Files: `components/portal/estimate-v2/project-lifecycle-nav.tsx`, `project-panels.tsx`,
    `new-estimate-workspace-view.tsx`.

- **Estimate page: menu reorder, Parts & Labour, invoice table, clearer borders, New estimate** — client
  UI pass; front end only, no API, data or workflow changes (convert to job, invoicing, sending unchanged).
  - Menu: new **Parts & Labour** item at the top (read-only table of the line items by section: type, qty,
    unit, rate, amount, optional tag; Labour / Parts / Equipment / Optional totals; "Edit on Summary").
    **Estimate** is renamed **Summary** (same page, untouched). **Budget** moved to the end of Production.
  - **Invoices** tab: full invoice view — status, total / paid / balance / due, line-items table, totals
    breakdown (subtotal, discount, tax, total, paid, balance due), payments table (loaded with
    `getInvoiceWithPayments`), and change-order invoices as a table with Open links.
  - Borders: panel cards, side cards (Activity, Preparation, Work request, Progress…), stat tiles, table
    outlines / header rules / row dividers and the unselected Preparation choices now use `slate-300` /
    `slate-200` instead of the washed-out `slate-200/60`. The Summary card (`MAIN_CARD`) is unchanged.
  - Shared `PortalDataTable`: the search box and table outline use `border-slate-300` (was `border-soft`
    `#e2e8f0`), so list tables (e.g. All estimates) have a visible grid. Dark mode unchanged.
  - **New estimate**: in the estimate card's More menu, and as a header button before the estimate card
    exists (site-visit stage); both go to `/pro/dashboard/new-estimate/new`, same as the list page.
  - Panel header asides that are buttons keep their own colours (only text asides are muted).
  - Files: `components/portal/estimate-v2/project-lifecycle-nav.tsx`, `project-panels.tsx`,
    `new-estimate-workspace-view.tsx`, `components/portal/portal-data-table.tsx`.

### 2026-11-10

- **Estimate page: project menu never scrolls inside** — client: on a smaller screen the menu had its own
  scrollbar.
  - No inner scroll: the card is at least the screen height (`lg:min-h-[calc(100dvh-72px)]`) and grows with
    its items; rows, group gaps and header padding tightened.
  - Follow-up folds into one "Follow-up" row at the bottom (click to open the date / notes / Save form) on
    desktop too, so it no longer pushes the menu past the screen.
  - Measured: no scrolling element inside the menu; a sent estimate fits a 1366×620 screen.
  - Files: `estimate-v2/project-lifecycle-nav.tsx`, `new-estimate-workspace-view.tsx`.

- **Estimate page: project menu sticks properly and fills the screen** — client: while scrolling, the menu's
  top went under the header and it ended short of the bottom.
  - The rail's sticky offset never applied (`lg:top-4` / `lg:top-[61px]` computed to `top: auto`, so it just
    scrolled away). Now `lg:top-15` (60px, below the 49px header), and the card is exactly
    `lg:h-[calc(100dvh-72px)]` tall; its item list scrolls inside if it's ever taller.
  - Verified: after scrolling, the menu stays 11px under the header and ends 12px above the bottom.
  - Files: `estimate-v2/project-lifecycle-nav.tsx`, `new-estimate-workspace-view.tsx` (rail + loading skeleton).

- **Estimate page on phones: project menu is a swipeable row of tabs** — client: on mobile the menu stacked
  top to bottom and filled the screen.
  - Below `lg`, the menu is one horizontal, scrollable row of pill tabs (icon, label, count); the open tab
    scrolls into view. Desktop keeps the full-height sidebar.
  - The follow-up form folds into a "Follow-up" disclosure under the tabs on phones.
  - `min-w-0` on the rail so the row scrolls inside the screen (no sideways page scroll at 390px).
  - Files: `estimate-v2/project-lifecycle-nav.tsx`, `new-estimate-workspace-view.tsx`.

- **Estimate summary: Total is a ruled line, not a filled block** — client: the solid blue Total looked like a
  button. Now a dark rule above "Total" with the amount large in the brand blue (no fill). Files:
  `estimate-v2/new-estimate-workspace-view.tsx`.

- **Estimate summary card redesigned (CRM style)** — client asked for a pro-level summary; same data and logic.
  - Left: cost breakdown with a stacked bar (labour / material / equipment, shades of the brand blue) and
    three tiles with amount and share; Terms below.
  - Right: totals ledger (subtotal, discount input, tax) ending in a solid primary Total block, plus a line
    for optional add-ons that aren't in the total.
  - Project stages summary still sits under the header when the estimate has stages.
  - Files: `estimate-v2/new-estimate-workspace-view.tsx`.

- **Estimate page: cleaner menu top, full-length Activity** — client: the menu's top looked shadowed with a
  missing border; Activity had a fixed-height inner scroll.
  - Menu: header tint removed, clear card border (`slate-300`), the active accent bar that stuck out past
    the card edge removed (active item keeps its filled icon and tint).
  - Activity tab lists every entry on the page (no max-height scroll, no Show more / less).
  - Files: `estimate-v2/project-lifecycle-nav.tsx`, `new-estimate-workspace-view.tsx`.

- **Send estimate: working company confirmation checkbox** — client: the "I have read pages 1 and 2…"
  box did nothing on the pro side. That box is the customer's consent (works on their signing page), so
  instead the company side gets its own:
  - Under Company authorization: "I confirm this estimate is accurate and authorize sending it to
    {customer} for {total}" — must be ticked (with the signature) before Send; otherwise it scrolls to it and
    explains. It gates sending only; nothing new is stored.
  - The customer's box shows "The customer ticks this box when they sign." in the pro preview
    (`customerBoxNote`; hidden in print).
  - Files: `components/portal/send-approval-dialog.tsx`, `components/estimate/estimate-pdf.tsx`.

- **Estimate page: Estimate summary and Notes & updates are their own cards; loading skeleton matches the
  layout** — client: they were inside the line-items card; the skeleton still showed the removed
  "Work / Estimate" header.
  - Summary (with Terms) and Notes & updates moved out of the estimate card into separate cards below it
    (same content and logic; shown when the sheet is).
  - Loading state: headerless, a full-height menu card with item placeholders, the estimate card and a
    summary card.
  - Files: `estimate-v2/new-estimate-workspace-view.tsx`.

- **Estimate page: full-height project menu, no shadow, follow-up back in the sidebar** — client: the white
  menu card stopped halfway down; no shadow; Follow-up wasn't a page before.
  - The menu card fills the screen height below the header (`lg:min-h-[calc(100dvh-5.75rem)]`), shadows removed.
  - Follow-up is no longer a tab: a compact date + notes + Save form is pinned to the bottom of the menu
    (new `footer` slot on `ProjectLifecycleNav`), shown while the estimate is sent and not accepted.
  - Files: `estimate-v2/project-lifecycle-nav.tsx`, `new-estimate-workspace-view.tsx`.

- **Estimate page: map on the Customer tab, Print only where the document is, restyled project menu; header
  record tabs removed** — client feedback.
  - Customer tab ends with the route map (business → job site), the same `RouteLocationMapInner` as the
    "View on map" dialog, loaded lazily.
  - Print / PDF sits on the Estimate card and the Preview card only; the floating toolbar no longer shows on
    other tabs (it stays on the Estimate tab before an estimate exists).
  - Project menu restyle: tinted header, icon tiles, accent bar + filled icon for the active item, count pills.
  - Portal header: the recently-opened records tab bar (Dashboard · REQ-… · JOB-…) is off everywhere
    (`SHOW_RECORD_TABS = false` in `portal-shell.tsx`; code kept).
  - Files: `estimate-v2/project-panels.tsx`, `project-lifecycle-nav.tsx`, `new-estimate-workspace-view.tsx`,
    `components/portal/portal-shell.tsx`.

- **Estimate page: real Schedule calendar, sidebar lists only sections with data, Customer tab, no dialogs,
  panels in the page's card style** — client: Schedule wasn't the project's schedule; empty tabs (Invoices,
  Change orders…) shouldn't show; Work request / Preparation should be in the page, not a modal; bring back a
  Customer tab instead of the identity card; the panels didn't match the app's UI.
  - **Schedule** is the company calendar (`EventCalendar`, same as Schedules) with only this project's rows
    (lead, estimate and job). Drag to move (`updateSchedule`), click to reschedule / assign (`AssignEventDialog`).
    New `listRecordSchedule(recordId)` reads the API's own rows for one record (no company-wide merges).
  - **Dynamic sidebar** (`projectNavGroups`): Preview / Budget only with line items, Selections only with
    optional items, Progress only with a job, Change orders / Schedule / Invoices / Project files only when
    they have entries (with counts); empty groups disappear. A hidden section falls back to the estimate.
  - `useProjectData` loads the job, the customer's request photos and the calendar rows once per project.
  - **Customer tab** (name, email, phone, property + map, Customer profile) and **Work request** (with the
    quote answers) render in the centre; Preparation too. The Work request / Preparation dialog is removed.
  - The identity card is gone: number, title and status head the menu; customer and address are the Customer tab.
  - Panels use the estimate page's own card (`RAIL_CARD` surface) and uppercase section labels.
  - Files: `components/portal/estimate-v2/project-panels.tsx`, `project-lifecycle-nav.tsx`,
    `new-estimate-workspace-view.tsx`, `lib/api/crm-client.ts`.

- **Estimate page: every sidebar section renders in the page; details in dialogs; approval status** — client: the
  sidebar still sent people to other pages, and details cluttered the centre.
  - **No page changes.** Each project menu item renders in the centre (`project-panels.tsx`):
    - **Preview** shows the customer document inline (from `buildPrintJob`, split out of `printEstimate`).
    - **Selections** lists optional items by "Option for", with included vs optional totals and "Include in total".
    - **Budget** shows price, cost, profit and margin per section from the line items (internal only), plus
      approved change orders.
    - **Progress** shows the job status steps, stages and latest activity.
    - **Change orders** and **Schedule** (start, due and stage dates) come from the job.
    - **Invoices** shows the linked invoice (total, paid, balance, due) and change-order invoices.
    - **Project files** is a labelled grid; see below.
    - The job loads only when a production panel opens (`getJob`). Panels that need it say so until it exists.
  - **Centre clean-up.** "Customer & property" is gone; the sidebar title card already shows the customer, address
    and map. Work request and Preparation open as dialogs. Preparation still shows inline as the first step when
    nothing is chosen yet.
  - **Accepted / converted.** No send action anywhere: the card row was already accept-aware, and Preview shows
    "Review and send" only before acceptance. `ApprovalStatus` sits on top of the estimate and in Preview: who
    signed for the customer and the company, when, and that signed estimates are locked.
  - **Project files.** Each file is labelled by source: Uploaded by customer (the original request's photos, loaded
    when the tab opens), Added by company (Existing information and estimate attachments), Site visit, and Job. It
    is a compact 2–4 column grid with thumbnails, PDFs as icons, and each file opening in a new tab.
  - Checked in Chrome with an accepted estimate, job, change order and files:
    - Every menu item rendered with the URL unchanged, and no send button was visible.
    - The approval strip shows both signatures.
    - Budget: $990 price, $500 cost, $150 profit.
    - Files: customer 1, company 2, job 1.
    - Work request opened as a dialog.
    - `tsc` and eslint are clean.
  · `components/portal/estimate-v2/project-panels.tsx` (new), `project-lifecycle-nav.tsx`,
  `new-estimate-workspace-view.tsx`

- **Estimate page: no "Work / Estimate" header; Print moves into the estimate card** — client: the header card was
  still there. `PortalPage` takes `headerless` (the title stays as an sr-only `<h1>`).
  - The estimate number, title, status, customer and address (with View on map) are now a compact card at the
    top of the project sidebar, with the back arrow.
  - The header buttons moved into the estimate card: **Print / PDF** sits next to Save draft / Preview & send /
    More. Assign or change contractor and technician, and In-person presentation, are in More.
  - The header's "Save changes ▾" is dropped; it duplicated Save draft and Preview & send.
  - With no estimate card on screen (site-visit path, or a Details panel open), the crew buttons and Print show
    in a small toolbar above the centre. The print document renders at page level.
  - Checked in Chrome: no eyebrow on the page, Print in the card and enabled, More lists the crew and in-person
    options. `tsc` and eslint are clean · `components/portal/portal-page.tsx`,
  `components/portal/estimate-v2/new-estimate-workspace-view.tsx`

- **Estimate page: details move into the sidebar, centre is the sheet; Work tabs desktop-hidden everywhere** —
  client: the first pass still cluttered the page.
  - **Work tabs** (`Leads | Messages | Estimate | Jobs…`) are now `lg:hidden` on every Work page, not just the
    estimate. The main sidebar has the same links, and phones and tablets keep the bar · `portal-shell.tsx`
  - **Left rail is only the project menu:** 232px and sticky. Its new **Details** group holds Customer & property,
    Work request and Preparation, plus Follow-up and Activity when they apply. These cards are no longer stacked
    on the page.
  - **Centre:** each Details tab opens its card there, with "Back to estimate". Picking a preparation option
    returns to the sheet. The estimate column stays mounted (hidden) under a panel, so drafts, auto-save and
    dialogs keep running. The page opens on Preparation only when nothing is chosen and no estimate exists yet.
    The change-request notice moved to the top of the centre.
  - Checked in Chrome: no Work tabs on desktop (estimate and Jobs) and still there at 390px. Nav 232px, centre
    about 1,090px at 1600. Each tab hides the sheet and shows its card; Back restores the sheet and its inputs.
    `tsc` and eslint are clean.
  · `components/portal/estimate-v2/new-estimate-workspace-view.tsx`,
  `components/portal/estimate-v2/project-lifecycle-nav.tsx`, `components/portal/portal-shell.tsx`

- **Estimate page, Bolster-style: project menu, spreadsheet line items, optional add-ons, Review and send** —
  client asked for a cleaner estimate detail view. Leads → Estimates → Jobs → Invoices is unchanged. The user
  approved adding optional item fields; the backend change is additive (see the backend log).
  - **Top Work tabs** are hidden on desktop on the estimate detail page only (`/pro/dashboard/new-estimate/:id`).
    Phones keep them · `portal-shell.tsx`
  - **Project menu** (`ProjectLifecycleNav`, top of the left rail):
    - Pre-production: Estimate scrolls to the sheet, Preview opens the existing preview & send, Selections scrolls
      to the line items and shows the optional count.
    - Production (Budget, Progress, Change orders, Schedule, Invoices) is locked with a reason until the job
      exists, then opens the job's tabs (`?tab=materials`, `?tab=change-orders`), the schedule, and the invoice.
    - Project: Project files (Existing information, or the job's attachments) and Project details.
  - **Spreadsheet line items** (`LineItemsEditor` with the opt-in `spreadsheet` prop; jobs and invoices unchanged):
    - Cost and Profit % columns. Profit sets the price. Editing cost or price keeps the price and recalculates
      profit, which is safe while typing digit by digit.
    - An Optional switch with an "Option for…" field. Optional lines are tinted, in italics, and left out of the
      line, section and estimate totals (`jobCostMix`, `groupLinesBySection`).
    - Unit (each / ft / sq ft / hr) is now sent to the API; before, it was dropped on save.
  - **Fields end to end:** `unitCost`, `profitPercent`, `optional` and `optionGroup` on `JobCostLine` and
    `EstimateItem` (`lib/estimate-line-extras.ts`). They go through the mapper and the API payload, the sheet
    change signature (so edits auto-save), and the estimate items builder. `linesToJobItems` and
    `linesToInvoiceItems` drop optional lines.
  - **Customer copy:** snapshots use `optionExtras` (optional flag and group only), so cost and profit never
    reach the customer. The customer document lists included work as before, then a dashed "Optional add-ons"
    table marked "Not included in the total" · `estimate-pdf.tsx`, `customer-estimate.tsx`, `use-estimate-share.ts`
  - **Header:** "Save changes" plus a menu with Review and send (the existing preview → company signature →
    email flow), In-person presentation (confirm, then open the customer's signing link in a new tab on this
    device), and Print / PDF. E-signatures already existed and are unchanged.
  - Checked in Chrome with a sample estimate:
    - The menu locks Production; the columns appear.
    - Cost 60 on an $85 line gives 41.7%, and 50% gives $90.
    - The optional toggle drops the total; the auto-save PUT carries unit, cost, profit, optional and group.
    - The preview shows the add-ons box with no cost; the phone width keeps the tabs with no overflow.
  · `components/portal/estimate-v2/project-lifecycle-nav.tsx` (new), `lib/estimate-line-extras.ts` (new),
  `components/portal/line-items-editor.tsx`, `components/portal/estimate-v2/sectioned-line-items-editor.tsx`,
  `components/portal/estimate-v2/new-estimate-workspace-view.tsx`, `components/portal/estimate-v2/line-sections.ts`,
  `components/portal/use-job-costing.ts`, `components/portal/work-builders.ts`, `components/portal/use-estimate-share.ts`,
  `components/estimate/estimate-pdf.tsx`, `components/estimate/customer-estimate.tsx`, `lib/api/crm-client.ts`,
  `lib/api/crm-mappers.ts`, `lib/types/index.ts`, `components/portal/portal-shell.tsx`

- **Pipeline: new lead lands on the board instantly** — client: after "+ Create new → New lead", stay on the
  Pipeline and add the lead from the create response, with no navigation and no full reload.
  - `CreateLeadDialog` takes an optional `onCreated`; when it's set, the dialog hands back the saved lead (with the
    picked customer's name) instead of opening its page. The dashboard and Leads tab still navigate.
  - `CreateNewMenu` turns the response into a "New leads" card (`leadCard`) and dispatches the new
    `pipelineCardAdded`. It reuses `settle`, so the card goes on top with group and column totals updated. It's
    skipped while a search is shown.
  - `pipelineCardAdded` also sets `quietUntil` (3s). `usePipelineBoard` ignores `PIPELINE_INVALIDATE` until then,
    because the server's "something changed" echo for our own save would otherwise reload every column.
  - Checked in Chrome: POST sent, dialog closed, URL unchanged, Leads 5→6, REQ-2001 under "Added by you", 0 extra
    board loads.
  · `components/portal/create-work-dialogs.tsx`, `components/portal/pipeline/create-new-menu.tsx`,
  `store/pipelineSlice.ts`, `components/portal/pipeline/use-pipeline-board.ts`

- **Create lead form: proper dropdowns** — client: the Window field opened the browser's unstyled list, and Service
  should be picked from the services the business offers. Window now uses the app's `Select` (popper, inside the
  dialog). Service is a searchable list of the business's own sub-services (Business Profile → Services), labelled
  by category. If none are listed yet, it falls back to the text box with a hint. That list now comes from a shared
  `useOfferedServiceOptions` hook, also used by the team-member `ExpertisePicker`. Checked in Chrome: options listed,
  a pick fills the field · `components/portal/create-work-dialogs.tsx`, `components/portal/expertise-picker.tsx`

- **Pipeline: fewer colours** — client: the board looked too busy and colourful. The refresh button and the
  lead colour key are commented out (the board already updates itself live). Column underlines, group boxes, the
  drop highlight and the "Move to" dots are now neutral grey. Removed the lead cards' coloured left edge, the 24-hour
  pulsing dot and the section dots. Source badges (Web / AI call / Manual) are plain grey. Status pills and the amber
  "can't book yet" warning are unchanged. The sample-board test passes again · `components/portal/pipeline/pipeline-board.tsx`

- **Pipeline UI, Bolster-style** — client asked for a "+ Create new" menu, a "⋯" menu on cards, and clearer lead and
  estimate sub-stages. Frontend only; the routes, schemas and move rules are unchanged.
  - **"+ Create new"** next to search: a chooser (New lead / New estimate / Schedule a job) that opens the existing
    flows: `CreateLeadDialog`, the estimate wizard (`/pro/dashboard/new-estimate/new`), and `CreateJobDialog`.
  - **"⋯" on every card**: Open, plus "Move to" any group that takes the card. It runs the same `dropCard` rules as
    dragging: the blocker toast for unfinished estimates, flows that open a page, and the booking dialog for Booked.
    Lock, calendar and arrow icons show which of those applies.
  - **Leads** split into "Incoming · web & calls" and "Added by you", using the lead's `source`. Each card has a
    coloured left edge (sky for incoming, slate for added by you) and a badge (Web / Message / AI call / From RS /
    Manual / Walk-in). Incoming leads from the last 24 hours get a live dot, and lead cards show the received date.
  - **Sent estimates** split into "Waiting on customer" and "Accepted · ready to book".
  - Column headers have a coloured underline and bold totals; group borders take the column colour. A key for the
    lead colours sits on the left of the toolbar.
  - The split is display only: group counts and paging still come from the server. Lead sections hide when the API
    doesn't send `source`. The card is now a draggable `div` holding the link and the menu button side by side, since
    a button inside a link is invalid.
  - Verified in Chrome against a sample board: chooser, job dialog, blocked move (no request sent), booking dialog,
    a menu move (PATCH sent), keyboard drag, and 390px with no overflow. `tsc` and eslint are clean.
  · `components/portal/pipeline/pipeline-board.tsx`, `components/portal/pipeline/create-new-menu.tsx` (new),
  `lib/api/pipeline-client.ts`, `components/portal/views/pipeline-view.tsx`

### 2026-11-05

- **/home-v3 customer reviews: whole cards only** — client: a neighbouring card stuck out, half cut and faded.
  Removed the edge fade and the track overhang, so the carousel is exactly the content width: 3 cards on
  desktop, 2 on tablet, and 1 full-width card on phones (was 85% with the next one peeking). Arrows, dots,
  and swipe unchanged · `components/home-concepts/reviews-carousel.tsx`, `app/globals.css`

- **Blog SEO, end to end** — admin create and edit dialogs get one optional SEO section (custom slug with
  URL preview, meta title, meta description, focus keywords); empty fields fall back to the title and
  summary, and the create dialog no longer overwrites saved SEO with the title and summary on every save.
  Metadata now renders in `<head>` for browsers too: `htmlLimitedBots: /.*/` turns off Next's streaming of
  metadata into `<body>` **site-wide**. `admin/src/pages/blog-editor.jsx` has no route and is unused ·
  `next.config.ts`, `admin/src/components/shared/blog-seo-fields.jsx` (new), `admin/src/lib/blog-seo.js` (new),
  `admin/src/pages/blog-posts.jsx`, `admin/src/pages/blog-detail.jsx`

- **/home-v3: outer frames removed from two sections** — client request. "Hire With Confidence" and
  the "Your project, step by step" timeline now sit directly on the page background: outer border,
  shadow, card background, and the timeline's soft layer are gone, and the content lines up with the
  section heading. Steps, icons, inner cards, and the line under the timeline header are unchanged ·
  `components/home-concepts/hire-with-confidence-section.tsx`,
  `components/home-concepts/peace-of-mind-timeline.tsx`

### 2026-11-04

- **/home-v3 header: brand slogan** — client request. "Find the Right Pro. Get the Job Done." sits under
  "Request Service" in the header (small, muted, tight spacing) on /home-v3 only; other pages keep the
  plain logo. New optional `tagline` prop on `Logo` · `components/layout/logo.tsx`,
  `components/layout/site-header.tsx`

- **/home-v3: "Hire With Confidence" trust section + logos on pro cards** — client request. New
  section between the featured pros and the AI designer: eyebrow "Built for your peace of mind",
  heading, intro, and four point cards (Know Who You're Hiring, Clear Written Estimates, Customer
  Reviews, Your Project, Organized). Featured pro cards on home-v3 now show the company logo (the
  pro's uploaded image, initials when there is none or it fails to load) beside the full name, with
  location and category on the line below — opt-in `showLogo` on `ProviderCard`, so the card on other
  pages is unchanged · `components/home-concepts/hire-with-confidence-section.tsx` (new),
  `components/shared/provider-card.tsx`, `components/home/featured-providers-section.tsx`,
  `app/(marketing)/home-v3/page.tsx`

- **AI designer: slider back on the landing page, "after only" moved into the tool** — client
  clarified: the after-only view was meant for the customer's own result after they log in and try
  the designer, not the landing page. /home-v3 shows the before/after slider again (`afterOnly` no
  longer passed); the wizard result on /ai-kitchen-bath-designer now shows only the redesigned image
  (slider commented out). Footer "Chat With Us" renamed "Contact With Us" (still goes to /contact) ·
  `app/(marketing)/home-v3/page.tsx`, `components/ai-redesigner/redesigner-wizard.tsx`,
  `components/layout/site-footer.tsx`

- **/for-pros-v1 Timesheets tab: third column** — client: fill the empty space beside the phone and
  cards. Wide stages (`@2xl`) add a "Sessions today" timeline for Tate (clocked in, started JOB-983,
  break, clocked out — each appears as the day plays, with a "Not clocked in yet" line before the
  shift) and a "Pay period" card (hours, overtime, to pay, pay date) that counts up with the phone;
  same height as the phone · `components/pro-v1/pro-dashboard-mocks.tsx`

- **/for-pros-v1 new tabs fill the stage like Dashboard** — client: the 10 new tab visuals were one card
  in empty space. Each now uses the Dashboard layout (new `BoardLayout` / `StatRow` / `Panel` helpers):
  four stat tiles (two on phones), the animated main card filling the left, and two side cards on
  the right (e.g. Contractors: subcontractor list + assignments; Vendors: vendor terms + recent POs;
  Tracking: crew now + arrivals; Messages: chat with composer + conversation list + technicians;
  Service areas: ZIP chips + cities). Same per-tab animations; stats count up with them. Initials
  capped at two letters · `components/pro-v1/pro-dashboard-mocks.tsx`

- **/for-pros-v1 feature tabs: 10 more sidebar options** — client: show the sidebar items that were
  missing. New tabs, each with its own animated visual and copy that matches the real page: Contractors
  (compliance checklist ticks off, then assigned to a job), Vendors (purchase order fills in, Draft →
  Sent → Received), Employee tracking (tech drives the route, geofence pulse on arrival), Reminders
  (due reminder rings, queue gets done), Messages (chat types itself out), Tasks (checklist
  strike-through with a progress bar), Fixed service orders (New → Accepted → Scheduled → Completed with
  a click on Accept), Business Profile (public profile builds up piece by piece), Portfolio (photo grid
  spotlight), Service areas (city pins drop in, ZIP codes fill the list). Tabs now follow the sidebar
  order (24 in all); Subscription and Utilities left out as account settings, not selling points ·
  `components/pro-v1/pro-dashboard-mocks.tsx`, `components/pro-v1/pro-feature-tabs.tsx`, `app/globals.css`

- **/for-pros-v1 Customers & Timesheets tabs: aligned and balanced** — client: awkward white space.
  Customers: list and detail share one height, so the profile card lines up with the list top and
  "Recent activity" with its bottom; the activity card gets times (Today / Yesterday / Mon), a
  "<name>'s file" label, matching padding, and now shows on phones too. Timesheets: phone and cards
  share one height (tops and bottoms line up); the phone's empty middle shows the current job
  ("On the clock · JOB-983 · Furnace cleaning"); both cards use the same padding ·
  `components/pro-v1/pro-dashboard-mocks.tsx`

- **/home-v3: reviews manual again, softer timeline header line** — client feedback. Customer
  reviews no longer auto-scroll: a manual snap carousel with the arrows beside the heading and dots
  below (edge fade and fade-up on first view kept; marquee CSS removed). The line under the
  "Your project, step by step" header is now a faint slate hairline ·
  `components/home-concepts/reviews-carousel.tsx`, `components/home-concepts/customer-reviews-section.tsx`,
  `components/home-concepts/peace-of-mind-timeline.tsx`, `app/globals.css`

- **/home-v3 steps timeline copy** — client asked for clearer text. Intro no longer names a
  competitor ("Find a local pro, compare written estimates, and follow the work through to payment…");
  card header reads "Your project, step by step" · "Example: water heater replacement · Aurora, IL"
  with an "All in one place" badge (was "Your project file" / "One record") ·
  `components/home-concepts/peace-of-mind-timeline.tsx`

- **/home-v3 customer reviews: continuous loop** — client: smooth, nonstop right-to-left scrolling
  instead of stepping. The card row now glides in an endless loop (list drawn twice, CSS
  `rs-review-x`, ~46 px/s), pauses on hover / focus, fades out at the left and right edges, and
  fades up on first view; reduced motion stands still and scrolls by hand. Arrows removed (the row
  moves itself); hover accent line removed · `components/home-concepts/reviews-carousel.tsx`,
  `components/home-concepts/customer-reviews-section.tsx`, `app/globals.css`

- **/home-v3 customer reviews: polish on the compact layout** — client: the plain version looked
  too basic. Cards get a quote-mark chip, rounded-2xl corners, a soft blue shadow, a hover lift with
  a blue accent line, and gradient initials avatars with a green verified check by the name; round
  arrows fill blue on hover; faint blue glow in the background. Spacing stays tight ·
  `components/home-concepts/customer-reviews-section.tsx`, `components/home-concepts/reviews-carousel.tsx`

- **/home-v3 customer reviews: tighter and plainer** — client feedback: too much space above and
  below, wanted a basic look. Tight section spacing (as the steps timeline), left-aligned heading on
  one line with the arrows beside it (dots row removed; phones swipe), and simple cards: smaller
  radius and text, light border, small shadow, plain verified label, initials avatar ·
  `components/home-concepts/customer-reviews-section.tsx`, `components/home-concepts/reviews-carousel.tsx`

- **/home-v3 customer reviews: light theme** — client feedback, better contrast. Section is now
  light (slate-50) with white cards (subtle border, soft shadow), dark headings and text, and
  primary-blue accents; carousel arrows and dots restyled to match. Layout and carousel unchanged;
  dark mode uses the site tokens · `components/home-concepts/customer-reviews-section.tsx`,
  `components/home-concepts/reviews-carousel.tsx`

- **/home-v3: steps timeline restored, reviews moved down** — client feedback: the reviews had taken
  the timeline's slot. "You stay in control at every step" is back right after Browse services;
  Customer reviews now sits after the AI designer, before the FAQ · `app/(marketing)/home-v3/page.tsx`

- **Pipeline: unfinished estimates can't be booked** — client rule. An estimate card without
  line items, not yet sent, or never built shows an amber hint ("Add line items to book it",
  full reason on hover); while it is dragged, the Scheduled jobs groups show a dashed amber
  outline and the reason, and dropping there leaves it in place with a warning and an "Open
  estimate" button. The server enforces the same rule; other moves unchanged ·
  `components/portal/pipeline/pipeline-board.tsx`, `lib/api/pipeline-client.ts`

- **/home-v3 customer reviews simplified** — client feedback: less crowded. Removed the 4.9
  rating / star-breakdown box, the subtitle paragraph and the trust points; the heading is now
  centered over a snap carousel (3 cards per view on desktop, 2 on tablet, 1 on mobile) with
  arrows and dots, replacing the scrolling columns. Larger, roomier glass cards. Unused marquee
  CSS removed · `components/home-concepts/customer-reviews-section.tsx`,
  `components/home-concepts/reviews-carousel.tsx` (new), `app/globals.css`

- **/for-pros-v1 feature tabs: fuller mockups, new Jobs board, live fixed services** — client
  feedback. Dashboard shows 5 important actions; Pipeline columns get a third card with amounts,
  a live count, and a column total; Customers adds a per-customer "Recent activity" card and a
  longer search list with a total; Timesheets adds a "Crew today" card; Leads shows 5 rows with
  stages; Jobs replaces the map/van with a "Today's jobs" card list and a stage-tracker card;
  Schedules event blocks now use the portal calendar's event-card look (accent bar, time tag);
  Payments adds a month summary card. Fixed services cards now load live public fixed services
  (`public/fixed-services`: name, category, price/unit, first uploaded photo) once per page,
  one per category first, falling back to the sample cards if the request fails. Estimate
  untouched (its brief was cut off) · `components/pro-v1/pro-dashboard-mocks.tsx`

- **/home-v3: AI designer shows only the "after" image** — client feedback. The before/after
  drag slider is replaced on home-v3 by the redesigned image alone, with an "AI redesign · style"
  label instead of "Drag to compare". New opt-in `afterOnly` prop on `RedesignerSection`
  (showcase variant), so /home-v1 keeps its slider and the copy/steps are untouched ·
  `components/ai-redesigner/redesigner-section.tsx`, `app/(marketing)/home-v3/page.tsx`

- **/home-v3: customer reviews section replaces the "Peace of mind" timeline** — client spec.
  `PeaceOfMindTimeline` is commented out (file kept). New dark split section right after Browse
  Services: heading, rating summary (average and 5→1 breakdown computed from the reviews shown),
  three trust points, and a "Find a reviewed pro" link on the left; glass review cards (stars,
  verified badge, service, quote, avatar initials) on the right that scroll in slow vertical
  columns from `lg` (one column, two from `xl`; paused on hover, static with reduced motion) and
  become a swipeable row below `lg`. There is no public review feed yet, so the eight reviews are
  labelled samples, in line with /about and /terms; swap in live reviews from completed jobs when
  available · `components/home-concepts/customer-reviews-section.tsx`,
  `app/(marketing)/home-v3/page.tsx`, `app/globals.css` (`rs-review-*`)

- **/home-v3: "Peace of mind" steps redesigned as a timeline card, in the old "next step" spot** —
  client spec. "Your home problem has a next step" is commented out; the seven steps now sit right
  after Browse Services as one "project file" card (numbered icons on a connecting line, title, and
  a status chip with the step's sub-text), horizontal at `xl` and a vertical timeline below. The
  pinned scrolling list is no longer used, so the AI designer now follows Featured Pros on its own
  (`peace-of-mind-list.tsx` kept, unused) · `components/home-concepts/peace-of-mind-timeline.tsx`
  (new), `app/(marketing)/home-v3/page.tsx`.

### 2026-11-03

- **/home-v3: Proof of Control, testimonial strip, and "Ready to solve it?" commented out** — client
  feedback. Hidden on this page only, by commenting out their imports and JSX so they're easy to
  bring back; the components are unchanged · `app/(marketing)/home-v3/page.tsx`.
- **/for-pros-v1 tabs: faster switching, fuller visuals** — client spec. Switching: only the visual
  and copy swap (0.2s fade, was 0.7s on the whole panel), the highlight slides in 0.3s, loops start
  after 0.25s, and animated numbers write straight to the DOM instead of re-rendering per frame;
  background blur removed. Dashboard is now stats, important actions, quick actions, and
  notifications. Employees is an org chart (owner, office, field) with role, pay, and technician
  login. Estimate is wider with status, customer, property, validity, line types, tax, and a
  signature. Fixed services is a price-tagged grid. Payments keeps the card and balance and adds
  Credit card, ACH, Check, and Cash rows. Customers and Invoices gained side panels; the stage
  background is a soft tint with a dot grid. Apple Pay and per-role permission toggles were left
  out because the product has neither · `components/pro-v1/pro-dashboard-mocks.tsx`,
  `components/pro-v1/pro-feature-tabs.tsx`, `app/globals.css`.
- **/for-pros-v1 tabs: new tab style, a different visual and motion per tab** — client feedback
  with a reference: tabs were too heavy, and every panel looked the same. Tabs are now plain text
  with one highlight (white, soft glow, spinning primary-color border) that slides to the active
  tab. The panel is a soft gradient with the visual on the left and copy on a white card. Visuals:
  Dashboard bento with count-ups and a ring, Pipeline card carry, Customers card deck, Employees
  network, Timesheets phone timer, Leads flowing from sources, Estimate paper with a drawn
  signature, Jobs van on a route, Schedules drag with a ripple, Invoices printing receipt with a
  PAID stamp, Payments flipping card and ring, Fixed services marquee, Reports self-drawing chart
  with a phone. All sample data; reduced motion is respected ·
  `components/pro-v1/pro-dashboard-mocks.tsx`, `components/pro-v1/pro-feature-tabs.tsx`,
  `app/globals.css`.
- **/for-pros-v1 tabs: animated working mock-ups instead of scrolling screenshots** — client spec.
  Each of the 14 tabs now plays a short loop of its screen, in portal style with sample data:
  Pipeline drags a card across stages, Schedules drags a job onto a technician, Estimate and
  Invoices build line items and recalculate totals, and AI Receptionist reuses the approved call
  widget. Tabs advance after one pass of the loop. Scroll animation removed;
  `dash-*.webp` captures are no longer used but kept in `public/marketing/pro/` ·
  `components/pro-v1/pro-dashboard-mocks.tsx` (new), `components/pro-v1/pro-feature-tabs.tsx`,
  `components/pro-v1/pro-ai-receptionist.tsx` (`CALL_LOOP_MS`), `components/pro/pro-screenshot.tsx`,
  `app/globals.css`.
- **/for-pros-v1 tabs now use the pro dashboard's own options and real captures** — client: tabs
  must match the sidebar and show our screens, not mock-ups or Workiz's feature names. Fourteen
  sidebar options (in sidebar order), each with a new capture from the live pro portal that scrolls
  slowly like a recording; tabs auto-advance while on screen until one is clicked. Removes Service
  Plans, QuickBooks, and the mock-ups. Captures hide the portal sidebar and header, and customer,
  business, and staff details were swapped for sample data in the browser before capture, because
  the account holds personal details; nothing in the account changed. Messages left out: opening a
  conversation could mark it read · `components/pro-v1/pro-feature-tabs.tsx`,
  `components/pro/pro-screenshot.tsx` (`animated`, default off), `app/globals.css`
  (`rs-shot-move`), `public/marketing/pro/dash-*.webp` (new).
- **/for-pros-v1: feature tabs replace the sections above the "Get started" band** — client spec
  with Workiz references. The portal showcase, AI receptionist, technician, contractor, and team
  sections are off the page (components kept); the hero is now followed by ten pill tabs over one
  panel of copy beside a small mock-up. Workiz's "Genius" names became AI Answering, Business Phone,
  and Marketing. Service Plans and QuickBooks show "Coming soon" because the product has neither.
  Automations copy covers reminders and signed scope → job only, since there are no automated
  customer SMS flows. Business Phone and Marketing use real captures; the AI tab reuses the call
  widget, now exported as `ReceptionistCallCard` · `components/pro-v1/pro-feature-tabs.tsx` (new),
  `components/pro-v1/pro-ai-receptionist.tsx`, `app/(marketing)/for-pros-v1/page.tsx`.
- **/home-v3: "Ready to solve it?" directly above the FAQ; step sub-text on two lines** — client
  request. Proof of Control and the testimonial strip now come before the banner, and the spacer
  above the banner is gone as it no longer follows the AI designer. Proof of Control pins with the
  list so the screen stays filled if the AI designer is off. Step sub-text is narrowed to wrap to
  about 2 even lines · `app/(marketing)/home-v3/page.tsx`,
  `components/home-concepts/peace-of-mind-list.tsx`.

- **/home-v3: Peace of mind list now the 7 steps, no gap while pinned** — client: blank space showed
  below the section while it was pinned, and the list should be the 7 steps, not 10 rows. Dropped
  the 3 assurance rows (`ASSURANCES` private again). The AI designer and "Ready to solve it?" now
  pin with the list, so they fill the screen below it and everything moves up together at the last
  row · `components/home-concepts/peace-of-mind-list.tsx`, `app/(marketing)/home-v3/page.tsx`,
  `components/home-v1/assurance-split.tsx`.

- **/home-v3: Peace of mind section pins while its list scrolls** — client: only the list should
  move until every row has been seen, then the page continues. The wheel listener let the page
  drift, so it was replaced: the section is sticky under the header inside a taller track and page
  scroll drives the list 1:1, for wheel, trackpad, keyboard and touch. Windows too short to fit
  the section fall back to the list's own scroll · `components/home-concepts/peace-of-mind-list.tsx`.

- **/home-v3: Peace of mind list scrolls from anywhere in the section** — client: the wheel should
  move the list with the cursor on the left or right, not only over the list. Non-passive wheel
  listener on the section with eased scrolling; applies only while the list is fully on screen, and
  the page takes over at either end · `components/home-concepts/peace-of-mind-list.tsx`.

- **/home-v3: 7-step section replaced by a scrolling "Peace of mind" list** — client: remove the
  horizontal steps, use v1's "You stay in control at every step", 4 items visible, inner scroll
  with no scrollbar, tighter rows and lighter lines. v1 has only 3 points, so (agreed) the list is
  those 3 then the 7 steps as text rows, 01–10. Native scrolling, so the page continues at the end
  of the list; the visible height is measured to fit exactly 4 rows; a fade hints at more.
  `/home-v1` keeps its own section · new `components/home-concepts/peace-of-mind-list.tsx`,
  `app/(marketing)/home-v3/page.tsx`, `components/home-v1/assurance-split.tsx` (exports
  `ASSURANCES`).

- **/home-v3: space above "Ready to solve it?"** — client: the two dark sections touched, so added
  a gap between the AI designer and the band · `app/(marketing)/home-v3/page.tsx`.

- **/home-v3: testimonial strip moved, v1 AI designer added** — client: Proof of Control and the
  testimonial/stats strip both belong under "Ready to solve it?", so the strip moved there too.
  The AI designer is back, using v1's dark full-width version (not v3's light card), before
  "Ready to solve it?" · `app/(marketing)/home-v3/page.tsx`.

- **/home-v3: removed the "Start with a quote request" band** — client asked to take it out after
  seeing it. "Ready to solve it?" now follows How it works directly. `/home-v1` still shows the
  band · `app/(marketing)/home-v3/page.tsx`.

- **/home-v3 restructure** — client layout request, this page only. Removed the RS AI, on-site
  verified (geofence) and kitchen/bathroom redesigner sections. Featured Pros now follows "Your
  home problem has a next step", with v1's "Built for homeowners" heading and 8 cards (two rows
  of four on desktop). Proof of Control moved directly under "Ready to solve it?". v1's dark blue
  band takes the redesigner's slot, using v1's copy since the client gave none. `/` and `/home-v1`
  are unchanged: the new look is behind `variant="homeowners"`, and the band was only extracted
  as `QuoteBand` · `app/(marketing)/home-v3/page.tsx`,
  `components/home/featured-providers-section.tsx`, `components/home-v1/assurance-split.tsx`.

### 2026-11-02

- **/for-pros-v1 AI receptionist: grey by default, brand blue when active (no green)** — client:
  waveform is grey between lines and blue while someone speaks (caller a lighter blue); done
  steps, check pulse, progress track, "Done/Confirmed" labels, avatar ping and the booked footer
  now use primary blue instead of emerald. Only the small "online" dot in the section badge stays
  green · `components/pro-v1/pro-ai-receptionist.tsx`, `app/globals.css` (`rs-check-pulse` blue).
- **/for-pros-v1 AI receptionist widget made compact, new pattern** — client: the glass widget
  was too tall. Now one short card: caller header (live status, Daniel Reyes, details, timer),
  a slim waveform with the spoken line under it, a horizontal 4-step call log (spinner → pulsing
  green check, track fills green; "Visit booked" Waiting → Confirming… → Confirmed) and a one-line
  status footer that ends on "Added to your Schedule". Bar timings rounded to integers / 2 dp so
  server and client styles match (likely source of the dev "1 issue" hydration warning) ·
  `components/pro-v1/pro-ai-receptionist.tsx`.
- **/for-pros-v1 AI receptionist rebuilt as a frosted-glass "live call" widget** — client spec: glass
  panel over soft animated brand glows; large mirrored voice waveform on top (blue for the AI, green
  for the caller, idle shimmer between lines, live call timer); "Live call active · Daniel Reyes"
  with phone / area / job and the typing transcript; a call-log rail whose steps go queued →
  spinning ring → pulsing green check (rail fills green), "Visit booked" going Waiting → Confirming
  → Confirmed, then an "Added to your Schedule" strip. "Get your AI number" / "See plans" moved
  under the widget. New `rs-wave-idle`, `rs-check-pulse`, `rs-glow` keyframes (reduced-motion
  safe) · `components/pro-v1/pro-ai-receptionist.tsx`, `app/globals.css`.
- **/for-pros-v1 technician + contractor previews in the pro brand blue** — client request: the
  technician mock (was indigo/violet) and the contractor mock + sign-in card (was slate/teal) now use
  brand blue #003F7D for the sidebar, buttons, accents and tints (fixed hex, so dark mode doesn't
  shift them); only the small green "live" dot stays · `components/pro-v1/pro-field-portals.tsx`.
- **/for-pros-v1 quote + "Open your account" CTA moved mid-page, full width** — client request:
  it now sits between the team / field portals and the Pipeline as an edge-to-edge brand band
  (no rounded card, content in the page container). `ProClose` got a `band` option (default off,
  so /for-pros keeps the rounded card at the bottom) · `components/pro/pro-close.tsx`,
  `app/(marketing)/for-pros-v1/page.tsx`.
- **/for-pros-v1 closing section restored** — the client wants the original closing CTA (customer
  quote + "Open your account today", Create your account / Log in) back, so the compact banner
  (`pro-close-v1.tsx`) was removed and the shared `ProClose` is used again ·
  `app/(marketing)/for-pros-v1/page.tsx`.
- **/for-pros-v1 final layout pass** — new compact closing CTA: one full-width brand banner in the
  page container (heading + assurances left, Start free / Log in right) instead of the tall shared
  quote block. Tighter page rhythm (`.pros-v1 .section-space` 3rem / 4rem); process rail gets a
  `compact` option (smaller gaps, brand-blue trade icons) used only here, its extra wrapper padding
  removed; FAQ wrapper padding removed; tighter technician / contractor feature rows. Brand blue for
  pricing checkmarks and the AI caller avatar; green kept only for live / done status ·
  `components/pro-v1/pro-close-v1.tsx` (new), `components/pro/pro-product.tsx` (`compact` prop,
  default off so /for-pros is unchanged), `components/pro-v1/pro-field-portals.tsx`,
  `pro-pricing-v1.tsx`, `pro-ai-receptionist.tsx`, `app/(marketing)/for-pros-v1/page.tsx`,
  `app/globals.css`.
- **/for-pros-v1 client review refinements** —
  Contractor: preview first (left on desktop, first on smaller screens), copy accents in the brand
  blue (badge, icons, button). Technician: the tilted sign-in card + dashboard replaced by one
  clean technician dashboard in the same light browser frame as the real captures (dark sidebar,
  live JOB-333 timer, greeting, clocked-in bar, stats, schedule, pay); brand-blue accents in the
  copy. Pricing: four separate cards with soft borders and shadows, the popular plan outlined in
  blue. Spacing: page-only tighter rhythm (`.pros-v1 .section-space` 3.5rem / 4.5rem), smaller
  process-rail and FAQ padding, tighter inner gaps in the showcase, pipeline, team, and pricing ·
  `components/pro-v1/pro-field-portals.tsx`, `pro-pricing-v1.tsx`, `pro-showcase.tsx`,
  `pro-pipeline-section.tsx`, `pro-office-sections.tsx`, `app/(marketing)/for-pros-v1/page.tsx`,
  `app/globals.css`.
- **/for-pros-v1 AI receptionist: live call log with status badges** — steps read "Caller
  identified", "Job captured", "Address verified", "Visit booked", each with a Queued → Working →
  Done badge, a spinner then a check, and its detail sliding in; taller waveform and roomier
  padding · `components/pro-v1/pro-ai-receptionist.tsx`.
- **/for-pros-v1 AI receptionist: compact live-call card** — first try (big voice orb + week
  calendar) was too tall and loose, so it's now a split section: copy with three checkpoints +
  CTAs, and one compact card — caller with a pulse ring and live timer, a slim waveform (blue AI /
  green caller), the spoken line typing out, an "AI actions" checklist that ticks off (caller,
  job, area, visit booked), and an "Added to your Schedule" toast that slides in. Loops only on
  screen; reduced motion shows the booked state · `components/pro-v1/pro-ai-receptionist.tsx`.
- **Backend got its own project log** — `request-service-backend/PROJECT_LOG.md` (backend
  overview, modules, conventions, backend changes); this log points to it for backend details.
- **Project log moved into the webapp** — now `request_service_webapp/PROJECT_LOG.md` (was the
  repo root); still covers backend, webapp, and admin · `PROJECT_LOG.md`, root `CLAUDE.md`.
- **Project log added; removed unused Markdown** — removed `request_service_webapp/AGENTS.md`,
  `CLAUDE.md`, `README.md`, `SCHEDULE_README.md` (`AGENTS.md` is re-created by `next dev`).
  This file is now the single project record · `PROJECT_LOG.md`.
- **/for-pros-v1 final hierarchy** — Hero → CRM portal showcase → AI receptionist → Technician /
  Contractor / Team (timesheets, live tracking) → Pipeline + workflow → Pricing → FAQ → final CTA.
  Strict white / soft-grey alternation, shared section spacing everywhere (shared "tight" sections
  padded on this page only), "Also in the portal" removed from this page ·
  `app/(marketing)/for-pros-v1/page.tsx`, `components/pro-v1/*`.
- **Dark mode fix for light tints, app-wide** — pale rows / pills / note boxes with washed-out
  text in dark mode (customer Orders change-order rows, technician, contractor, pro). One
  generated stylesheet turns them into soft translucent tints with readable text ·
  `app/dark-tints.css`, `app/globals.css`; `data-light` on landing-page mock-ups.
- **/for-pros-v1 compact sections** — AI receptionist and Employees/Timesheets/Tracking rebuilt
  smaller: heading row, 2×2 feature cards, one compact preview ·
  `components/pro-v1/pro-ai-receptionist.tsx`, `components/pro-v1/pro-office-sections.tsx`.
- **Customer payment receipt is email-only** — the customer no longer gets a bell item / badge
  for their own payment · `request-service-backend/src/modules/users/service.js`.
- **Invoice & payment notifications + pro sidebar badges** — Pro gets an in-app "Invoice sent"
  confirmation and an Invoices badge; when a customer pays, the Pro gets bell + Payments badge +
  email, and the customer gets an email receipt. New `invoices` / `payments` notification sections
  (fixed-service order payments stay under Orders) · backend `notification/sections.js`,
  `notification/validation.js`, `crm/invoices/service.js`, `users/service.js`,
  `crm/chat/service.js`, `websocket/index.js`; webapp `components/portal/portal-shell.tsx`,
  `use-portal-inbox.ts`, `portal-inbox-counts-store.ts`, `lib/api/notifications-client.ts`.
- **Customers never see draft invoices** — "View invoice" showed for a draft and opened "Invoice
  not found"; an "invoiced" job also read as Settled. Now the link appears only once the invoice
  is sent, and the job reads Completed until then (orders list + detail) ·
  `request-service-backend/src/modules/order/service.js`.
- **Customer order header buttons** — kept on one row on wide screens ·
  `components/account/customer-order-detail-view.tsx`, `customer-change-order-detail-view.tsx`.
- **Technician: Mark complete with photo proof** — new `POST /api/technician/jobs/:id/completion`
  (photos required, notes optional, running timer clocked out). Goes to the office as
  `pending_pro_approval`; approving marks the job completed. Banner shows waiting / re-work /
  approved. Office approve and re-work notifications for technicians fixed ·
  backend `technician/service.js`, `technician/routes.js`, `crm/contractor-requests/service.js`;
  webapp `components/technician/tech-job-completion.tsx`, technician job detail view,
  `lib/api/technician-client.ts`, `lib/api/contractor-portal-client.ts`, `ApiRoutesFile.ts`.
- **Technician clock-in locked after completion** — locked while the office reviews, locked for
  good once approved, open again after a rejection (enforced in the API and the UI).
- **Technician check-in activity** — per job: first check-in, last check-out, sessions, total
  worked, and a session table; sits under Job information.
- **Technician jobs list opens on "All"** — completed jobs stay visible ·
  `components/technician/views/technician-jobs-view.tsx`.
- **Schedule job status badges** — Scheduled / In progress / Completed / Late / Cancelled / On
  hold on job cards (technician schedule) · `components/portal/event-calendar.tsx`,
  `lib/data/portal.ts`, `components/technician/views/technician-schedule-view.tsx`.
- **/for-pros-v1 new sections** — Technician portal, Contractor portal (matches the real portal,
  pro navy → later light), Pipeline (auto-moving card through the five real columns),
  Employees/Timesheets/Tracking; tabbed team section replaced; light, minimal restyle (no dark
  bands, grid lines or glow blobs) · `components/pro-v1/pro-field-portals.tsx`,
  `pro-pipeline-section.tsx`, `pro-office-sections.tsx`.
- **RS AI Assistant hidden on all /for-pros pages** — it is for customers only ·
  `components/layout/marketing-shell.tsx`.
- **/for-pros-v1 polish** — AI receptionist redesigned; pricing shows AI voice minutes, AI
  business number, crew logins, subcontractor portal from live plan data. "Multi-location" not
  added (not a product or plan feature) · `components/pro-v1/pro-pricing-v1.tsx`,
  `lib/constants/subscription-plans.ts`.
- **Pro Pipeline (Kanban)** — own page `/pro/dashboard/pipeline` (sidebar under Dashboard):
  Leads → Estimates → Scheduled jobs (Booked) → Jobs in progress → Invoices, drag & drop
  (`@hello-pangea/dnd`, dragged card portaled to body), booking dialog with date/time, PATCH APIs
  using the existing estimate-v2 / schedule / job / invoice services and notifications, socket.io
  sync, 10 cards per column with "See more", server-side search (customer, EST-/JOB- numbers,
  status), estimates match the Estimates tab · backend `modules/crm/pipeline/*`,
  `utils/pipelineRealtime.js`; webapp `store/pipelineSlice.ts`, `components/portal/pipeline/*`,
  `lib/api/pipeline-client.ts`, `components/portal/views/pipeline-view.tsx`.
