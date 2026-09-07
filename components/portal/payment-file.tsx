"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { StatusDot, moneyTone } from "@/components/portal/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PortalCustomerCrm } from "@/lib/data/crm-people";
import {
  invoiceStatusLabel,
  paymentKind,
  paymentKindLabel,
  paymentMethodLabel,
  paymentNumber,
  paymentStatusLabel,
} from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import type { Invoice, Job, Payment } from "@/lib/types";

export function PaymentFileChrome({
  payment,
  invoice,
  customerLabel,
  service,
  job,
}: {
  payment: Payment;
  invoice?: Invoice;
  customerLabel: string;
  service: string;
  job?: Job;
}) {
  return (
    <nav aria-label="Payment breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      <Link href="/pro/dashboard/payments" className="font-semibold text-primary hover:underline">
        Payments
      </Link>
      <span className="text-muted-foreground">/</span>
      <span className="font-medium text-foreground">
        {customerLabel} – {service}
      </span>
      {invoice ? (
        <>
          <span className="text-muted-foreground">/</span>
          <Link href={`/pro/dashboard/invoices/${invoice.id}`} className="font-semibold text-primary hover:underline">
            {invoice.number}
          </Link>
        </>
      ) : null}
      {job ? (
        <>
          <span className="text-muted-foreground">/</span>
          <Link href={`/pro/dashboard/jobs/${job.id}`} className="font-semibold text-primary hover:underline">
            {job.number}
          </Link>
        </>
      ) : null}
      <span className="text-muted-foreground">/</span>
      <span className="font-semibold text-primary">{paymentNumber(payment)}</span>
    </nav>
  );
}

export function PaymentSummaryTab({
  payment,
  invoice,
  customer,
  customerLabel,
  service,
  job,
}: {
  payment: Payment;
  invoice?: Invoice;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  service: string;
  job?: Job;
}) {
  const contact = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "";
  const address = job?.address;
  const kind = paymentKindLabel(paymentKind(payment));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyStat label="Amount" value={formatMoney(payment.amount)} emphasize />
        <MoneyStat label="Method" value={paymentMethodLabel(payment.method)} />
        <MoneyStat label="Status" value={paymentStatusLabel(payment.status)} />
        <MoneyStat label="Date" value={formatDate(payment.paidAt ?? payment.createdAt)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[4px] border border-black/10 bg-card p-4">
          <h2 className="text-sm font-semibold">Received from</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail
              label="Customer"
              value={
                invoice ? (
                  <Link
                    href={`/pro/dashboard/customers/${invoice.customerId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {customerLabel}
                  </Link>
                ) : (
                  customerLabel
                )
              }
            />
            {customer && customer.entityKind === "company" && contact ? <Detail label="Contact" value={contact} /> : null}
            {customer?.phone ? <Detail label="Phone" value={customer.phone} /> : null}
            {customer?.email ? <Detail label="Email" value={customer.email} /> : null}
            <Detail label="Payment type" value={kind} />
            <Detail
              label="Status"
              value={<StatusDot label={paymentStatusLabel(payment.status)} tone={moneyTone(payment.status)} />}
            />
          </dl>
        </section>
        <section className="rounded-[4px] border border-black/10 bg-card p-4">
          <h2 className="text-sm font-semibold">Applied to</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail
              label="Invoice no."
              value={
                invoice ? (
                  <Link href={`/pro/dashboard/invoices/${invoice.id}`} className="font-semibold text-primary hover:underline">
                    {invoice.number}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Detail
              label="Job no."
              value={
                job ? (
                  <Link href={`/pro/dashboard/jobs/${job.id}`} className="font-semibold text-primary hover:underline">
                    {job.number}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Detail label="Job name" value={service} />
            <Detail
              label="Site"
              value={address ? `${address.street}, ${formatLocation(address.city, address.state, address.zip)}` : "—"}
            />
            {invoice ? (
              <>
                <Detail
                  label="Invoice status"
                  value={<StatusDot label={invoiceStatusLabel(invoice.status)} tone={moneyTone(invoice.status)} />}
                />
                <Detail label="Invoice balance" value={formatMoney(invoice.balanceDue)} />
              </>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="rounded-[4px] border border-black/10 bg-card">
        <div className="border-b border-black/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Allocation</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice no.</TableHead>
              <TableHead>Job no.</TableHead>
              <TableHead>Job name</TableHead>
              <TableHead className="text-right">Amount applied</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                {invoice ? (
                  <Link href={`/pro/dashboard/invoices/${invoice.id}`} className="text-primary hover:underline">
                    {invoice.number}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {job ? (
                  <Link href={`/pro/dashboard/jobs/${job.id}`} className="text-primary hover:underline">
                    {job.number}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{service}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(payment.amount)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function MoneyStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-[4px] border border-black/10 bg-card px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className={emphasize ? "mt-1 text-xl font-semibold tabular-nums text-[#003F7D]" : "mt-1 text-xl font-semibold tabular-nums"}>
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}
