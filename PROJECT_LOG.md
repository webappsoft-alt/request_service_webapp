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

### 2026-11-03

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
