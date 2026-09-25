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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  fetchCustomerPayments,
  selectCustomerPayments,
  selectCustomerPaymentsLoading,
} from "@/store/customerPaymentsSlice";

function paymentNumber(id: string) {
  return `PMT-${String(id || "").replace(/^pay_?/i, "")}`;
}

function statusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  return clean
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function methodLabel(method: string) {
  const clean = String(method || "").toLowerCase();
  if (clean === "ach") return "ACH";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function CustomerPaymentsDashboardView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const payments = useAppSelector(selectCustomerPayments);
  const loading = useAppSelector(selectCustomerPaymentsLoading);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(customerPaths.payments)}`,
      );
      return;
    }
    void dispatch(fetchCustomerPayments());
  }, [auth.hydrated, isAuthenticated, router, dispatch]);

  if (!auth.hydrated || (loading && !payments.length)) {
    return (
      <PortalPage
        eyebrow="Activity"
        title="Payments"
        description="Payments your professionals have recorded against your invoices."
      >
        <CenteredSpinner label="Loading payments…" />
      </PortalPage>
    );
  }

  return (
    <PortalPage
      eyebrow="Activity"
      title="Payments"
      description="Deposits and balances recorded by your professionals. Open a payment to see status and invoice details."
    >
      <PortalDataTable
        filename="customer-payments"
        countLabel="Payments"
        searchPlaceholder="Search by invoice #, professional, or method…"
        loading={loading && !payments.length}
        rows={payments}
        rowKey={(row) => row.id}
        rowHref={(row) => customerPaths.payment(row.id)}
        empty="No payments recorded yet."
        columns={[
          {
            id: "number",
            header: "Payment #",
            sortValue: (row) => paymentNumber(row.id),
            searchValue: (row) =>
              `${paymentNumber(row.id)} ${row.invoiceNumber || ""} ${row.provider?.companyName || ""}`,
            exportValue: (row) => paymentNumber(row.id),
            cell: (row) => (
              <div>
                <Link
                  href={customerPaths.payment(row.id)}
                  className="font-medium text-primary hover:underline"
                >
                  {paymentNumber(row.id)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.paidAt
                    ? formatDate(row.paidAt.slice(0, 10))
                    : "Payment"}
                </p>
              </div>
            ),
          },
          {
            id: "provider",
            header: "Professional",
            sortValue: (row) => row.provider?.companyName || "",
            searchValue: (row) => row.provider?.companyName || "",
            cell: (row) => row.provider?.companyName || "Professional",
          },
          {
            id: "invoice",
            header: "Invoice",
            sortValue: (row) => row.invoiceNumber || "",
            searchValue: (row) => row.invoiceNumber || "",
            cell: (row) =>
              row.invoiceId && row.invoiceNumber ? (
                <Link
                  href={customerPaths.invoice(row.invoiceId)}
                  className="text-primary hover:underline"
                >
                  {row.invoiceNumber}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
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
            id: "method",
            header: "Method",
            sortValue: (row) => row.method,
            searchValue: (row) => methodLabel(row.method),
            cell: (row) => methodLabel(row.method),
          },
          {
            id: "amount",
            header: "Amount",
            className: "text-right",
            sortValue: (row) => row.amount,
            cell: (row) => (
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(row.amount)}
              </span>
            ),
          },
        ]}
        actions={(row) => [
          {
            label: "View payment",
            href: customerPaths.payment(row.id),
            icon: <Eye className="size-3.5" />,
            quick: true,
          },
        ]}
      />
    </PortalPage>
  );
}
