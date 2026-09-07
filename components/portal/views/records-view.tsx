"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { archiveRowAction } from "@/components/portal/archive-control";
import { CreateEstimateDialog, CreateJobDialog } from "@/components/portal/create-work-dialogs";
import { buildEstimateSnapshot } from "@/components/portal/share-estimate-panel";
import { shareUrlFor, useEstimateShare } from "@/components/portal/use-estimate-share";
import { FilterTabs } from "@/components/portal/filter-tabs";
import { ApplyPaymentDialog } from "@/components/portal/invoice-file";
import { invoiceBoardColumns } from "@/components/portal/invoice-columns";
import { jobBoardColumns } from "@/components/portal/job-columns";
import { paymentBoardColumns } from "@/components/portal/payment-columns";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { crmCustomerName } from "@/lib/data/crm-people";
import { Button } from "@/components/ui/button";
import {
  ESTIMATE_STATUS_FILTERS,
  estimateCanShare,
  estimateStatusLabel,
  estimateStatusTone,
  getPortalCustomerName,
  INVOICE_BOARD_FILTERS,
  invoiceMatchesBoardFilter,
  JOB_STATUS_FILTERS,
  PAYMENT_BOARD_FILTERS,
  paymentMatchesBoardFilter,
  paymentNumber,
  withArchiveFilter,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Invoice } from "@/lib/types";

