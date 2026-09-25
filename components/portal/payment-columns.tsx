"use client";

import Link from "next/link";
import type { PortalTableColumn } from "@/components/portal/portal-data-table";
import { StatusDot, moneyTone } from "@/components/portal/status-pill";
import {
  jobServiceLabel,
  paymentKind,
  paymentKindLabel,
  paymentMethodLabel,
  paymentNumber,
  paymentStatusLabel,
  type PortalRequest,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Estimate, Invoice, Job, Payment } from "@/lib/types";

export function paymentBoardColumns({
  invoices,
  jobs,
  estimates,
  requests,
  customerName,
}: {
  invoices: Invoice[];
  jobs: Job[];
  estimates: Estimate[];
  requests: PortalRequest[];
  customerName: (customerId: string) => string;
}): PortalTableColumn<Payment>[] {
  const invoiceOf = (payment: Payment) =>
    invoices.find((item) => item.id === payment.invoiceId);
  const jobOf = (payment: Payment) => {
    if (payment.jobId) {
      const byId = jobs.find((item) => item.id === payment.jobId);
      if (byId) return byId;
    }
    const invoice = invoiceOf(payment);
    return invoice ? jobs.find((item) => item.id === invoice.jobId) : undefined;
  };
  const invoiceNumberOf = (payment: Payment) =>
    invoiceOf(payment)?.number || payment.invoiceNumber || "";
  const customerIdOf = (payment: Payment) =>
    invoiceOf(payment)?.customerId || payment.customerId || "";
  const customerLabelOf = (payment: Payment) => {
    if (payment.customerName?.trim()) return payment.customerName.trim();
    const customerId = customerIdOf(payment);
    return customerId ? customerName(customerId) : "";
  };
  const jobNameOf = (payment: Payment) => {
    const invoice = invoiceOf(payment);
    const job = jobOf(payment);
    if (job) return jobServiceLabel(job, estimates, requests);
    return invoice?.items[0]?.description.replace(/ labor$/i, "") || "Service";
  };
  const siteOf = (payment: Payment) => {
    const job = jobOf(payment);
    if (!job?.address) return "";
    return `${job.address.street || ""} ${job.address.city || ""} ${job.address.zip || ""}`.trim();
  };

  return [
    {
      id: "number",
      header: "Payment no.",
      sortValue: (row) => paymentNumber(row),
      searchValue: (row) => paymentNumber(row),
      exportValue: (row) => paymentNumber(row),
      cell: (row) => (
        <Link href={`/pro/dashboard/payments/${row.id}`} className="font-medium text-primary hover:underline">
          {paymentNumber(row)}
        </Link>
      ),
    },
    {
      id: "date",
      header: "Date",
      sortValue: (row) => row.paidAt ?? row.createdAt,
      searchValue: (row) => formatDate(row.paidAt ?? row.createdAt),
      exportValue: (row) => formatDate(row.paidAt ?? row.createdAt),
      cell: (row) => formatDate(row.paidAt ?? row.createdAt),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      searchValue: (row) => paymentStatusLabel(row.status),
      exportValue: (row) => paymentStatusLabel(row.status),
      cell: (row) => <StatusDot label={paymentStatusLabel(row.status)} tone={moneyTone(row.status)} />,
    },
    {
      id: "method",
      header: "Method",
      sortValue: (row) => paymentMethodLabel(row.method),
      searchValue: (row) => paymentMethodLabel(row.method),
      exportValue: (row) => paymentMethodLabel(row.method),
      cell: (row) => paymentMethodLabel(row.method),
    },
    {
      id: "type",
      header: "Payment type",
      sortValue: (row) => paymentKindLabel(paymentKind(row)),
      searchValue: (row) => paymentKindLabel(paymentKind(row)),
      exportValue: (row) => paymentKindLabel(paymentKind(row)),
      cell: (row) => paymentKindLabel(paymentKind(row)),
    },
    {
      id: "amount",
      header: "Amount",
      sortValue: (row) => row.amount,
      searchValue: (row) => formatMoney(row.amount),
      exportValue: (row) => formatMoney(row.amount),
      className: "text-right tabular-nums",
      cell: (row) => formatMoney(row.amount),
    },
    {
      id: "invoice",
      header: "Invoice no.",
      sortValue: (row) => invoiceNumberOf(row),
      searchValue: (row) => invoiceNumberOf(row),
      exportValue: (row) => invoiceNumberOf(row),
      cell: (row) => {
        const number = invoiceNumberOf(row);
        if (!number) return "—";
        return row.invoiceId ? (
          <Link href={`/pro/dashboard/invoices/${row.invoiceId}`} className="text-primary hover:underline">
            {number}
          </Link>
        ) : (
          number
        );
      },
    },
    {
      id: "job",
      header: "Job no.",
      sortValue: (row) => jobOf(row)?.number ?? "",
      searchValue: (row) => jobOf(row)?.number ?? "",
      exportValue: (row) => jobOf(row)?.number ?? "",
      cell: (row) => {
        const job = jobOf(row);
        return job ? (
          <Link href={`/pro/dashboard/jobs/${job.id}`} className="text-primary hover:underline">
            {job.number}
          </Link>
        ) : (
          "—"
        );
      },
    },
    {
      id: "customer",
      header: "Customer",
      sortValue: (row) => customerLabelOf(row),
      searchValue: (row) => customerLabelOf(row),
      exportValue: (row) => customerLabelOf(row),
      cell: (row) => {
        const label = customerLabelOf(row);
        const customerId = customerIdOf(row);
        if (!label) return "—";
        return customerId ? (
          <Link href={`/pro/dashboard/customers/${customerId}`} className="text-primary hover:underline">
            {label}
          </Link>
        ) : (
          label
        );
      },
    },
    {
      id: "site",
      header: "Site",
      sortValue: (row) => jobOf(row)?.address.street ?? "",
      searchValue: (row) => siteOf(row),
      exportValue: (row) => jobOf(row)?.address.street ?? "",
      cell: (row) => jobOf(row)?.address.street || "—",
    },
    {
      id: "jobName",
      header: "Job name",
      sortValue: (row) => jobNameOf(row),
      searchValue: (row) => jobNameOf(row),
      exportValue: (row) => jobNameOf(row),
      cell: (row) => jobNameOf(row),
    },
  ];
}
