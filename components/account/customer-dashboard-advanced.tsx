"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  LifeBuoy,
  MessageCircle,
  Plus,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ENTER_CLASS, enterStyle } from "@/components/account/customer-dashboard-widgets";
import { customerPaths } from "@/lib/customer-paths";
import { formatMoney, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Advanced customer overview pieces (client: "upgrade the customer dashboard"):
 *  - CustomerHeroSummary: navy summary band — balance due, next visit, what needs you, quick actions;
 *  - CustomerActionCenter: one "Needs your attention" list (estimates to review, change orders to
 *    approve, invoices due / overdue, unread messages), each row with its own action — the customer
 *    version of the Pro dashboard's Important actions.
 * Pure presentation over data the overview already loads (no new requests).
 */

type EstimateLike = {
  id: string;
  status: string;
  title?: string | null;
  number?: string | null;
  total?: number | null;
  shareToken?: string | null;
  createdAt?: string | null;
  provider?: { companyName?: string | null } | null;
};
type InvoiceLike = {
  id: string;
  number: string;
  status: string;
  total: number;
  balanceDue: number;
  dueAt?: string | null;
  provider?: { companyName?: string | null } | null;
};
type ChangeOrderLike = {
  id: string;
  jobId: string;
  number?: string | null;
  jobNumber?: string | null;
  title?: string | null;
  amount?: number | null;
};
export type NextVisit = { title: string; when: string; href: string } | null;

const REVIEW_STATUSES = ["sent", "finalized", "changes_requested"];
const DUE_STATUSES = ["sent", "partially_paid", "overdue"];

function isOverdue(invoice: InvoiceLike) {
  if (invoice.status === "overdue") return true;
  return Boolean(invoice.dueAt && new Date(invoice.dueAt).getTime() < Date.now());
}

/* ───────────────────────── hero summary ───────────────────────── */

export function CustomerHeroSummary({
  outstanding,
  dueCount,
  nextVisit,
  attentionCount,
  activeProjects,
}: {
  outstanding: number;
  dueCount: number;
  nextVisit: NextVisit;
  attentionCount: number;
  activeProjects: number;
}) {
  const quick: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Request a quote", href: customerPaths.estimateRequest, icon: Plus },
    { label: "Message a pro", href: customerPaths.messages, icon: MessageCircle },
    { label: "Pay an invoice", href: customerPaths.invoices, icon: CreditCard },
    { label: "Get support", href: customerPaths.support, icon: LifeBuoy },
  ];
  return (
    <section
      style={enterStyle(0)}
      className={cn(
        ENTER_CLASS,
        "relative overflow-hidden rounded-xl bg-[#003F7D] p-5 text-white shadow-sm sm:p-6 dark:bg-slate-900 dark:ring-1 dark:ring-border",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white/10 p-3.5 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-white/70 uppercase">
              <Wallet className="size-3.5" aria-hidden /> Balance due
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{formatMoney(outstanding)}</p>
            <p className="text-xs text-white/70">
              {dueCount ? `${dueCount} invoice${dueCount === 1 ? "" : "s"} to pay` : "You're all paid up"}
            </p>
          </div>
          <div className="rounded-lg bg-white/10 p-3.5 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-white/70 uppercase">
              <CalendarClock className="size-3.5" aria-hidden /> Next visit
            </p>
            {nextVisit ? (
              <Link href={nextVisit.href} className="group mt-1.5 block">
                <p className="truncate text-base font-semibold group-hover:underline">{nextVisit.when}</p>
                <p className="truncate text-xs text-white/70">{nextVisit.title}</p>
              </Link>
            ) : (
              <>
                <p className="mt-1.5 text-base font-semibold">Nothing scheduled</p>
                <p className="text-xs text-white/70">Booked visits show here</p>
              </>
            )}
          </div>
          <div className="rounded-lg bg-white/10 p-3.5 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-white/70 uppercase">
              <CheckCircle2 className="size-3.5" aria-hidden /> Your projects
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{activeProjects}</p>
            <p className="text-xs text-white/70">
              {attentionCount ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need you` : "Nothing needs you right now"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:w-72">
          {quick.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-[#003F7D] shadow-sm transition hover:bg-white/90 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── action center ───────────────────────── */

type ActionRow = {
  key: string;
  tag: string;
  tone: "amber" | "rose" | "blue" | "violet";
  icon: LucideIcon;
  title: string;
  meta: string;
  amount?: string;
  cta: string;
  href: string;
  sort: number;
};

const TONE: Record<ActionRow["tone"], { icon: string; tag: string }> = {
  amber: { icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300", tag: "text-amber-700 dark:text-amber-300" },
  rose: { icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300", tag: "text-rose-700 dark:text-rose-300" },
  blue: { icon: "bg-primary/10 text-primary", tag: "text-primary" },
  violet: { icon: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300", tag: "text-violet-700 dark:text-violet-300" },
};

export function buildCustomerActions({
  estimates,
  invoices,
  changeOrders,
  unreadMessages,
}: {
  estimates: EstimateLike[];
  invoices: InvoiceLike[];
  changeOrders: ChangeOrderLike[];
  unreadMessages: number;
}): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const co of changeOrders) {
    rows.push({
      key: `co-${co.jobId}-${co.id}`,
      tag: "Change order",
      tone: "amber",
      icon: Wrench,
      title: `${co.number || "Change order"}${co.jobNumber ? ` · ${co.jobNumber}` : ""}`,
      meta: co.title || "Extra work waiting for your approval",
      amount: co.amount ? `+${formatMoney(co.amount)}` : undefined,
      cta: "Review",
      href: customerPaths.changeOrder(co.jobId, co.id),
      sort: 1,
    });
  }
  for (const invoice of invoices) {
    if (!DUE_STATUSES.includes(invoice.status) || !(invoice.balanceDue > 0)) continue;
    const overdue = isOverdue(invoice);
    rows.push({
      key: `inv-${invoice.id}`,
      tag: overdue ? "Overdue invoice" : "Invoice due",
      tone: overdue ? "rose" : "blue",
      icon: CreditCard,
      title: invoice.number,
      meta: `${invoice.provider?.companyName || "Your professional"}${invoice.dueAt ? ` · due ${formatShortDate(invoice.dueAt)}` : ""}`,
      amount: formatMoney(invoice.balanceDue),
      cta: "Pay",
      href: customerPaths.invoice(invoice.id),
      sort: overdue ? 0 : 3,
    });
  }
  for (const estimate of estimates) {
    if (!REVIEW_STATUSES.includes(estimate.status)) continue;
    rows.push({
      key: `est-${estimate.id}`,
      tag: estimate.status === "changes_requested" ? "Estimate updated" : "Estimate to review",
      tone: "violet",
      icon: FileText,
      title: estimate.title || estimate.number || "Estimate",
      meta: `${estimate.provider?.companyName || "Service professional"}${estimate.createdAt ? ` · ${formatShortDate(estimate.createdAt)}` : ""}`,
      amount: estimate.total ? formatMoney(estimate.total) : undefined,
      cta: "Review",
      href: estimate.shareToken ? customerPaths.estimate(estimate.shareToken) : customerPaths.estimates,
      sort: 2,
    });
  }
  if (unreadMessages > 0) {
    rows.push({
      key: "messages",
      tag: "Messages",
      tone: "blue",
      icon: MessageCircle,
      title: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`,
      meta: "Your pros are waiting for a reply",
      cta: "Reply",
      href: customerPaths.messages,
      sort: 4,
    });
  }
  return rows.sort((a, b) => a.sort - b.sort);
}

export function CustomerActionCenter({ rows, loading, index = 1 }: { rows: ActionRow[]; loading?: boolean; index?: number }) {
  const shown = rows.slice(0, 6);
  return (
    <section style={enterStyle(index)} className={cn(ENTER_CLASS, "overflow-hidden rounded-xl border border-input bg-card shadow-sm")}>
      <div className="flex items-center justify-between gap-3 border-b border-input px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Needs your attention</h2>
          <p className="text-xs text-muted-foreground">Approvals, payments and replies waiting on you</p>
        </div>
        {rows.length ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">{rows.length}</span>
        ) : null}
      </div>
      {shown.length ? (
        <ul className="divide-y divide-input">
          {shown.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.key}>
                <Link href={row.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE[row.tone].icon)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[10px] font-semibold tracking-wider uppercase", TONE[row.tone].tag)}>{row.tag}</span>
                    <span className="block truncate text-sm font-medium text-foreground">{row.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.meta}</span>
                  </span>
                  {row.amount ? <span className="hidden text-sm font-semibold tabular-nums sm:block">{row.amount}</span> : null}
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition group-hover:bg-primary/90">
                    {row.cta}
                    <ArrowRight className="size-3" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <CheckCircle2 className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">{loading ? "Checking your account…" : "You're all caught up"}</p>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading estimates, invoices and messages." : "New estimates, change orders and invoices will show up here."}
            </p>
          </div>
        </div>
      )}
      {rows.length > shown.length ? (
        <p className="border-t border-input px-5 py-2.5 text-xs text-muted-foreground">+{rows.length - shown.length} more below</p>
      ) : null}
    </section>
  );
}

