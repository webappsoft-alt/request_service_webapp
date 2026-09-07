"use client";

import Link from "next/link";
import type { PortalTableColumn } from "@/components/portal/portal-data-table";
import { StatusDot, moneyTone } from "@/components/portal/status-pill";
import {
  invoiceDaysOverdue,
  invoiceKind,
  invoiceKindLabel,
  invoiceStatusLabel,
  jobServiceLabel,
  type PortalRequest,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Estimate, Invoice, Job } from "@/lib/types";

export function invoiceBoardColumns({
  jobs,
  estimates,
  requests,
  customerName,
  hideCustomer = false,
}: {
  jobs: Job[];
  estimates: Estimate[];
  requests: PortalRequest[];
  customerName: (customerId: string) => string;
  hideCustomer?: boolean;
}): PortalTableColumn<Invoice>[] {
  const jobOf = (invoice: Invoice) => jobs.find((item) => item.id === invoice.jobId);
  const siteOf = (invoice: Invoice) => {
    const job = jobOf(invoice);
    return job ? job.address.street : "";
  };
  const jobNameOf = (invoice: Invoice) => {
    const job = jobOf(invoice);
    if (job) return jobServiceLabel(job, estimates, requests);
    return invoice.items[0]?.description.replace(/ labor$/i, "") || "Service";
  };

  const columns: PortalTableColumn<Invoice>[] = [
    {
      id: "number",
      header: "Invoice no.",
      sortValue: (row) => row.number,
      searchValue: (row) => row.number,
      exportValue: (row) => row.number,
      cell: (row) => (
        <Link href={`/pro/dashboard/invoices/${row.id}`} className="font-medium text-primary hover:underline">
          {row.number}
        </Link>
      ),
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
      id: "issued",
      header: "Date issued",
      sortValue: (row) => row.issuedAt,
      searchValue: (row) => formatDate(row.issuedAt),
      exportValue: (row) => formatDate(row.issuedAt),
      cell: (row) => formatDate(row.issuedAt),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      searchValue: (row) => invoiceStatusLabel(row.status),
      exportValue: (row) => invoiceStatusLabel(row.status),
      cell: (row) => <StatusDot label={invoiceStatusLabel(row.status)} tone={moneyTone(row.status)} />,
    },
    {
      id: "due",
      header: "Due date",
      sortValue: (row) => row.dueAt ?? "",
      searchValue: (row) => (row.dueAt ? formatDate(row.dueAt) : ""),
      exportValue: (row) => (row.dueAt ? formatDate(row.dueAt) : ""),
      cell: (row) => (row.dueAt ? formatDate(row.dueAt) : "—"),
    },
    {
      id: "overdue",
      header: "Days overdue",
      sortValue: (row) => invoiceDaysOverdue(row),
      searchValue: (row) => {
        const days = invoiceDaysOverdue(row);
        return days ? String(days) : "";
      },
      exportValue: (row) => {
        const days = invoiceDaysOverdue(row);
        return days ? String(days) : "";
      },
      className: "tabular-nums",
      cell: (row) => {
        const days = invoiceDaysOverdue(row);
        return days ? <span className="font-semibold text-red-600">{days}</span> : "—";
      },
    },
  ];

  if (!hideCustomer) {
    columns.push({
      id: "customer",
      header: "Customer",
      sortValue: (row) => customerName(row.customerId),
      searchValue: (row) => customerName(row.customerId),
      exportValue: (row) => customerName(row.customerId),
      cell: (row) => (
        <Link href={`/pro/dashboard/customers/${row.customerId}`} className="text-primary hover:underline">
          {customerName(row.customerId)}
        </Link>
      ),
    });
  }

  columns.push(
    {
      id: "site",
      header: "Site",
      sortValue: (row) => siteOf(row),
      searchValue: (row) => {
        const job = jobOf(row);
        return job ? `${job.address.street} ${job.address.city} ${job.address.zip}` : "";
      },
      exportValue: (row) => siteOf(row),
      cell: (row) => siteOf(row) || "—",
    },
    {
      id: "price",
      header: "Price",
      sortValue: (row) => row.total,
      searchValue: (row) => formatMoney(row.total),
      exportValue: (row) => formatMoney(row.total),
      className: "text-right tabular-nums",
      cell: (row) => formatMoney(row.total),
    },
    {
      id: "paid",
      header: "Paid",
      sortValue: (row) => row.amountPaid,
      searchValue: (row) => formatMoney(row.amountPaid),
      exportValue: (row) => formatMoney(row.amountPaid),
      className: "text-right tabular-nums",
      cell: (row) => formatMoney(row.amountPaid),
    },
    {
      id: "balance",
      header: "Balance",
      sortValue: (row) => row.balanceDue,
      searchValue: (row) => formatMoney(row.balanceDue),
      exportValue: (row) => formatMoney(row.balanceDue),
      className: "text-right tabular-nums",
      cell: (row) => formatMoney(row.balanceDue),
    },
    {
      id: "jobName",
      header: "Job name",
      sortValue: (row) => jobNameOf(row),
      searchValue: (row) => jobNameOf(row),
      exportValue: (row) => jobNameOf(row),
      cell: (row) => jobNameOf(row),
    },
    {
      id: "type",
      header: "Invoice type",
      sortValue: (row) => invoiceKindLabel(invoiceKind(row)),
      searchValue: (row) => invoiceKindLabel(invoiceKind(row)),
      exportValue: (row) => invoiceKindLabel(invoiceKind(row)),
      cell: (row) => invoiceKindLabel(invoiceKind(row)),
    },
  );

  return columns;
}
