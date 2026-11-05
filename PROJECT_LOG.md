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
