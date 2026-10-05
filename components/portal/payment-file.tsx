"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { StatusDot, moneyTone } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PortalCustomerCrm } from "@/lib/data/crm-people";
import {
  invoiceStatusLabel,
  paymentKind,
  paymentKindLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import type { Invoice, Job, Payment } from "@/lib/types";

export function PaymentFileChrome({
  payment,
  invoice,
  customer,
  customerLabel,
  customerPhone,
  customerEmail,
  service,
  job,
}: {
  payment: Payment;
  invoice?: Invoice;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  customerPhone?: string;
  customerEmail?: string;
  service: string;
  job?: Job;
}) {
  const address = job?.address;
  const addressLine = address
    ? [address.street, formatLocation(address.city, address.state, address.zip)]
        .filter(Boolean)
        .join(", ")
    : "";
  const customerId = invoice?.customerId || payment.customerId;
  const phone =
    customerPhone?.trim() ||
    customer?.phone?.trim() ||
    payment.customerPhone?.trim() ||
    invoice?.customerPhone?.trim() ||
    "";
  const email =
    customerEmail?.trim() ||
    customer?.email?.trim() ||
    payment.customerEmail?.trim() ||
    invoice?.customerEmail?.trim() ||
    "";

  return (
    <div className="space-y-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{customerLabel}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[phone, email].filter(Boolean).join(" · ") ||
              "Customer details for this payment"}
          </p>
        </div>
        {customerId ? (
          <Button size="sm" variant="outline" className="h-8 border-border-soft" asChild>
            <Link href={`/pro/dashboard/customers/${customerId}`}>
              Open customer file
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-x-8 gap-y-3.5 px-1 py-1 sm:grid-cols-2">
        <Detail
          label="Customer"
          value={
            customerId ? (
              <Link
                href={`/pro/dashboard/customers/${customerId}`}
                className="font-semibold text-primary hover:underline"
              >
                {customerLabel}
              </Link>
            ) : (
              customerLabel
            )
          }
        />
        <Detail label="Phone" value={phone || "—"} />
        <Detail
          label="Email"
          value={email ? <span className="text-primary">{email}</span> : "—"}
        />
        <Detail label="Service" value={service || "—"} />
        <Detail label="Address" value={addressLine || "—"} />
        {invoice ? (
          <Detail
            label="Invoice"
            value={
              <Link
                href={`/pro/dashboard/invoices/${invoice.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {invoice.number}
              </Link>
            }
          />
        ) : null}
        {job ? (
          <Detail
            label="Job"
            value={
              <Link
                href={`/pro/dashboard/jobs/${job.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {job.number}
              </Link>
            }
          />
        ) : null}
      </div>
    </div>
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
  const kind = paymentKindLabel(paymentKind(payment));
  const address = job?.address;
  const phone =
    customer?.phone?.trim() ||
    payment.customerPhone?.trim() ||
    invoice?.customerPhone?.trim() ||
    "";
  const email =
    customer?.email?.trim() ||
    payment.customerEmail?.trim() ||
    invoice?.customerEmail?.trim() ||
    "";
  // The invoice may not be in the loaded workspace yet; the payment itself carries its number.
  const invoiceId = invoice?.id || payment.invoiceId;
  const invoiceNumber = invoice?.number || payment.invoiceNumber;
  const invoiceLink =
    invoiceId && invoiceNumber ? (
      <Link
        href={`/pro/dashboard/invoices/${invoiceId}`}
        className="font-semibold text-primary hover:underline"
      >
        {invoiceNumber}
      </Link>
    ) : (
      "—"
    );
  const paidByCustomer = payment.recordedBy === "customer";
  const recordedByLabel = paidByCustomer
    ? `Customer${payment.recordedByName?.trim() ? ` · ${payment.recordedByName.trim()}` : ""} (paid online)`
    : `Provider${payment.recordedByName?.trim() ? ` · ${payment.recordedByName.trim()}` : ""} (recorded manually)`;
  const proofUrl = payment.proofUrl?.trim() || "";
  const proofIsImage = /\.(png|jpe?g|gif|webp|bmp|svg|heic)(\?|$)/i.test(proofUrl);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-soft pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Payment summary
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {paymentMethodLabel(payment.method)} · {kind}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {paymentStatusLabel(payment.status)}
            {" · "}
            {formatDate(payment.paidAt ?? payment.createdAt)}
          </p>
        </div>
        <div className="rounded-md bg-secondary px-3 py-2 text-right">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Amount
          </p>
          <p className="text-lg font-semibold tabular-nums text-primary">
            {formatMoney(payment.amount)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MoneyStat label="Amount" value={formatMoney(payment.amount)} emphasize />
        <MoneyStat label="Method" value={paymentMethodLabel(payment.method)} />
        <MoneyStat label="Status" value={paymentStatusLabel(payment.status)} />
        <MoneyStat label="Date" value={formatDate(payment.paidAt ?? payment.createdAt)} />
        <MoneyStat
          label="Due date"
          value={formatDate(payment.dueAt ?? payment.paidAt ?? payment.createdAt)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-md border border-border-soft bg-card p-4">
          <h2 className="text-sm font-semibold">Received from</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail
              label="Customer"
              value={
                invoice?.customerId ? (
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
            {phone ? <Detail label="Phone" value={phone} /> : null}
            {email ? <Detail label="Email" value={email} /> : null}
            <Detail label="Payment type" value={kind} />
            <Detail
              label="Status"
              value={
                <StatusDot
                  label={paymentStatusLabel(payment.status)}
                  tone={moneyTone(payment.status)}
                />
              }
            />
          </dl>
        </section>
        <section className="overflow-hidden rounded-md border border-border-soft bg-card p-4">
          <h2 className="text-sm font-semibold">Applied to</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail label="Invoice no." value={invoiceLink} />
            <Detail
              label="Job no."
              value={
                job ? (
                  <Link
                    href={`/pro/dashboard/jobs/${job.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
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
              value={
                address
                  ? `${address.street}, ${formatLocation(address.city, address.state, address.zip)}`
                  : "—"
              }
            />
            {invoice ? (
              <>
                <Detail
                  label="Invoice status"
                  value={
                    <StatusDot
                      label={invoiceStatusLabel(invoice.status)}
                      tone={moneyTone(invoice.status)}
                    />
                  }
                />
                <Detail label="Invoice balance" value={formatMoney(invoice.balanceDue)} />
              </>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="overflow-hidden rounded-md border border-border-soft bg-card p-4">
        <h2 className="text-sm font-semibold">Payment details</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Detail label="Paid by" value={customerLabel} />
          <Detail label="Recorded by" value={recordedByLabel} />
          <Detail label="Method" value={paymentMethodLabel(payment.method)} />
          {payment.method === "card" || payment.method === "ach" ? (
            <Detail
              label="Transaction reference"
              value={
                payment.transactionReference?.trim() ? (
                  <span className="font-mono text-xs break-all">
                    {payment.transactionReference.trim()}
                  </span>
                ) : (
                  "—"
                )
              }
            />
          ) : null}
          <div className="sm:col-span-2">
            <Detail
              label="Notes"
              value={
                payment.notes?.trim() ? (
                  <span className="whitespace-pre-wrap font-normal">
                    {payment.notes.trim()}
                  </span>
                ) : (
                  <span className="font-normal text-muted-foreground">No notes added</span>
                )
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Detail
              label={payment.method === "check" ? "Check image" : "Attachment"}
              value={
                proofUrl ? (
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-block"
                    title="Open full-size file"
                  >
                    {proofIsImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proofUrl}
                        alt="Payment proof"
                        className="max-h-48 w-auto rounded border border-input object-contain transition-colors group-hover:border-primary/60"
                      />
                    ) : (
                      <span className="text-primary hover:underline">View attached file</span>
                    )}
                  </a>
                ) : (
                  <span className="font-normal text-muted-foreground">No file attached</span>
                )
              }
            />
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-md border border-border-soft bg-card">
        <div className="border-b border-border-soft px-4 py-3">
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
              <TableCell className="font-medium">{invoiceLink}</TableCell>
              <TableCell>
                {job ? (
                  <Link
                    href={`/pro/dashboard/jobs/${job.id}`}
                    className="text-primary hover:underline"
                  >
                    {job.number}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{service}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(payment.amount)}
              </TableCell>
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
    <div className="rounded-md border border-border-soft bg-card px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={
          emphasize
            ? "mt-1 text-xl font-semibold tabular-nums text-primary"
            : "mt-1 text-xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}
