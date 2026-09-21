"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
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
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  if (!auth.hydrated || loading) {
    return (
      <PortalPage
        eyebrow="Invoices"
        title="Invoice"
        description="Review the invoice sent by your professional."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={customerPaths.invoices}>
              <ArrowLeft data-icon="inline-start" />
              All invoices
            </Link>
          </Button>
        }
      >
        <CenteredSpinner label="Loading invoice…" />
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
              <ArrowLeft data-icon="inline-start" />
              All invoices
            </Link>
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Ask the professional to send the invoice again if you expected to see
          it here.
        </p>
      </PortalPage>
    );
  }

  return (
    <PortalPage
      eyebrow="Invoices"
      title={invoice.number}
      description={
        invoice.provider?.companyName
          ? `Invoice from ${invoice.provider.companyName}`
          : "Invoice from your professional"
      }
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={customerPaths.invoices}>
            <ArrowLeft data-icon="inline-start" />
            All invoices
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{statusLabel(invoice.status)}</Badge>
          {invoice.jobNumber ? (
            <span className="text-sm text-muted-foreground">
              Job {invoice.jobNumber}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[4px] border border-black/10 bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Total
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#003F7D]">
              {formatMoney(invoice.total)}
            </p>
          </div>
          <div className="rounded-[4px] border border-black/10 bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Paid
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(invoice.amountPaid)}
            </p>
          </div>
          <div className="rounded-[4px] border border-black/10 bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Balance due
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(invoice.balanceDue)}
            </p>
          </div>
          <div className="rounded-[4px] border border-black/10 bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Due date
            </p>
            <p className="mt-1 text-xl font-semibold">
              {invoice.dueAt
                ? formatDate(invoice.dueAt.slice(0, 10))
                : "—"}
            </p>
          </div>
        </div>

        <div className="rounded-[4px] border border-black/10 bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Professional
              </p>
              <p className="mt-1 font-medium">
                {invoice.provider?.companyName || "Professional"}
              </p>
              {invoice.provider?.email ? (
                <p className="text-sm text-muted-foreground">
                  {invoice.provider.email}
                </p>
              ) : null}
              {invoice.provider?.phone ? (
                <p className="text-sm text-muted-foreground">
                  {invoice.provider.phone}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Dates
              </p>
              <p className="mt-1 text-sm">
                Issued{" "}
                {invoice.issuedAt
                  ? formatDate(invoice.issuedAt.slice(0, 10))
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                Due{" "}
                {invoice.dueAt
                  ? formatDate(invoice.dueAt.slice(0, 10))
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-black/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-black/10 bg-[#f8fafc] text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.length ? (
                invoice.items.map((item, index) => (
                  <tr
                    key={item.id || `${item.description}-${index}`}
                    className="border-b border-black/5 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {item.kind}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(item.total)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No line items on this invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1 rounded-[4px] border border-black/10 bg-card p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
          </div>
          {invoice.discount > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="tabular-nums">
                −{formatMoney(invoice.discount)}
              </span>
            </div>
          ) : null}
          {invoice.tax > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatMoney(invoice.tax)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-black/10 pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums text-[#003F7D]">
              {formatMoney(invoice.total)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Balance due</span>
            <span className="tabular-nums font-medium">
              {formatMoney(invoice.balanceDue)}
            </span>
          </div>
        </div>

        {invoice.notes ? (
          <div className="rounded-[4px] border border-black/10 bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{invoice.notes}</p>
          </div>
        ) : null}
      </div>
    </PortalPage>
  );
}