export function EstimatesView() {
  const status = useSearchParams().get("status") ?? "";
  const { session, estimates, provider } = usePortalWorkspace();
  const records = usePortalRecords();
  const share = useEstimateShare();
  const [createOpen, setCreateOpen] = useState(false);
  const archivedOnly = status === "archived";
  const rows = records
    .listed("estimate", records.mergeEstimates(estimates), archivedOnly)
    .map((item) => ({ ...item, status: records.statusOf("estimate", item.id, item.status) }))
    .filter((item) => (archivedOnly || !status ? true : item.status === status));

  return (
    <PortalPage
      eyebrow="Work / Estimates"
      title="Estimates"
      description="Site visit or write in the office, finalize, send for signature, then start the job."
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create estimate
        </Button>
      }
    >
      <CreateEstimateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <FilterTabs
        baseHref="/pro/dashboard/estimates"
        value={status}
        options={withArchiveFilter(ESTIMATE_STATUS_FILTERS)}
      />
      <PortalDataTable
        filename="estimates"
        countLabel="Estimates"
        searchPlaceholder="Search quotes"
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/estimates/${row.id}`}
        columns={[
          {
            id: "number",
            header: "Quote #",
            sortValue: (row) => row.number,
            searchValue: (row) => row.number,
            exportValue: (row) => row.number,
            cell: (row) => (
              <Link href={`/pro/dashboard/estimates/${row.id}`} className="font-medium text-primary hover:underline">
                {row.number}
              </Link>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) => getPortalCustomerName(provider, row.customerId),
            searchValue: (row) => getPortalCustomerName(provider, row.customerId),
            exportValue: (row) => getPortalCustomerName(provider, row.customerId),
            cell: (row) => (
              <Link href={`/pro/dashboard/customers/${row.customerId}`} className="text-primary hover:underline">
                {getPortalCustomerName(provider, row.customerId)}
              </Link>
            ),
          },
          {
            id: "street",
            header: "Job address",
            sortValue: (row) => row.propertyAddress.street,
            searchValue: (row) => `${row.propertyAddress.street} ${row.propertyAddress.city} ${row.propertyAddress.zip}`,
            exportValue: (row) => row.propertyAddress.street,
            cell: (row) => row.propertyAddress.street,
          },
          {
            id: "city",
            header: "City",
            sortValue: (row) => row.propertyAddress.city,
            searchValue: (row) => row.propertyAddress.city,
            exportValue: (row) => row.propertyAddress.city,
            cell: (row) => row.propertyAddress.city,
          },
          {
            id: "issued",
            header: "Issued",
            sortValue: (row) => row.issuedAt,
            searchValue: (row) => formatDate(row.issuedAt),
            exportValue: (row) => formatDate(row.issuedAt),
            cell: (row) => formatDate(row.issuedAt),
          },
          {
            id: "expires",
            header: "Expires",
            sortValue: (row) => row.expiresAt ?? "",
            searchValue: (row) => (row.expiresAt ? formatDate(row.expiresAt) : ""),
            exportValue: (row) => (row.expiresAt ? formatDate(row.expiresAt) : ""),
            cell: (row) => (row.expiresAt ? formatDate(row.expiresAt) : "—"),
          },
          {
            id: "subtotal",
            header: "Subtotal",
            sortValue: (row) => row.subtotal,
            searchValue: (row) => formatMoney(row.subtotal),
            exportValue: (row) => formatMoney(row.subtotal),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.subtotal),
          },
          {
            id: "tax",
            header: "Tax",
            sortValue: (row) => row.tax,
            searchValue: (row) => formatMoney(row.tax),
            exportValue: (row) => formatMoney(row.tax),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.tax),
          },
          {
            id: "total",
            header: "Total",
            sortValue: (row) => row.total,
            searchValue: (row) => formatMoney(row.total),
            exportValue: (row) => formatMoney(row.total),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.total),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            searchValue: (row) => estimateStatusLabel(row.status),
            exportValue: (row) => estimateStatusLabel(row.status),
            cell: (row) => <StatusPill label={estimateStatusLabel(row.status)} className={estimateStatusTone(row.status)} />,
          },
        ]}
        actions={(row) => [
          { label: "View", href: `/pro/dashboard/estimates/${row.id}` },
          {
            label: "Copy customer link",
            onSelect: () => {
              if (!estimateCanShare(row.status)) {
                toast.error("Finalize this estimate before sending it to the customer.");
                return;
              }
              const snapshot = buildEstimateSnapshot(row, {
                email: session?.email,
                companyName: provider.companyName,
                companyEmail: provider.email,
                companyPhone: provider.phone,
                customerName: getPortalCustomerName(provider, row.customerId),
              });
              share.saveSnapshot(snapshot);
              records.setStatus("estimate", row.id, "sent");
              void navigator.clipboard.writeText(shareUrlFor(snapshot.token));
              toast.success("Customer link copied.");
            },
          },
          ...(row.status === "site_visit"
            ? [{ label: "Open site visit", href: `/pro/dashboard/estimates/${row.id}?tab=visit` }]
            : []),
          ...(row.status === "inspected" || row.status === "draft" || row.status === "changes_requested"
            ? [
                {
                  label: "Finalize",
                  onSelect: () => {
                    records.setStatus("estimate", row.id, "finalized");
                    toast.success(`${row.number} finalized.`);
                  },
                },
              ]
            : []),
          ...(estimateCanShare(row.status) && row.status !== "sent"
            ? [
                {
                  label: "Mark sent",
                  onSelect: () => {
                    records.setStatus("estimate", row.id, "sent");
                    toast.success("Estimate marked sent.");
                  },
                },
              ]
            : []),
          ...(row.status === "accepted"
            ? []
            : [
                {
                  label: "Mark accepted",
                  onSelect: () => {
                    records.setStatus("estimate", row.id, "accepted");
                    toast.success("Estimate marked accepted.");
                  },
                },
              ]),
          ...(row.status === "rejected"
            ? []
            : [
                {
                  label: "Mark rejected",
                  onSelect: () => {
                    records.setStatus("estimate", row.id, "rejected");
                    toast.success("Estimate marked rejected.");
                  },
                },
              ]),
          {
            label: "Convert to job",
            href: `/pro/dashboard/estimates/${row.id}`,
          },
          archiveRowAction(records, "estimate", row.id, row.number),
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              records.remove("estimate", row.id);
              toast.success(`${row.number} removed from this board.`);
            },
          },
        ]}
      />
    </PortalPage>
  );
}

export function JobsView() {
  const status = useSearchParams().get("status") ?? "";
  const { jobs, provider, estimates, requests, invoices } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const [createOpen, setCreateOpen] = useState(false);
  const allEstimates = records.mergeEstimates(estimates);
  const allInvoices = records.mergeInvoices(invoices);
  const archivedOnly = status === "archived";
  const rows = records
    .listed("job", records.mergeJobs(jobs), archivedOnly)
    .map((item) => ({ ...item, status: records.statusOf("job", item.id, item.status) }))
    .filter((item) => (archivedOnly || !status ? true : item.status === status));

  return (
    <PortalPage
      eyebrow="Field work"
      title="Jobs"
      description="Approved estimates become jobs. Fixed services booked on the website skip the estimate and land here as work ready to start."
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create job
        </Button>
      }
    >
      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
      <FilterTabs
        baseHref="/pro/dashboard/jobs"
        value={status}
        options={withArchiveFilter(JOB_STATUS_FILTERS)}
      />
      <PortalDataTable
        filename="jobs"
        countLabel="Jobs"
        searchPlaceholder="Search jobs"
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
        columns={jobBoardColumns({
          estimates: allEstimates,
          requests,
          invoices: allInvoices,
          events,
          employeeLabel,
          customerName: (customerId) => {
            const match = customers.find((item) => item.id === customerId);
            return match ? crmCustomerName(match) : getPortalCustomerName(provider, customerId);
          },
        })}
        actions={(row) => [
          { label: "View", href: `/pro/dashboard/jobs/${row.id}` },
          { label: "Convert to invoice", href: `/pro/dashboard/jobs/${row.id}` },
          { label: "Assign on calendar", href: "/pro/dashboard/schedule" },
          ...(row.status === "in_progress"
            ? []
            : [
                {
                  label: "Start job",
                  onSelect: () => {
                    records.setStatus("job", row.id, "in_progress");
                    toast.success("Job marked in progress.");
                  },
                },
              ]),
          ...(row.status === "completed"
            ? []
            : [
                {
                  label: "Complete",
                  onSelect: () => {
                    records.setStatus("job", row.id, "completed");
                    toast.success("Job marked completed.");
                  },
                },
              ]),
          ...(row.status === "on_hold"
            ? []
            : [
                {
                  label: "Put on hold",
                  onSelect: () => {
                    records.setStatus("job", row.id, "on_hold");
                    toast.success("Job put on hold.");
                  },
                },
              ]),
          ...(row.status === "cancelled"
            ? []
            : [
                {
                  label: "Cancel",
                  onSelect: () => {
                    records.setStatus("job", row.id, "cancelled");
                    toast.success("Job cancelled.");
                  },
                },
              ]),
          archiveRowAction(records, "job", row.id, row.number),
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              records.remove("job", row.id);
              toast.success(`${row.number} removed from this board.`);
            },
          },
        ]}
      />
    </PortalPage>
  );
}

export function InvoicesView() {
  const status = useSearchParams().get("status") ?? "";
  const { invoices, jobs, estimates, requests, provider } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const archivedOnly = status === "archived";
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const rows = records
    .listed("invoice", records.mergeInvoices(invoices), archivedOnly)
    .map((item) => ({ ...item, status: records.statusOf("invoice", item.id, item.status) }))
    .filter((item) => archivedOnly || invoiceMatchesBoardFilter(item, status));

  return (
    <PortalPage eyebrow="Billing" title="Invoices" description="Each invoice keeps the original estimate plus approved extras.">
      <FilterTabs
        baseHref="/pro/dashboard/invoices"
        value={status}
        options={withArchiveFilter([
          ...INVOICE_BOARD_FILTERS,
          { value: "payments", label: "Payments", href: "/pro/dashboard/payments" },
        ])}
      />
      <PortalDataTable
        filename="invoices"
        countLabel="Invoices"
        searchPlaceholder="Search by invoice # or job #"
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/invoices/${row.id}`}
        columns={invoiceBoardColumns({
          jobs: allJobs,
          estimates: allEstimates,
          requests,
          customerName: (customerId) => {
            const match = customers.find((item) => item.id === customerId);
            return match ? crmCustomerName(match) : getPortalCustomerName(provider, customerId);
          },
        })}
        actions={(row) => [
          { label: "View", href: `/pro/dashboard/invoices/${row.id}` },
          ...(row.balanceDue > 0
            ? [
                {
                  label: "Apply payment",
                  onSelect: () => setPaying(row),
                },
              ]
            : []),
          ...(row.jobId && allJobs.some((job) => job.id === row.jobId)
            ? [{ label: "Open job", href: `/pro/dashboard/jobs/${row.jobId}` }]
            : []),
          ...(row.status === "sent"
            ? []
            : [
                {
                  label: "Mark sent",
                  onSelect: () => {
                    records.setStatus("invoice", row.id, "sent");
                    toast.success("Invoice marked sent.");
                  },
                },
              ]),
          ...(row.status === "paid"
            ? []
            : [
                {
                  label: "Mark paid",
                  onSelect: () => {
                    records.setStatus("invoice", row.id, "paid");
                    toast.success("Invoice marked paid.");
                  },
                },
              ]),
          ...(row.status === "overdue"
            ? []
            : [
                {
                  label: "Mark overdue",
                  onSelect: () => {
                    records.setStatus("invoice", row.id, "overdue");
                    toast.success("Invoice marked overdue.");
                  },
                },
              ]),
          archiveRowAction(records, "invoice", row.id, row.number),
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              records.remove("invoice", row.id);
              toast.success(`${row.number} removed from this board.`);
            },
          },
        ]}
      />
      <ApplyPaymentDialog
        open={Boolean(paying)}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        invoice={paying}
      />
    </PortalPage>
  );
}

