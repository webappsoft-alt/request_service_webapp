"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { PortalPage } from "@/components/portal/portal-page";
import {
  ClockControl,
  DetailCard,
  EmptyNote,
  EstimateStatusPill,
  JobStatusPill,
  KeyValue,
  LocationBlock,
  customerName,
} from "@/components/technician/tech-ui";
import { TimeEntriesTable } from "@/components/time-tracking/time-tracking-ui";
import { PaymentHistoryTable, TimesheetKpis } from "@/components/time-tracking/timesheet-ui";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TechLineItem } from "@/lib/api/technician-client";
import { formatClock } from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTechJob } from "@/store/technicianSlice";

const CLOSED_STATUSES = ["cancelled", "paid", "invoiced"];

export function LineItemsTable({ items, empty }: { items: TechLineItem[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-border-soft">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary text-[11px] tracking-[0.12em] uppercase">
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id || index}>
              <TableCell>
                <p className="font-medium">{item.description}</p>
                {item.section ? <p className="text-xs text-muted-foreground">{item.section}</p> : null}
                {item.images?.length ? (
                  <div className="mt-1 flex gap-1">
                    {item.images.slice(0, 4).map((src) => (
                      <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnails */}
                        <img src={src} alt="" className="size-10 rounded border border-border-soft object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(item.unitPrice)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatMoney(item.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function personName(row: Record<string, unknown>) {
  return (
    String(row.companyName || "").trim() ||
    `${row.firstName || ""} ${row.lastName || ""}`.trim() ||
    "—"
  );
}

export function TechnicianJobDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const entry = useAppSelector((state) => state.technician.jobDetails[id]);
  const version = useAppSelector((state) => state.technician.versions.jobs);
  const timeVersion = useAppSelector((state) => state.timeTracking.version);
  const paymentVersion = useAppSelector((state) => state.timeTracking.paymentVersion);
  useEffect(() => {
    void dispatch(fetchTechJob(id));
  }, [dispatch, id, version, timeVersion, paymentVersion]);

  const data = entry?.data;
  const items = useMemo(() => data?.job.items ?? [], [data]);
  const materials = useMemo(() => items.filter((item) => item.kind === "material" || item.kind === "equipment"), [items]);
  const labour = useMemo(() => items.filter((item) => item.kind === "labor"), [items]);
  const other = useMemo(() => items.filter((item) => !["material", "equipment", "labor"].includes(item.kind)), [items]);

  if (!data) {
    if (!entry || entry.loading) {
      return (
        <div className="rounded-md border border-border-soft bg-card">
          <CenteredSpinner label="Loading job" className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <PortalPage eyebrow="Technician / Jobs" title="Job not available">
        <EmptyNote>{entry.error || "This job is not assigned to you."}</EmptyNote>
        <Button asChild size="sm" className="h-8 w-fit">
          <Link href={technicianPaths.jobs}>Back to my jobs</Link>
        </Button>
      </PortalPage>
    );
  }

  const { job, schedule, timeEntries, timeSummary, payments } = data;
  const customer = job.customerId;
  const snapshot = (job.customerSnapshot || {}) as Record<string, unknown>;
  const estimate = (job.estimateId || null) as Record<string, unknown> | null;
  const phone = customer?.phone || String(snapshot.phone || "");
  const email = customer?.email || String(snapshot.email || "");
  const location =
    job.location && (job.location.address || job.location.city || (job.location.coordinates?.some(Boolean) ?? false))
      ? job.location
      : (snapshot.address as Record<string, unknown>) || null;
  const closed = CLOSED_STATUSES.includes(job.status);
  const total = items.reduce((sum, item) => sum + (item.total || 0), 0);

  return (
    <PortalPage
      eyebrow="Technician / Job"
      title={`${job.number}${job.title ? ` · ${job.title}` : ""}`}
      badge={<JobStatusPill status={job.status} />}
      actions={
        <Button asChild size="sm" variant="outline" className="h-8">
          <Link href={technicianPaths.jobs}>
            <ArrowLeft className="size-3.5" /> My jobs
          </Link>
        </Button>
      }
    >
      <ClockControl
        target={{ kind: "job", id: job.id }}
        disabled={closed}
        disabledReason={closed ? `This job is ${job.status}; clocking in is closed.` : undefined}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <DetailCard title="Customer">
          <div className="space-y-2">
            <p className="text-sm font-semibold">{customerName(customer, snapshot)}</p>
            {phone ? (
              <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Phone className="size-3.5" aria-hidden /> {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Mail className="size-3.5" aria-hidden /> {email}
              </a>
            ) : null}
          </div>
        </DetailCard>

        <DetailCard title="Job location" className="lg:col-span-2">
          <LocationBlock
            location={location}
            record={{ recordType: "job", recordNumber: job.number, customerName: customerName(customer, snapshot) }}
          />
        </DetailCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DetailCard title="Job information" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <KeyValue label="Status" value={<JobStatusPill status={job.status} />} />
            <KeyValue label="Scheduled" value={job.scheduledAt ? formatDate(job.scheduledAt) : "Not scheduled"} />
            <KeyValue label="Due" value={job.dueAt ? formatDate(job.dueAt) : "—"} />
          </div>
          {job.notes ? (
            <div className="mt-3">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Job details</p>
              <div className="mt-1 text-sm whitespace-pre-wrap">{String(job.notes).replace(/<[^>]+>/g, "")}</div>
            </div>
          ) : null}
        </DetailCard>

        <DetailCard title="Crew">
          <div className="space-y-2 text-sm">
            {(job.assignedEmployees || []).map((row) => (
              <p key={String(row.id || row._id)}>
                {personName(row)} <span className="text-xs text-muted-foreground">· {String(row.role || "technician")}</span>
              </p>
            ))}
            {(job.assignedContractors || []).map((row) => (
              <p key={String(row.id || row._id)}>
                {personName(row)} <span className="text-xs text-muted-foreground">· contractor</span>
              </p>
            ))}
            {!(job.assignedEmployees || []).length && !(job.assignedContractors || []).length ? (
              <p className="text-muted-foreground">No crew listed.</p>
            ) : null}
          </div>
        </DetailCard>
      </div>

      <DetailCard title="Schedule">
        {schedule.length ? (
          <ul className="divide-y divide-border-soft text-sm">
            {schedule.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">
                  {formatDate(row.date)}
                  {row.endDate && row.endDate !== row.date ? ` – ${formatDate(row.endDate)}` : ""}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {formatClock(row.startMinutes)}–{formatClock(row.endMinutes)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No calendar visit booked for you on this job yet.</p>
        )}
      </DetailCard>

      <div className="grid gap-3 xl:grid-cols-2">
        <DetailCard title={`Materials (${materials.length})`}>
          <LineItemsTable items={materials} empty="No materials listed." />
        </DetailCard>
        <DetailCard title={`Labour (${labour.length})`}>
          <LineItemsTable items={labour} empty="No labour lines listed." />
        </DetailCard>
      </div>
      {other.length ? (
        <DetailCard title="Other line items">
          <LineItemsTable items={other} empty="" />
        </DetailCard>
      ) : null}
      {items.length ? (
        <p className="text-right text-sm text-muted-foreground">
          Job total <span className="font-semibold text-foreground">{formatMoney(total)}</span>
        </p>
      ) : null}

      {estimate ? (
        <DetailCard title="Original estimate">
          <div className="grid gap-3 sm:grid-cols-4">
            <KeyValue label="Estimate #" value={String(estimate.number || "—")} />
            <KeyValue label="Title" value={String(estimate.title || "—")} />
            <KeyValue label="Status" value={estimate.status ? <EstimateStatusPill status={String(estimate.status)} /> : "—"} />
            <KeyValue label="Total" value={formatMoney(Number(estimate.total) || 0)} />
          </div>
          {(estimate.siteVisit as Record<string, unknown> | undefined)?.findings ? (
            <p className="mt-3 text-sm">
              <span className="font-semibold">Site findings: </span>
              {String((estimate.siteVisit as Record<string, unknown>).findings)}
            </p>
          ) : null}
        </DetailCard>
      ) : null}

      {(job.changeOrders || []).length ? (
        <DetailCard title="Approved change orders">
          <ul className="space-y-2 text-sm">
            {(job.changeOrders || []).map((co) => (
              <li key={String(co.id || co._id)} className="flex justify-between gap-2">
                <span>
                  <span className="font-medium">{String(co.number || "")}</span> {String(co.title || "")}
                </span>
                <span className="tabular-nums">{formatMoney(Number(co.amount) || 0)}</span>
              </li>
            ))}
          </ul>
        </DetailCard>
      ) : null}

      <DetailCard title="My time on this job">
        <div className="space-y-3">
          <TimesheetKpis summary={timeSummary} ledger={payments.summary} />
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Clock-in history ({timeEntries.length} session{timeEntries.length === 1 ? "" : "s"})
            </h3>
            <p className="text-xs text-muted-foreground">
              Every clock-in starts a new session — finished sessions stay here with their duration and pay.
            </p>
            <TimeEntriesTable entries={timeEntries} empty="You have not clocked in on this job yet." />
          </div>
        </div>
      </DetailCard>

      <DetailCard title={job.status === "completed" ? "My payment for this job" : "My pay on this job"}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border-soft bg-muted/30 px-3 py-2.5 text-sm">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Earned</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(payments.summary.earned)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Paid</p>
              <p className="text-lg font-semibold text-emerald-700 tabular-nums">{formatMoney(payments.summary.paid)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Remaining</p>
              <p className={`text-lg font-semibold tabular-nums ${payments.summary.remaining > 0 ? "text-amber-700" : "text-muted-foreground"}`}>
                {formatMoney(payments.summary.remaining)}
              </p>
            </div>
          </div>
          {job.status !== "completed" && payments.summary.earned > 0 ? (
            <p className="text-xs text-muted-foreground">Earned from your completed sessions so far. The office can pay you any time.</p>
          ) : null}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Payment history ({payments.history.length})
            </h3>
            <PaymentHistoryTable payments={payments.history} empty="No payments for this job yet." />
          </div>
        </div>
      </DetailCard>
    </PortalPage>
  );
}
