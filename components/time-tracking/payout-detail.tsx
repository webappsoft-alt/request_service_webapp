"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Clock3, Receipt, Wallet } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { StatusPill } from "@/components/portal/status-pill";
import { PaidStamp } from "@/components/print/paid-stamp";
import { PrintReceiptButton, type PaymentReceiptData } from "@/components/print/payment-receipt";
import { formatDate, formatMoney } from "@/lib/format";
import { formatClockTime, formatEntryDate, formatExactDuration } from "@/lib/time-tracking";
import { cn } from "@/lib/utils";

export type PayoutSession = {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  seconds: number;
  pay: number;
};

export type PayoutRow = {
  id: string;
  number: string;
  paidAt: string;
  method: string;
  amount: number;
  href?: string;
};

export type PayoutDetailProps = {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  payment: {
    id: string;
    number: string;
    amount: number;
    method: string;
    paidAt: string;
    reference?: string;
    notes?: string;
  };
  /** The business that paid (PAID seal + receipt letterhead). */
  company: { name: string; phone?: string; email?: string };
  /** Who was paid (the technician / contractor). */
  payeeName: string;
  /** The job / fixed service order / estimate the payment was for. */
  record: { kindLabel: string; number: string; title?: string; status?: string; href?: string } | null;
  /** Balance on that record. */
  summary: { earned: number; paid: number; remaining: number } | null;
  /** e.g. "$1.00 / hr" or "Fixed $150.00". */
  payRate?: string;
  sessions: PayoutSession[];
  payouts: PayoutRow[];
  actions?: ReactNode;
};

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <div className="truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

/** Receipt data for a payout (balance + time sessions + pay rate). */
export function payoutReceipt(props: PayoutDetailProps): PaymentReceiptData {
  const totalSeconds = props.sessions.reduce((sum, row) => sum + row.seconds, 0);
  return {
    number: props.payment.number || "Payment",
    title: "Payout receipt",
    amount: props.payment.amount,
    paid: true,
    statusLabel: "Paid",
    method: props.payment.method,
    paidAt: props.payment.paidAt,
    reference: props.payment.reference || undefined,
    recordLabel: props.record
      ? [`${props.record.kindLabel} ${props.record.number}`.trim(), props.record.title].filter(Boolean).join(" · ")
      : undefined,
    payRate: props.payRate,
    from: {
      label: "Paid by",
      name: props.company.name || "The business",
      lines: [props.company.phone, props.company.email].filter(Boolean) as string[],
    },
    to: { label: "Paid to", name: props.payeeName },
    summary: props.summary || undefined,
    sessions: props.sessions.map((row) => ({
      date: formatEntryDate(row.clockInAt),
      start: formatClockTime(row.clockInAt),
      end: row.clockOutAt ? formatClockTime(row.clockOutAt) : "—",
      duration: formatExactDuration(row.seconds),
      pay: row.pay,
    })),
    sessionsTotal: props.sessions.length ? formatExactDuration(totalSeconds) : undefined,
    notes: props.payment.notes || undefined,
  };
}

/**
 * Payout detail (technician "My payments" / contractor "Payouts" → a payment): the payment with a PAID
 * seal from the business, the job / order it paid, that work's balance (earned · paid · pending), the
 * clock-in sessions behind it and every payout on it. Print / PDF gives the same as a receipt.
 */
