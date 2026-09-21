"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, moneyTone } from "@/components/portal/status-pill";
import { CenteredSpinner } from "@/components/ui/spinner";
import { customerPaths } from "@/lib/customer-paths";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  fetchCustomerInvoices,
  selectCustomerInvoices,
  selectCustomerInvoicesLoading,
} from "@/store/customerInvoicesSlice";

function statusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (clean === "partially_paid") return "Partially Paid";
  return clean
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
      <PortalDataTable
        filename="customer-invoices"
        countLabel="Invoices"
        searchPlaceholder="Search invoices…"
        loading={loading}
        rows={invoices}
        rowKey={(row) => row.id}
        rowHref={(row) => customerPaths.invoice(row.id)}
        empty="No invoices yet."
        columns={[
          {
            id: "number",
            header: "Invoice #",
            sortValue: (row) => row.number,
            searchValue: (row) => `${row.number} ${row.jobNumber || ""}`,
            exportValue: (row) => row.number,
            cell: (row) => (
              <div>
                <Link
                  href={customerPaths.invoice(row.id)}
                  className="font-medium text-primary hover:underline"
                >
                  {row.number}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.jobNumber
                    ? `Job ${row.jobNumber}`
                    : row.issuedAt
                      ? `Issued ${formatDate(row.issuedAt.slice(0, 10))}`
                      : "Invoice"}
                </p>
              </div>
            ),
          },
          {
            id: "provider",
            header: "Professional",
            sortValue: (row) => row.provider?.companyName || "",
            searchValue: (row) => row.provider?.companyName || "",
            cell: (row) => (
              <span className="font-medium text-foreground">
                {row.provider?.companyName || "Professional"}
              </span>
            ),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            cell: (row) => (
              <StatusPill
                label={statusLabel(row.status)}
                tone={moneyTone(row.status)}
              />
            ),
          },
          {
            id: "due",
            header: "Due",
            sortValue: (row) => row.dueAt || "",
            cell: (row) => (
              <span className="text-muted-foreground">
                {row.dueAt ? formatDate(row.dueAt.slice(0, 10)) : "—"}
              </span>
            ),
          },
          {
            id: "total",
            header: "Total",
            className: "text-right",
            sortValue: (row) => row.total ?? 0,
            cell: (row) => (
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(row.total)}
              </span>
            ),
          },
          {
            id: "balance",
            header: "Balance",
            className: "text-right",
            sortValue: (row) => row.balanceDue ?? 0,
            cell: (row) => (
              <span
                className={cn(
                  "font-bold tabular-nums",
                  row.balanceDue > 0 ? "text-[#003F7D]" : "text-muted-foreground",
                )}
              >
                {formatMoney(row.balanceDue)}
              </span>
            ),
          },
        ]}
        actions={(row) => [
          {
            label: "View invoice",
            href: customerPaths.invoice(row.id),
            icon: <Eye className="size-3.5" />,
            quick: true,
          },
        ]}
      />
    </PortalPage>
  );
}
