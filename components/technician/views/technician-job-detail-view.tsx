"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, Mail, Phone } from "lucide-react";
import { SectionedLineItemsEditor } from "@/components/portal/estimate-v2/sectioned-line-items-editor";
import { LineItemsTotals, type CostingNoun } from "@/components/portal/job-costing";
import { PortalPage } from "@/components/portal/portal-page";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { jobCostMix, type JobCostLine } from "@/components/portal/use-job-costing";
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
import { TimeTrackingPanel } from "@/components/time-tracking/time-tracking-panel";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import type { TechLineItem } from "@/lib/api/technician-client";
import { formatClock } from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTechJob } from "@/store/technicianSlice";

const CLOSED_STATUSES = ["cancelled", "paid", "invoiced"];

const noop = () => undefined;

function toCostLine(item: TechLineItem, index: number): JobCostLine {
  const kind = item.kind === "labor" ? "labor" : item.kind === "equipment" ? "equipment" : "materials";
  return {
    id: item.id || `line_${index}`,
    description: item.description,
    kind,
    quantity: item.quantity,
    unit: item.unit || (kind === "labor" ? "hr" : "ea"),
    unitPrice: item.unitPrice,
    images: item.images,
    section: item.section,
  };
}

/** Read-only Labour & Material — same sectioned table and totals box as the Pro portal. */
export function TechLabourMaterial({
  items,
  noun,
  tax = 0,
  total,
}: {
  items: TechLineItem[];
  noun: CostingNoun;
  tax?: number;
  /** Server total when known; otherwise subtotal + tax. */
  total?: number;
}) {
  const lines = useMemo(() => items.map(toCostLine), [items]);
  const mix = useMemo(() => jobCostMix(lines), [lines]);
  if (!lines.length) return <EmptyNote>No labour or material lines yet.</EmptyNote>;
  const subtotal = mix.labor + mix.materials + mix.equipment;
  return (
    <div>
      <SectionedLineItemsEditor lines={lines} onChange={noop} locked />
      <LineItemsTotals
        labor={mix.labor}
        materials={mix.materials + mix.equipment}
        subtotal={subtotal}
        tax={tax}
        total={total ?? subtotal + tax}
        noun={noun}
      />
    </div>
  );
}

/** Label / value pair for the RecordWorkspace meta bar (matches Pro record pages). */
export function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

export function TabHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
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

  if (!data) {
    if (!entry || entry.loading) {
      return (
        <div className="rounded-md border border-input bg-card">
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

  const { job, schedule } = data;
  const customer = job.customerId;
  const snapshot = (job.customerSnapshot || {}) as Record<string, unknown>;
  const estimate = (job.estimateId || null) as Record<string, unknown> | null;
  const name = customerName(customer, snapshot);
  const phone = customer?.phone || String(snapshot.phone || "");
  const email = customer?.email || String(snapshot.email || "");
  const location =
    job.location && (job.location.address || job.location.city || (job.location.coordinates?.some(Boolean) ?? false))
      ? job.location
      : (snapshot.address as Record<string, unknown>) || null;
  const closed = CLOSED_STATUSES.includes(job.status);
  const changeOrders = job.changeOrders || [];
  const jobTax = Number(job.tax) || 0;
  const jobTotal = Number(job.total) || undefined;

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "materials", label: `Labour & Material (${items.length})` },
    { id: "time", label: "My time & pay", icon: Clock3 },
    ...(estimate || changeOrders.length ? [{ id: "estimates", label: "Estimate & changes" }] : []),
  ];

  return (
    <div className="overflow-hidden rounded-md border border-input">
      <RecordWorkspace
        href={technicianPaths.job(job.id)}
        label={`${job.number}${job.title ? ` · ${job.title}` : ""}`}
        kind="job"
        trackOpen={false}
        badge={<JobStatusPill status={job.status} />}
        actions={
          <>
            <TechChatButton side="technician" contextType="job" contextId={job.id} label="Chat with office" className="h-8" />
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href={technicianPaths.jobs}>
                <ArrowLeft className="size-3.5" /> My jobs
              </Link>
            </Button>
          </>
        }
        metaBar={
          <>
            <MetaItem label="Customer" value={name} />
            <MetaItem label="Scheduled" value={job.scheduledAt ? formatDate(job.scheduledAt) : "Not scheduled"} />
            <MetaItem label="Due" value={job.dueAt ? formatDate(job.dueAt) : "—"} />
          </>
        }
        tabs={tabs}
        subnavTabs={["materials", "time"]}
        subnav={(tab) =>
          tab === "materials" ? (
            <TabHeading title="Labour & Material" hint="Materials and labour for this job. Read only." />
          ) : (
            <TabHeading title="My time on this job" hint="Every clock-in starts a new session — hours, pay and payouts for this job." />
          )
        }
      >
        {(tab) => {
          if (tab === "materials") {
            return <TechLabourMaterial items={items} noun="job" tax={jobTax} total={jobTotal} />;
          }
          if (tab === "time") {
            return (
              <TimeTrackingPanel
                scopeKey={`tech:job:${job.id}`}
                technician
                jobId={job.id}
                defaultRange={{ preset: "all" }}
                defaultView="sessions"
                hrefFor={(kind, recordId) => (kind === "job" ? technicianPaths.job(recordId) : technicianPaths.estimate(recordId))}
              />
            );
          }
          if (tab === "estimates") {
            return (
              <div className="space-y-3">
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
                {changeOrders.length ? (
                  <DetailCard title="Approved change orders">
                    <ul className="space-y-2 text-sm">
                      {changeOrders.map((co) => (
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
              </div>
            );
          }
          return (
            <div className="space-y-3">
              <ClockControl
                target={{ kind: "job", id: job.id }}
                disabled={closed}
                disabledReason={closed ? `This job is ${job.status}; clocking in is closed.` : undefined}
              />
              <div className="grid gap-3 lg:grid-cols-3">
                <DetailCard title="Customer">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{name}</p>
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
                  <LocationBlock location={location} record={{ recordType: "job", recordNumber: job.number, customerName: name }} />
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
            </div>
          );
        }}
      </RecordWorkspace>
    </div>
  );
}
