"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  Printer,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { StatusPill, moneyTone } from "@/components/portal/status-pill";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  clearCustomerInvoiceDetail,
  fetchCustomerInvoiceDetail,
  selectCustomerInvoiceDetail,
  selectCustomerInvoiceDetailError,
  selectCustomerInvoiceDetailLoading,
} from "@/store/customerInvoicesSlice";

function statusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (clean === "sent") return "Pending";
  if (clean === "partially_paid") return "Partially Paid";
  return clean
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "emerald" | "primary" | "amber" | "default";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-xs transition-colors hover:bg-muted/40">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums",
          tone === "emerald" && "text-emerald-600",
          tone === "primary" && "text-primary",
          tone === "amber" && "text-amber-600",
          (!tone || tone === "default") && "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function CustomerInvoiceDetailDashboardView({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const invoice = useAppSelector(selectCustomerInvoiceDetail);
  const loading = useAppSelector(selectCustomerInvoiceDetailLoading);
  const error = useAppSelector(selectCustomerInvoiceDetailError);
  const invoiceId = String(id || "").trim();

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.invoice(invoiceId))}`,
      );
      return;
    }
    if (!invoiceId) return;
    void dispatch(fetchCustomerInvoiceDetail(invoiceId));
    return () => {
      dispatch(clearCustomerInvoiceDetail());
    };
  }, [auth.hydrated, dispatch, invoiceId, isAuthenticated, router]);

  const isOverdue = Boolean(
    invoice?.dueAt &&
      invoice.balanceDue > 0 &&
      new Date(invoice.dueAt).setHours(23, 59, 59, 999) < Date.now(),
  );

  const daysOverdue = (() => {
    if (!invoice?.dueAt || invoice.balanceDue <= 0) return 0;
    const due = new Date(invoice.dueAt);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  })();

  if (!auth.hydrated || loading) {
    return (
      <PortalPage
        eyebrow="Invoices"
        title="Invoice"
        description="Review the invoice sent by your professional."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.invoices}>
              <ArrowLeft className="size-3.5" />
              All invoices
            </Link>
          </Button>
        }
      >
        <div className="flex min-h-[360px] items-center justify-center">
          <CenteredSpinner label="Loading invoice…" />
        </div>
      </PortalPage>
    );
  }

  if (error || !invoice) {
    return (
      <PortalPage
        eyebrow="Invoices"
        title="Invoice not found"
        description={error || "This invoice is missing or no longer available."}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.invoices}>
              <ArrowLeft className="size-3.5" />
              All invoices
            </Link>
          </Button>
        }
      >
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-base font-medium text-foreground">
            Invoice could not be located
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {error || "Ask the professional to send the invoice again if you expected to see it here."}
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href={customerPaths.invoices}>Return to all invoices</Link>
          </Button>
        </div>
      </PortalPage>
    );
  }

  const companyName = invoice.provider?.companyName || "Service Professional";
  const initial = companyName.charAt(0).toUpperCase();

  return (
    <PortalPage
      eyebrow="Invoices"
      title={invoice.number}
      description={`Invoice from ${companyName}`}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={statusLabel(invoice.status)}
            tone={moneyTone(invoice.status)}
          />
          {invoice.jobNumber ? (
            <Badge
              variant="outline"
              className="border-border bg-muted/30 font-mono text-xs text-muted-foreground"
            >
              Job {invoice.jobNumber}
            </Badge>
          ) : null}
          {isOverdue ? (
            <Badge
              variant="destructive"
              className="text-xs font-semibold"
            >
              {daysOverdue > 0 ? `${daysOverdue}d overdue` : "Overdue"}
            </Badge>
          ) : null}
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.invoices}>
              <ArrowLeft className="size-3.5" />
              All invoices
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="hidden sm:inline-flex"
          >
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button asChild size="sm">
            <Link href={customerPaths.messages}>
              <MessageSquare className="size-3.5" />
              Message pro
            </Link>
          </Button>
        </div>
      }
    >
      {/* 4 KPI Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total amount"
          value={formatMoney(invoice.total)}
          hint={
            invoice.items.length
              ? `${invoice.items.length} itemized charge${invoice.items.length === 1 ? "" : "s"}`
              : "Full invoice total"
          }
        />
        <StatCard
          label="Amount paid"
          value={formatMoney(invoice.amountPaid)}
          tone={invoice.amountPaid > 0 ? "emerald" : "default"}
          hint={
            invoice.amountPaid > 0
              ? "Payments credited"
              : "No payments recorded yet"
          }
        />
        <StatCard
          label="Balance due"
          value={formatMoney(invoice.balanceDue)}
          tone={
            invoice.balanceDue <= 0
              ? "emerald"
              : isOverdue
                ? "amber"
                : "primary"
          }
          hint={
            invoice.balanceDue <= 0
              ? "Fully settled · No balance"
              : isOverdue
                ? `Payment overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
                : "Awaiting customer payment"
          }
        />
        <StatCard
          label="Payment due"
          value={
            invoice.dueAt
              ? formatDate(invoice.dueAt.slice(0, 10))
              : "Due on receipt"
          }
          hint={
            invoice.issuedAt
              ? `Issued on ${formatDate(invoice.issuedAt.slice(0, 10))}`
              : "Standard payment terms"
          }
        />
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left Column: Line Items Table & Breakdown */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <Receipt className="size-4 text-primary" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Line items ({invoice.items.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Itemized breakdown of services, materials, and labor
                  </p>
                </div>
              </div>
              {invoice.items.length > 0 ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {invoice.items.length} item{invoice.items.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <tr>
                    <th className="px-5 py-3 sm:px-6">Description</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Unit rate</th>
                    <th className="px-5 py-3 text-right sm:px-6">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.items.length ? (
                    invoice.items.map((item, index) => (
                      <tr
                        key={item.id || `${item.description}-${index}`}
                        className="transition-colors hover:bg-muted/20"
                      >
                        <td className="px-5 py-4 sm:px-6">
                          <p className="font-medium text-foreground">
                            {item.description}
                          </p>
                          {item.kind ? (
                            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                              {item.kind}
                              {item.taxRate
                                ? ` · Tax ${(item.taxRate * 100).toFixed(0)}%`
                                : ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-center tabular-nums text-foreground">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">
                          {formatMoney(item.unitPrice)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground sm:px-6">
                          {formatMoney(item.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-sm text-muted-foreground"
                      >
                        <FileText className="mx-auto size-8 text-muted-foreground/40" />
                        <p className="mt-2 font-medium text-foreground">
                          No individual line items
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          This invoice reflects a fixed summary charge or agreed contract total.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Summary */}
            <div className="border-t border-border bg-muted/10 p-5 sm:p-6">
              <div className="ml-auto w-full max-w-sm space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatMoney(invoice.subtotal)}
                  </span>
                </div>

                {invoice.discount > 0 ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-medium tabular-nums">
                      −{formatMoney(invoice.discount)}
                    </span>
                  </div>
                ) : null}

                {invoice.tax > 0 ? (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="font-medium tabular-nums text-foreground">
                      +{formatMoney(invoice.tax)}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                  <span>Invoice total</span>
                  <span className="tabular-nums">
                    {formatMoney(invoice.total)}
                  </span>
                </div>

                {invoice.amountPaid > 0 ? (
                  <div className="flex items-center justify-between text-xs text-emerald-800">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      Amount paid
                    </span>
                    <span className="font-semibold tabular-nums">
                      −{formatMoney(invoice.amountPaid)}
                    </span>
                  </div>
                ) : null}

                <div
                  className={cn(
                    "mt-3 flex items-center justify-between rounded-lg border p-4",
                    invoice.balanceDue > 0
                      ? "border-primary/25 bg-primary/5 text-primary"
                      : "border-emerald-500/25 bg-emerald-50 text-emerald-800",
                  )}
                >
                  <span className="text-xs font-bold tracking-wider uppercase">
                    {invoice.balanceDue > 0 ? "Balance due" : "Paid in full"}
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {formatMoney(invoice.balanceDue)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Notes & Special Instructions */}
          {invoice.notes ? (
            <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <FileText className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Notes & payment instructions
                </h3>
              </div>
              <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {invoice.notes}
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4 text-primary" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Payments ({invoice.payments?.length || 0})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Settlements your professional recorded against this invoice
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={customerPaths.payments}>View all payments</Link>
              </Button>
            </div>
            {invoice.payments?.length ? (
              <ul className="divide-y divide-border">
                {invoice.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div>
                      <Link
                        href={customerPaths.payment(payment.id)}
                        className="font-medium text-primary hover:underline"
                      >
                        PMT-{payment.id.replace(/^pay_?/i, "")}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {payment.method
                          ? `${payment.method.charAt(0).toUpperCase()}${payment.method.slice(1)}`
                          : "Payment"}
                        {payment.paidAt
                          ? ` · ${formatDate(payment.paidAt.slice(0, 10))}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill
                        label={statusLabel(payment.status)}
                        tone={moneyTone(payment.status)}
                      />
                      <span className="font-semibold tabular-nums">
                        {formatMoney(payment.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">
                No payments recorded yet. When your professional applies a payment,
                it will appear here and under Payments.
              </p>
            )}
          </section>

          {/* Guarantee & Protection Notice */}
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-primary" />
            <div>
              <strong className="font-semibold text-foreground">
                Digital Payment & Invoicing Records:
              </strong>{" "}
              All transaction receipts, line items, and invoice records are preserved in
              your portal account for future reference, warranty verification, and tax
              reporting.
            </div>
          </div>
        </div>

        {/* Right Column: Professional Profile & Metadata */}
        <aside className="space-y-6">
          {/* Professional Profile Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Service professional
              </h2>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-bold text-base text-foreground shadow-xs">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {companyName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assigned contractor
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-3 text-xs">
                {invoice.provider?.email ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="size-3.5 shrink-0 text-primary" />
                    <a
                      href={`mailto:${invoice.provider.email}`}
                      className="truncate hover:text-foreground hover:underline"
                    >
                      {invoice.provider.email}
                    </a>
                  </div>
                ) : null}

                {invoice.provider?.phone ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3.5 shrink-0 text-primary" />
                    <a
                      href={`tel:${invoice.provider.phone}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {invoice.provider.phone}
                    </a>
                  </div>
                ) : null}
              </div>

              <Button asChild className="w-full" size="sm">
                <Link href={customerPaths.messages}>
                  <MessageSquare className="size-3.5" />
                  Chat with professional
                </Link>
              </Button>
            </div>
          </div>

          {/* Invoice Metadata & Reference Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-foreground">
              Invoice metadata
            </h2>

            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <dt className="text-muted-foreground">Invoice #</dt>
                <dd className="font-mono font-medium text-foreground">
                  {invoice.number}
                </dd>
              </div>

              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusPill
                    label={statusLabel(invoice.status)}
                    tone={moneyTone(invoice.status)}
                  />
                </dd>
              </div>

              {invoice.jobNumber ? (
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <dt className="text-muted-foreground">Job reference</dt>
                  <dd className="font-mono font-medium text-foreground">
                    Job {invoice.jobNumber}
                  </dd>
                </div>
              ) : null}

              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <dt className="text-muted-foreground">Issued date</dt>
                <dd className="font-medium text-foreground">
                  {invoice.issuedAt
                    ? formatDate(invoice.issuedAt.slice(0, 10))
                    : "—"}
                </dd>
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Due date</dt>
                <dd
                  className={cn(
                    "font-medium",
                    isOverdue ? "font-semibold text-destructive" : "text-foreground",
                  )}
                >
                  {invoice.dueAt
                    ? formatDate(invoice.dueAt.slice(0, 10))
                    : "Due on receipt"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Assistance & Questions Card */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <HelpCircle className="size-4 shrink-0 text-primary" />
              <span>Questions about this invoice?</span>
            </div>
            <ul className="mt-2.5 space-y-2 text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  Reach out to your service professional via chat to request any
                  line item adjustments.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  Payments are logged automatically as soon as the provider records
                  or processes your settlement.
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </PortalPage>
  );
}
