"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { PortalTableColumn } from "@/components/portal/portal-data-table";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusDot, moneyTone } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invoiceDaysOverdue, invoiceStatusLabel } from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchProviderReports,
  type ReportLedgerRow,
} from "@/store/reportsSlice";
import type { InvoiceStatus } from "@/lib/types";

export function ReportsView() {
  const dispatch = useAppDispatch();
  const { data, loading, error, months } = useAppSelector((state) => state.reports);

  useEffect(() => {
    void dispatch(fetchProviderReports({ months, force: true, silent: true }));
  }, [dispatch, months]);

  useEffect(() => {
    if (!error || loading) return;
    toast.error(error);
  }, [error, loading]);

  const companyName = data?.companyName || "Your business";
  const period = data?.period?.label || "This period";
  const kpis = data?.kpis;
  const monthlyVolume = data?.monthlyVolume ?? [];
  const pipeline = data?.pipeline ?? [];
  const requestMix = data?.requestMix ?? [];
  const money = data?.moneyOnBooks;
  const ledger = data?.ledger ?? [];

  const collected = kpis?.collected ?? 0;
  const outstanding = kpis?.outstanding ?? 0;
  const paymentsCount = kpis?.paymentsCount ?? 0;
  const overdueInvoices = kpis?.overdueInvoices ?? 0;
  const conversion = kpis?.estimateConversion ?? 0;
  const accepted = kpis?.estimatesAccepted ?? 0;
  const sent = kpis?.estimatesSent ?? 0;
  const activeJobs = kpis?.activeJobs ?? 0;
  const completedJobs = kpis?.completedJobs ?? 0;
  const totalJobs = kpis?.totalJobs ?? 0;

  const maxRevenue = Math.max(...monthlyVolume.map((point) => point.value), 1);
  const latestRevenue = monthlyVolume[monthlyVolume.length - 1];
  const pipelineMax = Math.max(...pipeline.map((item) => item.value), 1);
  const requestMixTotal = requestMix.reduce((sum, item) => sum + item.value, 0);
  const invoiceMix = [
    { label: "Collected", value: money?.collected ?? collected },
    { label: "Outstanding", value: money?.outstanding ?? outstanding },
    { label: "Overdue", value: money?.overdue ?? 0 },
  ];
  const invoiceMixMax = Math.max(...invoiceMix.map((item) => item.value), 1);
  const households = money?.households ?? 0;
  const invoicesOnFile = money?.invoicesOnFile ?? ledger.length;

  function exportSummary() {
    const lines = [
      ["Company", companyName],
      ["Period", period],
      ["Collected", formatMoney(collected)],
      ["Outstanding", formatMoney(outstanding)],
      ["Payments", String(paymentsCount)],
      ["Households", String(households)],
      ["Leads", String(pipeline.find((item) => item.id === "requests")?.value ?? 0)],
      ["Estimates sent", String(sent)],
      ["Estimates accepted", String(accepted)],
      ["Conversion", `${conversion}%`],
      ["Jobs", String(totalJobs)],
      ["Active jobs", String(activeJobs)],
      ["Completed jobs", String(completedJobs)],
      ["Invoices overdue", String(overdueInvoices)],
      [],
      ["Invoice", "Customer", "Issued", "Total", "Paid", "Balance", "Status"],
      ...ledger.map((invoice) => [
        invoice.number,
        invoice.customerName,
        formatDate(invoice.issuedAt),
        formatMoney(invoice.total),
        formatMoney(invoice.amountPaid),
        formatMoney(invoice.balanceDue),
        invoiceStatusLabel(invoice.status as InvoiceStatus),
      ]),
    ];
    const csv = lines
      .map((row) => row.map((cell) => csvCell(String(cell ?? ""))).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "company-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalPage
      eyebrow="Insights"
      title="Reports"
      description={`${companyName} · ${period}. Totals come from this board’s jobs, estimates, and invoices.`}
      actions={
        <Button variant="outline" onClick={exportSummary} disabled={loading && !data}>
          <Download />
          Export report
        </Button>
      }
    >
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
          loading && !data && "opacity-60",
        )}
      >
        <Kpi
          label="Collected"
          value={formatMoney(collected)}
          note={`${paymentsCount} payment${paymentsCount === 1 ? "" : "s"} this period`}
          href="/pro/dashboard/payments"
        />
        <Kpi
          label="Outstanding"
          value={formatMoney(outstanding)}
          note={`${overdueInvoices} invoice${overdueInvoices === 1 ? "" : "s"} past due`}
          href="/pro/dashboard/invoices"
        />
        <Kpi
          label="Estimate conversion"
          value={`${conversion}%`}
          note={`${accepted} of ${sent} written estimates accepted`}
          href="/pro/dashboard/estimates"
        />
        <Kpi
          label="Active jobs"
          value={String(activeJobs)}
          note={`${completedJobs} completed · ${totalJobs} total`}
          href="/pro/dashboard/jobs"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="border-border">
          <CardHeader className="gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly volume</CardTitle>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatMoney(latestRevenue?.value ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {latestRevenue ? `${latestRevenue.label} production` : "This period"} · cash collected is{" "}
              {formatMoney(collected)}
            </p>
          </CardHeader>
          <CardContent>
            <div
              className="grid items-end gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(monthlyVolume.length || 6, 1)}, minmax(0, 1fr))`,
              }}
            >
              {(monthlyVolume.length > 0
                ? monthlyVolume
                : Array.from({ length: 6 }, (_, i) => ({
                    key: `empty-${i}`,
                    label: "—",
                    value: 0,
                    year: 0,
                  }))
              ).map((point, index, list) => {
                const last = index === list.length - 1;
                return (
                  <div key={point.key || point.label} className="flex flex-col items-center gap-2">
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {formatMoney(point.value)}
                    </p>
                    <div
                      className={cn("w-full rounded-sm", last ? "bg-primary" : "bg-primary/15")}
                      style={{ height: `${Math.max(16, (point.value / maxRevenue) * 140)}px` }}
                    />
                    <span className="text-[11px] text-muted-foreground">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">How work moves from request to paid invoice.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(pipeline.length > 0
              ? pipeline
              : [
                  { id: "requests", label: "Leads", value: 0, href: "/pro/dashboard/requests" },
                  { id: "estimates_sent", label: "Estimates sent", value: 0, href: "/pro/dashboard/estimates" },
                  { id: "accepted", label: "Accepted", value: 0, href: "/pro/dashboard/estimates?status=accepted" },
                  { id: "jobs", label: "Jobs", value: 0, href: "/pro/dashboard/jobs" },
                  { id: "invoices_paid", label: "Invoices paid", value: 0, href: "/pro/dashboard/invoices?status=paid" },
                ]
            ).map((item) => (
              <Link key={item.id || item.label} href={item.href} className="flex flex-col gap-1.5 hover:text-primary">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium tabular-nums">{item.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(6, (item.value / pipelineMax) * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Request mix</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {requestMix.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads in this period yet.</p>
            ) : (
              requestMix.map((item) => (
                <MixRow
                  key={item.status || item.label}
                  label={item.label}
                  value={item.value}
                  max={requestMixTotal}
                />
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Money on the books</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {invoiceMix.map((item) => (
              <MixRow
                key={item.label}
                label={item.label}
                value={item.value}
                max={invoiceMixMax}
                display={formatMoney(item.value)}
              />
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              {households} households · {invoicesOnFile} invoices on file
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Invoice ledger</h2>
          <p className="text-xs text-muted-foreground">Search, sort, or export the money lines behind the totals.</p>
        </div>
        <PortalDataTable
          filename="invoice-ledger"
          searchPlaceholder="Search by invoice # or job #"
          rows={ledger}
          rowKey={(row) => row.id}
          rowHref={(row) => `/pro/dashboard/invoices/${row.id}`}
          columns={reportLedgerColumns()}
          loading={loading && ledger.length === 0}
          actions={(row) => [{ label: "View", href: `/pro/dashboard/invoices/${row.id}` }]}
        />
      </section>
    </PortalPage>
  );
}

function reportLedgerColumns(): PortalTableColumn<ReportLedgerRow>[] {
  return [
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
      sortValue: (row) => row.jobNumber,
      searchValue: (row) => row.jobNumber,
      exportValue: (row) => row.jobNumber,
      cell: (row) =>
        row.jobId && row.jobNumber ? (
          <Link href={`/pro/dashboard/jobs/${row.jobId}`} className="text-primary hover:underline">
            {row.jobNumber}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      id: "issued",
      header: "Date issued",
      sortValue: (row) => row.issuedAt,
      searchValue: (row) => (row.issuedAt ? formatDate(row.issuedAt) : ""),
      exportValue: (row) => (row.issuedAt ? formatDate(row.issuedAt) : ""),
      cell: (row) => (row.issuedAt ? formatDate(row.issuedAt) : "—"),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      searchValue: (row) => invoiceStatusLabel(row.status as InvoiceStatus),
      exportValue: (row) => invoiceStatusLabel(row.status as InvoiceStatus),
      cell: (row) => (
        <StatusDot
          label={invoiceStatusLabel(row.status as InvoiceStatus)}
          tone={moneyTone(row.status as InvoiceStatus)}
        />
      ),
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
      sortValue: (row) =>
        invoiceDaysOverdue({
          dueAt: row.dueAt ?? undefined,
          status: row.status as InvoiceStatus,
        }),
      searchValue: (row) => {
        const days = invoiceDaysOverdue({
          dueAt: row.dueAt ?? undefined,
          status: row.status as InvoiceStatus,
        });
        return days ? String(days) : "";
      },
      exportValue: (row) => {
        const days = invoiceDaysOverdue({
          dueAt: row.dueAt ?? undefined,
          status: row.status as InvoiceStatus,
        });
        return days ? String(days) : "";
      },
      className: "tabular-nums",
      cell: (row) => {
        const days = invoiceDaysOverdue({
          dueAt: row.dueAt ?? undefined,
          status: row.status as InvoiceStatus,
        });
        return days ? <span className="font-semibold text-red-600">{days}</span> : "—";
      },
    },
    {
      id: "customer",
      header: "Customer",
      sortValue: (row) => row.customerName,
      searchValue: (row) => row.customerName,
      exportValue: (row) => row.customerName,
      cell: (row) =>
        row.customerId ? (
          <Link
            href={`/pro/dashboard/customers/${row.customerId}`}
            className="text-primary hover:underline"
          >
            {row.customerName || "—"}
          </Link>
        ) : (
          row.customerName || "—"
        ),
    },
    {
      id: "site",
      header: "Site",
      sortValue: (row) => row.site,
      searchValue: (row) => row.site,
      exportValue: (row) => row.site,
      cell: (row) => row.site || "—",
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
      sortValue: (row) => row.jobTitle,
      searchValue: (row) => row.jobTitle,
      exportValue: (row) => row.jobTitle,
      cell: (row) => row.jobTitle || "—",
    },
    {
      id: "type",
      header: "Invoice type",
      sortValue: (row) => row.invoiceType,
      searchValue: (row) => ledgerInvoiceTypeLabel(row.invoiceType),
      exportValue: (row) => ledgerInvoiceTypeLabel(row.invoiceType),
      cell: (row) => ledgerInvoiceTypeLabel(row.invoiceType),
    },
  ];
}

function ledgerInvoiceTypeLabel(type: string) {
  if (type === "progress") return "Progress invoice";
  if (type === "change_order") return "Change order";
  if (type === "draft") return "Draft invoice";
  return "Job invoice";
}

function Kpi({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Link>
  );
}

function MixRow({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{display ?? value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${max ? Math.max(6, (value / max) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}

function csvCell(value: string) {
  const next = value.replaceAll('"', '""');
  return /[",\n]/.test(next) ? `"${next}"` : next;
}
