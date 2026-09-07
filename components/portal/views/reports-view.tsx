"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { invoiceBoardColumns } from "@/components/portal/invoice-columns";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPortalCustomerName,
  invoiceStatusLabel,
  requestStatusLabel,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ReportsView() {
  const { provider, requests, estimates, jobs, invoices, payments, customers, stats, revenue } =
    usePortalWorkspace();

  const accepted = estimates.filter((item) => item.status === "accepted").length;
  const sent = estimates.filter(
    (item) => item.status === "sent" || item.status === "accepted" || item.status === "rejected",
  ).length;
  const conversion = sent ? Math.round((accepted / sent) * 100) : 0;
  const completedJobs = jobs.filter((item) => item.status === "completed").length;
  const maxRevenue = Math.max(...revenue.map((point) => point.value), 1);
  const latestRevenue = revenue[revenue.length - 1];
  const period = revenue.length ? `${revenue[0].label}–${revenue[revenue.length - 1].label} 2026` : "This year";

  const pipeline = [
    { label: "Requests", value: requests.length, href: "/pro/dashboard/requests" },
    { label: "Estimates sent", value: sent, href: "/pro/dashboard/estimates" },
    { label: "Accepted", value: accepted, href: "/pro/dashboard/estimates?status=accepted" },
    { label: "Jobs", value: jobs.length, href: "/pro/dashboard/jobs" },
    { label: "Invoices paid", value: invoices.filter((item) => item.status === "paid").length, href: "/pro/dashboard/invoices?status=paid" },
  ];
  const pipelineMax = Math.max(...pipeline.map((item) => item.value), 1);

  const requestMix = countBy(
    requests,
    (item) => item.status,
    (status) => requestStatusLabel(status),
  );
  const invoiceMix = [
    { label: "Collected", value: stats.revenue },
    { label: "Outstanding", value: stats.outstanding },
    { label: "Overdue", value: invoices.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.balanceDue, 0) },
  ];
  const invoiceMixMax = Math.max(...invoiceMix.map((item) => item.value), 1);

  function exportSummary() {
    const lines = [
      ["Company", provider.companyName],
      ["Period", period],
      ["Collected", formatMoney(stats.revenue)],
      ["Outstanding", formatMoney(stats.outstanding)],
      ["Payments", String(payments.length)],
      ["Households", String(customers.length)],
      ["Requests", String(requests.length)],
      ["Estimates sent", String(sent)],
      ["Estimates accepted", String(accepted)],
      ["Conversion", `${conversion}%`],
      ["Jobs", String(jobs.length)],
      ["Active jobs", String(stats.activeJobs)],
      ["Completed jobs", String(completedJobs)],
      ["Invoices unpaid", String(invoices.filter((item) => item.balanceDue > 0).length)],
      ["Invoices overdue", String(stats.overdueInvoices)],
      [],
      ["Invoice", "Customer", "Issued", "Total", "Paid", "Balance", "Status"],
      ...invoices.map((invoice) => [
        invoice.number,
        getPortalCustomerName(provider, invoice.customerId),
        formatDate(invoice.issuedAt),
        formatMoney(invoice.total),
        formatMoney(invoice.amountPaid),
        formatMoney(invoice.balanceDue),
        invoiceStatusLabel(invoice.status),
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
      description={`${provider.companyName} · ${period}. Totals come from this board’s jobs, estimates, and invoices.`}
      actions={
        <Button variant="outline" onClick={exportSummary}>
          <Download />
          Export report
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Collected"
          value={formatMoney(stats.revenue)}
          note={`${payments.length} payment${payments.length === 1 ? "" : "s"} this period`}
          href="/pro/dashboard/payments"
        />
        <Kpi
          label="Outstanding"
          value={formatMoney(stats.outstanding)}
          note={`${stats.overdueInvoices} invoice${stats.overdueInvoices === 1 ? "" : "s"} past due`}
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
          value={String(stats.activeJobs)}
          note={`${completedJobs} completed · ${jobs.length} total`}
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
              {formatMoney(stats.revenue)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 items-end gap-3">
              {revenue.map((point, index) => {
                const last = index === revenue.length - 1;
                return (
                  <div key={point.label} className="flex flex-col items-center gap-2">
                    <p className="text-[11px] tabular-nums text-muted-foreground">{formatMoney(point.value)}</p>
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
            {pipeline.map((item) => (
              <Link key={item.label} href={item.href} className="flex flex-col gap-1.5 hover:text-primary">
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
            {requestMix.map((item) => (
              <MixRow key={item.label} label={item.label} value={item.value} max={requests.length} />
            ))}
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
              {customers.length} households · {invoices.length} invoices on file
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
          rows={invoices}
          rowKey={(row) => row.id}
          rowHref={(row) => `/pro/dashboard/invoices/${row.id}`}
          columns={invoiceBoardColumns({
            jobs,
            estimates,
            requests,
            customerName: (customerId) => getPortalCustomerName(provider, customerId),
          })}
          actions={(row) => [{ label: "View", href: `/pro/dashboard/invoices/${row.id}` }]}
        />
      </section>
    </PortalPage>
  );
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

function countBy<T, K extends string>(
  items: T[],
  key: (item: T) => K,
  label: (key: K) => string,
) {
  const counts = new Map<K, number>();
  for (const item of items) {
    const next = key(item);
    counts.set(next, (counts.get(next) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([status, value]) => ({ label: label(status), value }));
}

function csvCell(value: string) {
  const next = value.replaceAll('"', '""');
  return /[",\n]/.test(next) ? `"${next}"` : next;
}
