"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { StatusDot, moneyTone } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useJobFile, type InvoiceSettingsDraft } from "@/components/portal/use-job-file";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { invoiceAsJob, todayISO } from "@/components/portal/work-builders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import {
  INVOICE_STATUSES,
  invoiceDaysOverdue,
  invoiceItemSourceLabel,
  invoiceKind,
  invoiceKindLabel,
  invoiceStatusAfterPayment,
  invoiceStatusLabel,
  paymentMethodLabel,
  paymentNumber,
  paymentStatusLabel,
} from "@/lib/data/portal";
import { formatDate, formatLocation, formatMoney } from "@/lib/format";
import type { Estimate, Invoice, InvoiceStatus, Job, Payment, PaymentMethodType } from "@/lib/types";

const PAYMENT_METHODS: PaymentMethodType[] = ["card", "ach", "check", "cash"];

export function InvoiceFileChrome({
  invoice,
  customer,
  customerLabel,
  service,
  job,
  estimate,
}: {
  invoice: Invoice;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  service: string;
  job?: Job;
  estimate?: Estimate;
}) {
  return (
    <nav aria-label="Invoice breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      <Link href="/pro/dashboard/invoices" className="font-semibold text-primary hover:underline">
        Invoices
      </Link>
      <span className="text-muted-foreground">/</span>
      <span className="font-medium text-foreground">
        {customerLabel} – {service}
      </span>
      {estimate ? (
        <>
          <span className="text-muted-foreground">/</span>
          <Link href={`/pro/dashboard/estimates/${estimate.id}`} className="font-semibold text-primary hover:underline">
            {estimate.number}
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
      <span className="font-semibold text-primary">{invoice.number}</span>
    </nav>
  );
}

export function ApplyPaymentDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
}) {
  const records = usePortalRecords();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodType>("check");
  const [paidAt, setPaidAt] = useState(todayISO());

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(invoice.balanceDue > 0 ? String(invoice.balanceDue) : "");
    setMethod("check");
    setPaidAt(todayISO());
  }, [invoice, open]);

  function save() {
    if (!invoice) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const applied = Math.min(value, invoice.balanceDue);
    if (applied <= 0) {
      toast.error("This invoice is already paid.");
      onOpenChange(false);
      return;
    }
    const amountPaid = invoice.amountPaid + applied;
    const balanceDue = Math.max(0, invoice.total - amountPaid);
    const status = invoiceStatusAfterPayment(invoice.status, balanceDue);
    records.addPayment({
      id: `pay_new_${Date.now()}`,
      invoiceId: invoice.id,
      amount: applied,
      method,
      status: "succeeded",
      paidAt,
      createdAt: todayISO(),
    });
    records.patchInvoice(invoice.id, { amountPaid, balanceDue, status });
    records.setStatus("invoice", invoice.id, status);
    toast.success(`${formatMoney(applied)} applied to ${invoice.number}.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Apply payment</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Record a payment against ${invoice.number}. Balance due ${formatMoney(invoice.balanceDue)}.`
              : "Select an invoice first."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {invoice ? (
            <div className="grid grid-cols-2 gap-3 rounded-[4px] border border-black/10 bg-muted/40 px-3 py-2.5 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Invoice</p>
                <p className="font-medium">{invoice.number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Balance due</p>
                <p className="font-semibold tabular-nums">{formatMoney(invoice.balanceDue)}</p>
              </div>
            </div>
          ) : null}
          <Field label="Amount">
            <Input
              id="apply-pay-amount"
              inputMode="decimal"
              min={0}
              step="0.01"
              type="number"
              value={amount}
              onChange={(change) => setAmount(change.target.value)}
            />
          </Field>
          <Field label="Method">
            <NativeSelect
              id="apply-pay-method"
              className="w-full"
              value={method}
              onChange={(change) => setMethod(change.target.value as PaymentMethodType)}
            >
              {PAYMENT_METHODS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {paymentMethodLabel(item)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Payment date">
            <Input id="apply-pay-date" type="date" value={paidAt} onChange={(change) => setPaidAt(change.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!invoice || !Number(amount)} onClick={save}>
            Apply payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApplyPaymentButton({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  if (invoice.balanceDue <= 0) return null;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Apply payment
      </Button>
      <ApplyPaymentDialog open={open} onOpenChange={setOpen} invoice={invoice} />
    </>
  );
}

export function InvoiceSummaryTab({
  invoice,
  customer,
  customerLabel,
  service,
  job,
  estimate,
  payments,
}: {
  invoice: Invoice;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  service: string;
  job?: Job;
  estimate?: Estimate;
  payments: Payment[];
}) {
  const contact = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "";
  const address = job?.address;
  const overdueDays = invoiceDaysOverdue(invoice);
  const kind = invoiceKindLabel(invoiceKind(invoice));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyStat label="Price" value={formatMoney(invoice.total)} />
        <MoneyStat label="Paid" value={formatMoney(invoice.amountPaid)} />
        <MoneyStat label="Balance" value={formatMoney(invoice.balanceDue)} emphasize={invoice.balanceDue > 0} />
        <MoneyStat
          label="Days overdue"
          value={overdueDays ? String(overdueDays) : "—"}
          warn={overdueDays > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[4px] border border-black/10 bg-card p-4">
          <h2 className="text-sm font-semibold">Bill to</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail
              label="Customer"
              value={
                <Link href={`/pro/dashboard/customers/${invoice.customerId}`} className="font-semibold text-primary hover:underline">
                  {customerLabel}
                </Link>
              }
            />
            {customer && customer.entityKind === "company" && contact ? <Detail label="Contact" value={contact} /> : null}
            {customer?.phone ? <Detail label="Phone" value={customer.phone} /> : null}
            {customer?.email ? <Detail label="Email" value={customer.email} /> : null}
            <Detail label="Invoice type" value={kind} />
            <Detail
              label="Status"
              value={<StatusDot label={invoiceStatusLabel(invoice.status)} tone={moneyTone(invoice.status)} />}
            />
            <Detail label="Date issued" value={formatDate(invoice.issuedAt)} />
            <Detail label="Due date" value={invoice.dueAt ? formatDate(invoice.dueAt) : "—"} />
          </dl>
        </section>
        <section className="rounded-[4px] border border-black/10 bg-card p-4">
          <h2 className="text-sm font-semibold">Job / site</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
            <Detail
              label="Estimate"
              value={
                estimate ? (
                  <Link href={`/pro/dashboard/estimates/${estimate.id}`} className="font-semibold text-primary hover:underline">
                    {estimate.number}
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
          </dl>
        </section>
      </div>

      <section className="rounded-[4px] border border-black/10 bg-card">
        <div className="border-b border-black/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Line items</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.description}</TableCell>
                <TableCell>{invoiceItemSourceLabel(item.source)}</TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(item.unitPrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1.5 border-t border-black/10 px-4 py-3 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right tabular-nums">{formatMoney(invoice.subtotal)}</dd>
          {invoice.discount ? (
            <>
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="text-right tabular-nums">{formatMoney(invoice.discount)}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="text-right tabular-nums">{formatMoney(invoice.tax)}</dd>
          <dt className="font-medium">Price</dt>
          <dd className="text-right font-semibold tabular-nums">{formatMoney(invoice.total)}</dd>
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="text-right tabular-nums">{formatMoney(invoice.amountPaid)}</dd>
          <dt className="font-medium">Balance</dt>
          <dd className="text-right font-semibold tabular-nums text-[#003F7D]">{formatMoney(invoice.balanceDue)}</dd>
        </dl>
      </section>

      <section className="rounded-[4px] border border-black/10 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Payments</h2>
            <p className="text-sm text-muted-foreground">
              {payments.length ? `${payments.length} recorded` : "None recorded"}
            </p>
          </div>
          <ApplyPaymentButton invoice={invoice} />
        </div>
        {payments.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment no.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link href={`/pro/dashboard/payments/${payment.id}`} className="font-medium text-primary hover:underline">
                      {paymentNumber(payment)}
                    </Link>
                  </TableCell>
                  <TableCell>{payment.paidAt ? formatDate(payment.paidAt) : "—"}</TableCell>
                  <TableCell>{paymentMethodLabel(payment.method)}</TableCell>
                  <TableCell>{paymentStatusLabel(payment.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(payment.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No payments on this invoice yet.</p>
        )}
      </section>
    </div>
  );
}

export function InvoiceSettingsTab({ invoice, job }: { invoice: Invoice; job?: Job }) {
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const asJob = invoiceAsJob(invoice, job);
  const file = useJobFile(asJob, undefined, invoice, "");
  const selected = customers.find((item) => item.id === invoice.customerId);
  const [draft, setDraft] = useState<InvoiceSettingsDraft>(() => ({
    customerId: invoice.customerId,
    issuedAt: invoice.issuedAt.slice(0, 10),
    dueAt: invoice.dueAt?.slice(0, 10) ?? "",
    status: invoice.status,
  }));

  function patch(next: Partial<InvoiceSettingsDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <div className="rounded-[4px] border border-black/10 bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Invoice settings</h2>
        <Button
          size="sm"
          onClick={() => {
            file.saveInvoiceSettings(draft);
            records.setStatus("invoice", invoice.id, draft.status);
            toast.success("Invoice settings saved.");
          }}
        >
          Save settings
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <NativeSelect
            className="w-full"
            value={draft.status}
            onChange={(event) => patch({ status: event.target.value as InvoiceStatus })}
          >
            {INVOICE_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {invoiceStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Customer">
          <NativeSelect className="w-full" value={draft.customerId} onChange={(event) => patch({ customerId: event.target.value })}>
            {customers.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {crmCustomerName(item)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Issued">
          <Input type="date" value={draft.issuedAt} onChange={(event) => patch({ issuedAt: event.target.value })} />
        </Field>
        <Field label="Due">
          <Input type="date" value={draft.dueAt} onChange={(event) => patch({ dueAt: event.target.value })} />
        </Field>
        {selected?.phone ? (
          <Field label="Customer phone">
            <Input readOnly value={selected.phone} />
          </Field>
        ) : null}
        {selected?.email ? (
          <Field label="Customer email">
            <Input readOnly value={selected.email} />
          </Field>
        ) : null}
        {job ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Billed from{" "}
            <Link href={`/pro/dashboard/jobs/${job.id}`} className="font-semibold text-primary hover:underline">
              {job.number}
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function InvoicePaymentsTab({ invoice, payments }: { invoice: Invoice; payments: Payment[] }) {
  return (
    <div className="rounded-[4px] border border-black/10 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Balance due {formatMoney(invoice.balanceDue)} · paid {formatMoney(invoice.amountPaid)} of {formatMoney(invoice.total)}.
          </p>
        </div>
        <ApplyPaymentButton invoice={invoice} />
      </div>
      {payments.length ? (
        <ul className="mt-4 divide-y divide-black/10 border border-black/10">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div>
                <Link href={`/pro/dashboard/payments/${payment.id}`} className="font-medium text-primary hover:underline">
                  {paymentNumber(payment)}
                </Link>
                <p className="font-medium">{formatMoney(payment.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {paymentMethodLabel(payment.method)} · {payment.paidAt ? formatDate(payment.paidAt) : "Pending"}
                </p>
              </div>
              <span className="text-muted-foreground">{paymentStatusLabel(payment.status)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No payments recorded yet.</p>
      )}
    </div>
  );
}

function MoneyStat({
  label,
  value,
  emphasize,
  warn,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[4px] border border-black/10 bg-card px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p
        className={
          warn
            ? "mt-1 text-xl font-semibold tabular-nums text-red-600"
            : emphasize
              ? "mt-1 text-xl font-semibold tabular-nums text-[#003F7D]"
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
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
