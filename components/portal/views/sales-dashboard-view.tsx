"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreateEstimateDialog, CreateLeadDialog } from "@/components/portal/create-work-dialogs";
import { DashboardSwitcher } from "@/components/portal/dashboard-switcher";
import {
  BoardCard,
  DashboardSection,
  DateStamp,
  StatCell,
  dashboardGreeting,
  initials,
} from "@/components/portal/dashboard-widgets";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, moneyTone, requestTone } from "@/components/portal/status-pill";
import { LocalFilterTabs } from "@/components/portal/local-filter-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { estimateStatusTone } from "@/lib/data/portal";
import type { EstimateStatus, InvoiceStatus, RequestStatus } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProviderDashboard } from "@/store/dashboardSlice";
import { selectAuthUser } from "@/store/authSlice";

type SalesScale = "month" | "year";

const DONUT_COLORS = ["#003F7D", "#3d6b9a", "#5b8fa8", "#8aa8bc", "#c5d2dc"];
const RING = 2 * Math.PI * 54;

export function SalesDashboardView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.dashboard);
  const user = useAppSelector(selectAuthUser);
  const [scale, setScale] = useState<SalesScale>("month");
  const [leadOpen, setLeadOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const today = new Date();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    void dispatch(fetchProviderDashboard({ force: false, silent: true }));
  }, [dispatch]);

  useEffect(() => {
    if (!error || loading) return;
    toast.error(error);
  }, [error, loading]);

  const attention = data?.attention;
  const leads = data?.leads;
  const estimates = data?.estimates;
  const invoices = data?.invoices;
  const payments = data?.payments;
  const jobs = data?.jobs;

  const points = data?.salesChart?.[scale] ?? [];
  const billedTotal = points.reduce((sum, item) => sum + item.billed, 0);
  const collectedTotal = points.reduce((sum, item) => sum + item.collected, 0);
  const maxBar = Math.max(...points.map((item) => Math.max(item.billed, item.collected)), 1);
  const serviceMix = jobs?.byServiceMix ?? [];
  const mixTotal = jobs?.serviceMixTotal ?? 0;
  const showLoading = loading && !data;

  return (
    <PortalPage
      eyebrow="Sales"
      title={`${dashboardGreeting(today)}, ${firstName}`}
      description={`${formatLongDate(today)} · Estimates, invoices, and money in`}
      actions={<DashboardSwitcher />}
    >
      <div className={cn(showLoading && "opacity-60")}>
        <DashboardSection title="Needs attention" description="Sales items that need a follow-up.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCell
              label="Overdue invoices"
              value={String(attention?.overdueInvoices.count ?? 0)}
              note={`${formatMoney(attention?.overdueInvoices.amountPastDue ?? 0)} past due`}
              href="/pro/dashboard/invoices?status=overdue"
            />
            <StatCell
              label="Uninvoiced completed jobs"
              value={String(attention?.uninvoicedCompletedJobs ?? 0)}
              note="Finished work still waiting on an invoice"
              href="/pro/dashboard/jobs?status=completed"
            />
            <StatCell
              label="Estimates awaiting signature"
              value={String(attention?.estimatesAwaitingSignature.count ?? 0)}
              note={`${formatMoney(attention?.estimatesAwaitingSignature.totalOut ?? 0)} out`}
              href="/pro/dashboard/estimates?status=sent"
            />
          </div>
        </DashboardSection>

        <DashboardSection title="Leads" description="Open requests in the sales pipeline.">
          <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <StatCell
              label="Open leads"
              value={String(leads?.openCount ?? 0)}
              note="Not declined, closed, or converted"
              href="/pro/dashboard/requests"
            />
            <BoardCard title="Latest leads" href="/pro/dashboard/requests" hrefLabel="All leads">
              {(leads?.latest ?? []).map((request) => (
                <Link
                  key={request.id}
                  href={`/pro/dashboard/requests/${request.id}`}
                  className="flex items-center gap-3.5 px-(--card-spacing) py-3 hover:bg-muted/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold tracking-wide text-primary">
                    {initials(request.customerName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">{request.serviceName}</p>
                      <StatusPill
                        label={request.statusLabel}
                        tone={requestTone(request.status as RequestStatus)}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {request.customerName} · {request.neighborhood}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>
          </div>
        </DashboardSection>

        <DashboardSection title="Estimates" description="Quotes sent and waiting.">
          <BoardCard title="Latest estimates" href="/pro/dashboard/estimates" hrefLabel="All estimates">
            {(estimates?.latest ?? []).map((estimate) => (
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
                      · {estimate.customerName}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatMoney(estimate.total)}</p>
                </div>
                <StatusPill
                  label={estimate.statusLabel}
                  className={estimateStatusTone(estimate.status as EstimateStatus)}
                />
              </Link>
            ))}
          </BoardCard>
        </DashboardSection>

        <DashboardSection title="Invoices & payments" description="Billed vs collected and recent money movement.">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
            <Card className="border-input">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {scale === "year" ? "Sales by year" : "Sales by month"}
                  </CardTitle>
                  <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatMoney(collectedTotal)}
                  </p>
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
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {points.map((point) => (
                    <div key={point.key} className="flex flex-col items-center gap-2">
                      <div className="flex h-36 w-full items-end justify-center gap-1">
                        <div
                          className="w-1/2 rounded-sm bg-primary/15"
                          style={{
                            height: `${Math.max(4, (point.billed / maxBar) * 144)}px`,
                          }}
                          title={`Billed ${formatMoney(point.billed)}`}
                        />
                        <div
                          className="w-1/2 rounded-sm bg-primary"
                          style={{
                            height: `${Math.max(4, (point.collected / maxBar) * 144)}px`,
                          }}
                          title={`Collected ${formatMoney(point.collected)}`}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{point.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-input">
              <CardHeader className="gap-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Jobs by service
                </CardTitle>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(mixTotal)}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <ServiceMixChart rows={serviceMix} total={mixTotal} />
                <ul className="space-y-2 text-sm">
                  {serviceMix.map((item, index) => (
                    <li key={item.label} className="flex items-center justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            background: DONUT_COLORS[index % DONUT_COLORS.length],
                          }}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMoney(item.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BoardCard title="Latest invoices" href="/pro/dashboard/invoices" hrefLabel="All invoices">
              {(invoices?.latest ?? []).map((invoice) => (
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
                        · {invoice.customerName}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Balance {formatMoney(invoice.balanceDue)}
                      {invoice.daysOverdue ? ` · ${invoice.daysOverdue} days overdue` : ""}
                    </p>
                  </div>
                  <StatusPill
                    label={invoice.statusLabel}
                    tone={moneyTone(invoice.status as InvoiceStatus)}
                  />
                </Link>
              ))}
            </BoardCard>

            <BoardCard title="Recent payments" href="/pro/dashboard/payments" hrefLabel="All payments">
              {(payments?.latest ?? []).map((payment) => (
                <Link
                  key={payment.id}
                  href={`/pro/dashboard/payments/${payment.id}`}
                  className="flex items-center gap-3.5 px-(--card-spacing) py-3 hover:bg-muted/40"
                >
                  <DateStamp value={payment.paidAt} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{payment.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.invoiceNumber || "Invoice"} · {formatMoney(payment.amount)}
                    </p>
                  </div>
                </Link>
              ))}
            </BoardCard>
          </div>
        </DashboardSection>

        <section className="rounded-xl border border-input bg-card px-5 py-5">
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
      </div>

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
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
