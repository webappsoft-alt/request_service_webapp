"use client";

import Link from "next/link";
import type { PortalTableColumn } from "@/components/portal/portal-data-table";
import { StatusPill } from "@/components/portal/status-pill";
import {
  jobServiceLabel,
  jobStatusLabel,
  jobStatusTone,
  jobTotal,
  type PortalCalendarEvent,
  type PortalRequest,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Estimate, Invoice, Job } from "@/lib/types";

export function jobBoardColumns({
  estimates,
  requests,
  invoices,
  events,
  employeeLabel,
  customerName,
}: {
  estimates: Estimate[];
  requests: PortalRequest[];
  invoices: Invoice[];
  events: PortalCalendarEvent[];
  employeeLabel: (id?: string) => string;
  customerName: (customerId: string) => string;
}): PortalTableColumn<Job>[] {
  const eventFor = (job: Job) => events.find((item) => item.kind === "job" && item.recordId === job.id);
  const startOf = (job: Job) => eventFor(job)?.date ?? job.scheduledAt;
  const dueOf = (job: Job) => eventFor(job)?.endDate ?? job.dueAt;
  const techOf = (job: Job) => employeeLabel(eventFor(job)?.employeeId) || job.assignedTo || "";
  const invoiceOf = (job: Job) => invoices.find((item) => item.id === job.invoiceId);
  const serviceOf = (job: Job) => jobServiceLabel(job, estimates, requests);

  return [
    {
      id: "number",
      header: "Job #",
      sortValue: (row) => row.number,
      searchValue: (row) => `${row.number} ${serviceOf(row)}`,
      exportValue: (row) => row.number,
      cell: (row) => (
        <Link href={`/pro/dashboard/jobs/${row.id}`} className="font-medium text-primary hover:underline">
          {row.number}
        </Link>
      ),
    },
    {
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
    },
    {
      id: "service",
      header: "Service",
      sortValue: (row) => serviceOf(row),
      searchValue: (row) => serviceOf(row),
      exportValue: (row) => serviceOf(row),
      cell: (row) => serviceOf(row),
    },
    {
      id: "address",
      header: "Job address",
      sortValue: (row) => `${row.address.street} ${row.address.city}`,
      searchValue: (row) => `${row.address.street} ${row.address.city} ${row.address.zip}`,
      exportValue: (row) => `${row.address.street}, ${row.address.city}`,
      cell: (row) => (
        <span>
          {row.address.street}
          <span className="block text-muted-foreground">
            {row.address.city}, {row.address.state} {row.address.zip}
          </span>
        </span>
      ),
    },
    {
      id: "start",
      header: "Start",
      sortValue: (row) => startOf(row) ?? "",
      searchValue: (row) => (startOf(row) ? formatDate(startOf(row)!) : "Unscheduled"),
      exportValue: (row) => (startOf(row) ? formatDate(startOf(row)!) : "Unscheduled"),
      cell: (row) => (startOf(row) ? formatDate(startOf(row)!) : "—"),
    },
    {
      id: "due",
      header: "Due",
      sortValue: (row) => dueOf(row) ?? "",
      searchValue: (row) => (dueOf(row) ? formatDate(dueOf(row)!) : ""),
      exportValue: (row) => (dueOf(row) ? formatDate(dueOf(row)!) : ""),
      cell: (row) => (dueOf(row) ? formatDate(dueOf(row)!) : "—"),
    },
    {
      id: "technician",
      header: "Technician",
      sortValue: (row) => techOf(row),
      searchValue: (row) => techOf(row),
      exportValue: (row) => techOf(row),
      cell: (row) => techOf(row) || "—",
    },
    {
      id: "total",
      header: "Total",
      className: "text-right tabular-nums",
      sortValue: (row) => jobTotal(row),
      searchValue: (row) => String(jobTotal(row)),
      exportValue: (row) => formatMoney(jobTotal(row)),
      cell: (row) => formatMoney(jobTotal(row)),
    },
    {
      id: "invoice",
      header: "Invoice",
      sortValue: (row) => invoiceOf(row)?.number ?? row.invoiceId ?? "",
      searchValue: (row) => invoiceOf(row)?.number ?? row.invoiceId ?? "",
      exportValue: (row) => invoiceOf(row)?.number ?? "",
      cell: (row) => {
        const invoice = invoiceOf(row);
        if (!invoice) return "—";
        return (
          <Link href={`/pro/dashboard/invoices/${invoice.id}`} className="text-primary hover:underline">
            {invoice.number}
          </Link>
        );
      },
    },
    {
      id: "cos",
      header: "COs",
      sortValue: (row) => row.changeOrders.length,
      searchValue: (row) => String(row.changeOrders.length),
      exportValue: (row) => String(row.changeOrders.length),
      cell: (row) => row.changeOrders.length,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      searchValue: (row) => jobStatusLabel(row.status),
      exportValue: (row) => jobStatusLabel(row.status),
      cell: (row) => <StatusPill label={jobStatusLabel(row.status)} className={jobStatusTone(row.status)} />,
    },
  ];
}
