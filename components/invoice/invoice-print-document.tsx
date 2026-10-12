"use client";

import type { ReactNode } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type InvoicePrintLine = {
  description: string;
  kind?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
  section?: string;
};

export type InvoicePrintPayment = {
  date?: string | null;
  method: string;
  amount: number;
  reference?: string;
};

export type InvoicePrintData = {
  number: string;
  statusLabel: string;
  /** e.g. "Change order CO-001 · Extra fixtures" */
  subtitle?: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  jobNumber?: string;
  company: {
    name: string;
    logoUrl?: string;
    addressLines?: string[];
    phone?: string;
    email?: string;
    licensed?: boolean;
    insured?: boolean;
  };
  billTo: {
    name: string;
    phone?: string;
    email?: string;
    addressLines?: string[];
  };
  serviceAddressLines?: string[];
  items: InvoicePrintLine[];
  subtotal: number;
  discount: number;
  taxLabel: string;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  payments?: InvoicePrintPayment[];
  notes?: string;
  terms?: string;
};

function kindLabel(kind?: string) {
  const value = String(kind || "").toLowerCase();
  if (value.startsWith("material")) return "Material";
  if (value === "equipment") return "Equipment";
  if (value === "labor" || value === "labour") return "Labour";
  return "";
}

function groupBySection(items: InvoicePrintLine[]) {
  const order: string[] = [];
  const map = new Map<string, InvoicePrintLine[]>();
  for (const item of items) {
    const key = String(item.section || "").trim();
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  const multiple = order.length > 1 || (order.length === 1 && order[0] !== "");
  return order.map((key) => {
    const rows = map.get(key) || [];
    return {
      key,
      label: multiple ? key || "General" : "",
      rows,
      total: rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    };
  });
}

/**
 * Print-only invoice document (company letterhead, bill-to, line items, totals).
 * Render next to the on-screen view with the screen view wrapped in `print:hidden`.
 */
export function InvoicePrintDocument({
  data,
  className,
}: {
  data: InvoicePrintData;
  className?: string;
}) {
  const groups = groupBySection(data.items);
  const payments = (data.payments || []).filter((p) => Number(p.amount) > 0);

  return (
    <article
      className={cn(
        "hidden bg-white text-[12px] leading-5 text-slate-900 print:block",
        className,
      )}
    >
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#003F7D] pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {data.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.company.logoUrl}
              alt=""
              className="size-14 shrink-0 rounded object-contain"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded bg-[#003F7D] text-xl font-semibold text-white">
              {data.company.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight">{data.company.name}</p>
            {(data.company.addressLines || []).filter(Boolean).map((line) => (
              <p key={line} className="text-[11px] text-slate-600">
                {line}
              </p>
            ))}
            <p className="text-[11px] text-slate-600">
              {[data.company.phone, data.company.email].filter(Boolean).join(" · ")}
            </p>
            {data.company.licensed || data.company.insured ? (
              <p className="mt-1 text-[10px] font-medium tracking-[0.08em] text-[#003F7D] uppercase">
                {[data.company.licensed ? "Licensed" : null, data.company.insured ? "Insured" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[22px] font-bold tracking-[0.2em] text-[#003F7D] uppercase">Invoice</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{data.number}</p>
          {data.subtitle ? (
            <p className="max-w-[16rem] text-[11px] text-slate-600">{data.subtitle}</p>
          ) : null}
        </div>
      </header>

      {/* Parties + meta */}
      <section className="mt-5 grid grid-cols-3 gap-6">
        <Party label="Bill to" name={data.billTo.name}>
          {[...(data.billTo.addressLines || []), data.billTo.phone, data.billTo.email]
            .filter(Boolean)
            .map((line) => (
              <p key={String(line)}>{line}</p>
            ))}
        </Party>
        {data.serviceAddressLines?.length ? (
          <Party label="Service address" name={data.serviceAddressLines[0]}>
            {data.serviceAddressLines.slice(1).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Party>
        ) : (
          <div />
        )}
        <div className="text-[11px]">
          <Meta label="Invoice date" value={data.issuedAt ? formatDate(data.issuedAt) : "—"} />
          <Meta label="Due date" value={data.dueAt ? formatDate(data.dueAt) : "On receipt"} />
          {data.jobNumber ? <Meta label="Job" value={data.jobNumber} /> : null}
          <Meta label="Status" value={data.statusLabel} />
        </div>
      </section>

      {/* Line items */}
      <table className="mt-6 w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[52%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#003F7D] text-[10px] tracking-[0.12em] text-white uppercase">
            <th className="px-2 py-2 text-left font-semibold">Description</th>
            <th className="px-1.5 py-2 text-center font-semibold">Type</th>
            <th className="px-1.5 py-2 text-right font-semibold">Qty</th>
            <th className="px-1.5 py-2 text-right font-semibold">Rate</th>
            <th className="px-2 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr className="border-b border-slate-200">
              <td colSpan={5} className="px-2 py-3 text-center text-slate-500">
                No line items
              </td>
            </tr>
          ) : null}
          {groups.flatMap((group) => {
            const rows: ReactNode[] = [];
            if (group.label) {
              rows.push(
                <tr key={`s-${group.key}`} className="border-b border-slate-200 bg-slate-100">
                  <td colSpan={5} className="px-2 py-1.5 text-[10px] font-semibold tracking-[0.1em] text-slate-700 uppercase">
                    {group.label}
                  </td>
                </tr>,
              );
            }
            group.rows.forEach((row, index) => {
              rows.push(
                <tr key={`${group.key}-${index}`} className="break-inside-avoid border-b border-slate-200">
                  <td className="px-2 py-2 align-top whitespace-pre-wrap break-words">
                    {row.description || kindLabel(row.kind) || "Item"}
                  </td>
                  <td className="px-1.5 py-2 text-center align-top text-slate-600">{kindLabel(row.kind)}</td>
                  <td className="px-1.5 py-2 text-right align-top tabular-nums text-slate-600">
                    {row.quantity}
                    {row.unit ? ` ${row.unit}` : ""}
                  </td>
                  <td className="px-1.5 py-2 text-right align-top tabular-nums">{formatMoney(row.unitPrice)}</td>
                  <td className="px-2 py-2 text-right align-top font-medium tabular-nums">{formatMoney(row.total)}</td>
                </tr>,
              );
            });
            if (group.label) {
              rows.push(
                <tr key={`t-${group.key}`} className="border-b border-slate-200">
                  <td colSpan={4} className="px-2 py-1.5 text-right text-[11px] font-semibold text-slate-500">
                    {group.label} total
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(group.total)}</td>
                </tr>,
              );
            }
            return rows;
          })}
        </tbody>
      </table>

      {/* Totals */}
      <section className="mt-4 flex break-inside-avoid justify-end">
        <div className="w-64">
          <TotalRow label="Subtotal" value={formatMoney(data.subtotal)} />
          {data.discount > 0 ? <TotalRow label="Discount" value={`-${formatMoney(data.discount)}`} /> : null}
          <TotalRow label={data.taxLabel} value={formatMoney(data.tax)} />
          <TotalRow label="Total" value={formatMoney(data.total)} strong />
          <TotalRow label="Amount paid" value={`-${formatMoney(data.amountPaid)}`} />
          <div className="mt-1 flex justify-between bg-[#003F7D] px-2 py-2 text-[13px] font-semibold text-white">
            <span>Balance due</span>
            <span className="tabular-nums">{formatMoney(data.balanceDue)}</span>
          </div>
        </div>
      </section>

      {payments.length ? (
        <section className="mt-6 break-inside-avoid">
          <SectionTitle>Payment history</SectionTitle>
          <table className="mt-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-300 text-left text-[10px] tracking-[0.1em] text-slate-500 uppercase">
                <th className="py-1.5 font-semibold">Date</th>
                <th className="py-1.5 font-semibold">Method</th>
                <th className="py-1.5 font-semibold">Reference</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr key={index} className="border-b border-slate-200">
                  <td className="py-1.5">{payment.date ? formatDate(payment.date) : "—"}</td>
                  <td className="py-1.5">{payment.method}</td>
                  <td className="py-1.5 text-slate-600">{payment.reference || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {data.notes ? (
        <section className="mt-6 break-inside-avoid">
          <SectionTitle>Notes</SectionTitle>
          <p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{data.notes}</p>
        </section>
      ) : null}

      {data.terms ? (
        <section className="mt-4 break-inside-avoid">
          <SectionTitle>Terms</SectionTitle>
          <p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{data.terms}</p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-slate-300 pt-3 text-center text-[11px] text-slate-500">
        Thank you for your business — {data.company.name}
        {data.company.phone ? ` · ${data.company.phone}` : ""}
        {data.company.email ? ` · ${data.company.email}` : ""}
      </footer>
    </article>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.16em] text-[#003F7D] uppercase">{children}</p>
  );
}

function Party({ label, name, children }: { label: string; name: string; children?: ReactNode }) {
  return (
    <div className="min-w-0 text-[11px] text-slate-600">
      <SectionTitle>{label}</SectionTitle>
      <p className="mt-1 text-[13px] font-semibold text-slate-900">{name}</p>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-200 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex justify-between px-2 py-1",
        strong && "border-t border-slate-300 font-semibold text-slate-900",
      )}
    >
      <span className={strong ? undefined : "text-slate-600"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
