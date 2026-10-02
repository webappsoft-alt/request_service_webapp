"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { StatusDot, moneyTone } from "@/components/portal/status-pill";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatTaxRatePercent, moneyWithStateTax } from "@/lib/tax/state-tax";
import type { Estimate, Invoice, InvoiceStatus, Job, Payment, PaymentMethodType } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { recordInvoicePaymentRecord } from "@/store/invoicesSlice";

const PAYMENT_METHODS: PaymentMethodType[] = ["card", "ach", "check", "cash"];

export function InvoiceFileChrome({
  invoice,
  customer,
  customerLabel,
  customerPhone,
  customerEmail,
  service,
  job,
  estimate,
}: {
  invoice: Invoice;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  customerPhone?: string;
  customerEmail?: string;
  service: string;
  job?: Job;
  estimate?: Estimate;
}) {
  const jobAddr = job?.address;
  const estimateAddr = estimate?.propertyAddress;
  const addressLine = [
    jobAddr?.street || estimateAddr?.address || estimateAddr?.street,
    formatLocation(
      jobAddr?.city || estimateAddr?.city || "",
      jobAddr?.state || estimateAddr?.state || "",
      jobAddr?.zip || estimateAddr?.zip || "",
    ),
  ]
    .filter(Boolean)
    .join(", ");
  const phone =
    customerPhone?.trim() ||
    customer?.phone?.trim() ||
    invoice.customerPhone?.trim() ||
    estimate?.customerPhone?.trim() ||
    "";
  const email =
    customerEmail?.trim() ||
    customer?.email?.trim() ||
    invoice.customerEmail?.trim() ||
    estimate?.customerEmail?.trim() ||
    "";

  return (
    <div className="space-y-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{customerLabel}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[phone, email].filter(Boolean).join(" · ") ||
              "Customer details for this invoice"}
          </p>
        </div>
        {invoice.customerId ? (
          <Button size="sm" variant="outline" className="h-8 border-border-soft" asChild>
            <Link href={`/pro/dashboard/customers/${invoice.customerId}`}>
              Open customer file
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-x-8 gap-y-3.5 px-1 py-1 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Customer
          </p>
          <div className="mt-1 text-sm font-medium">
            {invoice.customerId ? (
              <Link
                href={`/pro/dashboard/customers/${invoice.customerId}`}
                className="font-semibold text-primary hover:underline"
              >
                {customerLabel}
              </Link>
            ) : (
              customerLabel
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Phone
          </p>
          <p className="mt-1 text-sm font-medium">{phone || "—"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Email
          </p>
          <p className="mt-1 text-sm font-medium">
            {email ? <span className="text-primary">{email}</span> : "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Service
          </p>
          <p className="mt-1 text-sm font-medium">{service || "—"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Address
          </p>
          <p className="mt-1 text-sm font-medium">{addressLine || "—"}</p>
        </div>
        {job ? (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Job
            </p>
            <p className="mt-1 text-sm font-medium">
              <Link
                href={`/pro/dashboard/jobs/${job.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {job.number}
              </Link>
            </p>
          </div>
        ) : null}
        {estimate ? (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Estimate
            </p>
            <p className="mt-1 text-sm font-medium">
              <Link
                href={`/pro/dashboard/new-estimate/${estimate.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {estimate.number}
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ApplyPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  /** Called after a payment is successfully recorded (API or local). */
  onPaid?: (result: { invoice: Invoice | null; payment: Payment | null }) => void;
}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");
  const records = usePortalRecords();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodType>("check");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(invoice.balanceDue > 0 ? String(invoice.balanceDue) : "");
    setMethod("check");
    setPaidAt(todayISO());
    setSaving(false);
  }, [invoice, open]);

  async function save() {
    if (!invoice || saving) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const applied = Math.min(value, invoice.balanceDue);
    if (applied <= 0) {
      toast.error("This invoice is already paid.");
      onOpenChange(false);
      return;
    }

    const payment: Payment = {
      id: `pay_new_${Date.now()}`,
      invoiceId: invoice.id,
      amount: applied,
      method,
      status: "succeeded",
      paidAt,
      createdAt: todayISO(),
    };

    setSaving(true);
    try {
      if (useApi) {
        const result = await dispatch(
          recordInvoicePaymentRecord({ invoiceId: invoice.id, payment }),
        ).unwrap();
        toast.success(`${formatMoney(applied)} applied to ${invoice.number}.`);
        onPaid?.(result);
        onOpenChange(false);
        return;
      }

      const amountPaid = invoice.amountPaid + applied;
      const balanceDue = Math.max(0, invoice.total - amountPaid);
      const status = invoiceStatusAfterPayment(invoice.status, balanceDue);
      await records.addPayment(payment);
      await records.patchInvoice(invoice.id, { amountPaid, balanceDue, status });
      await records.setStatus("invoice", invoice.id, status);
      toast.success(`${formatMoney(applied)} applied to ${invoice.number}.`);
      onPaid?.({ invoice: { ...invoice, amountPaid, balanceDue, status }, payment });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not apply this payment.",
      );
    } finally {
      setSaving(false);
    }
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
            <div className="grid grid-cols-2 gap-3 rounded-[4px] border border-input bg-muted/40 px-3 py-2.5 text-sm">
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
              disabled={saving}
              onChange={(change) => setAmount(change.target.value)}
            />
          </Field>
          <Field label="Method">
            <Select
              value={method}
              disabled={saving}
              onValueChange={(val) => setMethod(val as PaymentMethodType)}
            >
              <SelectTrigger id="apply-pay-method" className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] w-[var(--radix-select-trigger-width)]"
              >
                {PAYMENT_METHODS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {paymentMethodLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payment date">
            <Input
              id="apply-pay-date"
              type="date"
              value={paidAt}
              disabled={saving}
              onChange={(change) => setPaidAt(change.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!invoice || !Number(amount) || saving} onClick={() => void save()}>
            {saving ? "Applying…" : "Apply payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApplyPaymentButton({
  invoice,
  onPaid,
}: {
  invoice: Invoice;
  onPaid?: (result: { invoice: Invoice | null; payment: Payment | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  if (invoice.balanceDue <= 0) return null;
  return (
    <>
      <Button size="sm" className="h-8" onClick={() => setOpen(true)}>
        Apply payment
      </Button>
      <ApplyPaymentDialog
        open={open}
        onOpenChange={setOpen}
        invoice={invoice}
        onPaid={onPaid}
      />
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
  onPaid,
}: {
  invoice: Invoice;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  service: string;
  job?: Job;
  estimate?: Estimate;
  payments: Payment[];
  onPaid?: (result: { invoice: Invoice | null; payment: Payment | null }) => void;
}) {
  const [summaryTab, setSummaryTab] = useState<"overview" | "payments">("overview");
  const address = job?.address;
  const estimateAddr = estimate?.propertyAddress;
  const addressState = address?.state || estimateAddr?.state || "";
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { fetchTaxRatePercent } = await import("@/lib/tax/state-tax");
      const rate = await fetchTaxRatePercent(addressState);
      if (!cancelled) setTaxRatePercent(rate);
    })();
    return () => {
      cancelled = true;
    };
  }, [addressState]);
  const money = useMemo(() => {
    const sheet = moneyWithStateTax(
      invoice.subtotal,
      taxRatePercent,
      invoice.discount,
    );
    const balanceDue = Math.max(0, sheet.total - (invoice.amountPaid || 0));
    return { ...sheet, balanceDue, amountPaid: invoice.amountPaid || 0 };
  }, [
    invoice.subtotal,
    invoice.discount,
    invoice.amountPaid,
    taxRatePercent,
  ]);
  const overdueDays = invoiceDaysOverdue(invoice);
  const kind = invoiceKindLabel(invoiceKind(invoice));
  const siteAddress = address
    ? `${address.street}, ${formatLocation(address.city, address.state, address.zip)}`
    : "";
  const phone =
    customer?.phone?.trim() ||
    invoice.customerPhone?.trim() ||
    estimate?.customerPhone?.trim() ||
    "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-md border border-border-soft bg-[#f7f8fa] px-4 py-2 text-sm">
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
          <span className="text-muted-foreground">Customer:</span>
          {invoice.customerId ? (
            <Link
              href={`/pro/dashboard/customers/${invoice.customerId}`}
              className="truncate font-semibold text-primary hover:underline"
            >
              {customerLabel?.trim() || "View customer"}
            </Link>
          ) : (
            <span className="truncate font-medium text-foreground">
              {customerLabel?.trim() || "—"}
            </span>
          )}
        </span>
        {siteAddress ? (
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-muted-foreground">Site:</span>
            <span className="truncate font-medium text-foreground">{siteAddress}</span>
          </span>
        ) : null}
        {phone ? (
          <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground">Phone:</span>
            <span className="font-medium text-foreground">{phone}</span>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">Balance:</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatMoney(money.balanceDue)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Status:</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
            {invoiceStatusLabel(invoice.status)}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-soft pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Invoice summary
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {invoice.number}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoiceStatusLabel(invoice.status)} · {kind}
            {overdueDays ? ` · ${overdueDays} days overdue` : ""}
          </p>
        </div>
        <div className="rounded-md bg-secondary px-3 py-2 text-right">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Balance due
          </p>
          <p className="text-lg font-semibold tabular-nums text-primary">
            {formatMoney(money.balanceDue)}
          </p>
        </div>
      </div>

      <LocalFilterTabs
        value={summaryTab}
        onChange={(next) => setSummaryTab(next as "overview" | "payments")}
        options={[
          { value: "overview", label: "Overview" },
          {
            value: "payments",
            label: payments.length ? `Payments (${payments.length})` : "Payments",
          },
        ]}
      />

      {summaryTab === "payments" ? (
        <section className="overflow-hidden rounded-md border border-border-soft bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Payment history</h2>
              <p className="text-sm text-muted-foreground">
                {payments.length ? `${payments.length} recorded` : "None recorded"}
              </p>
            </div>
            <ApplyPaymentButton invoice={invoice} onPaid={onPaid} />
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
                      <Link
                        href={`/pro/dashboard/payments/${payment.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {paymentNumber(payment)}
                      </Link>
                    </TableCell>
                    <TableCell>{payment.paidAt ? formatDate(payment.paidAt) : "—"}</TableCell>
                    <TableCell>{paymentMethodLabel(payment.method)}</TableCell>
                    <TableCell>{paymentStatusLabel(payment.status)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No payments on this invoice yet.
            </p>
          )}
        </section>
      ) : (
        <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MoneyStat label="Price" value={formatMoney(money.total)} />
        <MoneyStat label="Paid" value={formatMoney(money.amountPaid)} />
        <MoneyStat label="Balance" value={formatMoney(money.balanceDue)} emphasize={money.balanceDue > 0} />
        <MoneyStat
          label="Days overdue"
          value={overdueDays ? String(overdueDays) : "—"}
          warn={overdueDays > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-md border border-input bg-card p-4">
          <h2 className="text-sm font-semibold">Invoice</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail label="Invoice type" value={kind} />
            <Detail
              label="Status"
              value={<StatusDot label={invoiceStatusLabel(invoice.status)} tone={moneyTone(invoice.status)} />}
            />
            <Detail label="Date issued" value={formatDate(invoice.issuedAt)} />
            <Detail label="Due date" value={invoice.dueAt ? formatDate(invoice.dueAt) : "—"} />
          </dl>
        </section>
        <section className="overflow-hidden rounded-md border border-input bg-card p-4">
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
                  <Link href={`/pro/dashboard/new-estimate/${estimate.id}`} className="font-semibold text-primary hover:underline">
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

      <section className="overflow-hidden rounded-md border border-input bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-input bg-[#e8eef5] px-4 py-2.5">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#003F7D] uppercase">
            Labour & Material
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 min-w-0 bg-[#f7f8fa] px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Description
                </TableHead>
                <TableHead className="h-8 w-[5.5rem] bg-[#f7f8fa] px-1 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Source
                </TableHead>
                <TableHead className="h-8 w-12 bg-[#f7f8fa] px-0.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Qty
                </TableHead>
                <TableHead className="h-8 w-14 bg-[#f7f8fa] px-0.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Unit
                </TableHead>
                <TableHead className="h-8 w-16 bg-[#f7f8fa] px-0.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Price
                </TableHead>
                <TableHead className="h-8 w-16 bg-[#f7f8fa] px-0.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id} className="border-b border-input hover:bg-transparent">
                  <TableCell className="min-w-0 px-2.5 py-2.5 align-top font-medium">
                    <div className="whitespace-pre-wrap break-words text-sm">
                      {item.description}
                    </div>
                    {item.images?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.images.map((src, index) => (
                          <span
                            key={`${src}-${index}`}
                            className="relative inline-block h-12 w-14 overflow-hidden rounded border border-input"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`Material for ${item.description}`}
                              className="size-full object-cover"
                            />
                            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-px text-center text-[8px] font-medium text-white">
                              Material
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="w-[5.5rem] px-1 py-2.5 text-center align-top text-xs text-muted-foreground">
                    {invoiceItemSourceLabel(item.source)}
                  </TableCell>
                  <TableCell className="w-12 px-0.5 py-2.5 text-center align-top text-sm tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="w-14 px-0.5 py-2.5 text-center align-top text-xs text-muted-foreground">
                    {lineUnitLabel(item.unit)}
                  </TableCell>
                  <TableCell className="w-16 px-0.5 py-2.5 text-center align-top text-sm tabular-nums">
                    {formatMoney(item.unitPrice)}
                  </TableCell>
                  <TableCell className="w-16 px-0.5 py-2.5 text-center align-middle text-sm font-medium tabular-nums">
                    {formatMoney(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1.5 border-t border-input px-4 py-3 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right tabular-nums">{formatMoney(money.subtotal)}</dd>
          {money.discount ? (
            <>
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="text-right tabular-nums">{formatMoney(money.discount)}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">
            Tax ({formatTaxRatePercent(taxRatePercent)}%)
          </dt>
          <dd className="text-right tabular-nums">{formatMoney(money.tax)}</dd>
          <dt className="font-medium">Price</dt>
          <dd className="text-right font-semibold tabular-nums">{formatMoney(money.total)}</dd>
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="text-right tabular-nums">{formatMoney(money.amountPaid)}</dd>
          <dt className="border-t border-input pt-2 font-semibold text-[#003F7D]">Balance</dt>
          <dd className="border-t border-input pt-2 text-right font-semibold tabular-nums text-[#003F7D]">
            {formatMoney(money.balanceDue)}
          </dd>
        </dl>
      </section>
        </>
      )}
    </div>
  );
}

export function InvoiceSettingsTab({ invoice, job }: { invoice: Invoice; job?: Job }) {
  const { customers } = useCrmDirectory();
  const crm = useCrmApiData();
  const useApi = crm.enabled;
  const customerPaging = usePaginatedCrmOptions(useApi ? "customer" : null, useApi);
  const records = usePortalRecords();
  const asJob = invoiceAsJob(invoice, job);
  const file = useJobFile(asJob, undefined, invoice, "");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceSettingsDraft>(() => ({
    customerId: invoice.customerId,
    issuedAt: invoice.issuedAt.slice(0, 10),
    dueAt: invoice.dueAt?.slice(0, 10) ?? "",
    status: invoice.status,
  }));

  const customerSelectOptions = useMemo(
    () =>
      useApi
        ? customerPaging.options
        : customers.map((item) => ({
            id: item.id,
            label: crmCustomerName(item),
          })),
    [useApi, customerPaging.options, customers],
  );

  const selected = customers.find((item) => item.id === draft.customerId);
  const customerDisplayName =
    (selected ? crmCustomerName(selected) : "") ||
    (draft.customerId ? `Customer ${draft.customerId.slice(-6)}` : "");

  function patch(next: Partial<InvoiceSettingsDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <>
    <div className="rounded-md border border-border-soft bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Invoice settings</h2>
        <Button
          size="sm"
          className="h-8"
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
          <Select
            value={draft.status}
            onValueChange={(value) => patch({ status: value as InvoiceStatus })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="z-[100] w-[var(--radix-select-trigger-width)]"
            >
              {INVOICE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {invoiceStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Customer">
          <PaginatedEntitySelect
            id="invoice-settings-customer"
            value={draft.customerId}
            options={customerSelectOptions}
            selectedLabel={customerDisplayName || undefined}
            placeholder="Select customer"
            emptyLabel="No customers found."
            loading={useApi ? customerPaging.loading : false}
            loadingMore={useApi ? customerPaging.loadingMore : false}
            hasMore={useApi ? customerPaging.hasMore : false}
            onLoadMore={useApi ? customerPaging.loadMore : () => {}}
            searchable={useApi}
            searchValue={useApi ? customerPaging.search : ""}
            onSearchChange={useApi ? customerPaging.setSearch : undefined}
            searchPlaceholder="Search customers…"
            addLabel="Add customer"
            onAdd={() => setCreateCustomerOpen(true)}
            onChange={(id) => patch({ customerId: id })}
          />
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
    <CreateCustomerDialog
      open={createCustomerOpen}
      onOpenChange={setCreateCustomerOpen}
      onSaved={(created) => {
        const label = crmCustomerName(created);
        patch({ customerId: created.id });
        customerPaging.prependOption({ id: created.id, label });
      }}
    />
    </>
  );
}

export function InvoicePaymentsTab({
  invoice,
  payments,
  onPaid,
}: {
  invoice: Invoice;
  payments: Payment[];
  onPaid?: (result: { invoice: Invoice | null; payment: Payment | null }) => void;
}) {
  return (
    <div className="rounded-md border border-border-soft bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Balance due {formatMoney(invoice.balanceDue)} · paid {formatMoney(invoice.amountPaid)} of {formatMoney(invoice.total)}.
          </p>
        </div>
        <ApplyPaymentButton invoice={invoice} onPaid={onPaid} />
      </div>
      {payments.length ? (
        <ul className="mt-4 divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft">
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
    <div className="rounded-md border border-input bg-card px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p
        className={
          warn
            ? "mt-1 text-xl font-semibold tabular-nums text-red-600"
            : emphasize
              ? "mt-1 text-xl font-semibold tabular-nums text-primary"
              : "mt-1 text-xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}

/** Match Labour & Material editor unit labels. */
function lineUnitLabel(unit?: string) {
  const key = String(unit || "ea").trim().toLowerCase();
  if (key === "hr" || key === "hour") return "Hour";
  if (key === "ea" || key === "each") return "Each";
  if (key === "ft" || key === "feet") return "Feet";
  if (key === "sq ft" || key === "sqft" || key === "square feet") return "sqft";
  return unit || "Each";
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