export function PayoutDetailView(props: PayoutDetailProps) {
  const { payment, record, summary, sessions, payouts } = props;
  const totalSeconds = sessions.reduce((sum, row) => sum + row.seconds, 0);
  const totalPay = sessions.reduce((sum, row) => sum + row.pay, 0);
  const paidPercent = summary && summary.earned > 0 ? Math.min(100, Math.round((summary.paid / summary.earned) * 100)) : 100;

  return (
    <PortalPage
      backHref={props.backHref}
      backLabel={props.backLabel}
      eyebrow={props.eyebrow}
      title={payment.number || "Payment"}
      description={`Paid to ${props.payeeName} by ${props.company.name || "the business"}`}
      badge={<StatusPill tone="success" label="Paid" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PrintReceiptButton data={payoutReceipt(props)} />
          {props.actions}
        </div>
      }
    >
      {/* Hero: amount + PAID seal */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-input bg-card p-5 shadow-xs sm:p-6">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Amount paid</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-[#003F7D] tabular-nums">{formatMoney(payment.amount)}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Fact icon={<CalendarClock className="size-4" />} label="Paid on" value={payment.paidAt ? formatDate(payment.paidAt) : "—"} />
            <Fact icon={<Wallet className="size-4" />} label="Method" value={payment.method || "—"} />
            <Fact icon={<Receipt className="size-4" />} label="Reference" value={payment.reference || "—"} />
          </div>
        </div>
        <PaidStamp size="lg" company={props.company.name} date={payment.paidAt} className="mx-auto sm:mx-0" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* What it paid for */}
        <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
          <p className="text-sm font-semibold text-foreground">Paid for</p>
          {record ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{record.kindLabel}</span>
                {record.href ? (
                  <Link href={record.href} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                    {record.number}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                ) : (
                  <span className="font-semibold">{record.number}</span>
                )}
                {record.status ? (
                  <span className="text-xs text-muted-foreground capitalize">
                    {record.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                ) : null}
              </div>
              {record.title ? <p className="text-sm text-foreground">{record.title}</p> : null}
              {props.payRate ? (
                <p className="text-sm text-muted-foreground">
                  Pay rate <span className="font-medium text-foreground">{props.payRate}</span>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">General payment (not linked to a job).</p>
          )}
        </section>

        {/* Balance for that work */}
        <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
          <p className="text-sm font-semibold text-foreground">Balance for this work</p>
          {summary ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Earned</p>
                  <p className="text-xl font-semibold tabular-nums">{formatMoney(summary.earned)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Paid to you</p>
                  <p className="text-xl font-semibold tabular-nums text-emerald-700">{formatMoney(summary.paid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Pending</p>
                  <p className={cn("text-xl font-semibold tabular-nums", summary.remaining > 0 ? "text-amber-700" : "text-muted-foreground")}>
                    {formatMoney(summary.remaining)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${paidPercent}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {summary.remaining > 0
                    ? `${paidPercent}% paid · ${formatMoney(summary.remaining)} still owed by the office`
                    : "Fully paid — nothing pending on this work."}
                </p>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No balance to show.</p>
          )}
        </section>
      </div>

      {/* Time sessions */}
      <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock3 className="size-4 text-primary" /> Time sessions
          </p>
          {sessions.length ? (
            <p className="text-xs text-muted-foreground">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} · {formatExactDuration(totalSeconds)} · {formatMoney(totalPay)} earned
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          <PortalDataTable
            filename={`${payment.number || "payment"}-sessions`}
            countLabel="Sessions"
            hideSearch
            empty={props.payRate?.startsWith("Fixed") ? "Fixed-price work — no hourly sessions." : "No clock-in sessions for this work."}
            rows={sessions}
            rowKey={(row) => row.id}
            columns={[
              { id: "date", header: "Date", sortValue: (row) => row.clockInAt, exportValue: (row) => formatEntryDate(row.clockInAt), cell: (row) => formatEntryDate(row.clockInAt) },
              { id: "start", header: "Start", exportValue: (row) => formatClockTime(row.clockInAt), cell: (row) => <span className="tabular-nums">{formatClockTime(row.clockInAt)}</span> },
              {
                id: "end",
                header: "End",
                exportValue: (row) => (row.clockOutAt ? formatClockTime(row.clockOutAt) : ""),
                cell: (row) => <span className="tabular-nums">{row.clockOutAt ? formatClockTime(row.clockOutAt) : "—"}</span>,
              },
              {
                id: "duration",
                header: "Duration",
                sortValue: (row) => row.seconds,
                exportValue: (row) => formatExactDuration(row.seconds),
                cell: (row) => <span className="tabular-nums">{formatExactDuration(row.seconds)}</span>,
              },
              {
                id: "pay",
                header: "Pay",
                sortValue: (row) => row.pay,
                exportValue: (row) => row.pay.toFixed(2),
                cell: (row) => <span className="font-semibold tabular-nums">{formatMoney(row.pay)}</span>,
              },
            ]}
          />
        </div>
      </section>

      {/* Payouts on this work */}
      {payouts.length ? (
        <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
          <p className="text-sm font-semibold text-foreground">Payments for this work ({payouts.length})</p>
          <ul className="mt-3 divide-y divide-border-soft">
            {payouts.map((row) => {
              const current = row.id === payment.id;
              const label = (
                <span className={cn("font-medium", current ? "text-foreground" : "text-primary")}>{row.number || "Payment"}</span>
              );
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {row.href && !current ? (
                      <Link href={row.href} className="hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                    {current ? <StatusPill tone="primary" label="This payment" /> : null}
                    <span className="text-xs text-muted-foreground">
                      {row.paidAt ? formatDate(row.paidAt) : ""} · {row.method}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">{formatMoney(row.amount)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {payment.notes ? (
        <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
          <p className="text-sm font-semibold text-foreground">Notes</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{payment.notes}</p>
        </section>
      ) : null}
    </PortalPage>
  );
}