/* ───────────────────────── v2 (client polish): compact stats + estimates queue ───────────────────────── */
/* The hero band and "Needs your attention" above are no longer rendered (client: too dark /
   pushed content down; remove the attention list). Kept for reference. */

// Muted palette (client): brand blue by default, amber only when money is due.
const STAT_TONES = {
  primary: "bg-primary/10 text-primary",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
} as const;

/** Small soft KPI card: icon tile + label on one line, value, one-line note. */
export function CompactStat({
  label,
  value,
  note,
  href,
  icon: Icon,
  tone = "primary",
  loading,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  href: string;
  icon: LucideIcon;
  tone?: keyof typeof STAT_TONES;
  loading?: boolean;
  index?: number;
}) {
  return (
    <Link
      href={href}
      style={enterStyle(index)}
      className={cn(
        ENTER_CLASS,
        "group flex min-w-0 flex-col gap-2 rounded-xl border border-input bg-card px-3.5 py-3 shadow-xs transition hover:-translate-y-px hover:border-primary/30 hover:shadow-sm",
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", STAT_TONES[tone])}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
      </span>
      <span className="truncate text-xl leading-none font-semibold tracking-tight tabular-nums">
        {loading ? <span className="inline-block h-5 w-10 animate-pulse rounded bg-muted align-middle" /> : value}
      </span>
      {note ? <span className="truncate text-xs text-muted-foreground">{note}</span> : null}
    </Link>
  );
}

/**
 * "Estimates to review" — a decision queue, visually distinct from Active projects (violet accent,
 * price-first rows with a solid Review button). Only estimates waiting on the customer.
 */
export function CustomerEstimatesToReview({
  estimates,
  loading,
  className,
}: {
  estimates: EstimateLike[];
  loading?: boolean;
  className?: string;
}) {
  const waiting = estimates.filter((item) => REVIEW_STATUSES.includes(item.status));
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-xl border border-input bg-card shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-input px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
            <FileText className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Estimates to review</h3>
            <p className="text-xs text-muted-foreground">Waiting for your decision</p>
          </div>
          {waiting.length ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {waiting.length}
            </span>
          ) : null}
        </div>
        <Link href={customerPaths.estimates} className="text-xs font-medium text-primary hover:text-primary/80">
          View all
        </Link>
      </div>
      {waiting.length ? (
        <ul className="divide-y divide-input">
          {waiting.slice(0, 4).map((item) => (
            <li key={item.id}>
              <Link
                href={item.shareToken ? customerPaths.estimate(item.shareToken) : customerPaths.estimates}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{item.title || item.number || "Estimate"}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-px text-[10px] font-semibold",
                        item.status === "changes_requested"
                          ? "border border-amber-200 text-amber-700 dark:border-amber-500/30 dark:text-amber-300"
                          : "border border-input text-muted-foreground",
                      )}
                    >
                      {item.status === "changes_requested" ? "Updated" : "New"}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.number ? `${item.number} · ` : ""}
                    {item.provider?.companyName || "Service professional"}
                    {item.createdAt ? ` · ${formatShortDate(item.createdAt)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums">{item.total ? formatMoney(item.total) : "—"}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition group-hover:border-primary/40 group-hover:text-primary">
                  Review
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CheckCircle2 className="size-4.5" aria-hidden />
          </span>
          <p className="text-sm font-medium">{loading ? "Loading estimates…" : "Nothing to review"}</p>
          <p className="max-w-xs text-xs text-muted-foreground">New estimates from your pros will show up here.</p>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── v3: calm insight cards (replace the big donut / coloured bars) ───────────────────────── */

function InsightShell({ title, subtitle, href, children }: { title: string; subtitle: string; href: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-input bg-card px-4 py-3.5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Link href={href} className="text-xs font-medium text-primary hover:text-primary/80">
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}

/** Spending: total, one thin paid/outstanding bar and two figures — no big donut (client). */
export function SpendingInsight({ paid, outstanding }: { paid: number; outstanding: number }) {
  const total = paid + outstanding;
  const share = total ? Math.round((paid / total) * 100) : 0;
  return (
    <InsightShell title="Spending" subtitle="Invoices paid vs. still due" href={customerPaths.invoices}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Total invoiced</p>
          <p className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">{formatMoney(total)}</p>
        </div>
        <span className="rounded-full border border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {total ? `${share}% paid` : "No invoices yet"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary/80 transition-[width] duration-700" style={{ width: `${share}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary/80" /> Paid
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(paid)}</dd>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/40" /> Outstanding
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(outstanding)}</dd>
        </div>
      </dl>
    </InsightShell>
  );
}

/** Estimates by status: one muted stacked bar (shades of brand blue / grey) and a 4-up legend. */
export function EstimateInsight({ segments }: { segments: { label: string; value: number }[] }) {
  const shades = ["bg-primary/45", "bg-primary/85", "bg-muted-foreground/35", "bg-muted-foreground/15"];
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  return (
    <InsightShell title="Estimates" subtitle="Where your proposals stand" href={customerPaths.estimates}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Total estimates</p>
          <p className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">{total}</p>
        </div>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {total
          ? segments.map((item, index) =>
              item.value ? (
                <span key={item.label} className={cn("h-full transition-[width] duration-700", shades[index])} style={{ width: `${(item.value / total) * 100}%` }} />
              ) : null,
            )
          : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {segments.map((item, index) => (
          <div key={item.label} className="rounded-lg bg-muted/50 px-3 py-2">
            <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className={cn("size-2 shrink-0 rounded-full", shades[index])} /> {item.label}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </InsightShell>
  );
}
