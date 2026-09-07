"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CreateEstimateDialog, CreateLeadDialog } from "@/components/portal/create-work-dialogs";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import { BoardCard, DateStamp, StatCell, dashboardGreeting } from "@/components/portal/dashboard-widgets";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, moneyTone } from "@/components/portal/status-pill";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  estimateStatusLabel,
  estimateStatusTone,
  getPortalCustomerName,
  invoiceDaysOverdue,
  invoiceStatusLabel,
  jobServiceLabel,
  jobTotal,
  paymentNumber,
} from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

type SalesScale = "month" | "year";

const DONUT_COLORS = ["#003F7D", "#3d6b9a", "#5b8fa8", "#8aa8bc", "#c5d2dc"];
const RING = 2 * Math.PI * 54;

function jobIsActive(job: Job) {
  return job.status !== "completed" && job.status !== "invoiced" && job.status !== "paid" && job.status !== "cancelled";
}

function monthBuckets(today: Date, count = 12) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-US", { month: "short" }),
    };
  });
}

function yearBuckets(today: Date, count = 4) {
  return Array.from({ length: count }, (_, index) => {
    const year = today.getFullYear() - (count - 1 - index);
    return { key: String(year), label: String(year) };
  });
}

function bucketKey(value: string, scale: SalesScale) {
  return scale === "year" ? value.slice(0, 4) : value.slice(0, 7);
}

