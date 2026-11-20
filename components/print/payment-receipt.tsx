"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { PaidStamp } from "@/components/print/paid-stamp";
import { PrintPortal } from "@/components/print/print-portal";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PaymentReceiptData = {
  /** e.g. "PMT-495C9F" */
  number: string;
  /** "Payment receipt" (customer / Pro) or "Payout receipt" (technician / contractor). */
  title?: string;
  amount: number;
  /** Paid / settled — shows the PAID stamp. */
  paid: boolean;
  statusLabel: string;
  method?: string;
  paidAt?: string | null;
  reference?: string;
  invoiceNumber?: string;
  /** Job / order the payment is for. */
  recordLabel?: string;
  /** Who received the money (the business, or the technician / contractor for payouts). */
  from: { label: string; name: string; lines?: string[] };
  /** Who paid (the customer, or the business for payouts). */
  to: { label: string; name: string; lines?: string[] };
  notes?: string;
  /** Payouts: the worker's pay rate (e.g. "$25.00 / hr"). */
  payRate?: string;
  /** Payouts: balance for the job / order this payment was for. */
  summary?: { earned: number; paid: number; remaining: number };
  /** Payouts: the clock-in sessions the pay was earned on. */
  sessions?: Array<{ date: string; start: string; end: string; duration: string; pay: number }>;
  /** Total hours of `sessions` (e.g. "0h 14m"). */
  sessionsTotal?: string;
};

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-slate-200 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

/** Printable receipt (letter / A4) with a PAID stamp when settled. Rendered inside PrintPortal. */
export function PaymentReceiptDocument({ data }: { data: PaymentReceiptData }) {
  return (
    <article className="relative mx-auto max-w-[720px] bg-white p-8 text-[12px] leading-5 text-slate-900">
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#003F7D] pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{data.from.label}</p>
          <p className="text-[17px] font-semibold">{data.from.name}</p>
          {(data.from.lines || []).filter(Boolean).map((line) => (
            <p key={line} className="text-[11px] text-slate-600">
              {line}
            </p>
          ))}
        </div>
        <div className="text-right">
          <p className="text-[20px] font-bold tracking-[0.18em] text-[#003F7D] uppercase">{data.title || "Payment receipt"}</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{data.number}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{data.to.label}</p>
        <p className="text-[14px] font-semibold">{data.to.name}</p>
        {(data.to.lines || []).filter(Boolean).map((line) => (
          <p key={line} className="text-[11px] text-slate-600">
            {line}
          </p>
        ))}
      </section>

      <section className="mt-6 flex items-center justify-between gap-6 rounded-md border border-slate-200 bg-slate-50 px-5 py-4 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Amount</p>
          <p className="text-[28px] font-bold tabular-nums">{formatMoney(data.amount)}</p>
        </div>
        {data.paid ? <PaidStamp date={data.paidAt} company={data.from.name} size="md" /> : null}
      </section>

      <section className="mt-5 text-[12px]">
        <Row label="Status" value={data.statusLabel} />
        <Row label="Paid on" value={data.paidAt ? formatDate(data.paidAt) : undefined} />
        <Row label="Method" value={data.method} />
        <Row label="Reference" value={data.reference} />
        <Row label="Invoice" value={data.invoiceNumber} />
        <Row label="For" value={data.recordLabel} />
        <Row label="Pay rate" value={data.payRate} />
      </section>

      {data.summary ? (
        <section className="mt-6 break-inside-avoid">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#003F7D] uppercase">Balance for this work</p>
          <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-md border border-slate-200 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
            {[
              { label: "Earned", value: data.summary.earned, tone: "text-slate-900" },
              { label: "Paid to date", value: data.summary.paid, tone: "text-emerald-700" },
              { label: "Pending", value: data.summary.remaining, tone: data.summary.remaining > 0 ? "text-amber-700" : "text-slate-500" },
            ].map((cell, index) => (
              <div key={cell.label} className={cn("px-4 py-3", index > 0 && "border-l border-slate-200")}>
                <p className="text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase">{cell.label}</p>
                <p className={cn("text-[16px] font-bold tabular-nums", cell.tone)}>{formatMoney(cell.value)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.sessions?.length ? (
        <section className="mt-6 break-inside-avoid">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#003F7D] uppercase">Time sessions</p>
          <table className="mt-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#003F7D] text-left text-[10px] tracking-[0.08em] text-white uppercase [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                <th className="px-2 py-1.5 font-semibold">Date</th>
                <th className="px-2 py-1.5 font-semibold">Start</th>
                <th className="px-2 py-1.5 font-semibold">End</th>
                <th className="px-2 py-1.5 text-right font-semibold">Duration</th>
                <th className="px-2 py-1.5 text-right font-semibold">Pay</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((row, index) => (
                <tr key={`${row.date}-${row.start}-${index}`} className="border-b border-slate-200">
                  <td className="px-2 py-1.5">{row.date}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.start}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.end}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.duration}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(row.pay)}</td>
                </tr>
              ))}
            </tbody>
            {data.sessionsTotal ? (
              <tfoot>
                <tr className="font-semibold">
                  <td className="px-2 py-1.5" colSpan={3}>
                    Total ({data.sessions.length} session{data.sessions.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{data.sessionsTotal}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatMoney(data.sessions.reduce((sum, row) => sum + row.pay, 0))}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </section>
      ) : null}

      {data.notes ? <p className="mt-5 text-[11px] whitespace-pre-wrap text-slate-600">{data.notes}</p> : null}

      <footer className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
        Thank you. This receipt was generated on {formatDate(new Date().toISOString())}.
      </footer>
    </article>
  );
}

/**
 * "Print / PDF" for a payment: opens the native print dialog with the receipt only (choose
 * "Save as PDF" there to download). No new tab, no navigation.
 */
export function PrintReceiptButton({
  data,
  label = "Print / PDF",
  className,
  size = "sm",
  variant = "outline",
}: {
  data: PaymentReceiptData;
  label?: string;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}) {
  const [printing, setPrinting] = useState(false);
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("gap-1.5", className)}
        onClick={() => setPrinting(true)}
        disabled={printing}
        aria-label="Print or save the receipt as PDF"
      >
        <Printer className="size-3.5" />
        {label}
      </Button>
      {printing ? (
        <PrintPortal onDone={() => setPrinting(false)}>
          <PaymentReceiptDocument data={data} />
        </PrintPortal>
      ) : null}
    </>
  );
}
