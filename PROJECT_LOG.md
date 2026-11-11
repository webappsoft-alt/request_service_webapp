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

### 2026-11-11

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