export function PaymentsView() {
  const status = useSearchParams().get("status") ?? "";
  const { payments, invoices, jobs, estimates, requests, provider } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const archivedOnly = status === "archived";
  const allInvoices = records.mergeInvoices(invoices);
  const allJobs = records.mergeJobs(jobs);
  const allEstimates = records.mergeEstimates(estimates);
  const rows = records
    .listed("payment", records.mergePayments(payments), archivedOnly)
    .map((item) => ({ ...item, status: records.statusOf("payment", item.id, item.status) }))
    .filter((item) => archivedOnly || paymentMatchesBoardFilter(item, status));

  return (
    <PortalPage
      eyebrow="Money in"
      title="Payments"
      description="Deposits, progress payments, and completion balances recorded against invoices."
    >
      <FilterTabs
        baseHref="/pro/dashboard/payments"
        value={status}
        options={withArchiveFilter(PAYMENT_BOARD_FILTERS)}
      />
      <PortalDataTable
        filename="payments"
        countLabel="Payments"
        searchPlaceholder="Search by payment #, invoice #, or job #"
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/payments/${row.id}`}
        columns={paymentBoardColumns({
          invoices: allInvoices,
          jobs: allJobs,
          estimates: allEstimates,
          requests,
          customerName: (customerId) => {
            const match = customers.find((item) => item.id === customerId);
            return match ? crmCustomerName(match) : getPortalCustomerName(provider, customerId);
          },
        })}
        actions={(row) => {
          const invoice = allInvoices.find((item) => item.id === row.invoiceId);
          const job = invoice ? allJobs.find((item) => item.id === invoice.jobId) : undefined;
          return [
            { label: "View", href: `/pro/dashboard/payments/${row.id}` },
            ...(invoice ? [{ label: "Open invoice", href: `/pro/dashboard/invoices/${invoice.id}` }] : []),
            ...(job ? [{ label: "Open job", href: `/pro/dashboard/jobs/${job.id}` }] : []),
            archiveRowAction(records, "payment", row.id, paymentNumber(row)),
            {
              label: "Delete",
              variant: "destructive",
              onSelect: () => {
                records.remove("payment", row.id);
                toast.success(`${paymentNumber(row)} removed from this board.`);
              },
            },
          ];
        }}
      />
    </PortalPage>
  );
}