export function SalesDashboardView() {
  const { provider, requests, estimates, invoices, payments, jobs } = usePortalWorkspace();
  const { events } = usePortalCrew();
  const records = usePortalRecords();
  const [scale, setScale] = useState<SalesScale>("month");
  const [leadOpen, setLeadOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstName = provider.contact?.name?.split(" ")[0] ?? "there";

  const allRequests = records.listed("request", records.mergeRequests(requests), false);
  const allEstimates = records.listed("estimate", records.mergeEstimates(estimates), false);
  const allInvoices = records.listed("invoice", records.mergeInvoices(invoices), false);
  const allPayments = records.listed("payment", records.mergePayments(payments), false);
  const allJobs = records.listed("job", records.mergeJobs(jobs), false);

  const overdue = allInvoices.filter((item) => item.status === "overdue" || invoiceDaysOverdue(item) > 0);
  const uninvoiced = allJobs.filter((job) => job.status === "completed");
  const unassigned = allJobs.filter((job) => {
    if (!jobIsActive(job)) return false;
    const event = events.find((item) => item.kind === "job" && item.recordId === job.id);
    return !job.assignedTo && !event?.employeeId;
  });
  const awaitingSignature = allEstimates.filter((item) => item.status === "sent");

  const points = useMemo(() => {
    const buckets = scale === "year" ? yearBuckets(today) : monthBuckets(today);
    return buckets.map((bucket) => ({
      ...bucket,
      billed: allInvoices
        .filter((item) => bucketKey(item.issuedAt, scale) === bucket.key)
        .reduce((sum, item) => sum + item.total, 0),
      collected: allPayments
        .filter((item) => bucketKey(item.paidAt ?? item.createdAt, scale) === bucket.key)
        .reduce((sum, item) => sum + item.amount, 0),
    }));
  }, [allInvoices, allPayments, month, scale, year]);

  const billedTotal = points.reduce((sum, item) => sum + item.billed, 0);
  const collectedTotal = points.reduce((sum, item) => sum + item.collected, 0);
  const maxBar = Math.max(...points.map((item) => Math.max(item.billed, item.collected)), 1);

  const serviceMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of allJobs) {
      const estimate = allEstimates.find((item) => item.id === job.estimateId);
      const request = allRequests.find((item) => item.id === estimate?.requestId);
      const label = request?.categoryName || jobServiceLabel(job, allEstimates, allRequests);
      map.set(label, (map.get(label) ?? 0) + jobTotal(job));
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [allEstimates, allJobs, allRequests]);

  const mixTotal = serviceMix.reduce((sum, item) => sum + item.value, 0);

  return (
    <PortalPage
      eyebrow="Sales"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · Estimates, invoices, and money in`}
      actions={<DashboardSwitcher />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCell
          label="Overdue invoices"
          value={String(overdue.length)}
          note={`${formatMoney(overdue.reduce((sum, item) => sum + item.balanceDue, 0))} past due`}
          href="/pro/dashboard/invoices?status=overdue"
        />
        <StatCell
          label="Uninvoiced completed jobs"
          value={String(uninvoiced.length)}
          note="Finished work still waiting on an invoice"
          href="/pro/dashboard/jobs?status=completed"
        />
        <StatCell
          label="Jobs with no technician"
          value={String(unassigned.length)}
          note="Active jobs still unassigned"
          href="/pro/dashboard/jobs?status=unscheduled"
        />
        <StatCell
          label="Estimates awaiting signature"
          value={String(awaitingSignature.length)}
          note={`${formatMoney(awaitingSignature.reduce((sum, item) => sum + item.total, 0))} out`}
          href="/pro/dashboard/estimates?status=sent"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="border-border">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {scale === "year" ? "Sales by year" : "Sales by month"}
              </CardTitle>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(collectedTotal)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Collected · billed {formatMoney(billedTotal)}
              </p>
            </div>
            <LocalFilterTabs
              value={scale}
              onChange={(next) => setScale(next as SalesScale)}
              options={[
                { value: "month", label: "Monthly" },
                { value: "year", label: "Yearly" },
              ]}
            />
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary/20" />
                Billed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary" />
                Collected
              </span>
            </div>
            <div
              className="grid items-end gap-3"
              style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
            >
              {points.map((point) => (
                <div key={point.key} className="flex flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div
                      className="w-1/2 rounded-sm bg-primary/15"
                      style={{ height: `${Math.max(4, (point.billed / maxBar) * 144)}px` }}
                      title={`Billed ${formatMoney(point.billed)}`}
                    />
                    <div
                      className="w-1/2 rounded-sm bg-primary"
                      style={{ height: `${Math.max(4, (point.collected / maxBar) * 144)}px` }}
                      title={`Collected ${formatMoney(point.collected)}`}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{point.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jobs by service</CardTitle>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(mixTotal)}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <ServiceMixChart rows={serviceMix} total={mixTotal} />
            <ul className="space-y-2 text-sm">
              {serviceMix.map((item, index) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{formatMoney(item.value)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BoardCard title="Latest estimates" href="/pro/dashboard/estimates" hrefLabel="All estimates">
          {allEstimates.slice(0, 5).map((estimate) => (
            <Link
              key={estimate.id}
              href={`/pro/dashboard/estimates/${estimate.id}`}
              className="flex items-center justify-between gap-3 px-(--card-spacing) py-3 hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {estimate.number}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {getPortalCustomerName(provider, estimate.customerId)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatMoney(estimate.total)}</p>
              </div>
              <StatusPill label={estimateStatusLabel(estimate.status)} className={estimateStatusTone(estimate.status)} />
            </Link>
          ))}
        </BoardCard>

        <BoardCard title="Latest invoices" href="/pro/dashboard/invoices" hrefLabel="All invoices">
          {allInvoices.slice(0, 5).map((invoice) => (
            <Link
              key={invoice.id}
              href={`/pro/dashboard/invoices/${invoice.id}`}
              className="flex items-center justify-between gap-3 px-(--card-spacing) py-3 hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {invoice.number}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {getPortalCustomerName(provider, invoice.customerId)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Balance {formatMoney(invoice.balanceDue)}
                  {invoiceDaysOverdue(invoice) ? ` · ${invoiceDaysOverdue(invoice)} days overdue` : ""}
                </p>
              </div>
              <StatusPill label={invoiceStatusLabel(invoice.status)} tone={moneyTone(invoice.status)} />
            </Link>
          ))}
        </BoardCard>
      </div>

      <BoardCard title="Recent payments" href="/pro/dashboard/payments" hrefLabel="All payments">
        {allPayments.slice(0, 5).map((payment) => {
          const invoice = allInvoices.find((item) => item.id === payment.invoiceId);
          return (
            <Link
              key={payment.id}
              href={`/pro/dashboard/payments/${payment.id}`}
              className="flex items-center gap-3.5 px-(--card-spacing) py-3 hover:bg-muted/40"
            >
              <DateStamp value={payment.paidAt ?? payment.createdAt} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{paymentNumber(payment)}</p>
                <p className="text-xs text-muted-foreground">
                  {invoice?.number ?? "Invoice"} · {formatMoney(payment.amount)}
                </p>
              </div>
            </Link>
          );
        })}
      </BoardCard>

      <section className="rounded-xl border border-border bg-card px-5 py-5">
        <h2 className="text-sm font-semibold">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setLeadOpen(true)}>
            Create lead
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEstimateOpen(true)}>
            Create estimate
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pro/dashboard/invoices">Open invoices</Link>
          </Button>
        </div>
      </section>

      <CreateLeadDialog open={leadOpen} onOpenChange={setLeadOpen} />
      <CreateEstimateDialog open={estimateOpen} onOpenChange={setEstimateOpen} />
    </PortalPage>
  );
}

function ServiceMixChart({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  let offset = 0;
  return (
    <div className="relative mx-auto size-44">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e6ebf0" strokeWidth="16" />
        {rows.map((row, index) => {
          const share = total ? row.value / total : 0;
          const dash = RING * share;
          const circle = (
            <circle
              key={row.label}
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${dash} ${RING - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Jobs</p>
        <p className="text-lg font-semibold tabular-nums">{rows.length}</p>
      </div>
    </div>
  );
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
