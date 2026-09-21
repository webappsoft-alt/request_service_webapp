"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Search } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import { NoData } from "@/components/shared/no-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  fetchCustomerInvoices,
  selectCustomerInvoices,
  selectCustomerInvoicesLoading,
} from "@/store/customerInvoicesSlice";

function statusVariant(status: string) {
  const value = status.toLowerCase();
  if (value === "paid") return "default" as const;
  if (value === "sent" || value === "partially_paid") return "secondary" as const;
  if (value === "overdue") return "destructive" as const;
  return "outline" as const;
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CustomerInvoicesDashboardView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const invoices = useAppSelector(selectCustomerInvoices);
  const loading = useAppSelector(selectCustomerInvoicesLoading);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.invoices)}`,
      );
      return;
    }
    void dispatch(fetchCustomerInvoices());
  }, [auth.hydrated, isAuthenticated, router, dispatch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((invoice) => {
      const haystack = [
        invoice.number,
        invoice.status,
        invoice.jobNumber,
        invoice.provider?.companyName,
        String(invoice.total),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, search]);

  if (!auth.hydrated || (loading && !invoices.length)) {
    return (
      <PortalPage
        eyebrow="Activity"
        title="Invoices"
        description="Invoices sent by professionals after your job is underway."
      >
        <CenteredSpinner label="Loading invoices…" />
      </PortalPage>
    );
  }

  return (
    <PortalPage
      eyebrow="Activity"
      title="Invoices"
      description="Invoices sent by professionals after your job is underway. Open one to review totals and line items."
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoices…"
            className="pl-9"
          />
        </div>
      </div>

      {!filtered.length ? (
        <NoData
          title="No invoices yet"
          description="When a professional sends an invoice for your job, it will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-black/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-black/10 bg-[#f8fafc] text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Professional</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-black/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#003F7D]">
                      {invoice.number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.jobNumber
                        ? `Job ${invoice.jobNumber}`
                        : invoice.issuedAt
                          ? `Issued ${formatDate(invoice.issuedAt.slice(0, 10))}`
                          : "Invoice"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {invoice.provider?.companyName || "Professional"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(invoice.status)}>
                      {statusLabel(invoice.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {invoice.dueAt
                      ? formatDate(invoice.dueAt.slice(0, 10))
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(invoice.total)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(invoice.balanceDue)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={customerPaths.invoice(invoice.id)}>
                        <Eye className="size-3.5" />
                        View
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalPage>
  );
}
